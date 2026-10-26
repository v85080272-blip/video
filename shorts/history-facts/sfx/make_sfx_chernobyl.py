#!/usr/bin/env python3
"""
make_sfx_chernobyl.py -- original sounds for «Чернобыльские «смертники»» (May 1986; Тайны истории №10).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The sounds the other kits lack: a Geiger
counter (a crackling loop and a rise from a few clicks to a solid roar), wading knee-deep through water in a concrete
basement, a big rusty valve wheel turned by hand, and the water draining away through an opened hatch. The reactor's
rumble, the blast, the drips and the music come from the base, rescue and olga kits.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./chernobyl/)
Usage:   SFX_OUT=/home/user/work/sfx/chernobyl python3 make_sfx_chernobyl.py [--only geiger,valve_creak]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, env_ad, widen, mono_bass, make_ir, reverb, colored,
                      smooth_rand, rms, loop_buffer, loopify)
from make_sfx_dance import put_wrap, creverb, cfilt, norm1
from make_sfx_rescue import bubbles, drip
from make_sfx_kozelsk import ksound, modes_hit, NEW

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chernobyl'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def basement_ir(name, k, rt=2.2):
    """a flooded concrete basement: hard walls, water on the floor, a long bright-ish slap"""
    return make_ir(rt, 0.55 * rt, rng_for(name, k), predelay=0.015, er=12, er_span=0.09, lo_cut=90, hi_cut=6500)


def gclick(rng):
    """one Geiger-counter click through the meter's little speaker: a sharp tick ringing a 2-4 kHz cone"""
    L = ns(0.012)
    tk = np.arange(L) / SR
    f = rng.uniform(2400.0, 3600.0)
    y = np.exp(-tk / 0.0006) * rng.standard_normal(L)
    y += 0.6 * np.exp(-tk / 0.0018) * np.sin(TAU * f * tk + rng.uniform(0, TAU))
    y += 0.25 * np.exp(-tk / 0.003) * np.sin(TAU * 900.0 * tk)
    return y


@ksound('geiger', 10.0, 'loop', hit=0.0, norm=('rms', -26.0), loop=True, hp=300.0,
        desc="A Geiger counter in a hot zone: random clicks around 14 a second with denser bursts, through a small "
             "speaker (2.4-3.6 kHz ring), close and dry, a faint room. Loops seamlessly.")
