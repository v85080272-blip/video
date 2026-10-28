# Effects of «Подлодка, отказала вся электроника», synthesised like sfx.py (noise through filters, damped partials,
# glides; no samples). FX[name](rng, **cue) returns a mono or stereo float array at 48 kHz; names match cues() in src/main.js.
# The sea is heard as a deep, dark rumble (low-passed, long rooms); inside the dead boat there is no hum at all, only a
# close air tone, drips and the steel ticking; the knocks on the hull are the loudest thing after the power going out.
import numpy as np
from sfx import (SR, TAU, n_, tt, lp, hp, bp, white, colored, env, fade, norm, partials, sweep, harm, svf_bp, room, verb,
                 thump, whoosh, whoosh_in, whoosh_up, pop, tick, blip, click, toggle, power_down)


def add(y, s, c):
    i = n_(s)
    if i < len(y):
        y[i:i + len(c)] += c[:len(y) - i]


def D(dur, lo=0.3):
    return max(lo, float(dur))


def chirp(rng, d, f0, k=1.8):
    """one bubble: a short rising sine"""
    return np.sin(sweep(d, f0, f0 * k)) * np.sin(np.pi * np.linspace(0, 1, n_(d)))


def bubble_bed(rng, dur, dense, lo, hi, dmin=0.02, dmax=0.07):
    y = np.zeros(n_(dur))
    for _ in range(int(dur * dense)):
        d = rng.uniform(dmin, dmax)
        add(y, rng.uniform(0, max(0.01, dur - d)), chirp(rng, d, rng.uniform(lo, hi), rng.uniform(1.4, 2.2)) * rng.uniform(0.2, 0.8))
    return y


# ——— the boat in the sea ———
def deep(rng, dur=4.0, **_):
    """outside the boat: the deep sea's slow rumble, a far wash of water, now and then a bubble drifting up"""
    dur = D(dur, 1.0)
    t = tt(dur)
    y = lp(colored(rng, dur, -6), 160) * (0.7 + 0.3 * np.sin(TAU * 0.09 * t + 1)) * 0.8
    y += bp(colored(rng, dur, -2), 250, 1000) * (0.5 + 0.5 * np.sin(TAU * 0.05 * t)) * 0.08
    s = rng.uniform(0.3, 1.0)
    while s < dur - 0.5:
        add(y, s, chirp(rng, rng.uniform(0.02, 0.05), rng.uniform(300, 700)) * 0.12)
        s += rng.uniform(0.4, 1.3)
    return fade(norm(verb(lp(y, 2200), room(rng, 2.5, damp=1500, width=0.9), 0.35), 0.5), 0.4, 0.5)


def engine(rng, dur=3.0, off=2.0, **_):
    """the boat under way, heard through the water: the motor's low hum and the beat of the screw; at `off` it spins down"""
    dur = D(dur, 0.5)
    t = tt(dur)
    sp = np.where(t < off, 1.0, np.exp(-(t - off) / 0.6))
    hum = harm(np.cumsum(TAU * 48 * sp / SR), 8, 1.3) * 0.5 * sp ** 1.5
    blade = 0.5 + 0.5 * np.sin(np.cumsum(TAU * 3.8 * sp / SR)) ** 2
    churn = bp(colored(rng, dur, -2), 150, 900) * blade * sp * 0.6
    return fade(norm(verb(lp(hum + churn, 1400), room(rng, 1.8, damp=1500, width=0.8), 0.3), 0.6), 0.3, 0.2)


def sonar(rng, **_):
    """a sonar ping: a pure tone with a long watery tail and a faint echo"""
    sec = 2.4
    t = tt(sec)
    ph = np.cumsum(TAU * 1180 * (1 - 0.01 * t) / SR)
    y = (np.sin(ph) + 0.15 * np.sin(2 * ph)) * np.minimum(1, t / 0.004) * np.exp(-t / 0.35)
    echo = np.zeros_like(y)
    add(echo, 0.9, y[:n_(1.0)] * 0.3)
    y = lp(y + lp(echo, 1500), 4000)
    return fade(norm(verb(y, room(rng, 2.2, damp=3000, width=0.9), 0.45), 0.5), 0.002, 0.3)


