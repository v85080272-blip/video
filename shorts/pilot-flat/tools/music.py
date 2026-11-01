# Score for «Мёртвые восстали, а ты пилот», synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# E minor, a beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json.
# The cemetery: a low pad, a creepy celesta on the tritone, a stab when the dead burst out; an airy riser up to the plane.
# The cockpit: a nervous pizzicato, a stab on «кто бы ни стучал». The door blueprint: a ticking pulse, a bright chord
# when the lock goes to ЗАКР, a low buzz on ОТКАЗ. Step one drives on the map, tremolo with the dead, G major when the
# route bends to the airfield. The low pass is drums and a rising brass on the go-around. The landing settles, the slide
# is a stab and tremolo; the wait turns to a warm morning pad; the end is E major, and B7 under the question leads back
# to the E minor of the start.
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
    rise, up, cab, flip, mon, bpd, sw, code, deny, map_, people, dead, bend, low, ga, land, td, bpp, slide, climb, park, wait, end, ask = (M[k] for k in (
        'rise', 'up', 'cab', 'flip', 'mon', 'bpd', 'sw', 'code', 'deny', 'map', 'people', 'dead', 'bend', 'low', 'ga', 'land', 'td', 'bpp', 'slide',
        'climb', 'park', 'wait', 'end', 'ask'))

    # A · the cemetery at dusk; the dead burst out; the camera rises to the plane
    a = S['A'] = Sec(dur, stop=cab, over=0.03)
    a.wet.add(0.0, saws(rng, [28, 40, 47, 55], up + 0.4, attack=0.3, release=0.3, bright=600), -17, 0.0)
    for i, (dt, m) in enumerate([(0.35, 76), (0.6, 82), (0.9, 79)]):
        a.dry.add(dt, celesta(rng, m, 0.5), -13, 0.3 if i % 2 else -0.3)
    a.dry.add(rise, timp(rng, 28, 1.0), -5, 0.0)
    a.dry.add(rise, brass(rng, [40, 46, 52], 0.5, bright=1200), -8, 0.0)
    a.dry.add(up - 0.6, riser(rng, 0.6), -14, 0.0)
    a.wet.add(up, saws(rng, [52, 59, 64, 71], cab - up + 0.3, attack=0.4, release=0.3, bright=2200), -15, 0.0)
    for i, m in enumerate([71, 76, 79, 83, 88]):
        a.dry.add(up + 0.1 + i * 0.12, glock(rng, m, 0.4, 1.4), -16, -0.3 + 0.15 * i)

    # B · the cockpit, the knock, the lock, the door camera
    b = S['B'] = Sec(dur, stop=bpd, over=0.03, gain=((0, -2.0),))
    for i, t in enumerate(grid(cab, bpd, BEAT / 2)):
        b.dry.add(t, pizz(rng, [40, 52, 41, 52][i % 4], 0.6), -7, -0.1)
    b.wet.add(cab, saws(rng, [28, 40, 47], bpd - cab, attack=0.2, release=0.3, bright=500), -17, 0.0)
    b.dry.add(flip + 0.1, glock(rng, 88, 0.5, 1.2), -12, 0.2)
    b.dry.add(mon, brass(rng, [40, 46, 53], 0.5, bright=1600), -6, 0.0)
    b.dry.add(mon, timp(rng, 40, 0.8), -6, 0.0)
    b.wet.add(mon, trem(rng, [71, 72], bpd - mon, grow=(0.4, 1.0), bright=2600), -19, 0.1)

    # C · the door blueprint: a ticking pulse; a bright chord when it locks; a low buzz on ОТКАЗ
    c = S['C'] = Sec(dur, stop=map_, over=0.03, gain=((0, -2.0),))
    pat = [40, 52, 47, 52, 43, 55, 47, 55]
    for i, t in enumerate(grid(bpd, map_, BEAT / 2)):
        c.dry.add(t, pizz(rng, pat[i % 8], 0.55), -7, -0.1)
    for t in grid(bpd, map_, BEAT):
        c.dry.add(t, timp(rng, 40, 0.25), -15, 0.0)
    c.wet.add(sw, saws(rng, [52, 55, 59, 64], code - sw + 0.2, attack=0.05, release=0.3, bright=1800), -14, 0.0)
    c.dry.add(sw, glock(rng, 83, 0.6, 1.5), -10, 0.1)
    c.dry.add(deny, brass(rng, [28, 34, 40], 0.5, bright=700), -7, 0.0)
    c.dry.add(map_ - 0.6, riser(rng, 0.6), -15, 0.0)

    # D · step one, the map: a driving ostinato; tremolo and brass when the dead fill the city; G major on the bend
    d = S['D'] = Sec(dur, stop=low, over=0.04, gain=((0, -2.0),))
    for i, t in enumerate(grid(map_, bend, BEAT / 2)):
        d.dry.add(t, pizz(rng, [40, 52, 47, 52][i % 4], 0.6), -6, -0.1)
    d.wet.add(map_, saws(rng, [28, 40, 47], bend - map_, attack=0.4, release=0.3, bright=500), -17, 0.0)
    d.wet.add(dead, trem(rng, [64, 65], bend - dead, grow=(0.3, 1.0), bright=2600), -18, 0.1)
    d.dry.add(dead, brass(rng, [40, 46, 52], 0.5, bright=1400), -7, 0.0)
    d.dry.add(dead + 0.8, timp(rng, 40, 0.7), -8, 0.0)
    d.wet.add(bend, saws(rng, [43, 50, 55, 59, 62], low - bend, attack=0.3, release=0.4, bright=1400), -14, 0.0)
    for i, t in enumerate(grid(bend, low, BEAT / 2)):
        d.dry.add(t, pizz(rng, [43, 55, 50, 55][i % 4], 0.6), -6, -0.1)
    for i, m in enumerate([67, 71, 74, 79, 83]):
        d.dry.add(bend + 0.2 + i * 0.11, xylo(rng, m, 0.5), -11, -0.25 + 0.1 * i)

    # E · step two, the low pass: drums under a held chord; brass rising on the go-around
    e = S['E'] = Sec(dur, stop=land, over=0.04, gain=((0, -2.0),))
    e.wet.add(low, saws(rng, [28, 40, 47, 52], ga - low, attack=0.3, release=0.2, bright=700), -16, 0.0)
    for i, t in enumerate(grid(low, ga, BEAT / 2)):
        e.dry.add(t, timp(rng, 40 if i % 4 == 0 else 47, 0.35 if i % 2 else 0.6), -10, 0.0)
        e.dry.add(t, pizz(rng, [40, 40, 52, 40][i % 4], 0.5), -8, -0.1)
    e.dry.add(ga - 0.8, riser(rng, 0.8), -12, 0.0)
    e.dry.add(ga, crash(rng, 0.6), -12, 0.0)
    e.dry.add(ga, brass(rng, [43, 50, 55, 59], 0.9, bright=2200), -6, 0.0)
    e.wet.add(ga, saws(rng, [43, 50, 55, 59, 67], land - ga, attack=0.1, release=0.4, bright=2000), -14, 0.0)

    # F · step three, the landing; the slide is a stab; tremolo as the dead climb it
    f = S['F'] = Sec(dur, stop=park, over=0.04, gain=((0, -2.0),))
    f.wet.add(land, saws(rng, [40, 47, 52, 55], bpp - land, attack=0.4, release=0.3, bright=900), -16, 0.0)
    f.dry.add(td, timp(rng, 28, 0.9), -6, 0.0)
    for i, t in enumerate(grid(bpp, park, BEAT / 2)):
        f.dry.add(t, pizz(rng, [40, 52, 41, 53][i % 4], 0.55), -7, -0.1)
    f.dry.add(slide, brass(rng, [40, 46, 52], 0.5, bright=1600), -6, 0.0)
    f.wet.add(climb, trem(rng, [71, 72], park - climb, grow=(0.4, 1.0), bright=2800), -18, 0.1)

    # G · under the door they cannot reach; the wait: a warm morning pad, a slow celesta
    h = S['G'] = Sec(dur, stop=end, over=0.04, gain=((0, -2.0),))
    h.wet.add(park, saws(rng, [40, 47, 52], wait - park + 0.3, attack=0.3, release=0.3, bright=600), -16, 0.0)
    for i, t in enumerate(grid(park, wait, BEAT)):
        h.dry.add(t, pizz(rng, [40, 47, 52, 47][i % 4], 0.5), -9, -0.1)
    h.dry.add(A['L6w6'] - 0.05, glock(rng, 88, 0.5, 1.3), -12, 0.2)
    h.wet.add(wait, saws(rng, [48, 55, 60, 64, 67], end - wait + 0.3, attack=0.8, release=0.5, bright=1600), -15, 0.0)
    tune = [76, 79, 84, 83, 79, 76]
    for i, t in enumerate(grid(wait + 0.2, end - 0.2, BEAT * 1.5)):
        h.dry.add(t, celesta(rng, tune[i % 6], 0.5), -11, 0.2 - 0.1 * (i % 3))

    # I · the end: E major with a celesta tune; B7 under the question leads back to the E minor of the start
    end_ = S['I'] = Sec(dur, gain=((end, 0.0), (dur, -4.0)))
    mid = ask + 0.1
    end_.dry.add(end, crash(rng, 0.6), -12, 0.0)
    end_.dry.add(end, timp(rng, 40, 0.8), -7, 0.0)
    end_.wet.add(end, saws(rng, [40, 47, 52, 56, 59, 64], mid - end + 0.3, attack=0.08, release=0.5, bright=1600), -13, 0.0)
    for i, (dt, m) in enumerate([(0.0, 76), (0.3, 80), (0.6, 83), (0.9, 80), (1.5, 78), (1.8, 76)]):
        end_.dry.add(end + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end_.dry.add(end, pizz(rng, 40, 0.8), -3, 0.0)
    end_.wet.add(mid, saws(rng, [47, 51, 54, 57], max(0.4, dur - mid - 0.2), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end_.dry.add(mid, pizz(rng, 35, 0.7), -4, 0.0)
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
