# Score for «Блэкаут, ты на 20-м этаже», synthesised with numpy (48 kHz stereo, no samples, no third-party music). D minor,
# a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json. Dusk over the city (a soft
# pad, a celesta twinkling like windows) dies with the lights: a low thud and nothing. The blueprint runs on a tight
# pizzicato ostinato with a ticking pulse; a stab when the grid dies; a xylophone walks down as the water leaves the top
# floors. Step one is lighter, with a plink for each bottle that fills and a bell when the tap coughs out; step two has a
# stab on the fridge's cross and a cold celesta for the card; step three tenses for the fire and warms into B♭ when the
# torch comes on. On day 3 the music almost drops away (one soft high pad): the twist lands in near silence. The end is
# warm (F, then A7), and A7 leads back into the D minor the short starts in.
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
    rng = np.random.default_rng(13)
    S = {}
    out, c1, c2, dead, pull, c3, ck, c4, x4, c5, fire, torch, ph, c6, pour, c7 = (M[k] for k in (
        'out', 'c1', 'c2', 'dead', 'pull', 'c3', 'ck', 'c4', 'x4', 'c5', 'fire', 'torch', 'ph', 'c6', 'pour', 'c7'))
    end0 = A['L7']

    # A · dusk over the city: a soft Dm9 pad, celesta notes like windows lighting up; the blackout cuts it with a low thud
    a = S['A'] = Sec(dur, stop=out + 0.05, dead=True, over=0.02)
    a.wet.add(0.0, saws(rng, [38, 45, 52, 57, 64], out + 0.3, attack=0.5, release=0.2, bright=900), -18, 0.0)
    for i, (dt, m) in enumerate([(0.2, 81), (0.55, 84), (0.9, 88), (1.25, 86)]):
        if dt < out - 0.1:
            a.dry.add(dt, celesta(rng, m, 0.35), -14, 0.35 if i % 2 else -0.35)
    b0 = S['B0'] = Sec(dur, stop=c1, over=0.03)
    b0.dry.add(out, timp(rng, 33, 1.0), -4, 0.0)
    b0.dry.add(out, brass(rng, [26, 33, 38], 0.5, bright=700), -9, 0.0)
    b0.wet.add(out + 0.4, saws(rng, [26, 38], c1 - out, attack=0.6, release=0.3, bright=380), -16, 0.0)
    b0.dry.add(A['L0w11'] - 0.04, brass(rng, [50, 51], 0.25, bright=1500), -8, 0.0)

    # B · the blueprint: an ostinato and a ticking pulse; a stab when the grid dies; the water walks down a xylophone
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    b = S['B'] = Sec(dur, stop=c3, over=0.03, gain=((c1, -2.0), (c3, -2.0)))
    for i, t in enumerate(grid(c1, c3, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -6, -0.1)
    b.wet.add(c1, saws(rng, [26, 38, 45], c3 - c1, attack=0.5, release=0.3, bright=450), -17, 0.0)
    for t in grid(c1, dead, BEAT):
        b.dry.add(t, timp(rng, 38, 0.3), -14, 0.0)
    b.dry.add(dead, brass(rng, [38, 44, 50], 0.5, bright=1800), -5, 0.0)
    b.dry.add(dead, timp(rng, 38, 0.9), -4, 0.0)
    for i in range(3):
        b.dry.add(dead + 0.25 * i, glock(rng, [86, 81, 74][i], 0.4, 0.8), -14, -0.3 + 0.3 * i)
    for i, m in enumerate([88, 86, 84, 81, 79, 77, 76, 74]):
        b.dry.add(pull + 0.3 + i * (c3 - pull - 0.7) / 8, xylo(rng, m, 0.5), -11, 0.25 - i * 0.06)
    b.dry.add(c3 - 0.8, riser(rng, 0.8), -15, 0.0)

    # C · step one, «набери воду»: a lighter ostinato; plinks as the bottles fill; a bell when the tap coughs out
    c = S['C'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        c.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.55), -6, -0.1)
    for i, t in enumerate([A['L3w8'] - 0.05, A['L3w8'] + 0.1, A['L3w10'] - 0.05, A['L3w10'] + 0.07, A['L3w10'] + 0.19]):
        c.dry.add(t, glock(rng, [81, 84, 86, 88, 93][i], 0.4, 1.0), -14, 0.2)
    c.dry.add(A['L3e'] + 0.05, glock(rng, 93, 0.55, 1.6), -11, 0.1)

    # D · step two, the fridge: a stab on the cross; a cold celesta for the card
    d = S['D'] = Sec(dur, gain=((c4, -2.0), (c5, -3.0)))
    for i, t in enumerate(grid(c4, c5, BEAT / 2)):
        d.dry.add(t, pizz(rng, [38, 50, 46, 50][i % 4], 0.55), -6, -0.1)
    d.dry.add(x4, brass(rng, [50, 51], 0.3, bright=1400), -7, 0.0)
    d.dry.add(x4, timp(rng, 38, 0.6), -8, 0.0)
    for i, m in enumerate([86, 89, 93, 98]):
        d.dry.add(A['L4w4'] + 0.05 + i * 0.12, celesta(rng, m, 0.4), -13, 0.3 - 0.2 * i)

    # E · step three, the candle: tense; a hit for the fire; B♭ warmth when the torch comes on; a bell on the switch
    e = S['E'] = Sec(dur, gain=((c5, -2.0), (c6, -4.0)))
    for i, t in enumerate(grid(c5, fire, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 44, 38, 45][i % 4], 0.55), -6, -0.1)
    e.dry.add(fire, brass(rng, [38, 44, 50], 0.5, bright=2000), -5, 0.0)
    e.dry.add(fire, timp(rng, 38, 0.8), -5, 0.0)
    e.wet.add(fire + 0.1, trem(rng, [74, 75], torch - fire, grow=(0.4, 0.9), bright=2600), -18, 0.1)
    e.wet.add(torch, saws(rng, [46, 53, 58, 62], c6 - torch, attack=0.3, release=0.5, bright=1100), -15, 0.0)
    for i, t in enumerate(grid(torch, c6, BEAT / 2)):
        e.dry.add(t, pizz(rng, [46, 58, 53, 58][i % 4], 0.5), -8, -0.1)
    e.dry.add(A['L5w12'] - 0.05, glock(rng, 89, 0.5, 1.2), -12, 0.2)

    # F · day 3: the music almost drops; one soft high pad, a bell when the toilet flushes
    f = S['F'] = Sec(dur, gain=((c6, -6.0), (end0, -6.0)))
    f.wet.add(c6 + 0.1, saws(rng, [69, 74], end0 - c6, attack=0.8, release=0.5, bright=1500), -24, 0.0)
    f.dry.add(pour + 0.75, glock(rng, 86, 0.45, 1.6), -14, 0.1)

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
