"""Audio mix for the history shorts: narration + original SFX (cues in episodes/<name>.py), ducked, -14 LUFS."""
import importlib, json, os, subprocess, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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
SFX_DIRS = [SFX]


def sfx(name):
    for d in SFX_DIRS:
        p = f'{d}/{name}.wav'
        if os.path.exists(p):
            return read_wav(p)
    print('missing sfx', name)
    return None


def hit_s(name):
    global _MAN
    if _MAN is None:
        _MAN = {}
        for d in SFX_DIRS:
            try:
                man = json.load(open(f'{d}/manifest.json'))
                items = man if isinstance(man, list) else man.get('files', man)
                if isinstance(items, dict):
                    for k, v in items.items():
                        _MAN.setdefault(k.replace('.wav', ''), float(v.get('hit_s', 0.0)) if isinstance(v, dict) else 0.0)
                else:
                    for v in items:
                        nm = v.get('file', v.get('name', '')).replace('.wav', '')
                        _MAN.setdefault(nm, float(v.get('hit_s', 0.0)))
            except Exception as ex:
                print('manifest?', d, ex)
    return _MAN.get(name, 0.0)


def put_hit(m, name, t_hit, gain_db, bus='hits'):
    """Place a one-shot so that its main hit lands at t_hit."""
    m.put(bus, sfx(name), t_hit - hit_s(name), gain_db)


class Helpers:
    def __init__(self, tl):
        self.tl = tl
        self.put_hit, self.sfx, self.hit_s = put_hit, sfx, hit_s

    def wt(self, lid, prefix, nth=0):
        k = 0
        for w, a, b in self.tl['words'][lid]:
            if w.startswith(prefix):
                if k == nth:
                    return a
                k += 1
        return self.tl['lines'][lid]['start']


def build(tl):
    """Lay out every bus and return (voice, hits, beds) after ducking, each (n, 2) float32."""
    global SFX_DIRS, _MAN
    ep = importlib.import_module('episodes.' + tl.get('episode', os.environ.get('EPISODE', 'tunguska')))
    SFX_DIRS, _MAN = list(getattr(ep, 'SFX_DIRS', [SFX])), None
    L = tl['lines']
    m = Mix(tl['total'])
    for lid, ln in L.items():
        m.put('voice', read_wav(ln['wav']), ln['start'], 0.0)
    ep.mix_cues(m, tl, Helpers(tl))
    duck_beds, duck_hits = getattr(ep, 'DUCK', (-12.0, -10.0))

    # ducking: beds drop under the voice, hits less
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
    bed_gain = db(duck_beds * duck)[:, None]
    hit_gain = db(duck_hits * duck)[:, None]
    beds = m.beds * bed_gain
    if hasattr(ep, 'post_beds'):          # e.g. a tape stop on the music
        beds = ep.post_beds(beds, tl, SR)
    return m.voice, m.hits * hit_gain, beds


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
