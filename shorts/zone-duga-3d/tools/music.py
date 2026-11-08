# Score for «Дуга» («Зона», серия 3), synthesised with numpy (48 kHz stereo, no samples). E minor, a beat of 0.6 s.
# The hook: a low drone, a timpani roll into a brass chord on «гроза». Богдан: a light pizzicato walk and a celesta.
# The woodpecker: a high glass chord over the tapping. Rule one: a slow pulse. Thunder: the music drops out for it, then a
# low tremolo. The run: a driving pulse, timpani on the beats, a brass stab on «разойдитесь», on to the door. Inside: a
# hushed pedal and a thin tremolo. The bolt: a crash and a stab, then nothing. The wait: warm G major, a celesta tune as the
# light comes back. The choice: a suspended chord, the pulse stops for «Пиши один или два». The end: the tune and B7.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.6


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(1976)
    S = {}
    m = {k: M[k] for k in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'storm', 'nick', 'tap', 'thunder', 'spread', 'hit')}
    end0 = A['L12']

    a = S['hook'] = Sec(dur, stop=m['c1'], over=0.05)
    a.wet.add(0.0, saws(rng, [28, 35, 40], m['c1'] + 0.3, attack=0.8, release=0.4, bright=300), -14, 0.0)
    a.wet.add(0.3, trem(rng, [64, 65], m['storm'] - 0.3, grow=(0.2, 0.9), bright=2400), -22, 0.1)
    for i, t in enumerate(grid(m['storm'] - 1.2, m['storm'], 0.1)):
        a.dry.add(t, timp(rng, 28, 0.2 + 0.6 * i / 12), -16, 0.0)
    a.dry.add(m['storm'], brass(rng, [40, 47, 52, 55], 0.9, bright=2000), -10, 0.0)
    a.dry.add(m['storm'], timp(rng, 28, 1.0), -8, 0.0)

    b = S['bogdan'] = Sec(dur, stop=m['c2'], over=0.05)
    b.wet.add(m['c1'], saws(rng, [40, 47, 52, 55], m['c2'] - m['c1'] + 0.2, attack=0.4, release=0.3, bright=900), -18, 0.0)
    for i, t in enumerate(grid(m['c1'] + 0.1, m['c2'], BEAT / 2)):
        b.dry.add(t, pizz(rng, [40, 47, 52, 47, 43, 47, 50, 47][i % 8], 0.5), -14, -0.2 + 0.4 * (i % 2))
    for i, n in enumerate([76, 79, 83]):
        b.dry.add(m['nick'] + i * 0.16, celesta(rng, n, 0.6), -13, 0.3)

    c = S['woodpecker'] = Sec(dur, stop=m['c3'], over=0.05)
    c.wet.add(m['c2'], saws(rng, [40, 47, 54, 59], m['c3'] - m['c2'] + 0.3, attack=0.8, release=0.4, bright=1200), -18, 0.0)
    for i, (dt, n) in enumerate([(0.2, 83), (0.9, 78), (1.6, 86), (2.4, 81)]):
        if m['c2'] + dt < m['c3'] - 0.2:
            c.dry.add(m['c2'] + dt, glock(rng, n, 0.4, 1.6), -18, 0.35 - 0.2 * i)

    d = S['rule1'] = Sec(dur, stop=m['c4'] + 0.05, over=0.05)
    d.wet.add(m['c3'], saws(rng, [28, 35, 40, 43], m['c4'] - m['c3'] + 0.2, attack=0.4, release=0.3, bright=500), -16, 0.0)
    for i, t in enumerate(grid(m['c3'] + 0.1, m['c4'] - 0.2, BEAT)):
        d.dry.add(t, timp(rng, 28, 0.35), -16, 0.0)
        d.dry.add(t + BEAT / 2, pizz(rng, 40, 0.4), -16, 0.0)

    e = S['thunder'] = Sec(dur, stop=m['c5'], over=0.05)        # silent for the thunder, then a low tremolo creeping in
    e.wet.add(m['thunder'] + 1.2, trem(rng, [40, 41, 47], m['c5'] - m['thunder'] - 1.2, grow=(0.1, 1.0), bright=2000), -20, 0.0)
    e.wet.add(m['thunder'] + 1.0, saws(rng, [28, 35], m['c5'] - m['thunder'] - 0.8, attack=1.0, release=0.2, bright=250), -16, 0.0)

    r = S['run'] = Sec(dur, stop=m['c8'], over=0.05)
    r.wet.add(m['c5'], saws(rng, [28, 40, 47, 52], m['c8'] - m['c5'] + 0.2, attack=0.2, release=0.3, bright=800), -16, 0.0)
    for i, t in enumerate(grid(m['c5'], m['c8'] - 0.1, BEAT / 2)):
        r.dry.add(t, pizz(rng, [40, 40, 47, 40, 43, 43, 47, 50][i % 8], 0.6), -12, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            r.dry.add(t, timp(rng, 28, 0.45 if i % 4 == 0 else 0.3), -13, 0.0)
    r.wet.add(m['c6'], trem(rng, [64, 67, 71], m['c8'] - m['c6'], grow=(0.3, 1.0), bright=2800), -20, 0.0)
    r.dry.add(m['spread'], brass(rng, [40, 47, 52, 59], 0.6, bright=2200), -11, 0.0)
    r.wet.add(m['c8'] - 1.4, riser(rng, 1.4), -16, 0.0)

    i_ = S['inside'] = Sec(dur, stop=m['c9'] + 0.02, over=0.02)
    i_.wet.add(m['c8'], saws(rng, [28, 35, 40], m['c9'] - m['c8'] + 0.2, attack=0.3, release=0.2, bright=300), -16, 0.0)
    i_.wet.add(m['c8'] + 0.3, trem(rng, [71, 72], m['c9'] - m['c8'] - 0.3, grow=(0.2, 0.8), bright=2400), -22, 0.0)

    j = S['bolt'] = Sec(dur, stop=m['c10'], over=0.05)
    j.dry.add(m['hit'], crash(rng, 1.0, 2.5), -10, 0.0)
    j.dry.add(m['hit'], brass(rng, [28, 35, 40, 46], 0.8, bright=2600), -8, 0.0)
    j.dry.add(m['hit'], timp(rng, 28, 1.0), -7, 0.0)

    k = S['wait'] = Sec(dur, stop=m['c11'], over=0.05)
    k.wet.add(m['c10'], saws(rng, [43, 50, 55, 59], m['c11'] - m['c10'] + 0.3, attack=1.2, release=0.4, bright=900), -17, 0.0)
    tune = [71, 74, 79, 78, 74, 76, 71]
    step = (m['c11'] - m['c10'] - 0.6) / len(tune)
    for q, n in enumerate(tune):
        k.dry.add(m['c10'] + 0.4 + q * step, celesta(rng, n, 0.6), -13, 0.15)

    f = S['choice'] = Sec(dur, stop=end0, over=0.05)
    f.wet.add(m['c11'], saws(rng, [40, 47, 52, 57], end0 - m['c11'] + 0.2, attack=0.6, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c11'] + 0.2, A['L11w9'] - 0.05, BEAT / 2)):     # the pulse stops for «Пиши один или два»
        f.dry.add(t, pizz(rng, [40, 40, 47, 40][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            f.dry.add(t, timp(rng, 28, 0.3), -14, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    mid = end0 + (dur - end0) * 0.6
    end.wet.add(end0, saws(rng, [40, 47, 52, 55], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1000), -15, 0.0)
    end.wet.add(mid, saws(rng, [35, 42, 45, 51], max(0.4, dur - mid - 0.6), attack=0.3, release=0.4, bright=1000), -16, 0.0)
    for i, (dt, n) in enumerate([(0.0, 71), (0.35, 74), (0.7, 79), (1.05, 78), (1.6, 75)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, n, 0.6), -11, 0.15)
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
