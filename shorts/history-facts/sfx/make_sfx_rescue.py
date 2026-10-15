#!/usr/bin/env python3
"""
make_sfx_rescue.py -- original sound kit for the rescue episodes of «Тайны истории» (№4 the Thai cave 2018,
№5 the night on Everest 2006).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). Music at 70 bpm in A minor
(Am - F - C - G, 4-bar loops): a dark synth pulse, a soft felt-piano arpeggio, a warm string pad and big
cinematic drums for the rescue. The cave: water drops in a big cave, rushing flood water, monsoon rain,
underwater rumble with bubbles, thunder, a diver's regulator breath, a pump dying. The mountain: high-altitude
wind, breathing in an oxygen mask, crampon steps on snow, a radio burst, a house phone ringing.
Loops are built on a circular time grid (events and reverb tails wrap around) or rendered long and cross-faded,
so they repeat without a seam.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in ./rescue/
Usage:   python3 make_sfx_rescue.py [--only piano_sad,cave_drips]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, env_ad, phase_of, softclip, pan, widen, mono_bass, make_ir,
                      reverb, sound, colored, smooth_rand, gust_curve, place, rms, loop_buffer, loopify, crackle_click)
from make_sfx_dance import put_wrap, creverb, cfilt, norm1, attack, drum, int_cycles

BPM = 70.0
BEAT = 60.0 / BPM            # 0.857 s
E8 = BEAT / 2
BAR = 4 * BEAT
LOOP = 4 * BAR               # 13.71 s, every music loop is 4 bars
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rescue')
NEW = []


def osound(name, *a, **k):
    """register like make_sfx.sound, padding a one-shot whose tail ends early to its full length"""
    NEW.append(name)
    deco = sound(name, *a, **k)

    def reg(fn):
        def padded(nm, D):
            out = fn(nm, D)
            x = B.st(out['x'])
            out['x'] = np.pad(x, ((0, 0), (0, max(0, ns(D) - x.shape[1]))))
            return out
        deco(padded)
        return fn
    return reg


def hall_ir(name, k, rt=2.4):
    return make_ir(rt, 0.6 * rt, rng_for(name, k), predelay=0.03, er=10, er_span=0.1, lo_cut=60, hi_cut=6000)


def cave_ir(name, k, rt=4.5):
    """a big wet limestone chamber: long, dark, lots of early reflections"""
    return make_ir(rt, 0.45 * rt, rng_for(name, k), predelay=0.04, er=14, er_span=0.18, lo_cut=80, hi_cut=4500)


def room_ir(name, k, rt=0.5):
    return make_ir(rt, 0.7 * rt, rng_for(name, k), predelay=0.006, er=8, er_span=0.03, lo_cut=100, hi_cut=9000)


# ----------------------------------------------------------------------------
# notes and instruments
# ----------------------------------------------------------------------------
def hz(note):
    names = {'C': -9, 'C#': -8, 'D': -7, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'Ab': -1, 'A': 0, 'Bb': 1, 'B': 2}
    return 440.0 * 2 ** ((names[note[:-1]] + 12 * (int(note[-1]) - 4)) / 12)


# Am - F - C - G: a bass note per bar and a broken chord in eighths for the piano
PROG = [('A2', ['A3', 'E4', 'A4', 'B4', 'C5', 'B4', 'A4', 'E4'], ['A3', 'C4', 'E4', 'A4']),
        ('F2', ['F3', 'C4', 'F4', 'G4', 'A4', 'G4', 'F4', 'C4'], ['F3', 'A3', 'C4', 'F4']),
        ('C3', ['C4', 'G4', 'C5', 'D5', 'E5', 'D5', 'C5', 'G4'], ['G3', 'C4', 'E4', 'G4']),
        ('G2', ['G3', 'D4', 'G4', 'A4', 'B4', 'A4', 'G4', 'D4'], ['G3', 'B3', 'D4', 'G4'])]


def piano(rng, f, vel=0.8, dur=4.0):
    """felt piano: three slightly detuned strings, stretched partials, two-stage decay, soft hammer"""
    n = ns(dur)
    t = tvec(n)
    Bk = 0.00025 * (f / 220.0) ** 1.2                           # inharmonicity grows with pitch
    t_long = float(np.clip(5.5 * (220.0 / f) ** 0.6, 1.2, 7.0))
    y = np.zeros(n)
    for k in range(1, 14):
        fk = k * f * np.sqrt(1 + Bk * k * k)
        if fk > 6000:
            break
        a = vel ** (1 + 0.1 * k) / k ** 1.05                    # softer hits have fewer high partials
        tl = t_long / (1 + 0.45 * (k - 1))
        env = 0.65 * np.exp(-t / (0.18 * tl)) + 0.35 * np.exp(-t / tl)
        for s, cents in enumerate((-0.6, 0.0, 0.7)):            # the three strings of a note beat slowly
            y += a * env * np.sin(TAU * fk * 2 ** (cents / 1200) * t + rng.uniform(0, TAU)) / 3
    ham = filt(rng.standard_normal(n), [('lp', 1800.0 * vel + 300, 0.7071), ('hp', 120.0, 0.7071)], pad_s=0.05)
    y = norm1(y) + 0.07 * vel * norm1(ham) * np.exp(-t / 0.006)
    y = filt(y, [('lp', 3200.0 + 2600.0 * vel, 0.7071)], pad_s=0.05)
    return attack(norm1(y) * vel, 1.5)


def saw_voice(f, dur, rng, voices=5, spread=9.0):
    n = ns(dur)
    y = np.zeros(n)
    for v in range(voices):
        c = spread * (v - (voices - 1) / 2) / ((voices - 1) / 2)
        y += B.osc_saw(f * 2 ** ((c + rng.uniform(-1.5, 1.5)) / 1200), n, rng.uniform(0, TAU))
    return y / voices


def bubbles(rng, n, rate, f_lo, f_hi, dur_lo=0.01, dur_hi=0.05, t0=0.0, t1=None, amp=(0.2, 1.0)):
    """air bubbles: short rising sine chirps (a bubble's resonance climbs as it pinches off)"""
    t1 = n / SR if t1 is None else t1
    y = np.zeros(n)
    tc = t0
    while True:
        tc += rng.exponential(1.0 / rate)
        if tc >= t1 - 0.06:
            break
        d = rng.uniform(dur_lo, dur_hi)
        L = ns(d)
        tt = np.arange(L) / SR
        f0 = rng.uniform(f_lo, f_hi)
        ph = TAU * np.cumsum(f0 * (1 + 0.8 * tt / d)) / SR
        c = np.sin(ph) * np.exp(-tt / (0.35 * d)) * np.clip(tt / 0.0015, 0, 1)
        a = ns(tc)
        y[a:a + L] += c[:n - a] * rng.uniform(*amp)
    return y


def drip(rng, f0):
    """one water drop into a pool: a fast rising 'plink' and a tiny splash"""
    L = ns(0.12)
    tt = np.arange(L) / SR
    f = f0 * (1 + 0.9 * (1 - np.exp(-tt / 0.012)))
    y = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-tt / 0.025) * np.clip(tt / 0.0008, 0, 1)
    sp = filt(rng.standard_normal(L), [('bp', 5200.0, 1.0)], pad_s=0.02) * np.exp(-tt / 0.004)
    return norm1(y) + 0.15 * norm1(sp)


