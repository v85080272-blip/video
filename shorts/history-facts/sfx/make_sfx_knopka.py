#!/usr/bin/env python3
"""
make_sfx_knopka.py -- original sounds for «Кнопка, которая взорвала реактор» (26 April 1986; Тайны истории №11).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The sounds the other kits lack: the
emergency button pressed on the control panel (a heavy clack and a cascade of relays), the rod drives running the rods
down, the reactor's power running away (a rising whine and roar cut at the peak) and the control room's alarm
buzzer. The Geiger counter comes from the chernobyl kit, the blasts, rumble and music from the base and rescue kits.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./knopka/)
Usage:   SFX_OUT=/home/user/work/sfx/knopka python3 make_sfx_knopka.py [--only klaxon,surge]
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

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'knopka'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def hall_ir(name, k, rt=1.4):
    """the control room: a long low hall full of panels, hard floor, a short dense tail"""
    return make_ir(rt, 0.5 * rt, rng_for(name, k), predelay=0.01, er=10, er_span=0.06, lo_cut=80, hi_cut=7000)


def relay(rng, n, t0, a):
    """one relay closing somewhere in the panels: a hard metal tick with a tiny ring"""
    return a * modes_hit(n, t0, rng, [(rng.uniform(2600, 4200), 0.004, 1.0), (rng.uniform(900, 1500), 0.012, 0.5),
                                      (rng.uniform(5200, 7000), 0.002, 0.4)])


@ksound('button_press', 2.5, 'hit', hit=0.05, fout=0.6, hp=40.0,
        desc="The emergency button pressed hard on a steel control panel: a heavy plastic-and-metal clack at "
             "0.05 s with a low thunk through the desk, then a cascade of relays clicking across the room over "
             "0.6 s and a faint electrical hum coming up.")
def gen_button_press(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    y = np.zeros(n)
    y += norm1(modes_hit(n, 0.05, r, [(1900.0, 0.006, 1.0), (3100.0, 0.004, 0.7), (720.0, 0.02, 0.6)]))
    y += 0.8 * norm1(modes_hit(n, 0.055, r, [(95.0, 0.12, 1.0), (210.0, 0.06, 0.5)]))
    click = filt(r.standard_normal(n), [('hp', 1500.0, 0.7071)], pad_s=0.05) * np.exp(-np.maximum(t - 0.05, 0) / 0.002)
    y += 0.5 * norm1(click * (t >= 0.05))
    rel = np.zeros(n)
    for j in range(16):
        t0 = 0.12 + 0.6 * (j / 16) ** 1.3 + r.uniform(-0.02, 0.02)
        rel += relay(r, n, t0, r.uniform(0.3, 0.8) * (1 - 0.03 * j))
    y += 0.45 * norm1(rel)
    hum = sum(np.sin(TAU * 50.0 * k * t) / k ** 1.2 for k in range(1, 6)) * np.clip((t - 0.2) / 0.8, 0, 1)
    y += 0.08 * norm1(hum)
    x = reverb(widen(y, 0.3, rng_for(name, 2)), hall_ir(name, 3), wet=0.25)
    return dict(x=mono_bass(x, 150.0))


@ksound('rods_drive', 4.0, 'hit', hit=0.1, fout=0.8, hp=30.0,
        desc="The rods driven down into the core: servo motors spinning up with a rising whine (180 to 260 Hz) from "
             "0.1 s, a dense mechanical rattle of chains and gears, a deep metallic groan through the structure.")
def gen_rods_drive(name, D):
    n = ns(D)
    t = tvec(n)
    on = np.clip((t - 0.1) / 0.3, 0, 1) * np.clip((D - t) / 1.0, 0, 1)
    f = 180.0 + 80.0 * np.clip((t - 0.1) / 1.2, 0, 1)
    ph = TAU * np.cumsum(f) / SR
    whine = sum(np.sin(k * ph) / k for k in (1, 2, 3, 5))
    r = rng_for(name, 1)
    rat = np.zeros(n)
    tc = 0.15
    while tc < D - 0.5:
        tc += r.exponential(1 / 38.0)
        rat += relay(r, n, tc, r.uniform(0.2, 0.6))
    rat = filt(rat, [('lp', 4500.0, 0.7071)], pad_s=0.05)
    groan = filt(colored(n, rng_for(name, 2), -6.0, fmin=20), [('bp', 70.0, 2.0)])
    groan *= 0.6 + 0.4 * smooth_rand(n, 1.5, rng_for(name, 3))
    y = on * (0.5 * norm1(whine) + 0.6 * norm1(rat) + 0.7 * norm1(groan))
    x = reverb(widen(y, 0.4, rng_for(name, 4)), hall_ir(name, 5, 1.8), wet=0.3)
    return dict(x=mono_bass(x, 140.0))


@ksound('surge', 3.0, 'hit', hit=2.6, fout=0.05, hp=20.0,
        desc="The reactor's power running away: a low roar and a whine climbing fast (60 to 900 Hz) over 2.6 s, "
             "electrical crackle thickening, everything cut dead at the 2.6 s peak (the blast lands there).")
def gen_surge(name, D):
    n = ns(D)
    t = tvec(n)
    u = np.clip(t / 2.6, 0, 1)
    f = 60.0 * (900.0 / 60.0) ** (u ** 1.6)
    ph = TAU * np.cumsum(f) / SR
    whine = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3.01 * ph)
    roar = filt(colored(n, rng_for(name, 1), -4.0, fmin=20), [('lp', 1800.0, 0.7071)]) * u ** 1.5
    r = rng_for(name, 2)
    cr = np.zeros(n)
    tc = 0.3
    while tc < 2.6:
        tc += r.exponential(1.0 / (4.0 + 120.0 * (tc / 2.6) ** 2))
        cr += relay(r, n, tc, r.uniform(0.3, 1.0))
    env = u ** 2.2 * np.clip((2.62 - t) / 0.02, 0, 1)
    y = env * (0.7 * norm1(whine) + 0.8 * norm1(roar)) + np.clip((2.62 - t) / 0.02, 0, 1) * 0.35 * norm1(cr) * u
    x = reverb(widen(y, 0.3, rng_for(name, 3)), hall_ir(name, 4), wet=0.15)
    return dict(x=mono_bass(x, 120.0))


@ksound('klaxon', 4.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=120.0,
        desc="The control room's alarm: a harsh electric buzzer (a 330 Hz square through a small horn) sounding "
             "0.55 s on, 0.45 s off, echoing in the long hall. Loops seamlessly every 4 s.")
def gen_klaxon(name, D):
    xf, pre = 0.5, 0.3
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    t = tvec(n)
    ph = TAU * 330.0 * t + 0.002 * np.sin(TAU * 7.0 * t)
    sq = np.tanh(4.0 * np.sin(ph)) + 0.3 * np.tanh(4.0 * np.sin(2.0 * ph))
    gate = ((t - pre) % 1.0) < 0.55
    g = filt(gate.astype(float), [('lp', 60.0, 0.7071)])
    y = filt(sq, [('bp', 1100.0, 0.7), ('lp', 3500.0, 0.7071)]) * g
    y = reverb(widen(y, 0.2, rng_for(name, 1)), hall_ir(name, 2, 1.6), wet=0.35)
    return dict(x=loopify(y[:, n0:], nl, nx))


def main():
    only = ''
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]
    names = [s for s in only.split(',') if s] or NEW
    sys.argv = [sys.argv[0], '--only', ','.join(names), '--outdir', OUT]
    rc = B.main()
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    man['title'] = "«Кнопка, которая взорвала реактор» (Чернобыль, 26 апреля 1986) - original synthesized sounds"
    man['generator'] = "make_sfx_knopka.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
    return rc


if __name__ == '__main__':
    sys.exit(main())
