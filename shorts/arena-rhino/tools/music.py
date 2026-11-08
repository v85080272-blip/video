# Score for «Носорог» (Арена, битва 3), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every section starting on the narrator's word from build/cues.json.
# The gate: timpani on the beat, a low brass stab as he stamps, a short fanfare for «Его выбрали вы», a sparkle on
# «головой». Step one: a light pizzicato drifting with the wind; step two: almost nothing — a held high note while he
# listens, a tick on each turn of his ears; step three: the charge — the drums drive and a riser climbs into the hit on
# the stone (brass, timpani, a crash), then a dazed, wobbling celesta and a glockenspiel on «потерял тебя». «Толпа
# ревёт»: D major brass. The end: a celesta tune and back to D minor for the loop.
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
    rng = np.random.default_rng(87)
    S = {}
    gate, out, voted, c1, idea, c2, wind, nose, c3, shh, hears, c4, charge, hide, hit, snort, lost, c6, cheer, c7 = (M[k] for k in (
        'gate', 'out', 'voted', 'c1', 'idea', 'c2', 'wind', 'nose', 'c3', 'shh', 'hears', 'c4', 'charge', 'hide', 'hit', 'snort', 'lost', 'c6', 'cheer', 'c7'))
    end0 = A['L7']

    # A · the gate, the rhino walks out and stamps; the fanfare for the vote; «головой»
    a = S['A'] = Sec(dur, stop=c2, over=0.05)
    a.wet.add(0.0, saws(rng, [26, 38, 45], c2, attack=0.8, release=0.3, bright=420), -18, 0.0)
    for t in grid(gate, out + 1.5, BEAT):
        a.dry.add(t, timp(rng, 33, 0.4), -10, 0.0)
    a.dry.add(out + 1.5, brass(rng, [26, 33, 38], 0.6, bright=900), -4, 0.0)
    a.dry.add(out + 1.5, timp(rng, 26, 1.0), -4, 0.0)
    for dt, notes, d in [(0.0, [50, 57, 62], 0.2), (0.22, [50, 57, 62], 0.2), (0.44, [53, 57, 62, 65], 0.6)]:
        a.dry.add(voted + dt, brass(rng, notes, d, bright=2400), -9, 0.0)
    a.dry.add(c1, brass(rng, [26, 29, 33], 0.5, bright=700), -8, 0.0)
    for i, m in enumerate([74, 78, 81, 86]):
        a.dry.add(idea + i * 0.07, glock(rng, m, 0.5, 1.2), -10, 0.2)

    # B · step one: a light pizzicato drifting like the wind; step two: a held high note, ticks as his ears turn
    b = S['B'] = Sec(dur, gain=((c2, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c2, c3, BEAT / 2)):
        b.dry.add(t, pizz(rng, [50, 53, 57, 53, 50, 48, 45, 48][i % 8], 0.45), -12, -0.3 + 0.6 * ((i % 8) / 7))
    b.wet.add(c2, trem(rng, [69, 74], c3 - c2, grow=(0.2, 0.5), bright=2600), -22, 0.0)
    b.dry.add(nose, timp(rng, 38, 0.5), -9, 0.0)
    b.wet.add(c3, saws(rng, [26, 81], c4 - c3, attack=0.2, release=0.2, bright=2000), -20, 0.0)
    for i, t in enumerate(grid(c3 + 0.3, c4, 0.9)):
        b.dry.add(t, xylo(rng, [86, 84][i % 2], 0.2), -18, -0.4 + 0.8 * (i % 2))

    # C · step three: the charge — drums driving, a riser, the hit on the stone; dazed; lost
    c = S['C'] = Sec(dur, gain=((c4, -2.0), (c6, -3.0)))
    for i, t in enumerate(grid(charge, hit, BEAT / 2)):
        c.dry.add(t, timp(rng, [33, 38][i % 2], 0.4), -8, 0.0)
        c.dry.add(t, pizz(rng, [38, 50, 45, 50][i % 4], 0.5), -10, -0.1)
    c.wet.add(charge, riser(rng, max(0.4, hit - charge)), -12, 0.0)
    c.dry.add(hit, brass(rng, [26, 38, 45, 50], 0.8, bright=2200), -2, 0.0)
    c.dry.add(hit, timp(rng, 26, 1.2), -2, 0.0)
    c.dry.add(hit, crash(rng, 1.0, 2.2), -8, 0.0)
    for i, m in enumerate([81, 80, 81, 79, 81, 78]):
        c.dry.add(hit + 0.5 + i * 0.22, celesta(rng, m, 0.3), -13, -0.3 + 0.12 * i)
    for i, m in enumerate([74, 78, 81, 86]):
        c.dry.add(lost + 0.3 + i * 0.08, glock(rng, m, 0.5, 1.2), -10, 0.2)

    # D · he turns and walks out; the crowd roars: D major brass
    d = S['D'] = Sec(dur, gain=((c6, -3.0), (end0, -4.0)))
    for i, t in enumerate(grid(c6 + 0.4, cheer, BEAT)):
        d.dry.add(t, pizz(rng, [38, 45][i % 2], 0.5), -12, 0.0)
    for dt, notes, dd in [(0.0, [50, 57, 62, 66], 0.22), (0.25, [50, 57, 62, 66], 0.22), (0.5, [50, 54, 57, 62, 66], 1.1)]:
        d.dry.add(cheer + dt, brass(rng, notes, dd, bright=2800), -5, 0.0)
    d.dry.add(cheer, timp(rng, 38, 1.0), -5, 0.0)
    d.dry.add(cheer + 0.5, crash(rng, 0.7, 2.0), -10, 0.0)
    d.wet.add(cheer + 0.5, saws(rng, [38, 50, 54, 57, 62], max(0.4, end0 - cheer - 0.5), attack=0.3, release=0.5, bright=1600), -13, 0.0)

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
