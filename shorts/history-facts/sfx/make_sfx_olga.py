#!/usr/bin/env python3
"""
make_sfx_olga.py -- original sound kit for «Месть княгини Ольги» (Тайны истории №3).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). An early medieval Slavic epic at
80 bpm: big war drums answered by a frame drum, a plucked gusli ostinato (Karplus-Strong strings over
Dm - C - Bb - A), a low male choir drone, a war horn call, a big fire and flames catching, wings (a flock
taking off, one pigeon), earth thrown into a pit, a beam barring a door, swords drawn, a feast murmur.
Loops are built on a circular time grid (events and reverb tails wrap around), so they repeat without a seam.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in ./olga/
Usage:   python3 make_sfx_olga.py [--only war_drums,gusli_tune]
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
from make_sfx_dance import put_wrap, creverb, cfilt, norm1, attack, drum, harm_tone, formant_fn, int_cycles

BPM = 80.0
BEAT = 60.0 / BPM            # 0.75 s
E8 = BEAT / 2
BAR = 4 * BEAT
LOOP = 4 * BAR               # 12 s, every loop is 4 bars
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'olga')
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


def field_ir(name, k, rt=1.6):
    return make_ir(rt, 0.5 * rt, rng_for(name, k), predelay=0.02, er=6, er_span=0.12, lo_cut=120, hi_cut=5000)


# ----------------------------------------------------------------------------
# instruments
# ----------------------------------------------------------------------------
def ks(f, dur, rng, decay_s=1.8, bright=0.55, pos=0.18):
    """Karplus-Strong string: noise burst through a delay line with a two-point average, one period per step"""
    n = ns(dur)
    P = max(2, int(round(SR / f - 0.5)))
    g = 10 ** (-3.0 * P / (SR * decay_s))                       # -60 dB after decay_s
    exc = rng.uniform(-1.0, 1.0, P)
    k = 1 + int((1.0 - bright) * 6)
    exc = np.convolve(exc, np.ones(k) / k, mode='same')
    d = max(1, int(pos * P))                                    # plucking point: comb on the excitation
    exc = exc - np.roll(exc, d)
    exc -= exc.mean()
    out = np.zeros(n + 2 * P + 1)
    out[1:P + 1] = exc
    i = P + 1
    while i < n + 1:
        m = min(P, n + 1 - i)
        out[i:i + m] = g * 0.5 * (out[i - P:i - P + m] + out[i - P - 1:i - P - 1 + m])
        i += P
    return out[1:n + 1]


def gusli_note(rng, f, vel=1.0, dur=3.0):
    """two slightly detuned strings, a soft wooden body (bandpasses at ~250 Hz and ~1.1 kHz), fast attack"""
    y = ks(f, dur, rng, decay_s=rng.uniform(1.5, 2.1)) + 0.7 * ks(f * 2 ** (rng.uniform(2.0, 5.0) / 1200), dur, rng,
                                                                  decay_s=1.6)
    body = filt(y, [('bp', 250.0, 1.2)], pad_s=0.05) * 0.5 + filt(y, [('bp', 1100.0, 1.0)], pad_s=0.05) * 0.4
    y = norm1(y + body)
    return attack(vel * y, 0.4)


N = {'A2': 110.0, 'Bb2': 116.54, 'C3': 130.81, 'D3': 146.83, 'A3': 220.0, 'Bb3': 233.08, 'C4': 261.63, 'D4': 293.66,
     'E4': 329.63, 'F4': 349.23, 'G4': 392.0, 'A4': 440.0, 'Bb4': 466.16, 'C5': 523.25, 'C#5': 554.37, 'D5': 587.33,
     'E5': 659.26, 'F5': 698.46, 'G5': 783.99, 'A5': 880.0}
CHORDS = [('D3', ['D4', 'A4', 'D5', 'F5', 'A5', 'F5', 'D5', 'A4']),
          ('C3', ['C4', 'G4', 'C5', 'E5', 'G5', 'E5', 'C5', 'G4']),
          ('Bb2', ['Bb3', 'F4', 'Bb4', 'D5', 'F5', 'D5', 'Bb4', 'F4']),
          ('A2', ['A3', 'E4', 'A4', 'C#5', 'E5', 'C#5', 'A4', 'E4'])]


def horn(rng, notes, dur):
    """cow-horn / war horn: buzzy additive tone with a brass formant, scoop into each note, breath noise"""
    n = ns(dur)
    t = tvec(n)
    f = np.zeros(n)
    amp = np.zeros(n)
    for f0, t0, t1 in notes:
        a, b = ns(t0), min(n, ns(t1))
        tt = t[a:b] - t0
        f[a:b] = f0 * (1.0 - 0.06 * np.exp(-tt / 0.07)) * (1 + 0.003 * np.sin(TAU * 5.2 * tt))
        amp[a:b] = np.clip(tt / 0.09, 0, 1) * np.clip((t1 - t[a:b]) / 0.25, 0, 1)
    f[f == 0] = notes[0][0]
    brass = formant_fn([(480.0, 1.6, 1.0), (1150.0, 2.2, 0.7), (2400.0, 3.0, 0.3)], hp=70.0, floor=0.05)
    y = harm_tone(f, brass, hmax=40, fmax=6000.0) * amp
    br = filt(rng.standard_normal(n), [('bp', 900.0, 0.8)], pad_s=0.05) * amp
    y = norm1(y) + 0.05 * norm1(br)
    return softclip(1.4 * y, 1.3)


def wingbeat(rng, rate, dur, band, clap=0.0, lift=1.0):
    """flapping wings: a noise burst per stroke at `rate` Hz, optional clap on the first strokes (pigeon take-off)"""
    n = ns(dur)
    t = tvec(n)
    y = np.zeros(n)
    nz = filt(rng.standard_normal(n), [('bp', band[0], band[1])], pad_s=0.05)
    k = 0
    tt = rng.uniform(0.0, 0.02)
    while tt < dur - 0.05:
        a = ns(tt)
        L = min(n - a, ns(0.06))
        e = np.sin(np.pi * np.arange(L) / L) ** 2 * (1.0 - 0.5 * (tt / dur)) * rng.uniform(0.7, 1.0)
        y[a:a + L] += nz[a:a + L] * e
        if clap > 0 and k < 4:
            c = filt(rng.standard_normal(ns(0.02)), [('bp', 2600.0, 1.2)], pad_s=0.02) * np.exp(-np.arange(ns(0.02)) / ns(0.004))
            y[a:a + c.size] += clap * norm1(c)[:n - a]
        k += 1
        tt += 1.0 / (rate * rng.uniform(0.92, 1.08))
    return y * lift


def scrape(rng, dur, modes, sweep=0.1):
    """metal against metal: noise through resonant bandpasses whose centres slide up, then a ring"""
    n = ns(dur)
    t = tvec(n)
    y = np.zeros(n)
    src = rng.standard_normal(n) * np.clip(t / 0.05, 0, 1) * np.clip((0.55 - t) / 0.1, 0, 1)
    for i, fm in enumerate(modes):
        seg = filt(src, [('bp', fm * (1 + sweep * 0.5), 6.0)], pad_s=0.05)
        y += seg / (i + 1) ** 0.5
        ring = np.sin(TAU * fm * (1 + sweep) * t + rng.uniform(0, TAU)) * np.exp(-np.maximum(t - 0.5, 0) / rng.uniform(0.25, 0.6))
        y += 0.25 * ring * (t > 0.48) / (i + 1)
    return norm1(y)


# ============================================================================
# loops (4 bars @ 80 bpm)
# ============================================================================
DRUM_BARS = ['B..bT.b.', 'B..bT...', 'B..bT.b.', 'B.bbTbTT']    # B big drum, b mid drum, T frame-drum edge


@osound('war_drums', LOOP, 'loop', hit=0.0, norm=('rms', -19.0), loop=True, hp=28.0,
        desc="Epic war drums, 80 bpm, 4 bars: big low drum (membrane modes from 52 Hz) on 1, a mid drum answer, "
             "frame-drum edge strokes on 3 and a fill in bar 4, big hall. Loops seamlessly.")
def gen_war_drums(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b, bar in enumerate(DRUM_BARS):
        for i, c in enumerate(bar):
            t0 = b * BAR + i * E8 + r.uniform(-0.006, 0.006)
            if c == 'B':
                put_wrap(x, drum(r, 'dum', f0=52.0, vel=r.uniform(0.9, 1.0), dur=1.6), t0, 1.0, p=-0.05)
            elif c == 'b':
                put_wrap(x, drum(r, 'dum', f0=84.0, vel=r.uniform(0.75, 0.9), dur=1.0), t0, 0.6, p=0.25)
            elif c == 'T':
                put_wrap(x, drum(r, 'tak', f0=120.0, vel=r.uniform(0.8, 1.0), dur=0.6), t0, 0.45, p=-0.3)
    x = creverb(x, hall_ir(name, 2, 2.2), 0.3)
    return dict(x=x)


@osound('war_drums_lite', LOOP, 'loop', hit=0.0, norm=('rms', -21.0), loop=True, hp=28.0,
        desc="Slow pulse of the war drums, 80 bpm, 4 bars: big drum on 1, frame-drum edge on 3, big hall. "
             "Loops seamlessly.")
def gen_war_drums_lite(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b in range(4):
        put_wrap(x, drum(r, 'dum', f0=52.0, vel=r.uniform(0.85, 1.0), dur=1.6), b * BAR, 1.0, p=-0.05)
        put_wrap(x, drum(r, 'tak', f0=120.0, vel=0.8, dur=0.6), b * BAR + 2 * BEAT, 0.35, p=-0.3)
    x = creverb(x, hall_ir(name, 2, 2.6), 0.35)
    return dict(x=x)


@osound('gusli_tune', LOOP, 'loop', hit=0.0, norm=('rms', -22.0), loop=True, hp=60.0,
        desc="Gusli ostinato, 80 bpm, 4 bars: plucked strings in eighths over Dm - C - Bb - A (A major chord), "
             "a low string on every bar, wooden body, hall. Original. Loops seamlessly.")
def gen_gusli_tune(name, D):
    x = np.zeros((2, ns(D)))
    r = rng_for(name, 1)
    for b, (bass, arp) in enumerate(CHORDS):
        put_wrap(x, gusli_note(r, N[bass], 0.9, dur=4.0), b * BAR + r.uniform(0, 0.01), 0.8, p=-0.2)
        for i, nt in enumerate(arp):
            v = (1.0 if i % 2 == 0 else 0.75) * r.uniform(0.85, 1.0)
            put_wrap(x, gusli_note(r, N[nt], v, dur=3.0), b * BAR + i * E8 + r.uniform(-0.008, 0.008), 0.55,
                     p=-0.1 + 0.25 * (i % 4) / 3)
    x = creverb(x, hall_ir(name, 2, 2.0), 0.28)
    return dict(x=x)


@osound('choir_low', LOOP, 'loop', hit=0.0, norm=('rms', -23.0), loop=True, hp=40.0,
        desc="Low male choir drone 'oo' on D2 + A2 + D3 (3 voices each, vowel-o formants, slow vibrato with "
             "whole cycles per loop), hall. Loops seamlessly.")
def gen_choir_low(name, D):
    n = ns(D)
    t = tvec(n)
    vowel = formant_fn([(430.0, 4.0, 1.0), (800.0, 5.0, 0.6), (2600.0, 8.0, 0.15)], hp=60.0, floor=0.03)
    x = np.zeros((2, n))
    for i, f0 in enumerate([73.42, 110.0, 146.83]):
        for v in range(3):
            r = rng_for(name, 10 * i + v)
            fi = int_cycles(f0 * 2 ** (r.uniform(-6.0, 6.0) / 1200), D)
            vib = 1 + 0.002 * np.sin(TAU * round(r.uniform(40, 60)) * t / D + r.uniform(0, TAU))
            y = harm_tone(fi * vib, vowel, hmax=int(3500 / f0), fmax=3500.0)
            y = np.roll(y, int(r.integers(n)))          # voices must not all start their cycle together
            x += pan(norm1(y) * (1.0 if i < 2 else 0.7), r.uniform(-0.5, 0.5))
    x = cfilt(x, [('lp', 3000.0, 0.7071)])
    x = creverb(x, hall_ir(name, 100, 2.8), 0.45)
    return dict(x=x)


@osound('crowd_feast', 10.0, 'loop', hit=0.0, norm=('rms', -28.0), loop=True, hp=80.0,
        desc="Feast murmur: 26 voices of talk (syllable-rate noise in speech bands, phrases and pauses), a few "
             "cup knocks, open-air echo. Loops seamlessly.")
def gen_crowd_feast(name, D):
    n = ns(D)
    t = tvec(n)
    x = np.zeros((2, n))
    for v in range(26):
        r = rng_for(name, v)
        fc = r.uniform(350.0, 1300.0)
        src = cfilt(r.standard_normal(n), [('bp', fc, 1.4), ('lp', 3000.0, 0.7071)])
        syl = 0.5 + 0.5 * np.sin(TAU * round(r.uniform(4.0, 6.0) * D) / D * t + r.uniform(0, TAU))
        cur = sum(r.uniform(0.5, 1.0) * np.sin(TAU * r.integers(2, 12) * t / D + r.uniform(0, TAU)) for _ in range(5))
        talk = cfilt((cur > -0.6).astype(float), [('lp', 8.0, 0.7071)])          # phrases and pauses, periodic
        x += pan(norm1(src) * syl ** 2 * np.clip(talk, 0, 1) * 10 ** (r.uniform(-10.0, 0.0) / 20), r.uniform(-0.8, 0.8))
    r = rng_for(name, 99)
    for k in range(9):
        L = ns(0.12)
        tk = np.arange(L) / SR
        c = np.sin(TAU * r.uniform(380.0, 700.0) * tk) * np.exp(-tk / 0.03)
        put_wrap(x, c, r.uniform(0, D), 0.25, p=r.uniform(-0.7, 0.7))
    x = creverb(x, field_ir(name, 100, 1.4), 0.35)
    return dict(x=x)


@osound('fire_big', 10.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=30.0,
        desc="A whole wooden town burning: deep flame roar with surges, dense crackles, pops and timber snaps, "
             "wide stereo. Loops seamlessly.")
def gen_fire_big(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    r = lambda k: rng_for(name, k)
    roar = filt(colored(n, r(1), -6.0, fmin=25, channels=2), [('lp', 420, 0.7071), ('hp', 30, 0.7071)])
    roar *= 1.0 + 0.45 * smooth_rand(n, 1.2, r(2))
    lick = filt(colored(n, r(3), -3.0, channels=2), [('bp', 700, 0.8)]) * gust_curve(n, 0.8, r(4)) ** 2
    rr = r(7)
    cr = np.zeros((2, n))
    tcur = 0.0
    while True:
        tcur += rr.exponential(1 / 55.0)
        if tcur >= n / SR - 0.12:
            break
        amp = min(0.25 * rr.lognormal(0, 0.7), 0.8)
        y = np.zeros(ns(0.1))
        if rr.random() < 0.8:
            o = 0.0
            for _ in range(rr.integers(1, 5)):
                c = crackle_click(rr, rr.uniform(1200, 6000), rr.uniform(0.00015, 0.0008), 0.35)
                i = ns(o)
                y[i:i + c.size] += c[:y.size - i] * rr.uniform(0.4, 1.0)
                o += rr.uniform(0.0005, 0.004)
        else:
            for _ in range(rr.integers(5, 13)):
                c = crackle_click(rr, rr.uniform(900, 5000), rr.uniform(0.0003, 0.0015))
                i = ns(rr.uniform(0.0, 0.07))
                y[i:i + c.size] += c[:y.size - i] * rr.uniform(0.5, 1.2)
            c = crackle_click(rr, rr.uniform(120, 260), 0.008)
            y[:c.size] += 1.4 * c
            amp *= 2.0
        place(cr, pan(y, rr.uniform(-0.8, 0.8)), tcur, amp)
    cr = filt(cr, [('hp', 250, 0.7071), ('lp', 8000, 0.7071)], pad_s=0.2)
    ir = make_ir(1.4, 0.6, r(9), predelay=0.01, er_span=0.05, lo_cut=120)
    cr = reverb(cr, ir, wet=0.15)
    bed = 0.8 * roar / rms(roar) + 0.35 * lick / rms(lick)
    x = bed + 1.4 * rms(bed) * cr / rms(cr)
    return dict(x=loopify(x[:, n0:], nl, nx))


# ============================================================================
# one-shots
# ============================================================================
@osound('drum_big', 2.2, 'hit', hit=0.002, fout=0.3,
        desc="One big war-drum stroke (52 Hz membrane, pitch dip, hand slap), big hall.")
def gen_drum_big(name, D):
    x = drum(rng_for(name, 1), 'dum', f0=52.0, vel=1.0, dur=1.8)
    return dict(x=mono_bass(reverb(widen(x, 0.08, rng_for(name, 2)), hall_ir(name, 3, 2.4), wet=0.3), 120.0))


@osound('horn_call', 4.5, 'hit', hit=0.05, fout=0.8, hp=40.0,
        desc="War horn call from a distance: A2 then D3 with a scoop into each note, buzzy brass formant, "
             "breath, field echo.")
def gen_horn_call(name, D):
    y = horn(rng_for(name, 1), [(110.0, 0.05, 1.25), (146.83, 1.35, 3.1)], D)
    y = filt(y, [('lp', 3200.0, 0.7071)], pad_s=0.1)
    x = reverb(widen(y, 0.1, rng_for(name, 2)), field_ir(name, 3, 2.2), wet=0.45)
    return dict(x=x)


@osound('wings_flock', 3.0, 'hit', hit=0.03, fout=0.6, hp=150.0,
        desc="A flock taking off: 30 pigeons (wing claps, ~9 Hz strokes) and 30 sparrows (fast light strokes), "
             "spreading across the stereo field and flying away (level and brightness drop).")
def gen_wings_flock(name, D):
    n = ns(D)
    t = tvec(n)
    x = np.zeros((2, n))
    for k in range(60):
        r = rng_for(name, k)
        pigeon = k < 30
        t0 = r.uniform(0.0, 0.7)
        dur = r.uniform(1.0, 2.2)
        y = wingbeat(r, r.uniform(8.0, 10.5) if pigeon else r.uniform(17.0, 22.0), dur,
                     (r.uniform(700, 1400), 0.8) if pigeon else (r.uniform(2200, 3800), 1.0),
                     clap=0.8 if pigeon else 0.0)
        g = (1.0 if pigeon else 0.45) * 10 ** (r.uniform(-8.0, 0.0) / 20)
        place(x, pan(y, r.uniform(-0.9, 0.9)), t0, g)
    away = np.clip(1.0 - (t - 0.6) / (D - 0.6), 0.15, 1.0)
    x = x * away
    x = reverb(x, field_ir(name, 100, 1.2), wet=0.2)
    return dict(x=x)


@osound('wings_pigeon', 1.4, 'hit', hit=0.02, fout=0.3, hp=150.0,
        desc="One pigeon flapping up close: wing claps on take-off, ~9 Hz strokes, then a glide.")
def gen_wings_pigeon(name, D):
    r = rng_for(name, 1)
    y = wingbeat(r, 9.0, 0.95, (1000.0, 0.8), clap=1.0)
    x = pan(np.concatenate([y, np.zeros(ns(D) - y.size)]), 0.15)
    x = reverb(x, field_ir(name, 2, 0.8), wet=0.12)
    return dict(x=x)


@osound('fire_ignite', 2.6, 'hit', hit=0.12, fout=0.6, hp=30.0,
        desc="Flames catching: a low whumph, a rising roar sweep (300 Hz -> 2.5 kHz bandpass), crackles flaring up.")
def gen_fire_ignite(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    thump = np.sin(phase_of(48.0 * (1 + 0.8 * np.exp(-t / 0.05)))) * env_ad(n, 0.1, 0.01, 0.35)
    nz = colored(n, r, -3.0, fmin=40)
    fc = 300.0 * (2500.0 / 300.0) ** np.clip((t - 0.05) / 0.7, 0, 1)
    sweep = B.tv_filter(nz, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 20.0) / np.interp(tt, t, fc)) / 0.7) ** 2))
    sweep = norm1(sweep) * env_ad(n, 0.05, 0.25, 1.4)
    roar = norm1(filt(colored(n, rng_for(name, 2), -6.0, fmin=25), [('lp', 400, 0.7071)])) * env_ad(n, 0.15, 0.4, 1.8)
    cr = np.zeros(n)
    for k in range(120):
        tc = 0.2 + r.exponential(0.5)
        if tc > D - 0.1:
            continue
        c = crackle_click(r, r.uniform(1200, 6000), r.uniform(0.0002, 0.001), 0.35)
        a = ns(tc)
        cr[a:a + c.size] += c[:n - a] * r.uniform(0.2, 1.0) * np.exp(-(tc - 0.2) / 1.2)
    y = 0.9 * norm1(thump) + 0.6 * sweep + 0.7 * roar + 0.35 * norm1(cr)
    x = reverb(widen(y, 0.25, rng_for(name, 3)), field_ir(name, 4, 1.0), wet=0.15)
    return dict(x=x)


@osound('dirt_throw', 1.8, 'hit', hit=0.18, fout=0.3, hp=40.0,
        desc="Three shovelfuls of earth thrown onto a wooden boat in a pit: soil sliding off the shovel, a hollow "
             "wooden thud, a shower of grains.")
def gen_dirt_throw(name, D):
    n = ns(D)
    t = tvec(n)
    y = np.zeros(n)
    for j, t0 in enumerate([0.0, 0.55, 1.05]):
        r = rng_for(name, j)
        whsh = filt(r.standard_normal(n), [('bp', 2200.0, 0.8)], pad_s=0.05) * env_ad(n, t0, 0.06, 0.08)
        th = t0 + 0.18
        tt = np.maximum(t - th, 0.0)
        thud = (np.sin(phase_of(110.0 * (1 + 0.3 * np.exp(-tt / 0.02)))) + 0.5 * np.sin(TAU * 240.0 * tt)) * env_ad(n, th, 0.003, 0.09)
        body = filt(r.standard_normal(n), [('lp', 900.0, 0.7071)], pad_s=0.05) * env_ad(n, th, 0.004, 0.12)
        grains = np.zeros(n)
        for k in range(140):
            tg = th + r.exponential(0.07)
            a = ns(tg)
            if a >= n - 100:
                continue
            c = crackle_click(r, r.uniform(2000, 7000), r.uniform(0.0001, 0.0004), 0.6)
            grains[a:a + c.size] += c[:n - a] * r.uniform(0.2, 1.0)
        y += (1.0 - 0.15 * j) * (0.35 * norm1(whsh) + 0.8 * norm1(thud) + 0.5 * norm1(body) + 0.3 * norm1(grains))
    x = reverb(widen(y, 0.2, rng_for(name, 9)), field_ir(name, 10, 0.7), wet=0.12)
    return dict(x=x)


@osound('door_bar', 1.4, 'hit', hit=0.01, fout=0.3, hp=40.0,
        desc="A heavy wooden beam dropped into the brackets of a log door: wooden knock (modes 190-1230 Hz), "
             "a second smaller knock, iron rattle.")
def gen_door_bar(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    y = np.zeros(n)
    for t0, g in [(0.01, 1.0), (0.11, 0.45)]:
        tt = np.maximum(t - t0, 0.0)
        on = t >= t0
        for fm, dec, a in [(190.0, 0.14, 1.0), (410.0, 0.09, 0.7), (760.0, 0.06, 0.45), (1230.0, 0.04, 0.3)]:
            y += g * a * on * np.sin(TAU * fm * r.uniform(0.98, 1.02) * tt) * np.exp(-tt / dec)
        y += g * 0.6 * norm1(filt(r.standard_normal(n), [('bp', 1500.0, 0.8)], pad_s=0.05)) * env_ad(n, t0, 0.001, 0.01)
    rat = np.zeros(n)
    for k in range(10):
        tc = 0.13 + r.uniform(0, 0.25)
        L = ns(0.04)
        tk = np.arange(L) / SR
        c = np.sin(TAU * r.uniform(2500, 4200) * tk) * np.exp(-tk / 0.008)
        a = ns(tc)
        rat[a:a + L] += c[:n - a] * r.uniform(0.2, 0.6)
    y = norm1(y) + 0.2 * norm1(rat)
    x = reverb(widen(y, 0.1, rng_for(name, 2)), field_ir(name, 3, 0.8), wet=0.15)
    return dict(x=x)


@osound('swords_draw', 1.8, 'hit', hit=0.1, fout=0.5, hp=200.0,
        desc="Four swords drawn from scabbards one after another: metal scrape sliding up, then a ring.")
def gen_swords_draw(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    for k, t0 in enumerate([0.0, 0.12, 0.27, 0.36]):
        r = rng_for(name, k)
        modes = [r.uniform(2100, 2600), r.uniform(3400, 4000), r.uniform(5000, 5600), r.uniform(7000, 7800)]
        y = scrape(r, 1.4, modes, sweep=r.uniform(0.06, 0.14))
        place(x, pan(y, r.uniform(-0.7, 0.7)), t0, 1.0 - 0.15 * k)
    x = reverb(x, field_ir(name, 9, 1.0), wet=0.2)
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
    man['title'] = "«Месть княгини Ольги» - original synthesized epic kit (80 bpm, 4-bar loops)"
    man['generator'] = "make_sfx_olga.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    man['tempo'] = dict(bpm=BPM, beat_s=BEAT, loop_bars=4, loop_s=LOOP)
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
