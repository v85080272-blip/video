# Effects of «Взрыв на станции, ты дома» (and the lake short they grew from), synthesised like sfx.py (noise through filters, damped partials, glides; no samples).
# FX[name](rng, **cue) returns a mono or stereo float array at 48 kHz; names match cues() in src/main.js.
import numpy as np
from sfx import (SR, TAU, n_, tt, lp, hp, bp, peak, white, colored, env, fade, norm, partials, sweep, harm, svf_bp, room, verb,
                 thump, whoosh, whoosh_short, whoosh_in, pop, swish, splash as splash_small_, water, tick, latch, switch)


def add(y, s, c):
    i = n_(s)
    if i < len(y):
        y[i:i + len(c)] += c[:len(y) - i]


def geiger(rng, dur=20.0, rate=((0, 1.0),), **_):
    """the dosimeter: dry clicks at a random (Poisson) rate that follows the rate keys [[t, clicks per second], …]"""
    keys = np.array(rate, float)
    y = np.zeros(n_(dur))
    s = 0.0
    while s < dur - 0.01:
        r = max(0.05, float(np.interp(s, keys[:, 0], keys[:, 1])))
        s += rng.exponential(1.0 / r)
        if s >= dur - 0.01:
            break
        d = 0.004
        c = bp(white(rng, d), 2000, 9000) * env(d, 0.0002, 0.0012) + 0.5 * partials(d, [3400], [0.0015], [1], rng)
        add(y, s, c * rng.uniform(0.6, 1.0))
    return lp(y, 9500)


def jolt(rng, **_):
    """the crack starts: the dosimeter jumps on its strap, a little plastic knock"""
    sec = 0.25
    y = thump(rng, sec, 220, 3000, 0.02) * 0.6 + partials(sec, [1250, 2600], [0.03, 0.02], [0.4, 0.2], rng)
    return norm(y, 0.7)


def projector(rng, dur=2.0, **_):
    """the film cliché: an old projector's shutter rattling, a motor hum"""
    t = tt(dur)
    y = 0.25 * bp(colored(rng, dur, -1), 200, 1200) * (0.6 + 0.4 * np.sin(TAU * 0.8 * t))
    y += 0.12 * np.sin(TAU * 50 * t) * (1 + np.sin(TAU * 100 * t))
    k = 0.0
    while k < dur - 0.02:
        add(y, k, tick(rng, 1900, 0.02) * 0.45)
        k += 1 / 24
    return fade(norm(y, 0.55), 0.08, 0.08)


def kino_sting(rng, **_):
    """a cheesy sci-fi «glow» chord: a theremin-like wobble rising"""
    sec = 1.6
    t = tt(sec)
    f = 440 * (1 + 0.5 * np.minimum(1, t / 0.6)) * (1 + 0.03 * np.sin(TAU * 6 * t))
    ph = np.cumsum(TAU * f / SR)
    y = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.6 * np.sin(1.5 * ph)
    y *= np.minimum(1, t / 0.15) * np.exp(-np.maximum(0, t - 0.8) / 0.4)
    return fade(norm(verb(y, room(rng, 1.4, damp=5000), 0.35), 0.5), 0.02, 0.2)


def snap(rng, **_):
    """back to the real lake: a film snaps off the reel"""
    sec = 0.3
    y = bp(white(rng, sec), 1500, 8000) * env(sec, 0.0005, 0.02) + 0.5 * np.sin(sweep(sec, 1600, 200)) * env(sec, 0.001, 0.06)
    return norm(y, 0.7)


def creak(rng, **_):
    """the boat creaks and rocks as he stands up"""
    sec = 0.7
    t = tt(sec)
    y = np.sin(sweep(sec, 260, 180) + 3 * np.sin(TAU * 31 * t)) * np.sin(np.pi * t / sec) * 0.4
    y = bp(y + 0.2 * bp(colored(rng, sec, -1), 300, 1500), 150, 2500)
    return fade(norm(y, 0.6), 0.01, 0.1)


def thud(rng, **_):
    """landing: on the bench, on the shore"""
    sec = 0.5
    y = thump(rng, sec, 75, 500, 0.1) + 0.35 * bp(colored(rng, sec, -1), 400, 3000) * env(sec, 0.002, 0.05)
    return norm(y, 0.9)


