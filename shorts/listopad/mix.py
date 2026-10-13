# Звук «Последнего листа»: голоса RHVoice, лесной фон, ветер, музыка и шумы. Всё синтезом, по story.json.
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ST = json.load(open(os.path.join(HERE, 'story.json')))
SR = 48000; DUR, EV, SH = ST['dur'], ST['ev'], ST['shots']
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)
bus = {k: np.zeros((N, 2)) for k in ('voice', 'music', 'fx', 'amb')}
def t_(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def filt(x, kind, f):
    sos = butter(2, f, btype=kind, fs=SR, output='sos'); return sosfilt(sos, x)
lp = lambda x, f: filt(x, 'lowpass', f); hp = lambda x, f: filt(x, 'highpass', f); bp = lambda x, a, b: filt(x, 'bandpass', [a, b])
def norm(x): return x / (np.abs(x).max() + 1e-9)
def env(d, a=.005, r=.1): tt = t_(d); return np.minimum(1, tt / a) * np.exp(-tt / r)
def add(b, x, t0, g=1., pan=0.):
    i = int(t0 * SR); x = x[:max(0, N - i)]
    if i < 0 or len(x) == 0: return
    if x.ndim == 1: x = np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], 1) * 1.414
    bus[b][i:i + len(x)] += x * g
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
seg = lambda t, a, b: np.clip((t - a) / (b - a), 0, 1)
ss = lambda k: k * k * (3 - 2 * k)

# ——— ветер (та же кривая, что в main.js) ———
T = np.arange(N) / SR
gust = np.zeros(N)
for a, b, amp in ST['wind']: gust += amp * ss(seg(T, a - .15, a + .25)) * (1 - ss(seg(T, b - .7, b)))
w = .12 + gust
wn = lp(np.cumsum(rng.standard_normal(N)) * .02, 900); wn = wn - lp(wn, 40)
whistle = bp(rng.standard_normal(N), 500, 1400) * (.3 + .7 * np.sin(T * 1.3) ** 2)
rustle = hp(rng.standard_normal(N), 3500) * (.5 + .5 * np.abs(np.sin(T * 13 + np.sin(T * 3) * 4)))
windsig = norm(wn) * (w ** 1.3) * 1.0 + norm(whistle) * gust * .35 + norm(rustle) * (.04 + gust * .5) * .45
bus['amb'][:, 0] += windsig * .55; bus['amb'][:, 1] += np.roll(windsig, 300) * .55

# птицы (кроме паузы с кузнечиками)
def chirp(f0, n=3):
    out = []
    for k in range(n):
        d = .05 + rng.random() * .05; tt = t_(d)
        f = f0 * (1 + .5 * np.sin(np.pi * tt / d)) * (1 + .2 * rng.random())
        out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / d)); out.append(np.zeros(int(.03 * SR)))
    return np.concatenate(out)
t = .8
while t < DUR:
    if not (SH['C'] - .1 < t < SH['D']): add('amb', chirp(2600 + rng.random() * 1800, rng.integers(2, 5)), t, .07 + rng.random() * .05, rng.random() * 1.6 - .8)
    t += .7 + rng.random() * 1.4
# кузнечики в неловкой паузе
for k in range(int((SH['D'] - EV['crickets']) / .55)):
    tt = t_(.22); x = np.sin(2 * np.pi * 4300 * tt) * (np.sin(2 * np.pi * 30 * tt) > 0) * np.sin(np.pi * tt / .22)
    add('amb', x, EV['crickets'] + k * .55, .12, .4)

# ——— музыка ———
def mar(f, d=.5, g=1.):   # маримба
    tt = t_(d); y = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + .35 * np.sin(2 * np.pi * f * 3.9 * tt) * np.exp(-tt * 30) + .2 * np.sin(2 * np.pi * f * 10 * tt) * np.exp(-tt * 60)
    return y * np.minimum(1, tt / .002) * g
