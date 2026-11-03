# Effects of «Погас свет, ты на 20-м этаже», synthesised like sfx.py (noise through filters, damped partials, glides; no samples).
# FX[name](rng, **cue) returns a mono or stereo float array at 48 kHz; names match cues() in src/main.js.
import numpy as np
from sfx import (SR, TAU, n_, tt, lp, hp, bp, peak, white, colored, env, fade, norm, partials, sweep, harm, svf_bp, room, verb,
                 thump, groan, whoosh, whoosh_in, pop, water, tick, sputter, zap, blip, click, toggle, power_down)


def add(y, s, c):
    i = n_(s)
    if i < len(y):
        y[i:i + len(c)] += c[:len(y) - i]


def mains(t, f=50, n=7, tilt=1.2):
    """the electric hum of a lit building: 50 Hz and its harmonics"""
    return sum(np.sin(TAU * f * h * t + h) / h ** tilt for h in range(1, n + 1))


# ——— the city goes dark ———
def city(rng, dur=4.0, **_):
    """an ordinary evening: far traffic, a light wind, the hum of a lit building; nothing alarming"""
    t = tt(dur)
    traffic = lp(colored(rng, dur, -4), 500) * (0.6 + 0.4 * np.sin(TAU * 0.07 * t + 1)) * 0.5
    wind = bp(colored(rng, dur, -1), 500, 1800) * (0.5 + 0.3 * np.sin(TAU * 0.13 * t)) * 0.2
    y = traffic + wind + 0.07 * mains(t)
    s = 0.6
    while s < dur - 1.2:                                             # a car passing far below
        d = rng.uniform(1.4, 2.2)
        c = bp(colored(rng, d, -2), 250, 1500) * np.sin(np.pi * tt(d) / d) ** 2 * 0.4
        add(y, s, c)
        s += rng.uniform(1.5, 3.0)
    return fade(norm(verb(y, room(rng, 1.4, damp=3000, width=0.9), 0.3), 0.5), 0.3, 0.25)


def hum_stop(rng, **_):
    """the building's hum stops: the 50 Hz sags in pitch and dies, the fridge shudders off"""
    sec = 1.2
    t = tt(sec)
    f = 50 * (1 - 0.35 * np.minimum(1, t / 0.5))
    ph = np.cumsum(TAU * f / SR)
    y = harm(ph, 7, 1.2) * np.exp(-t / 0.22) * 0.6
    add(y, 0.18, thump(rng, 0.3, 70, 800, 0.05) * 0.4)
    return fade(norm(y, 0.5), 0.002, 0.1)


def ticks_up(rng, dur=1.2, **_):
    """the floor counter running up to 20: ticks speeding up and rising in pitch"""
    y = np.zeros(n_(dur + 0.2))
    n = 20
    for i in range(n):
        k = i / (n - 1)
        s = dur * (1 - (1 - k) ** 1.6)
        add(y, s, tick(rng, 2200 * 2 ** (k * 0.9), 0.05) * (0.45 + 0.4 * k))
    return fade(norm(y, 0.6), 0.001, 0.08)


def ribbon(rng, **_):
    """the red banner slaps in: a short whoosh into a punch"""
    sec = 0.7
    y = np.zeros(n_(sec))
    add(y, 0.0, whoosh(rng, 0.22, 600, 4000) * 0.6)
    add(y, 0.2, thump(rng, 0.4, 90, 2500, 0.06) + 0.5 * bp(white(rng, 0.4), 900, 6000) * env(0.4, 0.0008, 0.02))
    return norm(verb(y, room(rng, 0.5), 0.15), 0.9)


def crowd_steps(rng, dur=4.0, **_):
    """everybody running down the stairwell: many feet on concrete steps, echoing up the shaft"""
    y = np.zeros(n_(dur + 0.3))
    for _ in range(int(dur * 11)):
        s = rng.uniform(0, dur - 0.1)
        d = 0.12
        c = thump(rng, d, rng.uniform(110, 170), 1800, 0.018) + 0.35 * bp(white(rng, d), 1500, 5000) * env(d, 0.0005, 0.008)
        add(y, s, c * rng.uniform(0.25, 1.0) * np.clip(1.2 - s / dur, 0.3, 1))
    y = lp(y, 4000)
    return fade(norm(verb(y, room(rng, 2.0, damp=2600, width=0.8), 0.5), 0.6), 0.2, 0.4)


def drain(rng, dur=2.0, **_):
    """water leaving the pipes: low gurgles that slow down, then a dry suck"""
    y = np.zeros(n_(dur + 0.4))
    s = 0.0
    while s < dur - 0.15:
        k = s / dur
        d = rng.uniform(0.05, 0.12)
        f0 = rng.uniform(140, 300) * (1 - 0.4 * k)
        c = np.sin(sweep(d, f0, f0 * 1.9)) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * rng.uniform(0.5, 1.0)
        add(y, s, c)
        s += d + rng.uniform(0.02, 0.08) * (1 + 3 * k)
    d = 0.35
    add(y, dur - 0.1, bp(colored(rng, d, -1), 300, 2500) * np.sin(np.pi * tt(d) / d) * 0.6)
    y += 0.25 * bp(colored(rng, dur + 0.4, -2), 80, 400) * np.exp(-tt(dur + 0.4) / dur)
    return fade(norm(verb(lp(y, 3000), room(rng, 0.9, damp=2000), 0.3), 0.6), 0.03, 0.15)


def whoosh_down(rng, **_):
    return whoosh(rng, 0.55, 3200, 300)