def bubbles(rng, dur=1.5, **_):
    """swimming and gulping: water and rising bubbles"""
    y = water(rng, max(0.6, dur)) * 0.7
    for _ in range(int(dur * 12)):
        s = rng.uniform(0, dur - 0.08)
        f0 = rng.uniform(250, 600)
        d = rng.uniform(0.04, 0.08)
        add(y, s, np.sin(sweep(d, f0, f0 * 2.2)) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.5)
    return fade(norm(lp(y, 6000), 0.6), 0.05, 0.15)


def plop(rng, **_):
    """the float dips: a bite"""
    sec = 0.3
    y = np.sin(sweep(0.06, 900, 300)) * env(0.06, 0.001, 0.02)
    y = np.pad(y, (0, n_(sec) - len(y))) + 0.3 * bp(white(rng, sec), 800, 4000) * env(sec, 0.002, 0.04)
    return norm(y, 0.6)


def reel(rng, dur=0.8, **_):
    """pulling the fish in: the pole creaks, the line hisses through the water"""
    t = tt(dur)
    y = 0.4 * bp(white(rng, dur), 3000, 8000) * np.sin(np.pi * t / dur)
    y += 0.3 * np.sin(sweep(dur, 300, 420) + 2 * np.sin(TAU * 17 * t)) * np.sin(np.pi * t / dur)
    return fade(norm(y, 0.5), 0.02, 0.05)


def splash_small(rng, **_):
    return splash_small_(rng) * 0.7


def flop(rng, dur=1.0, **_):
    """the fish flaps on the line: wet slaps"""
    y = np.zeros(n_(dur))
    k = 0.0
    while k < dur - 0.06:
        d = 0.05
        c = bp(white(rng, d), 800, 5000) * env(d, 0.0008, 0.012) + 0.4 * thump(rng, d, 200, 2000, 0.01)
        add(y, k, c * rng.uniform(0.5, 1))
        k += rng.uniform(0.1, 0.2)
    return norm(y, 0.6)


def splash(rng, **_):
    """the fish back in the water, a bigger splash"""
    sec = 0.9
    y = bp(white(rng, sec), 400, 6000) * env(sec, 0.002, 0.12) + 0.5 * thump(rng, sec, 90, 800, 0.06)
    for _ in range(14):
        d = rng.uniform(0.01, 0.03)
        add(y, rng.uniform(0.03, 0.6), np.sin(sweep(d, rng.uniform(800, 1800), rng.uniform(1800, 3200))) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.35)
    return fade(norm(verb(y, room(rng, 0.6), 0.15), 0.8), 0.001, 0.1)


def oar(rng, **_):
    """one stroke: the blade bites the water, the oarlock knocks"""
    sec = 0.6
    t = tt(sec)
    y = bp(colored(rng, sec, -1), 300, 3000) * np.sin(np.pi * np.minimum(1, t / 0.4)) ** 2 * 0.6
    add(y, 0.0, partials(0.12, [520, 1180], [0.03, 0.02], [0.4, 0.2], rng) + 0.4 * thump(rng, 0.12, 160, 2000, 0.02))
    return fade(norm(y, 0.7), 0.002, 0.1)


def marker(rng, dur=0.4, **_):
    """an arrow drawn on the picture: a felt-tip squeak"""
    t = tt(dur)
    y = bp(white(rng, dur), 1800, 5000) * (0.5 + 0.5 * np.sin(TAU * 32 * t)) + 0.2 * np.sin(sweep(dur, 1500, 1900))
    return fade(norm(y * np.sin(np.pi * t / dur) ** 0.6, 0.45), 0.01, 0.04)


def bump(rng, **_):
    """the boat runs onto the shore: a wooden knock and a scrape on sand"""
    sec = 0.7
    y = thump(rng, sec, 95, 900, 0.07) + 0.4 * bp(colored(rng, sec, -1), 500, 4000) * env(sec, 0.01, 0.25)
    return fade(norm(y, 0.85), 0.001, 0.1)


def step(rng, **_):
    """a boot on grass and sand: a dull thump and a short rustle"""
    sec = 0.22
    heel = thump(rng, sec, rng.uniform(85, 110), 900, 0.03)
    rustle = bp(colored(rng, sec, -1), 1500, 6000) * env(sec, 0.002, 0.04)
    return fade(norm(heel + 0.5 * rustle, 0.8), 0.0005, 0.03)


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


def cloth(rng, **_):
    return swish(rng) * 0.8


