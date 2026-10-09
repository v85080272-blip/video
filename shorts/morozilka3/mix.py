# Звук «Морозилки»: бормотание по слогам, музыка, шумы. Всё синтезом, по story.json.
import json, os, sys
import numpy as np
LIB = os.environ.get('LIB', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
sys.path.insert(0, os.path.join(LIB, 'core', 'audio'))
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, click, clack, whoosh, creak, thump, ding, pop, compress, limit, add
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ST = json.load(open(os.path.join(HERE, 'story.json')))
DUR, EV, SH = ST['dur'], ST['ev'], ST['shots']
N = int(DUR * SR) + SR
voice = np.zeros((N, 2)); music = np.zeros((N, 2)); fx = np.zeros((N, 2)); amb = np.zeros((N, 2))
rng = np.random.default_rng(11)
midi = lambda m: 440 * 2 ** ((m - 69) / 12)

# ——— бормотание ———
FORM = {'а': (800, 1250), 'я': (780, 1300), 'о': (520, 900), 'ё': (520, 1000), 'у': (350, 800), 'ю': (350, 1100),
        'э': (550, 1800), 'е': (480, 1950), 'и': (300, 2300), 'ы': (380, 1600)}
def syll(f0, vow, d, loud=1.0, rise=0.0):
    tt = t_(d); f = f0 * (1 + rise * tt / d) * (1 + .02 * np.sin(2 * np.pi * 6 * tt))
    ph = np.cumsum(f) / SR
    src = sum(np.sin(2 * np.pi * k * ph) / k for k in range(1, 18))
    f1, f2 = FORM.get(vow, (600, 1400))
    y = bp(src, f1 * .8, f1 * 1.25) * 1.0 + bp(src, f2 * .85, f2 * 1.15) * .6 + lp(src, 400) * .25
    e = np.minimum(1, tt / .012) * np.minimum(1, (d - tt) / .03).clip(0, 1)
    cons = hp(noise(min(d, .03)), 2500) * env_exp(min(d, .03), .008) * .25
    y = y * e; y[:len(cons)] += cons
    return norm(y) * loud
def line(L):
    vows = [c for c in L['text'].lower() if c in FORM] or ['а'] * L.get('n', 6)
    n = L.get('n') or max(3, len(vows))
    for who, base, pan in (('P', 118, -.25), ('S', 235, .25), ('B', 300, 0)):
        if who not in L['who']: continue
        for i in range(n):
            t0 = L['t0'] + i * L['sd']
            if L['id'] == 'scream':
                f0 = base * (2.0 if who == 'P' else 1.55) * (1 + .06 * np.sin(i * 1.7))
                x = syll(f0, 'а', L['sd'] * 1.05, 1.0, rise=.15)
                x = np.tanh(x * 2.5) * .7
            else:
                h = (np.sin(i * 2.3 + L['t0']) + 1) / 2
                f0 = base * (1 + .18 * h) * (1.12 if L['text'].strip().endswith('?') and i >= n - 2 else 1)
                x = syll(f0, vows[i % len(vows)], L['sd'] * .92, .6 + .4 * h)
            add(voice, x, t0, .9, pan)
PAN = {'P': -.25, 'S': .25, 'B': 0}
for L in ST['lines']:
    if L.get('tts'):   # настоящий голос (RHVoice, см. tts.py)
        x, _ = sf.read(os.path.join(HERE, L['tts'])); add(voice, x / (abs(x).max() + 1e-9), L['t0'], 1.5, PAN[L['who']])
    else: line(L)

# ——— музыка ———
def pluck(f, d=.45, bright=1.0):
    tt = t_(d); y = sum(np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (6 + k * 4 / bright)) / k for k in range(1, 7))
    return norm(y) * np.minimum(1, tt / .004)
def brass(fs, d, decay=1.2):
    tt = t_(d); y = 0
    for f in fs:
        ph = f * tt * (1 + .003 * np.sin(2 * np.pi * 5 * tt))
        y = y + 2 * (ph % 1) - 1
    y = lp(y, 1600) * np.minimum(1, tt / .03) * np.exp(-tt * decay)
    return norm(y)
def bone(f, d, bend=0.0):
    tt = t_(d); ff = f * (1 + bend * tt / d) * (1 + .025 * np.sin(2 * np.pi * 5.5 * tt * (tt > d * .5)))
    ph = np.cumsum(ff) / SR; y = 2 * (ph % 1) - 1
    wah = lp(y, 900) * (.6 + .4 * np.sin(np.pi * tt / d))
    return norm(wah) * np.minimum(1, tt / .04) * np.minimum(1, (d - tt) / .08).clip(0, 1)
def kick(): tt = t_(.25); return norm(np.sin(2 * np.pi * np.cumsum(50 + 120 * np.exp(-tt * 30)) / SR) * env_exp(.25, .08))
def snare(): return norm(bp(noise(.15), 1200, 6000) * env_exp(.15, .04) + np.sin(2 * np.pi * 190 * t_(.15)) * env_exp(.15, .03) * .5)
# A: сирена (двухтональная) + бодрый бит 140 bpm до конца плана
tt = t_(SH['B']); f = np.where((tt * 3) % 1 < .5, 880, 660)
add(music, norm(lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)), 2500)) * np.minimum(1, (SH['B'] - tt) / .3), 0, .22, .2)
bt = 60 / 140; t = 0.0; i = 0
while t < EV['lid'] - .1:
    if i % 4 in (0, 2) and t > .05: add(music, kick(), t, .7)
    if i % 4 == 2: add(music, snare(), t, .35, .1)
    add(music, hp(noise(.03), 7000) * env_exp(.03, .008), t + bt / 2, .12, .3)
    if t >= SH['B']:   # хитрое пиццикато «план»
        pat = [57, 60, 64, 60, 59, 62, 65, 62]
        add(music, pluck(midi(pat[i % 8]), .3, 1.4), t, .4, -.15); add(music, pluck(midi(pat[(i + 2) % 8] + 12), .25, 2), t + bt / 2, .22, .15)
    t += bt; i += 1
