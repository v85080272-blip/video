# Звук «Кота и огурца»: голоса RHVoice + музыка и шумы синтезом, всё по story.json.
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ST = json.load(open(os.path.join(HERE, 'story.json')))
SR = 48000; DUR, EV, SH = ST['dur'], ST['ev'], ST['shots']
N = int(DUR * SR) + SR
rng = np.random.default_rng(5)
bus = {k: np.zeros((N, 2)) for k in ('voice', 'music', 'fx')}
def t_(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def filt(x, kind, f): return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)
lp = lambda x, f: filt(x, 'lowpass', f); hp = lambda x, f: filt(x, 'highpass', f); bp = lambda x, a, b: filt(x, 'bandpass', [a, b])
def norm(x): return x / (np.abs(x).max() + 1e-9)
def env(d, a=.005, r=.1): tt = t_(d); return np.minimum(1, tt / a) * np.exp(-tt / r)
def add(b, x, t0, g=1., pan=0.):
    i = int(t0 * SR); x = x[:max(0, N - i)]
    if i < 0 or len(x) == 0: return
    if x.ndim == 1: x = np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], 1) * 1.414
    bus[b][i:i + len(x)] += x * g
midi = lambda m: 440 * 2 ** ((m - 69) / 12)

# ——— инструменты ———
def pizz(f, d=.3): tt = t_(d); return norm(sum(np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (12 + 6 * k)) / k for k in range(1, 6))) * np.minimum(1, tt / .003)
def mar(f, d=.5): tt = t_(d); return (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + .35 * np.sin(2 * np.pi * f * 3.9 * tt) * np.exp(-tt * 30)) * np.minimum(1, tt / .002)
def saw(f, d, cut=900, a=.05, r=.2):
    tt = t_(d); ph = np.cumsum(f * (1 + .004 * np.sin(2 * np.pi * 5 * tt))) / SR
    return norm(lp(2 * (ph % 1) - 1, cut)) * np.minimum(1, tt / a) * np.minimum(1, (d - tt) / r).clip(0, 1)
def violin(f, d): tt = t_(d); vib = 1 + .008 * np.sin(2 * np.pi * 5.5 * tt) * np.minimum(1, tt / .3); ph = np.cumsum(f * vib) / SR; y = sum(np.sin(2 * np.pi * k * ph) / k ** 1.3 for k in range(1, 8)); return norm(lp(y, 3500)) * np.minimum(1, tt / .15) * np.minimum(1, (d - tt) / .2).clip(0, 1)
def kick(): tt = t_(.25); return np.sin(2 * np.pi * np.cumsum(45 + 120 * np.exp(-tt * 30)) / SR) * env(.25, .002, .09)
def snare(): return norm(bp(noise(.14), 1500, 7000) * env(.14, .001, .04) + np.sin(2 * np.pi * 190 * t_(.14)) * env(.14, .001, .03) * .4)
def cym(d=1.6): return norm(hp(noise(d), 5000)) * env(d, .002, .45)
def boom(): tt = t_(1.2); return norm(np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 6)) / SR) + .3 * lp(noise(1.2), 200)) * env(1.2, .003, .35)
def stab(ms, d=1.0): return norm(sum(saw(midi(m), d, 2400, .01, .4) for m in ms)) * np.exp(-t_(d) * 2.2)
def whoosh(d, up=True):
    tt = t_(d); x = noise(d); y = np.zeros_like(x)
    for a in range(0, len(x), 2400):
        b = min(len(x), a + 2400); f = 300 + 3000 * (tt[a] / d if up else 1 - tt[a] / d); y[a:b] = bp(x[a:b], max(80, f * .6), min(20000, f * 1.6))
    return norm(y) * np.sin(np.pi * tt / d) ** 1.5
def crunch(d=.12, n=6):
    y = np.zeros(int(d * SR))
    for k in range(n):
        a = int(rng.random() * (len(y) - 1500)); b = hp(noise(.015), 1500 + rng.random() * 2500) * env(.015, .0005, .004); y[a:a + len(b)] += b * (.4 + rng.random() * .6)
    return norm(y)
