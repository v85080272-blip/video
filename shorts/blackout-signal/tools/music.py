# Score for «Пропала связь» (блэкаут, ч.6), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like parts 1–5, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The warming centre: a soft pad, a falling glock as the bars go, a thud on «нет сети». The rumours: an uneasy pizzicato,
# a sour chord as the third bubble pops. The city: the radio mast answers with a warm, wide chord. Step one: a crank
# rhythm; step two: a bright arpeggio for the messages going out; step three: the ostinato and a stab on the garage.
# The evening: F major with celesta on «завтра … дадут свет», a comic xylophone for the neighbour; the end leads to D minor.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, xylo, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.6


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(41)
    S = {}
    bars, c1, rum, c2, waves, c3, crank, c4, relay, c5, garage, c6, news, nb, c7 = (M[k] for k in (
        'bars', 'c1', 'rum', 'c2', 'waves', 'c3', 'crank', 'c4', 'relay', 'c5', 'garage', 'c6', 'news', 'nb', 'c7'))
    end0 = A['L7']

    # A · the warming centre, morning: a soft pad, a falling glock as the bars go, a thud on «нет сети»
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [38, 45, 50, 53], c1 + 0.3, attack=0.8, release=0.3, bright=900), -18, 0.0)
    for i in range(5):
        a.dry.add(bars + i * 0.18, glock(rng, 93 - i * 3, 0.25, 0.6), -14, 0.2)
    a.dry.add(bars + 0.9, timp(rng, 33, 0.9), -7, 0.0)

    # B · the rumours: an uneasy pizzicato, a sour chord as the third bubble pops
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((c1, -2.0), (c2, -2.0)))
    for i, t in enumerate(grid(c1, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, [38, 44, 38, 45][i % 4], 0.55), -7, -0.1)
    b.dry.add(rum + 0.4, brass(rng, [38, 44, 50], 0.4, bright=1600), -7, 0.0)

    # C · the city: the radio mast answers with a warm, wide chord
    c = S['C'] = Sec(dur, gain=((c2, -3.0), (c3, -3.0)))
    c.wet.add(c2, saws(rng, [38, 45, 50], waves - c2, attack=0.3, release=0.2, bright=500), -17, 0.0)
    c.wet.add(waves, saws(rng, [41, 48, 53, 57, 60], c3 - waves, attack=0.3, release=0.4, bright=1500), -13, 0.0)
    c.dry.add(waves, glock(rng, 89, 0.5, 1.4), -11, 0.0)

    # D · step one: a crank rhythm under the radio
    d = S['D'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        d.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4], 0.55), -7, -0.1)
    for t in grid(crank, A['L3w8'], BEAT / 4):
        d.dry.add(t, xylo(rng, 84, 0.12), -20, 0.3)
    d.dry.add(A['L3w8'] - 0.08, glock(rng, 89, 0.4, 1.0), -12, 0.0)

    # E · step two: an arpeggio for the messages in, a bright one for the news going out
    e = S['E'] = Sec(dur, gain=((c4, -2.0), (c5, -2.0)))
    for i, t in enumerate(grid(c4, c5, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -7, -0.1)
    for i, m in enumerate([74, 77, 81, 86]):
        e.dry.add(A['L4w4'] + i * 0.15, celesta(rng, m, 0.4), -13, -0.3 + 0.2 * i)
    for i, m in enumerate([86, 89, 93, 98]):
        e.dry.add(relay + i * 0.12, glock(rng, m, 0.3, 0.8), -13, 0.3 - 0.2 * i)

    # F · step three: the ostinato outside, a stab on the shut garage
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    f = S['F'] = Sec(dur, gain=((c5, -2.0), (c6, -3.0)))
    for i, t in enumerate(grid(c5, c6, BEAT / 2)):
        f.dry.add(t, pizz(rng, pat[i % 8], 0.6), -7, -0.1)
    f.dry.add(A['L5w7'] - 0.05, glock(rng, 89, 0.4, 1.0), -12, 0.0)
    f.dry.add(garage + 0.6, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    f.dry.add(garage + 0.6, timp(rng, 38, 0.7), -6, 0.0)
    f.wet.add(garage + 0.6, trem(rng, [62, 63, 68], c6 - garage - 0.6, grow=(0.3, 0.9), bright=2000), -19, 0.0)

    # G · the evening: F major with celesta on «завтра дадут свет», a comic xylophone for the neighbour
    h = S['G'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    h.wet.add(c6, saws(rng, [38, 45, 50], news - c6, attack=0.3, release=0.2, bright=600), -18, 0.0)
    h.wet.add(news, saws(rng, [41, 53, 57, 60, 65], end0 - news, attack=0.2, release=0.5, bright=1600), -13, 0.0)
    h.dry.add(news, crash(rng, 0.6, 1.5), -18, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        h.dry.add(news + 0.05 + i * 0.1, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)
    for i, m in enumerate([84, 79, 76, 72, 67]):
        h.dry.add(nb + 0.4 + i * 0.1, xylo(rng, m, 0.25), -12, -0.25)

    # I · «Подписывайся…»: warm F with a celesta tune, then A7sus4 → A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.55
    end.wet.add(end0, saws(rng, [41, 48, 53, 57], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1200), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 50, 52, 55], max(0.4, dur - mid - 0.6), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end.wet.add(dur - 0.5, saws(rng, [45, 49, 52, 55], 0.4, attack=0.1, release=0.4, bright=1000), -17, 0.0)
    for i, (dt, m) in enumerate([(0.0, 77), (0.3, 81), (0.6, 84), (0.9, 81), (1.5, 76), (1.8, 79)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end.dry.add(end0, pizz(rng, 41, 0.8), -3, 0.0)
    end.dry.add(mid, pizz(rng, 33, 0.7), -4, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 0.9, damp=6000, width=0.7), room(rng, 2.2, damp=4500, width=0.9))
    mix = sum(sec.render(rooms) for sec in S.values())
    mix = mix[:, :at(dur + 3.0)]
    # the loop: what rings past the end is folded back onto the start, so the end and the start join without a seam
    n = at(dur)
    tail = mix[:, n:]
    mix = mix[:, :n].copy()
    mix[:, :tail.shape[1]] += tail
    mix = hp(mix, 35)
    sf.write(out, mix.T, SR, subtype='FLOAT')
    print(f'music {n / SR:.2f}s → {out}  peak {np.max(np.abs(mix)):.3f}')


if __name__ == '__main__':
    main()
