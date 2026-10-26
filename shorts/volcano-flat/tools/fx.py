# Effects of «Вулкан проснулся», synthesised like sfx.py (noise through filters, damped partials, glides; no samples).
# FX[name](rng, **cue) returns a mono or stereo float array at 48 kHz; names match cues() in src/main.js.
import numpy as np
from sfx import (SR, TAU, n_, tt, lp, hp, bp, peak, white, colored, env, fade, norm, partials, sweep, harm, svf_bp, room, verb,
                 thump, boom, whoosh, whoosh_short, whoosh_in, pop, slam as slam_big, swish, latch, splash, water, beep, clunk, tick)


def add(y, s, c):
    i = n_(s)
    if i < len(y):
        y[i:i + len(c)] += c[:len(y) - i]


def rumble(rng, sec=4.0, **_):
    """the ground after the blast: deep brown noise that swells and rolls away"""
    t = tt(sec)
    x = lp(colored(rng, sec, -6), 140) + 0.25 * bp(colored(rng, sec, -3), 150, 500)
    roll = 1 + 0.35 * np.sin(TAU * 1.7 * t + 2 * np.sin(TAU * 0.6 * t))
    e = np.minimum(1, t / 0.25) * np.exp(-t / (0.4 * sec))
    return fade(norm(x * roll * e, 0.85), 0.02, 0.4)


def eruption(rng, **_):
    """the volcano blows: the boom, then rocks and lava popping in the rumble"""
    y = boom(rng, 1.4)
    r = rumble(rng, 4.0)
    out = np.zeros((2, max(y.shape[1], len(r) + n_(0.15))))
    out[:, :y.shape[1]] += y
    out[:, n_(0.15):n_(0.15) + len(r)] += 0.7 * r
    for _ in range(14):
        s, d = rng.uniform(0.3, 3.2), rng.uniform(0.02, 0.06)
        c = bp(white(rng, d), 300, 3000) * env(d, 0.001, d / 3) * rng.uniform(0.15, 0.4)
        i = n_(s)
        out[:, i:i + len(c)] += c[:out.shape[1] - i]
    return norm(out, 0.95)


def crackle(rng, sec=0.5, **_):
    """lightning inside the cloud, far off: dry electric crackles"""
    y = np.zeros(n_(sec))
    s = 0.0
    while s < sec - 0.05:
        d = rng.uniform(0.004, 0.02)
        add(y, s, bp(white(rng, d), 1500, 7000) * rng.uniform(0.3, 1.0))
        s += rng.uniform(0.006, 0.05)
    y = lp(y, 5000) + 0.4 * lp(colored(rng, sec, -6), 200) * env(sec, 0.01, 0.2)
    return fade(norm(verb(y, room(rng, 1.4, damp=3000), 0.4), 0.6), 0.002, 0.1)


def thunder_far(rng, sec=3.0, **_):
    """a ground strike a few kilometres away: a soft crack, then a long rolling rumble"""
    t = tt(sec)
    crack = hp(white(rng, sec), 800) * env(sec, 0.001, 0.02) * 0.4
    body = lp(colored(rng, sec, -6), 260) * np.minimum(1, t / 0.08) * np.exp(-t / 0.9)
    roll = 1 + 0.5 * np.abs(np.sin(TAU * 2.3 * t + rng.uniform(0, 6))) * np.exp(-t / 1.4)
    y = crack + body * roll
    return fade(norm(verb(y, room(rng, 2.6, damp=1800, width=0.9), 0.5), 0.9), 0.002, 0.4)


def thunder_hit(rng, **_):
    """the bolt hits the tower right above him: a tearing crack, a blast and the thunder rolling off: the one scare"""
    sec = 3.4
    t = tt(sec)
    tear = np.zeros(n_(sec))
    s = 0.0
    while s < 0.09:                                                  # the stroke tears the air: a burst of snaps
        d = rng.uniform(0.002, 0.008)
        add(tear, s, hp(white(rng, d), 2500) * rng.uniform(0.6, 1.0))
        s += rng.uniform(0.002, 0.01)
    crack = hp(white(rng, sec), 300) * env(sec, 0.0005, 0.03)
    sub = np.sin(sweep(sec, 90, 30)) * np.exp(-t / 0.6)
    body = lp(colored(rng, sec, -6), 400) * np.minimum(1, t / 0.01) * np.exp(-t / 0.7)
    roll = lp(colored(rng, sec, -6), 220) * np.clip((t - 0.3) / 0.3, 0, 1) * np.exp(-np.maximum(0, t - 0.6) / 1.0) * (1 + 0.5 * np.sin(TAU * 1.9 * t))
    y = 1.2 * tear + 0.9 * crack + sub + 0.8 * body + 0.7 * roll
    return fade(norm(verb(y, room(rng, 2.2, damp=3000, width=0.9), 0.35), 0.98), 0.0005, 0.3)