def pump(rng, dur=3.0, off=2.0, **_):
    """the pump in the basement: a motor's hum and whine; at `off` the power goes and it spins down"""
    t = tt(dur)
    sp = np.where(t < off, 1.0, np.exp(-(t - off) / 0.35))
    ph = np.cumsum(TAU * 100 * sp / SR)
    y = 0.45 * harm(ph, 6, 1.0) + 0.15 * np.sin(np.cumsum(TAU * 1450 * sp / SR))
    y += 0.25 * bp(colored(rng, dur, -1), 300, 2000) * sp
    y *= 1 + 0.08 * np.sin(TAU * 12 * t)
    return fade(norm(y, 0.5), 0.15, 0.1)


def spark(rng, **_):
    """the line dies: an electric crackle"""
    y = zap(rng)
    y = np.pad(y, (0, n_(0.25)))
    for _ in range(6):
        add(y, rng.uniform(0.02, 0.3), bp(white(rng, 0.008), 2000, 9000) * env(0.008, 0.0002, 0.002) * rng.uniform(0.3, 0.8))
    return norm(y, 0.7)


def node_off(rng, **_):
    """one node of the chain switches off: a relay click and a short falling blip"""
    sec = 0.3
    y = np.zeros(n_(sec))
    add(y, 0.0, click(rng) * 0.6)
    d = 0.18
    add(y, 0.01, np.sin(sweep(d, 900, 300)) * env(d, 0.002, 0.06) * 0.6)
    return fade(norm(y, 0.6), 0.001, 0.05)


# ——— the dark flat ———
def amb_flat(rng, dur=10.0, **_):
    """the flat with no power: no fridge, no hum; a still air tone, the city far through the glass, a clock on the wall"""
    t = tt(dur)
    y = lp(colored(rng, dur, -3), 350) * 0.35
    y += bp(colored(rng, dur, -1), 400, 1500) * (0.5 + 0.3 * np.sin(TAU * 0.09 * t)) * 0.12
    s = 0.5
    while s < dur - 0.1:
        add(y, s, tick(rng, 2600, 0.04) * 0.06)
        s += 1.0
    return fade(norm(y, 0.35), 0.3, 0.4)


def tap_squeak(rng, **_):
    """the tap's handle turned: a short metal squeak"""
    sec = 0.3
    t = tt(sec)
    y = np.sin(sweep(sec, 1500, 2100) + 2 * np.sin(TAU * 45 * t)) * np.sin(np.pi * t / sec) * 0.5
    y += 0.3 * bp(white(rng, sec), 2500, 7000) * np.sin(np.pi * t / sec)
    return fade(norm(y, 0.5), 0.005, 0.05)


def tap_run(rng, dur=2.0, **_):
    """water from the tap into the tub or a pot"""
    return water(rng, max(0.6, dur)) * 0.8


def tap_cough(rng, **_):
    """the tap coughs air: the water is going"""
    return sputter(rng)


def fill_plink(rng, **_):
    """a bottle or a pot filling: a short rising plink"""
    sec = 0.25
    f0 = rng.uniform(500, 900)
    y = np.sin(sweep(0.12, f0, f0 * 2.4)) * np.sin(np.pi * np.linspace(0, 1, n_(0.12)))
    y = np.pad(y, (0, n_(sec) - len(y))) + 0.3 * bp(white(rng, sec), 1500, 6000) * env(sec, 0.002, 0.03)
    return fade(norm(y, 0.5), 0.002, 0.05)


def whine(rng, dur=0.9, **_):
    """Пурга whines at the fridge: a nasal high glide up and down with a little wobble"""
    t = tt(dur)
    k = t / dur
    f = 780 + 380 * np.sin(np.pi * k) ** 1.5 + 25 * np.sin(TAU * 7 * t)
    ph = np.cumsum(TAU * f / SR)
    src = harm(ph, 10, 1.4)
    y = bp(src, 600, 3200) + 0.4 * bp(src, 2200, 4200)
    y *= np.sin(np.pi * np.clip(k * 1.05, 0, 1)) ** 0.8 * (1 - 0.5 * k)
    return fade(norm(verb(y, room(rng, 0.4, damp=5000), 0.12), 0.5), 0.03, 0.12)


def paper(rng, **_):
    """the paper card slides in: a dry rustle and a soft flap"""
    sec = 0.5
    t = tt(sec)
    y = bp(white(rng, sec), 2000, 9000) * (0.3 + 0.7 * (rng.random(n_(sec)) > 0.97)) * np.sin(np.pi * t / sec) * 0.6
    add(y, 0.32, bp(white(rng, 0.08), 600, 4000) * env(0.08, 0.001, 0.02))
    return fade(norm(lp(y, 9000), 0.55), 0.005, 0.05)


def candle(rng, dur=3.0, **_):
    """a candle: a faint flutter and the odd tiny crackle"""
    t = tt(dur)
    y = bp(colored(rng, dur, -2), 150, 900) * (0.5 + 0.5 * np.abs(np.sin(TAU * 0.6 * t + np.sin(TAU * 0.23 * t)))) * 0.4
    for _ in range(int(dur * 3)):
        add(y, rng.uniform(0, dur - 0.02), bp(white(rng, 0.006), 2000, 8000) * env(0.006, 0.0002, 0.0015) * rng.uniform(0.3, 0.9))
    return fade(norm(y, 0.4), 0.15, 0.2)


