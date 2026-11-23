# «Эндьюранс»: the timeline and the sound, from voice/script.json, the ElevenLabs narration clips and the ElevenLabs
# sound effects (/home/user/work/end/sfx/*.mp3 — real-sounding recordings, no synthesized cartoon one-shots: the
# owner's rule of 23.11). Writes build/timeline.json for the picture and build/voice.wav, fx.wav, beds.wav, music.wav,
# mix.wav (48 kHz stereo, −14 LUFS).
#
# Beds: an event's «beds» sets the level of each ambience from that moment on (others fade out over 2.5 s); each bed is
# its recording looped with crossfades. Music: «music» = (mood, level); the moods are slow pads (tense: D minor with an
# E-flat rubbing; calm; hope: F major; triumph: D major with a slow bell line; awe: an open fifth with glass notes),
# crossfading over 4 s. Everything but the voice ducks under the words.
# usage: python3 tools/doc.py <clips dir> [L05=<other dir> …]
import json
import os
import subprocess
import sys
import zlib

import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfx import SR, TAU, n_, tt, db, lp, hp, bp, fade, room, verb, pan  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
SFX = '/home/user/work/end/sfx'
D = json.load(open(os.path.join(ROOT, 'voice/script.json')))
CLIPS = sys.argv[1]
OVR = dict(a.split('=', 1) for a in sys.argv[2:])


def rng_for(key):
    return np.random.default_rng(zlib.crc32(key.encode()))


def decode(f, mono=True):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ar', str(SR), '-ac', '1' if mono else '2', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2).T


TEMPO = float(os.environ.get('TEMPO_N', '1.08'))      # the narrator reads a little slowly for a documentary


def load(id_):
    f = os.path.join(OVR.get(id_, CLIPS), f'{id_}.wav')
    who = next(l['who'] for l in D['lines'] if l['id'] == id_)
    if who == 'N' and abs(TEMPO - 1) > 1e-3:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-af', f'atempo={TEMPO}', '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).astype(np.float64)
    else:
        x = decode(f)
    w = n_(0.01)
    r = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, 'same'))
    on = np.where(r > max(db(-50), r.max() * db(-42)))[0]
    a, b = max(0, on[0] - n_(0.04)), min(len(x), on[-1] + n_(0.09))
    return fade(x[a:b], 0.008, 0.03)


def level(x, rms_db):
    return x * db(rms_db) / (np.sqrt(np.mean(x[np.abs(x) > 1e-4] ** 2)) + 1e-12)


def fx(id_, kind, x):
    rng = rng_for(id_)
    if kind == 'vo':
        return verb(pan(level(hp(x, 70), -20), 0), room(rng, 0.35, damp=6000), 0.04)
    if kind == 'quote':                                   # a remembered line: a little room around it
        return verb(pan(level(hp(x, 90), -20.5), 0), room(rng, 0.9, damp=4500), 0.16)
    if kind == 'shout':                                   # outdoors, over the sea
        return verb(pan(level(hp(x, 110), -19.5), 0), room(rng, 1.6, damp=4000), 0.22)
    if kind == 'far':                                     # from the beach, across the water
        return verb(pan(level(lp(hp(x, 160), 3200), -24), -0.3), room(rng, 2.2, damp=3000), 0.4)
    raise ValueError(kind)


