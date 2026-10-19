# Effects of «Правило №6» that sfx.py does not have, in the same synthesised way (noise through filters, damped partials,
# glides). FX[name](rng, **cue) returns a mono or stereo float array at 48 kHz; names match cues() in src/main.js.
import numpy as np
from sfx import (SR, TAU, n_, tt, lp, hp, bp, peak, white, colored, env, fade, norm, partials, sweep, harm, svf_bp, room, verb,
                 thump, groan, whoosh, whoosh_short, whoosh_in, hiss, pop, slam, swish)


def step(rng, **_):
    """a zombie's slow shuffle on concrete: heel thump, then the sole scuffing"""
    sec = 0.42
    t = tt(sec)
    heel = thump(rng, sec, rng.uniform(62, 78), 700, 0.05)
    scuff = bp(colored(rng, sec, -1), 400, 2600) * np.interp(t, [0, 0.02, 0.07, 0.3, sec], [0, 1, 0.8, 0.15, 0])
    grit = bp(white(rng, sec), 2500, 7000) * (rng.random(n_(sec)) > 0.93) * np.interp(t, [0, 0.05, 0.25, sec], [0, 0.6, 0.1, 0])
    return fade(norm(heel + 0.55 * scuff + 0.25 * grit, 0.9), 0.001, 0.05)


def step_run(rng, **_):
    sec = 0.2
    t = tt(sec)
    heel = thump(rng, sec, rng.uniform(95, 120), 1400, 0.03)
    slap = bp(white(rng, sec), 600, 4000) * env(sec, 0.0008, 0.018)
    return fade(norm(heel + 0.5 * slap, 0.9), 0.0005, 0.03)


def sniff(rng, **_):
    """three short sniffs, the last one long: air pulled in through the nose"""
    out = np.zeros(n_(0.9))
    for s, d, a in [(0.0, 0.11, 0.7), (0.17, 0.11, 0.8), (0.36, 0.34, 1.0)]:
        k = tt(d) / d
        c = svf_bp(colored(rng, d, -1), 1400 + 2200 * k, 1.2) * np.sin(np.pi * k) ** 0.8 * k ** 0.4
        i = n_(s)
        out[i:i + len(c)] += a * c
    return fade(norm(hp(out, 500), 0.75), 0.005, 0.05)


def groan_big(rng, **_):
    """the loom: a long low groan with a wet rattle"""
    y = groan(rng, 1.9, 70)
    t = tt(len(y) / SR)
    gurgle = bp(colored(rng, len(y) / SR, -2), 200, 900) * (0.5 + 0.5 * np.sin(TAU * 17 * t)) * np.sin(np.pi * t / t[-1]) * 0.35
    return fade(norm(y + gurgle[:len(y)], 0.9), 0.04, 0.25)


def pop_word(rng, **_):
    return pop(rng, rng.uniform(1, 3)) * 0.8


def drip(rng, **_):
    """the drool drop: a little rising plink and a wet splat"""
    sec = 0.4
    t = tt(sec)
    plink = np.sin(sweep(sec, 700, 1700)) * env(sec, 0.001, 0.035)
    splat = bp(white(rng, sec), 900, 5000) * env(sec, 0.001, 0.02) * 0.5
    return fade(norm(plink + splat, 0.8), 0.0005, 0.05)


def tail_thump(rng, **_):
    sec = 0.4
    brush = bp(colored(rng, sec, -1), 300, 3000) * env(sec, 0.004, 0.05) * 0.4
    return norm(thump(rng, sec, 85, 450, 0.06) + brush, 0.85)


def eye_shing(rng, **_):
    """the pupils narrow to slits: a thin metallic shing"""
    sec = 0.7
    t = tt(sec)
    ring = partials(sec, [3150, 4410, 5870, 7330], [0.25, 0.18, 0.12, 0.09], [0.6, 0.45, 0.3, 0.2], rng, 0.004)
    ring *= np.minimum(1, t / 0.012) * (1 + 0.25 * np.sin(TAU * 9 * t))
    scrape = bp(white(rng, sec), 4000, 11000) * np.interp(t, [0, 0.01, 0.12, sec], [0, 1, 0.1, 0]) * 0.5
    return fade(norm(verb(ring + scrape, room(rng, 0.6, damp=9000), 0.25), 0.7), 0.002, 0.1)


def pre_hit(rng, **_):
    """a short reversed swell that ends exactly at the hit"""
    return whoosh_in(rng) * 0.9


def clack(rng, **_):
    """the lost arm bouncing on a concrete tread: a hollow, bony knock"""
    sec = 0.3
    y = thump(rng, sec, rng.uniform(170, 210), 2200, 0.025) + partials(sec, [610, 1330, 2240], [0.05, 0.03, 0.02], [0.6, 0.4, 0.25], rng, 0.03)
    return fade(norm(y, 0.85), 0.0005, 0.04)


def grab(rng, **_):
    sec = 0.25
    slap = bp(white(rng, sec), 700, 5000) * env(sec, 0.0005, 0.02)
    return norm(slap + 0.6 * thump(rng, sec, 140, 1200, 0.03), 0.8)


