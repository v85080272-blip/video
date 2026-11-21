# Score for «Как выжить, если прилетели инопланетяне» (2D), synthesised with numpy (48 kHz stereo). D minor, beat 0.42 s.
# The hook: a strange held chord (a tritone on top) and a low brass stab on «тарелка». The steps: a quiet pizzicato
# pulse with the timpani. The choice: the pulse drops out for the guess (only the ticking clock). The answer: a bright
# major chord and a bell, the pulse comes back. The knock: the music thins to a low held note with a timpani roll —
# the question hangs.
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
    rng = np.random.default_rng(1947)
    S = {}
    g0, v0, end0 = M['g'], M['v'], M['end']

    h = S['hook'] = Sec(dur, stop=A['L1'], over=0.05)
    h.wet.add(0.0, saws(rng, [38, 45, 50, 56], A['L1'] + 0.3, attack=0.4, release=0.3, bright=700), -16, 0.0)
    h.wet.add(0.2, trem(rng, [74, 80], A['L1'] - 0.2, rate=9.0, bright=2000.0), -24, 0.2)
    h.dry.add(A['L0w7'], brass(rng, [38, 44, 50], 0.7, bright=1800), -10, 0.0)

    s = S['steps'] = Sec(dur, stop=g0, over=0.05)
    s.wet.add(A['L1'], saws(rng, [50, 57, 62], g0 - A['L1'] + 0.1, attack=0.3, release=0.1, bright=650), -18, 0.0)
    pulse(s, rng, A['L1'] + 0.05, g0 - 0.05, [62, 69, 65, 69], 38)

    a = S['answer'] = Sec(dur, stop=end0, over=0.1)
    a.dry.add(v0, brass(rng, [62, 66, 69, 74], 0.8, bright=2800), -9, 0.0)
    a.dry.add(v0, glock(rng, 86, 0.7, 2.0), -12, 0.2)
    a.wet.add(v0 + 0.3, saws(rng, [50, 57, 62, 66], end0 - v0, attack=0.4, release=0.2, bright=800), -18, 0.0)
    pulse(a, rng, v0 + 0.6, end0 - 0.05, [62, 69, 66, 69], 38, 0.4)

    e = S['end'] = Sec(dur, gain=((end0, -2.0), (dur - 0.6, -5.0), (dur, -40.0)))
    e.wet.add(end0, saws(rng, [38, 45, 51], dur - end0, attack=0.2, release=0.4, bright=500), -15, 0.0)
    for k, t in enumerate(grid(A['L7w5'], dur - 0.4, 0.09)):
        e.dry.add(t, timp(rng, 38, 0.18 + 0.25 * k / 30), -20, 0.0)
    e.dry.add(A['L7w5'], celesta(rng, 81, 0.5), -14, 0.15)
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