def fire_whoosh(rng, **_):
    """the curtain catches: a rush of air into a flame"""
    sec = 1.1
    t = tt(sec)
    y = np.zeros(n_(sec))
    add(y, 0.0, whoosh(rng, 0.5, 250, 2200) * 0.8)
    roar = lp(colored(rng, 0.9, -2), 1200) * np.minimum(1, tt(0.9) / 0.08) * np.exp(-tt(0.9) / 0.4)
    add(y, 0.25, roar)
    return fade(norm(verb(y, room(rng, 0.5), 0.15), 0.85), 0.005, 0.1)


def fire(rng, dur=2.0, **_):
    """the curtain burning: a low roar and crackles"""
    t = tt(dur)
    y = lp(colored(rng, dur, -2), 900) * (0.6 + 0.4 * np.sin(TAU * 1.3 * t + np.sin(TAU * 0.7 * t))) * 0.6
    for _ in range(int(dur * 25)):
        d = rng.uniform(0.004, 0.012)
        add(y, rng.uniform(0, dur - 0.02), bp(white(rng, d), 1500, 9000) * env(d, 0.0002, d / 3) * rng.uniform(0.3, 1))
    return fade(norm(y, 0.6), 0.05, 0.15)


def puff(rng, **_):
    """the flame put out: a short gust and a dying hiss"""
    sec = 0.7
    t = tt(sec)
    y = bp(colored(rng, sec, -1), 300, 2500) * env(sec, 0.01, 0.08) * 0.8
    y += bp(white(rng, sec), 3000, 9000) * np.exp(-t / 0.25) * 0.25
    return fade(norm(y, 0.6), 0.002, 0.1)


# ——— day 3 ———
def morning(rng, dur=4.0, **_):
    """the third morning: birds outside, the city quiet, a little wind"""
    y = birds(rng, dur)[:, :n_(dur)] * 0.7
    air = bp(colored(rng, dur, -1), 400, 1500) * 0.15
    y = y + np.stack([air, air])[:, :y.shape[1]]
    return fade(norm(y, 0.4), 0.3, 0.3)


def squeak_dry(rng, **_):
    """a neighbour turns a tap and nothing comes: a squeak and a hollow breath of air"""
    sec = 0.7
    y = np.zeros(n_(sec))
    add(y, 0.0, tap_squeak(rng))
    d = 0.4
    add(y, 0.22, bp(colored(rng, d, -1), 400, 2000) * np.sin(np.pi * tt(d) / d) * 0.35)
    return fade(norm(y, 0.5), 0.002, 0.08)


def pour(rng, dur=0.9, **_):
    """the bucket tipped into the toilet: a heavy splashing pour"""
    t = tt(dur)
    k = t / dur
    y = bp(colored(rng, dur, -1), 300, 5000) * np.sin(np.pi * np.clip(k * 1.15, 0, 1)) ** 0.6 * 0.7
    y += bp(colored(rng, dur, -3), 80, 400) * np.sin(np.pi * k) * 0.4
    for _ in range(int(dur * 30)):
        dd = rng.uniform(0.01, 0.025)
        f0 = rng.uniform(600, 1800)
        add(y, rng.uniform(0, dur - 0.03), np.sin(sweep(dd, f0, f0 * 1.6)) * np.sin(np.pi * np.linspace(0, 1, n_(dd))) * 0.3)
    return fade(norm(verb(y, room(rng, 0.5, damp=4000), 0.15), 0.7), 0.01, 0.1)


def flush(rng, **_):
    """the toilet flushes: a swirling rush that drains away with a gurgle"""
    sec = 1.6
    t = tt(sec)
    rush = bp(colored(rng, sec, -1), 300, 3000) * np.minimum(1, t / 0.08) * np.exp(-t / 0.7) * 0.7
    rush *= 1 + 0.25 * np.sin(TAU * 5 * t)
    y = rush
    add(y, 0.9, drain(rng, 0.5).mean(0)[:n_(0.7)] * 0.4)
    return fade(norm(y, 0.7), 0.01, 0.2)


def city_day(rng, dur=3.0, **_):
    """the city in daylight from the window: traffic, wind, a bird"""
    t = tt(dur)
    y = lp(colored(rng, dur, -3), 900) * 0.4 + bp(colored(rng, dur, -1), 500, 2000) * (0.5 + 0.3 * np.sin(TAU * 0.2 * t)) * 0.18
    y = np.stack([y, y]) + birds(rng, dur)[:, :n_(dur)] * 0.3
    return fade(norm(y, 0.45), 0.2, 0.3)


def stamp(rng, **_):
    """a red cross stamped on the picture: a rubber thump with a paper slap"""
    sec = 0.4
    y = thump(rng, sec, 120, 1600, 0.05) + 0.6 * bp(white(rng, sec), 800, 5000) * env(sec, 0.0008, 0.015)
    return norm(verb(y, room(rng, 0.4), 0.15), 0.85)


def ding(rng, **_):
    """a green tick: two bright bell notes going up"""
    sec = 0.9
    y = np.zeros(n_(sec))
    for s, f in [(0.0, 1318.5), (0.08, 1975.5)]:
        add(y, s, partials(sec - s, [f, 2.76 * f, 5.4 * f], [0.5, 0.18, 0.08], [1, 0.3, 0.12], rng))
    y *= np.minimum(1, tt(sec) / 0.001)
    return fade(norm(y, 0.6), 0.0005, 0.1)


def pop_word(rng, **_):
    """a title pops in"""
    return pop(rng, 2) * 0.8