def creak(rng, **_):
    """the door of flat 32 swinging: stick-slip in a hinge, rising in pitch as it speeds up"""
    sec = 0.24
    t = tt(sec)
    rate = np.interp(t, [0, sec], [35, 95])
    ph = np.cumsum(rate) / SR
    pulses = (np.diff(np.floor(ph), prepend=0) > 0).astype(float)
    y = svf_bp(lp(pulses, 6000) + 0.05 * white(rng, sec), np.interp(t, [0, sec], [800, 1500]), 0.12)
    y += 0.4 * svf_bp(lp(pulses, 6000), 2300, 0.15)
    return fade(norm(y * np.sin(np.pi * t / sec) ** 0.5, 0.7), 0.005, 0.03)


def deflate(rng, **_):
    """the fur goes down: a balloon letting its air out, falling in pitch"""
    sec = 0.5
    t = tt(sec)
    k = t / sec
    air = svf_bp(colored(rng, sec, -1), 2600 * (380 / 2600) ** k, 0.5) * (0.6 + 0.4 * np.sin(TAU * 31 * t))
    reed = harm(sweep(sec, 340, 150), 10, 1.0) * 0.12 * np.sin(np.pi * k)
    return fade(norm((air + lp(reed, 2000)) * np.sin(np.pi * np.minimum(1, k * 1.15)) ** 0.6, 0.75), 0.01, 0.06)


def stamp(rng, **_):
    """a big rubber stamp on the wall: a padded thunk, the slap of paper, a short room"""
    sec = 0.6
    y = thump(rng, sec, 68, 1500, 0.08) + 0.6 * bp(white(rng, sec), 900, 6000) * env(sec, 0.0005, 0.012)
    return norm(verb(y, room(rng, 0.45, damp=4000), 0.18), 0.95)


def thud_small(rng, **_):
    sec = 0.35
    y = thump(rng, sec, 150, 1600, 0.035) + partials(sec, [870, 1650], [0.04, 0.025], [0.35, 0.2], rng, 0.02)
    return fade(norm(y, 0.85), 0.0005, 0.04)


def flick(rng, **_):
    """the tail whips the letter up: a short rising whoosh with a tap"""
    y = whoosh(rng, 0.22, 600, 4200)
    tap = thump(rng, 0.1, 260, 3000, 0.012) * 0.6
    y[:len(tap)] += tap
    return norm(y, 0.8)


def lick(rng, **_):
    """the cat licks its paw: a small wet lap"""
    sec = 0.12
    t = tt(sec)
    k = t / sec
    wet = svf_bp(white(rng, sec), 1800 + 1400 * k, 1.4) * np.sin(np.pi * k) ** 1.5
    tick = bp(white(rng, sec), 3000, 9000) * env(sec, 0.0003, 0.003) * 0.4
    return fade(norm(wet + tick, 0.6), 0.002, 0.02)


def purr(rng, dur=2.8, **_):
    """the cat's purr: a low engine-like flutter, louder on the in-breath"""
    t = tt(dur)
    f = 26 + 1.5 * np.sin(TAU * 0.6 * t)
    ph = TAU * np.cumsum(f) / SR
    pulses = np.maximum(0, np.sin(ph)) ** 6
    body = lp(colored(rng, dur, -2), 900) * lp(pulses, 400) + 0.5 * harm(ph * 4.5, 8, 1.4) * lp(pulses, 200)
    breath = 0.65 + 0.35 * np.sin(TAU * 0.75 * t)
    y = hp(body, 70) * breath
    return fade(norm(y, 0.7), 0.25, 0.5)


def blink(rng, **_):
    sec = 0.18
    t = tt(sec)
    y = np.sin(TAU * 2350 * t) * env(sec, 0.002, 0.03) + 0.4 * np.sin(TAU * 3520 * t) * env(sec, 0.002, 0.018)
    return fade(y * 0.5, 0.002, 0.02)


def pop_ui(rng, **_):
    """the comment bubble: a round bloop"""
    sec = 0.16
    y = np.sin(sweep(sec, 320, 980)) * env(sec, 0.003, 0.04)
    return fade(norm(y, 0.7), 0.002, 0.02)


def pop_arm(rng, **_):
    """the arm comes off: a cork-like pop with a rubbery wobble"""
    sec = 0.35
    t = tt(sec)
    cork = pop(rng, -2)
    wob = np.sin(sweep(sec, 260, 140) + 3 * np.sin(TAU * 18 * t)) * env(sec, 0.004, 0.08) * 0.6
    y = wob.copy()
    y[:len(cork)] += cork
    return fade(norm(y, 0.8), 0.001, 0.04)


FX = {k: v for k, v in globals().items() if callable(v) and k in (
    'step', 'step_run', 'sniff', 'groan_big', 'pop_word', 'drip', 'tail_thump', 'eye_shing', 'pre_hit', 'clack', 'grab', 'creak',
    'deflate', 'stamp', 'thud_small', 'flick', 'lick', 'purr', 'blink', 'pop_ui', 'pop_arm')}
FX.update(groan=groan, whoosh=whoosh, whoosh_short=whoosh_short, hiss=hiss, slam=slam, swish=swish)
