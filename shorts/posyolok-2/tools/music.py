# Score for «Посёлок» №2 «К машине» (3D), synthesised with numpy (48 kHz stereo, no samples). Night, a quiet dread, grown-up: a low
# drone in D minor that never resolves, glassy high tremolo, a sparse celesta motif; every entry on a mark from build/cues.json.
# A the window: drone + a falling celesta figure. B inside: the drone thickens, a soft pulse (her heart). C the map: the
# tension grows — and drops out at the choice (only the heartbeat from the sound effects). E the backyards: a low pulse
# with a muted timpani step. F the last yard: a riser to the gasp, a hit when the window lights up. G: the motif once more,
# open, unresolved.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, celesta, saws, trem, timp, brass, crash, riser, Sec


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(2207)
    S = {}
    c1, c2, c3, c4, c5, c6, ans, ign, hit = (M[k] for k in ('c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'ans', 'ign', 'hit'))
    q = A['L1e']                                      # the choice: from the end of the question to the answer

    a = S['A'] = Sec(dur, stop=q, over=0.06)           # the wicket, the keys: the drone, the motif, the tension up to the choice
    a.wet.add(0.0, saws(rng, [26, 38], q + 0.1, attack=0.8, release=0.05, bright=340), -17, 0.0)
    a.wet.add(0.3, trem(rng, [86, 87], q - 0.3, grow=(0.05, 0.7), bright=5200), -30, 0.0)
    for i, m in enumerate([81, 77, 74, 73]):
        a.dry.add(0.6 + i * 0.5, celesta(rng, m, 0.6), -17, 0.3 - 0.2 * i)
    a.dry.add(c1, timp(rng, 26, 0.7), -12, 0.0)
    a.wet.add(max(c1, q - 1.8), riser(rng, 1.8), -19, 0.0)

    b = S['C'] = Sec(dur, stop=ign, over=0.05)          # the answer, across to the car, the door: a low pulse, steps
    b.dry.add(ans, timp(rng, 31, 0.8), -10, 0.0)
    b.wet.add(ans, saws(rng, [24, 36, 43], ign - ans + 0.1, attack=0.4, release=0.05, bright=380), -18, 0.0)
    k = 0
    while c2 + 0.4 + k * 0.6 < c4 - 0.2:
        b.dry.add(c2 + 0.4 + k * 0.6, timp(rng, 26 if k % 2 == 0 else 29, 0.4), -19, -0.1 + 0.2 * (k % 2)); k += 1
    b.wet.add(c4, trem(rng, [62, 63], ign - c4 + 0.1, grow=(0.2, 1.0), bright=3000), -22, 0.0)

    e = S['E'] = Sec(dur, stop=c6, over=0.05)           # the engine: a hit with the lights, the dread grows to the slam
    e.dry.add(ign, timp(rng, 26, 1.0), -7, 0.0)
    e.wet.add(ign, saws(rng, [26, 27, 38], hit - ign + 0.05, attack=0.1, release=0.02, bright=520), -16, 0.0)
    e.wet.add(max(ign, hit - 1.4), riser(rng, 1.4), -15, 0.0)
    e.dry.add(hit, timp(rng, 26, 1.5), -3, 0.0)
    e.dry.add(hit, brass(rng, [26, 32, 38], 0.8, bright=900), -7, 0.0)
    e.wet.add(hit, crash(rng, 0.6, 2.4), -16, 0.0)

    g = S['G'] = Sec(dur)                               # the question: the motif, open
    g.wet.add(c6, saws(rng, [26, 38, 45], dur - c6, attack=0.6, release=0.8, bright=300), -18, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.6, 77), (1.2, 76), (1.8, 81)]):
        g.dry.add(c6 + 0.4 + dt, celesta(rng, m, 0.55), -16, -0.2 + 0.13 * i)
    g.wet.add(c6 + 0.2, trem(rng, [86, 87], dur - c6, grow=(0.1, 0.5), bright=5200), -30, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 1.0, damp=5000, width=0.7), room(rng, 3.0, damp=3500, width=0.9))
    mix = sum(sec.render(rooms) for sec in S.values())
    n = at(dur)
    mix = mix[:, :n].copy()
    mix[:, -at(0.6):] *= np.linspace(1, 0, at(0.6))
    mix = hp(mix, 30)
    sf.write(out, mix.T, SR, subtype='FLOAT')
    print(f'music {n / SR:.2f}s → {out}  peak {np.max(np.abs(mix)):.3f}')


if __name__ == '__main__':
    main()
