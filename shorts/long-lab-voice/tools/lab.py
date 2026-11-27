# The long horror's timeline and sound, from voice/script.json and the ElevenLabs clips (one wav per line).
# Writes build/timeline.json (lines, shots, overlays and states for the picture) and build/voice.wav, build/fx.wav,
# build/amb.wav, build/mix.wav (48 kHz stereo).
#
# The mimic is literal: a «copy» line plays another line's clip, and «parts» splices clips (the radio intro is the real
# Sokolov's recorded words with one new sentence in the middle). A copy with the same effect also gets the same radio
# click and static (the noise is seeded by the source line), so «Ты всё делаешь правильно» returns bit for bit.
#
# Sound in three states, as the script asks: (1) a low transformer drone over the ventilation from the first radio
# contact, (2) near silence from the moment the lie shows (the drone cuts off mid-air), (3) a metallic pulse under the
# 60-second countdown. Outside: rain, and for the first time no hum.
# usage: python3 tools/lab.py <clips dir> [L05=<other dir> …]
import json
import os
import subprocess
import sys
import time
import zlib

import numpy as np
import soundfile as sf
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx as X  # noqa: E402
from sfx import SR, TAU, n_, tt, db, lp, hp, bp, colored, white, env, fade, norm, partials, sweep, room, verb, pan  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')
D = json.load(open(os.path.join(ROOT, 'voice/script.json')))
CLIPS = sys.argv[1]
OVR = dict(a.split('=', 1) for a in sys.argv[2:])
_T0 = time.time()


def mark(what):
    print(f'  {time.time() - _T0:6.1f} s  {what}', flush=True)


TEMPO = {'N': float(os.environ.get('TEMPO_N', '1.0'))}


def rng_for(key):
    return np.random.default_rng(zlib.crc32(key.encode()))


# —— clips ——
def load(id_):
    f = os.path.join(OVR.get(id_, CLIPS), f'{id_}.wav')
    who = next(l['who'] for l in D['lines'] if l['id'] == id_)
    tempo = TEMPO.get(who, 1.0)
    af = f'atempo={tempo},' if abs(tempo - 1) > 1e-3 else ''
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-af', f'{af}aresample={SR}', '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    # trim the silence ElevenLabs leaves at both ends: 10 ms RMS against the clip's peak
    w = n_(0.01)
    r = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, 'same'))
    on = np.where(r > max(db(-50), r.max() * db(-42)))[0]
    a, b = max(0, on[0] - n_(0.04)), min(len(x), on[-1] + n_(0.09))
    return fade(x[a:b], 0.008, 0.03)


RAW = {}


def raw(id_):
    if id_ not in RAW:
        l = next(l for l in D['lines'] if l['id'] == id_)
        if 'parts' in l:
            gap = np.zeros(n_(0.32))
            seq = []
            for p in l['parts']:
                seq += [raw(p), gap]
            RAW[id_] = np.concatenate(seq[:-1])
        elif 'copy' in l:
            RAW[id_] = raw(l['copy'])
        else:
            RAW[id_] = load(id_)
    return RAW[id_]


# —— voice effects (mono in, stereo out at a target loudness) ——
def level(x, rms_db):
    return x * db(rms_db) / (np.sqrt(np.mean(x[np.abs(x) > 1e-4] ** 2)) + 1e-12)


def sat(x, k):
    return np.tanh(k * x / (np.max(np.abs(x)) + 1e-12)) / np.tanh(k)


def squelch(rng, sec, lo=900, hi=6000):
    t = tt(sec)
    k = bp(white(rng, sec), lo, hi) * np.exp(-t / (sec * 0.45)) * 0.5
    click = np.zeros(n_(sec))
    c = bp(white(rng, 0.004), 1500, 9000)
    click[:len(c)] += c * 1.6
    return k + click


def radio(x, rng, rms=-21):
    y = bp(x, 380, 3000, 4)
    y = sat(y, 2.6)
    y = bp(y, 300, 3400, 2)
    y = level(y, rms)
    head, tail = squelch(rng, 0.11), squelch(rng, 0.16)[::-1] * 0.8
    under = bp(white(rng, len(y) / SR), 1200, 5000) * db(rms - 14)
    y = np.concatenate([head * db(rms + 2), y + under, tail * db(rms + 2)])
    return pan(y, 0.05)