# —— the timeline ——
EV = D['lines']
t = 0.0
lines, shots, overlays, sfx_at, keys = [], [], [], [], {'beds': [], 'music': [], 'scene': []}
VOX = {}
for e in EV:
    t += e.get('gap', 0)
    t0 = t
    if 'beat' in e:
        dur = e['beat']
    else:
        raw = load(e['id'])
        VOX[e['id']] = fx(e['id'], e['fx'], raw)
        dur = len(raw) / SR
    t1 = t0 + dur
    if e.get('shot') is not None:
        cut = t0 - 0.5 * e.get('gap', 0)
        if shots: shots[-1]['t1'] = cut
        shots.append({'img': e['shot'], 't0': cut, 't1': None, 'ev': e['id']})
    if 'text' in e:
        lines.append({'id': e['id'], 'who': e['who'], 'fx': e['fx'], 'text': e['text'], 't0': round(t0, 3), 't1': round(t1, 3)})
    if 'title' in e: overlays.append({'kind': 'title', 'text': e['title'], 'sub': e.get('subtitle'), 't0': t0, 't1': t1})
    if 'chapter' in e: overlays.append({'kind': 'chapter', 'text': e['chapter'], 'sub': e['ctitle'], 't0': t0, 't1': t1 + 0.6})
    if 'cap' in e: overlays.append({'kind': 'cap', 'text': e['cap'], 't0': t0 + (0.9 if 'chapter' in e else 0.2), 't1': t0 + max(4.5, dur + 0.5)})
    if e.get('overlay') == 'end': overlays.append({'kind': 'end', 't0': t0, 't1': t1})
    for s in e.get('sfx', []): sfx_at.append((s, t0, e['id']))
    if 'beds' in e: keys['beds'].append((t0, e['beds']))
    if 'music' in e: keys['music'].append((t0, e['music']))
    if 'chapter_scene' in e: keys['scene'].append((e['chapter_scene'], round(t0, 3)))
    e['_t0'], e['_t1'] = t0, t1
    t = t1
DUR = t
shots[-1]['t1'] = DUR
T = {e['id']: (e['_t0'], e['_t1']) for e in EV}
for o in overlays: o['t0'], o['t1'] = round(o['t0'], 3), round(o['t1'], 3)
tl = {'dur': round(DUR, 3), 'lines': lines, 'overlays': overlays, 'scenes': keys['scene'],
      'shots': [{**s, 't0': round(s['t0'], 3), 't1': round(s['t1'], 3)} for s in shots]}
