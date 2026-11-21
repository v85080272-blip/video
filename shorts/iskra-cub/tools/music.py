# Score for «Приключения Искры» №2 «Медвежонок» (2D), synthesised with numpy (48 kHz stereo). D minor, beat 0.42 s.
# The hook: a low held chord, a celesta note when the cub peeks out, a dark brass and a timpani hit on «мама рядом». The
# steps: a careful pizzicato pulse (she talks quietly). The mother: the pulse stops, a tremolo, a stab on the slap. The
# charge: a timpani roll and a riser that grow — a hit when she stops, then a held breath. «Фух»: a warm major chord and
# a bell. The wire: back to the minor, a sting on the sparks, a timpani roll under the question.
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
    rng = np.random.default_rng(1811)
    S = {}
    out, slam, ch, stop, fuh, end0 = M['out'], M['slam'], M['charge'], M['stop'], M['fuh'], M['end']

    h = S['hook'] = Sec(dur, stop=A['L1'], over=0.05)
    h.wet.add(0.0, saws(rng, [38, 45, 50, 53], A['L1'] + 0.3, attack=0.5, release=0.3, bright=600), -18, 0.0)
    h.wet.add(0.3, trem(rng, [74, 77], A['L1'] - 0.3, rate=9.0, bright=2000.0), -27, 0.2)
    h.dry.add(M['cub'], celesta(rng, 86, 0.5), -12, 0.25)
    h.dry.add(M['cub'] + 0.21, celesta(rng, 81, 0.5), -14, 0.25)
    h.dry.add(M['mom'], brass(rng, [38, 44, 50], 0.9, bright=1400), -10, 0.0)
    h.dry.add(M['mom'], timp(rng, 26, 1.0), -8, 0.0)

    s = S['steps'] = Sec(dur, stop=out, over=0.05)
    s.wet.add(A['L1'], saws(rng, [50, 57, 62], out - A['L1'] + 0.1, attack=0.3, release=0.1, bright=600), -20, 0.0)
    pulse(s, rng, A['L1'] + 0.05, out - 0.05, [62, 69, 65, 69], 38, 0.38)

    m = S['mom'] = Sec(dur, stop=ch, over=0.03)
    m.wet.add(out, trem(rng, [62, 63], ch - out + 0.1, rate=11.0, grow=(0.3, 0.9), bright=2400.0), -21, 0.0)
    m.wet.add(out, saws(rng, [38, 45, 51], ch - out + 0.1, attack=0.2, release=0.05, bright=500), -16, 0.0)
    m.dry.add(out + 0.3, brass(rng, [38, 44], 0.8, bright=1400), -11, 0.0)
    m.dry.add(slam, brass(rng, [38, 44, 50], 0.7, bright=1800), -8, 0.0)
    m.dry.add(slam, timp(rng, 26, 1.0), -6, 0.0)

    c = S['charge'] = Sec(dur, stop=stop + 0.05, over=0.02)
    c.wet.add(ch, riser(rng, stop - ch), -14, 0.0)
    c.wet.add(ch, saws(rng, [38, 45, 50, 51], stop - ch, attack=0.1, release=0.02, bright=900), -15, 0.0)
    for k, t in enumerate(grid(ch, stop - 0.02, 0.08)):
        c.dry.add(t, timp(rng, 38, 0.2 + 0.5 * k / max(1, (stop - ch) / 0.08)), -15, 0.0)

    hold = S['hold'] = Sec(dur, stop=fuh, over=0.05)
    hold.dry.add(stop, brass(rng, [26, 38, 45, 50], 1.2, bright=2000), -6, 0.0)
    hold.dry.add(stop, timp(rng, 26, 1.0), -5, 0.0)
    hold.dry.add(stop, crash(rng, 0.8, 2.0), -14, 0.0)
    hold.wet.add(stop + 0.4, trem(rng, [57, 62], fuh - stop - 0.3, rate=7.0, grow=(0.6, 0.3), bright=1800.0), -24, 0.0)
    hold.wet.add(stop + 0.4, saws(rng, [38, 45], fuh - stop - 0.3, attack=0.6, release=0.2, bright=400), -21, 0.0)

    r = S['relief'] = Sec(dur, stop=end0, over=0.1)
    r.dry.add(fuh, brass(rng, [62, 66, 69, 74], 0.9, bright=2400), -12, 0.0)
    r.dry.add(fuh + 0.15, glock(rng, 86, 0.7, 2.0), -12, 0.2)
    r.wet.add(fuh + 0.2, saws(rng, [50, 57, 62, 66], end0 - fuh, attack=0.5, release=0.3, bright=800), -18, 0.0)

    e = S['end'] = Sec(dur, gain=((end0, -2.0), (dur - 0.6, -5.0), (dur, -40.0)))
    e.wet.add(end0, saws(rng, [38, 45, 50, 53], dur - end0, attack=0.3, release=0.4, bright=500), -16, 0.0)
    e.dry.add(M['spark'], brass(rng, [50, 56], 0.5, bright=2600), -12, 0.0)
    e.dry.add(M['spark'], celesta(rng, 92, 0.4), -12, -0.2)
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
