# Score for «Неделя без света» (блэкаут, ч.2), synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# D minor like part 1, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# A week in the dark: a low pad and a slow celesta over the city. The blueprint runs on the pizzicato ostinato of part 1,
# with a brass stab on each wave of fires and a dissonant swell under the gas. Step one stabs on the burner's cross and
# lightens for the food; step two stabs on the bin; step three ticks while the call fails and resolves on the delivered
# message. Day 7: near silence in the dark, then a bright F major chord the moment the lamp comes on, a sour hit for the
# neighbour's TV; the end is warm (F, then A7) and A7 leads back into the D minor the short starts in.
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
    rng = np.random.default_rng(17)
    S = {}
    c1, f1, f2, c2, co, c3, off, food, c4, c5, ph, chat, c6, on, nb, burn, c7 = (M[k] for k in (
        'c1', 'f1', 'f2', 'c2', 'co', 'c3', 'off', 'food', 'c4', 'c5', 'ph', 'chat', 'c6', 'on', 'nb', 'burn', 'c7'))
    end0 = A['L7']

    # A · a week in the dark: a low Dm pad, a slow celesta, a thud on «не темнота»
    a = S['A'] = Sec(dur, stop=c1 + 0.05, over=0.03)
    a.wet.add(0.0, saws(rng, [26, 38, 45, 50], c1 + 0.3, attack=0.8, release=0.3, bright=500), -17, 0.0)
    for i, (dt, m) in enumerate([(0.4, 74), (1.6, 77), (2.8, 81), (4.0, 76)]):
        if dt < c1 - 0.3:
            a.dry.add(dt, celesta(rng, m, 0.5), -15, 0.3 if i % 2 else -0.3)
    a.dry.add(A['L0w13'] - 0.04, timp(rng, 33, 0.9), -6, 0.0)
    a.dry.add(A['L0w13'] - 0.04, brass(rng, [26, 33, 38], 0.45, bright=700), -10, 0.0)

    # B · the blueprint: the ostinato of part 1; a stab on each wave of fires; a dissonant swell under the gas
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    b = S['B'] = Sec(dur, stop=c3, over=0.03, gain=((c1, -2.0), (c3, -2.0)))
    for i, t in enumerate(grid(c1, c3, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -6, -0.1)
    for t in grid(c1, co, BEAT):
        b.dry.add(t, timp(rng, 38, 0.3), -14, 0.0)
    for t0 in (f1, f2):
        b.dry.add(t0, brass(rng, [38, 44, 50], 0.4, bright=1600), -7, 0.0)
        b.dry.add(t0, timp(rng, 38, 0.7), -6, 0.0)
    b.wet.add(co, trem(rng, [62, 63, 68], c3 - co, grow=(0.2, 0.9), bright=2200), -18, 0.0)
    b.wet.add(co, saws(rng, [26, 32, 38], c3 - co, attack=1.0, release=0.3, bright=380), -16, 0.0)
    b.dry.add(c3 - 0.8, riser(rng, 0.8), -15, 0.0)

    # C · step one: a stab on the burner's cross; lighter for the food, a plink for each, a bell
    c = S['C'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        c.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4] if t < food else [41, 53, 48, 53][i % 4], 0.55), -6, -0.1)
    c.dry.add(off, brass(rng, [50, 51], 0.3, bright=1400), -7, 0.0)
    c.dry.add(off, timp(rng, 38, 0.6), -8, 0.0)
    for i, t in enumerate([A['L3w11'], A['L3w12'], A['L3w13']]):
        c.dry.add(t - 0.05, glock(rng, [81, 84, 88][i], 0.4, 1.0), -14, 0.2)
    c.dry.add(A['L3e'] + 0.05, glock(rng, 93, 0.55, 1.6), -11, 0.1)

    # D · step two, the bin: a stab on «в мусор», a cold celesta for the card
    d = S['D'] = Sec(dur, gain=((c4, -2.0), (c5, -3.0)))
    for i, t in enumerate(grid(c4, c5, BEAT / 2)):
        d.dry.add(t, pizz(rng, [38, 50, 46, 50][i % 4], 0.55), -6, -0.1)
    d.dry.add(A['L4w7'], brass(rng, [50, 51], 0.3, bright=1400), -7, 0.0)
    d.dry.add(A['L4w7'], timp(rng, 38, 0.6), -8, 0.0)
    for i, m in enumerate([86, 89, 93, 98]):
        d.dry.add(A['L4w8'] + 0.05 + i * 0.12, celesta(rng, m, 0.4), -13, 0.3 - 0.2 * i)

    # E · step three: a ticking pulse while the call fails, a sour stab on «Не звони», B♭ warmth when the message goes
    e = S['E'] = Sec(dur, gain=((c5, -2.0), (c6, -4.0)))
    for i, t in enumerate(grid(c5, chat, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 44, 38, 45][i % 4], 0.55), -6, -0.1)
    for t in grid(ph, chat, BEAT / 2):
        e.dry.add(t, glock(rng, 98, 0.15, 0.5), -20, 0.3)
    e.dry.add(A['L5w3'], brass(rng, [38, 44], 0.35, bright=1500), -8, 0.0)
    e.wet.add(chat, saws(rng, [46, 53, 58, 62], c6 - chat, attack=0.3, release=0.5, bright=1100), -15, 0.0)
    for i, t in enumerate(grid(chat, c6, BEAT / 2)):
        e.dry.add(t, pizz(rng, [46, 58, 53, 58][i % 4], 0.5), -8, -0.1)
    e.dry.add(A['L5w10'], glock(rng, 89, 0.5, 1.4), -11, 0.2)

    # F · day 7: near silence in the dark; F major blooms with the lamp; a sour hit for the neighbour's TV
    f = S['F'] = Sec(dur, gain=((c6, -5.0), (end0, -5.0)))
    f.wet.add(c6 + 0.1, saws(rng, [62, 69], on - c6, attack=0.5, release=0.2, bright=1200), -24, 0.0)
    f.wet.add(on, saws(rng, [41, 53, 57, 60, 65], end0 - on, attack=0.15, release=0.5, bright=1600), -13, 0.0)
    f.dry.add(on, crash(rng, 0.6, 1.5), -18, 0.0)
    for i, m in enumerate([77, 81, 84, 89]):
        f.dry.add(on + 0.05 + i * 0.1, celesta(rng, m, 0.5), -12, -0.3 + 0.2 * i)
    f.dry.add(A['L6w10'] - 0.05, glock(rng, 89, 0.45, 1.4), -13, 0.2)
    f.dry.add(burn, brass(rng, [44, 50, 51], 0.4, bright=1800), -7, 0.0)
    f.dry.add(burn, timp(rng, 38, 0.6), -8, 0.0)

    # I · «Подписывайся…»: warm F with a celesta tune, then A7sus4 → A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = c7 + 0.2
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
