# Score for «Упала с трёх километров» («Реальные истории», №1: Юлиане Кёпке), synthesised with numpy (48 kHz stereo).
# D minor, a beat of 0.6 s, every entry on a mark from build/cues.json.
# The hook: the air, a high tremolo and a falling celesta; a brass stamp on «И выжила». The storm: a low drone, timpani
# rumbling, a crash on the bolt. The fall: a riser down into a choke (the blackout), then the jungle: a soft high chord,
# glass notes. The lesson of the father: warm F major, a celesta tune; a pizzicato walk from the map on, a bell on «к
# людям». The walk: the pizzicato keeps going, a glock for the sweets. The wound: a low pedal, a tremolo tightening. The
# boat: the chord lifts; a stab when she pours the petrol. The rescue: D major, wide strings, timpani. The rule: a steady
# pulse. The choice: a suspended chord, the pulse stops for «Пиши один или два». The end: the tune again.
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
    rng = np.random.default_rng(1971)
    S = {}
    m = {k: M[k] for k in ('survived', 'c1', 'bolt', 'c2', 'wake', 'c3', 'c4', 'map', 'people', 'c5', 'candy', 'c6', 'c7',
                           'fuel', 'c8', 'c9', 'c10', 'c11')}
    end0 = A['L11']

    h = S['hook'] = Sec(dur, stop=m['c1'] + 0.2, over=0.08)
    h.wet.add(0.0, trem(rng, [74, 77, 81], m['survived'] + 0.2, grow=(0.25, 0.9), bright=3000), -22, 0.0)
    h.wet.add(0.0, saws(rng, [38, 45, 50], m['survived'] + 0.3, attack=0.3, release=0.4, bright=400), -17, 0.0)
    for i, n in enumerate([86, 84, 81, 77, 74, 72]):
        h.dry.add(0.25 + i * 0.55, celesta(rng, n, 0.55), -14, 0.4 - 0.15 * i)
    h.dry.add(m['survived'], brass(rng, [50, 57, 62, 65], 0.8, bright=2400), -9, 0.0)
    h.dry.add(m['survived'], timp(rng, 38, 0.9), -8, 0.0)
    h.dry.add(m['survived'], crash(rng, 0.6), -14, 0.0)

    st = S['storm'] = Sec(dur, stop=m['c2'] + 0.1, over=0.08)
    st.wet.add(m['c1'], saws(rng, [26, 33, 38], m['c2'] - m['c1'] + 0.3, attack=0.5, release=0.4, bright=260), -13, 0.0)
    for i, t in enumerate(grid(m['c1'] + 0.3, m['bolt'] - 0.1, BEAT / 2)):
        st.dry.add(t, timp(rng, 33, 0.25 + 0.5 * (t - m['c1']) / (m['bolt'] - m['c1'])), -16, 0.0)
    st.dry.add(m['bolt'], crash(rng, 1.0, 2.5), -10, 0.0)
    st.dry.add(m['bolt'], brass(rng, [38, 45, 51], 0.7, bright=2000), -10, 0.0)
    st.wet.add(m['bolt'] + 0.1, trem(rng, [62, 63, 68], m['c2'] - m['bolt'], grow=(1.0, 0.4), bright=2600), -20, 0.0)

    f = S['fall'] = Sec(dur, stop=m['wake'] - 0.25, over=0.03)
    f.wet.add(m['c2'], saws(rng, [27, 34, 39], m['wake'] - m['c2'], attack=0.2, release=0.2, bright=300), -14, 0.0)
    f.wet.add(m['c2'] + 0.2, riser(rng, m['wake'] - m['c2'] - 0.45), -14, 0.0)

    j = S['jungle'] = Sec(dur, stop=m['c4'], over=0.05)
    j.wet.add(m['wake'] + 0.2, saws(rng, [50, 57, 62, 65], m['c4'] - m['wake'], attack=1.4, release=0.4, bright=700), -20, 0.0)
    for i, (dt, n) in enumerate([(0.6, 81), (1.5, 77), (2.4, 74), (3.6, 76), (4.5, 72), (5.4, 69)]):
        if m['wake'] + dt < m['c4'] - 0.3:
            j.dry.add(m['wake'] + dt, glock(rng, n, 0.45, 1.6), -18, 0.35 - 0.12 * i)
    for i, t in enumerate(grid(m['c3'] + 0.1, m['c4'], BEAT * 2)):
        j.dry.add(t, pizz(rng, [38, 45][i % 2], 0.4), -15, 0.0)

    fa = S['father'] = Sec(dur, stop=m['c5'], over=0.05)
    fa.wet.add(m['c4'], saws(rng, [41, 48, 53, 57], m['map'] - m['c4'] + 0.3, attack=0.5, release=0.4, bright=900), -17, 0.0)
    tune = [69, 72, 77, 76, 74, 72, 74, 69]
    step = (m['map'] - m['c4'] - 0.3) / len(tune)
    for k, n in enumerate(tune):
        fa.dry.add(m['c4'] + 0.15 + k * step, celesta(rng, n, 0.65), -12, 0.15)
    fa.wet.add(m['map'], saws(rng, [38, 45, 50, 53, 57], m['c5'] - m['map'] + 0.2, attack=0.3, release=0.3, bright=800), -17, 0.0)
    for i, t in enumerate(grid(m['map'] + 0.1, m['c5'], BEAT)):
        fa.dry.add(t, pizz(rng, [38, 45, 50, 45][i % 4], 0.55), -13, -0.2 + 0.4 * (i % 2))
    fa.dry.add(m['people'] + 0.1, glock(rng, 86, 0.6, 2.0), -14, 0.3)

    w = S['walk'] = Sec(dur, stop=m['c6'], over=0.05)
    w.wet.add(m['c5'], saws(rng, [38, 45, 50, 53], m['c6'] - m['c5'] + 0.2, attack=0.6, release=0.3, bright=650), -18, 0.0)
    for i, t in enumerate(grid(m['c5'], m['c6'], BEAT)):
        w.dry.add(t, pizz(rng, [38, 45, 48, 45, 38, 45, 46, 45][i % 8], 0.55), -13, -0.2 + 0.4 * (i % 2))
    for i, n in enumerate([81, 84, 86]):
        w.dry.add(m['candy'] + 0.15 + i * 0.18, glock(rng, n, 0.45, 1.2), -16, 0.3)

    wd = S['wound'] = Sec(dur, stop=m['c7'], over=0.05)
    wd.wet.add(m['c6'], saws(rng, [26, 33, 38], m['c7'] - m['c6'] + 0.3, attack=0.4, release=0.3, bright=300), -14, 0.0)
    wd.wet.add(m['c6'] + 0.3, trem(rng, [62, 63], m['c7'] - m['c6'] - 0.3, grow=(0.2, 1.0), bright=2400), -19, 0.0)
    for i, t in enumerate(grid(m['c6'] + 0.4, m['c7'], BEAT)):
        wd.dry.add(t, timp(rng, 31, 0.35), -17, 0.0)

    b = S['boat'] = Sec(dur, stop=m['c8'], over=0.05)
    b.wet.add(m['c7'], saws(rng, [41, 48, 53, 57], m['fuel'] - m['c7'] + 0.2, attack=0.6, release=0.3, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c7'] + 0.1, m['fuel'], BEAT)):
        b.dry.add(t, pizz(rng, [41, 48, 53, 48][i % 4], 0.5), -14, -0.2 + 0.4 * (i % 2))
    b.dry.add(m['fuel'], brass(rng, [38, 44, 50, 56], 0.6, bright=2200), -11, 0.0)
    b.wet.add(m['fuel'] + 0.1, trem(rng, [68, 69, 74], m['c8'] - m['fuel'], grow=(0.9, 0.5), bright=2800), -20, 0.0)

    r = S['rescue'] = Sec(dur, stop=m['c9'] + 0.3, over=0.08)
    r.wet.add(m['c8'], saws(rng, [38, 50, 54, 57, 62], m['c9'] - m['c8'] + 0.5, attack=0.8, release=0.5, bright=1300), -14, 0.0)
    r.dry.add(m['c8'] + 0.05, timp(rng, 38, 0.8), -9, 0.0)
    for i, (dt, n) in enumerate([(0.3, 74), (0.7, 78), (1.1, 81), (1.6, 86)]):
        r.dry.add(m['c8'] + dt, celesta(rng, n, 0.7), -11, 0.2)

    le = S['lesson'] = Sec(dur, stop=m['c10'], over=0.05)
    le.wet.add(m['c9'], saws(rng, [38, 45, 50, 54], m['c10'] - m['c9'] + 0.2, attack=0.4, release=0.3, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c9'] + 0.1, m['c10'], BEAT)):
        le.dry.add(t, pizz(rng, [38, 45, 50, 45][i % 4], 0.5), -13, -0.2 + 0.4 * (i % 2))
        if i % 4 == 0:
            le.dry.add(t, timp(rng, 38, 0.3), -15, 0.0)

    c = S['choice'] = Sec(dur, stop=end0, over=0.05)
    c.wet.add(m['c10'], saws(rng, [38, 45, 50, 55], end0 - m['c10'] + 0.2, attack=0.5, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c10'] + 0.2, A['L10w12'] - 0.05, BEAT / 2)):     # the pulse stops for «Пиши один или два»
        c.dry.add(t, pizz(rng, [38, 38, 45, 38][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            c.dry.add(t, timp(rng, 33, 0.3), -14, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    end.wet.add(end0, saws(rng, [38, 45, 50, 53], dur - end0 + 0.3, attack=0.4, release=0.5, bright=900), -15, 0.0)
    for i, (dt, n) in enumerate([(0.0, 69), (0.35, 72), (0.7, 77), (1.05, 76), (1.6, 74)]):
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
