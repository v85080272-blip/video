# Звук «Клодика и котика у озера»: голоса RHVoice + музыка, вечер у озера и шумы синтезом, всё по story.json.
import json, os
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt

HERE = os.path.dirname(os.path.abspath(__file__))
ST = json.load(open(os.path.join(HERE, 'story.json')))
SR = 48000; DUR, SH = ST['dur'], ST['shots']
LN = {l['id']: l for l in ST['lines']}
L0 = lambda i: LN[i]['t0']; L1 = lambda i: LN[i]['t0'] + LN[i]['d']
# те же моменты, что в main.js
EV = dict(pull=SH['S2'] + .1, popAt=SH['S2'] + .35, castLow=SH['S4'] + .15, catchLow=SH['S4'] + .95,
          castMed=SH['S5'] + .1, catchMed=SH['S5'] + .85, redSpike=L0('k9') + .5, raise_=L0('k9') + 1.3, checks=L0('k10') + .1,
          stand=SH['S7'] + .1, dive=L0('k12') - .15, surface=L1('k12') + .15, castPuddle=SH['S8'] + .35, palm=L0('k13'),
          punch=L0('k14') - .02, jump=L0('c7') + LN['c7']['d'] * .72, gears=L0('c8') + .9, deadpan=L0('k15') - .15)
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)
bus = {k: np.zeros((N, 2)) for k in ('voice', 'music', 'fx', 'amb')}
def t_(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def filt(x, kind, f): return sosfilt(butter(2, f, btype=kind, fs=SR, output='sos'), x)
lp = lambda x, f: filt(x, 'lowpass', f); hp = lambda x, f: filt(x, 'highpass', f); bp = lambda x, a, b: filt(x, 'bandpass', [a, b])
def norm(x): return x / (np.abs(x).max() + 1e-9)
def env(d, a=.005, r=.1): tt = t_(d); return np.minimum(1, tt / a) * np.exp(-tt / r)
def add(b, x, t0, g=1., pan=0.):
    i = int(t0 * SR)
    if i < 0: x = x[-i:]; i = 0
    x = x[:max(0, N - i)]
    if len(x) == 0: return
    if x.ndim == 1: x = np.stack([x * np.sqrt((1 - pan) / 2), x * np.sqrt((1 + pan) / 2)], 1) * 1.414
    bus[b][i:i + len(x)] += x * g
midi = lambda m: 440 * 2 ** ((m - 69) / 12)

# ——— инструменты ———
def pizz(f, d=.3): tt = t_(d); return norm(sum(np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (12 + 6 * k)) / k for k in range(1, 6))) * np.minimum(1, tt / .003)
def mar(f, d=.5): tt = t_(d); return (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + .35 * np.sin(2 * np.pi * f * 3.9 * tt) * np.exp(-tt * 30)) * np.minimum(1, tt / .002)
def kal(f, d=.9): tt = t_(d); return (np.sin(2 * np.pi * f * tt) + .25 * np.sin(2 * np.pi * f * 5.4 * tt) * np.exp(-tt * 12)) * np.exp(-tt * 3.2) * np.minimum(1, tt / .002)
def pad(ms, d, cut=1200, a=.4, r=.6):
    tt = t_(d); y = 0
    for m in ms:
        for det in (-.004, .004):
            ph = np.cumsum(midi(m) * (1 + det) * (1 + .002 * np.sin(2 * np.pi * .3 * tt))) / SR; y = y + 2 * (ph % 1) - 1
    return norm(lp(y, cut)) * np.minimum(1, tt / a) * np.minimum(1, (d - tt) / r).clip(0, 1)
def kick(): tt = t_(.25); return np.sin(2 * np.pi * np.cumsum(45 + 110 * np.exp(-tt * 30)) / SR) * env(.25, .002, .08)
def brush(): return norm(bp(noise(.18), 2000, 9000)) * env(.18, .01, .05)
def hat(): return norm(hp(noise(.05), 7000)) * env(.05, .001, .012)
def boom(): tt = t_(1.2); return norm(np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-tt * 6)) / SR) + .3 * lp(noise(1.2), 200)) * env(1.2, .003, .35)
def whoosh(d, up=True):
    tt = t_(d); x = noise(d); y = np.zeros_like(x)
    for a in range(0, len(x), 2400):
        b = min(len(x), a + 2400); f = 300 + 3000 * (tt[a] / d if up else 1 - tt[a] / d); y[a:b] = bp(x[a:b], max(80, f * .6), min(20000, f * 1.6))
    return norm(y) * np.sin(np.pi * tt / d) ** 1.5
