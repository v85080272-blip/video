#!/usr/bin/env python3
"""
make_sfx_dance.py -- original sound kit for «Танцевальная чума 1518» (Тайны истории №2).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). A medieval street dance at
126 bpm: frame drum (dum / tak), tambourine, foot stomps, hand claps, bagpipe drones and a chanter tune,
one dancer's feet on cobblestones, a crowd stomping out of step, a chapel bell, a choir 'aah' pad,
a body falling. Loops are built on a circular time grid (events and reverb tails wrap around), so they
repeat without a seam; tonal loops use whole numbers of cycles per loop.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in ./dance/
Usage:   python3 make_sfx_dance.py [--only groove_full,bell_toll]
"""
import os
import sys
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, env_ad, fade, phase_of, softclip, pan, widen,
                      mono_bass, make_ir, reverb, st, sound, bq_mag)

BPM = 126.0
BEAT = 60.0 / BPM            # 0.476 s
E8 = BEAT / 2
BAR = 4 * BEAT
LOOP = 4 * BAR               # 7.62 s, every loop is 4 bars
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dance')
NEW = []


def dsound(name, *a, **k):
    NEW.append(name)
    return sound(name, *a, **k)


# ----------------------------------------------------------------------------
# circular helpers (for seamless loops)
# ----------------------------------------------------------------------------
def nloop(dur=LOOP):
    return ns(dur)


def put_wrap(dst, src, t0, gain=1.0, p=0.0):
    """add mono src panned to p into stereo dst at t0, wrapping around the end"""
    s2 = pan(src, p) if np.ndim(src) == 1 else src
    n = dst.shape[1]
    i0 = ns(t0) % n
    m = s2.shape[1]
    k = min(m, n - i0)
    dst[:, i0:i0 + k] += gain * s2[:, :k]
    rest = m - k
    while rest > 0:                      # tails longer than the loop wrap repeatedly
        j = m - rest
        kk = min(rest, n)
        dst[:, :kk] += gain * s2[:, j:j + kk]
        rest -= kk
    return dst


def creverb(x, ir, wet):
    """circular convolution reverb: tails wrap into the loop start"""
    n = x.shape[1]
    X = np.fft.rfft(x, n, axis=1)
    h = ir[:, :n] if ir.shape[1] > n else ir
    Hh = np.fft.rfft(h, n, axis=1)
    return x + wet * np.fft.irfft(X * Hh, n, axis=1)


def cfilt(x, spec):
    return filt(x, spec, circular=True)


def norm1(x):
    return x / (np.max(np.abs(x)) + 1e-12)


def attack(x, ms=1.0):
    k = max(1, ns(ms / 1000.0))
    x = np.array(x, copy=True)
    x[..., :k] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    return x


# ----------------------------------------------------------------------------
# instruments (mono one-shots, returned as arrays)
# ----------------------------------------------------------------------------
MEMB = [1.0, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156, 3.501]     # circular membrane modes


def drum(rng, kind='dum', f0=94.0, vel=1.0, dur=0.9):
    """frame drum: open low stroke 'dum' or edge stroke 'tak'"""
    n = ns(dur)
    t = tvec(n)
    if kind == 'dum':
        amps = [1.0, 0.45, 0.30, 0.22, 0.16, 0.12, 0.08, 0.06]
        decs = [0.30, 0.16, 0.11, 0.09, 0.075, 0.06, 0.05, 0.045]
        slap = (3200.0, 0.30, 0.010)
    else:
        amps = [0.12, 0.30, 0.50, 0.45, 0.40, 0.35, 0.30, 0.25]
        decs = [0.07, 0.055, 0.045, 0.04, 0.035, 0.032, 0.03, 0.028]
        slap = (6500.0, 0.85, 0.006)
    sweep = 1.0 + 0.10 * vel * np.exp(-t / 0.025)      # skin tension drops right after the hit
    y = np.zeros(n)
    for r_, a_, d_ in zip(MEMB, amps, decs):
        y += a_ * np.sin(phase_of(f0 * r_ * rng.uniform(0.99, 1.01) * sweep)) * np.exp(-t / d_)
    nz = filt(rng.standard_normal(n), [('lp', slap[0], 0.7071), ('hp', 300.0, 0.7071)], pad_s=0.05)
    y = norm1(y) + slap[1] * norm1(nz) * np.exp(-t / slap[2])
    if kind == 'dum':
        y += 0.45 * np.sin(TAU * 52.0 * t) * np.exp(-t / 0.07)
    else:
        y += 0.35 * np.sin(TAU * 1850.0 * t) * np.exp(-t / 0.008)   # wooden rim click
    return attack(vel * norm1(y), 0.6)