def fx(id_, kind, x):
    src = next(l for l in D['lines'] if l['id'] == id_)
    seed_id = src['copy'] if 'copy' in src and next(l for l in D['lines'] if l['id'] == src['copy']).get('fx') == kind else id_
    rng = rng_for(seed_id)
    if kind == 'vo':
        y = level(hp(x, 70), -20)
        return verb(pan(y, 0), room(rng, 0.35, damp=6000), 0.05)
    if kind == 'whisper':
        y = level(hp(x, 120), -21.5)
        return verb(pan(y, 0), room(rng, 0.45, damp=5000), 0.12)
    if kind == 'radio':
        return radio(x, rng)
    if kind == 'door':
        y = level(lp(hp(x, 140), 1500, 2), -23)               # through a door, but every word must still land
        return verb(pan(y, 0.25), room(rng, 0.6, damp=1800), 0.25)
    if kind == 'glass':
        y = level(lp(hp(x, 150), 2300, 2), -27)
        return verb(pan(y, -0.35), room(rng, 1.0, damp=3000), 0.38)
    if kind == 'room':
        y = level(lp(hp(x, 160), 2000, 2), -27)
        return verb(pan(y, 0.5), room(rng, 1.3, damp=2600), 0.38)
    if kind == 'near':
        y = signal.resample_poly(x, 100, 93)                     # a little lower and slower: the same words, not the same man
        y = level(lp(hp(y, 90), 3600), -26)
        return verb(pan(y, -0.25), room(rng, 1.7, damp=3000), 0.32)
    if kind == 'pa':
        y = sat(bp(x, 320, 3800, 3), 2.0)
        y = level(y, -21)
        p = rng.uniform(-0.45, 0.45)
        s = pan(y, p)
        out = np.zeros((2, s.shape[1] + n_(0.9)))
        for dt, g, pp in [(0, 1, p), (0.21, db(-8), -p), (0.43, db(-14), p * 0.5)]:
            i = n_(dt)
            out[:, i:i + s.shape[1]] += pan(y, pp) * g
        return verb(out, room(rng, 1.8, damp=2600), 0.28)
    if kind == 'intercom':
        y = sat(bp(x, 450, 3400, 4), 1.6)
        y = X.peak(y, 1200, 2, 5)
        y = level(y, -25)
        return verb(pan(y, 0.25), room(rng, 0.25, damp=5000), 0.1)
    if kind == 'calm':
        y = level(hp(x, 80), -20.5)
        return verb(pan(y, 0), room(rng, 1.3, damp=3500), 0.2)
    raise ValueError(kind)


# —— the timeline ——
EV = [l for l in D['lines'] if not l.get('voice_only')]
t = 0.0
lines, shots, overlays, sfx_at, states = [], [], [], [], {}
cur_shot = None
VOX = {}
for e in EV:
    t += e.get('gap', 0)
    t0 = t
    if 'beat' in e:
        dur = e['beat']
    else:
        VOX[e['id']] = fx(e['id'], e['fx'], raw(e['id']))
        dur = VOX[e['id']].shape[1] / SR
        # the reverb tail runs on under the next line; the line «ends» where the words end
        words = raw(e['id']).shape[0] / SR + (0.27 if e['fx'] == 'radio' else 0)
        dur = min(dur, words)
    t1 = t0 + dur
    if e.get('shot') is not None:
        cut = t0 - 0.5 * e.get('gap', 0)
        if shots: shots[-1]['t1'] = cut
        shots.append({'img': e['shot'], 't0': cut, 't1': None, 'ev': e['id']})
    if 'text' in e or 'copy' in e:
        src = e if 'text' in e else next(l for l in D['lines'] if l['id'] == e['copy'])
        lines.append({'id': e['id'], 'who': src['who'], 'fx': e['fx'], 'text': src['text'], 't0': round(t0, 3), 't1': round(t1, 3)})
    for k in ('overlay', 'title'):
        if k in e: overlays.append({'kind': e[k] if k == 'overlay' else 'title', 'text': e.get('title'), 't0': round(t0, 3), 'ev': e['id']})
    for s in e.get('sfx', []):
        sfx_at.append((s, t0, e['id']))
    for k in ('drone', 'dark', 'pulse', 'rain', 'scene'):
        if k in e: states.setdefault(k, []).append((e[k], round(t0, 3), e['id']))
    e['_t0'], e['_t1'] = t0, t1
    t = t1
