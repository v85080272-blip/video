# Score for «Звонок в дверь» («Квартира под защитой», ч.2), synthesised with numpy (48 kHz stereo, no samples).
# D minor like the series, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The bell and the fish-eye: a held, uneasy pad. The landing: a hurried pizzicato (he is rushing you), a sour stab when
# the partner shows by the lift, relief on «настоящий мастер подождёт». The steps: a steady pizzicato, a click for the
# chain, a glock for the right number, a stab on the stranger's card, three taps for 112. The empty landing and the
# growl: a low drone; the end leads back into D minor.
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
    rng = np.random.default_rng(59)
    S = {}
    ring, peep, c1, two, c2, c3, c4, c5, dial, c6, growl, c7 = (M[k] for k in ('ring', 'peep', 'c1', 'two', 'c2', 'c3', 'c4', 'c5', 'dial', 'c6', 'growl', 'c7'))
    end0 = A['L7']

    # A · the bell and the fish-eye: a held, uneasy pad
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [38, 44, 50], c1 + 0.3, attack=0.5, release=0.3, bright=700), -17, 0.0)
    a.wet.add(peep, trem(rng, [62, 63], c1 - peep, grow=(0.2, 0.6), bright=1800), -21, 0.0)

    # B · the landing: a hurried pizzicato, a sour stab for the partner, relief on «подождёт»
    b = S['B'] = Sec(dur, stop=c3, over=0.03, gain=((c1, -2.0), (c3, -2.0)))
    for i, t in enumerate(grid(c1, c2, BEAT / 4)):
        b.dry.add(t, pizz(rng, [38, 50, 44, 50][i % 4], 0.35), -9, -0.1)
    b.dry.add(two + 0.5, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    b.dry.add(two + 0.5, timp(rng, 38, 0.7), -7, 0.0)
    b.wet.add(c2, saws(rng, [41, 48, 53, 57], c3 - c2, attack=0.3, release=0.3, bright=1300), -15, 0.0)
    b.dry.add(c2, glock(rng, 89, 0.5, 1.4), -12, 0.0)

    # C · the steps: a steady pizzicato; the chain, the right number, the stranger's card, 112
    c = S['C'] = Sec(dur, gain=((c3, -2.0), (c6, -2.0)))
    for i, t in enumerate(grid(c3, c6, BEAT / 2)):
        c.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4] + (0 if t < c4 else 2 if t < c5 else 4), 0.5), -7, -0.1)
    c.dry.add(A['L3w8'], glock(rng, 84, 0.4, 1.0), -12, 0.2)
    c.dry.add(A['L4w6'], glock(rng, 89, 0.4, 1.0), -12, 0.2)
    c.dry.add(A['L4w12'], brass(rng, [50, 51], 0.3, bright=1400), -9, 0.0)
    for i in range(3):
        c.dry.add(dial + i * 0.18, glock(rng, [86, 86, 89][i], 0.2, 0.5), -12, 0.1)

    # D · the empty landing, then the growl: a low drone
    d = S['D'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    d.wet.add(c6, saws(rng, [26, 33, 38], end0 - c6, attack=0.5, release=0.5, bright=400), -16, 0.0)
    d.dry.add(A['L6w6'], timp(rng, 33, 0.8), -8, 0.0)
    for i, m in enumerate([62, 61, 62, 58]):
        d.dry.add(growl + 0.1 + i * 0.4, pizz(rng, m - 24, 0.5), -9, -0.2)

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