def bag(rng, **_):
    """into the plastic bag: a crinkly rustle with a soft thump"""
    sec = 0.6
    t = tt(sec)
    crk = bp(white(rng, sec), 2500, 9000) * (0.4 + 0.6 * (rng.random(n_(sec)) > 0.985)) * env(sec, 0.005, 0.2)
    y = 0.7 * lp(crk, 9000) + 0.6 * thump(rng, sec, 80, 600, 0.08)
    return fade(norm(y, 0.7), 0.002, 0.1)


def shower(rng, dur=4.0, **_):
    """the summer shower: water from the barrel pattering on wood and on his head"""
    t = tt(dur)
    x = colored(rng, dur, -1)
    y = bp(x, 1500, 7000) * 0.5 + bp(x, 300, 1200) * 0.25
    y *= 1 + 0.15 * np.sin(TAU * 0.7 * t)
    for _ in range(int(dur * 40)):
        s = rng.uniform(0, dur - 0.02)
        add(y, s, bp(white(rng, 0.01), 2000, 6000) * env(0.01, 0.0005, 0.003) * rng.uniform(0.2, 0.6))
    return fade(norm(lp(y, 9000), 0.5), 0.15, 0.4)


def squish(rng, dur=1.0, **_):
    """scrubbing the foam: soft squelchy rubs"""
    t = tt(dur)
    y = svf_bp(colored(rng, dur, -1), 900 + 500 * np.sin(TAU * 2.6 * t), 1.5) * (0.5 + 0.5 * np.abs(np.sin(TAU * 2.6 * t)))
    return fade(norm(y, 0.5), 0.05, 0.1)


def clatter(rng, **_):
    """the conditioner bottle falls off the shelf: a plastic bounce"""
    sec = 0.7
    y = np.zeros(n_(sec))
    for s, a in [(0.0, 1.0), (0.18, 0.5), (0.3, 0.25)]:
        add(y, s, (partials(0.1, [900, 1500, 2300], [0.02, 0.015, 0.01], [0.5, 0.3, 0.2], rng) + 0.4 * thump(rng, 0.1, 180, 2500, 0.02)) * a)
    return norm(y, 0.7)


def amb_lake(rng, dur=10.0, **_):
    """the bed: water lapping, a light wind, a far bird now and then"""
    t = tt(dur)
    x = colored(rng, dur, -2)
    lap = bp(x, 200, 900) * (0.5 + 0.5 * np.sin(TAU * 0.35 * t + np.sin(TAU * 0.11 * t))) * 0.6
    wind = bp(colored(rng, dur, -1), 600, 2500) * (0.5 + 0.3 * np.sin(TAU * 0.09 * t)) * 0.25
    y = lap + wind
    s = 1.0
    while s < dur - 1.0:
        f0 = rng.uniform(2200, 3200)
        for k in range(rng.integers(2, 4)):
            d = 0.12
            add(y, s + k * 0.16, np.sin(sweep(d, f0, f0 * 1.25)) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.12)
        s += rng.uniform(2.5, 5.0)
    return fade(norm(verb(y, room(rng, 1.4, damp=4000, width=0.9), 0.3), 0.4), 0.4, 0.5)


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


def boom(rng, **_):
    """the plant blows up a few kilometres away: a deep rolling blast and the rumble that follows, dull through the walls"""
    sec = 3.4
    t = tt(sec)
    sub = np.sin(sweep(sec, 62, 26)) * np.exp(-t / 0.9)
    body = lp(colored(rng, sec, -6), 260) * (np.minimum(1, t / 0.015) * np.exp(-t / 0.5)) * 0.9
    roll = lp(colored(rng, sec, -4), 180) * np.exp(-t / 1.4) * np.minimum(1, t / 0.3) * 0.5
    crack = lp(hp(white(rng, sec), 300), 2500) * env(sec, 0.002, 0.06) * 0.35
    y = sub + body + roll + crack
    return fade(norm(verb(y, room(rng, 2.6, damp=1800, width=0.9), 0.4), 0.95), 0.001, 0.4)


def rattle(rng, dur=1.2, **_):
    """the shock wave shakes the window: glass buzzing in its frame, dying away"""
    t = tt(dur)
    y = np.zeros(n_(dur))
    k = 0.0
    while k < dur - 0.03:
        a = np.exp(-k / 0.35)
        add(y, k, (partials(0.03, [2100 + rng.uniform(-150, 150), 3300, 4700], [0.012, 0.008, 0.005], [0.5, 0.3, 0.2], rng)
                   + 0.3 * bp(white(rng, 0.03), 900, 3000) * env(0.03, 0.0005, 0.006)) * a)
        k += rng.uniform(0.018, 0.035)
    return fade(norm(y, 0.6), 0.001, 0.1)