def splash(d=.6, big=1.):
    tt = t_(d); x = bp(noise(d), 400, 6000) * np.exp(-tt * (6 / big)) * np.minimum(1, tt / .004)
    for k in range(int(10 * big)):   # капли
        a = .05 + rng.random() * d * .7; f = 900 + rng.random() * 1800; dt = t_(.05)
        drop = np.sin(2 * np.pi * np.cumsum(f + 1500 * dt / .05) / SR) * env(.05, .001, .012); i = int(a * SR); x[i:i + len(drop)] += drop * .25
    return norm(x)
def plop(): tt = t_(.18); return np.sin(2 * np.pi * np.cumsum(300 + 900 * (tt / .18)) / SR) * env(.18, .002, .05)
def thump(f=70, d=.35): tt = t_(d); return np.sin(2 * np.pi * np.cumsum(f + 80 * np.exp(-tt * 25)) / SR) * env(d, .002, .08)
def boing(): tt = t_(.6); return np.sin(2 * np.pi * np.cumsum(220 + 160 * np.sin(2 * np.pi * 14 * tt) * np.exp(-tt * 5)) / SR) * env(.6, .003, .25)
def pop(): tt = t_(.09); return np.sin(2 * np.pi * np.cumsum(500 + 1800 * tt / .09) / SR) * env(.09, .001, .025)
def plink(f=1800): tt = t_(.4); return np.sin(2 * np.pi * f * tt) * env(.4, .001, .08) + .3 * np.sin(2 * np.pi * f * 2.7 * tt) * env(.4, .001, .03)
def ding(f=1568): tt = t_(1.0); return norm(np.sin(2 * np.pi * f * tt) + .4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 4)) * env(1.0, .001, .35)
def buzz(): tt = t_(.25); return norm(lp(np.sign(np.sin(2 * np.pi * 140 * tt)), 1500)) * env(.25, .005, .1)
def click(): return norm(hp(noise(.012), 2500)) * env(.012, .0005, .003)
def reel(d):
    y = np.zeros(int(d * SR)); tk = 0.
    while tk < d - .02: c = click(); i = int(tk * SR); y[i:i + len(c)] += c[:len(y) - i]; tk += .028
    return y
def purr(d): tt = t_(d); return norm(lp(noise(d), 200) * (.55 + .45 * np.sin(2 * np.pi * 23 * tt)) * (.6 + .4 * np.sin(2 * np.pi * .9 * tt))) * np.minimum(1, tt / .2) * np.minimum(1, (d - tt) / .25).clip(0, 1)
def chirp_cricket(): tt = t_(.06); return np.sin(2 * np.pi * 4300 * tt) * (.5 + .5 * np.sin(2 * np.pi * 60 * tt)) * env(.06, .004, .03)
def frog(): tt = t_(.22); return norm(lp(np.sign(np.sin(2 * np.pi * np.cumsum(95 + 30 * np.sin(2 * np.pi * 18 * tt)) / SR)), 900)) * env(.22, .01, .08)
def tick(): tt = t_(.03); return np.sin(2 * np.pi * 2600 * tt) * env(.03, .0005, .006)
def scratch(): tt = t_(.35); return norm(bp(noise(.35), 600, 4000) * np.abs(np.sin(2 * np.pi * 5 * tt))) * np.sin(np.pi * tt / .35)

uw0, uw1 = EV['dive'] + .6, EV['surface']   # под водой

# ——— вечер у озера ———
amb_len = DUR
wv = lp(noise(amb_len), 500) * (.6 + .4 * np.sin(2 * np.pi * .23 * t_(amb_len)) * np.sin(2 * np.pi * .07 * t_(amb_len) + 1))
add('amb', norm(wv), 0, .16)
tk = .2
while tk < DUR - .3:   # сверчки пачками
    if not (uw0 < tk < uw1):
        for k in range(3): add('amb', chirp_cricket(), tk + k * .075, .05, .5 if int(tk * 3) % 2 else -.5)
    tk += .55 + rng.random() * .5