def relays(rng, **_):
    """the circuits drop out one after another: a run of relay clacks, slowing down"""
    sec = 0.9
    y = np.zeros(n_(sec))
    s, gap = 0.0, 0.05
    for i in range(7):
        add(y, s, click(rng) * (0.9 - 0.08 * i))
        add(y, s, thump(rng, 0.08, 180, 3000, 0.012) * 0.35)
        s += gap
        gap *= 1.25
    return fade(norm(verb(y, room(rng, 0.6, damp=4000), 0.2), 0.7), 0.001, 0.05)


def _creak(rng, sec):
    """stick-slip friction of steel under load through the hull's low resonances"""
    t = tt(sec)
    k = t / sec
    rate = 16 + 14 * np.sin(np.pi * k)
    pulses = np.maximum(0, np.sin(np.cumsum(TAU * rate / SR))) ** 6
    src = pulses * (0.6 + 0.4 * colored(rng, sec, -6)) + 0.15 * colored(rng, sec, -2)
    y = sum(a * bp(src, f * 0.96, f * 1.04) for f, a in [(95, 1.0), (190, 0.7), (310, 0.6), (470, 0.4), (720, 0.25)])
    y = y + 0.3 * lp(src, 400)
    return lp(y * np.sin(np.pi * np.clip(k * 1.05, 0, 1)) ** 0.8, 1800)


def creak(rng, dur=1.4, **_):
    """the hull under the sea's weight: a long low groan of the steel"""
    return fade(norm(verb(_creak(rng, D(dur, 0.8)), room(rng, 1.6, damp=1800, width=0.8), 0.35), 0.6), 0.08, 0.2)


def ribbon(rng, **_):
    """the red banner slaps in: a short whoosh into a punch"""
    sec = 0.7
    y = np.zeros(n_(sec))
    add(y, 0.0, whoosh(rng, 0.22, 600, 4000) * 0.6)
    add(y, 0.2, thump(rng, 0.4, 90, 2500, 0.06) + 0.5 * bp(white(rng, 0.4), 900, 6000) * env(0.4, 0.0008, 0.02))
    return norm(verb(y, room(rng, 0.5), 0.15), 0.9)


def scan(rng, dur=0.55, **_):
    """the boat turns into its blueprint: a bright line sweeps across with a rising shimmer and fine ticks"""
    run = D(dur, 0.3)
    sec = run + 0.3
    t = tt(sec)
    k = np.clip(t / run, 0, 1)
    y = harm(np.cumsum(TAU * 300 * 8 ** k / SR), 5, 1.6) * np.sin(np.pi * k) ** 1.2 * 0.3
    y += bp(white(rng, sec), 2500, 9000) * np.sin(np.pi * k) * 0.2
    for i in range(14):
        add(y, run * i / 14, tick(rng, 2600 + 120 * i, 0.03) * 0.25)
    return fade(norm(verb(y, room(rng, 0.7, damp=7000), 0.2), 0.6), 0.01, 0.1)


def fan(rng, dur=3.0, off=2.0, **_):
    """the air scrubber's fan: a motor whine and the whir of its blades; at `off` the power is gone and it winds down"""
    dur = D(dur, 0.5)
    t = tt(dur)
    sp = np.where(t < off, 1.0, np.exp(-(t - off) / 0.3))
    whine = np.sin(np.cumsum(TAU * 620 * sp / SR)) * 0.12 + harm(np.cumsum(TAU * 120 * sp / SR), 5, 1.4) * 0.25
    whir = bp(colored(rng, dur, -1), 500, 2500) * (0.6 + 0.4 * np.sin(np.cumsum(TAU * 45 * sp / SR))) * 0.4
    return fade(norm(verb((whine + whir) * sp, room(rng, 0.5, damp=4000), 0.15), 0.5), 0.15, 0.1)


def node_off(rng, **_):
    """one node of the chain switches off: a relay click and a short falling blip"""
    sec = 0.3
    y = np.zeros(n_(sec))
    add(y, 0.0, click(rng) * 0.6)
    d = 0.18
    add(y, 0.01, np.sin(sweep(d, 900, 300)) * env(d, 0.002, 0.06) * 0.6)
    return fade(norm(y, 0.6), 0.001, 0.05)


def gas(rng, dur=3.0, **_):
    """the air going bad: a soft hiss that thickens and a slow throb in the ears"""
    dur = D(dur, 0.8)
    t = tt(dur)
    k = t / dur
    hiss = bp(colored(rng, dur, -1), 600, 3000) * (0.2 + 0.8 * k ** 1.5) * 0.4
    throb = np.sin(TAU * 55 * t) * (0.5 + 0.5 * np.sin(TAU * 1.1 * t)) ** 4 * k * 0.5
    return fade(norm(hiss + throb, 0.45), 0.3, 0.3)


