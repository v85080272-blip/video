# Score for «69 дней под землёй» («Реальные истории», №2: 33 шахтёра в Чили), synthesised with numpy (48 kHz stereo).
# A minor, a beat of 0.6 s, every entry on a mark from build/cues.json.
# The hook: a low drone in the dark, a celesta note for each lamp; the pull out rises; a brass stamp on «И все выжили».
# The collapse: footsteps' pulse, then nothing but the crash; a low pedal on the wall. The refuge: a hushed chord.
# The ration: a sparse pizzicato, a bell on «раз в двое суток». The wait: a slow heartbeat on the timpani, a high
# tremolo of not knowing. The drill: a driving pulse growing to the breakthrough — a C major brass chord and a crash.
# The note: warm, a celesta tune. The palomas: a light pizzicato walk. The rescue: the pulse again, rising; the top:
# A major, wide strings, timpani. The rule: a steady pulse. The choice: a suspended chord, the pulse stops for «Пиши
# один или два». The end: the tune again.
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
    rng = np.random.default_rng(2010)
    S = {}
    m = {k: M[k] for k in ('lit', 'pull', 'days', 'survived', 'c1', 'crash', 'block', 'c2', 'c3', 'boss', 'table', 'h48', 'c4', 'c5',
                           'hit', 'c6', 'note', 'c7', 'c8', 'wide', 'lift', 'c9', 'all', 'c10', 'c11', 'c12')}
    end0 = A['L12']

    h = S['hook'] = Sec(dur, stop=m['c1'] + 0.2, over=0.08)
    h.wet.add(0.0, saws(rng, [33, 40, 45], m['survived'] + 0.3, attack=0.4, release=0.4, bright=300), -15, 0.0)
    for i, t in enumerate(grid(m['lit'], m['pull'], 0.18)):
        h.dry.add(t, celesta(rng, [81, 84, 88, 76, 79, 83][i % 6], 0.45), -17, -0.5 + 0.2 * (i % 6))
    h.wet.add(m['pull'], riser(rng, m['survived'] - m['pull']), -16, 0.0)
    h.wet.add(m['pull'] + 0.2, trem(rng, [69, 72, 76], m['survived'] - m['pull'], grow=(0.2, 0.9), bright=2800), -22, 0.0)
    h.dry.add(m['survived'], brass(rng, [45, 52, 57, 61], 0.8, bright=2400), -9, 0.0)
    h.dry.add(m['survived'], timp(rng, 33, 0.9), -8, 0.0)
    h.wet.add(m['survived'] + 0.02, crash(rng, 0.5), -18, 0.0)

    co = S['collapse'] = Sec(dur, stop=m['c2'] + 0.1, over=0.08)
    co.wet.add(m['c1'], saws(rng, [33, 40], m['crash'] - m['c1'], attack=0.5, release=0.1, bright=260), -15, 0.0)
    for i, t in enumerate(grid(m['c1'] + 0.2, m['crash'] - 0.1, BEAT)):
        co.dry.add(t, pizz(rng, [45, 45, 52, 45][i % 4], 0.45), -15, 0.0)
    co.dry.add(m['crash'], crash(rng, 1.0, 2.5), -9, 0.0)
    co.dry.add(m['crash'], brass(rng, [33, 39, 45], 0.7, bright=1800), -10, 0.0)
    co.wet.add(m['block'], saws(rng, [28, 33, 40], m['c2'] - m['block'] + 0.3, attack=0.3, release=0.4, bright=220), -13, 0.0)

    rf = S['refuge'] = Sec(dur, stop=m['c3'], over=0.05)
    rf.wet.add(m['c2'], saws(rng, [45, 52, 57, 60], m['c3'] - m['c2'] + 0.2, attack=1.0, release=0.3, bright=700), -19, 0.0)
    for i, (dt, n) in enumerate([(0.3, 76), (1.1, 72), (1.9, 74), (2.7, 69)]):
        if m['c2'] + dt < m['c3'] - 0.3:
            rf.dry.add(m['c2'] + dt, glock(rng, n, 0.4, 1.6), -19, 0.3 - 0.2 * i)

    ra = S['ration'] = Sec(dur, stop=m['c4'], over=0.05)
    ra.wet.add(m['c3'], saws(rng, [45, 52, 57], m['c4'] - m['c3'] + 0.2, attack=0.5, release=0.3, bright=600), -18, 0.0)
    for i, t in enumerate(grid(m['c3'] + 0.2, m['c4'], BEAT)):
        ra.dry.add(t, pizz(rng, [45, 52, 48, 52][i % 4], 0.45), -15, -0.2 + 0.4 * (i % 2))
    ra.dry.add(m['boss'], timp(rng, 33, 0.5), -13, 0.0)
    ra.dry.add(m['h48'], glock(rng, 81, 0.6, 2.0), -13, 0.2)

    wa = S['wait'] = Sec(dur, stop=m['c5'], over=0.05)
    wa.wet.add(m['c4'], saws(rng, [33, 40, 45], m['c5'] - m['c4'] + 0.2, attack=0.6, release=0.3, bright=260), -14, 0.0)
    wa.wet.add(m['c4'] + 0.3, trem(rng, [76, 77], m['c5'] - m['c4'] - 0.3, grow=(0.2, 0.8), bright=2600), -22, 0.0)
    for i, t in enumerate(grid(m['c4'] + 0.2, m['c5'], 0.94)):
        wa.dry.add(t, timp(rng, 33, 0.4), -14, 0.0); wa.dry.add(t + 0.22, timp(rng, 33, 0.25), -17, 0.0)

    dr = S['drill'] = Sec(dur, stop=m['c6'] + 0.2, over=0.08)
    dr.wet.add(m['c5'], saws(rng, [33, 45, 52, 57], m['hit'] - m['c5'] + 0.1, attack=0.3, release=0.1, bright=700), -15, 0.0)
    for i, t in enumerate(grid(m['c5'], m['hit'] - 0.05, BEAT / 2)):
        dr.dry.add(t, pizz(rng, [45, 45, 52, 45, 48, 48, 52, 55][i % 8], 0.5 + 0.4 * (t - m['c5']) / (m['hit'] - m['c5'])), -13, -0.2 + 0.4 * (i % 2))
        if i % 2 == 0:
            dr.dry.add(t, timp(rng, 33, 0.3 + 0.4 * (t - m['c5']) / (m['hit'] - m['c5'])), -14, 0.0)
    dr.wet.add(m['hit'] - 1.2, riser(rng, 1.2), -15, 0.0)
    dr.dry.add(m['hit'], brass(rng, [48, 55, 60, 64], 1.0, bright=2600), -8, 0.0)
    dr.dry.add(m['hit'], crash(rng, 0.9, 2.5), -11, 0.0)
    dr.wet.add(m['hit'] + 0.1, saws(rng, [36, 48, 55, 60, 64], m['c6'] - m['hit'] + 0.3, attack=0.3, release=0.4, bright=1300), -15, 0.0)

    no = S['note'] = Sec(dur, stop=m['c7'], over=0.05)
    no.wet.add(m['c6'], saws(rng, [41, 48, 53, 57], m['c7'] - m['c6'] + 0.2, attack=0.6, release=0.3, bright=900), -17, 0.0)
    tune = [72, 76, 79, 77, 76, 72, 74]
    step = (m['c7'] - m['c6'] - 0.6) / len(tune)
    for k, n in enumerate(tune):
        no.dry.add(m['c6'] + 0.25 + k * step, celesta(rng, n, 0.65), -12, 0.15)

    su = S['supplies'] = Sec(dur, stop=m['c8'], over=0.05)
    su.wet.add(m['c7'], saws(rng, [48, 55, 60, 64], m['c8'] - m['c7'] + 0.2, attack=0.5, release=0.3, bright=900), -18, 0.0)
    for i, t in enumerate(grid(m['c7'] + 0.1, m['c8'], BEAT / 2)):
        su.dry.add(t, pizz(rng, [48, 55, 52, 55, 53, 57, 55, 52][i % 8], 0.5), -14, -0.2 + 0.4 * (i % 2))
    for t0 in (A['L7w6'], A['L7w7'], A['L7w9']):
        su.dry.add(t0, glock(rng, 84, 0.45, 1.4), -16, 0.3)

    rs = S['rescue'] = Sec(dur, stop=m['c9'] + 0.2, over=0.08)
    rs.wet.add(m['c8'], saws(rng, [33, 45, 52, 57], m['c9'] - m['c8'] + 0.2, attack=0.4, release=0.2, bright=700), -15, 0.0)
    for i, t in enumerate(grid(m['c8'] + 0.1, m['c9'] - 0.1, BEAT / 2)):
        rs.dry.add(t, pizz(rng, [45, 52, 57, 52][i % 4], 0.5), -14, -0.2 + 0.4 * (i % 2))
        if i % 4 == 0:
            rs.dry.add(t, timp(rng, 33, 0.45), -14, 0.0)
    rs.wet.add(m['c9'] - 1.3, riser(rng, 1.3), -15, 0.0)

    tp = S['top'] = Sec(dur, stop=m['c10'] + 0.3, over=0.08)
    tp.wet.add(m['c9'], saws(rng, [33, 45, 49, 52, 57], m['c10'] - m['c9'] + 0.5, attack=0.8, release=0.5, bright=1300), -14, 0.0)
    tp.dry.add(m['c9'] + 0.05, timp(rng, 33, 0.8), -9, 0.0)
    tp.dry.add(m['all'], brass(rng, [45, 52, 57, 61], 1.0, bright=2600), -9, 0.0)
    tp.dry.add(m['all'], crash(rng, 0.7), -14, 0.0)
    for i, (dt, n) in enumerate([(0.3, 76), (0.7, 81), (1.1, 85), (1.6, 88)]):
        tp.dry.add(m['c9'] + dt, celesta(rng, n, 0.7), -11, 0.2)

    le = S['lesson'] = Sec(dur, stop=m['c11'], over=0.05)
    le.wet.add(m['c10'], saws(rng, [45, 52, 57, 60], m['c11'] - m['c10'] + 0.2, attack=0.4, release=0.3, bright=900), -17, 0.0)
    for i, t in enumerate(grid(m['c10'] + 0.1, m['c11'], BEAT)):
        le.dry.add(t, pizz(rng, [45, 52, 57, 52][i % 4], 0.5), -13, -0.2 + 0.4 * (i % 2))
        if i % 4 == 0:
            le.dry.add(t, timp(rng, 33, 0.3), -15, 0.0)

    c = S['choice'] = Sec(dur, stop=end0, over=0.05)
    c.wet.add(m['c11'], saws(rng, [45, 52, 57, 62], end0 - m['c11'] + 0.2, attack=0.5, release=0.3, bright=900), -15, 0.0)
    for i, t in enumerate(grid(m['c11'] + 0.2, A['L11w14'] - 0.05, BEAT / 2)):     # the pulse stops for «Пиши один или два»
        c.dry.add(t, pizz(rng, [45, 45, 52, 45][i % 4], 0.4), -13, -0.1)
        if i % 2 == 0:
            c.dry.add(t, timp(rng, 33, 0.3), -14, 0.0)

    end = S['end'] = Sec(dur, gain=((end0, -3.0), (dur - 0.7, -6.0), (dur, -40.0)))       # fades out on the last frames
    end.wet.add(end0, saws(rng, [45, 52, 57, 60], dur - end0 - 0.6, attack=0.4, release=0.4, bright=900), -15, 0.0)
    for i, (dt, n) in enumerate([(0.0, 72), (0.35, 76), (0.7, 79), (1.05, 77), (1.6, 76)]):
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