for at in [2.6, 9.4, 17.8, 24.0, 31.7, 41.0, 49.8, 55.3]: add('amb', frog(), at, .09, -.6); add('amb', frog(), at + .3, .07, -.6)

# ——— музыка: тёплое лоу-фай в до мажоре, 84 уд/мин ———
bt = 60 / 84
CH = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 55]]   # Cmaj7 Am7 Fmaj7 G
def groove(a, b, g=1., drums=True):
    t, i = a, 0
    while t < b - .05:
        ch = CH[(i // 8) % 4]
        if i % 8 == 0: add('music', pad(ch, min(bt * 8, b - t) + .3, 900, .5, .6), t, .16 * g)
        if i % 2 == 0: add('music', pizz(midi(ch[0] - 12), .5), t, .32 * g, -.1)
        arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12]
        add('music', kal(midi(arp[i % 4]), .7), t + (.03 if i % 2 else 0), .2 * g, (i % 4 - 1.5) * .2)
        if drums:
            if i % 4 == 0: add('music', kick(), t, .28 * g)
            if i % 4 == 2: add('music', brush(), t, .12 * g)
            add('music', hat(), t + bt / 4, .05 * g, .3)
        t += bt / 2; i += 1
# S1: «перемудривание» — тикающие часы и нарастающие плинки
t = .0
while t < EV['popAt']:
    add('fx', tick(), t, .18, .2); t += .25
for k in range(14): add('music', plink(900 * 2 ** (k / 12)), .15 + k * .24, .12, (k % 2 - .5) * .4)
add('music', pad([50, 53, 57, 60], EV['popAt'], 700, .3, .1), 0, .12)
t = .3
while t < EV['popAt']: add('fx', click(), t, .12, .3); add('fx', click(), t + .06, .08, .3); t += .17   # шестерёнки
# S2: щелчки ползунка, лопаются пузыри, облегчение
for k in range(4): add('fx', click(), EV['pull'] + k * .14, .35, .2)
for k in range(7): add('fx', pop(), EV['popAt'] + k * .055, .4, (k % 3 - 1) * .3)
add('fx', ding(2093), EV['popAt'] + .45, .15)
groove(EV['popAt'] + .5, SH['S3'], .8, drums=False)
# S3: подписи удочек — восходящие ноты
for i in range(5): add('music', mar(midi([72, 74, 76, 79, 84][i]), .5), SH['S3'] + .25 + i * .16, .35, (i - 2) * .2)
groove(SH['S3'], uw0 - .2)
# уровни: «левел-ап» при появлении карточки
for sh, f in [('S4', 72), ('S5', 76), ('S6', 79), ('S7', 84)]:
    add('fx', mar(midi(f), .4) + mar(midi(f + 7), .4) * .6, SH[sh] + .05, .3)
# S4: заброс, поклёвка, малёк летит
add('fx', whoosh(.35), EV['castLow'], .3, .4); add('fx', plop(), EV['castLow'] + .4, .3, .4)
add('fx', splash(.5, .6), EV['catchLow'], .35, .4); add('fx', whoosh(.45), EV['catchLow'] + .02, .4, -.1); add('fx', boing(), EV['catchLow'] + .48, .3, -.3)
# S5: заброс, катушка, окунь
add('fx', whoosh(.35), EV['castMed'], .3, .3); add('fx', plop(), EV['castMed'] + .4, .3, .3)
add('fx', reel(.45), EV['catchMed'], .3, .3); add('fx', splash(.7, 1.), EV['catchMed'], .45, .3)
# S6: красная колючка и галочки
for k in range(4): add('fx', buzz(), EV['redSpike'] + k * .4, .12, .1)
add('fx', mar(midi(79), .3), EV['raise_'], .25); add('fx', mar(midi(83), .3), EV['raise_'] + .12, .25)
for k in range(9): add('fx', plink(1500 + k * 90), EV['checks'] + k * .17, .14, (k % 3 - 1) * .3)
add('fx', ding(1760), EV['checks'] + 2.0, .3)
# S7: максимум, нырок, сундук
add('fx', boom(), SH['S7'] + .08, .55); add('fx', whoosh(.5), EV['stand'] + .3, .3); add('fx', plop(), EV['stand'] + .9, .25, .2)
add('fx', whoosh(.7, False), EV['dive'] + .1, .45); add('fx', splash(.9, 1.6), EV['dive'] + .55, .5)
d_uw = uw1 - uw0
tt = t_(d_uw); drone = norm(lp(noise(d_uw), 260) + .5 * np.sin(2 * np.pi * 55 * tt)) * np.minimum(1, tt / .2) * np.minimum(1, (d_uw - tt) / .2).clip(0, 1)
add('amb', drone, uw0, .35)
for k in range(16): add('fx', plop() * .5, uw0 + .1 + rng.random() * (d_uw - .3), .1, rng.random() - .5)   # пузыри
for k, m in enumerate([84, 88, 91, 96]): add('music', kal(midi(m), 1.4), uw0 + .2 + k * .18, .18, (k - 1.5) * .3)   # блеск сундука
add('music', pad([48, 55, 60, 64], d_uw, 600, .3, .3), uw0, .2)
add('fx', splash(.5, .7), uw1 - .05, .3)
add('fx', purr(LN['c5']['d'] + .6), L0('c5') - .2, .6)
groove(uw1 + .1, EV['punch'] - .05, .85)
# S8: заброс в лужу, ладонь, удар-зум
add('fx', whoosh(.4), EV['castPuddle'], .3, -.4); add('fx', plop() * .6, EV['castPuddle'] + .5, .35, -.4)
add('fx', thump(90, .25), EV['palm'] + .15, .5)
add('fx', whoosh(.2), EV['punch'] - .12, .4); add('fx', boom() * .6, EV['punch'], .45); add('fx', boing(), EV['punch'] + .05, .25)
groove(EV['punch'] + .2, EV['deadpan'] - .1, .8)
# S9: «Бульк», шестерёнки котика, музыка обрывается на «По умолчанию»
add('fx', splash(.5, .5), EV['jump'] + .45, .35, .2); add('fx', ding(2349), EV['jump'] + .25, .25, .2)
for k in range(3): add('fx', thump(160, .15), EV['gears'] + k * .3, .25, -.2); add('fx', click(), EV['gears'] + k * .3, .3, -.2)
t = EV['gears']
while t < EV['deadpan']: add('fx', tick(), t, .12, -.2); t += .2
add('fx', scratch(), EV['deadpan'] - .1, .25)
# финал: джингл
g0 = SH['END']; bt2 = 60 / 120
for k, m in enumerate([72, 76, 79, 84]): add('music', mar(midi(m), .5), g0 + k * .12, .45, (k - 1.5) * .25)
for k in range(5):
    tb = g0 + .55 + k * bt2; ch = CH[k % 4]
    for m in ch[1:]: add('music', mar(midi(m + 12), .4), tb, .14)
    add('music', pizz(midi(ch[0] - 12), .4), tb, .4); add('music', kick(), tb, .35); add('music', brush(), tb + bt2 / 2, .15)
for i in range(5): add('fx', pop(), g0 + .6 + i * .12, .25, (i - 2) * .25)

# ——— голоса ———
PAN = {'C': -.15, 'K': .15}
for L in ST['lines']:
    if 'tts' not in L: continue
    x, _ = sf.read(os.path.join(HERE, L['tts'])); x = x / (np.abs(x).max() + 1e-9)
    if uw0 < L['t0'] < uw1: x = lp(x, 2500) * 1.1   # под водой голос чуть глуше
    add('voice', x, L['t0'], 1.0, PAN[L['who']])

# ——— сведение ———
v = bus['voice'].mean(1)
vel = np.convolve(np.abs(v), np.ones(2400) / 2400, 'same'); duck = 1 - .55 * np.clip(vel / (vel.max() + 1e-9) * 5, 0, 1)
mus = bus['music'].copy()
i0, i1 = int(uw0 * SR), int(uw1 * SR); mus[i0:i1] = np.stack([lp(mus[i0:i1, c], 700) for c in range(2)], 1)   # под водой всё глухо
mix = bus['voice'] * 1.0 + mus * duck[:, None] * .5 + bus['fx'] * .7 + bus['amb'] * .8
mix = mix[:int(DUR * SR)]
mix *= np.minimum(1, (DUR - np.arange(len(mix)) / SR) / .3)[:, None]
mix = np.tanh(mix / (np.abs(mix).max() + 1e-9) * 1.4) * .9
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR, subtype='PCM_24')
print('mix ok', len(mix) / SR)