def clock(rng, dur=3.0, **_):
    """the hours going by: a tick-tock a little faster than a real clock"""
    dur = D(dur, 0.5)
    y = np.zeros(n_(dur + 0.1))
    s, i = 0.0, 0
    while s < dur:
        add(y, s, tick(rng, 2900 if i % 2 == 0 else 2300, 0.05) * 0.5)
        s += 0.3
        i += 1
    return fade(norm(verb(y, room(rng, 0.5, damp=5000), 0.15), 0.4), 0.002, 0.05)


# ——— inside the dead boat ———
def amb_hull(rng, dur=6.0, **_):
    """the dead compartment: no fans, no hum; a close, heavy air tone, water dripping somewhere, the steel ticking"""
    dur = D(dur, 1.0)
    y = lp(colored(rng, dur, -4), 260) * 0.5 + bp(colored(rng, dur, -1), 200, 900) * 0.06
    s = rng.uniform(0.3, 0.9)
    while s < dur - 0.2:
        add(y, s, chirp(rng, 0.03, rng.uniform(900, 1500), 1.9) * rng.uniform(0.08, 0.18))
        s += rng.uniform(0.7, 1.6)
    s = rng.uniform(0.8, 2.0)
    while s < dur - 0.3:
        add(y, s, partials(0.25, [rng.uniform(600, 900), rng.uniform(1300, 1800)], [0.05, 0.03], [0.06, 0.03], rng))
        s += rng.uniform(1.5, 3.0)
    return fade(norm(verb(y, room(rng, 0.9, damp=3000, width=0.8), 0.3), 0.4), 0.3, 0.4)


def valve(rng, dur=2.0, **_):
    """the blow valve's wheel forced round by hand: a squeal of stiff metal on each pull and the thread grinding"""
    dur = D(dur, 0.6)
    y = np.zeros(n_(dur + 0.3))
    s = 0.0
    while s < dur - 0.2:
        d = rng.uniform(0.32, 0.42)
        tq = tt(d)
        f0 = rng.uniform(700, 1000)
        sq = np.sin(sweep(d, f0, f0 * 1.25) + 3 * np.sin(TAU * 31 * tq)) * np.sin(np.pi * tq / d) ** 0.7 * 0.3
        stick = lp(np.clip(colored(rng, d, 0) * 0.8 + 0.6, 0, None) * (0.5 + 0.5 * np.sin(TAU * 27 * tq)), 120)
        grind = bp(colored(rng, d, -1), 200, 900) * stick * np.sin(np.pi * tq / d) * 0.6
        add(y, s, sq + grind)
        s += d + rng.uniform(0.1, 0.2)
    return fade(norm(verb(y, room(rng, 0.7, damp=3500), 0.2), 0.6), 0.01, 0.1)


def air_blow(rng, dur=3.0, **_):
    """high-pressure air into the ballast tanks: a bang as the valve gives, then a roaring hiss through the pipes"""
    dur = D(dur, 1.0)
    t = tt(dur)
    e = np.minimum(1, t / 0.03) * (0.75 + 0.25 * np.exp(-t / 0.4)) * np.minimum(1, (dur - t) / 0.5)
    hiss = bp(colored(rng, dur, -1), 1500, 9000) * 0.5 + bp(colored(rng, dur, -2), 200, 1500) * 0.6
    roar = lp(colored(rng, dur, -4), 300) * 0.5 * (1 + 0.3 * np.sin(TAU * 7 * t))
    y = (hiss + roar) * e
    add(y, 0.0, thump(rng, 0.4, 70, 2500, 0.06) * 0.8)
    return fade(norm(verb(y, room(rng, 1.0, damp=3500), 0.25), 0.8), 0.002, 0.3)


def bubbles(rng, dur=2.0, **_):
    """the water forced out of the tanks: a churn of big bubbles under a low gurgle"""
    dur = D(dur, 0.5)
    t = tt(dur)
    y = bubble_bed(rng, dur, 45, 150, 650, 0.03, 0.09)
    y += lp(colored(rng, dur, -3), 400) * 0.3 * (0.6 + 0.4 * np.sin(TAU * 2.3 * t))
    return fade(norm(verb(lp(y, 3000), room(rng, 1.4, damp=2000, width=0.9), 0.3), 0.6), 0.1, 0.3)