def birds(rng, dur=1.0, **_):
    """a summer morning outside the window: a few chirps, far and soft"""
    y = np.zeros(n_(dur + 0.3))
    s = 0.05
    while s < dur - 0.1:
        f0 = rng.uniform(2600, 3600)
        for k in range(rng.integers(2, 5)):
            d = 0.07
            add(y, s + k * 0.1, np.sin(sweep(d, f0, f0 * rng.uniform(1.15, 1.35))) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.3)
        s += rng.uniform(0.35, 0.7)
    return fade(norm(verb(y, room(rng, 0.9, damp=6000, width=0.9), 0.3), 0.4), 0.05, 0.1)


def amb_house(rng, dur=10.0, **_):
    """the bed: a quiet room tone, a faint wind outside the walls"""
    t = tt(dur)
    tone = lp(colored(rng, dur, -2), 400) * 0.5
    wind_ = bp(colored(rng, dur, -1), 300, 1400) * (0.5 + 0.3 * np.sin(TAU * 0.11 * t + np.sin(TAU * 0.05 * t))) * 0.3
    return fade(norm(tone + wind_, 0.4), 0.4, 0.5)


# ——— the arena ———
def _babble(rng, dur, lo=250, hi=3200, rate=5.0):
    """a crowd as many voices: pink noise through vowel-like bands, chopped at syllable rate, two channels apart"""
    out = []
    t = tt(dur)
    for ch in range(2):
        x = colored(rng, dur, -1)
        y = bp(x, lo, hi) * 0.5
        for f0, f1, w in [(500, 900, 0.6), (1000, 1600, 0.4), (2200, 3000, 0.2)]:
            am = 0.55 + 0.45 * np.sin(TAU * rate * (1 + 0.3 * rng.uniform()) * t + rng.uniform(0, TAU)) * np.sin(TAU * 0.7 * t + ch)
            y += bp(colored(rng, dur, -1), f0, f1) * am * w
        out.append(y)
    return np.stack(out)


def crowd_murmur(rng, dur=10.0, **_):
    """the stands before anything happens: thousands talking at once, far away"""
    y = _babble(rng, dur, 200, 2500, 4.0)
    return fade(norm(lp(y, 2600), 0.35), 0.8, 0.8)


def crowd_roar(rng, dur=2.0, **_):
    """the stands roar: the babble swells into one «А-а-а!», with whistles over it"""
    t = tt(dur)
    k = np.minimum(1, t / 0.35) * np.where(t > dur - 0.6, np.clip((dur - t) / 0.6, 0, 1), 1)
    y = _babble(rng, dur, 250, 4000, 6.0) * 0.7
    ah = sum(bp(colored(rng, dur, -1), a, b) * w for a, b, w in [(600, 900, 1.0), (1100, 1400, 0.6), (2400, 2800, 0.25)])
    y = y + np.stack([ah, np.roll(ah, 900)]) * 0.9
    for _ in range(int(dur * 2)):
        s = rng.uniform(0, max(0.1, dur - 0.6)); d = rng.uniform(0.25, 0.5)
        w = np.sin(sweep(d, rng.uniform(1600, 2200), rng.uniform(2600, 3400))) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.25
        c = int(rng.integers(0, 2)); i = n_(s); y[c, i:i + len(w)] += w[:y.shape[1] - i]
    return fade(norm(verb(y * k, room(rng, 1.6, damp=4000, width=0.9), 0.3), 0.8), 0.05, 0.3)


def gate_chain(rng, dur=1.0, **_):
    """the portcullis going up: a chain rattling over a wheel, the iron grating creaking, a clank at the top"""
    y = np.zeros(n_(dur + 0.8))
    s = 0.0
    while s < dur:
        d = 0.08
        c = partials(d, [rng.uniform(2200, 3400), rng.uniform(3800, 5200), rng.uniform(6000, 7500)], [0.03, 0.02, 0.015], [1, 0.6, 0.4], rng)
        add(y, s, c * rng.uniform(0.3, 0.7)); s += rng.uniform(0.035, 0.07)
    t = tt(dur)
    creak = bp(harm(np.cumsum(TAU * (90 + 40 * np.sin(TAU * 1.3 * t)) / SR), 20, 0.7), 400, 1400) * 0.25
    add(y, 0.0, creak)
    add(y, dur, thump(rng, 0.6, 110, 2000, 0.06) + partials(0.6, [420, 1130, 2210], [0.2, 0.12, 0.08], [1, 0.5, 0.3], rng) * 0.4)
    return fade(norm(verb(y, room(rng, 1.0, damp=4000), 0.25), 0.8), 0.01, 0.2)


def hooves(rng, dur=1.0, rate=7.0, slow=0.0, pan1=None, **_):
    """hooves on the sand: a gallop's da-da-dum, dull thuds with a spray of sand; slow: the strides stretch out"""
    n = n_(dur + 0.4)
    y = np.zeros(n)
    s = 0.02
    while s < dur:
        k = s / dur
        step = (1.0 / rate) * (1 + slow * k)
        for j, (dt, v) in enumerate([(0.0, 0.7), (0.07, 0.8), (0.16, 1.0)]):
            d = 0.14
            c = thump(rng, d, rng.uniform(70, 100), 900, 0.03) + 0.3 * bp(white(rng, d), 1500, 6000) * env(d, 0.001, 0.02)
            add(y, s + dt * (1 + slow * k), c * v * rng.uniform(0.8, 1.0))
        s += step * 3.2
    y = lp(y, 3000)
    if pan1 is None:
        return fade(norm(y, 0.8), 0.005, 0.1)
    a = (np.linspace(-0.4, pan1, n) + 1) * np.pi / 4
    return fade(norm(np.stack([np.cos(a) * y, np.sin(a) * y]), 0.8), 0.005, 0.1)


