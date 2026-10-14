"""Audio mix for the Tunguska short: narration + original SFX kit + original drone bed, ducked, -14 LUFS."""
import json, os, subprocess, sys, wave
import numpy as np

SR = 48000
SFX = '/home/user/work/sfx'
WORK = '/home/user/work/render'


def read_wav(path):
    with wave.open(path, 'rb') as w:
        sr, n, ch, sw = w.getframerate(), w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    if sw == 2:
        a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        a = np.where(v >= 2 ** 23, v - 2 ** 24, v).astype(np.float32) / 2 ** 23
    elif sw == 4:
        a = np.frombuffer(raw, np.int32).astype(np.float32) / 2 ** 31
    else:
        raise ValueError(sw)
    a = a.reshape(-1, ch)
    if ch == 1:
        a = np.repeat(a, 2, axis=1)
    if sr != SR:
        idx = np.arange(0, len(a) * SR / sr) * sr / SR
        i0 = np.clip(idx.astype(np.int64), 0, len(a) - 1)
        a = a[i0]
    return a


def db(x):
    return 10 ** (x / 20)


class Mix:
    def __init__(self, total):
        self.n = int(total * SR) + SR
        self.voice = np.zeros((self.n, 2), np.float32)
        self.hits = np.zeros((self.n, 2), np.float32)
        self.beds = np.zeros((self.n, 2), np.float32)

    def put(self, bus, a, t, gain_db=0.0, fade_in=0.0, fade_out=0.0, length=None):
        if a is None:
            return
        a = a.copy()
        if length is not None:
            need = int(length * SR)
            if len(a) < need:  # loop with short crossfade
                reps = need // len(a) + 1
                a = np.concatenate([a] * reps)[:need]
            else:
                a = a[:need]
        if fade_in > 0:
            k = min(len(a), int(fade_in * SR))
            a[:k] *= np.linspace(0, 1, k)[:, None]
        if fade_out > 0:
            k = min(len(a), int(fade_out * SR))
            a[-k:] *= np.linspace(1, 0, k)[:, None]
        s = int(round(t * SR))
        if s < 0:
            a = a[-s:]
            s = 0
        e = min(self.n, s + len(a))
        getattr(self, bus)[s:e] += a[:e - s] * db(gain_db)


_MAN = None


def sfx(name):
    p = f'{SFX}/{name}.wav'
    return read_wav(p) if os.path.exists(p) else None


def hit_s(name):
    global _MAN
    if _MAN is None:
        try:
            man = json.load(open(f'{SFX}/manifest.json'))
            items = man if isinstance(man, list) else man.get('files', man)
            _MAN = {}
            if isinstance(items, dict):
                for k, v in items.items():
                    _MAN[k.replace('.wav', '')] = float(v.get('hit_s', 0.0)) if isinstance(v, dict) else 0.0
            else:
                for v in items:
                    nm = v.get('file', v.get('name', '')).replace('.wav', '')
                    _MAN[nm] = float(v.get('hit_s', 0.0))
        except Exception as ex:
            print('manifest?', ex)
            _MAN = {}
    return _MAN.get(name, 0.0)


def put_hit(m, name, t_hit, gain_db, bus='hits'):
    """Place a one-shot so that its main hit lands at t_hit."""
    m.put(bus, sfx(name), t_hit - hit_s(name), gain_db)