def pizz(f, d=.3): tt = t_(d); y = sum(np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (12 + 6 * k)) / k for k in range(1, 6)); return norm(y) * np.minimum(1, tt / .003)
def tuba(f, d=.35): tt = t_(d); ph = np.cumsum(f * (1 - .03 * tt / d) * np.ones_like(tt)) / SR; y = lp(2 * (ph % 1) - 1, 700); return norm(y) * np.minimum(1, tt / .02) * np.exp(-tt * 4)
def flute(f, d): tt = t_(d); y = np.sin(2 * np.pi * f * tt * (1 + .004 * np.sin(2 * np.pi * 5.5 * tt))) + .15 * np.sin(4 * np.pi * f * tt); return y * np.minimum(1, tt / .04) * np.minimum(1, (d - tt) / .08).clip(0, 1)
def kick(): tt = t_(.2); return np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-tt * 35)) / SR) * env(.2, .002, .07)
def snare(): return norm(bp(noise(.12), 1500, 7000) * env(.12, .001, .035) + np.sin(2 * np.pi * 200 * t_(.12)) * env(.12, .001, .03) * .4)
def shaker(): return hp(noise(.05), 6000) * env(.05, .01, .015)
bt = 60 / 120
# A–B: бодрая тема (до разоблачения)
mel = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, 71]
bass = [48, 48, 53, 53, 48, 48, 55, 55]
t, i = 0.0, 0
while t < EV['reveal'] - .05:
    add('music', mar(midi(mel[i % 16]), .45), t, .32 * (1 if i % 2 == 0 else .7), .2)
    if i % 2 == 0: add('music', pizz(midi(bass[(i // 2) % 8]), .4), t, .5, -.2)
    if i % 4 == 0: add('music', kick(), t, .5)
    if i % 4 == 2: add('music', snare(), t, .22)
    add('music', shaker(), t + bt / 4, .08, .4)
    t += bt / 2; i += 1
# разоблачение: «запись остановилась» + пустота
tt = t_(.35); add('fx', norm(np.sin(2 * np.pi * np.cumsum(600 * np.exp(-tt * 9) + 60) / SR)) * env(.35, .002, .15), EV['reveal'], .35)
# D: неловкий вальсок
for k, m in enumerate([67, 71, 74, 72, 69]): add('music', mar(midi(m), .6), SH['D'] + .1 + k * .38, .25, (k % 2 - .5) * .4)
add('fx', mar(midi(96), .6) + mar(midi(100), .6) * .6, EV['blush'] + .1, .2, .3)   # «дзынь» румянца
# E: угроза — низкий остинато и нарастающая дробь до броска
t = SH['E']; k = 0
while t < EV['lunge']:
    add('music', tuba(midi([36, 37, 36, 39][k % 4]), .3), t, .5, -.1); add('music', pizz(midi([60, 61, 60, 63][k % 4]), .25), t + .12, .25, .2)
    t += .32; k += 1
t = EV['lick'] + .3
while t < EV['chomp']:
    add('music', snare(), t, .08 + .25 * (t - EV['lick']) / (EV['chomp'] - EV['lick']), (rng.random() - .5) * .4); t += .06
# F: полёт — флейта вверх
for k, m in enumerate([72, 76, 79, 84, 88, 91]): add('music', flute(midi(m), .32), EV['rip'] + .25 + k * .17, .22, .2)
for k, m in enumerate([60, 64, 67, 72]): add('music', mar(midi(m), .8), EV['rip'] + .25 + k * .17, .2, -.2)
t = EV['rip'] + 1.4; k = 0
while t < SH['G'] - .1:
    add('music', mar(midi([84, 79, 76, 79, 81, 77, 74, 77][k % 8]), .4), t, .2, .3); add('music', pizz(midi([48, 53][k // 4 % 2]), .3), t, .3, -.2); t += bt / 2; k += 1
# G: ленивая туба
t = SH['G'] + .1; k = 0
while t < SH['K'] - .1:
    add('music', tuba(midi([41, 48, 43, 48][k % 4]), .35), t, .45, -.1); add('music', mar(midi([65, 69, 67, 72][k % 4]), .35), t + bt / 2, .15, .2); t += bt; k += 1
# K: джингл
g0 = SH['K']
for k, m in enumerate([72, 76, 79, 84]): add('music', mar(midi(m), .5), g0 + k * .14, .4, (k - 1.5) * .25)
for k in range(5):
    tb = g0 + .7 + k * bt
    for m in ([60, 64, 67] if k % 2 == 0 else [62, 65, 69]): add('music', mar(midi(m + 12), .4), tb, .17)
    add('music', pizz(midi(48 if k % 2 == 0 else 50), .4), tb, .45); add('music', kick(), tb, .4); add('music', snare(), tb + bt / 2, .18)
add('music', mar(midi(84), 1.2) + mar(midi(88), 1.2) * .7 + mar(midi(91), 1.2) * .5, g0 + .7 + 5 * bt, .35)

# ——— шумы ———
def whoosh(d, up=1.):
    tt = t_(d); x = noise(d); f = 300 + 2500 * (tt / d if up > 0 else 1 - tt / d)
    y = np.zeros_like(x)
    for a in range(0, len(x), 2400): b = min(len(x), a + 2400); y[a:b] = bp(x[a:b], max(80, f[a] * .6), min(20000, f[a] * 1.6))
    return norm(y) * np.sin(np.pi * tt / d) ** 1.5
def crunch(d=.25, n=14):
    y = np.zeros(int(d * SR))
    for k in range(n):
        a = int(rng.random() * (len(y) - 2000)); b = hp(noise(.02), 1200 + rng.random() * 2500) * env(.02, .0005, .004); y[a:a + len(b)] += b * (.4 + rng.random() * .6)
    tt = t_(d); y += np.sin(2 * np.pi * 120 * tt) * env(d, .002, .03) * .8
    return norm(y)
def creak(d=.6):
    tt = t_(d); f = 90 + 30 * np.sin(tt * 7); ph = np.cumsum(f) / SR; y = ((ph % 1) < .12).astype(float); return norm(bp(y, 300, 2500)) * np.sin(np.pi * tt / d)
add('fx', creak(.8), .35, .25, .2); add('fx', creak(.6), 1.6, .2, .2); add('fx', creak(.6), EV['rip'] - .3, .3, .2)
add('fx', whoosh(1.3), EV['reveal'] + .1, .4)
tt = t_(.3); add('fx', np.sin(2 * np.pi * np.cumsum(1200 - 900 * tt / .3) / SR) * env(.3, .01, .12), EV['lick'], .2, -.1)   # слюрп
add('fx', bp(noise(.25), 2000, 6000) * env(.25, .01, .08), EV['lick'] + .05, .15, -.1)
add('fx', whoosh(.5), EV['lunge'], .5, -.2)
add('fx', whoosh(.9), EV['rip'], .55, .3)
tt = t_(.12); snap = hp(noise(.12), 1500) * env(.12, .0005, .02); add('fx', norm(snap), EV['rip'] + .02, .35, .2)   # «щёлк» черенка
add('fx', crunch(.35, 22), EV['chomp'], .8, -.1)
tt = t_(.2); add('fx', np.sin(2 * np.pi * 160 * tt) * env(.2, .002, .05), EV['chomp'], .7)   # клац
for k in range(10):   # жевание
    tc = EV['chomp'] + .6 + k * .32
    if SH['F'] < tc < SH['K'] and not any(abs(tc - L['t0'] - L['d'] / 2) < L['d'] / 2 + .15 for L in ST['lines'] if L['who'] == 'G'): add('fx', crunch(.12, 6), tc, .35, -.1)
for e in ('crunch1', 'crunch2'): add('fx', crunch(.3, 18), EV[e], .7, -.1)
for k, at in enumerate([SH['K'] + .1, SH['K'] + .3]): tt = t_(.12); add('fx', np.sin(2 * np.pi * np.cumsum(500 + 1500 * tt / .12) / SR) * env(.12, .002, .05), at, .35, -.3 + .6 * k)

# ——— голоса ———
PAN = {'L': .2, 'G': -.2}
for L in ST['lines']:
    x, _ = sf.read(os.path.join(HERE, L['tts'])); x = x / (np.abs(x).max() + 1e-9)
    if L['id'] == 'l3':   # улетает: тише и ниже к концу
        d = len(x) / SR; tt = t_(d)[:len(x)]
        idx = np.cumsum(1 - .25 * tt / d); idx = idx[idx < len(x) - 1]
        x = np.interp(idx, np.arange(len(x)), x) * (1 - .75 * (np.arange(len(idx)) / len(idx)))
    add('voice', x, L['t0'], 1.0, PAN[L['who']])

# ——— сведение ———
v = bus['voice'].mean(1)
vel = np.convolve(np.abs(v), np.ones(2400) / 2400, 'same'); duck = 1 - .65 * np.clip(vel / (vel.max() + 1e-9) * 5, 0, 1)
mix = bus['voice'] * 1.0 + bus['music'] * duck[:, None] * .55 + bus['fx'] * .8 + bus['amb'] * (.6 + .4 * duck[:, None])
mix = mix[:int(DUR * SR)]
fade = np.minimum(1, (DUR - np.arange(len(mix)) / SR) / .3)[:, None]; mix *= fade
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.3) * .9
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix ok', len(mix) / SR)