def gen_geiger(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    r = rng_for(name, 1)
    rate = 14.0 * (1.0 + 0.8 * np.tanh(smooth_rand(n, 0.8, rng_for(name, 2))))
    tc = 0.0
    while True:
        tc += r.exponential(1.0 / max(2.0, float(rate[min(n - 1, ns(tc))])))
        if tc >= D:
            break
        put_wrap(x, gclick(r), tc, r.uniform(0.6, 1.0), p=r.uniform(-0.15, 0.15))
    x = creverb(x, basement_ir(name, 3, 0.6), 0.12)
    return dict(x=x)


@ksound('geiger_rise', 4.0, 'hit', hit=3.4, fout=0.25, hp=300.0,
        desc="A Geiger counter climbing from a few clicks a second to a solid crackling roar of several hundred, "
             "peaking at 3.4 s (the sync point), then cut short.")
def gen_geiger_rise(name, D):
    n = ns(D)
    y = np.zeros(n)
    r = rng_for(name, 1)
    tc = 0.0
    while True:
        rate = 3.0 * (220.0 / 3.0) ** min(1.0, tc / 3.4)
        tc += r.exponential(1.0 / rate)
        if tc >= 3.55:
            break
        c = gclick(r)
        a = ns(tc)
        y[a:a + c.size] += c[:n - a] * r.uniform(0.6, 1.0)
    t = tvec(n)
    y *= np.clip((3.6 - t) / 0.05, 0, 1)
    x = reverb(widen(y, 0.2, rng_for(name, 2)), basement_ir(name, 3, 0.6), wet=0.12)
    return dict(x=x)


def slosh(rng, n, t0, a):
    """one step knee-deep in water: the leg pushing through (a low swash), a splash, droplets falling back"""
    t = tvec(n)
    tt = np.maximum(t - t0, 0.0)
    on = t >= t0
    swash = filt(rng.standard_normal(n), [('bp', 420.0, 0.8), ('lp', 1600.0, 0.7071)], pad_s=0.05)
    swash *= on * (tt / 0.18) * np.exp(1 - tt / 0.18)
    splash = filt(rng.standard_normal(n), [('bp', 2200.0, 0.7)], pad_s=0.05) * on * np.exp(-tt / 0.05)
    drops = bubbles(rng, n, 70.0, 300.0, 1100.0, 0.01, 0.04, t0=t0 + 0.05, t1=min(n / SR, t0 + 0.6), amp=(0.1, 0.6))
    return a * (0.9 * norm1(swash) + 0.35 * norm1(splash) + 0.4 * norm1(drops))


@ksound('wade', 3.4, 'hit', hit=0.05, fout=0.4, hp=60.0,
        desc="People wading knee-deep through still water in a concrete basement: four heavy sloshing steps "
             "(0.05, 0.8, 1.5, 2.2 s), splashes and droplets, a hard echoing room.")
def gen_wade(name, D):
    n = ns(D)
    y = np.zeros(n)
    for j, t0 in enumerate([0.05, 0.8, 1.5, 2.2]):
        y += slosh(rng_for(name, j), n, t0, 1.0 - 0.08 * j)
    x = reverb(widen(y, 0.35, rng_for(name, 9)), basement_ir(name, 10), wet=0.3)
    return dict(x=x)


@ksound('valve_creak', 3.0, 'hit', hit=0.05, fout=0.5, hp=50.0,
        desc="A big rusty valve wheel half under water, turned by hand: gloved hands grab it (a dull metal knock at "
             "0.05 s), the stem gives with a grinding metal squeal (stick-slip through steel modes) over 2 s, a "
             "final clunk at 2.3 s, all in a concrete basement.")
def gen_valve_creak(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    y = np.zeros(n)
    y += 0.8 * norm1(modes_hit(n, 0.05, r, [(180.0, 0.15, 1.0), (523.0, 0.09, 0.6), (1170.0, 0.05, 0.4),
                                             (2310.0, 0.03, 0.25)]))
    # stick-slip: a pulse train at a wandering 18-55 Hz exciting inharmonic steel modes
    L = ns(2.0)
    a0 = ns(0.3)
    rt = 18.0 + 37.0 * (0.5 + 0.5 * np.tanh(smooth_rand(L, 3.0, rng_for(name, 2))))
    ph = np.cumsum(rt) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    p = np.zeros(L)
    p[idx] = 1.0 + 0.4 * r.standard_normal(idx.size)
    tk = np.arange(ns(0.08)) / SR
    body = sum(a * np.exp(-tk / tau) * np.sin(TAU * f * r.uniform(0.98, 1.02) * tk)
               for f, tau, a in [(610, 0.04, 1.0), (1370, 0.025, 0.7), (2290, 0.015, 0.45), (3460, 0.01, 0.3)])
    sq = B.fftconv(p, body)[:L] * np.sin(np.pi * np.arange(L) / L) ** 0.6
    grit = filt(rng_for(name, 3).standard_normal(L), [('bp', 1800.0, 1.2)], pad_s=0.05) * 0.15
    y[a0:a0 + L] += norm1(sq + grit * rms(sq) / (rms(grit) + 1e-12))
    y += 0.7 * norm1(modes_hit(n, 2.3, rng_for(name, 4), [(140.0, 0.2, 1.0), (410.0, 0.1, 0.5), (980.0, 0.05, 0.3)]))
    lap = bubbles(rng_for(name, 5), n, 12.0, 250.0, 800.0, 0.02, 0.06, amp=(0.1, 0.4))
    y += 0.25 * norm1(lap) * np.clip(t / 0.3, 0, 1)
    x = reverb(widen(y, 0.25, rng_for(name, 6)), basement_ir(name, 7), wet=0.3)
    return dict(x=mono_bass(x, 150.0))


@ksound('water_drain', 6.0, 'hit', hit=0.4, fout=1.2, hp=25.0,
        desc="Water starting to drain from a flooded basement: a deep hollow clunk as the way opens at 0.4 s, then "
             "a gurgling vortex and a low rushing roar swelling over 1.5 s, holding, slowly fading; concrete echo.")
def gen_water_drain(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    y = 0.8 * norm1(modes_hit(n, 0.4, r, [(65.0, 0.35, 1.0), (150.0, 0.2, 0.6), (330.0, 0.08, 0.3)]))
    swell = np.clip((t - 0.4) / 1.5, 0, 1) ** 1.5 * np.clip((D - t) / 2.5, 0, 1)
    roar = filt(colored(n, rng_for(name, 2), -6.0, fmin=25), [('lp', 380.0, 0.7071)])
    roar *= 1.0 + 0.3 * smooth_rand(n, 1.2, rng_for(name, 3))
    gur = bubbles(rng_for(name, 4), n, 60.0, 120.0, 520.0, 0.03, 0.09, t0=0.45)
    gur = filt(gur, [('lp', 1800.0, 0.7071)], pad_s=0.05)
    swirl = filt(colored(n, rng_for(name, 5), -2.0), [('bp', 700.0, 1.0)]) * (0.6 + 0.4 * np.sin(TAU * 1.3 * t))
    y += swell * (0.9 * norm1(roar) + 0.6 * norm1(gur) + 0.3 * norm1(swirl))
    x = reverb(widen(y, 0.35, rng_for(name, 6)), basement_ir(name, 7, 2.6), wet=0.3)
    return dict(x=mono_bass(x, 120.0))


@ksound('basement_hum', 12.0, 'loop', hit=0.0, norm=('rms', -28.0), loop=True, hp=25.0,
        desc="The dark flooded basement under the reactor: a deep electrical hum (50 Hz and harmonics, slowly "
             "beating), a low rumble through the concrete, slow drips into still water, a long echo. Loops "
             "seamlessly.")
def gen_basement_hum(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    t = tvec(n)
    hum = sum(np.sin(TAU * 50.0 * k * t + k) / k ** 1.3 for k in range(1, 7))
    hum *= 0.8 + 0.2 * np.sin(TAU * 0.25 * t)
    rum = filt(colored(n, rng_for(name, 1), -6.0, fmin=18, channels=2), [('lp', 140.0, 0.7071)])
    drops = np.zeros((2, n))
    r = rng_for(name, 2)
    tc = 0.0
    while True:
        tc += r.exponential(1 / 0.9)
        if tc >= n / SR - 0.2:
            break
        d = drip(r, r.uniform(600.0, 1400.0))
        a = ns(tc)
        g = 10 ** (r.uniform(-16.0, -4.0) / 20)
        pp = r.uniform(-0.8, 0.8)
        drops[0, a:a + d.size] += g * d[:n - a] * (1 - pp) / 2
        drops[1, a:a + d.size] += g * d[:n - a] * (1 + pp) / 2
    drops = reverb(drops, basement_ir(name, 3, 3.0), wet=0.5)
    y = 0.35 * hum / rms(hum) + 0.8 * rum / rms(rum) + 0.6 * drops / rms(drops)
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
    man['title'] = "«Чернобыльские «смертники»» (Чернобыль, май 1986) - original synthesized sounds"
    man['generator'] = "make_sfx_chernobyl.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
