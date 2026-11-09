# Score for «Дети в затопленной пещере» («Реальные истории», №3), synthesised with numpy (48 kHz stereo). E minor, beat 0.5 s.
# The hook: a low drone and dripping glass notes, a brass stab on «во сне». The mouth: a bright pizzicato walk; the rain: it
# turns minor, timpani. The flood: a driving pulse and a riser. The drip: sparse glass. STOP: the music cuts out — only the
# ticking clock (sound effects), then a bell on «Ждать!». Under water: a hushed pedal. The divers: hope, a celesta tune.
# The carry: a slow pulse, a brass chord on «вот как». Saved: E major, wide strings, timpani. The rule: a steady pulse.
# The choice: a suspended chord, the pulse stops for «Пиши один или два». The end: the tune in major.
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
    rng = np.random.default_rng(2018)
    S = {}
    m = {k: M[k] for k in ('sleep', 'c1', 'rain', 'c2', 'c3', 'c4', 'opts', 'c5', 'under', 'c6', 'up', 'c7', 'how', 'c8', 'c9', 'c10', 'c11')}
    end0 = A['L11']

    h = S['hook'] = Sec(dur, stop=m['c1'] + 0.1, over=0.05)
    h.wet.add(0.0, saws(rng, [28, 35, 40], m['c1'] + 0.2, attack=0.3, release=0.3, bright=300), -14, 0.0)
    for i, t in enumerate(grid(0.3, m['sleep'], 0.45)):
        h.dry.add(t, glock(rng, [83, 79, 86, 76][i % 4], 0.4, 1.4), -18, -0.4 + 0.25 * (i % 4))
    h.dry.add(m['sleep'], brass(rng, [40, 47, 52, 55], 0.8, bright=2400), -9, 0.0)
    h.dry.add(m['sleep'], timp(rng, 28, 0.9), -8, 0.0)

    mo = S['mouth'] = Sec(dur, stop=m['rain'], over=0.03)
    mo.wet.add(m['c1'], saws(rng, [43, 50, 55, 59], m['rain'] - m['c1'] + 0.2, attack=0.3, release=0.2, bright=1100), -18, 0.0)
    for i, t in enumerate(grid(m['c1'] + 0.05, m['rain'], BEAT / 2)):
        mo.dry.add(t, pizz(rng, [43, 50, 55, 50, 47, 50, 54, 50][i % 8], 0.5), -14, -0.2 + 0.4 * (i % 2))

    ra = S['rain'] = Sec(dur, stop=m['c3'], over=0.05)
    ra.wet.add(m['rain'], saws(rng, [28, 35, 40, 43], m['c3'] - m['rain'] + 0.2, attack=0.2, release=0.3, bright=600), -15, 0.0)
    for i, t in enumerate(grid(m['rain'], m['c3'] - 0.1, BEAT / 2)):
        ra.dry.add(t, pizz(rng, [40, 40, 47, 40, 43, 43, 47, 50][i % 8], 0.6), -13, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            ra.dry.add(t, timp(rng, 28, 0.35 + 0.3 * (t - m['rain']) / (m['c3'] - m['rain'])), -13, 0.0)
    ra.wet.add(m['c3'] - 1.2, riser(rng, 1.2), -16, 0.0)

    d = S['drip'] = Sec(dur, stop=m['c4'] - 0.02, over=0.02)
    d.wet.add(m['c3'], saws(rng, [40, 47, 52], m['c4'] - m['c3'], attack=0.5, release=0.1, bright=500), -18, 0.0)
    for i, (dt, n) in enumerate([(0.2, 83), (0.9, 79), (1.6, 86), (2.4, 81), (3.1, 79)]):
        if m['c3'] + dt < m['c4'] - 0.2:
            d.dry.add(m['c3'] + dt, glock(rng, n, 0.4, 1.4), -17, 0.3 - 0.15 * i)

    an = S['answer'] = Sec(dur, stop=m['c6'], over=0.05)                     # silence through STOP; the bell on «Ждать!»
    an.dry.add(A['L5w0'], glock(rng, 88, 0.7, 2.0), -11, 0.0)
    an.dry.add(A['L5w0'], brass(rng, [52, 59, 64, 68], 0.6, bright=2600), -12, 0.0)
    an.wet.add(m['under'], saws(rng, [28, 35], m['c6'] - m['under'] + 0.2, attack=0.6, release=0.3, bright=220), -14, 0.0)
    an.wet.add(m['under'] + 0.3, trem(rng, [71, 72], m['c6'] - m['under'] - 0.3, grow=(0.2, 0.8), bright=2400), -22, 0.0)

    dv = S['divers'] = Sec(dur, stop=m['c7'], over=0.05)
    dv.wet.add(m['c6'], saws(rng, [40, 47, 52, 55], m['c7'] - m['c6'] + 0.2, attack=0.8, release=0.3, bright=800), -18, 0.0)
    for k, (dt, n) in enumerate([(0.0, 76), (0.3, 79), (0.6, 83), (0.9, 88)]):
        dv.dry.add(m['up'] + dt, celesta(rng, n, 0.65), -12, 0.15)

    ca = S['carry'] = Sec(dur, stop=m['c8'], over=0.05)
    ca.wet.add(m['c7'], saws(rng, [28, 40, 47], m['c8'] - m['c7'] + 0.2, attack=0.4, release=0.2, bright=400), -15, 0.0)
    for i, t in enumerate(grid(m['c7'] + 0.1, m['c8'], BEAT)):
        ca.dry.add(t, timp(rng, 28, 0.3), -15, 0.0)
    ca.dry.add(m['how'], brass(rng, [40, 47, 52, 59], 0.7, bright=2400), -10, 0.0)

    sv = S['saved'] = Sec(dur, stop=m['c9'] + 0.2, over=0.08)
    sv.wet.add(m['c8'], saws(rng, [40, 52, 56, 59, 64], m['c9'] - m['c8'] + 0.4, attack=0.5, release=0.4, bright=1300), -14, 0.0)
    sv.dry.add(m['c8'] + 0.05, timp(rng, 28, 0.9), -9, 0.0)
    sv.dry.add(A['L8w2'], crash(rng, 0.6), -15, 0.0)
    for k, (dt, n) in enumerate([(0.2, 76), (0.5, 80), (0.8, 83), (1.2, 88)]):
        sv.dry.add(m['c8'] + dt, celesta(rng, n, 0.7), -11, 0.2)

    le = S['lesson'] = Sec(dur, stop=m['c10'], over=0.05)
    le.wet.add(m['c9'], saws(rng, [40, 47, 52, 55], m['c10'] - m['c9'] + 0.2, attack=0.4, release=0.3, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c9'] + 0.1, m['c10'], BEAT)):
        le.dry.add(t, pizz(rng, [40, 47, 52, 47][i % 4], 0.5), -13, -0.2 + 0.4 * (i % 2))
        if i % 4 == 0:
            le.dry.add(t, timp(rng, 28, 0.3), -15, 0.0)

    c = S['choice'] = Sec(dur, stop=end0, over=0.05)
    c.wet.add(m['c10'], saws(rng, [40, 47, 52, 57], end0 - m['c10'] + 0.2, attack=0.5, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c10'] + 0.2, A['L10w7'] - 0.05, BEAT / 2)):     # the pulse stops for «Пиши один или два»
        c.dry.add(t, pizz(rng, [40, 40, 47, 40][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            c.dry.add(t, timp(rng, 28, 0.3), -14, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur - 0.7, -6.0), (dur, -40.0)))
    end.wet.add(end0, saws(rng, [40, 47, 52, 56], max(0.5, dur - end0 - 0.4), attack=0.3, release=0.4, bright=1000), -15, 0.0)
    for k, (dt, n) in enumerate([(0.0, 76), (0.3, 80), (0.6, 83)]):
        end.dry.add(end0 + 0.1 + dt, celesta(rng, n, 0.6), -11, 0.15)
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