def snort(rng, **_):
    """the bull snorts: a hard blast of air through the nostrils with a low rumble under it"""
    sec = 0.7
    t = tt(sec)
    air = bp(colored(rng, sec, -1), 300, 3500) * env(sec, 0.01, 0.18)
    rum = harm(np.cumsum(TAU * (55 + 10 * np.exp(-t / 0.1)) / SR), 16, 1.0) * env(sec, 0.02, 0.25) * 0.4
    return fade(norm(lp(air + rum, 4000), 0.85), 0.005, 0.1)


def cloth(rng, **_):
    """the cape swung: a heavy cloth snapping through the air"""
    sec = 0.5
    k = tt(sec) / sec
    y = svf_bp(colored(rng, sec, -1), 300 * (1800 / 300) ** np.sin(np.pi * k), 0.7) * np.sin(np.pi * k) ** 1.4
    y += bp(white(rng, sec), 2000, 7000) * env(sec, 0.002, 0.03) * 0.5 * (k > 0.45)
    return fade(norm(y, 0.7), 0.005, 0.05)


def wall_hit(rng, **_):
    """the bull hits the wall: a huge dull thud, the boards cracking, stones and sand trickling down"""
    sec = 2.0
    y = np.zeros(n_(sec))
    add(y, 0.0, thump(rng, 0.8, 55, 700, 0.18) * 1.0)
    add(y, 0.0, lp(colored(rng, 0.6, -3), 400) * env(0.6, 0.002, 0.2) * 0.8)
    for i in range(5):
        d = 0.06; add(y, 0.01 + i * 0.025, bp(white(rng, d), 1500, 7000) * env(d, 0.0005, 0.015) * rng.uniform(0.4, 0.8))
    for _ in range(18):
        s = rng.uniform(0.15, 1.6); d = 0.05
        add(y, s, bp(white(rng, d), 2000, 6000) * env(d, 0.0005, 0.01) * rng.uniform(0.05, 0.2))
    return fade(norm(verb(y, room(rng, 1.2, damp=3000), 0.25), 0.95), 0.0005, 0.3)


def tweet(rng, dur=1.2, **_):
    """cartoon birdies over a dazed head: little high chirps going round"""
    y = np.zeros(n_(dur + 0.2))
    for i in range(int(dur / 0.16)):
        d = 0.08; f = [2600, 3100, 2800, 3400][i % 4]
        add(y, i * 0.16, np.sin(sweep(d, f, f * 1.25)) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.4)
    return fade(norm(y, 0.5), 0.005, 0.1)


def thud(rng, **_):
    """something heavy lies down on the sand"""
    sec = 0.8
    return norm(thump(rng, sec, 60, 500, 0.15) + bp(white(rng, sec), 800, 4000) * env(sec, 0.005, 0.12) * 0.25, 0.85)


def wood_clack(rng, **_):
    """the wooden sword caught: a dry clack of wood on a palm"""
    sec = 0.4
    y = partials(sec, [620, 1340, 2410], [0.04, 0.025, 0.015], [1, 0.6, 0.35], rng) + bp(white(rng, sec), 1000, 5000) * env(sec, 0.0005, 0.01) * 0.6
    return fade(norm(verb(y, room(rng, 0.6), 0.2), 0.8), 0.0005, 0.05)


def bark(rng, **_):
    """Пурга barks twice, happy"""
    y = np.zeros(n_(0.9))
    for s in (0.0, 0.32):
        d = 0.18; t = tt(d)
        f = 520 + 300 * np.exp(-t / 0.04)
        src = harm(np.cumsum(TAU * f / SR), 14, 1.1) + 0.3 * colored(rng, d, -1)
        add(y, s, (bp(src, 500, 2600) + 0.5 * bp(src, 2600, 4200)) * env(d, 0.004, 0.08))
    return fade(norm(verb(y, room(rng, 0.8), 0.2), 0.7), 0.002, 0.1)


# ——— the outbreak ———
def screams(rng, dur=4.0, **_):
    """people screaming in the street far below: short vowel glides, some up, some down, a city echo"""
    y = np.zeros((2, n_(dur + 1.0)))
    s = 0.1
    while s < dur - 0.3:
        d = rng.uniform(0.35, 0.9)
        t = tt(d)
        f0 = rng.uniform(380, 700)
        f = f0 * (1 + rng.uniform(0.2, 0.6) * np.sin(np.pi * t / d) * rng.choice([1, -1])) * (1 + 0.03 * np.sin(TAU * 6 * t))
        src = harm(np.cumsum(TAU * f / SR), 12, 1.0)
        v = (bp(src, 700, 1300) + 0.6 * bp(src, 1800, 3000)) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.6
        ch = int(rng.integers(0, 2)); i = n_(s)
        y[ch, i:i + len(v)] += v[:y.shape[1] - i] * rng.uniform(0.3, 1.0)
        y[1 - ch, i:i + len(v)] += v[:y.shape[1] - i] * 0.3
        s += rng.uniform(0.25, 0.8)
    y = lp(y, 3500)
    return fade(norm(verb(y, room(rng, 2.0, damp=3000, width=0.9), 0.5), 0.7), 0.3, 0.6)


