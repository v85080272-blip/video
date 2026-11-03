# Score for «Бык» (Арена, битва 1), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every section starting on the narrator's word from build/cues.json.
# Waking on the sand: a low drone; the camera pulls back on a riser into a Roman fanfare as the stands roar. The gate:
# a pizzicato ostinato over a heartbeat in the timpani, a low brass stab as the bull walks out, a sparkle on «головой».
# The steps: the drums drive; a stab as the cape swings, the big hit on the wall (brass, timpani, a crash, the drums
# stop for a breath); in step three the ostinato slows down as the bull tires. «Бык лёг»: a hush, then D major brass as
# the crowd roars and the sword comes down. The end: a celesta tune and back to D minor for the loop.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, xylo, glock, saws, trem, timp, brass, crash, riser, Sec

BEAT = 0.5


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(81)
    S = {}
    wake, reveal, roar, c1, out, arms, c2, idea, c3, wave, c4, jump, hit, c5, c6, pat, cheer, sword, catch, c7 = (M[k] for k in (
        'wake', 'reveal', 'roar', 'c1', 'out', 'arms', 'c2', 'idea', 'c3', 'wave', 'c4', 'jump', 'hit', 'c5', 'c6', 'pat', 'cheer', 'sword', 'catch', 'c7'))
    end0 = A['L7']

    # A · asleep, awake, the arena: a drone, a thud as he wakes, a riser into the fanfare as the stands roar
    a = S['A'] = Sec(dur, stop=c1, over=0.05)
    a.wet.add(0.0, saws(rng, [26, 38, 45], c1, attack=1.0, release=0.3, bright=400), -18, 0.0)
    a.dry.add(wake, timp(rng, 38, 0.8), -7, 0.0)
    a.wet.add(reveal - 0.2, riser(rng, max(0.4, roar - reveal + 0.2)), -12, 0.0)
    for dt, notes, d in [(0.0, [50, 57, 62], 0.22), (0.25, [50, 57, 62], 0.22), (0.5, [53, 57, 62, 65], 0.8)]:
        a.dry.add(roar + dt, brass(rng, notes, d, bright=2600), -6, 0.0)
    a.dry.add(roar, timp(rng, 38, 1.0), -5, 0.0)
    a.dry.add(roar + 0.5, crash(rng, 0.6, 1.6), -12, 0.0)

    # B · the gate and the bull: a pizzicato ostinato over a heartbeat; a low stab as he walks out; a sparkle on «головой»
    b = S['B'] = Sec(dur, gain=((c1, -2.0), (c3, -2.0)))
    for i, t in enumerate(grid(c1, c3, BEAT / 2)):
        b.dry.add(t, pizz(rng, [38, 38, 41, 38, 45, 38, 41, 44][i % 8], 0.55), -10, -0.15)
    for t in grid(c1, c3, BEAT):
        b.dry.add(t, timp(rng, 33, 0.35), -11, 0.0)
    b.wet.add(c1, trem(rng, [62, 65, 69], c3 - c1, grow=(0.2, 0.7), bright=1800), -21, 0.0)
    b.dry.add(out, brass(rng, [26, 33, 38], 0.6, bright=900), -5, 0.0)
    b.dry.add(arms, brass(rng, [38, 44, 50], 0.3, bright=1400), -9, 0.0)
    for i, m in enumerate([74, 78, 81, 86]):
        b.dry.add(idea + i * 0.07, glock(rng, m, 0.5, 1.2), -10, 0.2)

    # C · the steps: the drums drive; a stab on the swing; the wall; the ostinato slowing as he tires
    c = S['C'] = Sec(dur, gain=((c3, -2.0), (c6, -3.0)))
    for i, t in enumerate(grid(c3, hit, BEAT / 2)):
        c.dry.add(t, pizz(rng, [38, 50, 45, 50, 41, 50, 45, 50][i % 8], 0.6), -9, -0.1)
        if i % 2 == 0:
            c.dry.add(t, timp(rng, [38, 33][(i // 2) % 2], 0.5), -10, 0.0)
    c.dry.add(wave, brass(rng, [38, 45, 50], 0.35, bright=2000), -7, 0.0)
    c.wet.add(c4, trem(rng, [57, 62, 65], hit - c4, grow=(0.3, 1.0), bright=2600), -18, 0.0)
    c.dry.add(hit, brass(rng, [26, 38, 45, 50], 0.7, bright=2200), -3, 0.0)
    c.dry.add(hit, timp(rng, 33, 1.0), -3, 0.0)
    c.dry.add(hit, crash(rng, 1.0, 2.2), -8, 0.0)
    for i, m in enumerate([86, 84, 81, 79]):
        c.dry.add(hit + 0.35 + i * 0.12, xylo(rng, m, 0.3), -14, 0.4)
    t, i = c5, 0
    while t < c6 - 0.05:                                     # step three: each beat a little longer
        k = (t - c5) / max(0.1, c6 - c5)
        c.dry.add(t, pizz(rng, [38, 45, 41, 45][i % 4], 0.6 - 0.25 * k), -9, -0.1)
        if i % 2 == 0:
            c.dry.add(t, timp(rng, 33, 0.45 - 0.2 * k), -11, 0.0)
        t += BEAT / 2 * (1 + 1.2 * k)
        i += 1

    # D · he lies down: a hush; the crowd roars: D major brass; the sword: a crash and a rising run
    d = S['D'] = Sec(dur, gain=((c6, -3.0), (end0, -4.0)))
    d.wet.add(c6, saws(rng, [38, 45, 50, 53], cheer - c6, attack=0.4, release=0.3, bright=700), -17, 0.0)
    d.dry.add(pat, celesta(rng, 81, 0.5), -10, 0.1)
    for dt, notes, dd in [(0.0, [50, 57, 62, 66], 0.22), (0.25, [50, 57, 62, 66], 0.22), (0.5, [50, 54, 57, 62, 66], 1.1)]:
        d.dry.add(cheer + dt, brass(rng, notes, dd, bright=2800), -5, 0.0)
    d.dry.add(cheer, timp(rng, 38, 1.0), -5, 0.0)
    d.wet.add(cheer + 0.5, saws(rng, [38, 50, 54, 57, 62], end0 - cheer - 0.5, attack=0.3, release=0.5, bright=1600), -13, 0.0)
    for i, m in enumerate([74, 78, 81, 86, 90]):
        d.dry.add(sword + i * (catch - sword) / 5, xylo(rng, m, 0.3), -12, 0.3)
    d.dry.add(catch, crash(rng, 0.8, 2.0), -9, 0.0)
    d.dry.add(catch, brass(rng, [50, 54, 57, 62], 0.5, bright=2600), -6, 0.0)

    # I · «Кого одолеть следующим?»: a celesta tune in D, then A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.55
    end.wet.add(end0, saws(rng, [38, 45, 50, 54], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1200), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 49, 52, 55], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.3, 78), (0.6, 81), (0.9, 78), (1.5, 76), (1.8, 73)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    for t in grid(end0, dur - 0.2, BEAT):
        end.dry.add(t, timp(rng, 38, 0.25), -14, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 0.9, damp=6000, width=0.7), room(rng, 2.4, damp=4500, width=0.9))
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
