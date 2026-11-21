# Score for «Операция спасения», №1 «Девочка и щенок в тайге», synthesised with numpy (48 kHz stereo). D minor, a beat of 0.5 s.
# The hook: a lonely celesta over a low drone, a timpani on «одна». The search: a pizzicato pulse with the helicopter; it
# drops out for «РЕШАЙ» (only the clock ticks), a bright stinger on «ВЕРНО». The puppy: the pulse again, warmer. Found:
# the chord opens to D major, a glockenspiel and a celesta. The statue: a slow warm theme, a bell on «Подписывайся».
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.5


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def pulse(sec, rng, t0, t1, notes, root, vel=0.45):
    for i, t in enumerate(grid(t0, t1, BEAT / 2)):
        sec.dry.add(t, pizz(rng, notes[i % len(notes)], vel), -15, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            sec.dry.add(t, timp(rng, root, 0.3), -16, 0.0)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(2014)
    S = {}
    T = {k: M[k] for k in ('c1', 'c3', 'cf', 'c6', 'g0', 'v0', 'g1', 'v1')}
    h = S['hook'] = Sec(dur, stop=T['c1'], over=0.05)
    h.wet.add(0.0, saws(rng, [26, 38, 45, 50], T['c1'] + 0.2, attack=0.3, release=0.2, bright=600), -16, 0.0)
    for i, t in enumerate(grid(0.2, T['c1'] - 0.2, 0.5)):
        h.dry.add(t, celesta(rng, [74, 77, 81, 79, 77, 74, 72, 74][i % 8], 0.5), -15, 0.15)
    h.dry.add(A['L0w4'], timp(rng, 26, 0.8), -11, 0.0)
    for i, (c0, c1) in enumerate([('c1', 'c3'), ('c3', 'cf')]):
        q = S[f'q{i}'] = Sec(dur, stop=T[c1], over=0.05)
        g0, v0 = T[f'g{i}'], T[f'v{i}']
        root, notes = [(38, [50, 57, 53, 57]), (41, [53, 60, 57, 60])][i]
        q.wet.add(T[c0], saws(rng, [root, root + 7, root + 12], g0 - T[c0] + 0.1, attack=0.3, release=0.1, bright=700), -17, 0.0)
        pulse(q, rng, T[c0] + 0.05, g0 - 0.05, notes, root - 12)
        q.dry.add(v0, brass(rng, [root + 12, root + 16, root + 19, root + 24], 0.8, bright=2600), -10, 0.0)   # «ВЕРНО»: bright
        q.dry.add(v0, glock(rng, root + 43, 0.7, 2.0), -13, 0.2)
        q.wet.add(v0 + 0.3, saws(rng, [root, root + 7, root + 12, root + 16], T[c1] - v0, attack=0.4, release=0.2, bright=800), -18, 0.0)
        pulse(q, rng, v0 + 0.6, T[c1] - 0.05, notes, root - 12, 0.4)
    f = S['found'] = Sec(dur, stop=T['c6'], over=0.08)
    f.wet.add(T['cf'], saws(rng, [38, 45, 50, 54, 57], T['c6'] - T['cf'] + 0.3, attack=0.5, release=0.4, bright=1100), -15, 0.0)
    f.dry.add(T['cf'], glock(rng, 86, 0.7, 2.4), -12, 0.2)
    for k, (dt, n) in enumerate([(0.3, 74), (0.6, 78), (0.9, 81), (1.2, 86)]):
        f.dry.add(T['cf'] + dt, celesta(rng, n, 0.6), -13, 0.15)
    for i, t in enumerate(grid(T['cf'] + 1.6, T['c6'] - 0.2, BEAT)):
        f.dry.add(t, pizz(rng, [50, 57, 54, 57][i % 4], 0.35), -17, -0.15 + 0.3 * (i % 2))
    e = S['end'] = Sec(dur, gain=((T['c6'], -2.0), (dur - 0.7, -5.0), (dur, -40.0)))
    e.wet.add(T['c6'], saws(rng, [38, 45, 50, 54], dur - T['c6'], attack=0.4, release=0.5, bright=1000), -15, 0.0)
    for i, t in enumerate(grid(T['c6'] + 0.2, dur - 1.0, 0.5)):
        e.dry.add(t, celesta(rng, [74, 78, 81, 78, 76, 74, 73, 74][i % 8], 0.5), -15, 0.15)
    e.dry.add(A['L6w15'] - 0.05, glock(rng, 86, 0.7, 2.0), -12, 0.2)
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
