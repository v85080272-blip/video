#!/usr/bin/env python3
"""
make_sfx_kozelsk.py -- original sound kit for «Злой город» (Козельск, 1238; Тайны истории №6).

Same toolbox as make_sfx.py (numpy only, no samples, deterministic seeds). The siege sounds the epic kit of
make_sfx_olga.py lacks: a trebuchet throwing (wood under strain, the arm's thunk, the stone flying off), the stone
hitting a log wall, a volley of arrows, a wall giving way, heavy gates opening, cavalry at the gallop (loop),
the din of a battle (loop) and ravens over the ruins. The music (war drums, gusli, choir, horn, fire) comes from the
olga kit. Loops are built on a circular time grid (events and reverb tails wrap around), so they repeat without a seam.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json in $SFX_OUT (default ./kozelsk/)
Usage:   SFX_OUT=/home/user/work/sfx/kozelsk python3 make_sfx_kozelsk.py [--only stone_hit,cavalry]
"""
import os
import sys
import json
sys.dont_write_bytecode = True                  # no __pycache__ next to the kit scripts in the repo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import make_sfx as B
from make_sfx import (SR, TAU, ns, tvec, rng_for, filt, env_ad, phase_of, softclip, pan, widen, mono_bass, make_ir,
                      reverb, sound, colored, smooth_rand, place, creak, crackle_click)
from make_sfx_dance import put_wrap, creverb, cfilt, norm1

OUT = os.environ.get('SFX_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kozelsk'))
NEW = []


def ksound(name, *a, **k):
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


def field_ir(name, k, rt=1.6):
    return make_ir(rt, 0.5 * rt, rng_for(name, k), predelay=0.02, er=6, er_span=0.12, lo_cut=120, hi_cut=5000)


def modes_hit(n, t0, rng, modes, gain=1.0):
    """a struck wooden body: decaying sines (freq, decay s, amp) from t0"""
    t = tvec(n)
    tt = np.maximum(t - t0, 0.0)
    on = t >= t0
    y = np.zeros(n)
    for fm, dec, a in modes:
        y += a * on * np.sin(TAU * fm * rng.uniform(0.97, 1.03) * tt + rng.uniform(0, TAU)) * np.exp(-tt / dec)
    return gain * y


def thump(n, t0, f_hi, f_lo, dec, rng):
    """a low body blow: a sine falling from f_hi to f_lo"""
    t = tvec(n)
    tt = np.maximum(t - t0, 0.0)
    f = f_lo + (f_hi - f_lo) * np.exp(-tt / 0.03)
    return np.sin(phase_of(f)) * (t >= t0) * np.exp(-tt / dec) * np.clip(tt / 0.002, 0, 1)


def splinters(n, t0, rng, count, spread, lo=900.0, hi=6000.0):
    """wood splitting: a burst of crackle clicks decaying after t0"""
    y = np.zeros(n)
    for _ in range(count):
        tc = t0 + rng.exponential(spread)
        a = ns(tc)
        if a >= n - 200:
            continue
        c = crackle_click(rng, rng.uniform(lo, hi), rng.uniform(0.0002, 0.0012), 0.5)
        y[a:a + c.size] += c[:n - a] * rng.uniform(0.2, 1.0) * np.exp(-(tc - t0) / (3 * spread))
    return y


def debris(n, t0, t1, rng, count):
    """small wooden pieces and stones landing: low-mid knocks between t0 and t1"""
    y = np.zeros(n)
    for _ in range(count):
        tc = rng.uniform(t0, t1)
        L = ns(0.08)
        tk = np.arange(L) / SR
        f = rng.uniform(180.0, 700.0)
        c = (np.sin(TAU * f * tk) + 0.4 * rng.standard_normal(L)) * np.exp(-tk / rng.uniform(0.01, 0.03))
        a = ns(tc)
        if a >= n - L:
            continue
        y[a:a + L] += c * rng.uniform(0.2, 1.0) * (1.0 - 0.6 * (tc - t0) / max(t1 - t0, 1e-3))
    return y


# ============================================================================
# one-shots
# ============================================================================
@ksound('trebuchet_throw', 2.4, 'hit', hit=0.55, fout=0.5, hp=35.0,
        desc="A trebuchet throwing: the wooden frame groaning under the counterweight, the arm's heavy thunk at "
             "0.55 s, the sling's rope swish and the stone flying off (a whoosh falling in pitch and level).")
