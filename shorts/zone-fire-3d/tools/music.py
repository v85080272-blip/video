# Score for «Лес горит» («Зона», серия 5), synthesised with numpy (48 kHz stereo, no samples). D minor, a beat of 0.5 s.
# The hook: a low drone and a timpani hit on «горит». The wind: a fast pizzicato run. The dust: a thin tremolo and glass.
# The STOP: the pulse stops dead on «Стоп», a held chord, a tick per half-second under «ДУМАЙ», a stab on «Два!». The
# answer: the chord opens. The checkpoint: a steady walk, a bell on «выпускают». April 2020: low strings, timpani, a brass
# swell on «до Киева». The end: a suspended chord, then D major and a bell, a loop back to the hook's drone.
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


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(2020)
    S = {}
    m = {k: M[k] for k in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'ans')}

    a = S['hook'] = Sec(dur, stop=m['c1'], over=0.05)
    a.wet.add(0.0, saws(rng, [26, 38, 45, 50], m['c1'] + 0.3, attack=0.05, release=0.4, bright=600), -16, 0.0)
    for i, t in enumerate(grid(0.05, m['c1'] - 0.1, BEAT / 2)):
        a.dry.add(t, pizz(rng, [38, 38, 41, 38][i % 4], 0.35), -16, -0.15 + 0.3 * (i % 2))
    a.dry.add(A['L0w7'], timp(rng, 26, 0.8), -10, 0.0)
    a.dry.add(A['L0w7'], brass(rng, [26, 33, 38], 0.6, bright=1600), -15, 0.0)

    b = S['wind'] = Sec(dur, stop=m['c2'], over=0.05)
    b.wet.add(m['c1'], saws(rng, [38, 45, 50, 53], m['c2'] - m['c1'] + 0.2, attack=0.2, release=0.3, bright=1200), -17, 0.0)
    for i, t in enumerate(grid(m['c1'] + 0.05, m['c2'], BEAT / 4)):
        b.dry.add(t, pizz(rng, [50, 53, 57, 53, 50, 48, 50, 45][i % 8], 0.25), -17, -0.3 + 0.6 * ((i // 2) % 2))
        if i % 4 == 0:
            b.dry.add(t, timp(rng, 26, 0.25), -17, 0.0)

    c = S['dust'] = Sec(dur, stop=m['c3'], over=0.05)
    c.wet.add(m['c2'], saws(rng, [26, 33, 38], m['c3'] - m['c2'] + 0.2, attack=0.5, release=0.2, bright=350), -16, 0.0)
    c.wet.add(m['c2'] + 0.2, trem(rng, [74, 75], m['c3'] - m['c2'] - 0.3, grow=(0.3, 1.0), bright=2600), -21, 0.0)
    for i, (dt, n) in enumerate([(0.4, 86), (1.2, 87), (2.0, 82)]):
        if m['c2'] + dt < m['c3'] - 0.3:
            c.dry.add(m['c2'] + dt, glock(rng, n, 0.4, 1.4), -19, 0.3 - 0.3 * i)

    d = S['stop'] = Sec(dur, stop=m['ans'] - 0.02, over=0.02)            # the pulse is gone: a held chord and the ticks
    d.dry.add(A['L3w0'], brass(rng, [26, 33, 38, 44], 0.5, bright=2000), -12, 0.0)
    d.wet.add(A['L3w0'] + 0.1, saws(rng, [38, 44, 50, 51], m['ans'] - A['L3w0'], attack=0.8, release=0.05, bright=700), -18, 0.0)
    for i, t in enumerate(grid(A['L3e'], m['ans'] - 0.1, 0.5)):
        d.dry.add(t, glock(rng, 93, 0.12, 0.25), -17 + i, 0.0)
    d.wet.add(A['L3e'], riser(rng, m['ans'] - A['L3e']), -20, 0.0)

    e = S['answer'] = Sec(dur, stop=m['c5'], over=0.05)
    e.dry.add(m['ans'], crash(rng, 0.7, 1.6), -16, 0.0)
    e.dry.add(m['ans'], timp(rng, 38, 0.6), -11, 0.0)
    e.wet.add(m['ans'], saws(rng, [38, 45, 50, 53, 57], m['c5'] - m['ans'] + 0.2, attack=0.15, release=0.3, bright=1100), -16, 0.0)
    for k, (dt, n) in enumerate([(0.05, 74), (0.3, 77), (0.55, 81)]):
        e.dry.add(m['ans'] + dt, celesta(rng, n, 0.5), -13, 0.15)

    f = S['checkpoint'] = Sec(dur, stop=m['c6'], over=0.05)
    f.wet.add(m['c5'], saws(rng, [41, 48, 53, 57], m['c6'] - m['c5'] + 0.2, attack=0.4, release=0.3, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c5'] + 0.1, m['c6'] - 0.1, BEAT)):
        f.dry.add(t, pizz(rng, [41, 48, 45, 48][i % 4], 0.45), -14, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            f.dry.add(t, timp(rng, 29, 0.3), -16, 0.0)
    f.dry.add(A['L5w13'] + 0.35, glock(rng, 84, 0.6, 2.0), -13, 0.2)

    g_ = S['2020'] = Sec(dur, stop=m['c7'], over=0.05)
    g_.wet.add(m['c6'], saws(rng, [26, 33, 38, 41], m['c7'] - m['c6'] + 0.2, attack=0.6, release=0.3, bright=500), -15, 0.0)
    for i, t in enumerate(grid(m['c6'] + 0.1, A['L6w15'], BEAT * 2)):
        g_.dry.add(t, timp(rng, 26, 0.5), -14, 0.0)
    g_.wet.add(A['L6w14'], trem(rng, [62, 65, 69], A['L6e'] - A['L6w14'] + 0.3, grow=(0.2, 1.0), bright=2400), -19, 0.0)
    g_.dry.add(A['L6w18'], brass(rng, [26, 33, 38, 45], 0.9, bright=2400), -11, 0.0)
    g_.dry.add(A['L6w18'], timp(rng, 26, 0.9), -11, 0.0)

    end = S['end'] = Sec(dur, gain=((m['c7'], -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    mid = A['L7w6']
    end.wet.add(m['c7'], saws(rng, [38, 43, 50, 55], mid - m['c7'] + 0.3, attack=0.4, release=0.4, bright=900), -16, 0.0)
    end.wet.add(mid, saws(rng, [38, 45, 50, 54], max(0.4, dur - mid - 0.6), attack=0.3, release=0.4, bright=1000), -16, 0.0)
    for i, t in enumerate(grid(mid + 0.1, dur - 0.4, BEAT / 2)):
        end.dry.add(t, pizz(rng, [38, 38, 41, 38][i % 4], 0.35), -17, -0.15 + 0.3 * (i % 2))       # the hook's pulse: a loop
    end.dry.add(A['L7w12'], glock(rng, 86, 0.6, 2.0), -13, 0.2)
    for k, (dt, n) in enumerate([(0.0, 74), (0.3, 78), (0.6, 81)]):
        end.dry.add(A['L7w12'] + 0.1 + dt, celesta(rng, n, 0.6), -12, 0.15)
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
