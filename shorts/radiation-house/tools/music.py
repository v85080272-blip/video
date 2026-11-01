# Score for «Взрыв на станции, ты дома», synthesised with numpy (48 kHz stereo, no samples, no third-party music). E minor,
# a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json. A sleepy morning (a soft
# pad, a celesta like birds) that the explosion cuts dead with a stab, a timpani and a crash; a low drone and a heartbeat
# while he goes for the door, a stab on «Не надо», a cold swell outside in the wind. Step one rides a pizzicato ostinato
# with a hit for every thing he shuts and bells when the room is sealed; step two climbs down a xylophone scale rung by
# rung, three timpani on «каждая стена»; step three is lighter (bells on the bottles and jars); step four tenses up (a
# stab on the iodine, a hushed figure for the tablets); step five settles in G major with the clock. The end is warm (C,
# then B7), and B7 leads back into the E minor the short starts in. The parts leave the middle to the voice.
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
    rng = np.random.default_rng(11)
    S = {}
    boom, nope, c2, c3, c4, c5, c6, c7 = M['boom'], M['nope'], M['c2'], M['c3'], M['c4'], M['c5'], M['c6'], M['c7']
    end0 = A['L7']

    # A · a quiet morning: a soft pad, a sleepy celesta; a low knock under «Что делать»; it stops dead at the blast
    a = S['A'] = Sec(dur, stop=boom, dead=True, over=0.01)
    a.wet.add(0.0, saws(rng, [40, 47, 54, 59], boom + 0.2, attack=0.6, release=0.2, bright=700), -19, 0.0)
    for i, (dt, m) in enumerate([(0.15, 83), (0.45, 86), (0.75, 83)]):
        if dt < boom - 0.1:
            a.dry.add(dt, celesta(rng, m, 0.3), -14, 0.3 if i % 2 else -0.3)
    a.dry.add(A['L0w0'], pizz(rng, 40, 0.5), -9, -0.1)

    # B · the blast: a stab, a timpani and a crash; then a low drone, a high tremolo and a heartbeat; a stab on «Не надо»;
    # outside in the wind the drone darkens and a riser pulls into step one
    b = S['B'] = Sec(dur, stop=c3, over=0.03)
    b.dry.add(boom, brass(rng, [40, 46, 52, 58], 0.7, bright=2000), -4, 0.0)
    b.dry.add(boom, timp(rng, 40, 1.0), -2, 0.0)
    b.wet.add(boom, crash(rng, 0.7, 1.8), -12, 0.2)
    b.wet.add(boom + 0.3, saws(rng, [28, 40, 46], c3 - boom, attack=0.8, release=0.3, bright=500), -15, 0.0)
    b.wet.add(boom + 0.6, trem(rng, [76, 77], nope - boom - 0.6, grow=(0.3, 0.8), bright=2600), -19, 0.15)
    for t in grid(boom + 1.2, nope - 0.2, BEAT * 2):
        b.dry.add(t, timp(rng, 40, 0.4), -10, 0.0)
        b.dry.add(t + 0.22, timp(rng, 40, 0.28), -13, 0.0)
    b.dry.add(nope + 0.03, brass(rng, [52, 53], 0.3, bright=1400), -7, 0.0)
    b.wet.add(c2, trem(rng, [71, 72], c3 - c2 + 0.1, grow=(0.2, 1.0), bright=2200), -17, -0.15)
    b.dry.add(c3 - 0.9, riser(rng, 0.9), -14, 0.0)

    # C · step one, «закрой всё»: the ostinato; a hit on each thing shut; bells when the room is sealed
    pat = [40, 52, 40, 52, 43, 55, 42, 54]
    c = S['C'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        c.dry.add(t, pizz(rng, pat[i % 8], 0.65), -5, -0.1)
    for t in (A['L2w2'] - 0.02, M['cd'] + 0.08, A['L2w6'] + 0.08, M['fanOff']):
        c.dry.add(t, timp(rng, 40, 0.55), -8, 0.0)
        c.dry.add(t, brass(rng, [52, 59], 0.18, bright=1200), -14, 0.0)
    for i, m in enumerate([76, 79, 83, 88]):
        c.dry.add(M['cr'] + 0.1 + i * 0.12, glock(rng, m, 0.5, 1.4), -12, 0.3 - i * 0.2)

    # D · step two, the cellar: down the ladder a xylophone scale rung by rung; under the floor a low hushed pad; three
    # timpani on «каждая стена ослабляет излучение»
    d = S['D'] = Sec(dur, gain=((c4, -2.0), (c5, -3.0)))
    for i, t in enumerate(grid(c4, M['desc0'], BEAT / 2)):
        d.dry.add(t, pizz(rng, pat[i % 8], 0.6), -6, -0.1)
    for i, m in enumerate([83, 81, 79, 78, 76, 74]):
        d.dry.add(M['desc0'] + (M['desc1'] - M['desc0']) * (i + 0.5) / 6, xylo(rng, m, 0.45), -11, 0.2 - i * 0.08)
    d.wet.add(M['desc1'], saws(rng, [40, 47, 52], c5 - M['desc1'], attack=0.5, release=0.4, bright=600), -17, 0.0)
    for i, t in enumerate(grid(M['desc1'] + 0.3, c5, BEAT)):
        d.dry.add(t, pizz(rng, [40, 47][i % 2], 0.45), -9, -0.1)
    for i, k in enumerate(('L3w13', 'L3w14', 'L3w15')):
        d.dry.add(A[k], timp(rng, 40 - 2 * i, 0.7 - 0.12 * i), -6, 0.0)

    # E · step three, water and food: a lighter ostinato; a stab on the tap's cross; bells for the bottle, jars, fridge
    e = S['E'] = Sec(dur, gain=((c5, -2.0), (c6, -3.0)))
    for i, t in enumerate(grid(c5, c6, BEAT / 2)):
        e.dry.add(t, pizz(rng, [40, 52, 47, 52][i % 4], 0.55), -6, -0.1)
    e.dry.add(A['L4w3'] + 0.1, brass(rng, [52, 53], 0.25, bright=1400), -8, 0.0)
    for t, m in ((A['L4w5'] + 0.05, 83), (A['L4w10'], 86), (A['L4w12'] + 0.25, 88)):
        e.dry.add(t, glock(rng, m, 0.5, 1.2), -12, 0.2)

    # F · step four, the iodine: a darker ostinato, a stab on the cross; a hushed celesta for the tablets on a signal;
    # a bell on «щитовидку»
    f = S['F'] = Sec(dur, gain=((c6, -2.0), (c7, -3.0)))
    for i, t in enumerate(grid(c6, c7, BEAT / 2)):
        f.dry.add(t, pizz(rng, [40, 46, 40, 47][i % 4], 0.6), -6, -0.1)
    f.dry.add(M['iodX'], brass(rng, [40, 46, 52], 0.4, bright=1800), -5, 0.0)
    f.dry.add(M['iodX'], timp(rng, 40, 0.8), -5, 0.0)
    f.wet.add(A['L5w7'], trem(rng, [76, 79], A['L5w16'] - A['L5w7'], grow=(0.3, 0.5), bright=2400), -20, 0.1)
    for i, m in enumerate([76, 79, 83]):
        f.dry.add(A['L5w7'] + 0.1 + i * 0.15, celesta(rng, m + 12, 0.4), -12, 0.2)
    f.dry.add(A['L5w19'], glock(rng, 88, 0.55, 1.4), -11, 0.2)

    # G · step five, the radio and a day: G major, a slow walking pizzicato, a celesta tune; the clock gets bells
    g = S['G'] = Sec(dur, gain=((c7, -3.0), (end0, -4.0)))
    g.wet.add(c7, saws(rng, [43, 50, 55, 59], end0 - c7, attack=0.6, release=0.4, bright=900), -17, 0.0)
    for i, t in enumerate(grid(c7, end0, BEAT / 2)):
        g.dry.add(t, pizz(rng, [43, 55, 47, 55][i % 4], 0.5), -7, -0.1)
    for i, (dt, m) in enumerate([(0.6, 79), (1.2, 83), (1.8, 81), (2.4, 79)]):
        g.dry.add(c7 + dt, celesta(rng, m + 12, 0.35), -14, 0.3 if i % 2 else -0.3)
    for i in range(4):
        g.dry.add(A['L6w6'] + i * 0.3, glock(rng, [91, 88, 91, 88][i], 0.35, 0.8), -15, 0.1)

    # I · «Подписывайся…»: warm C with a celesta tune, then B7sus4 → B7 for the loop back into E minor
    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + 0.55 * (dur - end0)
    end.wet.add(end0, saws(rng, [48, 55, 60, 64], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1200), -14, 0.0)
    end.wet.add(mid, saws(rng, [47, 52, 54, 57], max(0.4, dur - mid - 0.6), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end.wet.add(dur - 0.5, saws(rng, [47, 51, 54, 57], 0.4, attack=0.1, release=0.4, bright=1000), -17, 0.0)
    for i, (dt, m) in enumerate([(0.0, 76), (0.3, 79), (0.6, 84), (0.9, 83), (1.5, 79), (1.8, 78)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end.dry.add(end0, pizz(rng, 36, 0.8), -3, 0.0)
    end.dry.add(mid, pizz(rng, 35, 0.7), -4, 0.0)
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
