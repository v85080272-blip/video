# Score for the 3D test of «Заражение» (10 s), synthesised with numpy (48 kHz stereo, no samples).
# Sparse horror in D minor, every entry on a mark from build/cues.json.
# s1, down the gap: a low D drone, a glassy semitone rub high up growing, three celesta notes falling.
# s2, the lift: a sub hit on the cut, the drone slips up a semitone to E-flat, strings tremble a semitone apart and grow
# to the twitch, where a short low brass stinger hits. s3, the landing: back to D, a celesta lullaby while she crosses
# herself, a riser from the moment Пурга looks down. Black: one big low hit and its ring.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, celesta, saws, trem, timp, brass, crash, riser, Sec


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(303)
    S = {}
    c1, twitch, c2, cross, peer, black = (M[k] for k in ('c1', 'twitch', 'c2', 'cross', 'peer', 'black'))

    # 1 · down the gap
    a = S['1'] = Sec(dur, stop=c1, over=0.05)
    a.wet.add(0.0, saws(rng, [26, 38], c1 + 0.2, attack=1.2, release=0.3, bright=300), -17, 0.0)
    a.wet.add(0.2, trem(rng, [86, 87], c1 - 0.2, grow=(0.1, 0.7), bright=5000), -28, 0.0)
    for i, m in enumerate([81, 77, 74]):
        a.dry.add(A['L0w4'] + i * 0.42, celesta(rng, m, 0.7), -15, 0.3 - 0.3 * i)

    # 2 · the lift
    b = S['2'] = Sec(dur, stop=c2, over=0.05)
    b.dry.add(c1, timp(rng, 26, 1.2), -6, 0.0)
    b.wet.add(c1, saws(rng, [27, 39], c2 - c1 + 0.2, attack=0.15, release=0.3, bright=350), -16, 0.0)
    b.wet.add(c1 + 0.1, trem(rng, [62, 63], twitch - c1 + 0.6, grow=(0.15, 1.0), bright=2600), -21, 0.0)
    b.dry.add(twitch, brass(rng, [27, 33, 39], 0.45, bright=900), -8, 0.0)
    b.dry.add(twitch, timp(rng, 27, 0.8), -7, 0.0)

    # 3 · the landing
    c = S['3'] = Sec(dur, stop=black, over=0.03)
    c.wet.add(c2, saws(rng, [26, 38, 45], black - c2 + 0.1, attack=0.3, release=0.1, bright=380), -17, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.5, 77), (1.0, 76), (1.5, 72), (2.2, 74)]):
        c.dry.add(cross + 0.2 + dt, celesta(rng, m, 0.6), -14, -0.2 + 0.1 * i)
    c.wet.add(peer, riser(rng, max(0.4, black - peer)), -14, 0.0)
    c.wet.add(peer, trem(rng, [57, 58, 63], black - peer, grow=(0.2, 1.0), bright=3000), -20, 0.0)

    # 4 · black: the hit and its ring
    d = S['4'] = Sec(dur)
    d.dry.add(black, timp(rng, 26, 1.6), -3, 0.0)
    d.dry.add(black, brass(rng, [26, 32, 38], 0.9, bright=700), -6, 0.0)
    d.wet.add(black, crash(rng, 0.6, 2.4), -16, 0.0)
    d.wet.add(black + 0.1, saws(rng, [26, 27], max(0.4, dur - black - 0.2), attack=0.05, release=0.6, bright=250), -18, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 1.0, damp=5000, width=0.7), room(rng, 2.8, damp=3500, width=0.9))
    mix = sum(sec.render(rooms) for sec in S.values())
    n = at(dur)
    mix = mix[:, :n].copy()
    mix[:, -at(0.4):] *= np.linspace(1, 0, at(0.4))                  # no loop here: it ends on black
    mix = hp(mix, 30)
    sf.write(out, mix.T, SR, subtype='FLOAT')
    print(f'music {n / SR:.2f}s → {out}  peak {np.max(np.abs(mix)):.3f}')


if __name__ == '__main__':
    main()