def rise(rng, **_):
    """the boat lifts: a swell of rushing water climbing in pitch over a deep groan of the hull"""
    sec = 2.2
    t = tt(sec)
    k = t / sec
    wash = svf_bp(colored(rng, sec, -2), 150 * (1400 / 150) ** k, 0.7) * np.sin(np.pi * k) ** 1.2
    tone = harm(sweep(sec, 55, 110), 6, 1.5) * k ** 1.5 * np.sin(np.pi * np.clip(k * 1.1, 0, 1)) * 0.25
    y = wash + tone
    add(y, 0.1, _creak(rng, 1.4) * 0.5)
    return fade(norm(verb(y, room(rng, 1.8, damp=1800, width=0.9), 0.3), 0.8), 0.05, 0.2)


def thud_bed(rng, **_):
    """the boat settles on the bottom: a heavy dull boom, the hull ringing once, silt hissing"""
    sec = 2.0
    y = thump(rng, sec, 45, 300, 0.35)
    y += partials(sec, [140, 233, 371, 529], [0.6, 0.45, 0.3, 0.2], [0.25, 0.18, 0.12, 0.08], rng, 0.02)
    y += bp(colored(rng, sec, -2), 200, 1200) * env(sec, 0.05, 0.5) * 0.3
    return norm(verb(lp(y, 2000), room(rng, 1.8, damp=1500, width=0.8), 0.3), 0.9)


def stamp(rng, **_):
    """a red cross stamped on the picture: a rubber thump with a paper slap"""
    sec = 0.4
    y = thump(rng, sec, 120, 1600, 0.05) + 0.6 * bp(white(rng, sec), 800, 5000) * env(sec, 0.0008, 0.015)
    return norm(verb(y, room(rng, 0.4), 0.15), 0.85)


def breath(rng, dur=4.0, **_):
    """lying still and breathing slowly: a soft inhale and a longer exhale, about every three seconds"""
    dur = D(dur, 1.0)
    y = np.zeros(n_(dur + 1.0))
    s = 0.2
    while s < dur - 0.6:
        di, de = 0.9, 1.3
        k, k2 = np.linspace(0, 1, n_(di)), np.linspace(0, 1, n_(de))
        add(y, s, bp(colored(rng, di, -1), 700, 2600) * np.sin(np.pi * k) ** 1.5 * 0.5)
        add(y, s + di + 0.15, bp(colored(rng, de, -2), 300, 1600) * np.sin(np.pi * k2 ** 0.6) ** 1.2 * 0.6)
        s += di + de + 0.8
    return fade(norm(verb(lp(y, 3500), room(rng, 0.5, damp=4000), 0.15), 0.4), 0.05, 0.2)


def cloth(rng, **_):
    """lying down on the bunk: a rustle of the blanket and a soft bump"""
    sec = 0.6
    k = tt(sec) / sec
    y = svf_bp(colored(rng, sec, -1), 800 + 2000 * np.sin(np.pi * k), 0.8) * np.sin(np.pi * k) ** 1.3 * 0.7
    add(y, 0.38, thump(rng, 0.2, 110, 600, 0.04) * 0.5)
    return fade(norm(y, 0.5), 0.01, 0.05)


def locker(rng, **_):
    """the emergency locker: the catch snaps, the steel door swings on a squeaky hinge and knocks open"""
    sec = 0.9
    y = np.zeros(n_(sec))
    add(y, 0.0, click(rng) * 0.8)
    d = 0.35
    tq = tt(d)
    add(y, 0.06, np.sin(sweep(d, 1400, 1900) + 2 * np.sin(TAU * 37 * tq)) * np.sin(np.pi * tq / d) * 0.25)
    add(y, 0.42, partials(0.4, [520, 1190, 1870, 2650], [0.15, 0.1, 0.07, 0.05], [0.5, 0.35, 0.2, 0.1], rng, 0.02)
        + 0.3 * thump(rng, 0.4, 150, 2000, 0.02))
    return norm(verb(y, room(rng, 0.6, damp=4000), 0.2), 0.75)


