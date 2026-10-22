#!/usr/bin/env python3
"""
make_sfx_yamaguchi.py -- original sounds for «Две бомбы», часть 2 (Нагасаки, 9 августа 1945; Тайны истории №9).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The one sound the other kits lack: the
office windows bursting inward under the blast wave (a sharp crack, a shower of glass shards ringing as they fly and
land on a wooden floor, the frames' dull knock, a small room's echo). The blast, rumble, heartbeat, piano and pads come
from the base, rescue and olga kits.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./yamaguchi/)
Usage:   SFX_OUT=/home/user/work/sfx/yamaguchi python3 make_sfx_yamaguchi.py [--only glass_shatter]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import SR, TAU, ns, tvec, rng_for, filt, env_ad, widen, mono_bass, make_ir, reverb, sound, colored
from make_sfx_dance import norm1
from make_sfx_kozelsk import ksound, modes_hit, debris, NEW

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'yamaguchi'))
NEW.clear()                                     # only this kit's sounds, not the siege kit's


def shard(rng, f, dec, n_max):
    """one piece of glass ringing: three inharmonic modes of a small plate, a fast decay"""
    L = min(n_max, ns(dec * 6))
    tk = np.arange(L) / SR
    y = np.zeros(L)
    for ratio, amp, dk in ((1.0, 1.0, 1.0), (2.76, 0.55, 0.6), (5.40, 0.3, 0.35)):
        y += amp * np.sin(TAU * f * ratio * rng.uniform(0.99, 1.01) * tk + rng.uniform(0, TAU)) * np.exp(-tk / (dec * dk))
    return y * np.clip(tk / 0.0005, 0, 1)


def shower(n, t0, rng, count, spread, lo, hi, dec=(0.02, 0.09)):
    """many shards: onsets thinning out after t0, each a little quieter"""
    y = np.zeros(n)
    for _ in range(count):
        tc = t0 + rng.exponential(spread)
        a = ns(tc)
        if a >= n - 400:
            continue
        s = shard(rng, rng.uniform(lo, hi), rng.uniform(*dec), n - a)
        y[a:a + s.size] += s * rng.uniform(0.15, 1.0) * np.exp(-(tc - t0) / (2.5 * spread))
    return y


@ksound('glass_shatter', 2.4, 'hit', hit=0.03, fout=0.5, hp=60.0,
        desc="Office windows bursting inward under a blast wave: a sharp bright crack at 0.03 s, the frames' dull "
             "knock, a shower of shards ringing (2.5-9 kHz plate modes) as they fly, a second shower landing on a "
             "wooden floor around 0.3-1.2 s, small-room echo.")
def gen_glass_shatter(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    crack = filt(r.standard_normal(n), [('hp', 2500.0, 0.7071), ('lp', 11000.0, 0.7071)], pad_s=0.05)
    y = 0.9 * norm1(crack * env_ad(n, 0.03, 0.0008, 0.035))
    y += 0.5 * norm1(modes_hit(n, 0.035, r, [(140.0, 0.08, 1.0), (330.0, 0.05, 0.6), (760.0, 0.03, 0.4)]))
    y += 0.8 * norm1(shower(n, 0.035, r, 420, 0.08, 2500.0, 9000.0))
    y += 0.45 * norm1(shower(n, 0.3, rng_for(name, 2), 260, 0.28, 1800.0, 7000.0, dec=(0.015, 0.06)))
    y += 0.25 * norm1(debris(n, 0.25, 1.3, rng_for(name, 3), 30))
    air = filt(colored(n, rng_for(name, 4), -1.5, fmin=800), [('bp', 5000.0, 0.6)], pad_s=0.05)
    y += 0.2 * norm1(air) * env_ad(n, 0.03, 0.01, 0.4)
    ir = make_ir(0.7, 0.45, rng_for(name, 5), predelay=0.008, er=8, er_span=0.05, lo_cut=200, hi_cut=9000)
    x = reverb(widen(y, 0.45, rng_for(name, 6)), ir, wet=0.22)
    return dict(x=mono_bass(x, 150.0))


def main():
    only = ''
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1]
    names = [s for s in only.split(',') if s] or NEW
    sys.argv = [sys.argv[0], '--only', ','.join(names), '--outdir', OUT]
    rc = B.main()
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    man['title'] = "«Две бомбы», часть 2 (Нагасаки, 1945) - original synthesized sounds"
    man['generator'] = "make_sfx_yamaguchi.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
