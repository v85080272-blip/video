# Score for «Мёртвый город» («Зона», серия 4), synthesised with numpy (48 kHz stereo, no samples). D minor, a beat of 0.6 s.
# The hook: wind of strings and a lone music box, slow and out of tune. The six: a light pizzicato walk, a bell per nick.
# 1986: the music box alone, a slow waltz. Rule one: a low pulse; it stops dead before the crash — a brass stab and a crash.
# Rule two: a hushed pedal, glass notes. The hospital: a tremolo creeping up; the basement: nothing but a low drone. The
# sunset: warm F major, a walking pulse. The frame: the chord opens, a bell for «чисто». The choice: a suspended chord, the
# pulse stops for «Пиши один или два». The end: the music box tune in major.
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
    rng = np.random.default_rng(1986)
    S = {}
    m = {k: M[k] for k in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'crash')}
    end0 = A['L11']
    box = [74, 77, 81, 79, 77, 74, 76, 73]                     # the music box: D minor, a little sad

    a = S['hook'] = Sec(dur, stop=m['c1'], over=0.05)
    a.wet.add(0.0, saws(rng, [38, 45, 50, 53], m['c1'] + 0.3, attack=1.0, release=0.4, bright=500), -17, 0.0)
    for i, t in enumerate(grid(0.4, m['c1'] - 0.3, 0.55)):
        a.dry.add(t, celesta(rng, box[i % 8], 0.5), -15, 0.2 * np.sin(i), )
    a.dry.add(A['L0w11'], timp(rng, 38, 0.6), -12, 0.0)

    b = S['six'] = Sec(dur, stop=m['c2'], over=0.05)
    b.wet.add(m['c1'], saws(rng, [41, 48, 53, 57], m['c2'] - m['c1'] + 0.2, attack=0.4, release=0.3, bright=900), -18, 0.0)
    for i, t in enumerate(grid(m['c1'] + 0.1, m['c2'], BEAT / 2)):
        b.dry.add(t, pizz(rng, [41, 48, 53, 48, 45, 48, 52, 48][i % 8], 0.5), -14, -0.2 + 0.4 * (i % 2))
    for k, w_ in enumerate(('L1w4', 'L1w5', 'L1w7', 'L1w10')):
        b.dry.add(A[w_], glock(rng, [81, 84, 88, 86][k], 0.5, 1.4), -15, -0.3 + 0.2 * k)

    c = S['1986'] = Sec(dur, stop=m['c3'], over=0.05)
    c.wet.add(m['c2'], saws(rng, [38, 45, 50], m['c3'] - m['c2'] + 0.2, attack=0.8, release=0.3, bright=400), -19, 0.0)
    for i, t in enumerate(grid(m['c2'] + 0.15, m['c3'] - 0.2, 0.4)):
        c.dry.add(t, celesta(rng, [74, 77, 81, 74, 76, 79, 73, 76, 79][i % 9], 0.45 if i % 3 else 0.6), -14, 0.15)

    d = S['rule1'] = Sec(dur, stop=m['crash'] - 0.35, over=0.03)                 # the pulse stops dead before the slab
    d.wet.add(m['c3'], saws(rng, [26, 33, 38, 41], m['crash'] - m['c3'], attack=0.4, release=0.1, bright=400), -15, 0.0)
    for i, t in enumerate(grid(m['c3'] + 0.1, m['crash'] - 0.4, BEAT)):
        d.dry.add(t, timp(rng, 26, 0.35), -15, 0.0)
        d.dry.add(t + BEAT / 2, pizz(rng, 38, 0.4), -16, 0.0)

    e = S['crash'] = Sec(dur, stop=m['c5'], over=0.05)
    e.dry.add(m['crash'], brass(rng, [26, 33, 38, 44], 0.8, bright=2200), -9, 0.0)
    e.dry.add(m['crash'], crash(rng, 0.9, 2.2), -12, 0.0)
    e.wet.add(m['crash'] + 0.4, trem(rng, [62, 63], m['c5'] - m['crash'] - 0.4, grow=(0.9, 0.3), bright=2400), -21, 0.0)

    f = S['rule2'] = Sec(dur, stop=m['c6'], over=0.05)
    f.wet.add(m['c5'], saws(rng, [38, 45, 50, 53], m['c6'] - m['c5'] + 0.2, attack=0.6, release=0.3, bright=600), -18, 0.0)
    for i, (dt, n) in enumerate([(0.3, 81), (1.1, 77), (1.9, 84), (2.7, 76)]):
        if m['c5'] + dt < m['c6'] - 0.3:
            f.dry.add(m['c5'] + dt, glock(rng, n, 0.4, 1.6), -18, 0.35 - 0.2 * i)

    g_ = S['hospital'] = Sec(dur, stop=m['c7'], over=0.05)
    g_.wet.add(m['c6'], saws(rng, [26, 33, 38], m['c7'] - m['c6'] + 0.2, attack=0.5, release=0.2, bright=280), -15, 0.0)
    g_.wet.add(m['c6'] + 0.3, trem(rng, [62, 63, 68], m['c7'] - m['c6'] - 0.3, grow=(0.2, 1.0), bright=2600), -20, 0.0)

    h = S['basement'] = Sec(dur, stop=m['c8'], over=0.05)
    h.wet.add(m['c7'], saws(rng, [26, 27], m['c8'] - m['c7'] + 0.2, attack=0.3, release=0.3, bright=200), -14, 0.0)

    i_ = S['sunset'] = Sec(dur, stop=m['c9'], over=0.05)
    i_.wet.add(m['c8'], saws(rng, [41, 48, 53, 57], m['c9'] - m['c8'] + 0.2, attack=0.6, release=0.3, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c8'] + 0.1, m['c9'], BEAT / 2)):
        i_.dry.add(t, pizz(rng, [41, 41, 48, 41, 45, 45, 48, 52][i % 8], 0.5), -14, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            i_.dry.add(t, timp(rng, 29, 0.3), -15, 0.0)

    j = S['frame'] = Sec(dur, stop=m['c10'], over=0.05)
    j.wet.add(m['c9'], saws(rng, [41, 48, 53, 57, 60], m['c10'] - m['c9'] + 0.3, attack=0.6, release=0.3, bright=1100), -16, 0.0)
    j.dry.add(A['L9w3'], glock(rng, 84, 0.6, 2.0), -13, 0.2)
    for k, (dt, n) in enumerate([(0.0, 77), (0.3, 81), (0.6, 84)]):
        j.dry.add(A['L9w6'] + dt, celesta(rng, n, 0.6), -13, 0.15)

    ch = S['choice'] = Sec(dur, stop=end0, over=0.05)
    ch.wet.add(m['c10'], saws(rng, [38, 45, 50, 55], end0 - m['c10'] + 0.2, attack=0.5, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c10'] + 0.2, A['L10w8'] - 0.05, BEAT / 2)):     # the pulse stops for «Пиши один или два»
        ch.dry.add(t, pizz(rng, [38, 38, 45, 38][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            ch.dry.add(t, timp(rng, 26, 0.3), -14, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    mid = end0 + (dur - end0) * 0.6
    end.wet.add(end0, saws(rng, [38, 45, 50, 54], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1000), -15, 0.0)
    end.wet.add(mid, saws(rng, [43, 50, 55, 59], max(0.4, dur - mid - 0.6), attack=0.3, release=0.4, bright=1000), -16, 0.0)
    for k, (dt, n) in enumerate([(0.0, 74), (0.35, 78), (0.7, 81), (1.05, 79), (1.6, 78)]):
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