def build(tl):
    """Lay out every bus and return (voice, hits, beds) after ducking, each (n, 2) float32."""
    L = tl['lines']
    m = Mix(tl['total'])
    for lid, ln in L.items():
        m.put('voice', read_wav(ln['wav']), ln['start'], 0.0)

    def wt(lid, prefix):
        for w, a, b in tl['words'][lid]:
            if w.startswith(prefix):
                return a
        return L[lid]['start']

    cuts = [sh['start'] for sh in tl['shots'][1:]]
    fire_t = wt('L4', 'ОГОНЬ')
    hit_t = wt('L5', 'УДАР')
    # hook
    put_hit(m, 'boom_hook', 0.12, -1.0)   # lands with the first flash of the picture
    m.put('hits', sfx('rumble_long'), 0.2, -14.0, fade_out=2.0, length=4.0)
    # cuts
    for c in cuts:
        if abs(c - fire_t) < 0.4 or abs(c - hit_t) < 0.4:
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -11.0)
    # morning in Vanavara
    m.put('beds', sfx('ambience_morning_taiga'), L['L3']['start'] - 0.5, -2.0, fade_in=0.6, fade_out=0.5,
          length=(L['L4']['start'] + 0.4) - (L['L3']['start'] - 0.5))
    # sky splits
    put_hit(m, 'riser_2s', fire_t, -12.0)
    put_hit(m, 'boom_big', fire_t, -3.0)
    put_hit(m, 'boom_hook', fire_t, -7.0)
    m.put('beds', sfx('fire_crackle'), fire_t, -4.0, fade_in=0.4, fade_out=0.8,
          length=L['L6']['start'] - fire_t)
    # the blow
    put_hit(m, 'shockwave', hit_t, -8.0)
    put_hit(m, 'sub_drop', hit_t, -5.0)
    put_hit(m, 'impact_soft', hit_t, -6.0)
    # number cards
    for cd in tl['cards']:
        put_hit(m, 'impact_soft', cd['start'], -4.0)
    put_hit(m, 'heartbeat', L['L5']['end'] + 0.1, -6.0)
    # forest falls
    m.put('hits', sfx('rumble_long'), L['L7']['start'] - 0.3, -12.0, fade_out=1.5)
    put_hit(m, 'shockwave', L['L7']['start'] - 0.08, -10.0)
    # glowing nights, newspaper
    put_hit(m, 'paper_rustle', wt('L8', 'ГАЗЕТУ'), -6.0)
    # expedition
    put_hit(m, 'camera_shutter_flash', L['L9']['start'] - 0.08, -5.0)
    m.put('beds', sfx('drone_bed_tension'), L['L9']['start'], -4.0, fade_in=1.0, fade_out=1.0,
          length=L['L11']['end'] - L['L9']['start'])
    m.put('beds', sfx('ambience_wind_dead_forest'), L['L10']['start'] - 0.3, -1.0, fade_in=0.8, fade_out=1.0,
          length=L['L12']['start'] + 0.5 - (L['L10']['start'] - 0.3))
    # ending
    put_hit(m, 'whoosh_long', L['L13']['start'] - 0.1, -8.0)
    put_hit(m, 'sting_end', L['L13']['end'] + 0.08, -3.0)
    # whole-film drone
    m.put('beds', sfx('drone_bed'), 0.0, -5.0, fade_in=1.5, fade_out=1.5, length=tl['total'])

    # ducking: beds drop up to 9 dB under the voice, hits up to 4 dB
    v = np.abs(m.voice).max(axis=1)
    win = int(0.05 * SR)
    env = np.convolve(v, np.ones(win) / win, mode='same')
    env = env / (env.max() + 1e-9)
    # attack fast, release slow
    out = np.empty_like(env)
    g = 0.0
    a_att, a_rel = 1 - np.exp(-1 / (0.03 * SR)), 1 - np.exp(-1 / (0.35 * SR))
    for i in range(0, len(env), 64):
        x = env[i]
        g += (x - g) * (a_att * 64 if x > g else a_rel * 64)
        out[i:i + 64] = g
    duck = np.clip(out * 4, 0, 1)
    bed_gain = db(-12 * duck)[:, None]
    hit_gain = db(-10 * duck)[:, None]
    return m.voice, m.hits * hit_gain, m.beds * bed_gain


def main(tl_path=f'{WORK}/timeline.json', out_wav=f'{WORK}/mix.wav'):
    tl = json.load(open(tl_path))
    voice, hits, beds = build(tl)
    mix = voice + hits + beds
    mix = mix[:int(tl['total'] * SR)]
    pk = np.abs(mix).max()
    if pk > 0.98:
        mix = mix * 0.98 / pk
    pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
    raw = f'{WORK}/mix_raw.wav'
    with wave.open(raw, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    # two-pass loudnorm to -14 LUFS, -1 dBTP
    r1 = subprocess.run(['ffmpeg', '-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json',
                         '-f', 'null', '-'], capture_output=True, text=True)
    js = r1.stderr[r1.stderr.rfind('{'):r1.stderr.rfind('}') + 1]
    st = json.loads(js)
    af = (f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
          f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:offset={st['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', af, '-ar', '48000', out_wav], check=True)
    print('mix written', out_wav, 'input LUFS', st['input_i'])


if __name__ == '__main__':
    main(*sys.argv[1:])