def tambourine(rng, vel=1.0, dur=0.45, spread=0.012):
    n = ns(dur)
    t = tvec(n)
    y = np.zeros(n)
    for j in range(6):                                 # jingle pairs, not perfectly together
        t0 = rng.uniform(0.0, spread)
        tt = t - t0
        m = tt >= 0
        for k in range(7):
            f = rng.uniform(3200.0, 12500.0)
            d = rng.uniform(0.04, 0.16)
            y[m] += rng.uniform(0.3, 1.0) * np.sin(TAU * f * tt[m] + rng.uniform(0, TAU)) * np.exp(-tt[m] / d)
    hiss = filt(rng.standard_normal(n), [('hp', 5000.0, 0.7071), ('lp', 14000.0, 0.7071)], pad_s=0.05)
    y = norm1(y) + 0.5 * norm1(hiss) * env_ad(n, 0.0, 0.002, 0.07)
    return attack(vel * norm1(y), 0.5)


def stomp(rng, vel=1.0, dur=0.4, wood=False):
    """a foot hitting cobblestones (or wooden boards)"""
    n = ns(dur)
    t = tvec(n)
    f = (60.0 if wood else 50.0) + 32.0 * np.exp(-t / 0.02)
    thump = np.sin(phase_of(f)) * env_ad(n, 0.0, 0.003, 0.05)
    body = norm1(filt(rng.standard_normal(n), [('lp', 420.0, 0.7071), ('hp', 60.0, 0.7071)], pad_s=0.05))
    body *= env_ad(n, 0.0, 0.002, 0.03)
    if wood:
        body += 0.6 * np.sin(TAU * rng.uniform(180, 240) * t) * np.exp(-t / 0.05)
    t1 = rng.uniform(0.0, 0.012)
    scuff = norm1(filt(rng.standard_normal(n), [('bp', rng.uniform(900.0, 1800.0), 0.9)], pad_s=0.05))
    scuff *= env_ad(n, t1, 0.002, rng.uniform(0.012, 0.03))
    grit = norm1(filt(rng.standard_normal(n), [('hp', 2500.0, 0.7071)], pad_s=0.05)) * env_ad(n, 0.0, 0.001, 0.008)
    y = thump + 0.6 * body + 0.35 * scuff + 0.15 * grit
    return attack(vel * norm1(y), 0.8)


def clap(rng, vel=1.0, dur=0.3):
    n = ns(dur)
    fc = rng.uniform(1000.0, 1600.0)
    src = filt(rng.standard_normal(n), [('bp', fc, 0.8), ('hp', 400.0, 0.7071)], pad_s=0.05)
    env = np.zeros(n)
    for k, t0 in enumerate([0.0, rng.uniform(0.006, 0.01), rng.uniform(0.013, 0.02)]):
        env += env_ad(n, t0, 0.0008, 0.004) * (0.8 if k < 2 else 1.0)
    env += 0.9 * env_ad(n, 0.02, 0.001, rng.uniform(0.03, 0.06))
    return vel * norm1(src * env)


def harm_tone(f_t, amps_fn, hmax, fmax=9000.0):
    """additive tone along a frequency curve f_t (array); amps_fn(freqs) -> amplitude of each harmonic"""
    ph = phase_of(f_t)
    y = np.zeros(len(f_t))
    for h in range(1, hmax + 1):
        fh = h * f_t
        a = amps_fn(fh) * (fh < fmax) / h ** 0.7
        if np.max(a) <= 0:
            continue
        y += a * np.sin(h * ph)
    return y


def formant_fn(peaks, hp=None, floor=0.12):
    """smooth resonance curve: peaks = [(f, Q, gain)]; evaluated by interpolation on a grid"""
    f = np.linspace(0.0, SR / 2, 4097)
    g = np.full_like(f, floor)
    for fc, q, gain in peaks:
        g += gain * bq_mag('bp', fc, f, q)
    if hp:
        g *= bq_mag('hp', hp, f, 0.7071)
    return lambda x: np.interp(x, f, g)


