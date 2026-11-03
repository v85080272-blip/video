# Score for «На крышу» («Заражение», серия 3), synthesised with numpy (48 kHz stereo, no samples).
# D minor, a beat of 0.5 s (120 BPM), every section starting on a mark from build/cues.json.
# Up the stairs: a pizzicato ostinato climbing, timpani on the beat; a low brass stab on «на замке»; the keys: a
# celesta run (she has them all), a warm chord on «старшая по дому», a timpani hit as the padlock opens. The survivor's
# note: a hush, a drone and slow glockenspiel ticks; «но у нас не пожар» turns it to D major. The roof by day: an airy
# pad, a celesta tune, a little brass for баба Валя standing on the hatch; the letters: a xylophone note per strip; the
# helicopter: a rising glockenspiel. Night: a low drone and a thin tremolo, almost nothing under the code; the answer: the
# tremolo grows. The knock from below: the big hit (brass, timpani, a crash), then a pulse under the choice. The end: a
# celesta tune, then A7 for the loop back into D minor.
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
    rng = np.random.default_rng(97)
    S = {}
    cover, top, locked, keys, elder, unlock, c3, nofire, c4, shut, press, c5, sos, metre, heli, c6, reply, c7, knock, c8 = (M[k] for k in (
        'cover', 'top', 'locked', 'keys', 'elder', 'unlock', 'c3', 'noFire', 'c4', 'shut', 'press', 'c5', 'sos', 'metre', 'heli', 'c6', 'reply', 'c7', 'knock', 'c8'))
    end0 = A['L8']

    # A · up the stairs, the hatch, the keys
    a = S['A'] = Sec(dur, stop=c3, over=0.05)
    line = [38, 41, 45, 50, 41, 45, 50, 53]
    for i, t in enumerate(grid(0.0, top, BEAT / 2)):
        a.dry.add(t, pizz(rng, line[i % 8], 0.5), -10, -0.15)
    for t in grid(0.0, top, BEAT):
        a.dry.add(t, timp(rng, 38, 0.3), -12, 0.0)
    a.wet.add(0.0, saws(rng, [26, 38, 45], c3, attack=0.4, release=0.3, bright=500), -19, 0.0)
    a.dry.add(top, timp(rng, 33, 0.8), -7, 0.0)
    a.wet.add(top, trem(rng, [62, 63], keys - top, grow=(0.2, 0.8), bright=2200), -21, 0.0)
    a.dry.add(locked, brass(rng, [26, 33, 38], 0.45, bright=900), -7, 0.0)
    for i, m in enumerate([86, 88, 89, 91, 93, 94, 96]):
        a.dry.add(keys + 0.05 + i * 0.07, celesta(rng, m, 0.35), -13, 0.3 - 0.1 * i)
    a.wet.add(elder, saws(rng, [46, 50, 53, 58], unlock - elder + 0.2, attack=0.15, release=0.3, bright=1300), -14, 0.0)
    a.dry.add(unlock, timp(rng, 38, 0.8), -6, 0.0)
    a.dry.add(unlock, glock(rng, 86, 0.4, 1.0), -11, 0.0)

    # B · the note: a hush, slow ticks; «но у нас не пожар» → D major
    b = S['B'] = Sec(dur, stop=c4, over=0.05)
    b.wet.add(c3, saws(rng, [26, 38], nofire - c3 + 0.1, attack=0.3, release=0.2, bright=350), -18, 0.0)
    for i, t in enumerate(grid(c3 + 0.2, nofire, BEAT)):
        b.dry.add(t, glock(rng, [81, 77][i % 2], 0.25, 0.6), -17, 0.2)
    b.dry.add(nofire, timp(rng, 38, 0.7), -6, 0.0)
    b.dry.add(nofire, brass(rng, [50, 54, 57, 62], 0.5, bright=2200), -8, 0.0)
    b.wet.add(nofire + 0.3, saws(rng, [38, 50, 54, 57], c4 - nofire, attack=0.2, release=0.3, bright=1400), -15, 0.0)

    # C · the roof by day and the letters seen from above
    c = S['C'] = Sec(dur, stop=c6, over=0.05)
    c.wet.add(c4, saws(rng, [38, 45, 50, 53, 57], c6 - c4, attack=0.5, release=0.4, bright=1100), -16, 0.0)
    for i, t in enumerate(grid(c4, c6, BEAT / 2)):
        c.dry.add(t, pizz(rng, [38, 45, 50, 45][i % 4], 0.4), -14, -0.2)
    c.dry.add(shut + 0.38, timp(rng, 33, 0.6), -8, 0.0)
    for dt, notes, d in [(0.0, [50, 57, 62], 0.18), (0.22, [53, 57, 65], 0.5)]:
        c.dry.add(press + 0.5 + dt, brass(rng, notes, d, bright=2000), -10, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.35, 77), (0.7, 81), (1.2, 79), (1.55, 77), (1.9, 74)]):
        c.dry.add(c5 + 0.1 + dt, celesta(rng, m, 0.5), -13, -0.2 + 0.08 * i)
    for i, t in enumerate(np.linspace(sos, metre + 0.2, 14, endpoint=False)):
        c.dry.add(t, xylo(rng, [74, 77, 81, 86][i % 4], 0.2), -16, -0.4 + 0.06 * i)
    for i, m in enumerate([74, 78, 81, 86, 90]):
        c.dry.add(heli + 0.2 + i * 0.12, glock(rng, m, 0.4, 1.0), -13, 0.3)

    # D · night: a drone and a thin tremolo; the answer makes it grow
    d = S['D'] = Sec(dur, stop=c7, over=0.03)
    d.wet.add(c6, saws(rng, [26, 33, 38], c7 - c6 + 0.1, attack=0.8, release=0.1, bright=300), -16, 0.0)
    d.wet.add(c6 + 0.3, trem(rng, [74, 75], reply - c6, grow=(0.1, 0.3), bright=3500), -27, 0.0)
    d.wet.add(reply, trem(rng, [62, 63, 69], c7 - reply, grow=(0.3, 1.0), bright=2600), -19, 0.0)
    d.dry.add(reply + 0.1, timp(rng, 33, 0.9), -8, 0.0)
    d.wet.add(reply + 0.5, riser(rng, max(0.4, c7 - reply - 0.5)), -16, 0.0)

    # E · the knock: the big hit, then a pulse under the choice
    e = S['E'] = Sec(dur, stop=end0, over=0.05)
    e.dry.add(knock, brass(rng, [26, 33, 38, 39], 0.8, bright=1500), -3, 0.0)
    e.dry.add(knock, timp(rng, 26, 1.2), -3, 0.0)
    e.dry.add(knock, crash(rng, 0.9, 2.0), -10, 0.0)
    for i, t in enumerate(grid(knock + 0.5, end0, BEAT / 2)):
        e.dry.add(t, pizz(rng, [38, 38, 44, 38][i % 4], 0.45), -11, -0.1)
        if i % 2 == 0:
            e.dry.add(t, timp(rng, 33, 0.35), -12, 0.0)
    e.wet.add(knock + 0.4, saws(rng, [26, 38, 44], end0 - knock - 0.4, attack=0.3, release=0.3, bright=600), -16, 0.0)

    # I · «возьми с собой»: a celesta tune, then A7 for the loop back into D minor
    end = S['I'] = Sec(dur, gain=((end0, -3.0), (dur, -6.0)))
    mid = end0 + (dur - end0) * 0.55
    end.wet.add(end0, saws(rng, [38, 45, 50, 53], mid - end0 + 0.3, attack=0.4, release=0.5, bright=1100), -14, 0.0)
    end.wet.add(mid, saws(rng, [45, 49, 52, 55], max(0.4, dur - mid - 0.4), attack=0.3, release=0.3, bright=1000), -15, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.3, 77), (0.6, 81), (0.9, 77), (1.5, 76), (1.8, 73)]):
        end.dry.add(end0 + 0.15 + dt, celesta(rng, m, 0.55), -9, 0.15)
    for t in grid(end0, dur - 0.2, BEAT):
        end.dry.add(t, pizz(rng, 38, 0.4), -14, 0.0)
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