def phone_beep(rng, **_):
    """the phone's camera opens: a soft two-note blip"""
    sec = 0.3
    y = np.zeros(n_(sec))
    for s, f in [(0.0, 1568.0), (0.09, 2093.0)]:
        d = 0.08
        add(y, s, np.sin(TAU * f * tt(d)) * env(d, 0.003, 0.03))
    return norm(y, 0.45)


def wind(rng, dur=3.0, **_):
    """outside: a gusty wind, whistling a little"""
    t = tt(dur)
    x = colored(rng, dur, -1)
    gust = 0.55 + 0.45 * np.sin(TAU * 0.45 * t + 1.5 * np.sin(TAU * 0.17 * t))
    y = svf_bp(x, 500 + 700 * gust, 1.2) * gust + 0.25 * bp(colored(rng, dur, -2), 120, 500)
    return fade(norm(y, 0.6), 0.25, 0.4)


def window_slam(rng, **_):
    """the two window leaves slammed shut: wood on wood, the glass rings"""
    sec = 0.7
    y = thump(rng, sec, 140, 2000, 0.04) + 0.5 * bp(white(rng, sec), 600, 4000) * env(sec, 0.0008, 0.02)
    y += partials(sec, [2400, 3700, 5100], [0.08, 0.05, 0.03], [0.25, 0.15, 0.1], rng)
    return norm(verb(y, room(rng, 0.45), 0.15), 0.85)


def slam(rng, **_):
    """the plank door slams in its frame"""
    sec = 0.9
    y = thump(rng, sec, 90, 1200, 0.09) + 0.5 * bp(white(rng, sec), 300, 3000) * env(sec, 0.001, 0.03)
    y += 0.3 * partials(sec, [210, 330, 520], [0.12, 0.09, 0.06], [0.5, 0.3, 0.2], rng)
    return norm(verb(y, room(rng, 0.6, damp=3500), 0.2), 0.9)


def bolt(rng, **_):
    """the iron bolt slides home"""
    return latch(rng)


def clank(rng, **_):
    """the iron damper set over the stove's mouth: a dull iron clank and a scrape"""
    sec = 0.8
    y = partials(sec, [310, 487, 731, 1043, 1520], [0.25, 0.18, 0.12, 0.08, 0.05], [0.5, 0.4, 0.3, 0.2, 0.1], rng, 0.01)
    y = y * np.minimum(1, tt(sec) / 0.001) + 0.4 * thump(rng, sec, 120, 1500, 0.04)
    y += 0.25 * bp(white(rng, sec), 1500, 5000) * env(sec, 0.002, 0.06)
    return norm(verb(y, room(rng, 0.5), 0.15), 0.8)


def fan(rng, dur=2.0, off=1.0, **_):
    """the vent fan whirs, then spins down after the switch at `off`"""
    t = tt(dur)
    sp = np.where(t < off, 1.0, np.exp(-(t - off) / 0.45))
    ph = np.cumsum(TAU * 47 * sp / SR)
    y = 0.4 * np.sin(ph) + 0.2 * np.sin(2 * ph) + 0.12 * np.sin(4 * ph)
    y += 0.35 * svf_bp(colored(rng, dur, -1), 400 + 900 * sp, 2.0) * sp
    return fade(norm(y, 0.5), 0.2, 0.1)


def ticks(rng, dur=1.0, **_):
    """dust ticking on the shut glass: tiny dry taps"""
    y = np.zeros(n_(dur))
    for _ in range(int(dur * 9)):
        add(y, rng.uniform(0, dur - 0.02), bp(white(rng, 0.01), 3000, 9000) * env(0.01, 0.0002, 0.002) * rng.uniform(0.3, 1))
    return fade(norm(y, 0.4), 0.05, 0.1)


def hatch(rng, **_):
    """the cellar hatch lifted: a wooden creak and the lid knocking back"""
    sec = 0.9
    t = tt(sec)
    cr = np.sin(sweep(0.5, 330, 220) + 3 * np.sin(TAU * 27 * tt(0.5))) * np.sin(np.pi * tt(0.5) / 0.5) * 0.35
    y = np.zeros(n_(sec))
    add(y, 0.0, bp(cr, 150, 2500))
    add(y, 0.45, thump(rng, 0.4, 110, 1400, 0.05) * 0.8)
    return fade(norm(y, 0.7), 0.005, 0.1)


