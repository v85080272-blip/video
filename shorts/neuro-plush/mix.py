# Звук «Ты думаешь или зависла?»: голоса + тихое лоу-фай, дождь, мурчание и шумы синтезом, всё по story.json.
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ST = json.load(open(os.path.join(HERE, 'story.json')))
SR = 48000; DUR, SH = ST['dur'], ST['shots']
LN = {l['id']: l for l in ST['lines']}
L0 = lambda i: LN[i]['t0']; L1 = lambda i: LN[i]['t0'] + LN[i]['d']; LD = lambda i: LN[i]['d']
def word_at(i, k):   # начало k-го слова, как words() в ui.js
    L = LN[i]; ws = L['text'].split(' '); tot = sum(len(w) for w in ws); acc = sum(len(w) for w in ws[:k]); return L['t0'] + L['d'] * acc / tot
# те же моменты, что в main.js
EV = dict(cut1=1.1, holoOn=5.0, push=L1('p1') + .25, gaze=L1('p1') + 1.0, uiFocus=L0('n1') + LD('n1') * .3, slideUp=word_at('n1', 6) - .1,
          earsDown=L1('n1') + .15, cover=L1('n2') + .08, uncover=L1('n3') + .25, simple=word_at('n4', 1) - .15, complex=word_at('n4', 7) - .15,
          pathEnd=L0('p4') - .15, beep1=L1('p4') + .1, vacEnd=L1('p4') + .45,
          rA=L0('n5') + LD('n5') * .12, rB=L0('n5') + LD('n5') * .34, rC=L0('n5') + LD('n5') * .6,
          maxPush=SH['S8'] + .25, bigOn=L0('n6') + .4, beep2=L1('n6') + 1.05,
          clock=word_at('n7', 5) - .1, res=word_at('n7', 7) - .1, check=word_at('n7', 13) - .1, notice=L1('n7') + .65,
          touch=SH['S10'] + .15, climb=L1('p6') + .25, circle=L1('p6') + 1.35, lieDown=L1('p6') + 2.4,
          ready=L0('n8'), noticeCat=L1('n8') + .15, radLook=L1('p7') + .15, radCut=L1('p7') + .4, radBack=L1('p7') + 1.45, petStart=L1('p8') + .55)
N = int(DUR * SR) + SR
rng = np.random.default_rng(11)
bus = {k: np.zeros((N, 2)) for k in ('voice', 'music', 'fx', 'amb')}
def t_(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def filt(x, kind, f): return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)
lp = lambda x, f: filt(x, 'lowpass', f); hp = lambda x, f: filt(x, 'highpass', f); bp = lambda x, a, b: filt(x, 'bandpass', [a, b])
def norm(x): return x / (np.abs(x).max() + 1e-9)
def env(d, a=.005, r=.1): tt = t_(d); return np.minimum(1, tt / a) * np.exp(-tt / r)
def fade(x, a=.01, r=.05): tt = np.arange(len(x)) / SR; d = len(x) / SR; return x * np.minimum(1, tt / a) * np.clip((d - tt) / r, 0, 1)
def add(b, x, t0, g=1., pan=0.):
    i = int(t0 * SR)
    if i < 0: x = x[-i:]; i = 0
    x = x[:max(0, N - i)]
    if len(x) == 0: return
    if x.ndim == 1: x = np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], 1) * 1.414
    bus[b][i:i + len(x)] += x * g
midi = lambda m: 440 * 2 ** ((m - 69) / 12)

# ——— инструменты ———
def rhodes(f, d=1.6):   # электропиано: синус + колокольчик, тремоло
    tt = t_(d); y = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 1.6) + .35 * np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 3) + .18 * np.sin(2 * np.pi * f * 7.1 * tt) * np.exp(-tt * 14)
    return fade(y * (1 + .12 * np.sin(2 * np.pi * 4.5 * tt)) * np.minimum(1, tt / .004), .004, .3)
def pizz(f, d=.3): tt = t_(d); return norm(sum(np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (12 + 6 * k)) / k for k in range(1, 6))) * np.minimum(1, tt / .003)
def mar(f, d=.5): tt = t_(d); return (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + .35 * np.sin(2 * np.pi * f * 3.9 * tt) * np.exp(-tt * 30)) * np.minimum(1, tt / .002)
def bass(f, d=.5): tt = t_(d); return fade(np.tanh(2 * np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 3) * np.minimum(1, tt / .01), .01, .08)
def pad(ms, d, cut=1000, a=.6, r=.8):
    tt = t_(d); y = 0
    for m in ms:
        for det in (-.004, .004):
            ph = np.cumsum(midi(m) * (1 + det) * (1 + .002 * np.sin(2 * np.pi * .3 * tt))) / SR; y = y + 2 * (ph % 1) - 1
    return norm(lp(y, cut)) * np.minimum(1, tt / a) * np.minimum(1, (d - tt) / r).clip(0, 1)