def gen_trebuchet_throw(name, D):
    n = ns(D)
    t = tvec(n)
    r = rng_for(name, 1)
    y = np.zeros(n)
    cr = creak(0.6, r, rate=(28.0, 70.0))
    y[:cr.size] += 0.7 * norm1(cr)
    y += 0.9 * norm1(modes_hit(n, 0.55, r, [(95.0, 0.18, 1.0), (210.0, 0.1, 0.7), (460.0, 0.05, 0.4), (980.0, 0.03, 0.2)]))
    y += 0.8 * norm1(thump(n, 0.55, 120.0, 55.0, 0.25, r))
    sw = filt(r.standard_normal(n), [('bp', 1800.0, 1.2)], pad_s=0.05) * env_ad(n, 0.58, 0.05, 0.12)
    y += 0.35 * norm1(sw)
    nz = colored(n, rng_for(name, 2), -3.0, fmin=60)
    fc = 1400.0 * (300.0 / 1400.0) ** np.clip((t - 0.62) / 1.4, 0, 1)
    fly = B.tv_filter(nz, lambda tt, f: np.exp(-0.5 * (np.log2(np.maximum(f, 20.0) / np.interp(tt, t, fc)) / 0.5) ** 2))
    fly = norm1(fly) * env_ad(n, 0.62, 0.12, 0.9) * (t >= 0.6)
    y += 0.5 * fly
    x = reverb(widen(y, 0.2, rng_for(name, 3)), field_ir(name, 4, 1.6), wet=0.25)
    return dict(x=x)


@ksound('stone_hit', 2.6, 'hit', hit=0.02, fout=0.6, hp=25.0,
        desc="A trebuchet stone smashing into a log wall: a deep body blow (90 -> 45 Hz), the logs' wooden crack "
             "(modes 180 Hz - 2.1 kHz), splinters flying, debris raining down, field echo.")