def can_out(rng, **_):
    """a tin taken off the shelf: a short scrape and a hollow clink"""
    sec = 0.5
    y = np.zeros(n_(sec))
    d = 0.18
    add(y, 0.0, bp(white(rng, d), 1500, 6000) * np.sin(np.pi * tt(d) / d) * 0.25)
    add(y, 0.16, partials(0.3, [1250, 2900, 4300], [0.06, 0.04, 0.025], [0.5, 0.3, 0.15], rng, 0.02) + 0.2 * thump(rng, 0.3, 300, 3000, 0.01))
    return norm(verb(y, room(rng, 0.5), 0.15), 0.6)


def can_open(rng, **_):
    """the tin opened: the seal pops with a hiss and the lid tears back"""
    sec = 0.7
    y = np.zeros(n_(sec))
    add(y, 0.0, pop(rng, -2) * 0.6)
    add(y, 0.01, bp(white(rng, 0.25), 3000, 9000) * env(0.25, 0.002, 0.08) * 0.35)
    d = 0.35
    add(y, 0.18, bp(white(rng, d), 1500, 6000) * (0.4 + 0.6 * (rng.random(n_(d)) > 0.9)) * np.sin(np.pi * tt(d) / d) * 0.4)
    return fade(norm(verb(y, room(rng, 0.5), 0.12), 0.6), 0.001, 0.05)


def pour(rng, dur=1.2, **_):
    """the powder poured onto the floor: a dry granular hiss, thicker in the middle"""
    dur = D(dur, 0.4)
    k = tt(dur) / dur
    grains = (rng.random(n_(dur)) < 0.08) * rng.uniform(0.2, 1, n_(dur))
    y = bp(grains + 0.3 * white(rng, dur), 2500, 9000) * np.sin(np.pi * np.clip(k * 1.1, 0, 1)) ** 0.6 * 0.6
    y += bp(colored(rng, dur, -1), 400, 2000) * np.sin(np.pi * k) * 0.25
    return fade(norm(verb(y, room(rng, 0.5, damp=5000), 0.12), 0.5), 0.02, 0.1)


def sparkle(rng, dur=1.3, **_):
    """the powder at work: a soft shimmer of tiny high bells"""
    dur = D(dur, 0.5)
    y = np.zeros(n_(dur + 0.8))
    for _ in range(int(dur * 14)):
        f = rng.choice([1568, 1760, 2093, 2349, 2637, 3136])
        add(y, rng.uniform(0, dur), partials(0.6, [f, 2.76 * f], [0.18, 0.08], [0.25, 0.08], rng) * rng.uniform(0.3, 1))
    return fade(norm(verb(y, room(rng, 1.2, damp=8000, width=0.9), 0.3), 0.4), 0.01, 0.2)


def _strike(rng):
    """the wrench on the steel: a sharp hit, inharmonic partials of the hull plate, a dull thud of the whole hull"""
    sec = 1.6
    fr = np.array([231, 547, 893, 1312, 1777, 2390, 3105]) * rng.uniform(0.98, 1.02)
    y = partials(sec, fr, [0.7, 0.45, 0.35, 0.25, 0.18, 0.12, 0.08], [0.5, 0.45, 0.4, 0.3, 0.22, 0.15, 0.1], rng, 0.01)
    y *= np.minimum(1, tt(sec) / 0.0008)
    y += bp(white(rng, sec), 1200, 8000) * env(sec, 0.0003, 0.008) * 1.2
    return y + thump(rng, sec, 90, 1500, 0.05) * 0.6


def knock(rng, **_):
    """a knock on the hull from inside: a hard steel clank, the compartment ringing"""
    return norm(verb(_strike(rng), room(rng, 1.4, damp=4500, width=0.7), 0.35), 0.95)


def knock_far(rng, **_):
    """the same knock heard through the water far away: dull, low and long"""
    return norm(verb(lp(_strike(rng), 900), room(rng, 3.0, damp=900, width=0.9), 0.8, 0.5), 0.6)


def whoosh_down(rng, **_):
    return whoosh(rng, 0.55, 3200, 300)


