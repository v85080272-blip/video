# Score for «По крышам» («Заражение», серия 4), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every entry on a mark from build/cues.json.
# A · night on our roof: a low drone, three celesta notes with the torch blinking below. B · «только шагом»: a slow
# pizzicato walk. C · the edge: a tremolo tightening, a low swell with the gust. D · the ladder: a xylophone tick for each
# rung over a held chord. E · «Красотка и Соломия»: a warm B-flat chord and a celesta tune. F · the radio: hope — a slow
# D major brass swell. G · «нас пятеро», the choice: a pulse under a suspended chord. The end: a celesta tune and A7 for
# the loop back into D minor.
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
    rng = np.random.default_rng(404)
    S = {}
    cA, cB, cC, cD, cE, cF, cG, names, radio, choice, c8 = (M[k] for k in ('cA', 'cB', 'cC', 'cD', 'cE', 'cF', 'cG', 'names', 'radio', 'choice', 'c8'))
    end0 = A['L7']

    a = S['A'] = Sec(dur, stop=cB, over=0.05)
    a.wet.add(0.0, saws(rng, [26, 38, 45], cB + 0.2, attack=1.0, release=0.3, bright=380), -17, 0.0)
    blink = cA + (cB - cA) * 0.35
    for i, m in enumerate([81, 81, 81]):
        a.dry.add(blink + i * 0.4, celesta(rng, m, 0.3), -13, 0.5)
    a.wet.add(blink + 1.4, trem(rng, [69, 74], cB - blink - 1.2, grow=(0.1, 0.5), bright=3000), -24, 0.0)

    b = S['B'] = Sec(dur, stop=cD, over=0.05)
    b.wet.add(cB, saws(rng, [26, 33, 38], cD - cB, attack=0.3, release=0.2, bright=400), -18, 0.0)
    for i, t in enumerate(grid(cB, cC, BEAT)):
        b.dry.add(t, pizz(rng, [38, 45, 41, 45][i % 4], 0.45), -12, -0.2 + 0.4 * (i % 2))
    b.wet.add(cC, trem(rng, [62, 63], cD - cC, grow=(0.2, 1.0), bright=2400), -20, 0.0)
    b.wet.add(cC + 0.3, riser(rng, max(0.4, cD - cC - 0.3)), -18, 0.0)
    for i, t in enumerate(grid(cC, cD, BEAT)):
        b.dry.add(t, pizz(rng, [38, 39][i % 2], 0.4), -12, 0.0)

    c = S['C'] = Sec(dur, stop=cE, over=0.05)
    c.wet.add(cD, saws(rng, [33, 45, 48, 52], cE - cD, attack=0.3, release=0.3, bright=700), -17, 0.0)
    for i, t in enumerate(np.linspace(cD + 0.2, cE - 0.2, 10, endpoint=False)):
        c.dry.add(t, xylo(rng, [81, 79, 77, 76, 74, 72, 74, 72, 70, 69][i], 0.2), -15, 0.2)
    c.dry.add(cD, timp(rng, 33, 0.6), -9, 0.0)

    d = S['D'] = Sec(dur, stop=cG, over=0.05)
    d.wet.add(cE, saws(rng, [34, 46, 50, 53, 58], cF - cE + 0.2, attack=0.4, release=0.4, bright=1200), -14, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.35, 77), (0.7, 82), (1.2, 81), (1.6, 77)]):
        d.dry.add(names + dt, celesta(rng, m, 0.5), -11, -0.2 + 0.1 * i)
    d.wet.add(cF, saws(rng, [38, 45, 50, 54], cG - cF + 0.2, attack=0.6, release=0.4, bright=1500), -15, 0.0)
    d.dry.add(radio, brass(rng, [50, 54, 57, 62], 0.9, bright=2200), -9, 0.0)
    d.dry.add(radio, timp(rng, 38, 0.7), -9, 0.0)
    for i, m in enumerate([74, 78, 81, 86]):
        d.dry.add(radio + 0.2 + i * 0.09, glock(rng, m, 0.5, 1.2), -12, 0.2)

    e = S['E'] = Sec(dur, stop=end0, over=0.05)
    e.wet.add(cG, saws(rng, [38, 45, 50, 55], end0 - cG + 0.2, attack=0.4, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(choice, end0, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 38, 45, 38][i % 4], 0.4), -12, -0.1)
        if i % 2 == 0:
            e.dry.add(t, timp(rng, 33, 0.3), -13, 0.0)

    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.55
    end.wet.add(end0, saws(rng, [38, 45, 50, 53], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1100), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 49, 52, 55], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -15, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.3, 77), (0.6, 81), (0.9, 77), (1.5, 76), (1.8, 73)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -9, 0.15)
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
