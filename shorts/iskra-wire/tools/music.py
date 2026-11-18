# Score for «Приключения Искры» №3 «Провод на земле» (2D), synthesised with numpy (48 kHz stereo). D minor, beat 0.42 s.
# The hook: a held low chord and a high tremolo; the wire lands — brass, timpani and a crash; a sting on «искрит». The
# steps: a careful pizzicato pulse, a brass accent on «ток пройдёт через ноги». «Вышла!»: a warm major chord and a bell.
# The stairwell: back to the minor, a celesta note on the gas, a timpani roll under the question.
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
    rng = np.random.default_rng(1812)
    S = {}
    land, out, end0 = M['land'], M['out'], M['end']

    h = S['hook'] = Sec(dur, stop=A['L1'], over=0.05)
    h.wet.add(0.0, saws(rng, [38, 45, 50, 53], A['L1'] + 0.3, attack=0.4, release=0.3, bright=600), -18, 0.0)
    h.wet.add(0.2, trem(rng, [74, 75], A['L1'] - 0.2, rate=12.0, bright=2400.0), -26, 0.2)
    h.dry.add(land, brass(rng, [38, 44, 50], 0.9, bright=1800), -8, 0.0)
    h.dry.add(land, timp(rng, 26, 1.0), -6, 0.0)
    h.dry.add(land, crash(rng, 0.7, 2.0), -16, 0.0)
    h.dry.add(M['spark'], brass(rng, [50, 56], 0.5, bright=2600), -12, 0.0)
    h.dry.add(M['spark'], celesta(rng, 92, 0.4), -13, -0.2)

    s = S['steps'] = Sec(dur, stop=out, over=0.05)
    s.wet.add(A['L1'], saws(rng, [50, 57, 62], out - A['L1'] + 0.1, attack=0.3, release=0.1, bright=600), -20, 0.0)
    pulse(s, rng, A['L1'] + 0.05, out - 0.05, [62, 69, 65, 69], 38, 0.38)
    s.dry.add(M['legs'], brass(rng, [38, 44], 0.6, bright=1600), -11, 0.0)
    s.dry.add(M['legs'], timp(rng, 26, 0.8), -10, 0.0)
    s.wet.add(max(A['L1'], out - 1.2), riser(rng, 1.2), -20, 0.0)

    r = S['relief'] = Sec(dur, stop=end0, over=0.1)
    r.dry.add(out, brass(rng, [62, 66, 69, 74], 0.9, bright=2400), -12, 0.0)
    r.dry.add(out + 0.15, glock(rng, 86, 0.7, 2.0), -12, 0.2)
    r.wet.add(out + 0.2, saws(rng, [50, 57, 62, 66], end0 - out, attack=0.5, release=0.3, bright=800), -18, 0.0)

    e = S['end'] = Sec(dur, gain=((end0, -2.0), (dur - 0.6, -5.0), (dur, -40.0)))
    e.wet.add(end0, saws(rng, [38, 45, 50, 53], dur - end0, attack=0.3, release=0.4, bright=500), -16, 0.0)
    e.wet.add(M['gas'], trem(rng, [74, 75], dur - M['gas'], rate=8.0, grow=(0.2, 0.8), bright=2000.0), -27, 0.2)
    e.dry.add(M['gas'], celesta(rng, 81, 0.5), -13, 0.15)
    e.dry.add(M['gas'] + 0.25, celesta(rng, 80, 0.5), -15, 0.15)
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