def thump(f=70, d=.35): tt = t_(d); return np.sin(2 * np.pi * np.cumsum(f + 80 * np.exp(-tt * 25)) / SR) * env(d, .002, .08)
def boing(): tt = t_(.6); return np.sin(2 * np.pi * np.cumsum(220 + 160 * np.sin(2 * np.pi * 14 * tt) * np.exp(-tt * 5)) / SR) * env(.6, .003, .25)
def pop(): tt = t_(.1); return np.sin(2 * np.pi * np.cumsum(400 + 1600 * tt / .1) / SR) * env(.1, .001, .03)
def plink(f=1800): tt = t_(.4); return np.sin(2 * np.pi * f * tt) * env(.4, .001, .08) + .3 * np.sin(2 * np.pi * f * 2.7 * tt) * env(.4, .001, .03)

# ——— A–B: крючок и крадущаяся тема ———
add('music', boom(), .05, .9); add('music', stab([45, 52, 57, 60], .8), .05, .5); add('fx', cym(1.2), .05, .25)
bt = 60 / 112; t, i = .4, 0
sneak = [57, None, 60, None, 59, 57, None, 52, 57, None, 60, 64, 63, None, 59, None]
while t < EV['stop'] - .05:
    m = sneak[i % 16]
    if m: add('music', pizz(midi(m), .25), t, .7, .15)
    if i % 2 == 0: add('music', pizz(midi(33 if (i // 8) % 2 == 0 else 31), .35), t, .55, -.15)
    if i % 4 == 2: add('music', hp(noise(.04), 6000) * env(.04, .001, .012), t, .25, .3)
    t += bt / 2; i += 1
# зловещий гул, пока выползает огурец
add('music', saw(midi(33), EV['stop'] - EV['slide'] + .1, 300, .8, .1), EV['slide'], .5)
add('music', saw(midi(39), EV['stop'] - EV['slide'] - .8, 500, 1.0, .1), EV['slide'] + .8, .25)
# хруст корма и мурчание
t = EV['munch']
while t < EV['stop'] - .1: add('fx', crunch(.1, 5), t, .35, .25); t += 1 / 3.2
pt = t_(EV['stop']); purr = lp(noise(EV['stop']), 180) * (.5 + .5 * np.sin(2 * np.pi * 24 * pt)) * np.minimum(1, pt / .3); add('fx', norm(purr), 0, .18)
add('fx', bp(noise(2.0), 300, 1200) * np.sin(np.pi * t_(2.0) / 2.0) * .5, EV['slide'] + .2, .12, -.4)   # шорох по полу
# ——— C–D: тишина, уши, сердце, разворот, удар ———
add('fx', plink(2600) * .5, EV['ears'], .25, .3); add('fx', plink(2900) * .5, EV['ears'] + .15, .2, .3)
tt = t_(.25); add('fx', np.sin(2 * np.pi * np.cumsum(900 - 400 * tt / .25) / SR) * env(.25, .01, .1), EV['eyes'], .15, -.2)   # глаза скользят
for b in ('beat1', 'beat2'): add('fx', thump(55, .4), EV[b], .9); add('fx', thump(50, .3), EV[b] + .14, .6)
add('fx', whoosh(.3), EV['turn'] - .05, .5)
add('music', boom(), EV['hit'], 1.0); add('music', stab([38, 45, 50, 53, 57], 1.0), EV['hit'], .7); add('fx', cym(1.5), EV['hit'], .35)
# ——— E: прыжок, стоп-кадр ———
add('fx', whoosh(.8), EV['jump'], .6)
for k in range(4): add('music', snare(), EV['jump'] + k * .06, .25)
fd = EV['freeze1'] - EV['freeze0']
tt = t_(fd); rum = lp(noise(fd), 120) * np.minimum(1, tt / .1) * np.minimum(1, (fd - tt) / .1).clip(0, 1); add('fx', norm(rum), EV['freeze0'], .35)
add('music', boom(), EV['freeze0'], .7)
tk = EV['freeze0'] + .05; k = 0
while tk < EV['freeze0'] + .75: add('fx', plink(1200 + k * 60) * .6, tk, .25, .2); tk += .09 - k * .004; k += 1
add('fx', mar(midi(96), .8) + mar(midi(100), .8), EV['freeze0'] + .78, .35)
add('music', stab([62, 66, 69, 74], .5), EV['freeze0'] + .9, .6); add('fx', cym(1.0), EV['freeze0'] + .9, .3)   # 9000%
tt = t_(.5); add('fx', np.sin(2 * np.pi * np.cumsum(500 + 300 * np.sin(2 * np.pi * 8 * tt)) / SR) * env(.5, .01, .2), EV['freeze0'] + .92, .3)   # клаксон
add('fx', whoosh(.8, False), EV['freeze1'], .55)
add('fx', thump(60, .5), EV['land'], 1.0); add('fx', boing(), EV['land'] + .02, .35); add('fx', crunch(.2, 10), EV['land'], .25)
# ——— G: грустная скрипка ———
add('fx', pop(), EV['eyesPop'], .5, -.2); add('fx', pop(), EV['eyesPop'] + .08, .5, .2)
for k, (m, d) in enumerate([(69, .9), (67, .45), (65, .45), (64, 1.3)]):
    add('music', violin(midi(m), d), SH['G'] + .5 + sum(x[1] for x in [(69, .9), (67, .45), (65, .45), (64, 1.3)][:k]), .38, .1)
add('music', saw(midi(41), 2.6, 600, .5, .5), SH['G'] + .5, .2); add('music', saw(midi(45), 2.6, 600, .5, .5), SH['G'] + .5, .15)
add('fx', plink(2200), EV['tear'] + 1.3, .25)
# ——— H: подозрительное «дун-дун» ———
for k, m in enumerate([40, 40, 43]): add('music', pizz(midi(m), .4), SH['H'] + .1 + k * .3, .55, -.1)
add('music', pizz(midi(46), .6), SH['H'] + 1.1, .5)
# ——— K: джингл ———
g0 = SH['K']; bt = 60 / 128
for k, m in enumerate([72, 76, 79, 84]): add('music', mar(midi(m), .5), g0 + k * .12, .45, (k - 1.5) * .25)
for k in range(4):
    tb = g0 + .55 + k * bt
    for m in ([60, 64, 67] if k % 2 == 0 else [62, 65, 69]): add('music', mar(midi(m + 12), .4), tb, .18)
    add('music', pizz(midi(48 if k % 2 == 0 else 50), .4), tb, .5); add('music', kick(), tb, .45); add('music', snare(), tb + bt / 2, .2)
add('music', mar(midi(84), 1.2) + mar(midi(88), 1.2) * .7, g0 + .55 + 4 * bt, .35)
for k, at in enumerate([g0 + .05, g0 + .3, g0 + .8]): add('fx', pop(), at, .35, -.3 + .3 * k)

# комнатный фон, чтобы не было мёртвой тишины
add('fx', norm(lp(noise(DUR), 400)) * .5, 0, .05)
tt = t_(1.4); add('fx', norm(np.sin(2 * np.pi * 60 * tt) * .3 + lp(noise(1.4), 300)) * np.sin(np.pi * tt / 1.4), EV['land'] + .4, .12)   # дрожь холодильника
# ——— голоса ———
PAN = {'C': .15, 'O': -.2}
for L in ST['lines']:
    x, _ = sf.read(os.path.join(HERE, L['tts'])); x = x / (np.abs(x).max() + 1e-9)
    if L['id'] == 'c1':   # крик уходит в замедление на стоп-кадре
        slow_from = int((EV['freeze0'] - L['t0']) * SR)
        if 0 < slow_from < len(x):
            tail = x[slow_from:]; idx = np.arange(0, len(tail) - 1, .45); slowed = np.interp(idx, np.arange(len(tail)), tail)
            slowed = lp(slowed, 2500) * np.linspace(1, .3, len(slowed)); x = np.concatenate([x[:slow_from], slowed])
    add('voice', x, L['t0'], 1.0, PAN[L['who']])

# ——— сведение ———
v = bus['voice'].mean(1)
vel = np.convolve(np.abs(v), np.ones(2400) / 2400, 'same'); duck = 1 - .6 * np.clip(vel / (vel.max() + 1e-9) * 5, 0, 1)
mix = bus['voice'] * 1.0 + bus['music'] * duck[:, None] * .55 + bus['fx'] * .75
mix = mix[:int(DUR * SR)]
mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / .25)[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * .9
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix ok', len(mix) / SR)
