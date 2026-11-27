# Score for «Посёлок» №3 «Тараню шлагбаум» (3D), synthesised with numpy (48 kHz stereo, no samples). Night, a quiet dread
# that turns into a run: a low drone in D minor; every entry on a mark from build/cues.json.
# A they are at the window: the drone, the falling celesta figure. B–C the belt, the aim: a soft pulse (her heart) that
# quickens. D the slow roll to the barrier: a riser — and the hit on «Удар!» (timpani, low brass, a crash). E the forest
# road: a driving pulse, a thud when the one on the door falls off. F the high beams, someone waving: the motif once more,
# open, unresolved — the question.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, celesta, saws, trem, timp, brass, crash, riser, Sec


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(2311)
    S = {}
    c1, c2, c3, c4, c5, imp, fall, hb = (M[k] for k in ('c1', 'c2', 'c3', 'c4', 'c5', 'imp', 'fall', 'hb'))

    a = S['A'] = Sec(dur, stop=c1, over=0.06)            # they are at the window
    a.wet.add(0.0, saws(rng, [26, 38], c1 + 0.1, attack=0.6, release=0.05, bright=340), -17, 0.0)
    a.wet.add(0.3, trem(rng, [86, 87], c1 - 0.3, grow=(0.05, 0.7), bright=5200), -30, 0.0)
    for i, m in enumerate([81, 77, 74, 73]):
        a.dry.add(0.5 + i * 0.45, celesta(rng, m, 0.6), -17, 0.3 - 0.2 * i)
    a.dry.add(A['L0w7'], timp(rng, 26, 0.8), -11, 0.0)

    b = S['B'] = Sec(dur, stop=c3, over=0.05)            # the belt, the aim: the heart quickens
    b.wet.add(c1, saws(rng, [24, 36, 43], c3 - c1 + 0.1, attack=0.3, release=0.05, bright=380), -18, 0.0)
    t, k = c1 + 0.2, 0
    while t < c3 - 0.1:
        b.dry.add(t, timp(rng, 26 if k % 2 == 0 else 29, 0.45), -18, -0.1 + 0.2 * (k % 2)); k += 1
        t += max(0.38, 0.62 - 0.02 * k)

    d = S['D'] = Sec(dur, stop=c4, over=0.05)            # the roll to the barrier — the hit
    d.wet.add(c3, saws(rng, [26, 27, 38], imp - c3 + 0.05, attack=0.2, release=0.02, bright=520), -16, 0.0)
    d.wet.add(max(c3, imp - 1.6), riser(rng, 1.6), -14, 0.0)
    d.dry.add(imp, timp(rng, 26, 1.5), -3, 0.0)
    d.dry.add(imp, brass(rng, [26, 32, 38], 0.8, bright=900), -7, 0.0)
    d.wet.add(imp, crash(rng, 0.6, 2.4), -15, 0.0)
    d.wet.add(imp + 0.4, saws(rng, [26, 33, 38], c4 - imp, attack=0.3, release=0.1, bright=600), -18, 0.0)

    e = S['E'] = Sec(dur, stop=c5, over=0.05)            # the forest road: a driving pulse; the thud of the fall
    t, k = c4 + 0.05, 0
    while t < c5 - 0.1:
        e.dry.add(t, timp(rng, 26 if k % 4 else 31, 0.55), -15, -0.15 + 0.3 * (k % 2)); k += 1; t += 0.3
    e.wet.add(c4, trem(rng, [62, 65], c5 - c4, grow=(0.3, 1.0), bright=3000), -22, 0.0)
    e.dry.add(fall, timp(rng, 24, 1.0), -8, 0.3)

    f = S['F'] = Sec(dur)                                 # the high beams, someone waving: the question, open
    f.wet.add(c5, saws(rng, [26, 38, 45], dur - c5, attack=0.6, release=0.8, bright=300), -18, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.6, 77), (1.2, 76), (1.8, 81)]):
        f.dry.add(hb + 0.5 + dt, celesta(rng, m, 0.55), -16, -0.2 + 0.13 * i)
    f.wet.add(c5 + 0.2, trem(rng, [86, 87], dur - c5, grow=(0.1, 0.5), bright=5200), -30, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 1.0, damp=5000, width=0.7), room(rng, 3.0, damp=3500, width=0.9))
    mix = sum(sec.render(rooms) for sec in S.values())
    n = at(dur)
    mix = mix[:, :n].copy()
    mix[:, -at(0.6):] *= np.linspace(1, 0, at(0.6))
    mix = hp(mix, 30)
    sf.write(out, mix.T, SR, subtype='FLOAT')
    print(f'music {n / SR:.2f}s → {out}  peak {np.max(np.abs(mix)):.3f}')


if __name__ == '__main__':
    main()