DUR = t
shots[-1]['t1'] = DUR
T = {e['id']: (e['_t0'], e['_t1']) for e in EV}

# overlays end where their scene moves on
ENDS = {'memo': ('B06', 1), 'progress': ('L36', 0), 'badge': ('B10', 1), 'plan': ('L40', 0), 'cctv': ('B14', 1),
        'timer': ('B17', 0), 'saved': ('B17', 1), 'message': ('B19', 1), 'end': ('B23', 1), 'title': ('B03', 1)}
for o in overlays:
    ev, side = ENDS[o['kind']]
    o['t1'] = round(T[ev][side], 3)


def span(key, on=1):
    """(start, end) pairs of a state from the events that switch it"""
    out, start = [], None
    for v, t_, _ in states.get(key, []):
        if v == on and start is None: start = t_
        elif v != on and start is not None: out.append((start, t_)); start = None
    if start is not None: out.append((start, DUR))
    return out


tl = {'dur': round(DUR, 3), 'lines': lines, 'shots': [{**s, 't0': round(s['t0'], 3), 't1': round(s['t1'], 3)} for s in shots],
      'overlays': overlays, 'dark': span('dark'), 'pulse': span('pulse'), 'rain': span('rain'), 'drone': span('drone'),
      'scenes': [(v, t_) for v, t_, _ in states.get('scene', [])],
      'cuts': {'torch_on': T['L26'][0], 'lever': T['L59'][1], 'door_stop': T['B16'][0], 'turn': T['B13'][0]}}
