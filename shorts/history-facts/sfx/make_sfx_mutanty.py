#!/usr/bin/env python3
"""
make_sfx_mutanty.py -- original sounds for «Мутанты Чернобыля» (the zone's animals; Тайны истории №14).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The sounds the other kits lack: tree frogs
calling at night (a chorus bed and one close frog), barn swallows twittering, a big catfish's tail slapping the water,
a herd of wild horses trotting past and a flashlight clicked on in a basement. The wolf comes from the babushki kit,
the Geiger counter and the basement hum from the chernobyl kit, the birds, the wind and the music from the base and
rescue kits.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./mutanty/)
Usage:   SFX_OUT=/home/user/work/sfx/mutanty python3 make_sfx_mutanty.py [--only frog_call,hooves]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, widen, mono_bass, make_ir, reverb, colored, smooth_rand,
                      pan, loop_buffer, loopify, bird_note)
from make_sfx_dance import norm1
from make_sfx_rescue import bubbles
from make_sfx_kozelsk import ksound, modes_hit, NEW

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mutanty'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def pond_ir(name, k, rt=1.1):
    """a pond in the forest at night: open air, a few far tree-line reflections"""
    return make_ir(rt, 0.4 * rt, rng_for(name, k), predelay=0.03, er=5, er_span=0.2, lo_cut=150, hi_cut=6000)


def frog_notes(n, t0, rng, notes=8, rate=11.0, f0=2000.0):
    """one tree frog's call: a run of short nasal «krek» notes, each a burst of fast pulses on a ~2 kHz carrier"""
    t = tvec(n)
    y = np.zeros(n)
    fc = f0 * rng.uniform(0.92, 1.08)
    for j in range(notes):
        tn = t0 + j / rate * rng.uniform(0.97, 1.03)
        d = 0.045
        on = (t >= tn) & (t < tn + d)
        u = np.clip((t - tn) / d, 0, 1)
        pulses = np.maximum(np.sin(TAU * 190.0 * (t - tn)), 0.0) ** 3
        car = np.sin(TAU * fc * t) + 0.4 * np.sin(TAU * 2 * fc * t + 1.0)
        y += on * np.sin(np.pi * u) * pulses * car
    return y


@ksound('frog_chorus', 8.0, 'loop', hit=0.0, norm=('rms', -28.0), loop=True, hp=300.0,
        desc="Tree frogs calling at night around a forest pond: six frogs at different distances, each a run of "
             "nasal pulsed «krek-krek» notes near 2 kHz, overlapping, crickets faint underneath. Loops seamlessly.")