def gen_stone_hit(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = 1.0 * norm1(thump(n, 0.02, 90.0, 45.0, 0.35, r))
    y += 0.8 * norm1(modes_hit(n, 0.02, r, [(180.0, 0.12, 1.0), (420.0, 0.08, 0.8), (830.0, 0.05, 0.6),
                                            (1350.0, 0.035, 0.4), (2100.0, 0.02, 0.3)]))
    y += 0.6 * norm1(filt(r.standard_normal(n), [('bp', 1500.0, 0.7)], pad_s=0.05)) * env_ad(n, 0.02, 0.001, 0.05)
    y += 0.45 * norm1(splinters(n, 0.03, r, 260, 0.12))
    y += 0.4 * norm1(debris(n, 0.25, 1.6, r, 45))
    rum = filt(colored(n, rng_for(name, 2), -6.0, fmin=25), [('lp', 220.0, 0.7071)])
    y += 0.5 * norm1(rum) * env_ad(n, 0.02, 0.05, 0.9)
    x = reverb(widen(y, 0.25, rng_for(name, 3)), field_ir(name, 4, 1.8), wet=0.3)
    return dict(x=mono_bass(x, 120.0))


@ksound('arrows_volley', 3.0, 'hit', hit=0.75, fout=0.6, hp=150.0,
        desc="A volley of 40 arrows: whistles falling from about 3.5 to 1.5 kHz spread over the stereo field, "
             "then the arrows thudding into wood and earth around 0.75 s.")
def gen_arrows_volley(name, D):
    n = ns(D)
    t = tvec(n)
    x = np.zeros((2, n))
    for k in range(40):
        r = rng_for(name, 10 + k)
        t0 = r.uniform(0.0, 0.3)
        dur = r.uniform(0.45, 0.65)
        f0, f1 = r.uniform(3000.0, 4200.0), r.uniform(1300.0, 1900.0)
        m = ns(dur)
        tk = np.arange(m) / SR
        fc = f0 * (f1 / f0) ** (tk / dur)
        nz = r.standard_normal(m)
        wh = B.tv_filter(nz, lambda tt, f, fc=fc, tk=tk: np.exp(-0.5 * (np.log2(np.maximum(f, 20.0) / np.interp(tt, tk, fc)) / 0.12) ** 2),
                         nfft=512)
        wh = norm1(wh) * np.sin(np.pi * tk / dur) ** 1.5
        y = np.zeros(n)
        a = ns(t0)
        y[a:a + m] += wh[:n - a]
        th = t0 + dur + r.uniform(-0.02, 0.05)
        y += 0.8 * norm1(modes_hit(n, th, r, [(r.uniform(250, 420), 0.05, 1.0), (r.uniform(700, 1100), 0.025, 0.5)]))
        place(x, pan(y, r.uniform(-0.9, 0.9)), 0.0, 10 ** (r.uniform(-9.0, 0.0) / 20))
    x = reverb(x, field_ir(name, 100, 1.2), wet=0.2)
    return dict(x=x)


@ksound('wall_crash', 3.4, 'hit', hit=0.05, fout=0.8, hp=25.0,
        desc="A log wall giving way: three big wooden cracks, logs groaning, then the collapse (a low rumble "
             "with timber and earth falling), field echo.")
def gen_wall_crash(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = np.zeros(n)
    for t0, g in [(0.05, 1.0), (0.22, 0.75), (0.48, 0.9)]:
        y += g * norm1(modes_hit(n, t0, r, [(150.0, 0.15, 1.0), (330.0, 0.1, 0.8), (690.0, 0.06, 0.6),
                                            (1240.0, 0.04, 0.4), (1900.0, 0.025, 0.3)]))
        y += 0.6 * g * norm1(filt(r.standard_normal(n), [('bp', 1300.0, 0.7)], pad_s=0.05)) * env_ad(n, t0, 0.001, 0.06)
        y += 0.4 * g * norm1(splinters(n, t0, r, 120, 0.08))
    cr = creak(0.9, r, rate=(18.0, 45.0))
    a = ns(0.3)
    y[a:a + cr.size] += 0.6 * norm1(cr)[:n - a]
    rum = filt(colored(n, rng_for(name, 2), -6.0, fmin=25), [('lp', 260.0, 0.7071)])
    y += 0.9 * norm1(rum) * env_ad(n, 0.6, 0.2, 1.4)
    y += 0.9 * norm1(thump(n, 0.75, 80.0, 38.0, 0.6, r))
    y += 0.5 * norm1(debris(n, 0.7, 2.6, r, 90))
    x = reverb(widen(y, 0.3, rng_for(name, 3)), field_ir(name, 4, 1.8), wet=0.3)
    return dict(x=mono_bass(x, 120.0))


@ksound('gate_creak', 3.0, 'hit', hit=0.05, fout=0.5, hp=40.0,
        desc="Heavy wooden gates swinging open: a slow, deep hinge creak (stick-slip 14-40 Hz through log body "
             "modes) over 2.2 s, then the gate stopping with a dull thud.")
def gen_gate_creak(name, D):
    n = ns(D)
    r = rng_for(name, 1)
    y = np.zeros(n)
    cr = creak(2.2, r, rate=(14.0, 40.0))
    cr = filt(cr, [('lp', 2400.0, 0.7071)], pad_s=0.05)
    a = ns(0.05)
    y[a:a + cr.size] += norm1(cr)[:n - a]
    y += 0.7 * norm1(thump(n, 2.3, 95.0, 55.0, 0.25, r))
    y += 0.5 * norm1(modes_hit(n, 2.3, r, [(140.0, 0.12, 1.0), (310.0, 0.07, 0.6), (650.0, 0.04, 0.3)]))
    x = reverb(widen(y, 0.15, rng_for(name, 2)), field_ir(name, 3, 1.4), wet=0.22)
    return dict(x=x)


def caw(rng, dur):
    """one raven croak: a rough harmonic tone bending down, nasal formants"""
    m = ns(dur)
    tk = np.arange(m) / SR
    f0 = rng.uniform(480.0, 600.0) * (1.0 - 0.18 * tk / dur)
    ph = phase_of(f0)
    y = sum(np.sin(h * ph) / h ** 0.8 for h in range(1, 14))
    y *= 1.0 + 0.6 * np.sin(TAU * rng.uniform(55.0, 75.0) * tk)          # the rasp
    y = filt(y, [('bp', 1250.0, 1.5)], pad_s=0.02) + 0.6 * filt(y, [('bp', 2500.0, 2.0)], pad_s=0.02)
    return norm1(y) * np.sin(np.pi * tk / dur) ** 0.5


@ksound('ravens', 2.8, 'hit', hit=0.02, fout=0.6, hp=200.0,
        desc="Ravens over the ruins: three hoarse caws from two birds, left and right, with an open-air echo.")
def gen_ravens(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    for k, (t0, p, g) in enumerate([(0.02, -0.5, 1.0), (0.55, -0.45, 0.85), (1.35, 0.6, 0.6)]):
        r = rng_for(name, k)
        y = caw(r, r.uniform(0.22, 0.32))
        place(x, pan(y, p), t0, g)
    x = reverb(x, field_ir(name, 9, 1.8), wet=0.35)
    return dict(x=x)


# ============================================================================
# loops
# ============================================================================
@ksound('cavalry', 9.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=25.0,
        desc="Cavalry at the gallop in spring mud: 40 horses (three hoof falls per stride, about 2 strides a "
             "second, low thumps with mud splats), a ground rumble, wide stereo. Loops seamlessly.")
def gen_cavalry(name, D):
    n = ns(D)
    x = np.zeros((2, n))
    for h in range(40):
        r = rng_for(name, h)
        stride = 1.0 / r.uniform(1.9, 2.4)
        tt = r.uniform(0.0, stride)
        p = r.uniform(-0.9, 0.9)
        g = 10 ** (r.uniform(-12.0, 0.0) / 20)
        while tt < D:
            for off in (0.0, 0.09, 0.2):
                L = ns(0.12)
                tk = np.arange(L) / SR
                f = r.uniform(70.0, 120.0)
                hoof = np.sin(TAU * f * tk * (1 + 0.5 * np.exp(-tk / 0.01))) * np.exp(-tk / 0.035)
                splat = filt(r.standard_normal(L), [('lp', 900.0, 0.7071)], pad_s=0.01) * np.exp(-tk / 0.02)
                put_wrap(x, norm1(hoof + 0.5 * splat), tt + off + r.uniform(-0.01, 0.01), g * r.uniform(0.6, 1.0), p=p)
            tt += stride * r.uniform(0.97, 1.03)
    t = tvec(n)
    rum = cfilt(np.stack([colored(n, rng_for(name, 90 + c), -6.0, fmin=20) for c in range(2)]), [('lp', 180.0, 0.7071)])
    rum = rum / (np.abs(rum).max() + 1e-9) * (0.8 + 0.2 * np.sin(TAU * 2 * t / D))
    x = norm1(x) + 0.5 * rum
    x = creverb(x, field_ir(name, 100, 1.4), 0.25)
    return dict(x=x)


@ksound('battle_din', 10.0, 'loop', hit=0.0, norm=('rms', -24.0), loop=True, hp=60.0,
        desc="The din of a battle at a distance: steel clashing on steel (inharmonic rings 1.8-6 kHz), blows on "
             "wooden shields, a roaring crowd of fighters in surges, open-air echo. Loops seamlessly.")
def gen_battle_din(name, D):
    n = ns(D)
    t = tvec(n)
    x = np.zeros((2, n))
    r = rng_for(name, 1)
    for k in range(70):                                    # steel
        L = ns(0.5)
        tk = np.arange(L) / SR
        y = sum(a * np.sin(TAU * fm * tk + r.uniform(0, TAU)) * np.exp(-tk / dec)
                for fm, dec, a in [(r.uniform(1800, 2500), 0.12, 1.0), (r.uniform(3100, 3900), 0.08, 0.7),
                                   (r.uniform(4700, 6000), 0.05, 0.5)])
        y += 0.6 * r.standard_normal(L) * np.exp(-tk / 0.004)
        put_wrap(x, norm1(y), r.uniform(0, D), 10 ** (r.uniform(-16.0, -2.0) / 20), p=r.uniform(-0.8, 0.8))
    for k in range(40):                                    # shields
        L = ns(0.2)
        tk = np.arange(L) / SR
        y = (np.sin(TAU * r.uniform(140, 260) * tk) + 0.5 * r.standard_normal(L) * np.exp(-tk / 0.01)) * np.exp(-tk / 0.05)
        put_wrap(x, norm1(y), r.uniform(0, D), 10 ** (r.uniform(-14.0, -3.0) / 20), p=r.uniform(-0.8, 0.8))
    crowd = np.zeros((2, n))
    for v in range(30):                                    # shouting fighters, surging (whole cycles per loop)
        rv = rng_for(name, 100 + v)
        src = cfilt(rv.standard_normal(n), [('bp', rv.uniform(500.0, 1300.0), 1.2), ('lp', 3200.0, 0.7071)])
        surge = 0.5 + 0.5 * np.sin(TAU * rv.integers(1, 4) * t / D + rv.uniform(0, TAU))
        syl = 0.6 + 0.4 * np.sin(TAU * round(rv.uniform(2.0, 4.0) * D) / D * t + rv.uniform(0, TAU))
        crowd += pan(norm1(src) * surge ** 2 * syl, rv.uniform(-0.8, 0.8)) * 10 ** (rv.uniform(-8.0, 0.0) / 20)
    x = norm1(x) + 0.7 * norm1(crowd)
    x = creverb(x, field_ir(name, 200, 1.6), 0.3)
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
    man['title'] = "«Злой город» (Козельск, 1238) - original synthesized siege kit"
    man['generator'] = "make_sfx_kozelsk.py (numpy only, re-runnable, deterministic seeds; helpers from make_sfx.py)"
    json.dump(man, open(mp, 'w'), indent=2, ensure_ascii=False)
    return rc


if __name__ == '__main__':
    sys.exit(main())
