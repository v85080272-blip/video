#!/usr/bin/env python3
"""
make_sfx_veshchi.py -- original sounds for «Вещи на три дня» (Pripyat, 27 April 1986; Тайны истории №12).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The sounds the other kits lack: a flat's
door shut and locked for the last time, a small suitcase snapped shut, the kitchen wall radio's hum, a bus idling (a diesel's low rumble) and its
pneumatic doors. The Geiger counter, the birds, the wind and the music come from the rescue,
chernobyl and base kits.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./veshchi/)
Usage:   SFX_OUT=/home/user/work/sfx/veshchi python3 make_sfx_veshchi.py [--only bus_idle,door_lock]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, widen, mono_bass, make_ir, reverb, colored, smooth_rand,
                      rms, loop_buffer, loopify)
from make_sfx_dance import norm1
from make_sfx_kozelsk import ksound, modes_hit, NEW

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'veshchi'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def flat_ir(name, k, rt=0.7):
    """a stairwell landing in a panel block: concrete, a short bright slap"""
    return make_ir(rt, 0.5 * rt, rng_for(name, k), predelay=0.006, er=8, er_span=0.04, lo_cut=100, hi_cut=7000)


def street_ir(name, k, rt=1.2):
    """a street between white blocks: a few far reflections, open sky"""
    return make_ir(rt, 0.4 * rt, rng_for(name, k), predelay=0.03, er=5, er_span=0.15, lo_cut=60, hi_cut=5000)


@ksound('door_lock', 2.5, 'hit', hit=0.1, fout=0.5, hp=40.0,
        desc="A flat's padded door shut for the last time: a heavy wooden thump with the latch's click at 0.1 s, "
             "then a key turned twice in the lock (two metal clacks at 0.9 and 1.35 s), on a concrete landing.")
def gen_door_lock(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = norm1(modes_hit(n, 0.1, r, [(85.0, 0.12, 1.0), (190.0, 0.07, 0.6), (420.0, 0.04, 0.35)]))
    y += 0.5 * norm1(modes_hit(n, 0.105, r, [(2300.0, 0.006, 1.0), (3900.0, 0.004, 0.6)]))
    for t0 in (0.9, 1.35):
        y += 0.45 * norm1(modes_hit(n, t0, r, [(1700.0, 0.01, 1.0), (2900.0, 0.006, 0.7), (5200.0, 0.003, 0.4)]))
        y += 0.15 * norm1(modes_hit(n, t0 + 0.06, r, [(2400.0, 0.008, 1.0)]))
    x = reverb(widen(y, 0.2, rng_for(name, 2)), flat_ir(name, 3), wet=0.3)
    return dict(x=mono_bass(x, 150.0))


@ksound('suitcase_shut', 1.6, 'hit', hit=0.05, fout=0.4, hp=60.0,
        desc="A small suitcase snapped shut on a bed: the lid's soft thump at 0.05 s, then two spring latches "
             "clicking at 0.35 and 0.55 s, a quiet room.")
def gen_suitcase_shut(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = norm1(modes_hit(n, 0.05, r, [(140.0, 0.05, 1.0), (330.0, 0.03, 0.4)]))
    y += 0.2 * norm1(filt(r.standard_normal(n), [('lp', 1200.0, 0.7071)], pad_s=0.05)
                     * np.exp(-np.maximum(tvec(n) - 0.05, 0) / 0.03) * (tvec(n) >= 0.05))
    for t0 in (0.35, 0.55):
        y += 0.6 * norm1(modes_hit(n, t0, r, [(3100.0, 0.005, 1.0), (4700.0, 0.003, 0.6), (1500.0, 0.008, 0.4)]))
    x = reverb(widen(y, 0.15, rng_for(name, 2)), flat_ir(name, 3, 0.4), wet=0.15)
    return dict(x=x)


@ksound('bus_idle', 8.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=20.0,
        desc="A row of old buses idling in a street: diesels firing around 12-14 Hz with a low 40-120 Hz rumble and "
             "a rattling panel, several engines slightly apart, between apartment blocks. Loops seamlessly.")
def gen_bus_idle(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    t = tvec(n)
    y = np.zeros(n)
    for j, (f0, a) in enumerate([(12.5, 1.0), (13.7, 0.6), (11.8, 0.45)]):
        f = f0 * (1.0 + 0.02 * smooth_rand(n, 0.5, rng_for(name, 10 + j)))
        ph = TAU * np.cumsum(f) / SR
        pulses = np.maximum(np.sin(ph), 0.0) ** 6
        body = filt(pulses * colored(n, rng_for(name, 20 + j), -3.0, fmin=20), [('lp', 220.0, 0.7071)])
        hum = sum(np.sin(k * ph * 4 + k) / k for k in (1, 2, 3))
        y += a * (norm1(body) + 0.3 * norm1(hum))
    rattle = filt(colored(n, rng_for(name, 2), -1.0), [('bp', 900.0, 2.0)])
    rattle *= np.maximum(np.sin(TAU * 12.5 * t), 0.0) ** 8
    y += 0.12 * norm1(rattle)
    x = reverb(widen(y, 0.5, rng_for(name, 3)), street_ir(name, 4), wet=0.3)
    return dict(x=loopify(mono_bass(x, 120.0)[:, n0:], nl, nx))


@ksound('bus_door', 1.8, 'hit', hit=0.05, fout=0.4, hp=60.0,
        desc="An old bus's pneumatic doors: a sharp air hiss from 0.05 s, the folding doors banging shut at "
             "0.45 s with a rubber-and-metal thud, a short release sigh, out in the street.")
def gen_bus_door(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    hiss = filt(r.standard_normal(n), [('hp', 2500.0, 0.7071), ('lp', 9000.0, 0.7071)], pad_s=0.05)
    env = np.clip((t - 0.05) / 0.02, 0, 1) * np.exp(-np.maximum(t - 0.05, 0) / 0.25)
    y = 0.7 * norm1(hiss * env)
    y += norm1(modes_hit(n, 0.45, r, [(110.0, 0.08, 1.0), (260.0, 0.05, 0.6), (740.0, 0.02, 0.4)]))
    sigh = filt(rng_for(name, 2).standard_normal(n), [('bp', 1800.0, 0.8)], pad_s=0.05)
    y += 0.25 * norm1(sigh * np.clip((t - 0.6) / 0.05, 0, 1) * np.exp(-np.maximum(t - 0.6, 0) / 0.3))
    x = reverb(widen(y, 0.25, rng_for(name, 3)), street_ir(name, 4), wet=0.25)
    return dict(x=mono_bass(x, 150.0))


@ksound('radio_hum', 6.0, 'loop', hit=0.0, norm=('rms', -30.0), loop=True, hp=150.0,
        desc="A Soviet kitchen wall radio left on: the small speaker's mains hum (100 Hz and up, thin), a soft "
             "broadband hiss and sparse crackles, close in a small kitchen. Loops seamlessly.")
def gen_radio_hum(name, D):
    xf, pre = 0.6, 0.3
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    t = tvec(n)
    hum = sum(np.sin(TAU * 100.0 * k * t + k) / k for k in range(1, 8))
    hiss = filt(colored(n, rng_for(name, 1), 0.0), [('bp', 2500.0, 0.6)])
    r = rng_for(name, 2)
    cr = np.zeros(n)
    tc = 0.0
    while True:
        tc += r.exponential(1 / 3.0)
        if tc >= n / SR - 0.05:
            break
        cr += r.uniform(0.2, 1.0) * modes_hit(n, tc, r, [(r.uniform(1500, 4000), 0.002, 1.0)])
    y = 0.4 * norm1(hum) + 0.5 * norm1(hiss) + 0.3 * norm1(cr)
    y = filt(y, [('hp', 250.0, 0.7071), ('lp', 5000.0, 0.7071)])
    x = reverb(widen(y, 0.1, rng_for(name, 3)), flat_ir(name, 4, 0.3), wet=0.15)
    return dict(x=loopify(x[:, n0:], nl, nx))


def main():
    only = ''
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]
    names = [s for s in only.split(',') if s] or NEW
    sys.argv = [sys.argv[0], '--only', ','.join(names), '--outdir', OUT]
    rc = B.main()
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    man['title'] = "«Вещи на три дня» (Припять, 27 апреля 1986) - original synthesized sounds"
    man['generator'] = "make_sfx_veshchi.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
