# Score for «Первые 5 минут» («Заражение», серия 1), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every section starting on the narrator's word from build/cues.json.
# He wakes: a thud, a low drone; the street: a tremolo rubbing a semitone, a brass stab on the car alarm. «Первые
# минуты»: the clock starts — a tick on every beat in the woodblock-like xylophone, under a pizzicato pulse that
# drives the three steps (a timpani hit as the wardrobe lands, everything drops a level when the light goes off).
# «Ты всё успел»: the clock stops on a warm B-flat chord; the shadows under the door: a low held note and a celesta.
# The end: a suspended question, then A7 for the loop back into D minor.
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
    rng = np.random.default_rng(91)
    S = {}
    wake, street, c1, alarm, clock, c2, push, c3, off, mute, c4, bottles, c5, dog, c6, c7 = (M[k] for k in (
        'wake', 'street', 'c1', 'alarm', 'clock', 'c2', 'push', 'c3', 'off', 'mute', 'c4', 'bottles', 'c5', 'dog', 'c6', 'c7'))
    end0 = A['L7']

    # A · awake; the street; the alarm
    a = S['A'] = Sec(dur, stop=c2, over=0.05)
    a.wet.add(0.0, saws(rng, [26, 33, 38], c2, attack=0.8, release=0.3, bright=380), -18, 0.0)
    a.dry.add(wake, timp(rng, 33, 0.9), -6, 0.0)
    a.wet.add(street, trem(rng, [62, 63, 69], c2 - street, grow=(0.3, 0.9), bright=2200), -18, 0.0)
    a.dry.add(alarm, brass(rng, [38, 44, 50], 0.35, bright=1800), -7, 0.0)
    a.wet.add(alarm + 0.4, riser(rng, max(0.4, clock - alarm - 0.4)), -16, 0.0)
    a.dry.add(clock, timp(rng, 38, 0.8), -6, 0.0)

    # B · the clock and the three steps
    b = S['B'] = Sec(dur, gain=((clock, -2.0), (c5, -2.0)))
    for i, t in enumerate(grid(clock, c5, BEAT)):
        b.dry.add(t, xylo(rng, [96, 91][i % 2], 0.22), -16 + (0 if t < off else -3), 0.35)
    for i, t in enumerate(grid(c2, c5, BEAT / 2)):
        b.dry.add(t, pizz(rng, [38, 38, 41, 38, 45, 38, 44, 41][i % 8], 0.5 if t < off else 0.35), -10, -0.15)
    b.wet.add(c2, trem(rng, [57, 62, 65], c5 - c2, grow=(0.2, 0.8), bright=2000), -21, 0.0)
    b.dry.add(push + 0.9, timp(rng, 33, 0.9), -5, 0.2)
    b.dry.add(off, brass(rng, [26, 33], 0.5, bright=600), -10, 0.0)
    b.dry.add(mute, glock(rng, 86, 0.3, 0.6), -14, 0.0)
    b.dry.add(c4, glock(rng, 81, 0.3, 0.8), -14, -0.3)

    # C · «Ты всё успел»: the clock stops on a warm chord; Пурга at the door, the shadows: a low hold and a celesta
    c = S['C'] = Sec(dur, gain=((c5, -3.0), (c6, -3.0)))
    c.wet.add(c5, saws(rng, [34, 46, 50, 53, 58], dog - c5 + 0.3, attack=0.2, release=0.4, bright=1200), -13, 0.0)
    c.dry.add(c5, glock(rng, 86, 0.5, 1.4), -10, 0.0)
    c.wet.add(dog, saws(rng, [26, 38, 45], c6 - dog, attack=0.5, release=0.3, bright=400), -16, 0.0)
    for i, m in enumerate([74, 77, 81, 77]):
        c.dry.add(dog + 0.3 + i * 0.6, celesta(rng, m, 0.4), -12, 0.2)

    # I · «Что дальше?»: suspended chords, then A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((c6, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.5
    end.wet.add(c6, saws(rng, [38, 45, 50, 55], mid - c6 + 0.3, attack=0.4, release=0.5, bright=1100), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 49, 52, 55], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -15, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.3, 77), (0.6, 81), (1.2, 79), (1.5, 76)]):
        end.dry.add(c6 + 0.15 + dt, celesta(rng, m, 0.5), -9, 0.15)
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
