# Score for «Правда или миф» №5 «Пожар дома» (same quiz score as №1), synthesised with numpy (48 kHz stereo). A minor, beat 0.42 s.
# The hook: a bright pizzicato pulse, a stab on «могут убить». Each question: the pulse under the tip, then it drops out
# for the guess (only the ticking clock — sound effects), then a stinger on the verdict: a low brass chord for МИФ, a
# bright major chord and a bell for ПРАВДА, and the pulse comes back under the advice. The end: the pulse, a celesta.
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


def pulse(sec, rng, t0, t1, notes, root, vel=0.5):
    for i, t in enumerate(grid(t0, t1, BEAT / 2)):
        sec.dry.add(t, pizz(rng, notes[i % len(notes)], vel), -14, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            sec.dry.add(t, timp(rng, root, 0.3), -15, 0.0)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(2026)
    S = {}
    T = {k: M[k] for k in ('c1', 'c3', 'c5', 'c7', 'g0', 'v0', 'g1', 'v1', 'g2', 'v2')}
    end0 = A['L7']

    h = S['hook'] = Sec(dur, stop=T['c1'], over=0.05)
    h.wet.add(0.0, saws(rng, [45, 52, 57, 60], T['c1'] + 0.2, attack=0.2, release=0.2, bright=900), -17, 0.0)
    pulse(h, rng, 0.1, T['c1'], [57, 64, 60, 64, 57, 64, 62, 64], 33)
    h.dry.add(A['L0w8'], brass(rng, [45, 51, 57], 0.6, bright=2200), -10, 0.0)

    for i, (c0, c1) in enumerate([('c1', 'c3'), ('c3', 'c5'), ('c5', 'c7')]):
        q = S[f'q{i}'] = Sec(dur, stop=T[c1], over=0.05)
        g0, v0 = T[f'g{i}'], T[f'v{i}']
        root, notes = [(33, [45, 52, 48, 52]), (36, [48, 55, 52, 55]), (31, [43, 50, 47, 50])][i]
        q.wet.add(T[c0], saws(rng, [root + 12, root + 19, root + 24], g0 - T[c0] + 0.1, attack=0.2, release=0.1, bright=700), -17, 0.0)
        pulse(q, rng, T[c0] + 0.05, g0 - 0.05, notes, root)
        truth = i == 2                                                        # the third one is true
        if truth:
            q.dry.add(v0, brass(rng, [root + 24, root + 28, root + 31, root + 36], 0.8, bright=2800), -9, 0.0)
            q.dry.add(v0, glock(rng, root + 52, 0.7, 2.0), -12, 0.2)
        else:
            q.dry.add(v0, brass(rng, [root, root + 6, root + 12], 0.7, bright=1600), -9, 0.0)
            q.dry.add(v0, timp(rng, root, 0.9), -9, 0.0)
        q.wet.add(v0 + 0.3, saws(rng, [root + 12, root + 19, root + 24, root + (28 if truth else 27)], T[c1] - v0, attack=0.4, release=0.2, bright=800), -18, 0.0)
        pulse(q, rng, v0 + 0.6, T[c1] - 0.05, notes, root, 0.4)

    e = S['end'] = Sec(dur, gain=((T['c7'], -2.0), (dur - 0.7, -5.0), (dur, -40.0)))
    e.wet.add(T['c7'], saws(rng, [45, 52, 57, 61], dur - T['c7'], attack=0.3, release=0.4, bright=1000), -16, 0.0)
    pulse(e, rng, T['c7'] + 0.05, A['L7w2'] - 0.05, [57, 64, 61, 64], 33, 0.45)
    for k, (dt, n) in enumerate([(0.0, 69), (0.3, 73), (0.6, 76), (0.9, 81)]):
        e.dry.add(A['L7w11'] + dt * 0.6, celesta(rng, n, 0.6), -12, 0.15)
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
