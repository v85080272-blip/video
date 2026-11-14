# Score for «Корабль раздавило льдом» (a picture story), synthesised with numpy (48 kHz stereo). D minor, beat 0.5 s.
# The ice: a cold string pad and glass; the camp and the boats: a slow pulse; STOP: a brass stab, then silence under the
# countdown; the voyage: a driving pulse with timpani; the rescue: D major, brass and celesta; the wreck: a hush.
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
    rng = np.random.default_rng(1915)
    S = {}
    c3, ans = M['c3'], M['ans']

    s = S['ice'] = Sec(dur, stop=c3 + 0.1, over=0.05)
    s.wet.add(0.0, saws(rng, [38, 45, 50, 53], c3 + 0.2, attack=0.6, release=0.3, bright=700), -17, 0.0)
    s.dry.add(A['L0w2'] - 0.03, timp(rng, 26, 0.9), -9, 0.0)
    for i, t in enumerate(grid(0.4, A['L2w2'], 0.7)):
        s.dry.add(t, glock(rng, [86, 81, 84, 77][i % 4], 0.4, 1.4), -20, 0.3 - 0.2 * (i % 4))
    for i, t in enumerate(grid(A['L2w2'], c3 - 0.05, BEAT)):
        s.dry.add(t, pizz(rng, [38, 45, 50, 45][i % 4], 0.5), -14, -0.2 + 0.4 * (i % 2))

    st = S['stop'] = Sec(dur, stop=A['L4w9'], over=0.05)
    st.dry.add(A['L3w0'] - 0.03, brass(rng, [38, 45, 50, 56], 0.6, bright=2600), -9, 0.0)
    st.dry.add(A['L3w0'] - 0.03, timp(rng, 26, 0.9), -9, 0.0)
    st.wet.add(A['L3w0'] + 0.3, saws(rng, [38, 45, 52], max(0.3, A['L3e'] - A['L3w0'] - 0.3), attack=0.5, release=0.15, bright=500), -19, 0.0)
    st.wet.add(A['L4'], saws(rng, [38, 45, 50], A['L4w9'] - A['L4'], attack=0.4, release=0.2, bright=400), -18, 0.0)
    st.dry.add(ans, brass(rng, [50, 57, 62, 66], 0.7, bright=2600), -11, 0.0)

    v = S['voyage'] = Sec(dur, stop=A['L6'], over=0.06)
    v.wet.add(A['L4w9'], saws(rng, [38, 45, 50, 53], A['L6'] - A['L4w9'] + 0.2, attack=0.2, release=0.3, bright=900), -16, 0.0)
    for i, t in enumerate(grid(A['L4w9'], A['L6'] - 0.05, BEAT / 2)):
        v.dry.add(t, pizz(rng, [38, 50, 45, 50, 41, 50, 45, 53][i % 8], 0.5), -12, -0.25 + 0.5 * (i % 2))
        if i % 2 == 0:
            v.dry.add(t, timp(rng, 26, 0.4), -14, 0.0)
    v.wet.add(A['L6'] - 1.0, riser(rng, 1.0), -16, 0.0)

    r = S['rescue'] = Sec(dur, stop=A['L7w4'] + 0.2, over=0.08)
    r.wet.add(A['L6'], saws(rng, [50, 57, 62, 66], A['L7w4'] - A['L6'] + 0.4, attack=0.5, release=0.4, bright=1300), -14, 0.0)
    r.dry.add(A['L6'], timp(rng, 26, 0.9), -9, 0.0)
    r.dry.add(A['L7'], crash(rng, 0.6), -14, 0.0)
    r.dry.add(A['L7'], brass(rng, [50, 57, 62, 66], 0.9, bright=2600), -10, 0.0)
    for k, (dt, n) in enumerate([(0.2, 74), (0.5, 78), (0.8, 81), (1.2, 86)]):
        r.dry.add(A['L7'] + dt, celesta(rng, n, 0.6), -12, 0.15)

    e = S['end'] = Sec(dur, gain=((A['L7w4'], -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    e.wet.add(A['L7w4'], saws(rng, [38, 45, 50, 57], max(0.5, dur - A['L7w4'] - 0.3), attack=0.8, release=0.4, bright=600), -18, 0.0)
    e.wet.add(A['L7w4'] + 0.3, trem(rng, [74, 76], max(0.5, dur - A['L7w4'] - 0.6), grow=(0.2, 0.6), bright=2000), -24, 0.0)
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