os.makedirs(BUILD, exist_ok=True)
json.dump(tl, open(os.path.join(BUILD, 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
print(f'timeline: {DUR:.1f} s ({int(DUR // 60)}:{DUR % 60:04.1f}), {len(lines)} lines, {len(shots)} shots')

N = n_(DUR + 3)


def put(buf, y, t_, g=1.0):
    y = np.atleast_2d(y)
    if y.shape[0] == 1: y = np.vstack([y, y])
    i = n_(t_)
    m = min(y.shape[1], buf.shape[1] - i)
    if m > 0: buf[:, i:i + m] += g * y[:, :m]


mark('voice fx'); voice = np.zeros((2, N))
for l in lines:
    put(voice, VOX[l['id']], l['t0'])


# —— one-shots ——
def mono(y):
    return y.mean(0) if np.ndim(y) == 2 else y


def pan2(x, p):
    return x if np.ndim(x) == 2 else pan(x, p)


def step(rng, hard=1.0):
    sec = 0.32
    y = X.thump(rng, sec, 85 + rng.uniform(-10, 10), 900, 0.035) * 0.9
    grit = bp(white(rng, sec), 1500, 6000) * env(sec, 0.001, 0.012) * 0.35 * hard
    heel = np.zeros(n_(sec)); s = n_(0.05 + rng.uniform(0, 0.02))
    c = bp(white(rng, 0.06), 600, 3000) * env(0.06, 0.001, 0.015) * 0.4
    heel[s:s + len(c)] += c
    return y + grit + heel


def walk(rng, dur=2.0, every=0.56, g=0.5, p=0.0, wet=0.3):
    out = np.zeros(n_(dur + 1.5)); s = 0.0
    while s < dur:
        y = step(rng) * g * rng.uniform(0.75, 1.0)
        i = n_(s); out[i:i + len(y)] += y[:len(out) - i]
        s += every * rng.uniform(0.92, 1.08)
    return verb(pan(out, p), room(rng, 1.3, damp=4000), wet)


def run_(rng, dur=2.0):
    return walk(rng, dur, 0.29, 0.55, 0.0, 0.25)


def breath(rng, dur, every=2.2, g=0.18, lo=500, hi=2400):
    out = np.zeros(n_(dur)); s = 0.0
    while s < dur - 0.5:
        for sec, a, f0, f1 in [(every * 0.38, 0.8, lo, hi), (every * 0.48, 1.0, lo * 0.8, hi * 0.7)]:
            k = tt(sec) / sec
            y = bp(colored(rng, sec, -1), f0, f1) * np.sin(np.pi * k) ** 1.6 * a
            i = n_(s); out[i:i + len(y)] += y[:len(out) - i]
            s += sec + 0.05
        s += every * 0.14 * rng.uniform(0.6, 1.4)
    return pan(out * g, 0)


def creak(rng, sec=1.3, f0=360, f1=470, g=0.35):
    t = tt(sec)
    jit = np.cumsum(rng.standard_normal(len(t))) / SR * 40
    ph = sweep(sec, f0, f1) + TAU * jit
    y = X.harm(ph, 10, 1.1) * (0.6 + 0.4 * np.abs(np.sin(TAU * 17 * t)))
    y = bp(y, 300, 3000) * np.sin(np.pi * t / sec) ** 0.7
    return norm(verb(y, room(rng, 1.0, damp=3500), 0.3), g)


def squeak(rng, sec=0.7):
    t = tt(sec)
    y = np.sin(sweep(sec, 1350, 980)) * (0.5 + 0.5 * np.abs(np.sin(TAU * 31 * t))) * np.sin(np.pi * t / sec)
    return norm(verb(pan(bp(y, 700, 3000), -0.35), room(rng, 1.0, damp=4000), 0.4), 0.09)


def shuffle(rng, dur=4.0, g=0.3, p=-0.3, wet=0.35):
    out = np.zeros(n_(dur + 1)); s = 0.0
    while s < dur:
        y = X.scrape(rng, rng.uniform(0.5, 0.8))
        y = lp(y, 1400) * g * rng.uniform(0.7, 1)
        i = n_(s); out[i:i + len(y)] += y[:len(out) - i]
        s += rng.uniform(0.95, 1.25)
    return verb(pan(out, p), room(rng, 1.6, damp=2500), wet)


def tv(rng, dur):
    t = tt(dur)
    syl = lp(np.abs(colored(rng, dur, 0)), 5) * 4
    talk = bp(colored(rng, dur, -1), 300, 2400) * np.clip(syl, 0, 1.5)
    hum = sum(np.sin(TAU * 50 * h * t) / h for h in (1, 2, 3)) * 0.15
    y = lp(talk + hum, 1800)
    return verb(pan(y / (np.std(y) + 1e-9), 0.45), room(rng, 0.7, damp=2500), 0.4)


def beeps(rng, n=3, f=880, every=0.5, sec=0.16, g=0.25):
    out = np.zeros(n_(every * n + 1))
    for k in range(n):
        y = np.sin(TAU * f * tt(sec)) * fade(np.ones(n_(sec)), 0.004, 0.03)
        i = n_(k * every); out[i:i + len(y)] += y
    return verb(pan(out * g, 0.1), room(rng, 1.2, damp=4000), 0.3)


def ratchet(rng):
    out = np.zeros(n_(1.4)); s, gap = 0.0, 0.11
    while s < 0.75 and gap > 0.02:                            # the gaps shrink: stop before they sum short of 0.75
        c = X.tick(rng, 2600 + rng.uniform(-300, 300), 0.06) * 0.6
        i = n_(s); out[i:i + len(c)] += c[:len(out) - i]
        s += gap; gap *= 0.84
    c = mono(X.clang(rng, 0.5)) * 0.7
    i = n_(0.78); out[i:i + len(c)] += c[:len(out) - i]
    return verb(pan(out, 0), room(rng, 1.4, damp=4000), 0.3)


def grind_stop(rng):
    sec = 1.0
    t = tt(sec)
    y = lp(X.scrape(rng, 0.7), 500) * 1.2
    y = np.concatenate([y, np.zeros(n_(sec - 0.7))])
    s = mono(X.slam(rng)) * 0.9
    out = np.zeros(n_(3.0)); out[:len(y)] += y; i = n_(0.62); out[i:i + len(s)] += s[:len(out) - i]
    return pan(out, 0)


def drips(rng, dur=6.0):
    out = np.zeros(n_(dur + 1)); s = 0.2
    while s < dur:
        f = rng.uniform(900, 1700)
        sec = 0.09
        y = np.sin(sweep(sec, f, f * 1.9)) * env(sec, 0.001, 0.018) * rng.uniform(0.2, 0.5)
        i = n_(s); out[i:i + len(y)] += y[:len(out) - i]
        s += rng.exponential(0.6) + 0.15
    return verb(pan(out, rng.uniform(-0.3, 0.3)), room(rng, 2.4, damp=5000), 0.6)


def taps(rng, dur=4.6, rate=9):
    out = np.zeros(n_(dur + 1)); s = 0.1
    while s < dur - 0.6:
        y = X.tick(rng, 4200, 0.03) * 0.12
        i = n_(s); out[i:i + len(y)] += y
        s += rng.exponential(1 / rate) + 0.03
    w = X.whoosh(rng, 0.35, 900, 3500) * 0.12
    i = n_(dur - 0.45); out[i:i + len(w)] += w[:len(out) - i]
    return pan(out, 0)


def saved_tone(rng):
    out = np.zeros(n_(1.6))
    for k, f in enumerate([988, 740]):
        sec = 0.42
        y = np.sin(TAU * f * tt(sec)) * fade(np.ones(n_(sec)), 0.01, 0.2) * 0.3
        i = n_(k * 0.36); out[i:i + len(y)] += y
    return verb(pan(out, 0), room(rng, 1.4, damp=5000), 0.35)


def hatch(rng):
    a = creak(rng, 1.1, 210, 260, 0.3)
    b = mono(X.clang(rng, 0.5)) * 0.5
    out = np.zeros((2, n_(3)))
    out[:, :a.shape[1]] += a
    i = n_(1.0); m = min(len(b), out.shape[1] - i); out[:, i:i + m] += np.vstack([b, b])[:, :m]
    return out


def S(f, g=1.0):
    return lambda rng, e: f(rng) * g


ONE = {
    'run': lambda rng, e: run_(rng, 2.0),
    'stop': lambda rng, e: (pan(X.scrape_short(rng), 0) * 0.5, 2.05),
    'door_open': lambda rng, e: [(pan(X.latch(rng), 0.1) * 0.5, 0), (creak(rng), 0.25)],
    'door_shut': lambda rng, e: (pan2(X.slam(rng), 0) * 0.38, 0.1),
    'lock': lambda rng, e: (pan(X.latch(rng), 0) * 0.6, 0.8),
    'boom': lambda rng, e: (X.boom(rng) * 0.42, 0),
    'steps': lambda rng, e: walk(rng, (T[e][1] - T[e][0]) + 1.5, 0.56, 0.42),
    'glass': lambda rng, e: (squeak(rng), 0.8),
    'torch_off': lambda rng, e: (pan(X.switch(rng), 0) * 0.6, 0.6),
    'torch_on': lambda rng, e: (pan(X.switch(rng), 0) * 0.6, -0.3),
    'shuffle': lambda rng, e: (shuffle(rng, 9.0, 0.32, -0.35), 0.2),
    'shuffle_far': lambda rng, e: shuffle(rng, 2.6, 0.14, 0.5, 0.55),
    'tv': lambda rng, e: None,                                     # a bed, see below
    'button': lambda rng, e: [(pan(X.switch(rng), 0.1) * 0.7, 0.1), (beeps(rng, 1, 1320, 0.3, 0.12, 0.18), 0.35)],
    'sting': lambda rng, e: (X.sting(rng) * 0.32, 0),
    'alarm': lambda rng, e: (beeps(rng, 3, 760, 0.42, 0.22, 0.17), 0),
    'lever': lambda rng, e: (ratchet(rng) * 0.55, 0.1),
    'door_stop': lambda rng, e: (grind_stop(rng) * 0.5, -0.1),
    'clunk': lambda rng, e: [(pan(X.clunk(rng), 0) * 0.7, 0.2), (pan2(X.thud(rng), 0) * 0.6, 0.25)],
    'saved': lambda rng, e: (saved_tone(rng) * 0.6, 0.15),
    'drips': lambda rng, e: drips(rng, 9.0),
    'hatch': lambda rng, e: (hatch(rng), 0.9),
    'typing': lambda rng, e: (taps(rng, T[e][1] - T[e][0]), 0),
    'click_off': lambda rng, e: (pan(X.switch(rng), 0.25) * 0.6, 1.0),
}
mark('one-shots defined'); fxb = np.zeros((2, N))
for name, t0, ev in sfx_at:
    mark(f'sfx {name} {ev}')
    r = ONE[name](rng_for(name + ev), ev)
    if r is None: continue
    for y, off in (r if isinstance(r, list) else [r if isinstance(r, tuple) else (r, 0)]):
        put(fxb, y, max(0, t0 + off))
# the run in the hook ends in a stop, the breath goes on under the first lines
mark('heartbeat'); hb0, hb1 = T['B07'][0], T['L26'][0]
put(fxb, np.atleast_2d(X.heartbeat(rng_for('hb'), hb1 - hb0, 76, 104)) * 0.3, hb0)
# heavy lab door closing behind the airlock at «КАРАНТИН СОХРАНЁН»
put(fxb, X.thud(rng_for('end')) * 0.25, T['B17'][0])


# —— beds ——
def bed_mask(spans, fi=1.5, fo=1.5, hard_out=False):
    m = np.zeros(N)
    for a, b in spans:
        i, j = n_(a), min(N, n_(b))
        m[i:j] = 1
        k = min(n_(fi), j - i); m[i:i + k] *= np.linspace(0, 1, k)
        k = n_(0.03 if hard_out else fo); k = min(k, j - i); m[j - k:j] *= np.linspace(1, 0, k)
    return m


def vent(rng, sec):
    t = tt(sec)
    out = []
    for c in range(2):
        a = lp(colored(rng, sec, -6), 380) * 1.0 + bp(colored(rng, sec, -3), 250, 1300) * 0.22
        blade = bp(white(rng, sec), 700, 2200) * (0.5 + 0.5 * np.sin(TAU * 7.3 * t + c)) * 0.05
        lfo = 1 + 0.18 * np.sin(TAU * 0.07 * t + c * 1.3)
        out.append((a + blade) * lfo)
    hum = sum(np.sin(TAU * 50 * h * t + h) / h ** 1.3 for h in (1, 2, 3, 4)) * 0.12
    y = np.stack(out) + hum
    return y / np.std(y)


def drone(rng, sec):
    t = tt(sec)
    y = (np.sin(TAU * 55 * t) + 0.6 * np.sin(TAU * 82.6 * t + 1) + 0.45 * np.sin(TAU * 110.7 * t) + 0.2 * X.harm(TAU * 55.3 * t, 8, 1.4))
    y *= 1 + 0.25 * np.sin(TAU * 0.11 * t)
    y = lp(y, 600)
    st = np.stack([y, np.roll(y, n_(0.013))])
    return st / np.std(st)


def pulse(rng, sec):
    out = np.zeros(n_(sec + 3)); s, k = 0.0, 0
    while s < sec:
        e = s / sec
        hit = partials(1.2, [182, 463, 731, 1102, 1617], [0.6, 0.35, 0.22, 0.14, 0.09], [0.6, 0.5, 0.35, 0.25, 0.12], rng, 0.004)
        hit += X.thump(rng, 1.2, 46, 300, 0.14) * 0.9
        i = n_(s); out[i:i + len(hit)] += hit * (0.6 + 0.4 * e)
        s += 1.0 - 0.42 * e                                      # 60 → 100 a minute as the count runs out
        k += 1
    y = verb(pan(out, 0), room(rng, 1.8, damp=3500), 0.35)
    return y / (np.max(np.abs(y)) + 1e-9)


def siren(rng, sec):
    t = tt(sec)
    f = np.where((t % 1.6) < 0.8, 620, 780)
    ph = TAU * np.cumsum(f) / SR
    y = X.harm(ph, 6, 1.2)
    y = verb(pan(lp(y, 2500), -0.2), room(rng, 2.6, damp=2500), 0.7, 0.3)
    return y / (np.max(np.abs(y)) + 1e-9)


def rain(rng, sec):
    t = tt(sec)
    out = []
    for c in range(2):
        a = lp(hp(colored(rng, sec, -1.5), 300), 7000) * (1 + 0.15 * lp(rng.standard_normal(len(t)), 1))
        drops = np.zeros(len(t))
        idx = rng.choice(len(t), int(sec * 70), replace=False)
        drops[idx] = rng.uniform(0.3, 1.0, len(idx)) * rng.choice([-1, 1], len(idx))
        drops = bp(drops, 1800, 7000) * 3
        out.append(a + drops)
    y = np.stack(out)
    return y / np.std(y)


mark('one-shots placed'); amb = np.zeros((2, N))
rng = rng_for('beds')
inside = [(0, tl['rain'][0][0] + 1.0), (tl['rain'][0][1] - 0.3, DUR + 3)] if tl['rain'] else [(0, DUR + 3)]
vm = bed_mask(inside, 2.0, 2.5)
# state 2 (the lie is out): the room gets thinner, the hum drops
vg = np.full(N, db(-30.0))
lie0, cnt0 = T['L36'][0], tl['pulse'][0][0]
vg[n_(lie0):n_(cnt0)] = db(-37)
vg = signal.sosfiltfilt(signal.butter(1, 1.5, fs=SR, output='sos'), vg)
mark('masks'); amb += vent(rng, N / SR) * vm * vg
mark('vent')
dm = bed_mask(tl['drone'], 8.0, 0, hard_out=True)
amb += drone(rng, N / SR) * dm * db(-31)
mark('drone')
for a, b in tl['pulse']:
    p = pulse(rng, b - a)
    put(amb, p[:, :n_(b - a + 0.4)] * fade(np.ones(n_(b - a + 0.4)), 0.01, 0.4), a, db(-14))
    put(amb, siren(rng, b - a)[:, :n_(b - a)] * fade(np.ones(n_(b - a)), 0.5, 0.25), a, db(-27))
for a, b in tl['rain']:
    put(amb, rain(rng, b - a + 2) * bed_mask([(0, b - a + 0.3)], 2.5, 0.6)[:n_(b - a + 2)], a - 0.3, db(-27.5))
mark('pulse, rain'); tv0, tv1 = T['L28'][0], T['L37'][1]
put(amb, tv(rng, tv1 - tv0)[:, :n_(tv1 - tv0)] * bed_mask([(0, tv1 - tv0)], 1.5, 2.0)[:n_(tv1 - tv0)], tv0, db(-34))
# the intercom by the hatch hums while it plays his voice
i0, i1 = T['L67'][0] - 0.4, T['L69'][0] + 1.0
hum = sum(np.sin(TAU * 100 * h * tt(i1 - i0)) / h for h in (1, 2, 3)) * fade(np.ones(n_(i1 - i0)), 0.05, 0.02)
put(amb, pan(hum, 0.25), i0, db(-44))

# —— the score: a quiet tense bed under everything (the owner, 23.11: «добавить эмбиента, чуть-чуть музыки напрягающей») ——
# a D-minor drone pad (D2 A2 D3) with an E-flat that rubs against it when things go wrong, and sparse glassy notes.
# It follows the story: it breathes in the hook, thins out with hope, tightens through the glass and the stairs,
# cuts off dead with the drone when the lie shows, drives the countdown, lets go at «КАРАНТИН СОХРАНЁН», turns sad in
# the rain, and swells under the last line until the black.
def score(rng):
    sr2 = 12000
    n2 = int(N / SR * sr2) + 1
    t2 = np.arange(n2) / sr2
    K = [  # (time, level, tension, brightness)
        (0.0, 0.0, 0.0, 0.2), (1.2, 0.55, 0.2, 0.3), (T['B03'][0], 0.85, 0.5, 0.6), (T['B03'][1], 0.5, 0.3, 0.3),
        (T['L04'][0], 0.35, 0.0, 0.2), (T['L12'][1], 0.35, 0.0, 0.2),
        (T['B04'][0], 0.55, 0.5, 0.35), (T['L18'][0], 0.6, 0.7, 0.4),
        (T['L20'][0], 0.75, 0.85, 0.5), (T['L22'][0], 0.6, 1.0, 0.3), (T['L26'][0], 0.45, 0.3, 0.3),
        (T['L29'][0], 0.6, 0.6, 0.4), (T['L33'][0], 0.8, 1.0, 0.55), (T['L36'][0] - 0.01, 0.8, 1.0, 0.55),
        (T['L36'][0], 0.0, 0.0, 0.2), (T['B15'][0] - 0.01, 0.0, 0.0, 0.2),
        (T['B15'][0], 0.8, 1.0, 0.5), (T['L59'][0], 1.0, 1.0, 1.0), (T['B17'][0], 1.0, 1.0, 1.0),
        (T['B17'][0] + 3.0, 0.35, 0.0, 0.25), (T['B18'][0], 0.4, 0.0, 0.25), (T['L66'][1], 0.4, 0.0, 0.25),
        (T['L67'][0], 0.6, 0.8, 0.4), (T['L70'][1], 0.9, 1.0, 0.6), (T['B22'][0], 0.0, 0.0, 0.2), (N / SR, 0.0, 0.0, 0.2)]
    kt = np.array([k[0] for k in K])
    lev, ten, bri = (np.interp(t2, kt, [k[i] for k in K]) for i in (1, 2, 3))

    def pad(freqs, seed):
        r = np.random.default_rng(seed)
        y = np.zeros(n2)
        for f in freqs:
            for det in (-0.0018, 0.0016):
                for h in range(1, 8):
                    y += np.sin(TAU * f * h * (1 + det) * t2 + r.uniform(0, TAU)) / h ** 1.25
        return y

    def lp2(x, f):
        return signal.sosfilt(signal.butter(2, f, 'lowpass', fs=sr2, output='sos'), x)

    out = []
    for c in range(2):
        base = pad([73.42, 110.0, 146.83], 11 + c)
        rub = pad([155.56], 21 + c) * 0.8 + pad([233.08], 31 + c) * 0.35       # E-flat 3 and B-flat 3 against the D
        mix_ = base * (1 - 0.35 * ten) + rub * ten
        dark, bright = lp2(mix_, 380), lp2(mix_, 1500)
        y = dark * (1 - bri) + bright * bri
        y *= 1 + 0.2 * np.sin(TAU * 0.06 * t2 + c * 1.7)                       # it breathes
        out.append(y * lev)
    y = np.stack(out)
    y = signal.resample_poly(y, SR // 1000, sr2 // 1000, axis=1)[:, :N]
    y = hp(y, 60)
    y = y / (np.sqrt(np.mean(y[:, np.abs(y[0]) > 1e-4] ** 2)) + 1e-9)
    # glass: sparse high notes where it is tense
    glass = np.zeros(N)
    tt_ = 2.0
    while tt_ < N / SR - 4:
        i2 = min(n2 - 1, int(tt_ * sr2))
        if ten[i2] > 0.45 and lev[i2] > 0.3:
            f = rng.choice([587.33, 622.25, 880.0, 698.46, 932.33])
            sec = 3.0
            k = tt(sec)
            ping = (np.sin(TAU * f * k) + 0.25 * np.sin(TAU * f * 2.76 * k)) * np.exp(-k / 1.1) * fade(np.ones(n_(sec)), 0.02, 0.3)
            a_ = n_(tt_)
            glass[a_:a_ + len(ping)] += ping[:max(0, N - a_)] * 0.5 * lev[i2]
        tt_ += rng.uniform(5.0, 9.0)
    y = y + pan(glass, rng.uniform(-0.3, 0.3)) * 2.0
    return verb(y, room(rng, 3.2, damp=3000), 0.35)[:, :N]


mark('score')
amb += score(rng_for('score')) * db(-33)
mark('score done')

# the beds duck under the words (not under the mimic's words: those should sit inside the room)
ve = np.abs(voice).max(0)
ve = signal.sosfiltfilt(signal.butter(1, 2.0, fs=SR, output='sos'), (ve > db(-40)).astype(float))
amb *= 1 - 0.38 * np.clip(ve, 0, 1)
mark('ducking'); end = n_(DUR + 0.5)
for name, buf in [('voice', voice), ('fx', fxb), ('amb', amb)]:
    sf.write(os.path.join(BUILD, f'{name}.wav'), buf[:, :end].T.astype(np.float32), SR)
mix = voice + fxb + amb
mix = mix[:, :end]
mix[:, -n_(2.5):] *= np.linspace(1, 0, n_(2.5)) ** 2      # the end card fades to silence
sf.write(os.path.join(BUILD, 'mix_raw.wav'), mix.T.astype(np.float32), SR)
# loudness for YouTube: two-pass loudnorm to -14 LUFS, true peak -1.5 dB
m = subprocess.run(['ffmpeg', '-hide_banner', '-i', os.path.join(BUILD, 'mix_raw.wav'), '-af', 'loudnorm=I=-14:TP=-1.5:LRA=14:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
af = (f"loudnorm=I=-14:TP=-1.5:LRA=14:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(BUILD, 'mix_raw.wav'), '-af', af, '-ar', str(SR), os.path.join(BUILD, 'mix.wav')], check=True)
print('mix: input', j['input_i'], 'LUFS, LRA', j['input_lra'])
