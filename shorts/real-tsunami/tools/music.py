# Score for «Цунами» (2D, ≤45 s), synthesised with numpy (48 kHz stereo). D minor, beat 0.45 s.
# The sea pulls back: a thin high drone and glass notes falling like the water going out. The wave on the horizon: the
# drone drops low, a timpani hit on «цунами» and a riser. Run: a driving pizzicato pulse with timpani. STOP: a brass stab,
# then the music cuts out under the countdown (only the clock, in the sound effects); a bell and a major brass chord on
# «Два!». The hotel: the pulse again, a crash on each wave, held breath between them. 2004: hope — a warm pad and a
# celesta tune, a timpani roll on «подняла тревогу», a cymbal on «ста человек». The end: the tune in D major, fading.
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
    rng = np.random.default_rng(2004)
    S = {}
    m = {k: M[k] for k in ('c1', 'c2', 'c3', 'ans', 'c4', 'bal', 'w1', 'back', 'w2', 'c5', 'c6')}

    s = S['sea'] = Sec(dur, stop=m['c1'] + 0.1, over=0.05)
    s.wet.add(0.0, saws(rng, [62, 69, 74], m['c1'] + 0.2, attack=0.4, release=0.3, bright=900), -24, 0.0)
    for i, t in enumerate(grid(0.25, m['c1'] - 0.1, 0.6)):          # falling glass, like the water going out
        s.dry.add(t, glock(rng, [86, 84, 81, 79, 77, 76, 74, 72, 69][i % 9], 0.4, 1.4), -19, 0.4 - 0.1 * (i % 9))

    c = S['close'] = Sec(dur, stop=m['c2'], over=0.04)
    c.wet.add(m['c1'], saws(rng, [26, 33, 38], m['c2'] - m['c1'] + 0.2, attack=0.2, release=0.2, bright=260), -13, 0.0)
    c.wet.add(m['c1'] + 0.2, trem(rng, [74, 75], m['c2'] - m['c1'] - 0.2, grow=(0.1, 0.9), bright=2600), -22, 0.0)
    c.dry.add(A['L2w3'] - 0.03, timp(rng, 26, 1.0), -7, 0.0)
    c.dry.add(A['L2w3'] - 0.03, brass(rng, [38, 45, 50, 53], 0.7, bright=2200), -11, 0.0)
    c.wet.add(m['c2'] - 1.1, riser(rng, 1.1), -15, 0.0)

    r = S['run'] = Sec(dur, stop=m['c3'], over=0.04)
    r.wet.add(m['c2'], saws(rng, [38, 45, 50, 53], m['c3'] - m['c2'] + 0.2, attack=0.1, release=0.2, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c2'] + 0.02, m['c3'] - 0.05, BEAT / 2)):
        r.dry.add(t, pizz(rng, [38, 50, 45, 50, 41, 50, 45, 53][i % 8], 0.5), -12, -0.25 + 0.5 * (i % 2))
        if i % 2 == 0:
            r.dry.add(t, timp(rng, 26, 0.35 + 0.3 * (t - m['c2']) / (m['c3'] - m['c2'])), -13, 0.0)

    st = S['stop'] = Sec(dur, stop=m['c4'] + 0.6, over=0.05)       # a stab on «Стоп», a held chord, silence on the clock
    st.dry.add(A['L4w0'] - 0.03, brass(rng, [38, 45, 50, 56], 0.6, bright=2600), -9, 0.0)
    st.dry.add(A['L4w0'] - 0.03, timp(rng, 26, 0.9), -9, 0.0)
    st.wet.add(A['L4w0'] + 0.3, saws(rng, [38, 45, 52], max(0.3, A['L4e'] - A['L4w0'] - 0.3), attack=0.5, release=0.15, bright=500), -19, 0.0)
    st.dry.add(m['ans'], glock(rng, 86, 0.7, 2.0), -10, 0.0)
    st.dry.add(m['ans'], brass(rng, [50, 57, 62, 66], 0.7, bright=2600), -11, 0.0)

    h = S['hotel'] = Sec(dur, stop=m['c5'], over=0.06)
    h.wet.add(m['c4'], saws(rng, [38, 45, 50], m['c5'] - m['c4'] + 0.2, attack=0.3, release=0.3, bright=500), -16, 0.0)
    for i, t in enumerate(grid(m['c4'] + 0.05, m['w1'], BEAT / 2)):      # climbing
        h.dry.add(t, pizz(rng, [50, 53, 57, 62, 57, 53][i % 6], 0.45), -14, -0.2 + 0.4 * (i % 2))
    for w in ('w1', 'w2'):
        h.dry.add(m[w] + 0.3, timp(rng, 26, 1.0), -6, 0.0)
        h.dry.add(m[w] + 0.3, crash(rng, 0.9), -12, 0.0)
        h.dry.add(m[w] + 0.3, brass(rng, [38, 45, 50, 53], 0.9, bright=2000), -10, 0.0)
    h.wet.add(m['back'], trem(rng, [69, 70], m['w2'] - m['back'], grow=(0.2, 0.9), bright=2400), -21, 0.0)
    h.wet.add(m['w2'] - 0.9, riser(rng, 0.9), -17, 0.0)

    sy = S['story'] = Sec(dur, stop=m['c6'] + 0.1, over=0.08)
    sy.wet.add(m['c5'], saws(rng, [41, 48, 53, 57], m['c6'] - m['c5'] + 0.3, attack=0.8, release=0.4, bright=900), -17, 0.0)
    tune = [(0.3, 69), (0.75, 72), (1.2, 74), (1.65, 77), (2.4, 76), (2.85, 72), (3.3, 74)]
    for dt, n in tune:
        if m['c5'] + dt < A['L7w14'] - 0.2:
            sy.dry.add(m['c5'] + dt, celesta(rng, n, 0.6), -13, 0.15)
    sy.dry.add(A['L7w14'] - 0.05, timp(rng, 26, 0.8), -10, 0.0)
    sy.dry.add(A['L8w1'] - 0.03, crash(rng, 0.6), -15, 0.0)
    sy.dry.add(A['L8w1'] - 0.03, brass(rng, [50, 57, 62, 66], 0.8, bright=2400), -12, 0.0)
    for k, (dt, n) in enumerate([(0.0, 74), (0.3, 78), (0.6, 81), (0.9, 86)]):
        sy.dry.add(A['L8w1'] + 0.2 + dt, celesta(rng, n, 0.6), -12, 0.15)

    e = S['end'] = Sec(dur, gain=((m['c6'], -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    e.wet.add(m['c6'], saws(rng, [50, 57, 62, 66], max(0.5, dur - m['c6'] - 0.4), attack=0.3, release=0.4, bright=1000), -16, 0.0)
    for k, (dt, n) in enumerate([(0.1, 74), (0.4, 78), (0.7, 81), (1.3, 86)]):
        e.dry.add(m['c6'] + dt, celesta(rng, n, 0.6), -11, 0.15)
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
