#!/usr/bin/env python3
"""
make_sfx_babushki.py -- original sounds for «Бабушки Чернобыля» (the samosely; Тайны истории №13).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The sounds the other kits lack: footsteps
on a forest path, a spade digging potatoes, a bucket wound up a village well, and a wolf howling over the empty
village. The birds, the wind, the Geiger counter and the music come from the base, rescue and chernobyl kits.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./babushki/)
Usage:   SFX_OUT=/home/user/work/sfx/babushki python3 make_sfx_babushki.py [--only well,wolf_howl]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import SR, TAU, ns, tvec, rng_for, filt, widen, mono_bass, make_ir, reverb, colored, smooth_rand
from make_sfx_dance import norm1
from make_sfx_rescue import bubbles
from make_sfx_kozelsk import ksound, modes_hit, NEW

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'babushki'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def yard_ir(name, k, rt=0.9):
    """a village yard: open air, a wooden house and a fence close by"""
    return make_ir(rt, 0.4 * rt, rng_for(name, k), predelay=0.02, er=4, er_span=0.1, lo_cut=80, hi_cut=6000)


def crunch(rng, n, t0, a, f=1800.0, dur=0.12):
    """one step or spade bite into soil, needles and twigs: a dull thud with a crackly top"""
    t = tvec(n)
    tt = np.maximum(t - t0, 0.0)
    on = t >= t0
    thud = filt(rng.standard_normal(n), [('lp', 300.0, 0.7071)], pad_s=0.05) * on * np.exp(-tt / 0.03)
    crk = np.zeros(n)
    for _ in range(int(rng.integers(6, 14))):
        tc = t0 + rng.uniform(0.0, dur)
        crk += rng.uniform(0.2, 1.0) * modes_hit(n, tc, rng, [(rng.uniform(0.6, 1.6) * f, 0.004, 1.0)])
    return a * (norm1(thud) + 0.5 * norm1(crk))


@ksound('steps_forest', 4.0, 'hit', hit=0.1, fout=0.5, hp=60.0,
        desc="An old woman walking slowly along a forest path: six unhurried steps on needles and dry twigs from "
             "0.1 s, about 0.6 s apart, a soft rustle of her bundle, open pine forest.")
def gen_steps_forest(name, D):
    n = ns(D)
    y = np.zeros(n)
    for j in range(6):
        r = rng_for(name, j)
        y += crunch(r, n, 0.1 + 0.62 * j + r.uniform(-0.03, 0.03), 1.0 - 0.06 * j)
    rus = filt(colored(n, rng_for(name, 9), 0.0), [('bp', 3000.0, 0.7)]) * (0.5 + 0.5 * smooth_rand(n, 2.0, rng_for(name, 10)))
    y += 0.08 * norm1(rus)
    x = reverb(widen(y, 0.3, rng_for(name, 11)), yard_ir(name, 12, 1.4), wet=0.2)
    return dict(x=x)


@ksound('dig', 3.0, 'hit', hit=0.1, fout=0.5, hp=50.0,
        desc="A spade digging potatoes in a garden: the blade bites into soil at 0.1 s with a scrape, earth and "
             "potatoes tumble at 0.7 s, a second bite at 1.6 s, outdoors.")
def gen_dig(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = crunch(r, n, 0.1, 1.0, f=1200.0, dur=0.2)
    y += 0.5 * norm1(modes_hit(n, 0.1, r, [(2100.0, 0.02, 1.0), (3300.0, 0.012, 0.6)]))
    for k in range(5):
        y += 0.35 * norm1(modes_hit(n, 0.7 + 0.07 * k, r, [(r.uniform(140, 260), 0.05, 1.0)]))
    y += 0.8 * crunch(rng_for(name, 2), n, 1.6, 1.0, f=1200.0, dur=0.2)
    x = reverb(widen(y, 0.25, rng_for(name, 3)), yard_ir(name, 4), wet=0.18)
    return dict(x=mono_bass(x, 150.0))


@ksound('well', 5.0, 'hit', hit=0.1, fout=0.8, hp=60.0,
        desc="A bucket wound up a village well: a wooden crank creaking in slow turns from 0.1 s with the chain "
             "rattling, water dripping off the rising bucket, a splash as it tips at 3.6 s.")
def gen_well(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    y = np.zeros(n)
    for k in range(5):
        t0 = 0.1 + 0.68 * k
        f = 420.0 + 60.0 * np.sin(TAU * 1.5 * np.maximum(t - t0, 0))
        ph = TAU * np.cumsum(f) / SR
        cr = filt(np.sin(ph) * (1 + 0.5 * r.standard_normal(n)), [('bp', 900.0, 2.0)])
        env = ((t >= t0) & (t < t0 + 0.4)) * np.sin(np.pi * np.clip((t - t0) / 0.4, 0, 1))
        y += 0.4 * norm1(cr * env)
        for c in range(4):
            y += 0.15 * norm1(modes_hit(n, t0 + 0.1 * c, r, [(r.uniform(2500, 4000), 0.006, 1.0)]))
    y += 0.3 * norm1(bubbles(rng_for(name, 2), n, 25.0, 700.0, 1800.0, 0.01, 0.03, t0=0.4, t1=3.5, amp=(0.1, 0.5)))
    sp = filt(rng_for(name, 3).standard_normal(n), [('bp', 1500.0, 0.6)], pad_s=0.05)
    y += 0.9 * norm1(sp * (t >= 3.6) * np.exp(-np.maximum(t - 3.6, 0) / 0.25))
    x = reverb(widen(y, 0.25, rng_for(name, 4)), yard_ir(name, 5), wet=0.2)
    return dict(x=x)


@ksound('wolf_howl', 5.0, 'hit', hit=0.3, fout=1.0, hp=150.0,
        desc="A lone wolf howling at dusk over an empty village: a voice rising from about 330 to 560 Hz at 0.3 s, "
             "holding with a slight waver, sliding down and fading by 4 s, far away with a long open echo.")
def gen_wolf_howl(name, D):
    n = ns(D)
    t = tvec(n)
    u = np.clip((t - 0.3) / 3.7, 0, 1)
    f = 330.0 + 230.0 * np.sin(np.pi * np.clip(u * 1.4, 0, 1)) ** 0.7 * (1 - 0.3 * u)
    f *= 1.0 + 0.012 * np.sin(TAU * 5.5 * t)
    ph = TAU * np.cumsum(f) / SR
    v = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    breath = filt(rng_for(name, 1).standard_normal(n), [('bp', 1200.0, 1.0)])
    env = np.clip((t - 0.3) / 0.35, 0, 1) * np.clip((4.0 - t) / 1.2, 0, 1)
    y = env * (norm1(v) + 0.06 * norm1(breath))
    x = reverb(widen(y, 0.2, rng_for(name, 2)), make_ir(3.0, 1.5, rng_for(name, 3), predelay=0.06, er=6,
                                                        er_span=0.3, lo_cut=150, hi_cut=4000), wet=0.55)
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
    man['title'] = "«Бабушки Чернобыля» (самосёлы зоны) - original synthesized sounds"
    man['generator'] = "make_sfx_babushki.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
