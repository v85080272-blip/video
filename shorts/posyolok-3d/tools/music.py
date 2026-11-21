# Score for «Посёлок» (3D pilot), synthesised with numpy (48 kHz stereo, no samples). Night, a quiet dread, grown-up: a low
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
    rng = np.random.default_rng(1307)
    S = {}
    c1, c2, c4, c5, c6, ans, gasp = (M[k] for k in ('c1', 'c2', 'c4', 'c5', 'c6', 'ans', 'gasp'))
    q3 = A['L3e']                                     # the choice: from the end of the question to the answer

    a = S['A'] = Sec(dur, stop=c2, over=0.08)         # the window, inside
    a.wet.add(0.0, saws(rng, [26, 38], c2 + 0.2, attack=1.0, release=0.3, bright=320), -17, 0.0)
    a.wet.add(0.3, trem(rng, [86, 87], c2 - 0.3, grow=(0.05, 0.6), bright=5200), -30, 0.0)
    for i, m in enumerate([81, 77, 74, 73]):
        a.dry.add(0.5 + i * 0.5, celesta(rng, m, 0.6), -17, 0.3 - 0.2 * i)
    a.dry.add(c1, timp(rng, 26, 0.6), -14, 0.0)
    for k in range(int((c2 - c1) / 0.85)):          # a soft pulse: her heart
        a.dry.add(c1 + 0.3 + k * 0.85, timp(rng, 26, 0.35), -20, 0.0)

    b = S['C'] = Sec(dur, stop=q3, over=0.05)          # the map: the tension grows, then everything drops for the choice
    b.dry.add(c2, timp(rng, 26, 0.9), -9, 0.0)
    b.wet.add(c2, saws(rng, [26, 33, 38], q3 - c2 + 0.1, attack=0.3, release=0.05, bright=420), -16, 0.0)
    b.wet.add(c2 + 0.2, trem(rng, [62, 63], q3 - c2, grow=(0.1, 1.0), bright=3000), -22, 0.0)
    b.wet.add(max(c2, q3 - 2.0), riser(rng, 2.0), -18, 0.0)

    e = S['E'] = Sec(dur, stop=c5, over=0.05)          # the answer and the backyards: a low pulse, muted steps
    e.dry.add(ans, timp(rng, 31, 0.8), -10, 0.0)
    e.wet.add(ans, saws(rng, [24, 36, 43], c5 - ans + 0.1, attack=0.4, release=0.1, bright=360), -18, 0.0)
    k = 0
    while c4 + 0.4 + k * 0.62 < c5 - 0.2:
        e.dry.add(c4 + 0.4 + k * 0.62, timp(rng, 26 if k % 2 == 0 else 29, 0.4), -19, -0.1 + 0.2 * (k % 2)); k += 1

    f = S['F'] = Sec(dur, stop=c6, over=0.05)          # the last yard: a riser to the gasp, the hit on the light
    f.wet.add(c5, saws(rng, [26, 27], gasp - c5 + 0.05, attack=0.4, release=0.02, bright=500), -17, 0.0)
    f.wet.add(c5, trem(rng, [74, 75, 80], gasp - c5, grow=(0.1, 1.0), bright=4200), -22, 0.0)
    f.wet.add(max(c5, gasp - 1.6), riser(rng, 1.6), -14, 0.0)
    f.dry.add(gasp, timp(rng, 26, 1.4), -4, 0.0)
    f.dry.add(gasp, brass(rng, [26, 32, 38], 0.7, bright=800), -8, 0.0)
    f.wet.add(gasp, crash(rng, 0.5, 2.2), -18, 0.0)

    g = S['G'] = Sec(dur)                              # the question: the motif, open
    g.wet.add(gasp + 0.3, saws(rng, [26, 38, 45], dur - gasp, attack=0.8, release=0.8, bright=300), -18, 0.0)
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
