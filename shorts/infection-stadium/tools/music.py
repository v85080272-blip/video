# Score for «К стадиону» («Заражение», серия 5), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every entry on a mark from build/cues.json.
# The door: a low drone and a held breath; a stab when the camera finds them in the street. The map: a ticking clock in
# pizzicato and the pin's glock. The walk: a quiet march (pizzicato and a soft timpani), a tremolo creeping under it.
# The gate: hope — a brass chord under the floodlights; then «собак не пускаем»: everything stops, one low note.
# The fact: a slow, sad celesta over a low chord; the law: the chord turns major. The choice: a pulse under a suspended
# chord that stops for «Пиши один или два». The end: the celesta tune and A7 for the loop back into D minor.
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
    rng = np.random.default_rng(705)
    S = {}
    m = {k: M[k] for k in ('cover', 'street', 'five', 'c2', 'pin', 'c3', 'pairs', 'c4', 'docs', 'c5', 'check', 'nodogs', 'c7', 'law', 'c9', 'c10')}
    end0 = A['L10']

    a = S['door'] = Sec(dur, stop=m['c2'], over=0.05)
    a.wet.add(m['cover'], saws(rng, [26, 38, 45], m['c2'] - m['cover'] + 0.2, attack=0.8, release=0.3, bright=380), -17, 0.0)
    a.dry.add(m['street'] + 0.3, timp(rng, 33, 0.8), -8, 0.0)
    a.wet.add(m['street'] + 0.3, trem(rng, [62, 63], m['five'] - m['street'], grow=(0.4, 1.0), bright=2600), -20, 0.0)
    a.dry.add(m['five'], brass(rng, [50, 57, 62], 0.7, bright=1500), -14, 0.0)

    mp = S['map'] = Sec(dur, stop=m['c3'], over=0.05)
    mp.wet.add(m['c2'], saws(rng, [38, 45, 50], m['c3'] - m['c2'] + 0.2, attack=0.3, release=0.3, bright=600), -18, 0.0)
    for i, t in enumerate(grid(m['c2'], m['c3'], BEAT)):
        mp.dry.add(t, pizz(rng, [62, 57][i % 2], 0.3), -15, 0.3 * (-1) ** i)
    mp.dry.add(m['pin'] + 0.3, glock(rng, 86, 0.6, 1.2), -10, 0.0)

    w = S['walk'] = Sec(dur, stop=m['c5'], over=0.05)
    w.wet.add(m['c3'], saws(rng, [38, 45, 48, 53], m['c5'] - m['c3'] + 0.2, attack=0.3, release=0.3, bright=500), -18, 0.0)
    for i, t in enumerate(grid(m['c3'], m['c5'], BEAT)):
        w.dry.add(t, pizz(rng, [38, 45, 41, 45][i % 4], 0.45), -12, -0.2 + 0.4 * (i % 2))
        if i % 4 == 0:
            w.dry.add(t, timp(rng, 38, 0.4), -14, 0.0)
    w.wet.add(m['c4'], trem(rng, [69, 70], m['c5'] - m['c4'], grow=(0.1, 0.7), bright=2400), -22, 0.0)
    w.dry.add(m['docs'] + 0.4, glock(rng, 81, 0.5, 1.0), -14, -0.2)

    gt = S['gate'] = Sec(dur, stop=m['nodogs'] + 0.05, over=0.05)
    gt.wet.add(m['c5'], saws(rng, [38, 45, 50, 54, 57], m['nodogs'] - m['c5'] + 0.1, attack=0.6, release=0.05, bright=1600), -14, 0.0)
    gt.dry.add(m['c5'] + 0.1, brass(rng, [50, 54, 57, 62], 1.0, bright=2200), -10, 0.0)
    gt.dry.add(m['c5'] + 0.1, timp(rng, 38, 0.7), -10, 0.0)
    for i, t in enumerate(grid(m['check'], m['nodogs'], BEAT)):
        gt.dry.add(t, pizz(rng, [50, 54][i % 2], 0.35), -15, 0.2)

    nd = S['nodogs'] = Sec(dur, stop=m['c7'], over=0.05)
    nd.dry.add(m['nodogs'], timp(rng, 26, 1.4), -6, 0.0)
    nd.wet.add(m['nodogs'] + 0.1, saws(rng, [26, 33], m['c7'] - m['nodogs'] + 0.2, attack=0.2, release=0.4, bright=260), -14, 0.0)

    f = S['fact'] = Sec(dur, stop=m['c9'], over=0.05)
    f.wet.add(m['c7'], saws(rng, [38, 45, 50, 53], m['law'] - m['c7'] + 0.2, attack=0.8, release=0.3, bright=700), -17, 0.0)
    for i, (dt, n) in enumerate([(0.3, 69), (0.9, 72), (1.5, 74), (2.3, 72), (2.9, 69), (3.5, 67), (4.3, 65)]):
        if m['c7'] + dt < m['law']:
            f.dry.add(m['c7'] + dt, celesta(rng, n, 0.7), -12, -0.1 + 0.05 * i)
    f.wet.add(m['law'], saws(rng, [38, 45, 50, 54, 57], m['c9'] - m['law'] + 0.3, attack=0.1, release=0.4, bright=1800), -14, 0.0)
    f.dry.add(m['law'], brass(rng, [50, 54, 57, 62], 0.9, bright=2400), -10, 0.0)
    for i, n in enumerate([74, 78, 81, 86]):
        f.dry.add(m['law'] + 0.1 + i * 0.08, glock(rng, n, 0.5, 1.2), -12, 0.2)

    e = S['choice'] = Sec(dur, stop=end0, over=0.05)
    e.wet.add(m['c9'], saws(rng, [38, 45, 50, 55], end0 - m['c9'] + 0.2, attack=0.4, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c9'] + 0.2, A['L9w10'] - 0.05, BEAT / 2)):          # the pulse stops for «Пиши один или два»
        e.dry.add(t, pizz(rng, [38, 38, 45, 38][i % 4], 0.4), -12, -0.1)
        if i % 2 == 0:
            e.dry.add(t, timp(rng, 33, 0.3), -13, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.55
    end.wet.add(end0, saws(rng, [38, 45, 50, 53], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1100), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 49, 52, 55], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -15, 0.0)
    for i, (dt, n) in enumerate([(0.0, 74), (0.3, 77), (0.6, 81), (0.9, 77), (1.5, 76), (1.8, 73)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, n, 0.55), -9, 0.15)
    for t in grid(end0, dur - 0.2, BEAT):
        end.dry.add(t, pizz(rng, 38, 0.4), -14, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 1.0, damp=5000, width=0.7), room(rng, 2.6, damp=3800, width=0.9))
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
