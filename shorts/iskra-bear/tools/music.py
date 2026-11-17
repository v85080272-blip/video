# Score for «Приключения Искры» №1 «Медведь» (2D), synthesised with numpy (48 kHz stereo). D minor, beat 0.42 s.
# The hook: a low held chord, a brass stab and a timpani hit on «медведь». The steps: a careful pizzicato pulse with the
# timpani (quiet: she talks calmly). He stands up: the pulse drops out, a tremolo and a riser hold the breath. «Фух… ушёл»:
# a warm major chord and a bell. The cub: back to the minor, a celesta note and a timpani roll — the question hangs.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.42


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def pulse(sec, rng, t0, t1, notes, root, vel=0.45):
    for i, t in enumerate(grid(t0, t1, BEAT / 2)):
        sec.dry.add(t, pizz(rng, notes[i % len(notes)], vel), -15, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            sec.dry.add(t, timp(rng, root, 0.3), -16, 0.0)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(1711)
    S = {}
    up, fuh, end0 = M['up'], M['fuh'], M['end']

    h = S['hook'] = Sec(dur, stop=A['L1'], over=0.05)
    h.wet.add(0.0, saws(rng, [38, 45, 50, 53], A['L1'] + 0.3, attack=0.5, release=0.3, bright=600), -17, 0.0)
    h.wet.add(0.3, trem(rng, [74, 77], A['L1'] - 0.3, rate=9.0, bright=2000.0), -26, 0.2)
    h.dry.add(A['L0w10'], brass(rng, [38, 44, 50], 0.8, bright=1600), -9, 0.0)
    h.dry.add(A['L0w10'], timp(rng, 26, 1.0), -8, 0.0)

    s = S['steps'] = Sec(dur, stop=up, over=0.05)
    s.wet.add(A['L1'], saws(rng, [50, 57, 62], up - A['L1'] + 0.1, attack=0.3, release=0.1, bright=600), -19, 0.0)
    pulse(s, rng, A['L1'] + 0.05, up - 0.05, [62, 69, 65, 69], 38, 0.4)

    st = S['stand'] = Sec(dur, stop=fuh, over=0.05)
    st.wet.add(up, trem(rng, [62, 63], fuh - up + 0.1, rate=11.0, grow=(0.3, 1.0), bright=2400.0), -20, 0.0)
    st.wet.add(up, saws(rng, [38, 45, 51], fuh - up + 0.1, attack=0.2, release=0.05, bright=500), -16, 0.0)
    st.dry.add(up, brass(rng, [38, 44], 0.9, bright=1400), -10, 0.0)
    st.wet.add(max(up, fuh - 1.2), riser(rng, 1.2), -18, 0.0)

    r = S['relief'] = Sec(dur, stop=end0, over=0.1)
    r.dry.add(fuh, brass(rng, [62, 66, 69, 74], 0.9, bright=2400), -12, 0.0)
    r.dry.add(A['L6w12'], glock(rng, 86, 0.7, 2.0), -12, 0.2)
    r.wet.add(fuh + 0.2, saws(rng, [50, 57, 62, 66], end0 - fuh, attack=0.5, release=0.3, bright=800), -18, 0.0)

    e = S['end'] = Sec(dur, gain=((end0, -2.0), (dur - 0.6, -5.0), (dur, -40.0)))
    e.wet.add(end0, saws(rng, [38, 45, 50, 53], dur - end0, attack=0.3, release=0.4, bright=500), -16, 0.0)
    e.dry.add(M['cub'], celesta(rng, 81, 0.5), -13, 0.15)
    e.dry.add(M['cub'], timp(rng, 26, 0.8), -12, 0.0)
    for k, t in enumerate(grid(M['q'], dur - 0.4, 0.09)):
        e.dry.add(t, timp(rng, 38, 0.16 + 0.22 * k / 30), -21, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 1.2, damp=5000, width=0.7), room(rng, 3.0, damp=3600, width=0.95))
    mix = sum(sec.render(rooms) for sec in S.values())
    mix = mix[:, :at(dur + 3.0)]
    n = at(dur)
    tail = mix[:, n:]
    mix = mix[:, :n].copy()
    mix[:, :tail.shape[1]] += tail
    mix = hp(mix, 35)
    sf.write(out, mix.T, SR, subtype='FLOAT')
    print(f'music {n / SR:.2f}s → {out}  peak {np.max(np.abs(mix)):.3f}')


if __name__ == '__main__':
    main()
