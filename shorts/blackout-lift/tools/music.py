# Score for «Застрял в лифте» (блэкаут, ч.3), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like parts 1–2, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The ride: a light celesta climbing with the floor display; the light dies with a brass thud and the jolt. The shaft runs
# on the series' pizzicato ostinato, a stab on «Нельзя» and a falling swell into the open shaft. The air: the first warm
# chord. Step one: a bell on the call button; step two: low and still; step three: a ticking pulse, B♭ warmth when the
# message is delivered. An hour later: the doors open on F major, a comic xylophone run for the chicken; the end is warm
# (F, then A7) and A7 leads back into the D minor the short starts in.
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
    rng = np.random.default_rng(23)
    S = {}
    floor, out, jolt, c1, pry, no, gap, c2, c3, bell, disp, c4, c5, save, chat, c6, opn, dog, c7 = (M[k] for k in (
        'floor', 'out', 'jolt', 'c1', 'pry', 'no', 'gap', 'c2', 'c3', 'bell', 'disp', 'c4', 'c5', 'save', 'chat', 'c6', 'open',
        'dog', 'c7'))
    end0 = A['L7']

    # A · the ride home: a soft Dm pad and a celesta climbing with the floors; the light dies, the jolt
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [38, 45, 50, 53], out + 0.2, attack=0.6, release=0.2, bright=900), -18, 0.0)
    for i, m in enumerate([74, 77, 81, 86]):
        dt = 0.3 + i * (floor - 0.3) / 3
        a.dry.add(dt, celesta(rng, m, 0.45), -14, 0.3 if i % 2 else -0.3)
    a.dry.add(out, brass(rng, [26, 33, 38], 0.5, bright=600), -10, 0.0)
    a.dry.add(out, timp(rng, 33, 0.9), -8, 0.0)
    a.wet.add(out + 0.1, saws(rng, [26, 32], c1 - out, attack=0.4, release=0.2, bright=300), -18, 0.0)
    a.dry.add(jolt, timp(rng, 31, 1.0), -4, 0.0)

    # B · the shaft: the ostinato; a stab on «Нельзя»; a falling, dissonant swell into the open shaft
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((c1, -2.0), (c2, -2.0)))
    for i, t in enumerate(grid(c1, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -6, -0.1)
    for t in grid(c1, no, BEAT):
        b.dry.add(t, timp(rng, 38, 0.3), -14, 0.0)
    b.dry.add(no, brass(rng, [38, 44, 50], 0.4, bright=1600), -6, 0.0)
    b.dry.add(no, timp(rng, 38, 0.7), -6, 0.0)
    b.wet.add(gap, trem(rng, [62, 63, 68], c2 - gap, grow=(0.3, 0.9), bright=2200), -18, 0.0)
    for i, m in enumerate([86, 82, 79, 75, 70]):
        b.dry.add(gap + 0.05 + i * 0.1, xylo(rng, m, 0.3), -12, 0.2 - 0.1 * i)

    # C · the air: the first warm chord (F), a soft celesta
    c = S['C'] = Sec(dur, gain=((c2, -3.0), (c3, -3.0)))
    c.wet.add(c2, saws(rng, [41, 48, 53, 57], c3 - c2, attack=0.5, release=0.3, bright=1100), -15, 0.0)
    for i, m in enumerate([77, 81, 84, 81]):
        c.dry.add(A['L2w2'] + i * 0.3, celesta(rng, m, 0.5), -12, -0.2 + 0.15 * i)

    # D · step one: pizzicato under the panel, a bell on the button, a lift for the dispatcher
    d = S['D'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        d.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -6, -0.1)
    d.dry.add(bell, glock(rng, 93, 0.6, 1.6), -9, 0.2)
    d.dry.add(disp, glock(rng, [86, 89][0], 0.4, 1.0), -14, 0.2)

    # E · step two: low and still; a stab on «не пытайся»
    e = S['E'] = Sec(dur, gain=((c4, -3.0), (c5, -3.0)))
    e.wet.add(c4, saws(rng, [26, 38, 45], c5 - c4, attack=0.4, release=0.3, bright=500), -16, 0.0)
    for i, t in enumerate(grid(c4, c5, BEAT)):
        e.dry.add(t, pizz(rng, [38, 45][i % 2], 0.6), -8, -0.1)
    e.dry.add(A['L4w5'] - 0.05, brass(rng, [50, 51], 0.3, bright=1400), -8, 0.0)

    # F · step three: a ticking pulse while he types, B♭ warmth when the message is delivered
    f = S['F'] = Sec(dur, gain=((c5, -2.0), (c6, -4.0)))
    for i, t in enumerate(grid(c5, chat, BEAT / 2)):
        f.dry.add(t, pizz(rng, [38, 44, 38, 45][i % 4], 0.55), -7, -0.1)
    for t in grid(chat, A['L5w9'], BEAT / 2):
        f.dry.add(t, glock(rng, 98, 0.15, 0.5), -20, 0.3)
    f.wet.add(A['L5w9'], saws(rng, [46, 53, 58, 62], c6 - A['L5w9'], attack=0.3, release=0.5, bright=1100), -15, 0.0)
    f.dry.add(A['L5w9'], glock(rng, 89, 0.5, 1.4), -11, 0.2)

    # G · an hour later: the doors open on F major; a comic xylophone run for the chicken
    h = S['G'] = Sec(dur, gain=((c6, -4.0), (end0, -4.0)))
    h.wet.add(c6 + 0.1, saws(rng, [62, 69], opn - c6, attack=0.4, release=0.2, bright=1200), -24, 0.0)
    h.wet.add(opn, saws(rng, [41, 53, 57, 60, 65], end0 - opn, attack=0.2, release=0.5, bright=1600), -13, 0.0)
    h.dry.add(opn, crash(rng, 0.6, 1.5), -18, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        h.dry.add(opn + 0.05 + i * 0.1, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)
    for i, m in enumerate([72, 76, 79, 84, 79, 84, 88]):
        h.dry.add(A['L6w12'] - 0.05 + i * 0.09, xylo(rng, m, 0.25), -11, 0.25)
    h.dry.add(A['L6w14'], pizz(rng, 41, 0.5), -6, 0.0)

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
