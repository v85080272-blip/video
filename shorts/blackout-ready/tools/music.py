# Score for «Третий день в холоде» (блэкаут, ч.5), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like parts 1–4, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The frozen morning: the cold pad and glockenspiel snow of part 4, a low hit at +8. The thermal body: the ostinato,
# a stab on «Не надо», a false warm swell on «кажется тёплым» that sours as the heat leaves. The plan: a march-like
# pizzicato as the route draws, a bell on «по плану». Step one: a plink for the food; step two: a ticking radio pulse;
# step three: a plink for each thing in the bag and a stab on the gas tap. The descent: low pizzicato steps faster and
# faster; the warm hall: F major with celesta, a comic xylophone for the dog's porridge; the end leads back into D minor.
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
    rng = np.random.default_rng(37)
    S = {}
    eight, c1, no, seems, loss, c2, route, c3, ice, c4, c5, shut, c6, hall, c7 = (M[k] for k in (
        'eight', 'c1', 'no', 'seems', 'loss', 'c2', 'route', 'c3', 'ice', 'c4', 'c5', 'shut', 'c6', 'hall', 'c7'))
    ITEMS = M['ITEMS']
    end0 = A['L7']

    # A · the frozen morning: a cold high pad, glockenspiel snow, a low hit at +8
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [50, 57, 62, 65], c1 + 0.3, attack=0.8, release=0.3, bright=1400), -19, 0.0)
    for i, t in enumerate(grid(0.3, c1 - 0.2, 0.45)):
        a.dry.add(t, glock(rng, [86, 89, 93, 91, 88, 84][i % 6], 0.3, 0.8), -19, 0.4 * np.sin(i * 1.7))
    a.dry.add(eight, timp(rng, 33, 0.9), -7, 0.0)

    # B · the thermal body: the ostinato, a stab on «Не надо», a false warm swell that sours as the heat leaves
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((c1, -2.0), (c2, -2.0)))
    for i, t in enumerate(grid(c1, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -7, -0.1)
    b.dry.add(no, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    b.dry.add(no, timp(rng, 38, 0.7), -6, 0.0)
    b.wet.add(seems, saws(rng, [53, 57, 60], loss - seems + 0.2, attack=0.3, release=0.2, bright=1500), -15, 0.0)
    b.wet.add(loss, trem(rng, [62, 63, 68], c2 - loss, grow=(0.3, 0.9), bright=2000), -18, 0.0)
    for i, m in enumerate([86, 82, 79, 75, 70]):
        b.dry.add(loss + 0.1 + i * 0.12, xylo(rng, m, 0.3), -14, 0.2 - 0.1 * i)

    # C · the plan: a march-like pizzicato while the route draws, a bell on «по плану»
    c = S['C'] = Sec(dur, gain=((c2, -2.0), (c3, -2.0)))
    for i, t in enumerate(grid(c2, c3, BEAT / 2)):
        c.dry.add(t, pizz(rng, [38, 45, 50, 45][i % 4], 0.5), -7, -0.1)
    for t in grid(route, c3, BEAT):
        c.dry.add(t, timp(rng, 38, 0.3), -14, 0.0)
    c.dry.add(A['L2w13'] - 0.08, glock(rng, 89, 0.5, 1.4), -10, 0.0)

    # D · step one: lighter, a plink for the food, a cold glint for the ice
    d = S['D'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        d.dry.add(t, pizz(rng, [41, 53, 48, 53][i % 4], 0.55), -7, -0.1)
    d.dry.add(A['L3w5'] - 0.08, glock(rng, 84, 0.4, 1.0), -12, 0.2)
    d.dry.add(ice + 0.3, celesta(rng, 93, 0.4), -13, -0.2)

    # E · step two: a ticking radio pulse
    e = S['E'] = Sec(dur, gain=((c4, -2.0), (c5, -2.0)))
    for i, t in enumerate(grid(c4, c5, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -7, -0.1)
    for t in grid(A['L4w8'], c5, BEAT / 2):
        e.dry.add(t, glock(rng, 98, 0.15, 0.5), -20, 0.3)

    # F · step three: a rising plink for each thing in the bag, a stab on the gas tap, warmth for the message
    f = S['F'] = Sec(dur, gain=((c5, -2.0), (c6, -2.0)))
    for i, t in enumerate(grid(c5, c6, BEAT / 2)):
        f.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -7, -0.1)
    for i, t0 in enumerate(ITEMS):
        f.dry.add(t0 + 0.4, glock(rng, [79, 81, 84, 88][i], 0.4, 1.0), -12, 0.2)
    f.dry.add(shut, brass(rng, [50, 51], 0.3, bright=1400), -8, 0.0)
    f.wet.add(A['L5w14'], saws(rng, [46, 53, 58, 62], c6 - A['L5w14'], attack=0.3, release=0.4, bright=1100), -15, 0.0)

    # G · the descent: low steps, faster and faster
    g2 = S['G'] = Sec(dur, stop=hall, over=0.03, gain=((c6, -2.0), (hall, -2.0)))
    n = int((hall - c6) / 0.18)
    for i in range(n):
        t = c6 + (hall - c6) * (i / n) ** 0.8
        g2.dry.add(t, pizz(rng, [38, 41, 45, 50][i % 4] - (i // 8) % 2 * 2, 0.4), -9, -0.2 + 0.4 * (i % 2))
    g2.dry.add(hall - 0.6, riser(rng, 0.6), -15, 0.0)

    # H · the warm hall: F major with celesta; a comic xylophone run for the dog's porridge
    h = S['H'] = Sec(dur, gain=((hall, -4.0), (end0, -4.0)))
    h.wet.add(hall, saws(rng, [41, 53, 57, 60, 65], end0 - hall, attack=0.2, release=0.5, bright=1600), -13, 0.0)
    h.dry.add(hall, crash(rng, 0.6, 1.5), -18, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        h.dry.add(hall + 0.05 + i * 0.1, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)
    for i, m in enumerate([72, 76, 79, 84, 79, 84, 88]):
        h.dry.add(A['L6w15'] - 0.05 + i * 0.09, xylo(rng, m, 0.25), -11, 0.25)

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
