# Score for «Уходим» («Заражение», серия 2), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every section starting on the narrator's word from build/cues.json.
# The hall: a low drone; a brass note on «двадцать этажей»; at the peephole a tremolo rubbing a semitone and the
# timpani like a heartbeat. The backpack: a light pizzicato pulse, a pop for each thing. The puff: a sparkle. The lift:
# a stab; the stairs: a pizzicato running down and down. The 15th floor: the creak over a high tremolo and a held low
# note — then баба Валя: a comic bounce in the xylophone, a brass «бам» on the frying pan. The end: a suspended
# question, then A7 for the loop back into D minor.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, xylo, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.5


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(93)
    S = {}
    ward, floors, c1, c2, c3, puff, c4, lift, stairs, c5, granny, pan, c6, choice, c7 = (M[k] for k in (
        'ward', 'floors', 'c1', 'c2', 'c3', 'puff', 'c4', 'lift', 'stairs', 'c5', 'granny', 'pan', 'c6', 'choice', 'c7'))
    end0 = A['L7']

    # A · the hall, «двадцать этажей», the peephole
    a = S['A'] = Sec(dur, stop=c2, over=0.05)
    a.wet.add(0.0, saws(rng, [26, 33, 38], c2, attack=0.8, release=0.3, bright=380), -18, 0.0)
    a.dry.add(floors, brass(rng, [26, 38, 45], 0.6, bright=900), -8, 0.0)
    a.wet.add(c1, trem(rng, [62, 63, 69], c2 - c1, grow=(0.3, 1.0), bright=2200), -17, 0.0)
    for t in grid(c1 + 0.2, c2, 0.62):
        a.dry.add(t, timp(rng, 33, 0.5), -9, 0.0)

    # B · the backpack, the puff
    b = S['B'] = Sec(dur, gain=((c2, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c2, c4, BEAT / 2)):
        b.dry.add(t, pizz(rng, [38, 45, 50, 45][i % 4], 0.45), -11, -0.15)
    for w, m in zip([A['L2w3'], A['L2w4'], A['L2w5'], A['L2w6']], [74, 77, 81, 86]):
        b.dry.add(w + 0.05, xylo(rng, m, 0.35), -12, 0.2)
    for i, m in enumerate([81, 86, 90, 93]):
        b.dry.add(puff + i * 0.06, glock(rng, m, 0.45, 1.0), -11, 0.1)

    # C · the lift: a stab; the stairs: down and down
    c = S['C'] = Sec(dur, gain=((c4, -2.0), (c5, -2.0)))
    c.wet.add(c4, trem(rng, [57, 62, 63], c5 - c4, grow=(0.2, 0.8), bright=1800), -20, 0.0)
    c.dry.add(lift, brass(rng, [38, 44, 50], 0.35, bright=1600), -6, 0.0)
    c.dry.add(lift, timp(rng, 38, 0.8), -7, 0.0)
    run = [74, 72, 70, 69, 67, 65, 64, 62, 60, 58, 57, 55, 53, 52, 50, 48, 46, 45]
    for i, t in enumerate(grid(stairs, c5, BEAT / 4)):
        c.dry.add(t, pizz(rng, run[i % len(run)] - 12 * (i // len(run)), 0.5), -10, 0.1)
        if i % 4 == 0:
            c.dry.add(t, timp(rng, 33, 0.35), -12, 0.0)

    # D · the creak; баба Валя; the frying pan
    d = S['D'] = Sec(dur, gain=((c5, -3.0), (c6, -3.0)))
    d.wet.add(c5, trem(rng, [74, 75, 81], granny - c5, grow=(0.2, 1.0), bright=3000), -16, 0.0)
    d.wet.add(c5, saws(rng, [26, 33], granny - c5, attack=0.4, release=0.2, bright=300), -14, 0.0)
    for i, m in enumerate([79, 83, 86, 83, 79, 74]):
        d.dry.add(granny + 0.1 + i * 0.12, xylo(rng, m, 0.35), -10, 0.3)
    d.dry.add(pan, brass(rng, [41, 48, 53], 0.25, bright=1800), -5, 0.3)
    d.dry.add(pan, timp(rng, 41, 0.7), -8, 0.3)

    # I · «Теперь вас трое»: a warm chord; the choice; the end: A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((c6, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.5
    end.wet.add(c6, saws(rng, [34, 46, 50, 53, 58], choice - c6 + 0.3, attack=0.3, release=0.4, bright=1200), -14, 0.0)
    end.wet.add(choice, saws(rng, [38, 45, 50, 55], mid - choice + 0.3, attack=0.4, release=0.5, bright=1100), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 49, 52, 55], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -15, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.3, 77), (0.6, 81), (1.2, 79), (1.5, 76)]):
        end.dry.add(choice + 0.15 + dt, celesta(rng, m, 0.5), -9, 0.15)
    for t in grid(end0, dur - 0.2, BEAT):
        end.dry.add(t, pizz(rng, 38, 0.4), -14, 0.0)
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
