# Score for «Тонкий лёд» (2D, ≤45 s), synthesised with numpy (48 kHz stereo). E minor, beat 0.45 s; the ice glass, a timpani on «треск»,
# a careful pulse while he crawls, silence under the STOP countdown, a bell and a major chord on «Два!», a climbing pulse while he
# gets out, glass on the 1 and the 10, a hit on «провалилась», a tremolo under the water clock, E major on «спасли».
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.45


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(1999)
    S = {}
    m = {k: M[k] for k in ('lie', 'c3', 'ans', 'c4', 'c6', 'c7', 'fall', 'under', 'temp', 'saved', 'c8')}

    s = S['lake'] = Sec(dur, stop=m['c3'] + 0.1, over=0.05)
    s.wet.add(0.0, saws(rng, [64, 71, 76], m['c3'] + 0.2, attack=0.3, release=0.3, bright=1200), -24, 0.0)
    for i, t in enumerate(grid(0.2, m['lie'] - 0.1, 0.5)):              # thin glass, like ice ringing
        s.dry.add(t, glock(rng, [88, 83, 91, 86][i % 4], 0.35, 1.2), -19, 0.3 - 0.2 * (i % 4))
    s.dry.add(A['L0w8'] - 0.03, timp(rng, 28, 0.8), -9, 0.0)
    s.dry.add(A['L0w8'] - 0.03, brass(rng, [40, 47, 52, 55], 0.6, bright=2200), -12, 0.0)
    for i, t in enumerate(grid(m['lie'], m['c3'] - 0.05, BEAT / 2)):       # crawling: a careful pulse
        s.dry.add(t, pizz(rng, [40, 47, 52, 47][i % 4], 0.4), -15, -0.2 + 0.4 * (i % 2))
        if i % 4 == 0:
            s.dry.add(t, timp(rng, 28, 0.3), -16, 0.0)
    s.wet.add(m['c3'] - 0.9, riser(rng, 0.9), -17, 0.0)

    st = S['stop'] = Sec(dur, stop=m['c4'] + 0.6, over=0.05)
    st.dry.add(A['L3w0'] - 0.03, brass(rng, [40, 47, 52, 58], 0.6, bright=2600), -9, 0.0)
    st.dry.add(A['L3w0'] - 0.03, timp(rng, 28, 0.9), -9, 0.0)
    st.wet.add(A['L3w0'] + 0.3, saws(rng, [40, 47, 54], max(0.3, A['L3e'] - A['L3w0'] - 0.3), attack=0.5, release=0.15, bright=500), -19, 0.0)
    st.dry.add(m['ans'], glock(rng, 88, 0.7, 2.0), -10, 0.0)
    st.dry.add(m['ans'], brass(rng, [52, 59, 64, 68], 0.7, bright=2600), -11, 0.0)

    o = S['out'] = Sec(dur, stop=m['c6'], over=0.06)
    o.wet.add(m['c4'], saws(rng, [40, 47, 52], m['c6'] - m['c4'] + 0.2, attack=0.3, release=0.3, bright=600), -16, 0.0)
    for i, t in enumerate(grid(m['c4'] + 0.05, m['c6'] - 0.05, BEAT / 2)):     # pulling out: the pulse climbs
        o.dry.add(t, pizz(rng, [40, 43, 47, 52, 47, 43][i % 6] + (5 if t > A['L6'] else 0), 0.45), -13, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            o.dry.add(t, timp(rng, 28, 0.35), -15, 0.0)
    o.dry.add(A['L6w3'] - 0.05, brass(rng, [45, 52, 57, 61], 0.6, bright=2400), -12, 0.0)

    r = S['rule'] = Sec(dur, stop=m['c7'], over=0.06)
    r.wet.add(m['c6'], saws(rng, [40, 47, 52, 55], m['c7'] - m['c6'] + 0.2, attack=0.6, release=0.3, bright=800), -18, 0.0)
    r.dry.add(A['L7w0'] - 0.05, glock(rng, 83, 0.5, 1.6), -12, -0.2)
    r.dry.add(A['L7w7'] - 0.05, glock(rng, 90, 0.5, 1.6), -12, 0.2)

    sy = S['story'] = Sec(dur, stop=m['c8'] + 0.1, over=0.08)
    sy.wet.add(m['c7'], saws(rng, [40, 47, 52], m['temp'] - m['c7'] + 0.2, attack=0.6, release=0.3, bright=500), -17, 0.0)
    sy.dry.add(m['fall'], timp(rng, 28, 1.0), -8, 0.0)
    sy.dry.add(m['fall'], crash(rng, 0.7), -14, 0.0)
    sy.wet.add(m['under'], trem(rng, [71, 72], m['temp'] - m['under'], grow=(0.2, 0.8), bright=2400), -21, 0.0)
    sy.wet.add(m['temp'], saws(rng, [36, 43, 48], m['saved'] - m['temp'] + 0.1, attack=0.3, release=0.1, bright=300), -16, 0.0)
    sy.wet.add(m['saved'], saws(rng, [52, 59, 64, 68], m['c8'] - m['saved'] + 0.3, attack=0.4, release=0.4, bright=1200), -15, 0.0)
    sy.dry.add(m['saved'], brass(rng, [52, 59, 64, 68], 0.8, bright=2600), -11, 0.0)
    for k, (dt, n) in enumerate([(0.1, 76), (0.4, 80), (0.7, 83), (1.0, 88)]):
        sy.dry.add(m['saved'] + dt, celesta(rng, n, 0.6), -12, 0.15)

    e = S['end'] = Sec(dur, gain=((m['c8'], -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    e.wet.add(m['c8'], saws(rng, [52, 59, 64, 68], max(0.5, dur - m['c8'] - 0.4), attack=0.3, release=0.4, bright=1000), -16, 0.0)
    for k, (dt, n) in enumerate([(0.1, 76), (0.4, 80), (0.7, 83)]):
        e.dry.add(m['c8'] + dt, celesta(rng, n, 0.6), -11, 0.15)
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
