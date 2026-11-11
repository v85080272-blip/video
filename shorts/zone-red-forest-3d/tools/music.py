# Score for «Рыжий лес» («Зона», серия 2), synthesised with numpy (48 kHz stereo, no samples).
# A minor, slow (a beat of 0.75 s), every entry on a mark from build/cues.json.
# Lost: a wide, cold drone and the air; a falling figure when the bus is gone. 1986: a music box, slow and out of tune,
# over a low chord; a thud when the pines go down. The road: a quiet pizzicato walk; a swell with the gust. The mushrooms
# and the river: high glass notes, a tremolo. The wolves: a low pedal, timpani, a tremolo tightening; on «кричи» a brass
# stab. They go: the chord loosens. The fork: a suspended chord, a pulse that stops for «Пиши один или два». The end: the
# music box again and E7 for the loop.
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
    m = {k: M[k] for k in ('cover', 'bus', 'c1', 'dead', 'c2', 'click', 'c3', 'asphalt', 'c4', 'gust', 'c5', 'c6', 'c7', 'wolves', 'c8', 'shout', 'c9', 'c10', 'c11')}
    end0 = A['L11']

    a = S['lost'] = Sec(dur, stop=m['c1'], over=0.05)
    a.wet.add(m['cover'], saws(rng, [33, 40, 45], m['c1'] - m['cover'] + 0.3, attack=1.2, release=0.4, bright=330), -16, 0.0)
    for i, n in enumerate([76, 74, 72, 69]):
        a.dry.add(m['bus'] + 0.3 + i * 0.22, celesta(rng, n, 0.5), -13, 0.4 - 0.25 * i)

    p = S['past'] = Sec(dur, stop=m['c3'], over=0.05)
    p.wet.add(m['c1'], saws(rng, [33, 45, 48, 52], m['c3'] - m['c1'] + 0.3, attack=0.8, release=0.4, bright=500), -16, 0.0)
    tune = [76, 81, 84, 83, 81, 76, 77, 76, 74, 72, 71, 69]
    step = (m['c3'] - m['c1'] - 0.4) / len(tune)
    for k, n in enumerate(tune):
        p.dry.add(m['c1'] + 0.2 + k * step, celesta(rng, n + rng.uniform(-0.15, 0.15), 0.7), -11, 0.2)
    p.dry.add(m['dead'] + 0.1, timp(rng, 28, 1.0), -9, 0.0)
    p.dry.add(m['click'] - 0.2, timp(rng, 26, 1.2), -8, 0.0)

    r = S['rules'] = Sec(dur, stop=m['c7'], over=0.05)
    r.wet.add(m['c3'], saws(rng, [33, 45, 48, 52], m['c7'] - m['c3'], attack=0.5, release=0.3, bright=520), -18, 0.0)
    for i, t in enumerate(grid(m['c3'], m['c7'], BEAT)):
        r.dry.add(t, pizz(rng, [45, 52, 48, 52][i % 4], 0.5), -14, -0.2 + 0.4 * (i % 2))
    r.wet.add(m['gust'] - 0.2, riser(rng, 1.6), -16, 0.3)
    r.wet.add(m['c5'] + 0.2, trem(rng, [69, 70], m['c7'] - m['c5'] - 0.2, grow=(0.1, 0.8), bright=2600), -21, 0.1)
    for i, n in enumerate([88, 91, 88]):
        r.dry.add(m['c6'] + 0.3 + i * 0.3, glock(rng, n, 0.4, 1.0), -16, 0.3)

    w = S['wolves'] = Sec(dur, stop=m['c9'] + 0.3, over=0.05)
    w.wet.add(m['c7'], saws(rng, [28, 35, 40], m['c9'] - m['c7'] + 0.4, attack=0.3, release=0.4, bright=300), -13, 0.0)
    w.wet.add(m['wolves'], trem(rng, [57, 58, 63], m['c9'] - m['wolves'], grow=(0.3, 1.0), bright=2400), -18, 0.0)
    for i, t in enumerate(grid(m['wolves'], m['shout'], BEAT / 2)):
        w.dry.add(t, timp(rng, 33, 0.3), -14 + (2 if i % 4 == 0 else 0), 0.0)
    w.dry.add(m['shout'], brass(rng, [45, 52, 57, 60], 0.9, bright=2400), -9, 0.0)
    w.dry.add(m['shout'], timp(rng, 33, 0.8), -8, 0.0)

    f = S['fork'] = Sec(dur, stop=end0, over=0.05)
    f.wet.add(m['c9'], saws(rng, [45, 52, 57, 62], end0 - m['c9'] + 0.2, attack=0.6, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c10'] + 0.2, A['L10w9'] - 0.05, BEAT / 2)):      # the pulse stops for «Пиши один или два»
        f.dry.add(t, pizz(rng, [45, 45, 52, 45][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            f.dry.add(t, timp(rng, 33, 0.3), -14, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.6
    end.wet.add(end0, saws(rng, [45, 52, 57, 60], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1000), -15, 0.0)
    end.wet.add(mid, saws(rng, [40, 47, 50, 56], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -16, 0.0)
    for i, (dt, n) in enumerate([(0.0, 76), (0.35, 81), (0.7, 84), (1.05, 83), (1.6, 80), (1.95, 76)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, n, 0.6), -10, 0.15)
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