# ----------------------------------------------------------------------------
# pattern helpers
# ----------------------------------------------------------------------------
DRUM_BARS = ['D.TDD.Tt', 'D.T.DDT.', 'D.TDD.Tt', 'D.TDDTTT']    # D dum, T tak, t ghost tak


def street_ir(name, k, rt=1.2):
    return make_ir(rt, 0.55 * rt, rng_for(name, k), predelay=0.018, er=12, er_span=0.06, lo_cut=110, hi_cut=6500)


def lay_drums(x, name, vel=1.0, ghosts=True, k0=0):
    r = rng_for(name, k0)
    for b, bar in enumerate(DRUM_BARS):
        for i, c in enumerate(bar):
            if c == '.' or (c == 't' and not ghosts):
                continue
            t0 = b * BAR + i * E8 + r.uniform(-0.005, 0.005)
            if c == 'D':
                put_wrap(x, drum(r, 'dum', vel=r.uniform(0.85, 1.0)), t0, 1.0 * vel, p=-0.05)
            elif c == 'T':
                put_wrap(x, drum(r, 'tak', vel=r.uniform(0.8, 1.0)), t0, 0.62 * vel, p=-0.05)
            else:
                put_wrap(x, drum(r, 'tak', vel=0.5), t0, 0.28 * vel, p=-0.05)


def lay_tamb(x, name, vel=1.0, offbeats_only=False, k0=0):
    r = rng_for(name, k0)
    for b in range(4):
        for i in range(8):
            off = i % 2 == 1
            if offbeats_only and not off:
                continue
            t0 = b * BAR + i * E8 + r.uniform(-0.008, 0.008)
            v = (1.0 if off else 0.55) * r.uniform(0.8, 1.0)
            put_wrap(x, tambourine(r, v), t0, 0.33 * vel, p=0.35)
        if b == 3 and not offbeats_only:                 # little roll into the loop start
            put_wrap(x, tambourine(r, 0.7, dur=0.5, spread=0.06), 3 * BAR + 7.5 * E8, 0.25 * vel, p=0.35)


def lay_crowd_beats(x, name, idx, n_people, what, gain, jitter, k0=0):
    r = rng_for(name, k0)
    for p in range(n_people):
        pp = r.uniform(-0.75, 0.75)
        g = gain * 10 ** (r.uniform(-6.0, 0.0) / 20)
        for b in range(4):
            for i in idx:
                t0 = b * BAR + i * E8 + r.normal(0.0, jitter)
                s = stomp(r, r.uniform(0.7, 1.0)) if what == 'stomp' else clap(r, r.uniform(0.7, 1.0))
                put_wrap(x, s, t0, g, p=pp)


# ============================================================================
# one-shots
# ============================================================================
@dsound('drum_dum', 1.0, 'hit', hit=0.002, fout=0.05,
        desc="Frame drum, open low stroke (membrane modes from 94 Hz, pitch dip, hand slap), small street room.")
def gen_drum_dum(name, D):
    x = drum(rng_for(name, 1), 'dum', vel=1.0, dur=D)
    return dict(x=reverb(widen(x, 0.08, rng_for(name, 2)), street_ir(name, 3, 0.9), wet=0.2))


@dsound('drum_tak', 0.6, 'hit', hit=0.002, fout=0.05,
        desc="Frame drum, edge stroke 'tak' (upper membrane modes, bright slap, rim click), small street room.")
def gen_drum_tak(name, D):
    x = drum(rng_for(name, 1), 'tak', vel=1.0, dur=D)
    return dict(x=reverb(widen(x, 0.08, rng_for(name, 2)), street_ir(name, 3, 0.9), wet=0.2))


@dsound('stomp_big', 1.2, 'hit', hit=0.01, fout=0.1,
        desc="Several feet stamping at once on cobblestones (6 stomps within 25 ms), stone-street echo.")
