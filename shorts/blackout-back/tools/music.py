# Score for «Свет дали» (блэкаут, ч.7), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like parts 1–6, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The city: a hush, then F major blooms as the windows come back on; the climb runs on rising pizzicato. The mistake:
# a crowded chord as everything is plugged in, a stab and a sputter as the lamp flickers. The checks: step one a plink
# for each plug, minutes apart; step two a cold, careful pulse and a stab on the crack; step three a sour stab on the
# bin. The evening: warm F with celesta, a soft lullaby glock for the sleeping dog; the end leads back into D minor.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, xylo, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.6


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(43)
    S = {}
    on, climb, c1, plug, flick, c2, c3, c4, crack, shut, c5, c6, tub, dog, c7 = (M[k] for k in (
        'on', 'climb', 'c1', 'plug', 'flick', 'c2', 'c3', 'c4', 'crack', 'shut', 'c5', 'c6', 'tub', 'dog', 'c7'))
    ONES, TRASH = M['ONES'], M['TRASH']
    end0 = A['L7']

    # A · the city: a hush, then F major as the windows come back on
    a = S['A'] = Sec(dur, stop=climb + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [38, 45, 50], on + 0.2, attack=0.6, release=0.2, bright=500), -19, 0.0)
    a.wet.add(on, saws(rng, [41, 53, 57, 60, 65], climb - on + 0.4, attack=0.15, release=0.4, bright=1600), -13, 0.0)
    a.dry.add(on, crash(rng, 0.6, 1.5), -18, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        a.dry.add(on + 0.05 + i * 0.1, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)

    # B · the climb: rising pizzicato, one step a floor
    b = S['B'] = Sec(dur, stop=c1, over=0.03, gain=((climb, -2.0), (c1, -2.0)))
    n = max(4, int((c1 - climb) / 0.15))
    for i in range(n):
        b.dry.add(climb + i * (c1 - climb) / n, pizz(rng, 41 + (i * 2) % 24, 0.35), -9, -0.2 + 0.4 * (i % 2))

    # C · the mistake: everything plugged in, a crowded chord; the flicker, a stab and a sputter
    c = S['C'] = Sec(dur, gain=((c1, -2.0), (c2, -2.0)))
    for i, t in enumerate(grid(c1, c2, BEAT / 2)):
        c.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4], 0.55), -7, -0.1)
    c.wet.add(plug + 0.2, saws(rng, [53, 56, 59, 62, 65], flick - plug, attack=0.4, release=0.1, bright=2000), -18, 0.0)
    c.dry.add(A['L1w8'] - 0.05, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    c.dry.add(flick, timp(rng, 33, 0.8), -7, 0.0)

    # D · the checklist and step one: a plink for each plug, minutes apart
    d = S['D'] = Sec(dur, gain=((c2, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c2, c4, BEAT / 2)):
        d.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -7, -0.1)
    for i, t0 in enumerate(ONES):
        d.dry.add(t0 + 0.15, glock(rng, [81, 84, 88][i], 0.4, 1.0), -11, 0.2)

    # E · step two: a cold, careful pulse; a stab on the crack
    e = S['E'] = Sec(dur, gain=((c4, -3.0), (c5, -3.0)))
    e.wet.add(c4, saws(rng, [50, 57, 62], c5 - c4, attack=0.5, release=0.3, bright=1200), -18, 0.0)
    for t in grid(c4, c5, BEAT):
        e.dry.add(t, glock(rng, 98, 0.15, 0.5), -20, 0.3)
    e.dry.add(crack, brass(rng, [50, 51], 0.3, bright=1400), -8, 0.0)
    e.dry.add(shut, timp(rng, 38, 0.5), -8, 0.0)

    # F · step three: a sour stab for the bin, the ostinato
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    f = S['F'] = Sec(dur, gain=((c5, -2.0), (c6, -3.0)))
    for i, t in enumerate(grid(c5, c6, BEAT / 2)):
        f.dry.add(t, pizz(rng, pat[i % 8], 0.6), -7, -0.1)
    f.dry.add(A['L5w10'] - 0.08, brass(rng, [38, 44, 50], 0.4, bright=1600), -7, 0.0)

    # G · the evening: warm F with celesta; a soft lullaby glock for the sleeping dog
    h = S['G'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    h.wet.add(c6, saws(rng, [41, 53, 57, 60, 65], end0 - c6, attack=0.4, release=0.5, bright=1400), -14, 0.0)
    for i, m in enumerate([77, 81, 84, 89, 84, 81]):
        h.dry.add(c6 + 0.15 + i * 0.35, celesta(rng, m, 0.5), -13, -0.3 + 0.12 * i)
    for i, m in enumerate([84, 81, 77, 81, 72]):
        h.dry.add(dog + 0.1 + i * 0.4, glock(rng, m, 0.4, 1.2), -15, 0.2)

    # I · «Подписывайся…»: warm F with a celesta tune, then A7sus4 → A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.55
    end.wet.add(end0, saws(rng, [41, 48, 53, 57], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1200), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 50, 52, 55], max(0.4, dur - mid - 0.6), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end.wet.add(dur - 0.5, saws(rng, [45, 49, 52, 55], 0.4, attack=0.1, release=0.4, bright=1000), -17, 0.0)
    for i, (dt, m) in enumerate([(0.0, 77), (0.3, 81), (0.6, 84), (0.9, 81), (1.5, 76), (1.8, 79)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end.dry.add(end0, pizz(rng, 41, 0.8), -3, 0.0)
    end.dry.add(mid, pizz(rng, 33, 0.7), -4, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 0.9, damp=6000, width=0.7), room(rng, 2.2, damp=4500, width=0.9))
    mix = sum(sec.render(rooms) for sec in S.values())
    mix = mix[:, :at(dur + 3.0)]
    # the loop: what rings past the end is folded back onto the start, so the end and the start join without a seam
    n = at(dur)
    tail = mix[:, n:]
    mix = mix[:, :n].copy()
    mix[:, :tail.shape[1]] += tail
    mix = hp(mix, 35)
    sf.write(out, mix.T, SR, subtype='FLOAT')
    print(f'music {n / SR:.2f}s → {out}  peak {np.max(np.abs(mix)):.3f}')


if __name__ == '__main__':
    main()