def ship(rng, dur=3.0, off=1.0, **_):
    """the rescue ship far above, heard through the water: an engine drone and a propeller thrum; at `off` the crew
    stops the engines to listen, and only the sea is left"""
    dur = D(dur, 1.0)
    t = tt(dur)
    sp = np.where(t < off, 1.0, np.exp(-(t - off) / 0.45))
    drone = harm(np.cumsum(TAU * 38 * (0.6 + 0.4 * sp) / SR), 6, 1.5) * 0.4
    thrum = lp(colored(rng, dur, -3), 400) * (0.4 + 0.6 * np.sin(np.cumsum(TAU * 3.2 * sp / SR)) ** 4)
    y = lp((drone + thrum) * sp, 700) + lp(colored(rng, dur, -6), 150) * 0.15
    return fade(norm(verb(y, room(rng, 2.5, damp=1000, width=0.9), 0.4), 0.5), 0.5, 0.3)


def ding(rng, **_):
    """a green tick: two bright bell notes going up"""
    sec = 0.9
    y = np.zeros(n_(sec))
    for s, f in [(0.0, 1318.5), (0.08, 1975.5)]:
        add(y, s, partials(sec - s, [f, 2.76 * f, 5.4 * f], [0.5, 0.18, 0.08], [1, 0.3, 0.12], rng))
    y *= np.minimum(1, tt(sec) / 0.001)
    return fade(norm(y, 0.6), 0.0005, 0.1)


# ——— out through the hatch ———
def rung(rng, **_):
    """a boot on a steel ladder rung: a dull clank"""
    sec = 0.5
    y = thump(rng, sec, 130, 1500, 0.03) * 0.7 + partials(sec, [620, 1480, 2330], [0.08, 0.05, 0.03], [0.35, 0.2, 0.1], rng, 0.03)
    return norm(verb(y, room(rng, 0.7, damp=4000), 0.2), 0.7)


def hatch(rng, **_):
    """the escape hatch: two clips knocked back, the heavy lid groaning up and thudding open"""
    sec = 1.6
    y = np.zeros(n_(sec))
    for s in (0.0, 0.12):
        add(y, s, partials(0.3, [900, 2100, 3300], [0.05, 0.03, 0.02], [0.5, 0.3, 0.15], rng, 0.03)
            + bp(white(rng, 0.3), 1500, 8000) * env(0.3, 0.0003, 0.006))
    d = 0.5
    tq = tt(d)
    add(y, 0.25, np.sin(sweep(d, 220, 160) + 2 * np.sin(TAU * 23 * tq)) * np.sin(np.pi * tq / d) * 0.3)
    add(y, 0.7, thump(rng, 0.8, 60, 1200, 0.15) + partials(0.8, [180, 410, 690], [0.4, 0.3, 0.2], [0.3, 0.2, 0.12], rng))
    return norm(verb(y, room(rng, 1.2, damp=3500), 0.3), 0.9)


def rush(rng, dur=1.5, **_):
    """the sea at the open hatch: a roar of water and a burst of air bubbling up past him"""
    dur = D(dur, 0.6)
    t = tt(dur)
    e = np.minimum(1, t / 0.05) * np.exp(-t / (dur * 0.6))
    y = (lp(colored(rng, dur, -3), 700) * 0.7 + bp(colored(rng, dur, -1), 500, 3000) * 0.3) * e
    y += bubble_bed(rng, dur, 60, 200, 900) * (0.4 + 0.6 * e)
    return fade(norm(verb(lp(y, 3500), room(rng, 1.4, damp=2000, width=0.9), 0.3), 0.7), 0.01, 0.3)


def swim(rng, dur=3.0, **_):
    """swimming up: muffled strokes of the arms and the water pressing in on the ears"""
    dur = D(dur, 0.8)
    y = lp(colored(rng, dur, -5), 220) * 0.4
    s = 0.1
    while s < dur - 0.4:
        d = 0.5
        add(y, s, lp(colored(rng, d, -2), 700) * np.sin(np.pi * np.linspace(0, 1, n_(d))) ** 2 * 0.6)
        s += rng.uniform(0.7, 0.9)
    return fade(norm(verb(y, room(rng, 1.5, damp=1200, width=0.9), 0.3), 0.5), 0.2, 0.2)


def exhale(rng, dur=3.0, **_):
    """breathing out all the way up: a steady stream of small bubbles from his mouth"""
    dur = D(dur, 0.8)
    t = tt(dur)
    y = bubble_bed(rng, dur, 40, 500, 1400, 0.015, 0.04)
    y += bp(colored(rng, dur, -2), 200, 800) * (0.5 + 0.5 * np.sin(TAU * 4 * t) ** 2) * 0.15
    return fade(norm(verb(lp(y, 4000), room(rng, 1.0, damp=2500, width=0.8), 0.25), 0.5), 0.15, 0.2)


