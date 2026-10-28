#!/usr/bin/env python3
"""
make_sfx_noga.py -- original sounds for «Слоновья нога» (the lava under the Chernobyl reactor; Тайны истории №15).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The sounds the other kits lack: a rifle shot
in a long concrete corridor (the sample was shot off the lava), a remote-controlled drill grinding uselessly on glassy
lava, molten lava pouring and hissing down a pipe, a small rover robot whining and dying on the roof, and shovels
throwing debris off a roof. The Geiger counter and the basement hum come from the chernobyl kit, the flashlight click
from the mutanty kit, the booms, risers and music from the base kit.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./noga/)
Usage:   SFX_OUT=/home/user/work/sfx/noga python3 make_sfx_noga.py [--only rifle_shot,drill_grind]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, widen, mono_bass, make_ir, reverb, colored, smooth_rand,
                      phase_of, osc_saw, softclip)
from make_sfx_dance import norm1
from make_sfx_rescue import bubbles
from make_sfx_kozelsk import ksound, modes_hit, NEW
from make_sfx_babushki import crunch

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'noga'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def corridor_ir(name, k, rt=2.6):
    """a long dry concrete corridor under the reactor: hard walls, pipes, a long flutter of slaps"""
    return make_ir(rt, 0.5 * rt, rng_for(name, k), predelay=0.01, er=16, er_span=0.2, lo_cut=80, hi_cut=7000)


def roof_ir(name, k, rt=0.8):
    """a flat roof in the open: a parapet and the chimney close by, then open air"""
    return make_ir(rt, 0.4 * rt, rng_for(name, k), predelay=0.02, er=4, er_span=0.08, lo_cut=80, hi_cut=6000)


@ksound('rifle_shot', 4.0, 'hit', hit=0.1, fout=1.2, hp=30.0,
        desc="One rifle shot in a long concrete corridor at 0.1 s: a hard crack and a low muzzle boom, a chip of "
             "glassy rock knocked off and pattering on the floor, the echo rolling away down the corridor for "
             "about two seconds.")
def gen_rifle_shot(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    tt = np.maximum(t - 0.1, 0.0)
    on = t >= 0.1
    crack = filt(r.standard_normal(n), [('hp', 1200.0, 0.7071)], pad_s=0.05) * on * np.exp(-tt / 0.006)
    boom = on * np.sin(phase_of(55.0 + 140.0 * np.exp(-tt / 0.02))) * np.exp(-tt / 0.09)
    body = filt(r.standard_normal(n), [('lp', 900.0, 0.7071)], pad_s=0.05) * on * np.exp(-tt / 0.04)
    y = softclip(norm1(crack) + 0.9 * norm1(boom) + 0.6 * norm1(body), 2.5)
    chips = np.zeros(n)
    for _ in range(9):
        tc = 0.18 + r.uniform(0.0, 0.5)
        chips += r.uniform(0.2, 1.0) * modes_hit(n, tc, r, [(r.uniform(3000, 6500), 0.005, 1.0),
                                                            (r.uniform(1500, 2500), 0.01, 0.5)])
    y += 0.12 * norm1(chips)
    x = reverb(widen(y, 0.1, rng_for(name, 2)), corridor_ir(name, 3), wet=0.55)
    return dict(x=mono_bass(x, 120.0))


@ksound('drill_grind', 4.0, 'hit', hit=0.2, fout=0.6, hp=60.0,
        desc="A remote-controlled drill against hard glassy lava: an electric motor spinning up from 0.2 s, the bit "
             "biting and screeching on the rock with a rattling stutter, sparks crackling, the motor straining "
             "and then winding down near the end, in a concrete corridor.")
def gen_drill_grind(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    up = np.clip((t - 0.2) / 0.5, 0, 1)
    down = np.clip((3.4 - t) / 0.6, 0, 1)
    f = 90.0 + 130.0 * up * down * (1.0 + 0.04 * smooth_rand(n, 6.0, rng_for(name, 2)))
    motor = osc_saw(f) + 0.5 * osc_saw(2.0 * f)
    motor = filt(motor, [('lp', 1800.0, 0.7071)]) * (t >= 0.2) * down
    bite = (t > 0.9) & (t < 3.2)
    scr = filt(r.standard_normal(n), [('bp', 2600.0, 3.0)]) * (0.6 + 0.4 * np.sin(TAU * 37.0 * t))
    stutter = 0.5 + 0.5 * (np.sin(TAU * 11.0 * t + 2.0 * smooth_rand(n, 3.0, rng_for(name, 3))) > -0.2)
    scr *= bite * stutter * np.sin(np.pi * np.clip((t - 0.9) / 2.3, 0, 1)) ** 0.3
    sparks = np.zeros(n)
    tc = 1.0
    while tc < 3.1:
        sparks += r.uniform(0.2, 1.0) * modes_hit(n, tc, r, [(r.uniform(4000, 8000), 0.002, 1.0)])
        tc += r.exponential(0.03)
    y = 0.8 * norm1(motor) + 0.7 * norm1(scr) + 0.25 * norm1(sparks)
    x = reverb(widen(y, 0.2, rng_for(name, 4)), corridor_ir(name, 5, 1.8), wet=0.25)
    return dict(x=mono_bass(x, 120.0))


@ksound('lava_pour', 6.0, 'hit', hit=0.2, fout=1.0, hp=25.0,
        desc="Molten lava pouring down a broken pipe into a basement: a deep slow glugging rumble from 0.2 s, thick "
             "bubbles popping, a hiss and crackle where it touches concrete and water, swelling and then easing.")
def gen_lava_pour(name, D):
    n = ns(D)
    t = tvec(n)
    env = np.clip((t - 0.2) / 0.8, 0, 1) * np.clip((D - 0.3 - t) / 2.0, 0, 1)
    rumble = filt(colored(n, rng_for(name, 1), -6.0), [('lp', 180.0, 0.7071)])
    rumble *= 1.0 + 0.5 * smooth_rand(n, 2.0, rng_for(name, 2))
    glug = bubbles(rng_for(name, 3), n, 6.0, 90.0, 220.0, 0.06, 0.15, t0=0.4, t1=D - 0.8, amp=(0.3, 1.0))
    pops = bubbles(rng_for(name, 4), n, 14.0, 300.0, 700.0, 0.015, 0.04, t0=0.5, t1=D - 0.8, amp=(0.1, 0.6))
    hiss = filt(rng_for(name, 5).standard_normal(n), [('hp', 3000.0, 0.7071), ('lp', 9000.0, 0.7071)])
    hiss *= 0.5 + 0.5 * np.tanh(2.0 * smooth_rand(n, 4.0, rng_for(name, 6)))
    crk = np.zeros(n)
    r = rng_for(name, 7)
    tc = 0.5
    while tc < D - 0.8:
        crk += r.uniform(0.2, 1.0) * modes_hit(n, tc, r, [(r.uniform(1500, 4000), 0.003, 1.0)])
        tc += r.exponential(0.08)
    y = (norm1(rumble) + 0.6 * norm1(glug) + 0.3 * norm1(pops) + 0.25 * norm1(hiss) + 0.2 * norm1(crk)) * env
    x = reverb(widen(y, 0.4, rng_for(name, 8)), corridor_ir(name, 9, 2.0), wet=0.3)
    return dict(x=mono_bass(x, 120.0))


@ksound('robot_die', 4.0, 'hit', hit=0.2, fout=0.6, hp=40.0,
        desc="A small rover robot on a roof: servo motors whining and wheels crunching on gravel from 0.2 s, then "
             "the electronics fizz and stutter, the whine falls in pitch and stops dead at about 2.4 s, a last "
             "relay click.")
def gen_robot_die(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    die = 2.4
    fall = np.clip((t - 1.6) / (die - 1.6), 0, 1)
    f = 620.0 * (1.0 - 0.75 * fall ** 1.5) * (1.0 + 0.03 * np.sin(TAU * 5.0 * t))
    alive = (t >= 0.2) & (t < die)
    whine = (np.sin(phase_of(f)) + 0.35 * np.sin(phase_of(2.0 * f)) + 0.2 * osc_saw(0.5 * f)) * alive
    glitch = np.where((t > 1.4) & (np.sin(TAU * 17.0 * t + 3.0 * smooth_rand(n, 5.0, rng_for(name, 2))) > 0.5),
                      0.2, 1.0)
    whine *= glitch
    fizz = filt(rng_for(name, 3).standard_normal(n), [('bp', 5000.0, 1.5)]) * ((t > 1.4) & (t < die + 0.1))
    fizz *= (np.sin(TAU * 31.0 * t) > 0.3)
    gravel = np.zeros(n)
    tc = 0.25
    while tc < 1.9:
        gravel += crunch(r, n, tc, r.uniform(0.3, 0.7), f=2500.0, dur=0.05)
        tc += r.uniform(0.08, 0.16)
    y = 0.7 * norm1(whine) + 0.3 * norm1(fizz) + 0.35 * norm1(gravel)
    y += 0.4 * norm1(modes_hit(n, die + 0.25, r, [(2800.0, 0.004, 1.0), (1400.0, 0.01, 0.5)]))
    x = reverb(widen(y, 0.2, rng_for(name, 4)), roof_ir(name, 5), wet=0.18)
    return dict(x=x)


@ksound('debris_throw', 4.0, 'hit', hit=0.15, fout=0.6, hp=50.0,
        desc="Men clearing a roof by hand: two quick shovel scrapes into gravel and broken blocks from 0.15 s and "
             "1.3 s, each load thrown over the edge, the chunks clattering down and landing far below.")
def gen_debris_throw(name, D):
    n = ns(D)
    t = tvec(n)
    y = np.zeros(n)
    for k, t0 in enumerate((0.15, 1.3)):
        r = rng_for(name, 10 + k)
        sc = filt(r.standard_normal(n), [('bp', 1800.0, 1.2)]) * ((t >= t0) & (t < t0 + 0.35))
        sc *= np.sin(np.pi * np.clip((t - t0) / 0.35, 0, 1))
        y += 0.6 * norm1(sc) + 0.5 * crunch(r, n, t0 + 0.05, 1.0, f=1500.0, dur=0.25)
        land = t0 + 1.1
        for _ in range(10):
            tc = land + r.uniform(0.0, 0.4)
            y += 0.12 * r.uniform(0.3, 1.0) * norm1(modes_hit(n, tc, r, [(r.uniform(400, 1200), 0.02, 1.0),
                                                                         (r.uniform(2000, 3500), 0.006, 0.4)]))
    x = reverb(widen(y, 0.3, rng_for(name, 2)), roof_ir(name, 3), wet=0.2)
    return dict(x=mono_bass(x, 120.0))


def main():
    only = ''
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]
    names = [s for s in only.split(',') if s] or NEW
    sys.argv = [sys.argv[0], '--only', ','.join(names), '--outdir', OUT]
    rc = B.main()
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    man['title'] = "«Слоновья нога» (лава под реактором) - original synthesized sounds"
    man['generator'] = "make_sfx_noga.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