def kick(): tt = t_(.25); return np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-tt * 30)) / SR) * env(.25, .002, .08)
def brush(): return norm(bp(noise(.18), 2000, 9000)) * env(.18, .01, .05)
def hat(): return norm(hp(noise(.05), 7000)) * env(.05, .001, .012)
def rim(): tt = t_(.06); return norm(bp(noise(.06), 1500, 4000) + np.sin(2 * np.pi * 900 * tt)) * env(.06, .001, .012)
def boom(): tt = t_(1.2); return norm(np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 6)) / SR) + .3 * lp(noise(1.2), 200)) * env(1.2, .003, .35)
def whoosh(d, up=True):
    tt = t_(d); x = noise(d); y = np.zeros_like(x)
    for a in range(0, len(x), 2400):
        b = min(len(x), a + 2400); f = 300 + 3000 * (tt[a] / d if up else 1 - tt[a] / d); y[a:b] = bp(x[a:b], max(80, f * .6), min(20000, f * 1.6))
    return norm(y) * np.sin(np.pi * tt / d) ** 1.5
def click(): return norm(hp(noise(.012), 2500)) * env(.012, .0005, .003)
def tick(f=2600): tt = t_(.03); return np.sin(2 * np.pi * f * tt) * env(.03, .0005, .006)
def plink(f=1800): tt = t_(.4); return np.sin(2 * np.pi * f * tt) * env(.4, .001, .08) + .3 * np.sin(2 * np.pi * f * 2.7 * tt) * env(.4, .001, .03)
def ding(f=1568): tt = t_(1.0); return norm(np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 4)) * env(1.0, .001, .35)
def buzz(): tt = t_(.22); return norm(lp(np.sign(np.sin(2 * np.pi * 120 * tt)), 1400)) * env(.22, .005, .09)
def beep(f=2350): tt = t_(.14); return np.sin(2 * np.pi * f * tt) * np.minimum(1, tt / .004) * np.clip((.14 - tt) / .01, 0, 1)
def boing(): tt = t_(.5); return np.sin(2 * np.pi * np.cumsum(260 + 200 * np.sin(2 * np.pi * 16 * tt) * np.exp(-tt * 6)) / SR) * env(.5, .003, .2)
def thump(f=90, d=.25): tt = t_(d); return np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-tt * 25)) / SR) * env(d, .002, .06)
def rustle(d=.4): tt = t_(d); return norm(bp(noise(d), 1800, 7000) * (.5 + .5 * np.abs(np.sin(2 * np.pi * 7 * tt)))) * np.sin(np.pi * tt / d)
def purr(d): tt = t_(d); return norm(lp(noise(d), 180) * (.5 + .5 * np.sin(2 * np.pi * 24 * tt)) * (.55 + .45 * np.sin(2 * np.pi * .75 * tt))) * np.minimum(1, tt / .4) * np.minimum(1, (d - tt) / .6).clip(0, 1)
def sigh(d=.9): tt = t_(d); return norm(bp(noise(d), 500, 2400)) * np.sin(np.pi * np.minimum(1, tt / d) ) ** 1.4 * (1 - .4 * tt / d)
def shimmer(d=.8, f0=1200):
    y = np.zeros(int(d * SR))
    for k in range(9): a = k * .06; p = plink(f0 * 2 ** (k / 7)) * .5; i = int(a * SR); y[i:i + len(p)] += p[:len(y) - i]
    return y
def glitch(d=.5):
    y = np.zeros(int(d * SR)); k = 0
    while k * .045 < d - .05: s = np.sign(np.sin(2 * np.pi * (400 + 900 * ((k * 7) % 5)) * t_(.03))) * .5; i = int(k * .045 * SR); y[i:i + len(s)] += s; k += 1
    return lp(y, 5000)
def lick(): return norm(bp(noise(.07), 900, 3500)) * env(.07, .005, .02)
def hum(d): tt = t_(d); return norm(lp(np.sign(np.sin(2 * np.pi * 95 * tt)) * .4 + bp(noise(d), 200, 1200), 1500)) * np.minimum(1, tt / .2) * np.minimum(1, (d - tt) / .2).clip(0, 1)

