# Score for «Подлодка, отказала вся электроника», synthesised with numpy (48 kHz stereo, no samples, no third-party
# music). E minor, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# Under way: a low Em9 pad with a soft pulse and a celesta answering the sonar; the power dies on a dissonant stab and
# the pad stops dead. The blueprint runs on a tight pizzicato ostinato and a ticking pulse; a tritone stab when the
# scrubber stops; high tremolo strings thicken with the CO₂. Step one drives: a xylophone runs up as the water is blown
# out and G major lifts with «лодка всплывёт». Step two drops back to a still pad and a slow celesta lullaby, a sparkle
# when the powder works. Step three leaves the rhythm to the knocks; a warm C major comes in with the ship above. The
# escape climbs a step of the scale every bar to the surface, which breaks into E major; under the question the score
# turns to B7, the dominant that leads back into the E minor the short starts in.
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
    dark, stop, co2, c2, bpb, blow, rise, close, c3, bunk, c4, eat, c5, up, c6, open_, swim, lungs, surf, ask = (M[k] for k in (
        'dark', 'stop', 'co2', 'c2', 'bpb', 'blow', 'rise', 'close', 'c3', 'bunk', 'c4', 'eat', 'c5', 'up', 'c6', 'open', 'swim',
        'lungs', 'surf', 'ask'))
    l1, end0 = A['L1'], A['L7']

    # A · under way: a low Em9 pad, a soft pulse, a celesta answering the sonar; the power dies on a stab
    a = S['A'] = Sec(dur, stop=dark + 0.05, dead=True, over=0.02)
    a.wet.add(0.0, saws(rng, [28, 40, 47, 54, 59], dark + 0.3, attack=0.4, release=0.2, bright=800), -18, 0.0)
    for t in grid(0.0, dark, BEAT):
        a.dry.add(t, timp(rng, 40, 0.25), -16, 0.0)
    for i, (dt, m) in enumerate([(0.5, 83), (0.85, 88), (2.3, 83), (2.65, 88)]):
        if dt < dark - 0.05:
            a.dry.add(dt, celesta(rng, m, 0.4), -14, 0.35 if i % 2 else -0.35)
    b0 = S['B0'] = Sec(dur, stop=l1, over=0.03)
    b0.dry.add(dark, timp(rng, 28, 1.0), -4, 0.0)
    b0.dry.add(dark, brass(rng, [28, 40, 41], 0.5, bright=700), -9, 0.0)
    b0.wet.add(dark + 0.4, saws(rng, [28, 40], l1 - dark, attack=0.6, release=0.3, bright=380), -16, 0.0)
    b0.dry.add(A['L0w11'] - 0.04, brass(rng, [52, 53], 0.25, bright=1500), -8, 0.0)

    # B · the blueprint: an ostinato and a ticking pulse; a tritone stab when the scrubber stops; tremolo with the CO₂
    pat = [40, 52, 40, 52, 43, 55, 42, 54]
    b = S['B'] = Sec(dur, stop=c2, over=0.03, gain=((0, -2.0),))
    for i, t in enumerate(grid(l1, c2, BEAT / 2)):
        b.dry.add(t, pizz(rng, pat[i % 8], 0.6), -6, -0.1)
    b.wet.add(l1, saws(rng, [28, 40, 47], c2 - l1, attack=0.5, release=0.3, bright=450), -17, 0.0)
    for t in grid(l1, stop, BEAT):
        b.dry.add(t, timp(rng, 40, 0.3), -14, 0.0)
    b.dry.add(stop, brass(rng, [40, 46, 52], 0.5, bright=1800), -5, 0.0)
    b.dry.add(stop, timp(rng, 40, 0.9), -4, 0.0)
    b.wet.add(co2, trem(rng, [71, 72], c2 - co2, grow=(0.2, 1.0), bright=2600), -18, 0.1)
    b.dry.add(c2 - 0.8, riser(rng, 0.8), -15, 0.0)

    # C · step one, «продуй балласт»: a driving ostinato; the xylophone runs up as the water goes; G major for the rise
    c = S['C'] = Sec(dur, stop=c3, over=0.04, gain=((0, -2.0),))
    for i, t in enumerate(grid(c2, rise, BEAT / 2)):
        c.dry.add(t, pizz(rng, [40, 52, 47, 52][i % 4], 0.6), -6, -0.1)
    c.dry.add(bpb, timp(rng, 40, 0.6), -8, 0.0)
    for i, m in enumerate([64, 67, 71, 76, 79, 83]):
        c.dry.add(blow + 0.05 + i * 0.11, xylo(rng, m, 0.5), -11, -0.25 + 0.1 * i)
    c.wet.add(rise, saws(rng, [43, 50, 55, 59, 62], c3 - rise, attack=0.25, release=0.4, bright=1300), -14, 0.0)
    for i, t in enumerate(grid(rise, c3, BEAT / 2)):
        c.dry.add(t, pizz(rng, [43, 55, 50, 55][i % 4], 0.6), -6, -0.1)
    c.dry.add(rise, glock(rng, 91, 0.5, 1.4), -12, 0.2)
    c.dry.add(close, timp(rng, 43, 0.4), -12, 0.0)

    # D · step two, the boat on the bottom: the hope drops; a still pad, a slow celesta; a sparkle when the powder works
    d = S['D'] = Sec(dur, gain=((c3, -3.0), (c5, -4.0)))
    d.dry.add(c3, timp(rng, 28, 0.8), -6, 0.0)
    d.dry.add(c3, brass(rng, [40, 41], 0.4, bright=900), -10, 0.0)
    d.wet.add(c3 + 0.3, saws(rng, [40, 47, 52, 55], c5 - c3, attack=0.8, release=0.5, bright=700), -18, 0.0)
    tune = [76, 79, 83, 81, 79, 76, 74, 76]
    for i, t in enumerate(grid(bunk, c5 - 0.3, BEAT * 2)):
        d.dry.add(t, celesta(rng, tune[i % 8], 0.5), -12, 0.2 - 0.1 * (i % 3))
    for i, t in enumerate(grid(c4, c5, BEAT)):
        d.dry.add(t, pizz(rng, [40, 47, 52, 47][i % 4], 0.45), -10, -0.1)
    for i, m in enumerate([88, 91, 95, 100]):
        d.dry.add(eat + 0.05 + i * 0.1, glock(rng, m, 0.4, 1.4), -14, 0.3 - 0.2 * i)

    # E · step three, knocking: the knocks are the rhythm; a low drone, then C major warmth with the ship above
    e = S['E'] = Sec(dur, gain=((c5, -3.0), (c6, -3.0)))
    e.dry.add(c5, timp(rng, 40, 0.7), -8, 0.0)
    e.wet.add(c5, saws(rng, [28, 40, 47], up - c5 + 0.5, attack=0.3, release=0.6, bright=500), -16, 0.0)
    e.wet.add(c5 + 0.2, trem(rng, [64, 67], up - c5, grow=(0.3, 0.7), bright=2200), -21, 0.1)
    e.wet.add(up, saws(rng, [36, 43, 48, 52, 55], c6 - up, attack=0.6, release=0.5, bright=1000), -16, 0.0)
    for i, m in enumerate([72, 76, 79]):
        e.dry.add(up + 0.3 + i * 0.3, celesta(rng, m, 0.45), -13, -0.2 + 0.2 * i)

    # F · the escape: the ostinato climbs a step of E minor every bar up to the surface; a stab as the hatch opens, a
    # warning on «порвёт лёгкие», a riser into the surface
    roots = [40, 42, 43, 45, 47, 48, 50]
    f = S['F'] = Sec(dur, stop=surf, over=0.03, gain=((c6, -2.0), (surf, 0.0)))
    for i, t in enumerate(grid(c6, surf, BEAT / 2)):
        r = roots[min(len(roots) - 1, int((t - c6) / (surf - c6) * len(roots)))]
        f.dry.add(t, pizz(rng, r + (12 if i % 2 else 0), 0.6), -6, -0.1)
    f.wet.add(c6, saws(rng, [40, 47], surf - c6, attack=1.0, release=0.1, bright=500), -17, 0.0)
    f.wet.add(swim, trem(rng, [76, 77], surf - swim, grow=(0.3, 1.0), bright=3000), -18, 0.1)
    f.dry.add(open_, brass(rng, [40, 47, 52], 0.4, bright=1400), -7, 0.0)
    f.dry.add(lungs, brass(rng, [52, 53], 0.3, bright=1600), -7, 0.0)
    f.dry.add(lungs, timp(rng, 40, 0.6), -8, 0.0)
    f.dry.add(surf - 1.2, riser(rng, 1.2), -13, 0.0)

    # I · the surface and «Подписывайся…»: E major breaks open with a celesta tune; B7 under the question leads back to Em
    end = S['I'] = Sec(dur, gain=((surf, 0.0), (end0, -3.0), (dur, -6.0)))
    mid = ask + 0.1
    end.dry.add(surf, crash(rng, 0.7), -10, 0.0)
    end.dry.add(surf, timp(rng, 40, 0.9), -6, 0.0)
    end.wet.add(surf, saws(rng, [40, 47, 52, 56, 59, 64], mid - surf + 0.3, attack=0.08, release=0.5, bright=1600), -13, 0.0)
    for i, (dt, m) in enumerate([(0.0, 76), (0.3, 80), (0.6, 83), (0.9, 80), (1.5, 78), (1.8, 76)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end.dry.add(end0, pizz(rng, 40, 0.8), -3, 0.0)
    end.wet.add(mid, saws(rng, [47, 52, 54, 57], max(0.4, dur - mid - 0.6), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end.wet.add(dur - 0.5, saws(rng, [47, 51, 54, 57], 0.4, attack=0.1, release=0.4, bright=1000), -17, 0.0)
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