# D: крышка — аккорд, барабанная дробь до прыжка, героический брасс на прыжке
add(music, brass([midi(38), midi(41), midi(45), midi(50)], 1.4), EV['sting'], .6)
k = 0; t = EV['crouch']
while t < EV['jump']:
    add(music, snare(), t, .15 + .3 * (t - EV['crouch']) / (EV['jump'] - EV['crouch']), (rng.random() - .5) * .3); t += .055
add(music, brass([midi(48), midi(52), midi(55), midi(60)], 1.6, .7), EV['jump'], .8)
add(music, brass([midi(53), midi(57), midi(60), midi(65)], 1.0, 1.0), EV['jump'] + .45, .6)
# F: истеричный стингер, G: тёплое «с возвращением» (вальсок)
add(music, brass([midi(37), midi(43), midi(49)], .8), EV['slam2'] + .1, .5)
g0 = SH['G']
for k, m in enumerate([60, 64, 67, 72, 67, 64]): add(music, pluck(midi(m), .5, 1.2), g0 + .25 + k * .38, .35, (k % 2 - .5) * .3)
# K: джингл
g0 = SH['K']; bt = 60 / 132
for k, m in enumerate([72, 76, 79, 84]): add(music, pluck(midi(m), .5, 2), g0 + k * bt / 2, .5, (k - 1.5) * .2)
for k in range(6):
    tb = g0 + 2 * bt + k * bt
    for m in ([60, 64, 67] if k % 2 == 0 else [62, 65, 69]): add(music, pluck(midi(m), .35, 1.5), tb, .28)
    add(music, pluck(midi(36 if k % 2 == 0 else 38), .5), tb, .5)
    add(music, bp(noise(.08), 900, 3000) * env_exp(.08, .02), tb + bt / 2, .3, .2)

# ——— шумы ———
hum = lp(brown(DUR + .5), 260) * .5 + np.sin(2 * np.pi * 55 * t_(DUR + .5)) * .08
tt = t_(DUR + .5); g = np.ones_like(tt); g[tt >= SH['K']] = 0
add(amb, hum * g, 0, .2)
add(fx, whoosh(.4, 1.3), 0, .3)
add(fx, creak(1), EV['lid'] - .1, .45); add(fx, whoosh(.5, 1), EV['lid'], .4); add(fx, ding(.6), EV['lid'] + .1, .2)
add(fx, whoosh(.45, 1), EV['reach'] - .5, .4)
tq = t_(.4); add(fx, norm(np.sin(2 * np.pi * np.cumsum(300 + 900 * tq / .4) / SR) * env_exp(.4, .25)), EV['jump'], .45)   # «вжух» вверх
add(fx, thump(.7, 120), EV['catch'], .5)
for k in range(10): add(fx, bp(noise(.03), 1500, 5000) * env_exp(.03, .01), EV['catch'] + k * .03, .3, 0)
add(fx, whoosh(.45, 1), EV['lift'], .55)
add(fx, thump(1, 60), EV['slam'], 1.0); add(fx, clack(.8, 1), EV['slam'], .5)
# сковородка за кадром: шипение с треском
d = EV['lid2'] - EV['sizzle'] + .2; sz = hp(noise(d), 3000) * np.minimum(1, t_(d) / .1) * np.minimum(1, (d - t_(d)) / .3).clip(0, 1)
add(fx, norm(sz), EV['sizzle'], .6, -.1)
for k in range(25): add(fx, click(2.5 + rng.random(), .6), EV['sizzle'] + rng.random() * d, .25, rng.random() - .5)
add(fx, creak(1), EV['lid2'] - .1, .45); add(fx, whoosh(.5, 1), EV['lid2'], .4)
tq = t_(.3); add(fx, norm(np.sin(2 * np.pi * np.cumsum(900 - 500 * tq / .3) / SR) * env_exp(.3, .2)), EV['drop'], .3)
add(fx, thump(.8, 110), EV['land'], .8); add(fx, pop(.9), EV['land'] + .02, .35)
add(fx, norm(hp(noise(1.5), 4000) * env_exp(1.5, .6)), EV['land'], .12, .2)   # остывающее шипение
add(fx, thump(1, 60), EV['slam2'], .9); add(fx, clack(.8, 1), EV['slam2'], .45)
tq = t_(.6); add(fx, norm(sum(np.sin(2 * np.pi * (2000 + 1500 * k) * tq * (1 + tq)) for k in range(3)) * env_exp(.6, .25)), EV['frostwipe'], .2)
g0 = SH['K']
for k, at in enumerate([g0 + .35, g0 + .55]): add(fx, pop(1), at, .45, -.3 + .6 * k)
add(fx, thump(.6, 90), g0, .5)

# ——— сведение ———
v = compress(voice.mean(1), .22, 3.5)
voice = np.stack([v * (np.abs(voice[:, 0]) + 1e-9) / (np.abs(voice.mean(1)) + 1e-9) * 0 + v, v], 1) * .5 + voice * .5
vel = np.convolve(np.abs(voice.mean(1)), np.ones(2400) / 2400, 'same')
duck = 1 - .8 * np.clip(vel / (vel.max() + 1e-9) * 4, 0, 1)
mix = voice * 1.0 + music * duck[:, None] * .7 + fx * .9 + amb
mix = mix[:int(DUR * SR)]
mix = np.stack([limit(mix[:, 0]), limit(mix[:, 1])], 1)
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix ok', mix.shape[0] / SR)
