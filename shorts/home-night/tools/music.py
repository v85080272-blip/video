# Score for «Шаги ночью» («Квартира под защитой», ч.4), synthesised with numpy (48 kHz stereo, no samples).
# D minor like the series, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The night: a hush of low strings and slow footsteps in the pizzicato; a thud as he wakes. The hall: a tremolo, a stab
# on «Не надо». Step one: a click for the bolt, a thud for the chair; step two: a muted pulse while he whispers; step
# three: the held breath, a slow clock in the glock. The bark: a brass hit, the figures run on a falling run, then the
# police lights bring F major; the end leads back into D minor.
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
    rng = np.random.default_rng(67)
    S = {}
    wake, c1, no, c2, c3, bolt, chair, c4, c5, c6, bark, c7 = (M[k] for k in ('wake', 'c1', 'no', 'c2', 'c3', 'bolt', 'chair', 'c4', 'c5', 'c6', 'bark', 'c7'))
    end0 = A['L7']

    # A · the night and the hall: a hush, slow steps, a thud as he wakes, a tremolo and a stab on «Не надо»
    a = S['A'] = Sec(dur, stop=c3, over=0.03)
    a.wet.add(0.0, saws(rng, [26, 33, 38], c3, attack=0.8, release=0.3, bright=350), -17, 0.0)
    for i, t in enumerate(grid(0.4, c3, BEAT)):
        a.dry.add(t, pizz(rng, [38, 37][i % 2], 0.5), -11, 0.3)
    a.dry.add(wake, timp(rng, 33, 0.9), -6, 0.0)
    a.wet.add(c1, trem(rng, [62, 63, 68], c3 - c1, grow=(0.2, 0.8), bright=2000), -19, 0.0)
    a.dry.add(no, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    a.dry.add(no, timp(rng, 38, 0.7), -7, 0.0)

    # B · the steps: the bolt, the chair; a muted pulse while he whispers; a slow clock while he waits
    c = S['B'] = Sec(dur, gain=((c3, -2.0), (c6, -2.0)))
    for i, t in enumerate(grid(c3, c6, BEAT)):
        c.dry.add(t, pizz(rng, [38, 45][i % 2], 0.5), -9, -0.1)
    c.dry.add(bolt + 0.1, glock(rng, 84, 0.3, 0.8), -12, 0.3)
    c.dry.add(chair + 0.2, timp(rng, 38, 0.5), -9, 0.3)
    for t in grid(c5, c6, BEAT * 2):
        c.dry.add(t, glock(rng, 98, 0.15, 0.6), -18, 0.0)

    # C · the bark: a brass hit, a falling run as they flee; the police lights bring F major
    e = S['C'] = Sec(dur, gain=((c6, -3.0), (end0, -4.0)))
    e.wet.add(c6, saws(rng, [38, 45, 50], bark - c6, attack=0.3, release=0.2, bright=600), -17, 0.0)
    e.dry.add(bark, brass(rng, [38, 44, 50], 0.4, bright=1800), -5, 0.0)
    for i, m in enumerate([86, 82, 79, 75, 70, 67]):
        e.dry.add(bark + 0.3 + i * 0.1, xylo(rng, m, 0.25), -11, 0.4)
    e.wet.add(bark + 1.0, saws(rng, [41, 53, 57, 60, 65], end0 - bark - 1.0, attack=0.3, release=0.5, bright=1500), -14, 0.0)

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
