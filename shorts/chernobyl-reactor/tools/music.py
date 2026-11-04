# Score for «Чернобыль: к реактору» («Зона», серия 1), synthesised with numpy (48 kHz stereo, no samples).
# A minor, slow (a beat of 0.75 s, 80 BPM), every entry on a mark from build/cues.json.
# A · the road: a wide low drone, the air. B · the arch: a slow swell up with the camera, a high glock. C–F · the rules:
# a quiet pizzicato walk under each, a tremolo that tightens over the moss (D). G · the Ferris wheel: a music box —
# celesta in three, a little out of tune, the park that never opened. H · the empty street: a low held chord, one
# timpani roll, no tune. I · the dogs: warmer, a few soft celesta notes. J · the frame: the lamp goes green — the chord
# opens into A major. K · the choice: a pulse under a suspended chord; the end: the music box again and E7 for the loop.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, xylo, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.75


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(1986)
    S = {}
    c = {k: M['c' + k] for k in 'ABCDEFGHIJK'}
    c8, lamp = M['c8'], M['lamp']
    end0 = A['L8']

    a = S['A'] = Sec(dur, stop=c['C'], over=0.05)                     # the road and the arch
    a.wet.add(0.0, saws(rng, [33, 40, 45], c['C'] + 0.3, attack=1.5, release=0.4, bright=320), -17, 0.0)
    a.wet.add(c['B'], saws(rng, [45, 52, 57, 60], c['C'] - c['B'] + 0.3, attack=1.8, release=0.4, bright=900), -19, 0.0)
    for i, m in enumerate([81, 84, 88]):
        a.dry.add(c['B'] + 1.2 + i * 0.9, glock(rng, m, 0.6, 1.4), -16, 0.3 - 0.3 * i)

    r = S['R'] = Sec(dur, stop=c['G'], over=0.05)                      # the four rules
    r.wet.add(c['C'], saws(rng, [33, 45, 48, 52], c['G'] - c['C'], attack=0.4, release=0.3, bright=500), -19, 0.0)
    notes = [45, 52, 48, 52]
    for i, t in enumerate(grid(c['C'], c['G'], BEAT)):
        r.dry.add(t, pizz(rng, notes[i % 4], 0.5), -14, -0.2 + 0.4 * (i % 2))
    r.wet.add(c['D'] + 0.3, trem(rng, [69, 70], c['E'] - c['D'] - 0.2, grow=(0.1, 1.0), bright=2600), -20, 0.2)
    r.dry.add(c['E'], timp(rng, 33, 0.5), -12, 0.0)
    r.dry.add(c['F'], timp(rng, 33, 0.5), -13, 0.0)

    w = S['W'] = Sec(dur, stop=c['H'], over=0.05)                      # the Ferris wheel: a music box in three
    w.wet.add(c['G'], saws(rng, [45, 52, 57], c['H'] - c['G'] + 0.4, attack=0.6, release=0.6, bright=700), -18, 0.0)
    tune = [(0, 76), (1, 81), (2, 84), (3, 83), (4, 81), (5, 76), (6, 77), (7, 76), (8, 74), (9, 72), (10, 71), (11, 69)]
    step = (c['H'] - c['G'] - 0.4) / 12
    for k, m in tune:
        w.dry.add(c['G'] + 0.2 + k * step, celesta(rng, m + rng.uniform(-0.12, 0.12), 0.7), -11, 0.25)
        if k % 3 == 0:
            w.dry.add(c['G'] + 0.2 + k * step, celesta(rng, m - 24, 0.7), -15, -0.2)

    s = S['S'] = Sec(dur, stop=c['I'], over=0.05)                      # the empty street
    s.wet.add(c['H'], saws(rng, [33, 40, 45, 48], c['I'] - c['H'] + 0.4, attack=1.0, release=0.6, bright=380), -14, 0.0)
    s.dry.add(c['H'] + 0.2, timp(rng, 28, 1.8), -12, 0.0)

    d = S['D'] = Sec(dur, stop=c['K'], over=0.05)                      # the dogs; then the frame, the lamp
    d.wet.add(c['I'], saws(rng, [41, 48, 53, 57], c['J'] - c['I'] + 0.3, attack=0.6, release=0.4, bright=900), -16, 0.0)
    for i, (dt, m) in enumerate([(0.4, 72), (0.9, 76), (1.4, 79), (2.4, 77), (2.9, 76)]):
        d.dry.add(c['I'] + dt, celesta(rng, m, 0.6), -13, -0.2 + 0.1 * i)
    d.wet.add(c['J'], saws(rng, [40, 45, 52, 55], lamp - c['J'] + 0.2, attack=0.4, release=0.2, bright=700), -17, 0.0)
    d.wet.add(lamp, saws(rng, [45, 52, 57, 61, 64], c['K'] - lamp + 0.3, attack=0.15, release=0.5, bright=1800), -14, 0.0)
    d.dry.add(lamp, brass(rng, [57, 61, 64, 69], 1.0, bright=2200), -11, 0.0)
    for i, m in enumerate([81, 85, 88, 93]):
        d.dry.add(lamp + 0.1 + i * 0.08, glock(rng, m, 0.5, 1.2), -13, 0.2)

    e = S['E'] = Sec(dur, stop=end0, over=0.05)                        # the choice
    e.wet.add(c['K'], saws(rng, [45, 52, 57, 62], end0 - c['K'] + 0.2, attack=0.4, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(c['K'] + 0.3, end0, BEAT / 2)):
        e.dry.add(t, pizz(rng, [45, 45, 52, 45][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            e.dry.add(t, timp(rng, 33, 0.3), -14, 0.0)

    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))         # the end: the music box again, E7 for the loop
    mid = end0 + (dur - end0) * 0.6
    end.wet.add(end0, saws(rng, [45, 52, 57, 60], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1000), -15, 0.0)
    end.wet.add(mid, saws(rng, [40, 47, 50, 56], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -16, 0.0)
    for i, (dt, m) in enumerate([(0.0, 76), (0.35, 81), (0.7, 84), (1.05, 83), (1.6, 80), (1.95, 76)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.6), -10, 0.15)
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