def groans(rng, dur=3.0, **_):
    """the infected below: low throaty groans, overlapping, far"""
    y = np.zeros((2, n_(dur + 1.5)))
    s = 0.0
    while s < dur - 0.4:
        d = rng.uniform(0.8, 1.6)
        g_ = groan(rng, d, rng.uniform(70, 110))
        ch = int(rng.integers(0, 2)); i = n_(s)
        y[ch, i:i + len(g_)] += g_[:y.shape[1] - i] * rng.uniform(0.4, 1.0)
        s += rng.uniform(0.4, 1.0)
    return fade(norm(verb(lp(y, 2000), room(rng, 1.8, damp=2500, width=0.8), 0.45), 0.6), 0.3, 0.6)


def car_alarm(rng, dur=3.0, **_):
    """a car alarm in the street: a whooping siren and a beeping, far below between the houses"""
    t = tt(dur)
    f = np.where((t * 2.5) % 1 < 0.5, 1500 + 900 * ((t * 5) % 1), 2100 - 700 * ((t * 5) % 1))
    y = np.sign(np.sin(np.cumsum(TAU * f / SR))) * 0.3 + np.sin(np.cumsum(TAU * f / SR)) * 0.5
    y = bp(y, 800, 4000) * np.minimum(1, t / 0.05)
    return fade(norm(verb(y, room(rng, 1.6, damp=3500, width=0.8), 0.5), 0.6), 0.02, 0.2)


def scrape(rng, dur=0.9, **_):
    """the wardrobe dragged over the floor: a wooden rasp with judders"""
    t = tt(dur)
    jud = 0.6 + 0.4 * np.abs(np.sin(TAU * 14 * t + 3 * np.sin(TAU * 2 * t)))
    y = bp(colored(rng, dur, -1), 150, 1800) * jud + 0.3 * bp(white(rng, dur), 2000, 5000) * jud
    y *= np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.08)
    return fade(norm(verb(y, room(rng, 0.5), 0.15), 0.8), 0.01, 0.05)


def steps_out(rng, dur=3.0, **_):
    """slow shuffling feet on the landing outside the door, passing and coming back"""
    y = np.zeros(n_(dur + 0.4))
    s = 0.2
    while s < dur - 0.3:
        d = 0.25
        c = thump(rng, d, rng.uniform(70, 100), 700, 0.04) * 0.6 + bp(colored(rng, d, -1), 300, 2500) * env(d, 0.01, 0.12) * 0.5
        add(y, s, c * rng.uniform(0.5, 1.0))
        s += rng.uniform(0.55, 0.85)
    return fade(norm(verb(lp(y, 2500), room(rng, 0.9, damp=2500), 0.35), 0.5), 0.1, 0.3)


# ——— sound design for «Заражение», серия 2: movie-style infected and the stairwell ———
def _glottal(rng, dur, f0a, f0b, jit=0.12, sub=0.55):
    """a rough voice source: glottal pulses with jittered periods (creak) and every other pulse weaker (a growl's
    period doubling), each pulse a short decaying click"""
    n = n_(dur)
    y = np.zeros(n)
    t, k = 0.0, 0
    while t < dur:
        u = t / dur
        f = f0a * (f0b / f0a) ** u
        i = int(t * SR)
        if i < n:
            y[i] += (1.0 if k % 2 == 0 else sub) * (0.8 + 0.4 * rng.uniform())
        t += (1.0 / f) * (1 + jit * rng.standard_normal())
        k += 1
    ker = np.exp(-np.arange(int(0.004 * SR)) / (0.0012 * SR))
    return np.convolve(y, ker)[:n]


def zombie_growl(rng, dur=1.3, f0=72, far=0.0, **_):
    """the infected: a wet throaty «э-э-арх» — creaky voice sliding down, the vowel opening from «э» to «а», breaking into a
    rasping «х» at the end; gurgling, a little distorted; far > 0 puts it down the stairwell"""
    t = tt(dur)
    k = t / dur
    src = _glottal(rng, dur, f0 * 1.25, f0 * 0.75, jit=0.06)
    src = src / (np.max(np.abs(src)) + 1e-9)
    src += 0.05 * colored(rng, dur, -1) * (0.3 + 0.7 * k)                   # a little breath, more towards the end
    f1 = 480 + 300 * np.clip(k * 1.6, 0, 1)                                 # «э» → «а»
    f2 = 1750 - 600 * np.clip(k * 1.6, 0, 1)
    voiced = svf_bp(src, f1, 0.18) * 1.0 + svf_bp(src, f2, 0.15) * 0.5 + svf_bp(src, 2600, 0.15) * 0.18 + lp(src, 220) * 0.8
    voiced = voiced / (np.max(np.abs(voiced)) + 1e-9)
    gurgle = 1 + 0.3 * np.sin(TAU * 23 * t + 3 * np.sin(TAU * 3 * t))
    e = np.minimum(1, t / 0.07) * np.clip((0.86 - k) / 0.22, 0, 1) ** 0.7
    v = np.tanh(1.8 * voiced * e * gurgle)
    rasp = svf_bp(colored(rng, dur, -1), 1500, 0.3)
    rasp = rasp / (np.max(np.abs(rasp)) + 1e-9) * np.clip((k - 0.66) / 0.12, 0, 1) * np.clip((1 - k) / 0.12, 0, 1) * 0.55   # «х»
    y = lp(v + rasp, 4500)
    if far > 0:
        y = lp(y, 2400 - 1200 * far)
        return fade(norm(verb(y, room(rng, 1.4 + 1.6 * far, damp=2600, width=0.8), 0.4 + 0.5 * far, 1 - 0.5 * far), 0.8), 0.01, 0.3)
    return fade(norm(verb(y, room(rng, 0.7, damp=4000), 0.18), 0.95), 0.005, 0.2)


def zombie_far(rng, dur=1.6, **_):
    return zombie_growl(rng, dur, f0=64, far=0.8)


