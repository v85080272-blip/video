# Score for «Дверь приоткрыта» («Квартира под защитой», ч.3), synthesised with numpy (48 kHz stereo, no samples).
# D minor like the series, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# Coming home: a light pizzicato that stops dead on the open door; a low drone and a thud on the scratched lock; a stab
# on «Нельзя» and a tense tremolo while he backs off. The steps: a steady pizzicato; three taps for 112, a cold glint for
# the prints, a plink for each missing thing and a stab as the card is blocked. The police: relief in F; a comic
# xylophone for the glove; the end leads back into D minor.
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
    rng = np.random.default_rng(61)
    S = {}
    see, scratch, c1, no, c2, c3, c4, c5, c6, glove, c7 = (M[k] for k in ('see', 'scratch', 'c1', 'no', 'c2', 'c3', 'c4', 'c5', 'c6', 'glove', 'c7'))
    end0 = A['L7']

    # A · coming home: a light pizzicato that stops dead on the open door; a drone and a thud on the lock
    a = S['A'] = Sec(dur, stop=c3, over=0.03)
    for i, t in enumerate(grid(0.3, see, BEAT / 2)):
        a.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4], 0.5), -8, -0.1)
    a.wet.add(see, saws(rng, [26, 33, 38], c3 - see, attack=0.3, release=0.3, bright=400), -16, 0.0)
    a.dry.add(scratch, timp(rng, 33, 0.9), -6, 0.0)
    a.dry.add(no, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    a.wet.add(no, trem(rng, [62, 63, 68], c3 - no, grow=(0.3, 0.8), bright=2000), -19, 0.0)

    # B · the steps: a steady pizzicato; 112, the prints, the list, the card blocked
    c = S['B'] = Sec(dur, gain=((c3, -2.0), (c6, -2.0)))
    for i, t in enumerate(grid(c3, c6, BEAT / 2)):
        c.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4] + (0 if t < c4 else 2 if t < c5 else 4), 0.5), -7, -0.1)
    for i in range(3):
        c.dry.add(A['L3w8'] + i * 0.18, glock(rng, [86, 86, 89][i], 0.2, 0.5), -12, 0.1)
    c.dry.add(A['L4w7'], celesta(rng, 93, 0.5), -13, 0.2)
    for i in range(4):
        c.dry.add(A['L5w2'] + i * 0.25, glock(rng, [79, 81, 84, 86][i], 0.3, 0.8), -14, 0.2)
    c.dry.add(A['L5w7'], brass(rng, [50, 51], 0.3, bright=1400), -9, 0.0)

    # C · the police: relief in F; a comic xylophone for the glove
    e = S['C'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    e.wet.add(c6, saws(rng, [41, 53, 57, 60, 65], end0 - c6, attack=0.3, release=0.5, bright=1500), -14, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        e.dry.add(c6 + 0.1 + i * 0.12, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)
    for i, m in enumerate([72, 76, 79, 84, 79, 84, 88]):
        e.dry.add(glove + 0.1 + i * 0.09, xylo(rng, m, 0.25), -11, 0.25)

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