os.makedirs(BUILD, exist_ok=True)
json.dump(tl, open(os.path.join(BUILD, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
print(f'timeline: {DUR:.1f} s ({int(DUR // 60)}:{DUR % 60:04.1f}), {len(lines)} lines, {len(shots)} shots', flush=True)
N = n_(DUR + 3)
TN = np.arange(N) / SR


def put(buf, y, t_, g=1.0):
    y = np.atleast_2d(y)
    if y.shape[0] == 1: y = np.vstack([y, y])
    i = n_(max(0, t_))
    m = min(y.shape[1], buf.shape[1] - i)
    if m > 0: buf[:, i:i + m] += g * y[:, :m]


voice = np.zeros((2, N))
for l in lines: put(voice, VOX[l['id']], l['t0'])

# —— one-shots (recordings) ——
SHOT_DB = {'ice_crack': -19, 'timber_break': -20, 'ship_sink': -22, 'whistle': -23, 'tug_horn': -23, 'snow_steps': -27,
           'slide': -23, 'axe_ice': -25, 'ice_saw': -26, 'cheer': -27, 'sonar': -25, 'football': -28, 'wave_hit': -19}
SHOT_AT = {'whistle': 1.6, 'tug_horn': 1.2, 'cheer': 0.6, 'wave_hit': 0.5}
fxb = np.zeros((2, N))
for name, t0, ev in sfx_at:
    y = decode(os.path.join(SFX, f'{name}.mp3'), mono=False)
    y = y * db(SHOT_DB[name]) / (np.sqrt(np.mean(y ** 2)) + 1e-9)
    y = y * fade(np.ones(y.shape[1]), 0.02, 0.6)
    put(fxb, y, t0 + SHOT_AT.get(name, 0.3))

# —— beds (recordings, looped) ——
BED_DB = {'wind': -27, 'ice_groan': -26, 'ship_creak': -28, 'sea': -26, 'storm': -23, 'rowing': -26, 'penguins': -29,
          'stove': -29, 'pebble_beach': -26, 'underwater': -24, 'harbor': -27, 'icebreaker': -26, 'cabin': -29}


def looped(name):
    y = decode(os.path.join(SFX, f'{name}.mp3'), mono=False)
    y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9)
    xf = n_(1.5)
    body = y[:, :-xf]
    tail, head = y[:, -xf:], y[:, :xf]
    ramp = np.linspace(0, 1, xf)
    seam = tail * (1 - ramp) + head * ramp                  # the end blends into the start
    unit = np.concatenate([seam, body[:, xf:]], axis=1)
    reps = int(np.ceil(N / unit.shape[1])) + 1
    return np.tile(unit, reps)[:, :N]


def env_for(name, ramp=2.5):
    pts = [(0.0, 0.0)]
    for t0, bd in keys['beds']:
        prev = pts[-1][1]
        pts += [(t0, prev), (t0 + ramp, bd.get(name, 0.0))]
    pts.append((N / SR, pts[-1][1]))
    ts, vs = zip(*pts)
    return np.interp(TN, ts, vs)


beds = np.zeros((2, N))
for name in BED_DB:
    e = env_for(name)
    if e.max() <= 0: continue
    beds += looped(name) * e * db(BED_DB[name])
print('beds done', flush=True)

# —— the score ——
MOODS = {  # notes (Hz), rub notes, brightness
    'tense': ([73.42, 110.0, 146.83], [155.56], 0.35),
    'calm': ([73.42, 110.0, 174.61], [], 0.3),
    'hope': ([87.31, 130.81, 220.0], [], 0.5),
    'triumph': ([73.42, 110.0, 185.0, 293.66], [], 0.65),
    'awe': ([55.0, 82.41, 164.81], [], 0.3),
}
SR2 = 12000


def pad_loop(notes, bright, seed, sec=16.0):
    r = np.random.default_rng(seed)
    t2 = np.arange(int(sec * SR2)) / SR2
    y = np.zeros_like(t2)
    for f in notes:
        for det in (-0.0018, 0.0016):
            for h in range(1, 8):
                y += np.sin(TAU * f * h * (1 + det) * t2 + r.uniform(0, TAU)) / h ** 1.25
    cut = 300 + 1300 * bright
    y = signal.sosfilt(signal.butter(2, cut, 'lowpass', fs=SR2, output='sos'), y)
    y = signal.resample_poly(y, SR // 1000, SR2 // 1000)
    return y / (np.std(y) + 1e-9)


def tile(loop, n, xf_sec=2.0):
    xf = n_(xf_sec)
    out = np.zeros(n + len(loop))
    step = len(loop) - xf
    w = np.ones(len(loop)); w[:xf] = np.linspace(0, 1, xf); w[-xf:] = np.linspace(1, 0, xf)
    for i in range(0, n, step): out[i:i + len(loop)] += loop * w
    return out[:n]


mus = np.zeros((2, N))
mk = keys['music']
for mood, (notes, rub, bright) in MOODS.items():
    # this mood's weight: 1 while it is the current mood (4 s crossfades), times the current level
    pts = [(0.0, 0.0)]
    for t0, (m, lev) in mk:
        prev = pts[-1][1]
        pts += [(t0, prev), (t0 + 4.0, lev if m == mood else 0.0)]
    pts.append((N / SR, pts[-1][1]))
    ts, vs = zip(*pts)
    w = np.interp(TN, ts, vs)
    if w.max() <= 0: continue
    for c in range(2):
        y = tile(pad_loop(notes, bright, zlib.crc32(mood.encode()) + c), N)
        if rub: y = y * 0.75 + tile(pad_loop(rub, bright, 7 + c), N) * 0.45
        y *= 1 + 0.18 * np.sin(TAU * 0.05 * TN + c * 1.9)
        mus[c] += y * w
    if mood == 'triumph':                                 # a slow, soft bell line over the major chord
        bell = np.zeros(N)
        seq = [587.33, 739.99, 880.0, 1174.66, 880.0, 739.99]
        k, t_ = 0, 0.0
        while t_ < N / SR - 4:
            i = n_(t_)
            if w[i] > 0.2:
                f = seq[k % len(seq)]
                sec = 3.5
                kk = tt(sec)
                ping = (np.sin(TAU * f * kk) + 0.3 * np.sin(TAU * f * 2.0 * kk) + 0.12 * np.sin(TAU * f * 3.0 * kk)) * np.exp(-kk / 1.4)
                bell[i:i + len(ping)] += ping[:N - i] * w[i] * 0.35
                k += 1
            t_ += 1.6
        mus += pan(bell, 0.1) * 1.0
    if mood in ('tense', 'awe'):                          # sparse glass notes
        r = rng_for('glass' + mood)
        t_ = 3.0
        while t_ < N / SR - 4:
            i = n_(t_)
            if w[i] > 0.3:
                f = r.choice([587.33, 622.25, 880.0, 698.46, 1174.66])
                sec = 3.0
                kk = tt(sec)
                ping = (np.sin(TAU * f * kk) + 0.25 * np.sin(TAU * f * 2.76 * kk)) * np.exp(-kk / 1.1) * fade(np.ones(n_(sec)), 0.02, 0.3)
                put(mus, pan(ping * w[i] * 0.4, r.uniform(-0.4, 0.4)), t_)
            t_ += r.uniform(6.0, 10.0)
mus = hp(mus, 50)
mus = verb(mus, room(rng_for('music'), 3.0, damp=3500), 0.3)[:, :N]
mus *= db(-30) / (np.sqrt(np.mean(mus[:, np.abs(mus[0]) > 1e-4] ** 2)) + 1e-9) * 1.0
print('music done', flush=True)

# —— ducking, mix, loudness ——
ve = np.abs(voice).max(0)
ve = signal.sosfiltfilt(signal.butter(1, 2.0, fs=SR, output='sos'), (ve > db(-40)).astype(float))
duck = np.clip(ve, 0, 1)
beds *= 1 - 0.45 * duck
mus *= 1 - 0.3 * duck
fxb *= 1 - 0.25 * duck
end = n_(DUR + 0.5)
for name, buf in [('voice', voice), ('fx', fxb), ('beds', beds), ('music', mus)]:
    sf.write(os.path.join(BUILD, f'{name}.wav'), np.clip(buf[:, :end].T, -1, 1), SR, subtype='PCM_16')   # stems for checking only: 16-bit keeps the disk free
mix = (voice + fxb + beds + mus)[:, :end]
mix[:, -n_(3.0):] *= np.linspace(1, 0, n_(3.0)) ** 2
sf.write(os.path.join(BUILD, 'mix_raw.wav'), mix.T.astype(np.float32), SR)
m = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(BUILD, 'mix_raw.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=14:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
af = (f"loudnorm=I=-14:TP=-1.5:LRA=14:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.8:attack=2:release=50:level=disabled")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(BUILD, 'mix_raw.wav'), '-af', af, '-ar', str(SR), os.path.join(BUILD, 'mix.wav')], check=True)
os.remove(os.path.join(BUILD, 'mix_raw.wav'))
# subtitles for YouTube
def ts(x):
    h, r_ = divmod(x, 3600); m_, s_ = divmod(r_, 60)
    return f'{int(h):02d}:{int(m_):02d}:{int(s_):02d},{int((s_ % 1) * 1000):03d}'
with open(os.path.join(BUILD, 'subs.srt'), 'w') as f:
    for i, l in enumerate(lines, 1):
        f.write(f"{i}\n{ts(l['t0'])} --> {ts(l['t1'] + 0.3)}\n{l['text']}\n\n")
print('mix: input', j['input_i'], 'LUFS, LRA', j['input_lra'])
