# Score for «Зима, батареи остыли» (блэкаут, ч.4), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like parts 1–3, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The winter night: a cold, high pad and a glockenspiel like falling snow; a low hit as the thermometer drops. The stove
# runs on the series' pizzicato ostinato with a brass stab on «Нельзя». The thermal camera: a slow descending line as the
# heat leaves, warmth (F major) when the two figures glow. Step one: a stab for each door; step two: a rising plink for
# each layer and a bright chord for the hat and scarf; step three: a sober pulse and a stab on «Срочно». The morning:
# celesta and a light pad; two knocks on the ice; the end is warm (F, then A7) and A7 leads back into D minor.
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
    rng = np.random.default_rng(31)
    S = {}
    cold, c1, knob, no, gas, c2, slf, c3, c4, c5, c6, tub, c7 = (M[k] for k in (
        'cold', 'c1', 'knob', 'no', 'gas', 'c2', 'self', 'c3', 'c4', 'c5', 'c6', 'tub', 'c7'))
    LAYERS, HAT, SCARF, KNOCKS = M['LAYERS'], M['HAT'], M['SCARF'], M['KNOCKS']
    end0 = A['L7']

    # A · the winter night: a cold high pad, glockenspiel snow; a low hit as the radiators go cold
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [50, 57, 62, 65], c1 + 0.3, attack=0.8, release=0.3, bright=1400), -19, 0.0)
    for i, t in enumerate(grid(0.3, c1 - 0.2, 0.45)):
        a.dry.add(t, glock(rng, [86, 89, 93, 91, 88, 84][i % 6], 0.3, 0.8), -19, 0.4 * np.sin(i * 1.7))
    a.dry.add(cold, timp(rng, 33, 0.9), -7, 0.0)
    a.dry.add(cold, brass(rng, [26, 33, 38], 0.45, bright=600), -11, 0.0)

    # B · the stove: the ostinato; a stab on «Нельзя»; a grey swell under the gas
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((c1, -2.0), (c2, -2.0)))
    for i, t in enumerate(grid(c1, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -6, -0.1)
    for t in grid(c1, no, BEAT):
        b.dry.add(t, timp(rng, 38, 0.3), -14, 0.0)
    b.dry.add(no, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    b.dry.add(no, timp(rng, 38, 0.7), -6, 0.0)
    b.wet.add(gas, trem(rng, [62, 63, 68], c2 - gas, grow=(0.2, 0.9), bright=2200), -18, 0.0)
    b.wet.add(gas, saws(rng, [26, 32, 38], c2 - gas, attack=0.8, release=0.3, bright=380), -16, 0.0)

    # C · the thermal camera: a falling line while the heat leaves, F major when the two figures glow
    c = S['C'] = Sec(dur, gain=((c2, -3.0), (c3, -3.0)))
    for i, m in enumerate([81, 79, 77, 74, 72, 69]):
        c.dry.add(c2 + 0.1 + i * (slf - c2 - 0.2) / 6, celesta(rng, m, 0.5), -13, 0.3 - 0.1 * i)
    c.wet.add(c2, saws(rng, [38, 45, 50], slf - c2, attack=0.4, release=0.3, bright=500), -17, 0.0)
    c.wet.add(slf, saws(rng, [41, 48, 53, 57], c3 - slf, attack=0.3, release=0.4, bright=1300), -14, 0.0)
    c.dry.add(slf, glock(rng, 89, 0.5, 1.4), -11, 0.0)

    # D · step one: pizzicato; a soft stab for each door that shuts
    d = S['D'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        d.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4], 0.55), -7, -0.1)
    for i in range(3):
        d.dry.add(A['L3w6'] + 0.2 + i * 0.32, timp(rng, 41, 0.35), -10, -0.2 + 0.2 * i)

    # E · step two: a rising plink for each layer, a bright chord for the hat and the scarf
    e = S['E'] = Sec(dur, gain=((c4, -2.0), (c5, -2.0)))
    for i, t in enumerate(grid(c4, c5, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -7, -0.1)
    for i, t0 in enumerate(LAYERS):
        e.dry.add(t0 + 0.35, glock(rng, [81, 84, 88][i], 0.4, 1.0), -12, 0.2)
    e.dry.add(HAT, celesta(rng, 89, 0.5), -11, 0.0)
    e.wet.add(SCARF, saws(rng, [53, 57, 60, 65], c5 - SCARF, attack=0.2, release=0.4, bright=1500), -15, 0.0)

    # F · step three: a sober pulse; a stab on «Срочно»
    f = S['F'] = Sec(dur, gain=((c5, -3.0), (c6, -4.0)))
    f.wet.add(c5, saws(rng, [26, 38, 45], c6 - c5, attack=0.4, release=0.3, bright=500), -16, 0.0)
    for i, t in enumerate(grid(c5, c6, BEAT)):
        f.dry.add(t, pizz(rng, [38, 45][i % 2], 0.6), -8, -0.1)
    for t0 in M['SIGNS']:
        f.dry.add(t0, glock(rng, 74, 0.3, 0.8), -14, 0.1)
    f.dry.add(A['L5w13'] - 0.08, brass(rng, [38, 44, 50], 0.4, bright=1600), -7, 0.0)
    f.dry.add(A['L5w13'] - 0.08, timp(rng, 38, 0.6), -7, 0.0)

    # G · the morning: celesta over a light pad, two knocks on the ice
    h = S['G'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    h.wet.add(c6, saws(rng, [41, 53, 57, 60, 65], end0 - c6, attack=0.4, release=0.5, bright=1500), -15, 0.0)
    for i, m in enumerate([77, 81, 84, 89, 84, 81]):
        h.dry.add(c6 + 0.15 + i * 0.35, celesta(rng, m, 0.5), -13, -0.3 + 0.12 * i)
    for k in KNOCKS:
        h.dry.add(k, xylo(rng, 84, 0.25), -10, -0.3)

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