def ladder(rng, **_):
    """a boot on a wooden rung: a knock and a short creak"""
    sec = 0.3
    y = thump(rng, sec, rng.uniform(150, 190), 1500, 0.03) + 0.3 * np.sin(sweep(sec, 420, 300)) * env(sec, 0.01, 0.06)
    return fade(norm(y, 0.6), 0.001, 0.05)


def slosh(rng, **_):
    """water sloshing in the plastic bottle as he lifts it"""
    sec = 0.6
    t = tt(sec)
    y = svf_bp(colored(rng, sec, -1), 500 + 400 * np.sin(TAU * 4 * t), 2.5) * np.sin(np.pi * t / sec) + 0.3 * thump(rng, sec, 160, 1200, 0.03)
    return fade(norm(y, 0.55), 0.01, 0.08)


def jar(rng, **_):
    """a glass jar on the shelf: a bright clink"""
    sec = 0.6
    y = partials(sec, [1850, 2950, 4400], [0.12, 0.08, 0.05], [0.6, 0.35, 0.2], rng, 0.02) + 0.2 * bp(white(rng, sec), 2000, 7000) * env(sec, 0.0005, 0.005)
    return norm(y, 0.55)


def clink(rng, **_):
    """the little iodine bottle picked up or put down"""
    sec = 0.4
    y = partials(sec, [2600, 4100], [0.06, 0.04], [0.5, 0.3], rng, 0.02) + 0.3 * thump(rng, sec, 300, 3000, 0.01)
    return norm(y, 0.5)


def pills(rng, **_):
    """a blister pack shaken: a dry plastic rattle"""
    sec = 0.5
    y = np.zeros(n_(sec))
    for _ in range(14):
        add(y, rng.uniform(0, 0.4), bp(white(rng, 0.015), 2500, 8000) * env(0.015, 0.0003, 0.003) * rng.uniform(0.4, 1))
    return fade(norm(y, 0.5), 0.005, 0.05)


def radio(rng, dur=4.0, **_):
    """the radio comes on: a tuning squeal through static that settles to a steady signal hum, low under everything"""
    t = tt(dur)
    tune = np.clip(t / 0.7, 0, 1)
    st = bp(white(rng, dur), 800, 5000) * (1 - 0.75 * tune)
    sq = np.sin(np.cumsum(TAU * (2200 - 1500 * tune) / SR)) * 0.25 * np.exp(-t / 0.4)
    carrier = 0.15 * bp(colored(rng, dur, -1), 300, 2500) * tune
    y = st * 0.5 + sq + carrier
    return fade(norm(y, 0.4), 0.02, 0.4)


def clock(rng, dur=1.6, **_):
    """the hands spin round a whole day: fast ticks slowing to a stop and a small bell"""
    y = np.zeros(n_(dur + 0.8))
    s, gap = 0.0, 0.04
    while s < dur:
        add(y, s, tick(rng, 3200, 0.04) * 0.6)
        s += gap
        gap *= 1.08
    add(y, dur, partials(0.8, [1760, 2640], [0.3, 0.2], [0.5, 0.25], rng))
    return fade(norm(y, 0.55), 0.001, 0.1)


def amb_house(rng, dur=10.0, **_):
    """the bed: a quiet room tone, a faint wind outside the walls"""
    t = tt(dur)
    tone = lp(colored(rng, dur, -2), 400) * 0.5
    wind_ = bp(colored(rng, dur, -1), 300, 1400) * (0.5 + 0.3 * np.sin(TAU * 0.11 * t + np.sin(TAU * 0.05 * t))) * 0.3
    return fade(norm(tone + wind_, 0.4), 0.4, 0.5)


FX = {k: v for k, v in globals().items() if callable(v) and k in (
    'geiger', 'jolt', 'projector', 'kino_sting', 'snap', 'creak', 'thud', 'bubbles', 'plop', 'reel', 'splash_small', 'flop', 'splash',
    'oar', 'marker', 'bump', 'step', 'stamp', 'ding', 'pop_word', 'cloth', 'bag', 'shower', 'squish', 'clatter')}
FX.update(whoosh=whoosh, whoosh_short=whoosh_short, whoosh_in=whoosh_in, switch=switch, birds=birds, boom=boom, rattle=rattle,
          phone_beep=phone_beep, wind=wind, window_slam=window_slam, slam=slam, bolt=bolt, clank=clank, fan=fan, ticks=ticks,
          hatch=hatch, ladder=ladder, slosh=slosh, jar=jar, clink=clink, pills=pills, radio=radio, clock=clock)