def gen_frog_chorus(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    y = np.zeros((2, n))
    for f in range(6):
        r = rng_for(name, 10 + f)
        g = r.uniform(0.25, 1.0)
        p = r.uniform(-0.8, 0.8)
        tc = r.uniform(0.0, 1.5)
        while tc < n / SR - 1.0:
            v = frog_notes(n, tc, r, notes=int(r.integers(5, 12)), rate=r.uniform(9.0, 13.0))
            v = filt(v, [('lp', 2500.0 + 3000.0 * g, 0.7071)])
            y += g * pan(v, p)
            tc += r.uniform(1.4, 3.2)
    t = tvec(n)
    crick = filt(colored(n, rng_for(name, 2), 0.0), [('bp', 4300.0, 8.0)]) * (np.sin(TAU * 28.0 * t) > 0.3)
    y += 0.05 * norm1(crick)
    x = reverb(y, pond_ir(name, 3), wet=0.35)
    return dict(x=loopify(x[:, n0:], nl, nx))


@ksound('frog_call', 2.0, 'hit', hit=0.1, fout=0.4, hp=300.0,
        desc="One tree frog right by the camera: a run of eight loud nasal pulsed «krek» notes near 2 kHz from "
             "0.1 s, about eleven a second, a little pond echo.")
def gen_frog_call(name, D):
    n = ns(D)
    y = frog_notes(n, 0.1, rng_for(name, 1), notes=8, rate=11.0, f0=2100.0)
    x = reverb(widen(y, 0.15, rng_for(name, 2)), pond_ir(name, 3, 0.8), wet=0.2)
    return dict(x=x)


@ksound('swallow_twitter', 3.0, 'hit', hit=0.1, fout=0.5, hp=1500.0,
        desc="A barn swallow twittering on a wire: quick bright chirps sweeping 3-8 kHz from 0.1 s, a dry buzzy "
             "rattle in the middle, a second bird answering further off, open air.")
def gen_swallow_twitter(name, D):
    n = ns(D)
    y = np.zeros((2, n))
    for b, (g, p, t0) in enumerate([(1.0, -0.15, 0.1), (0.4, 0.5, 0.9)]):
        r = rng_for(name, 10 + b)
        tc = t0
        while tc < t0 + 1.6:
            d = r.uniform(0.04, 0.09)
            f0, f1 = r.uniform(3000, 5500), r.uniform(4500, 8000)
            note = bird_note(d, f0, f1, r, vib=(r.uniform(30, 60), r.uniform(0.0, 0.08)))
            i = ns(tc)
            seg = note[:max(0, n - i)]
            y[:, i:i + len(seg)] += g * pan(seg, p)
            tc += d + r.uniform(0.02, 0.07)
        tr = ns(t0 + 0.7)
        rat = filt(rng_for(name, 20 + b).standard_normal(ns(0.3)), [('bp', 5200.0, 3.0)])
        rat *= (np.sin(TAU * 70.0 * np.arange(len(rat)) / SR) > 0).astype(float)
        y[:, tr:tr + len(rat)] += 0.5 * g * pan(norm1(rat), p)
    x = reverb(y, make_ir(0.6, 0.3, rng_for(name, 3), predelay=0.02, er=4, er_span=0.1, lo_cut=1000,
                         hi_cut=9000), wet=0.15)
    return dict(x=x)


@ksound('catfish_splash', 3.0, 'hit', hit=0.1, fout=0.6, hp=40.0,
        desc="A huge catfish rolling at the surface: a heavy hollow tail slap on the water at 0.1 s, a spray of "
             "droplets falling back, bubbles and a slow wave lapping against concrete.")
def gen_catfish_splash(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    tt = np.maximum(t - 0.1, 0.0)
    on = t >= 0.1
    slap = filt(r.standard_normal(n), [('bp', 700.0, 0.8)], pad_s=0.05) * on * np.exp(-tt / 0.05)
    thump = on * np.sin(TAU * 70.0 * tt) * np.exp(-tt / 0.12)
    y = norm1(slap) + 0.6 * norm1(thump)
    drops = bubbles(rng_for(name, 2), n, 40.0, 900.0, 2600.0, 0.008, 0.025, t0=0.25, t1=1.4, amp=(0.1, 0.6))
    y += 0.45 * norm1(drops)
    y += 0.25 * norm1(bubbles(rng_for(name, 3), n, 12.0, 300.0, 700.0, 0.02, 0.06, t0=0.2, t1=2.0))
    lap = filt(colored(n, rng_for(name, 4), -3.0), [('lp', 600.0, 0.7071)]) * np.exp(-np.maximum(t - 1.2, 0) / 0.6)
    lap *= (t >= 1.0) * (0.5 + 0.5 * np.sin(TAU * 0.9 * t))
    y += 0.3 * norm1(lap)
    x = reverb(widen(y, 0.3, rng_for(name, 5)), make_ir(0.9, 0.4, rng_for(name, 6), predelay=0.01, er=6,
                                                        er_span=0.05, lo_cut=60, hi_cut=6000), wet=0.25)
    return dict(x=mono_bass(x, 120.0))


@ksound('hooves', 5.0, 'hit', hit=0.5, fout=0.8, hp=40.0,
        desc="A small herd of wild horses trotting past on soft earth and grass: dull hoof thuds in a two-beat trot "
             "from about 0.5 s, several horses slightly apart, a snort at 1.6 s, passing left to right and fading.")
def gen_hooves(name, D):
    n = ns(D)
    t = tvec(n)
    y = np.zeros(n)
    for h in range(4):
        r = rng_for(name, 10 + h)
        tc = 0.5 + r.uniform(0.0, 0.25)
        step = r.uniform(0.33, 0.38)
        while tc < 4.2:
            for k in (0.0, 0.06):
                y += r.uniform(0.5, 1.0) * modes_hit(n, tc + k, r, [(r.uniform(90, 140), 0.03, 1.0),
                                                                     (r.uniform(300, 420), 0.012, 0.4)])
            tc += step
    sn = filt(rng_for(name, 2).standard_normal(n), [('bp', 900.0, 0.8)])
    sn *= ((t > 1.6) & (t < 2.0)) * np.sin(np.pi * np.clip((t - 1.6) / 0.4, 0, 1))
    y = norm1(y) + 0.3 * norm1(sn)
    p = np.clip((t - 0.5) / 3.7, 0, 1) * 1.6 - 0.8
    g = np.exp(-((t - 2.2) / 1.6) ** 2)
    x = np.stack([y * g * np.sqrt((1 - p) / 2), y * g * np.sqrt((1 + p) / 2)])
    x = reverb(x, make_ir(1.0, 0.4, rng_for(name, 3), predelay=0.03, er=4, er_span=0.15, lo_cut=60, hi_cut=4000),
               wet=0.2)
    return dict(x=mono_bass(x, 120.0))


@ksound('torch_click', 1.5, 'hit', hit=0.1, fout=0.5, hp=100.0,
        desc="A heavy flashlight switched on in a concrete basement: a stiff plastic click at 0.1 s with a tiny "
             "metal spring ring, a short close concrete echo.")
def gen_torch_click(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = modes_hit(n, 0.1, r, [(3200.0, 0.006, 1.0), (5400.0, 0.004, 0.6), (1700.0, 0.01, 0.5)])
    y += 0.3 * modes_hit(n, 0.105, r, [(6100.0, 0.08, 1.0)])
    x = reverb(widen(y, 0.1, rng_for(name, 2)), make_ir(0.8, 0.5, rng_for(name, 3), predelay=0.004, er=10,
                                                        er_span=0.03, lo_cut=200, hi_cut=8000), wet=0.3)
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
    man['title'] = "«Мутанты Чернобыля» (животные зоны) - original synthesized sounds"
    man['generator'] = "make_sfx_mutanty.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