# ============================================================================
# music loops (4 bars @ 70 bpm, A minor)
# ============================================================================
@osound('pulse_dark', LOOP, 'loop', hit=0.0, norm=('rms', -21.0), loop=True, hp=28.0,
        desc="Dark synth pulse, 70 bpm, 4 bars over A - F - C - G roots: a filtered saw bass in eighths with "
             "accents on 1 and 3, a sub sine under it, a muted tick on the off-beats. Tension bed. Loops seamlessly.")
def gen_pulse_dark(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b, (bass, _, _) in enumerate(PROG):
        f = hz(bass)                                            # saw on the bass note, sine an octave below
        for i in range(8):
            t0 = b * BAR + i * E8
            acc = 1.0 if i in (0, 4) else 0.6
            dur = 0.38
            n = ns(dur)
            tt = tvec(n)
            y = saw_voice(f, dur, r, voices=3, spread=6.0)
            cut = 220.0 + 1100.0 * acc * np.exp(-tt / 0.07)
            y = B.tv_filter(y, lambda tf, ff, c=cut, tv=tt: 1.0 / np.sqrt(1 + (ff / np.interp(tf, tv, c)) ** 4))
            y = y * np.exp(-tt / 0.16) * acc + 0.8 * acc * np.sin(TAU * f / 2 * tt) * np.exp(-tt / 0.2)
            put_wrap(x, attack(y, 2.0), t0, 0.9, p=0.0)
            if i % 2 == 1:
                tick = filt(r.standard_normal(ns(0.05)), [('bp', 3800.0, 2.0)], pad_s=0.02) * np.exp(-tvec(ns(0.05)) / 0.008)
                put_wrap(x, norm1(tick), t0, 0.12, p=r.uniform(-0.4, 0.4))
    x = creverb(x, hall_ir(name, 2, 1.8), 0.25)
    return dict(x=x)


@osound('piano_sad', LOOP, 'loop', hit=0.0, norm=('rms', -23.0), loop=True, hp=50.0,
        desc="Soft felt piano, 70 bpm, 4 bars: a low note on every bar and a broken chord in eighths over "
             "Am - F - C - G, gentle velocities, big hall. Original. Loops seamlessly.")
def gen_piano_sad(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b, (bass, arp, _) in enumerate(PROG):
        put_wrap(x, piano(r, hz(bass), 0.7, dur=5.0), b * BAR + r.uniform(0, 0.008), 0.8, p=-0.25)
        for i, nt in enumerate(arp):
            v = (0.62 if i % 2 == 0 else 0.48) * r.uniform(0.9, 1.05)
            put_wrap(x, piano(r, hz(nt), v, dur=3.5), b * BAR + i * E8 + r.uniform(-0.01, 0.01), 0.6,
                     p=-0.15 + 0.35 * (i % 4) / 3)
    x = creverb(x, hall_ir(name, 2, 2.6), 0.32)
    return dict(x=x)


@osound('pad_hope', LOOP, 'loop', hit=0.0, norm=('rms', -22.0), loop=True, hp=45.0,
        desc="Warm string pad, 70 bpm, 4 bars: Am - F - C - G chords of detuned saws, slow swells that overlap "
             "into the next chord, low-passed, wide hall. Loops seamlessly.")
def gen_pad_hope(name, D):
    x = np.zeros((2, ns(D)))
    for b, (_, _, chord) in enumerate(PROG):
        for j, nt in enumerate(chord):
            r = rng_for(name, 10 * b + j)
            dur = BAR + 1.4
            n = ns(dur)
            tt = tvec(n)
            env = np.clip(tt / 0.9, 0, 1) ** 1.5 * np.clip((dur - tt) / 1.3, 0, 1)
            y = saw_voice(hz(nt), dur, r, voices=6, spread=12.0) * env
            put_wrap(x, widen(y, 0.6, r), b * BAR - 0.35, 0.5 / (1 + 0.2 * j))
    x = cfilt(x, [('lp', 1500.0, 0.7071), ('lp', 2400.0, 0.7071)])
    x = creverb(x, hall_ir(name, 99, 3.0), 0.45)
    return dict(x=x)


DRUMS = ['B...B.b.', 'B...B.b.', 'B...B.bb', 'B.b.BbTT']     # B big drum, b low tom, T high tom


@osound('drums_build', LOOP, 'loop', hit=0.0, norm=('rms', -19.0), loop=True, hp=30.0,
        desc="Cinematic drums for the rescue, 70 bpm, 4 bars: big low drum on 1 and 3, low toms answering, a fill "
             "in bar 4, big hall. Loops seamlessly.")
def gen_drums_build(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b, bar in enumerate(DRUMS):
        for i, c in enumerate(bar):
            t0 = b * BAR + i * E8 + r.uniform(-0.005, 0.005)
            if c == 'B':
                put_wrap(x, drum(r, 'dum', f0=56.0, vel=r.uniform(0.9, 1.0), dur=1.8), t0, 1.0, p=-0.05)
                put_wrap(x, drum(r, 'tak', f0=180.0, vel=0.7, dur=0.25), t0, 0.16, p=0.1)    # stick attack for phones
            elif c == 'b':
                put_wrap(x, drum(r, 'dum', f0=92.0, vel=r.uniform(0.75, 0.9), dur=1.0), t0, 0.6, p=0.3)
            elif c == 'T':
                put_wrap(x, drum(r, 'dum', f0=140.0, vel=r.uniform(0.7, 0.85), dur=0.7), t0, 0.5, p=-0.35)
                put_wrap(x, drum(r, 'tak', f0=260.0, vel=0.6, dur=0.2), t0, 0.12, p=-0.35)
    x = creverb(x, hall_ir(name, 2, 2.4), 0.32)
    return dict(x=x)


# ============================================================================
# the cave
# ============================================================================
@osound('cave_drips', 12.0, 'loop', hit=0.0, norm=('rms', -30.0), loop=True, hp=60.0,
        desc="Inside a big flooded cave: water drops into pools (rising plinks at random pitches, ~1.6 per s), a "
             "distant trickle, a low rumble of water far away, long dark cave reverb. Loops seamlessly.")
def gen_cave_drips(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    r = rng_for(name, 1)
    tc = 0.0
    while True:
        tc += r.exponential(1 / 1.6)
        if tc >= D:
            break
        put_wrap(x, drip(r, r.uniform(700.0, 1700.0)), tc, 10 ** (r.uniform(-14.0, 0.0) / 20), p=r.uniform(-0.8, 0.8))
    rum = cfilt(colored(n, rng_for(name, 2), -6.0, fmin=20, channels=2), [('lp', 160.0, 0.7071)])
    tr = cfilt(colored(n, rng_for(name, 3), -3.0, channels=2), [('bp', 1800.0, 0.9)])
    trm = 0.6 + 0.4 * np.sin(TAU * 3 * tvec(n) / D)
    x = creverb(x, cave_ir(name, 4, 4.5), 0.55)
    x = x + 0.5 * rms(x) * rum / rms(rum) + 0.25 * rms(x) * tr * trm / rms(tr)
    return dict(x=x)


@osound('water_rush', 10.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=30.0,
        desc="Flood water rushing through a narrow cave passage: deep roar with surges, a mid-band torrent, "
             "gurgling bubbles, cave reflections. Loops seamlessly.")
def gen_water_rush(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    rr = lambda k: rng_for(name, k)
    roar = filt(colored(n, rr(1), -6.0, fmin=25, channels=2), [('lp', 350.0, 0.7071)])
    roar *= 1.0 + 0.4 * smooth_rand(n, 0.7, rr(2))
    tor = filt(colored(n, rr(3), -2.0, channels=2), [('bp', 1100.0, 0.6)]) * (0.7 + 0.3 * gust_curve(n, 1.3, rr(4)))
    gur = np.stack([bubbles(rr(5 + c), n, 45.0, 180.0, 700.0, 0.015, 0.06) for c in range(2)])
    gur = filt(gur, [('lp', 2500.0, 0.7071)])
    y = 0.9 * roar / rms(roar) + 0.5 * tor / rms(tor) + 0.35 * gur / rms(gur)
    y = reverb(y, make_ir(1.6, 0.8, rr(9), predelay=0.02, er=10, er_span=0.08, lo_cut=60, hi_cut=5000), wet=0.25)
    return dict(x=loopify(y[:, n0:], nl, nx))


@osound('rain_heavy', 10.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=60.0,
        desc="Monsoon downpour over the jungle: dense drops on leaves and ground (thousands of tiny clicks), "
             "a broadband hiss, a low rumble of distant thunder rolling in and out. Loops seamlessly.")
def gen_rain_heavy(name, D):
    xf, pre = 1.0, 0.3
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    rr = lambda k: rng_for(name, k)
    hiss = filt(colored(n, rr(1), -1.5, channels=2), [('hp', 700.0, 0.7071), ('lp', 9000.0, 0.7071)])
    drops = np.zeros((2, n))
    r = rr(2)
    m = int(n / SR * 900)
    pos = r.integers(0, n - 200, m)
    for k in range(m):
        c = crackle_click(r, r.uniform(1500, 8000), r.uniform(0.00008, 0.0004), 0.5)
        ch = k % 2
        drops[ch, pos[k]:pos[k] + c.size] += c * r.uniform(0.05, 1.0) ** 2
    rum = filt(colored(n, rr(3), -6.0, fmin=18, channels=2), [('lp', 120.0, 0.7071)]) * gust_curve(n, 0.15, rr(4), 0.2, 1.0)
    y = 0.8 * hiss / rms(hiss) + 0.7 * drops / rms(drops) + 0.45 * rum / rms(rum)
    return dict(x=loopify(y[:, n0:], nl, nx))


@osound('underwater', 10.0, 'loop', hit=0.0, norm=('rms', -25.0), loop=True, hp=25.0,
        desc="Underwater in a flooded cave: muffled low rumble and pressure throb, distant bubbles, the creak of "
             "rock, everything above 1.5 kHz gone. Loops seamlessly.")
def gen_underwater(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    rr = lambda k: rng_for(name, k)
    rum = filt(colored(n, rr(1), -6.0, fmin=15, channels=2), [('lp', 220.0, 0.7071)])
    rum *= 1.0 + 0.35 * np.sin(TAU * 0.4 * tvec(n))[None, :]
    bub = np.stack([bubbles(rr(2 + c), n, 6.0, 250.0, 900.0, 0.02, 0.08) for c in range(2)])
    y = 1.0 * rum / rms(rum) + 0.4 * bub / rms(bub)
    y = filt(y, [('lp', 1400.0, 0.7071), ('lp', 1800.0, 0.7071)])
    return dict(x=loopify(y[:, n0:], nl, nx))


@osound('thunder', 7.0, 'hit', hit=0.05, fout=1.2, hp=20.0,
        desc="Thunder close by: a sharp crack, then a rolling rumble with three swells, long outdoor decay.")
def gen_thunder(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    crack = filt(r.standard_normal(n), [('hp', 400.0, 0.7071)], pad_s=0.1) * env_ad(n, 0.05, 0.004, 0.09)
    roll = filt(colored(n, rng_for(name, 2), -6.0, fmin=18), [('lp', 260.0, 0.7071)])
    sw = sum(a * env_ad(n, t0, 0.15, dd) for t0, a, dd in [(0.1, 1.0, 1.2), (1.3, 0.7, 1.4), (2.6, 0.5, 2.2)])
    y = 0.8 * norm1(crack) + norm1(roll * sw)
    x = reverb(widen(y, 0.4, rng_for(name, 3)), make_ir(3.0, 1.5, rng_for(name, 4), predelay=0.05, lo_cut=40), wet=0.4)
    return dict(x=x)


@osound('diver_breath', 4.5, 'hit', hit=0.05, fout=0.6, hp=60.0,
        desc="A diver's breath through a regulator: an inhale hiss with the valve's squeak, then the exhale as a "
             "burst of bubbles rising past the mask, muffled.")
def gen_diver_breath(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    inh = filt(r.standard_normal(n), [('bp', 3600.0, 1.2), ('lp', 7000.0, 0.7071)], pad_s=0.05)
    inh *= np.clip((t - 0.05) / 0.35, 0, 1) * np.clip((1.0 - t) / 0.2, 0, 1)
    sq = np.sin(TAU * 1250.0 * t) * env_ad(n, 0.06, 0.01, 0.04) * 0.3
    bub = bubbles(r, n, 70.0, 160.0, 650.0, 0.02, 0.07, t0=1.15, t1=2.9)
    bub *= np.clip((t - 1.15) / 0.1, 0, 1) * np.clip((2.9 - t) / 0.9, 0, 1)
    rum = filt(r.standard_normal(n), [('lp', 300.0, 0.7071)], pad_s=0.05) * env_ad(n, 1.15, 0.1, 0.7)
    y = 0.6 * norm1(inh) + sq + 0.9 * norm1(filt(bub, [('lp', 2200.0, 0.7071)], pad_s=0.05)) + 0.4 * norm1(rum)
    x = reverb(widen(y, 0.2, rng_for(name, 2)), room_ir(name, 3, 0.3), wet=0.1)
    return dict(x=x)


@osound('pump_fail', 5.0, 'hit', hit=2.6, fout=1.0, hp=25.0,
        desc="A big water pump dies: the motor's hum (50 Hz and harmonics) winds down over 2.5 s with a grinding "
             "rattle, a heavy clunk at 2.6 s, then water starts gurgling back in and swells.")
def gen_pump_fail(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    f = 50.0 * np.clip(1 - t / 2.7, 0.08, 1) ** 1.6
    hum = sum(np.sin(k * phase_of(f)) / k ** 0.9 for k in range(1, 20)) * np.clip(1 - t / 2.65, 0, 1) ** 0.7
    grind = filt(r.standard_normal(n), [('bp', 1400.0, 1.5)], pad_s=0.05) * (0.5 + 0.5 * np.sin(phase_of(f * 2))) * np.clip(1 - t / 2.5, 0, 1)
    tt = np.maximum(t - 2.6, 0)
    clunk = (np.sin(TAU * 70.0 * tt) + 0.6 * np.sin(TAU * 230.0 * tt)) * np.exp(-tt / 0.12) * (t >= 2.6)
    water = bubbles(r, n, 60.0, 150.0, 600.0, 0.02, 0.07, t0=2.8)
    water = filt(water, [('lp', 2200.0, 0.7071)], pad_s=0.05) * np.clip((t - 2.8) / 1.5, 0, 1)
    rush = filt(colored(n, rng_for(name, 2), -4.0, fmin=30), [('lp', 600.0, 0.7071)]) * np.clip((t - 3.0) / 1.6, 0, 1)
    y = 0.7 * norm1(hum) + 0.25 * norm1(grind) + 0.9 * norm1(clunk) + 0.5 * norm1(water) + 0.45 * norm1(rush)
    x = reverb(widen(y, 0.25, rng_for(name, 3)), cave_ir(name, 4, 2.5), wet=0.3)
    return dict(x=x)


# ============================================================================
# the mountain
# ============================================================================
@osound('wind_high', 12.0, 'loop', hit=0.0, norm=('rms', -23.0), loop=True, hp=30.0,
        desc="High-altitude wind on an exposed ridge: a broadband roar with strong gusts and two wandering "
             "whistling resonances (300-900 Hz), snow hiss in the gusts. Loops seamlessly.")
def gen_wind_high(name, D):
    xf, pre = 1.5, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    rr = lambda k: rng_for(name, k)
    g = gust_curve(n, 0.35, rr(1), 0.25, 1.0)
    roar = filt(colored(n, rr(2), -5.0, fmin=25, channels=2), [('lp', 700.0, 0.7071)]) * g
    t = tvec(n)
    out = []
    for c in range(2):
        nz = colored(n, rr(3 + c), -2.0)
        f1 = 520.0 * 2 ** (0.6 * smooth_rand(n, 0.25, rr(5 + c)))
        f2 = 330.0 * 2 ** (0.5 * smooth_rand(n, 0.2, rr(7 + c)))
        wh = B.tv_filter(nz, lambda tf, ff, a=f1, b=f2: (np.exp(-0.5 * (np.log2(np.maximum(ff, 20) / np.interp(tf, t, a)) / 0.06) ** 2)
                                                        + 0.7 * np.exp(-0.5 * (np.log2(np.maximum(ff, 20) / np.interp(tf, t, b)) / 0.07) ** 2)))
        out.append(wh * g ** 1.5)
    whistle = np.stack(out)
    snow = filt(colored(n, rr(9), -1.0, channels=2), [('hp', 3000.0, 0.7071)]) * g ** 3
    y = 0.9 * roar / rms(roar) + 0.45 * whistle / rms(whistle) + 0.2 * snow / rms(snow)
    return dict(x=loopify(y[:, n0:], nl, nx))


@osound('breath_mask', 6.0, 'loop', hit=0.0, norm=('rms', -26.0), loop=True, hp=120.0,
        desc="Heavy slow breathing through an oxygen mask at altitude: two cycles of a hissing inhale and a "
             "longer, lower exhale with the mask valve's click, close and dry. Loops seamlessly.")
def gen_breath_mask(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    for k in range(2):
        r = rng_for(name, k)
        L = ns(3.0)
        tt = tvec(L)
        src = r.standard_normal(L)
        inh = filt(src, [('bp', 1900.0, 1.0), ('lp', 5000.0, 0.7071)], pad_s=0.05)
        inh *= np.sin(np.pi * np.clip(tt / 1.1, 0, 1)) ** 1.5
        exh = filt(src, [('bp', 900.0, 0.9), ('lp', 3000.0, 0.7071)], pad_s=0.05)
        exh *= np.sin(np.pi * np.clip((tt - 1.25) / 1.45, 0, 1)) ** 1.3
        click = np.sin(TAU * 2400.0 * tt) * env_ad(L, 1.24, 0.001, 0.006)
        y = 0.8 * norm1(inh) + 1.0 * norm1(exh) + 0.15 * click
        put_wrap(x, widen(y, 0.08, r), k * 3.0, 1.0)
    x = creverb(x, room_ir(name, 9, 0.25), 0.08)
    return dict(x=x)


@osound('steps_snow', 3.2, 'hit', hit=0.02, fout=0.3, hp=60.0,
        desc="Four slow steps in crampons on hard snow: a crunch, a low thud, a tiny metallic bite of the points.")
def gen_steps_snow(name, D):
    n = ns(D)
    t = tvec(n)
    y = np.zeros(n)
    for j, t0 in enumerate([0.02, 0.8, 1.6, 2.4]):
        r = rng_for(name, j)
        cr = np.zeros(n)
        for k in range(160):
            tc = t0 + r.exponential(0.035)
            a = ns(tc)
            if a >= n - 100:
                continue
            c = crackle_click(r, r.uniform(1200, 6500), r.uniform(0.0001, 0.0005), 0.5)
            cr[a:a + c.size] += c[:n - a] * r.uniform(0.2, 1.0)
        tt = np.maximum(t - t0, 0)
        thud = np.sin(TAU * 85.0 * tt) * np.exp(-tt / 0.05) * (t >= t0)
        bite = sum(np.sin(TAU * r.uniform(4200, 6800) * tt) for _ in range(3)) * np.exp(-tt / 0.01) * (t >= t0)
        y += (1.0 - 0.1 * j) * (0.8 * norm1(cr) + 0.6 * norm1(thud) + 0.12 * norm1(bite))
    x = reverb(widen(y, 0.15, rng_for(name, 9)), make_ir(0.9, 0.5, rng_for(name, 10), lo_cut=100), wet=0.12)
    return dict(x=x)


@osound('radio_static', 2.4, 'hit', hit=0.02, fout=0.2, hp=250.0,
        desc="A two-way radio: squelch burst opening, hiss and crackles through a tiny speaker, a short roger beep "
             "and the closing squelch tail.")
def gen_radio_static(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    hiss = filt(r.standard_normal(n), [('hp', 400.0, 0.7071), ('lp', 3200.0, 0.7071)], pad_s=0.05)
    gate = np.clip(t / 0.01, 0, 1) * np.clip((1.95 - t) / 0.02, 0, 1)
    burst = env_ad(n, 0.0, 0.003, 0.12) + 0.8 * env_ad(n, 1.95, 0.003, 0.15)
    cr = np.zeros(n)
    for k in range(60):
        c = crackle_click(r, r.uniform(800, 3000), r.uniform(0.0003, 0.002), 0.5)
        a = ns(r.uniform(0.05, 1.9))
        cr[a:a + c.size] += c[:n - a] * r.uniform(0.2, 1.0)
    beep = np.sin(TAU * 1200.0 * t) * ((t > 1.75) & (t < 1.85))
    y = 0.35 * norm1(hiss) * gate + 0.9 * norm1(hiss) * burst + 0.35 * norm1(cr) * gate + 0.3 * beep
    y = filt(softclip(1.5 * y, 1.5), [('bp', 1500.0, 0.6)], pad_s=0.05)
    return dict(x=pan(norm1(y), 0.1))


@osound('phone_ring', 3.6, 'hit', hit=0.02, fout=0.3, hp=200.0,
        desc="A house phone ringing in a quiet kitchen at night: double ring (400 + 450 Hz with a fast warble), "
             "twice, through a small speaker, room echo.")
def gen_phone_ring(name, D):
    n = ns(D)
    t = tvec(n)
    on = np.zeros(n)
    for a, b in [(0.02, 0.42), (0.62, 1.02), (2.02, 2.42), (2.62, 3.02)]:
        on += np.clip((t - a) / 0.005, 0, 1) * np.clip((b - t) / 0.005, 0, 1)
    tone = (np.sin(TAU * 400.0 * t) + np.sin(TAU * 450.0 * t)) * (0.75 + 0.25 * np.sin(TAU * 17.0 * t))
    y = filt(softclip(0.8 * tone * on, 1.8), [('bp', 1100.0, 0.7)], pad_s=0.05)
    x = reverb(pan(norm1(y), -0.2), room_ir(name, 2, 0.45), wet=0.25)
    return dict(x=x)


def main():
    only = ''
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]
    names = [s for s in only.split(',') if s] or NEW
    sys.argv = [sys.argv[0], '--only', ','.join(names), '--outdir', OUT]
    rc = B.main()
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    man['title'] = "Rescue episodes (the Thai cave 2018, Everest 2006) - original synthesized kit (70 bpm, 4-bar loops)"
    man['generator'] = "make_sfx_rescue.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    man['tempo'] = dict(bpm=BPM, beat_s=BEAT, loop_bars=4, loop_s=LOOP)
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