def zombie_crowd(rng, dur=3.0, **_):
    """several infected somewhere below: overlapping growls in the stairwell"""
    y = np.zeros((2, n_(dur + 2.5)))
    s = 0.0
    while s < dur - 0.6:
        d = rng.uniform(0.9, 1.6)
        g_ = zombie_growl(rng, d, f0=rng.uniform(55, 85), far=rng.uniform(0.5, 1.0))
        i = n_(s); j = min(y.shape[1], i + g_.shape[1])
        y[:, i:j] += g_[:, :j - i] * rng.uniform(0.4, 0.9)
        s += rng.uniform(0.35, 0.8)
    return fade(norm(y, 0.7), 0.3, 0.6)


def door_creak(rng, dur=1.2, **_):
    """an old door swinging open: the hinge's stick-slip creak — a rasp whose pitch wanders — through the wood's resonances,
    with a thin squeal riding on top"""
    t = tt(dur)
    k = t / dur
    rate = 28 + 70 * np.sin(np.pi * np.clip(k * 1.1, 0, 1)) ** 0.8 + 12 * np.sin(TAU * 2.3 * t)
    n = len(t)
    imp = np.zeros(n)
    ph = np.cumsum(rate / SR)
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    imp[idx] = 0.6 + 0.6 * rng.uniform(size=len(idx))
    wood = np.zeros(int(0.05 * SR))
    tw = np.arange(len(wood)) / SR
    for f, d, a in [(320, 0.012, 1.0), (690, 0.008, 0.7), (1180, 0.006, 0.5), (2050, 0.004, 0.3)]:
        wood += a * np.sin(TAU * f * (1 + 0.04 * rng.standard_normal()) * tw) * np.exp(-tw / d)
    creak = np.convolve(imp, wood)[:n]
    sq = np.sin(np.cumsum(TAU * (820 + 260 * np.sin(np.pi * k) + 30 * np.sin(TAU * 7 * t)) / SR)) * np.convolve(imp, np.ones(200) / 60)[:n] * 0.35
    e = np.minimum(1, t / 0.05) * np.clip((1 - k) / 0.15, 0, 1)
    return fade(norm(verb((creak + sq) * e, room(rng, 0.9, damp=4500), 0.25), 0.85), 0.005, 0.1)


def door_unlock(rng, **_):
    """a key turned twice in a steel door, the latch drawn back"""
    sec = 0.9
    y = np.zeros(n_(sec))
    for s0 in (0.0, 0.28):
        add(y, s0, partials(0.12, [2300, 3700, 5200], [0.012, 0.008, 0.005], [1, 0.6, 0.4], rng, 0.05) + bp(white(rng, 0.12), 2000, 7000) * env(0.12, 0.0005, 0.01) * 0.5)
    add(y, 0.55, thump(rng, 0.25, 160, 2500, 0.02) * 0.6 + partials(0.25, [900, 1700, 2900], [0.04, 0.03, 0.02], [0.6, 0.4, 0.3], rng))
    return fade(norm(verb(y, room(rng, 0.6), 0.2), 0.75), 0.001, 0.05)


def door_open(rng, dur=1.6, **_):
    """the whole thing: unlock, then the slow creak as it swings"""
    a = door_unlock(rng)
    b = door_creak(rng, dur)
    y = np.zeros((2, a.shape[1] + b.shape[1]))
    y[:, :a.shape[1]] += a
    i = n_(0.7); y[:, i:i + b.shape[1]] += b[:, :y.shape[1] - i]
    return norm(y, 0.85)


def stair_steps(rng, dur=3.0, rate=2.4, **_):
    """boots going down concrete stairs, in the stairwell's long echo"""
    y = np.zeros(n_(dur + 0.3))
    s = 0.05
    while s < dur - 0.2:
        d = 0.18
        c = thump(rng, d, rng.uniform(85, 120), 1500, 0.025) + 0.5 * bp(white(rng, d), 1200, 5000) * env(d, 0.0005, 0.012)
        add(y, s, c * rng.uniform(0.6, 1.0))
        s += (1 / rate) * rng.uniform(0.9, 1.1)
    return fade(norm(verb(y, room(rng, 2.4, damp=3000, width=0.9), 0.55), 0.6), 0.02, 0.4)


def heartbeat(rng, dur=4.0, bpm=96, **_):
    """a heart thumping in the ears: lub-dub, low and close"""
    y = np.zeros(n_(dur + 0.4))
    s = 0.0
    while s < dur:
        add(y, s, thump(rng, 0.2, 55, 200, 0.05))
        add(y, s + 0.16, thump(rng, 0.2, 45, 180, 0.05) * 0.7)
        s += 60 / bpm
    return fade(norm(lp(y, 300), 0.8), 0.05, 0.3)


def breath(rng, dur=3.0, **_):
    """short nervous breaths through the mouth"""
    y = np.zeros(n_(dur + 0.5))
    s = 0.05
    while s < dur - 0.3:
        for d, lo, hi, a in [(0.35, 500, 2500, 0.8), (0.45, 300, 1800, 0.6)]:
            add(y, s, bp(colored(rng, d, -1), lo, hi) * np.sin(np.pi * np.linspace(0, 1, n_(d))) ** 1.5 * a)
            s += d + 0.05
        s += rng.uniform(0.1, 0.3)
    return fade(norm(y, 0.45), 0.05, 0.2)


