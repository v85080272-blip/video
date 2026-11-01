# Score for «Заранее» (блэкаут, ч.8, финал сезона), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like parts 1–7, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The calm flat: warm F; the lamp flickers and a low unease creeps in. The dark: a hit and the ostinato as he gropes for
# the torch. Packing the crate: a bright, rising glock for each thing that goes in, over a steady pizzicato march that
# lifts a step at each of the three groups. The dog with her bowl: a comic xylophone; the end is warm (F, then A7) and
# A7 leads back into the D minor of part 1 — the season loops.
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
    rng = np.random.default_rng(47)
    S = {}
    flick, c1, dark, c2, c3, c4, c5, atm, c6, dog, c7 = (M[k] for k in ('flick', 'c1', 'dark', 'c2', 'c3', 'c4', 'c5', 'atm', 'c6', 'dog', 'c7'))
    ITEMS = M['ITEMS']
    end0 = A['L7']

    # A · the calm flat in warm F; the flicker brings a low unease
    a = S['A'] = Sec(dur, stop=dark + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [41, 48, 53, 57], flick + 0.2, attack=0.6, release=0.2, bright=1200), -16, 0.0)
    for i, m in enumerate([77, 81, 84, 81]):
        if 0.3 + i * 0.5 < flick:
            a.dry.add(0.3 + i * 0.5, celesta(rng, m, 0.5), -13, 0.2 - 0.1 * i)
    a.wet.add(flick, saws(rng, [38, 44, 50], dark - flick + 0.2, attack=0.4, release=0.2, bright=500), -17, 0.0)

    # B · the dark: a hit and the ostinato while he gropes for the torch
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((dark, -2.0), (c2, -2.0)))
    b.dry.add(dark, timp(rng, 33, 0.9), -5, 0.0)
    b.dry.add(dark, brass(rng, [26, 33, 38], 0.5, bright=600), -9, 0.0)
    for i, t in enumerate(grid(dark, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -7, -0.1)

    # C · packing: a march that lifts a step at each group, a rising glock for each thing in the crate
    c = S['C'] = Sec(dur, gain=((c2, -2.0), (c6, -2.0)))
    for i, t in enumerate(grid(c2, c6, BEAT / 2)):
        up = 0 if t < c3 else 2 if t < c4 else 4 if t < c5 else 5
        c.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4] + up, 0.5), -7, -0.1)
    for i, t0 in enumerate(ITEMS):
        c.dry.add(t0 + 0.4, glock(rng, [77, 79, 81, 84, 86, 88, 89, 91, 93, 96][i], 0.35, 0.9), -12, 0.25)
    c.wet.add(c3, saws(rng, [41, 48, 53], c6 - c3, attack=0.6, release=0.3, bright=900), -19, 0.0)
    c.dry.add(atm, brass(rng, [50, 51], 0.3, bright=1400), -9, 0.0)

    # D · the dog with her bowl: a comic xylophone, a warm chord
    d = S['D'] = Sec(dur, gain=((c6, -3.0), (end0, -3.0)))
    d.wet.add(c6, saws(rng, [41, 53, 57, 60, 65], end0 - c6, attack=0.3, release=0.5, bright=1500), -14, 0.0)
    for i, m in enumerate([72, 76, 79, 84, 79, 84, 88]):
        d.dry.add(dog + i * 0.09, xylo(rng, m, 0.25), -11, -0.25)

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