def step(rng, **_):
    """a boot on grass and gravel: a dull thump and a short rustle"""
    sec = 0.22
    heel = thump(rng, sec, rng.uniform(85, 110), 900, 0.03)
    rustle = bp(colored(rng, sec, -1), 1500, 6000) * env(sec, 0.002, 0.04)
    return fade(norm(heel + 0.5 * rustle, 0.8), 0.0005, 0.03)


def ladder(rng, dur=0.8, **_):
    """sliding down the ladder: hands squeaking on the rails, boots knocking every rung"""
    t = tt(dur)
    rub = bp(colored(rng, dur, -1), 500, 2500) * (0.5 + 0.5 * np.abs(np.sin(TAU * 7 * t))) * 0.35
    y = rub * np.minimum(1, t / 0.05)
    k = 0.0
    while k < dur - 0.06:
        add(y, k, thump(rng, 0.12, rng.uniform(150, 190), 2500, 0.02) * 0.8 + partials(0.12, [620, 1310], [0.03, 0.02], [0.3, 0.15], rng))
        k += 0.11
    return fade(norm(verb(y, room(rng, 0.5), 0.15), 0.8), 0.01, 0.05)


def thud(rng, **_):
    """landing on the ground off the ladder"""
    sec = 0.6
    y = thump(rng, sec, 70, 500, 0.12) + 0.4 * bp(colored(rng, sec, -1), 400, 3000) * env(sec, 0.002, 0.06)
    return norm(y, 0.9)


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
    """a step title pops in"""
    return pop(rng, 2) * 0.8


def lock(rng, **_):
    """the crosshair locks on the tower: two quick high beeps"""
    sec = 0.32
    y = np.zeros(n_(sec))
    for s in (0.0, 0.14):
        add(y, s, beep(rng, 0.09))
    return norm(y, 0.6)


def phone(rng, **_):
    """the camera app opens: a soft click"""
    sec = 0.12
    y = bp(white(rng, sec), 2500, 8000) * env(sec, 0.0003, 0.004) + 0.4 * partials(sec, [2200, 3300], [0.01, 0.006], [1, 0.5], rng)
    return norm(y, 0.6)


def gust(rng, sec=3.0, **_):
    """the wind picks up: a hollow, rising and falling howl"""
    t = tt(sec)
    k = t / sec
    x = colored(rng, sec, -2)
    fc = 350 + 500 * np.sin(np.pi * k) ** 2 + 120 * np.sin(TAU * 0.9 * t)
    y = svf_bp(x, fc, 0.25) * 0.6 + 0.3 * bp(x, 2000, 6000) * np.sin(np.pi * k)
    return fade(norm(y * np.sin(np.pi * k) ** 0.8, 0.7), 0.1, 0.3)


def paper(rng, **_):
    """the map card flies in: a paper flutter"""
    sec = 0.4
    t = tt(sec)
    y = bp(colored(rng, sec, -1), 1200, 6000) * (0.4 + 0.6 * np.abs(np.sin(TAU * 26 * t))) * np.sin(np.pi * t / sec) ** 1.5
    return fade(norm(y, 0.6), 0.005, 0.05)


def marker(rng, dur=0.4, **_):
    """an arrow drawn on the map: a felt-tip squeak"""
    t = tt(dur)
    y = bp(white(rng, dur), 1800, 5000) * (0.5 + 0.5 * np.sin(TAU * 32 * t)) + 0.2 * np.sin(sweep(dur, 1500, 1900))
    return fade(norm(y * np.sin(np.pi * t / dur) ** 0.6, 0.45), 0.01, 0.04)


def lahar(rng, dur=4.0, **_):
    """the mudflow: a heavy roar with stones knocking and logs cracking inside it, rising as it comes"""
    t = tt(dur)
    roar = lp(colored(rng, dur, -6), 300) + 0.5 * bp(colored(rng, dur, -3), 250, 1200) + 0.15 * bp(white(rng, dur), 1500, 4000)
    e = np.clip(t / 0.6, 0, 1) ** 1.5 * np.minimum(1, (dur - t) / 0.8)
    y = roar * e * (1 + 0.25 * np.sin(TAU * 3.1 * t))
    for _ in range(int(dur * 9)):
        s = rng.uniform(0.2, dur - 0.3)
        c = thump(rng, 0.15, rng.uniform(120, 260), 2500, 0.025) * rng.uniform(0.3, 0.8)
        c += partials(0.15, [rng.uniform(700, 1400)], [0.02], [0.3], rng)
        add(y, s, c * np.interp(s, [0, 0.6, dur], [0.2, 1, 0.6]))
    return fade(norm(verb(y, room(rng, 1.2, damp=3000, width=0.8), 0.25), 0.9), 0.05, 0.3)


def crunch(rng, **_):
    """the boat is smashed: wood cracking and a splash of mud"""
    sec = 0.8
    y = np.zeros(n_(sec))
    for _ in range(7):
        add(y, rng.uniform(0, 0.15), partials(0.2, [rng.uniform(300, 900), rng.uniform(1000, 2000)], [0.03, 0.02], [0.6, 0.3], rng)
            + bp(white(rng, 0.2), 600, 4000) * env(0.2, 0.0005, 0.01))
    y += thump(rng, sec, 90, 800, 0.08) * 0.8
    s = splash(rng)
    add(y, 0.05, lp(s, 2500) * 0.8)
    return norm(y, 0.9)