def zipper(rng, **_):
    """the backpack zipped shut"""
    sec = 0.7
    t = tt(sec)
    rate = 90 + 60 * t / sec
    imp = (np.diff(np.floor(np.cumsum(rate / SR)), prepend=0) > 0).astype(float)
    y = np.convolve(imp, bp(white(rng, 0.006), 2500, 8000))[:len(t)] * np.minimum(1, t / 0.03)
    return fade(norm(y, 0.6), 0.005, 0.05)


def pan_clang(rng, **_):
    """a cast-iron frying pan knocked against the door frame: a dull metal bong"""
    sec = 1.6
    y = partials(sec, [210, 520, 905, 1390, 2010], [0.6, 0.35, 0.22, 0.15, 0.1], [1, 0.7, 0.5, 0.35, 0.2], rng, 0.01)
    y += thump(rng, sec, 120, 1500, 0.03) * 0.5
    return fade(norm(verb(y * np.minimum(1, tt(sec) / 0.001), room(rng, 1.6, damp=4000), 0.3), 0.85), 0.0005, 0.3)


def dog_growl(rng, dur=1.2, **_):
    """Пурга growls at the creaking door: a low rough rumble with the lip curled"""
    t = tt(dur)
    f = 115 + 10 * np.sin(TAU * 1.3 * t)
    src = _glottal(rng, dur, 122, 108, jit=0.08, sub=0.7)
    src = src / (np.max(np.abs(src)) + 1e-9)
    y = svf_bp(src, 420, 0.25) + 0.5 * svf_bp(src, 1100, 0.3) + 0.4 * lp(src, 200)
    y = np.tanh(1.5 * y / (np.max(np.abs(y)) + 1e-9)) * np.minimum(1, t / 0.15) * np.clip((dur - t) / 0.2, 0, 1)
    return fade(norm(y, 0.6), 0.02, 0.1)


# ——— the 3D test: the stairwell, the lift ———
def stairwell_air(rng, dur=4.0, **_):
    """the dead stairwell of a sixteen-storey block: a low draught through the shaft, a hiss of air, a drop somewhere far
    below, all in the long concrete echo"""
    t = tt(dur)
    y = lp(colored(rng, dur, -3), 180) * 0.6
    y += bp(colored(rng, dur, -1), 280, 1100) * (0.5 + 0.5 * np.sin(TAU * 0.13 * t + 1.0)) * 0.18
    s = rng.uniform(0.6, 1.4)
    while s < dur - 0.3:
        add(y, s, tick(rng, rng.uniform(1800, 2600), 0.05) * 0.05)
        s += rng.uniform(1.2, 2.4)
    return fade(norm(verb(y, room(rng, 2.6, damp=2200, width=0.9), 0.5, 0.8), 0.4), 0.4, 0.5)


def lift_hum(rng, dur=3.0, **_):
    """the open lift on the 1st floor: the ballast of its lamp buzzing at 100 Hz, the motor's low hum, and the crackle
    each time the lamp dips"""
    t = tt(dur)
    y = bp(mains(t, 100, 9, 0.6), 90, 2400) * 0.25 + mains(t, 50, 3, 1.5) * 0.12
    y *= 1 + 0.15 * np.sin(TAU * 0.7 * t)
    s = 0.25
    while s < dur - 0.2:
        d = rng.uniform(0.04, 0.12)
        i, j = n_(s), n_(s + d)
        y[i:j] *= 0.25                                                   # the lamp dips
        add(y, s, bp(white(rng, d + 0.02), 1800, 7000) * env(d + 0.02, 0.001, 0.02) * 0.4)   # the crackle
        s += rng.uniform(0.5, 1.3)
    return fade(norm(verb(y, room(rng, 0.8, damp=5000), 0.2), 0.4), 0.06, 0.15)


def cloth_soft(rng, **_):
    """a sleeve brushing a coat: the sign of the cross"""
    sec = 0.9
    k = tt(sec) / sec
    y = bp(colored(rng, sec, -1), 400, 3000) * (np.sin(np.pi * np.clip(k * 4 % 1, 0, 1)) ** 2) * np.sin(np.pi * k) ** 0.5
    return fade(norm(y, 0.4), 0.01, 0.1)


def zombie_scare(rng, dur=1.3, f0=58, far=0.45, **_):
    """the answer from below over black: the growl, up the shaft"""
    return zombie_growl(rng, dur, f0=f0, far=far)


FX = {k: v for k, v in globals().items() if callable(v) and k in (
    'city', 'hum_stop', 'ticks_up', 'ribbon', 'crowd_steps', 'drain', 'whoosh_down', 'pump', 'spark', 'node_off', 'amb_flat',
    'tap_squeak', 'tap_run', 'tap_cough', 'fill_plink', 'whine', 'paper', 'candle', 'fire_whoosh', 'fire', 'puff', 'morning',
    'squeak_dry', 'pour', 'flush', 'city_day', 'stamp', 'ding', 'pop_word', 'crowd_murmur', 'crowd_roar', 'gate_chain',
    'hooves', 'snort', 'cloth', 'wall_hit', 'tweet', 'thud', 'wood_clack', 'bark', 'screams', 'groans', 'car_alarm', 'scrape',
    'steps_out', 'zombie_growl', 'zombie_far', 'zombie_crowd', 'door_creak', 'door_unlock', 'door_open', 'stair_steps', 'heartbeat',
    'breath', 'zipper', 'pan_clang', 'dog_growl', 'stairwell_air', 'lift_hum', 'cloth_soft', 'zombie_scare')}
FX.update(power_down=power_down, whoosh=whoosh, whoosh_in=whoosh_in, blip=blip, click=click, toggle=toggle)