# ——— дождь: шум, капли по стеклу, иногда стук по подоконнику ———
d = DUR; tt = t_(d)
rain = norm(bp(noise(d), 600, 9000)) * .55 + norm(lp(noise(d), 400)) * .45
add('amb', rain, 0, .2)
add('amb', norm(bp(noise(2.2), 800, 8000)) * np.minimum(1, t_(2.2) / .1) * np.clip((2.2 - t_(2.2)) / .4, 0, 1), 0, .22)   # у окна громче
tk = .05
while tk < DUR - .2:
    add('amb', tick(1800 + rng.random() * 2600) * .6, tk, .05 + .05 * rng.random(), rng.random() * 1.6 - .8); tk += .04 + rng.random() * .12

# ——— музыка: тихое лоу-фай, 76 уд/мин, Fmaj7 Em7 Dm7 Cmaj7 ———
bt = 60 / 76
CH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
def groove(a, b, g=1., drums=True, keys=True):
    t, i = a, 0
    while t < b - .05:
        ch = CH[(i // 8) % 4]
        if i % 8 == 0: add('music', pad(ch, min(bt * 4, b - t) + .4, 900, .5, .6), t, .1 * g)
        if keys and i % 4 == 0: [add('music', rhodes(midi(m), 1.6), t + j * .012, .09 * g, (j - 1.5) * .2) for j, m in enumerate(ch)]
        if keys and i % 4 == 3: add('music', rhodes(midi(ch[2] + 12), .9), t, .06 * g, .3)
        if i % 4 == 0: add('music', bass(midi(ch[0] - 12), bt * 1.6), t, .22 * g)
        if i % 4 == 2: add('music', bass(midi(ch[0] - 5), bt * .9), t, .14 * g)
        if drums:
            if i % 4 == 0: add('music', kick(), t, .2 * g)
            if i % 4 == 2: add('music', rim(), t, .08 * g, .1)
            add('music', hat(), t + bt / 4, .035 * g, .3)
        t += bt / 2; i += 1
groove(.0, EV['cut1'] + .1, .6, drums=False)
groove(EV['cut1'], SH['S3'], .8, drums=False)
groove(SH['S3'], EV['maxPush'] - .1, .85)
groove(EV['beep2'] + 1.1, EV['notice'], .7)
groove(EV['notice'], DUR, .55, drums=False)

# ——— события ———
add('fx', sigh(), 3.0, .28, -.15)                                       # Плюш вздыхает
add('fx', rustle(.5), 2.3, .12, -.2); add('fx', rustle(.8), 4.2, .1, -.2)  # поджимает и трёт лапки
for k in range(3): add('fx', thump(140, .12), 4.95 + k * .17, .12, -.2)   # придвигается
add('fx', shimmer(.8, 1500), EV['holoOn'] - .05, .14, .1)                # голограмма загорается
for k in range(6): add('fx', tick(2000 + k * 250), EV['push'] + k * .08, .2, 0)   # ползунок вверх
add('fx', mar(midi(88), .4), EV['push'] + .5, .15)
add('fx', thump(70, .3), EV['gaze'] + .2, .08)                           # пауза ожидания
for k in range(4): add('fx', tick(2600 - k * 250), EV['uiFocus'] + k * .1, .15)   # Нейро сбрасывает уровень
for k in range(14): add('fx', plink(1400 + k * 110), EV['slideUp'] + k * .11, .07, (k % 3 - 1) * .3)   # точки вычислений
for k in range(8): add('fx', tick(2000 + k * 200), EV['slideUp'] + k * .2, .12)
add('fx', mar(midi(64), .6) * .8, EV['earsDown'], .2); add('fx', mar(midi(60), .7), EV['earsDown'] + .22, .2)   # уши вниз: «уа-уа»
add('fx', rustle(.35), EV['cover'], .16, -.1); add('fx', rustle(.5), EV['uncover'], .1, -.1)
add('fx', plink(1760), EV['simple'] + .05, .15); [add('fx', plink(1300 + k * 160), EV['complex'] + k * .07, .07, (k % 3 - 1) * .3) for k in range(9)]
# путь к батарее: перелёт камеры, гул пылесоса
add('fx', whoosh(.5), SH['S6'] - .2, .2); add('amb', hum(EV['pathEnd'] - SH['S6'] + .4), SH['S6'], .08, .3)
add('fx', whoosh(.4, False), EV['pathEnd'] - .15, .15)
for b in (EV['beep1'], EV['beep2']):
    add('fx', beep(2350), b, .3, .3); add('fx', beep(2350), b + .2, .3, .3); add('amb', hum(.6), b - .1, .12, .3)
add('fx', boing(), EV['vacEnd'] + .02, .2, -.2); add('fx', whoosh(.25), EV['vacEnd'], .12)   # вздрагивает уже на кадре с котом
for k in range(5): add('fx', lick(), EV['vacEnd'] + .65 + k * .16, .18, -.2)   # «умывается»
# карта: маршруты рисуются, крестики, галочка
for key, at, ln in (('A', EV['rA'], .8), ('B', EV['rB'], .8), ('C', EV['rC'], 1.1)):
    tt = t_(ln); add('fx', norm(np.sin(2 * np.pi * np.cumsum(500 + 700 * tt / ln) / SR)) * np.sin(np.pi * tt / ln) * .4, at, .08)
add('fx', buzz(), EV['rA'] + .8, .16); add('fx', buzz(), EV['rB'] + .8, .16); add('fx', ding(1760), EV['rC'] + 1.15, .2)
# максимум: ползунок до упора, схема раскрывается, шпионский мотив
for k in range(8): add('fx', tick(1800 + k * 220), EV['maxPush'] + k * .045, .22)
tt = t_(.7); add('fx', norm(np.sin(2 * np.pi * np.cumsum(200 + 900 * (tt / .7) ** 2) / SR)) * np.sin(np.pi * tt / .7) * .5, EV['maxPush'], .18)
add('fx', boom() * .6, EV['maxPush'] + .35, .3)
add('fx', whoosh(.6), EV['bigOn'] - .1, .2); add('fx', shimmer(1.0, 900), EV['bigOn'] + .1, .12)
s0 = EV['bigOn'] + .3; sb = 60 / 132
for k, m in enumerate([40, 40, 42, 43, 42, 40, 47, 46]):   # «дун-дун-ду-дун» в ми миноре
    add('music', bass(midi(m), sb * .9), s0 + k * sb / 2, .45); add('music', pizz(midi(m + 24), .25), s0 + k * sb / 2, .14, .3)
    if k % 2 == 0: add('music', rim(), s0 + k * sb / 2, .14, -.2)
add('music', pizz(midi(71), .6) + pizz(midi(75), .6), s0 + 8 * sb / 2, .18)
add('fx', boing(), EV['beep2'] + .15, .22, -.2)
# время, ресурсы, проверка; кот скучает
for k in range(10): add('fx', tick(3000), EV['clock'] + k * .25, .08, .2)
add('fx', hum(.8) * .5, EV['res'], .06); add('fx', ding(2093), EV['check'] + .05, .16)
add('fx', sigh(1.0), SH['S9'] + 1.2, .18, -.15)
add('fx', plink(2200), EV['notice'] + .05, .12)
# тёпленькая: касание, мерцание тепла, забирается, мурчит
add('fx', shimmer(1.2, 700), EV['touch'] + .3, .12, -.1)
for k in range(4): add('fx', thump(150, .1), EV['climb'] + k * .25, .14, -.1)
add('fx', rustle(1.0), EV['circle'], .1)
add('fx', purr(DUR - EV['lieDown'] + .3), EV['lieDown'] - .2, .55)
add('fx', glitch(.8), EV['noticeCat'] + .6, .12, .2)                   # схема замирает
add('fx', whoosh(.3), EV['radCut'] - .05, .1); add('fx', whoosh(.3, False), EV['radBack'] - .05, .1)
# финал: мягкое разрешение
for k, m in enumerate([65, 69, 72, 76]): add('music', rhodes(midi(m), 3.0), SH['END'] + k * .09, .1, (k - 1.5) * .25)
add('music', pad([53, 57, 60, 64], DUR - SH['END'] + .5, 800, .8, 1.2), SH['END'] - .3, .12)

# ——— голоса ———
PAN = {'P': -.12, 'N': .12}
for L in ST['lines']:
    if 'tts' not in L: continue
    x, _ = sf.read(os.path.join(HERE, L['tts'])); x = x if x.ndim == 1 else x.mean(1); x = x / (np.abs(x).max() + 1e-9)
    add('voice', x, L['t0'], 1.0, PAN[L['who']])

# ——— сведение ———
v = bus['voice'].mean(1)
vel = np.convolve(np.abs(v), np.ones(2400) / 2400, 'same'); duck = 1 - .5 * np.clip(vel / (vel.max() + 1e-9) * 5, 0, 1)
mix = bus['voice'] * 1.0 + bus['music'] * duck[:, None] * .42 + bus['fx'] * .7 * (.6 + .4 * duck[:, None]) + bus['amb'] * .75
mix = mix[:int(DUR * SR)]
mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / .4)[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * .9
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix ok', len(mix) / SR)