def splash(rng, **_):
    """his head breaks the surface: the water bursting open, the open air, drops falling back"""
    sec = 1.6
    y = np.zeros(n_(sec))
    add(y, 0.0, whoosh(rng, 0.3, 300, 2500) * 0.5)
    add(y, 0.25, bp(white(rng, 0.6), 400, 7000) * env(0.6, 0.003, 0.12) * 0.9)
    add(y, 0.25, thump(rng, 0.5, 90, 1500, 0.06) * 0.5)
    for _ in range(40):
        s = rng.uniform(0.35, 1.4)
        add(y, s, chirp(rng, rng.uniform(0.01, 0.03), rng.uniform(900, 2400), 1.7) * rng.uniform(0.1, 0.4) * (1.5 - s))
    return fade(norm(verb(y, room(rng, 0.8, damp=6000, width=0.9), 0.2), 0.9), 0.005, 0.2)


def sea_top(rng, dur=4.0, **_):
    """the open sea at the surface: waves slapping close by, a breeze, the swell's slow wash"""
    dur = D(dur, 1.0)
    t = tt(dur)
    y = bp(colored(rng, dur, -2), 200, 2500) * (0.4 + 0.6 * np.sin(TAU * 0.25 * t + 1) ** 2) * 0.5
    y += bp(colored(rng, dur, -1), 500, 2000) * 0.12
    for _ in range(int(dur * 3)):
        add(y, rng.uniform(0, dur - 0.2), bp(white(rng, 0.15), 600, 5000) * env(0.15, 0.003, 0.04) * rng.uniform(0.2, 0.5))
    return fade(norm(verb(y, room(rng, 0.8, damp=6000, width=1.0), 0.2), 0.45), 0.3, 0.3)


def gull(rng, f0):
    """one gull's cry: a nasal «кья» that rises and falls"""
    d = rng.uniform(0.28, 0.4)
    t = tt(d)
    k = t / d
    f = f0 * (0.75 + 0.35 * np.sin(np.pi * np.clip(k * 1.3, 0, 1))) * (1 + 0.02 * np.sin(TAU * 30 * t))
    return bp(harm(np.cumsum(TAU * f / SR), 6, 1.1), 1200, 4500) * np.sin(np.pi * k) ** 0.8


def gulls(rng, dur=3.0, **_):
    """gulls over the open water: a few far cries"""
    dur = D(dur, 1.0)
    y = np.zeros(n_(dur + 0.5))
    s = rng.uniform(0.2, 0.6)
    while s < dur - 0.5:
        f0 = rng.uniform(1500, 2100)
        for j in range(int(rng.integers(2, 4))):
            add(y, s + j * 0.42, gull(rng, f0) * (0.8 - 0.15 * j))
        s += rng.uniform(1.6, 2.6)
    return fade(norm(verb(y, room(rng, 1.4, damp=5000, width=1.0), 0.4), 0.4), 0.05, 0.2)


def pop_word(rng, **_):
    """a title pops in"""
    return pop(rng, 2) * 0.8


def amb_bed(rng, dur=10.0, **_):
    """the bed under the whole short: a dark, still pressure tone"""
    t = tt(dur)
    tone = lp(colored(rng, dur, -4), 300) * 0.5
    swell = bp(colored(rng, dur, -1), 200, 900) * (0.5 + 0.3 * np.sin(TAU * 0.07 * t + np.sin(TAU * 0.03 * t))) * 0.2
    return fade(norm(tone + swell, 0.4), 0.4, 0.5)


FX = {k: v for k, v in globals().items() if callable(v) and k in (
    'deep', 'engine', 'sonar', 'relays', 'creak', 'ribbon', 'scan', 'fan', 'node_off', 'gas', 'clock', 'amb_hull', 'valve',
    'air_blow', 'bubbles', 'rise', 'thud_bed', 'stamp', 'breath', 'cloth', 'locker', 'can_out', 'can_open', 'pour', 'sparkle',
    'knock', 'knock_far', 'whoosh_down', 'ship', 'ding', 'rung', 'hatch', 'rush', 'swim', 'exhale', 'splash', 'sea_top', 'gulls',
    'pop_word')}
FX.update(power_down=power_down, whoosh=whoosh, whoosh_in=whoosh_in, whoosh_up=whoosh_up, blip=blip, click=click, toggle=toggle)