def gen_stomp_big(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    x = np.zeros((2, n))
    for k in range(6):
        put_wrap(x, stomp(r, r.uniform(0.8, 1.0), dur=0.5), 0.01 + r.uniform(0.0, 0.025), 0.5, p=r.uniform(-0.5, 0.5))
    x = x[:, :n]
    return dict(x=reverb(x, street_ir(name, 2, 1.1), wet=0.3))


@dsound('body_fall', 1.4, 'hit', hit=0.02, fout=0.15,
        desc="A body collapsing on the ground: heavy low thud, cloth rustle, a smaller second thud (arm), street.")
def gen_body_fall(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)

    def thud(t0, f0, dec, amp, k):
        tt = np.maximum(t - t0, 0.0)
        s = np.sin(phase_of(f0 * (1 + 0.35 * np.exp(-tt / 0.03)))) * env_ad(n, t0, 0.004, dec)
        b = norm1(filt(rng_for(name, k).standard_normal(n), [('lp', 650.0, 0.7071), ('hp', 40.0, 0.7071)])) \
            * env_ad(n, t0, 0.003, dec * 0.6)
        return amp * (s + 0.7 * b)

    x = thud(0.02, 46.0, 0.13, 1.0, 2) + thud(0.15, 70.0, 0.06, 0.45, 3) + thud(0.23, 95.0, 0.04, 0.25, 4)
    cl = norm1(filt(r.standard_normal(n), [('bp', 3000.0, 0.7)]))
    am = np.clip(B.smooth_rand(n, 25.0, rng_for(name, 5)), 0, None)
    x += 0.22 * cl * am * (env_ad(n, 0.0, 0.03, 0.18) + 0.6 * env_ad(n, 0.2, 0.02, 0.12))
    x = softclip(1.3 * norm1(x), 1.2)
    return dict(x=mono_bass(reverb(widen(x, 0.1, rng_for(name, 6)), street_ir(name, 7, 0.9), wet=0.18), 120.0))


@dsound('bell_toll', 7.0, 'hit', hit=0.005, fout=0.8,
        desc="Chapel bell strike on D (hum, prime, minor-third tierce, quint, nominal + upper partials, "
             "beating doublets, metal clank), distant valley reverb.")
def gen_bell_toll(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    p = 587.33                                              # strike note D5 (a small chapel bell)
    parts = [(0.5, 0.55, 5.5), (1.0, 0.75, 3.6), (1.2, 0.65, 2.8), (1.5, 0.30, 2.0), (2.0, 1.00, 1.7),
             (2.5, 0.40, 0.9), (2.66, 0.30, 0.8), (3.0, 0.25, 0.6), (4.0, 0.15, 0.4), (5.33, 0.08, 0.25)]
    x = np.zeros(n)
    for ratio, amp, dec in parts:
        f = p * ratio * r.uniform(0.997, 1.003)
        beat = r.uniform(0.3, 1.2)                          # doublets -> slow warble
        x += amp * (np.sin(TAU * f * t) + 0.6 * np.sin(TAU * (f + beat) * t + r.uniform(0, TAU))) * np.exp(-t / dec)
    clank = norm1(filt(r.standard_normal(n), [('bp', 3800.0, 1.2)])) * env_ad(n, 0.0, 0.0005, 0.012)
    x = attack(norm1(x) + 0.35 * clank, 0.8)
    ir = make_ir(2.6, 1.6, rng_for(name, 2), predelay=0.04, er=8, er_span=0.12, lo_cut=150, hi_cut=7000)
    return dict(x=reverb(widen(x, 0.15, rng_for(name, 3)), ir, wet=0.4))


@dsound('choir_pad', 10.0, 'bed', hit=0.0, norm=('rms', -24.0), fout=2.0,
        desc="Choir 'aah' pad in D minor (D3 A3 D4 F4 A4, 3 detuned voices each, vowel-a formants, "
             "vibrato, breath), slow swell, chapel reverb.")
def gen_choir_pad(name, D):
    n = ns(D)
    t = tvec(n)
    notes = [146.83, 220.0, 293.66, 349.23, 440.0]
    vowel = formant_fn([(750.0, 4.0, 1.0), (1150.0, 5.0, 0.7), (2700.0, 8.0, 0.35), (3500.0, 9.0, 0.15)],
                       hp=120.0, floor=0.04)
    swell = np.clip(t / 1.8, 0, 1) ** 1.5
    x = np.zeros((2, n))
    for i, f0 in enumerate(notes):
        for v in range(3):
            r = rng_for(name, 10 * i + v)
            cents = (12.0 * np.sin(TAU * r.uniform(4.8, 5.6) * t + r.uniform(0, TAU)) * np.clip((t - 0.6) / 1.5, 0, 1)
                     + 6.0 * B.smooth_rand(n, 0.4, r) + r.uniform(-7.0, 7.0))
            ft = f0 * 2 ** (cents / 1200)
            y = harm_tone(ft, vowel, hmax=int(5000 / f0), fmax=5000.0)
            x += pan(norm1(y) * (0.8 if f0 > 400 else 1.0), r.uniform(-0.6, 0.6))
    br = filt(rng_for(name, 99).standard_normal((2, n)), [('bp', 1100.0, 1.5)])
    x = x / np.max(np.abs(x)) + 0.03 * br / np.max(np.abs(br))
    x = x * swell
    ir = make_ir(3.2, 2.0, rng_for(name, 100), predelay=0.03, er=10, er_span=0.09, lo_cut=100, hi_cut=8000)
    return dict(x=reverb(x, ir, wet=0.55))


# ============================================================================
# loops (4 bars @ 126 bpm)
# ============================================================================
@dsound('groove_full', LOOP, 'loop', hit=0.0, norm=('rms', -20.0), loop=True, hp=30.0,
        desc="Street dance groove, 126 bpm, 4 bars: frame drum dum/tak pattern with ghost notes, tambourine "
             "eighths (accented off-beats, roll into bar 1), crowd stomps on 1 and 3, claps on 2 and 4, "
             "stone-square echo. Loops seamlessly.")
def gen_groove_full(name, D):
    x = np.zeros((2, ns(D)))
    lay_drums(x, name, 1.0, ghosts=True, k0=1)
    lay_tamb(x, name, 1.0, k0=2)
    lay_crowd_beats(x, name, (0, 4), 5, 'stomp', 0.42, 0.018, k0=3)
    lay_crowd_beats(x, name, (2, 6), 4, 'clap', 0.22, 0.012, k0=4)
    x = creverb(x, street_ir(name, 5, 1.3), 0.25)
    return dict(x=x)


@dsound('groove_lite', LOOP, 'loop', hit=0.0, norm=('rms', -21.0), loop=True, hp=30.0,
        desc="Lighter street groove, 126 bpm, 4 bars: frame drum dum/tak only, tambourine on off-beats, "
             "more echo. Loops seamlessly.")
def gen_groove_lite(name, D):
    x = np.zeros((2, ns(D)))
    lay_drums(x, name, 1.0, ghosts=False, k0=1)
    lay_tamb(x, name, 0.7, offbeats_only=True, k0=2)
    x = creverb(x, street_ir(name, 5, 1.5), 0.32)
    return dict(x=x)


@dsound('stomps_solo', LOOP, 'loop', hit=0.0, norm=('rms', -22.0), loop=True, hp=30.0,
        desc="One dancer alone on cobblestones, 126 bpm: a stomp on every beat (alternating feet, slight pan), "
             "light scuffs on the off-beats of 2 and 4, narrow-street echo. Loops seamlessly.")
def gen_stomps_solo(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b in range(16):
        t0 = b * BEAT + r.uniform(-0.01, 0.01)
        put_wrap(x, stomp(r, r.uniform(0.75, 1.0)), t0, 1.0 if b % 2 == 0 else 0.8, p=0.12 if b % 2 else -0.12)
        if b % 2 == 1:
            sc = stomp(r, 0.35) * 0.5
            put_wrap(x, sc, t0 + E8 + r.uniform(-0.01, 0.01), 0.5, p=-0.1)
    x = creverb(x, street_ir(name, 2, 1.0), 0.3)
    return dict(x=x)


@dsound('crowd_stomps', LOOP, 'loop', hit=0.0, norm=('rms', -21.0), loop=True, hp=30.0,
        desc="A crowd dancing out of step: 24 people stomping on every beat with loose timing (+-40 ms) and "
             "their own slight tempo drift, a few scattered claps, wide stone-square echo. Loops seamlessly.")
def gen_crowd_stomps(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    r = rng_for(name, 1)
    for p in range(24):
        pp = r.uniform(-0.9, 0.9)
        g = 0.35 * 10 ** (r.uniform(-9.0, 0.0) / 20)
        tempo = r.uniform(0.97, 1.03)
        ph = r.uniform(-0.06, 0.06)
        k = 0
        while True:
            t0 = ph + k * BEAT * tempo + r.normal(0.0, 0.04)
            if t0 >= D:
                break
            put_wrap(x, stomp(r, r.uniform(0.6, 1.0)), t0, g, p=pp)
            k += 1
    for c in range(14):
        put_wrap(x, clap(r, r.uniform(0.5, 1.0)), r.uniform(0, D), 0.15, p=r.uniform(-0.8, 0.8))
    x = creverb(x, street_ir(name, 2, 1.6), 0.3)
    return dict(x=x)


def int_cycles(f, dur):
    return round(f * ns(dur) / SR) * SR / ns(dur)


@dsound('drone_pipes', LOOP, 'loop', hit=0.0, norm=('rms', -22.0), loop=True, hp=40.0,
        desc="Bagpipe drones D2 + A2 + D3 (additive reed tone, nasal formants, whole cycles per loop, tiny "
             "periodic wobble), square echo. Loops seamlessly.")
def gen_drone_pipes(name, D):
    n = ns(D)
    t = tvec(n)
    reed = formant_fn([(520.0, 2.0, 0.8), (1250.0, 3.0, 1.0), (2700.0, 4.0, 0.6), (3900.0, 6.0, 0.25)],
                      hp=60.0, floor=0.08)
    x = np.zeros((2, n))
    for i, (f, g, p) in enumerate([(73.42, 0.8, -0.3), (110.0, 0.55, 0.3), (146.83, 0.7, 0.0)]):
        fi = int_cycles(f, D)
        wob = 1 + 0.0007 * np.sin(TAU * (2 + i) * t / D + i)          # whole LFO cycles per loop
        y = harm_tone(fi * wob, reed, hmax=int(7000 / f), fmax=7000.0)
        x += pan(g * norm1(y), p)
    x = cfilt(x, [('lp', 6000.0, 0.7071)])
    x = creverb(x, street_ir(name, 2, 1.3), 0.18)
    return dict(x=x)


NOTE = {'D4': 293.66, 'E4': 329.63, 'F#4': 369.99, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C5': 523.25,
        'D5': 587.33, 'E5': 659.26, 'F#5': 739.99, 'G5': 783.99, 'A5': 880.00}
TUNE = [  # (note, eighths) -- 4 bars, D mixolydian, a branle-like round
    ('D5', 2), ('A4', 2), ('D5', 1), ('E5', 1), ('F#5', 1), ('E5', 1),
    ('D5', 2), ('A4', 2), ('B4', 1), ('A4', 1), ('G4', 1), ('F#4', 1),
    ('E4', 1), ('F#4', 1), ('G4', 1), ('A4', 1), ('B4', 1), ('A4', 1), ('G4', 1), ('F#4', 1),
    ('E4', 2), ('A4', 2), ('D4', 4),
]


@dsound('chanter_tune', LOOP, 'loop', hit=0.0, norm=('rms', -22.0), loop=True, hp=150.0,
        desc="Bagpipe chanter tune, 4 bars in D mixolydian at 126 bpm (legato, high-G grace notes on long "
             "notes, reed formants), square echo. Original melody. Loops seamlessly.")
def gen_chanter_tune(name, D):
    n = ns(D)
    f = np.zeros(n)
    pos = 0.0
    for note, e in TUNE:
        a, b = ns(pos), ns(pos + e * E8)
        f[a:b] = NOTE[note]
        if e >= 2:                                          # G grace note just before the long note
            g0 = ns(pos - 0.028) % n
            g1 = a % n
            if g0 < g1:
                f[g0:g1] = NOTE['G5']
            else:
                f[g0:] = NOTE['G5']
                f[:g1] = NOTE['G5']
        pos += e * E8
    f[ns(pos):] = NOTE['D4']
    # circular 4 ms glide, then whole number of cycles per loop
    k = ns(0.004)
    win = np.zeros(n)
    win[:k] = 1.0 / k
    f = np.fft.irfft(np.fft.rfft(f) * np.fft.rfft(np.roll(win, -k // 2)), n)
    c = f.sum() / SR
    f *= round(c) / c
    reed = formant_fn([(1100.0, 2.5, 1.0), (2400.0, 3.5, 0.8), (3500.0, 5.0, 0.4)], hp=250.0, floor=0.1)
    y = harm_tone(f, reed, hmax=24, fmax=9000.0)
    x = pan(norm1(y), 0.15)
    x = cfilt(x, [('lp', 7500.0, 0.7071)])
    x = creverb(x, street_ir(name, 2, 1.3), 0.22)
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
    man['title'] = "«Танцевальная чума 1518» - original synthesized street-dance kit (126 bpm, 4-bar loops)"
    man['generator'] = "make_sfx_dance.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    man['tempo'] = dict(bpm=BPM, beat_s=BEAT, loop_bars=4, loop_s=LOOP)
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