def glass(rng, **_):
    """the magnifier shows the ash: glassy tinkles, sharp and high"""
    sec = 1.2
    y = np.zeros(n_(sec))
    for i in range(9):
        f = rng.uniform(2800, 6000)
        add(y, i * 0.05 + rng.uniform(0, 0.03), partials(0.5, [f, f * 2.3], [0.12, 0.05], [0.4, 0.15], rng))
    y += 0.3 * bp(white(rng, sec), 4000, 9000) * env(sec, 0.002, 0.05)
    return fade(norm(verb(y, room(rng, 0.8, damp=8000), 0.3), 0.5), 0.001, 0.2)


def pour(rng, dur=1.0, **_):
    """water from the flask onto the scarf"""
    y = water(rng, max(0.5, dur))
    return fade(norm(hp(y, 300), 0.6), 0.05, 0.15)


def cloth(rng, **_):
    return swish(rng) * 0.8


def glasses(rng, **_):
    """the goggles snap on"""
    sec = 0.15
    y = bp(white(rng, sec), 1500, 7000) * env(sec, 0.0003, 0.006) + 0.5 * partials(sec, [1900, 3100], [0.015, 0.01], [1, 0.5], rng)
    return norm(y, 0.6)


def door(rng, **_):
    """the UAZ door opens: the handle clacks, the hinge groans"""
    sec = 0.7
    y = np.zeros(n_(sec))
    add(y, 0.0, latch(rng)[:n_(0.4)])
    t = tt(0.4)
    hinge = np.sin(sweep(0.4, 420, 300) + 2 * np.sin(TAU * 21 * t)) * np.sin(np.pi * t / 0.4) * 0.25
    add(y, 0.2, bp(hinge, 200, 2000))
    return fade(norm(y, 0.8), 0.001, 0.05)


def slam(rng, **_):
    """the door slams shut: a car door, not a steel bunker"""
    sec = 1.2
    t = tt(sec)
    y = np.sin(sweep(sec, 110, 55)) * np.exp(-t / 0.18) + 0.8 * lp(white(rng, sec), 2500) * env(sec, 0.0008, 0.03)
    y += 0.35 * partials(sec, [240, 390, 610, 880], [0.25, 0.2, 0.15, 0.1], [0.5, 0.35, 0.25, 0.15], rng, 0.01)
    add(y, 0.06, latch(rng)[n_(0.3):n_(0.38)] * 0.6)
    return norm(verb(y, room(rng, 0.6, damp=4000), 0.15), 0.95)


def crank(rng, dur=0.9, **_):
    """winding the window up: a ratchet ticking, the glass sliding"""
    y = bp(colored(rng, dur, -1), 600, 3000) * 0.15 * np.sin(np.pi * tt(dur) / dur)
    k = 0.0
    while k < dur - 0.03:
        add(y, k, tick(rng, 2600, 0.03) * 0.5)
        k += 0.055
    return fade(norm(y, 0.6), 0.005, 0.05)


def lamp(rng, **_):
    """the hut's lamp comes on: a soft click and a warm hum"""
    sec = 0.6
    t = tt(sec)
    y = tick(rng, 1800, 0.05)
    y = np.pad(y, (0, n_(sec) - len(y)))
    y += 0.15 * sum(np.sin(TAU * 100 * h * t) / h for h in range(1, 5)) * np.minimum(1, t / 0.05) * np.exp(-t / 0.3)
    return norm(y, 0.5)


def amb_volcano(rng, dur=10.0, **_):
    """the bed: the mountain rumbling far off, wind over the slope, ash hissing down"""
    t = tt(dur)
    rum = lp(colored(rng, dur, -6), 120) * (1 + 0.3 * np.sin(TAU * 0.21 * t + 1))
    x = colored(rng, dur, -2)
    wind = bp(x, 300, 900) * (0.6 + 0.4 * np.sin(TAU * 0.13 * t)) * 0.5
    ash = bp(white(rng, dur), 5000, 10000) * 0.05
    y = rum + wind + ash
    return fade(norm(verb(y, room(rng, 1.6, damp=2500, width=0.9), 0.3), 0.4), 0.4, 0.5)


FX = {k: v for k, v in globals().items() if callable(v) and k in (
    'rumble', 'eruption', 'crackle', 'thunder_far', 'thunder_hit', 'step', 'ladder', 'thud', 'stamp', 'ding', 'pop_word', 'lock',
    'phone', 'gust', 'paper', 'marker', 'lahar', 'crunch', 'glass', 'pour', 'cloth', 'glasses', 'door', 'slam', 'crank', 'lamp')}
FX.update(whoosh=whoosh, whoosh_short=whoosh_short, whoosh_in=whoosh_in)
