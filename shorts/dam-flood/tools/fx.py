# Effects of «Погас свет, ты на 20-м этаже», synthesised like sfx.py (noise through filters, damped partials, glides; no samples).
# FX[name](rng, **cue) returns a mono or stereo float array at 48 kHz; names match cues() in src/main.js.
import numpy as np
from sfx import (SR, TAU, n_, tt, lp, hp, bp, peak, white, colored, env, fade, norm, partials, sweep, harm, svf_bp, room, verb,
                 thump, whoosh, whoosh_in, pop, water, tick, sputter, zap, blip, click, toggle, power_down)


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

FX = {k: v for k, v in globals().items() if callable(v) and k in (
    'city', 'hum_stop', 'ticks_up', 'ribbon', 'crowd_steps', 'drain', 'whoosh_down', 'pump', 'spark', 'node_off', 'amb_flat',
    'tap_squeak', 'tap_run', 'tap_cough', 'fill_plink', 'whine', 'paper', 'candle', 'fire_whoosh', 'fire', 'puff', 'morning',
    'squeak_dry', 'pour', 'flush', 'city_day', 'stamp', 'ding', 'pop_word')}
FX.update(power_down=power_down, whoosh=whoosh, whoosh_in=whoosh_in, blip=blip, click=click, toggle=toggle)
