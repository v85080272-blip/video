# Score for «Уезжаешь в отпуск» («Квартира под защитой», ч.1), synthesised with numpy (48 kHz stereo, no samples).
# D minor like the series, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The landing at dawn: a light, travelling celesta. The post: a bright pop turning sour on «Не надо», a creeping
# pizzicato as the eyes gather. The tower at night: a low pad, our window lights on a warm chord. The three steps run on
# a steady pizzicato: a click and a glock for each lock, a plink for the key and a stab on the mat, the lamp's chord.
# Back home: warm F, a comic xylophone for the dog and the cutlets; the end leads back into D minor.
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
    rng = np.random.default_rng(53)
    S = {}
    c1, no, al, c2, live, c3, c4, mat, c5, lamp, c6, dog, c7 = (M[k] for k in ('c1', 'no', 'all', 'c2', 'live', 'c3', 'c4', 'mat', 'c5', 'lamp', 'c6', 'dog', 'c7'))
    TURNS = M['TURNS']
    end0 = A['L7']

    # A · the landing at dawn: a light travelling celesta over F
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [41, 48, 53, 57], c1 + 0.3, attack=0.6, release=0.3, bright=1200), -17, 0.0)
    for i, t in enumerate(grid(0.3, c1 - 0.2, BEAT / 2)):
        a.dry.add(t, celesta(rng, [77, 81, 84, 81, 79, 76, 77, 72][i % 8], 0.35), -14, 0.3 if i % 2 else -0.3)

    # B · the post: a bright pop, sour on «Не надо», a creeping pizzicato under the eyes
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((c1, -2.0), (c2, -2.0)))
    for i, t in enumerate(grid(c1, no, BEAT / 2)):
        b.dry.add(t, glock(rng, [84, 88, 91, 88][i % 4], 0.2, 0.6), -16, 0.2)
    b.dry.add(no, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    b.dry.add(no, timp(rng, 38, 0.7), -6, 0.0)
    for i, t in enumerate(grid(al, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, [38, 39, 38, 44][i % 4], 0.5), -8, -0.1)
    b.wet.add(al, trem(rng, [62, 63, 68], c2 - al, grow=(0.2, 0.8), bright=2000), -19, 0.0)

    # C · the tower at night: a low pad; our window lights on a warm chord
    c = S['C'] = Sec(dur, gain=((c2, -3.0), (c3, -3.0)))
    c.wet.add(c2, saws(rng, [26, 38, 45], live - c2, attack=0.4, release=0.2, bright=500), -17, 0.0)
    c.wet.add(live, saws(rng, [41, 48, 53, 57, 60], c3 - live, attack=0.2, release=0.4, bright=1500), -14, 0.0)
    c.dry.add(live, glock(rng, 89, 0.5, 1.4), -11, 0.0)

    # D · the three steps: a steady pizzicato; a glock for each lock, a plink for the key, a stab on the mat, the lamp
    d = S['D'] = Sec(dur, gain=((c3, -2.0), (c6, -2.0)))
    for i, t in enumerate(grid(c3, c6, BEAT / 2)):
        d.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4] + (0 if t < c4 else 2 if t < c5 else 4), 0.5), -7, -0.1)
    for i, t0 in enumerate(TURNS):
        d.dry.add(t0 + 0.4, glock(rng, [84, 88][i], 0.4, 1.0), -12, 0.2)
    d.dry.add(A['L4w10'], glock(rng, 91, 0.4, 1.0), -12, 0.3)
    d.dry.add(mat + 0.3, brass(rng, [50, 51], 0.3, bright=1400), -8, 0.0)
    d.wet.add(lamp, saws(rng, [53, 57, 60, 65], c6 - lamp, attack=0.15, release=0.4, bright=1500), -15, 0.0)
    d.dry.add(lamp, celesta(rng, 89, 0.5), -11, 0.0)

    # E · back home: warm F; a comic xylophone for the dog and the cutlets
    e = S['E'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    e.wet.add(c6, saws(rng, [41, 53, 57, 60, 65], end0 - c6, attack=0.3, release=0.5, bright=1500), -14, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        e.dry.add(c6 + 0.1 + i * 0.12, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)
    for i, m in enumerate([72, 76, 79, 84, 79, 84, 88]):
        e.dry.add(dog + 0.2 + i * 0.09, xylo(rng, m, 0.25), -11, 0.25)

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
