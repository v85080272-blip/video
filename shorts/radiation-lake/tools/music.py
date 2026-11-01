# Score for «Радиоактивное озеро», synthesised with numpy (48 kHz stereo, no samples, no third-party music). E minor, a
# beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json. A still dawn on the lake
# (a soft pad, a sleepy celesta) that the dosimeter's crack breaks with a stab and a tremolo; the film cliché gets a
# cheesy B-movie organ with a theremin glide and stops dead when the real lake comes back. The steps ride a pizzicato
# ostinato: stabs on the crosses, bubbles for swimming, a little fanfare for the fish, timpani with every oar stroke that
# drive to the shore, a walking bass in the yard, a playful figure in the shower. The end is warm (C, then B7), and B7
# leads back into the E minor the short starts in. The parts stay low or high and leave the middle to the voice.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, hp, room
from instruments import at, pizz, celesta, xylo, glock, saws, trem, timp, brass, crash, whistle, riser, Sec

BEAT = 0.6


def grid(t0, t1, step):
    return np.arange(t0, t1 - 1e-6, step)


def score(M, dur):
    A = M['A']
    rng = np.random.default_rng(11)
    S = {}
    crack, c2, off, c3, c4, c5, c6, c7, c8 = M['crack'], M['c2'], M['greenOff'], M['c3'], M['c4'], M['c5'], M['c6'], M['c7'], M['c8']
    row0, row1, land = M['row0'], M['row1'], M['land']

    # A · dawn on the lake: a soft pad, a sleepy celesta; two low knocks under the question; a riser into the crack
    a = S['A'] = Sec(dur, stop=crack, over=0.02)
    a.wet.add(0.0, saws(rng, [40, 47, 54, 59], crack + 0.2, attack=1.0, release=0.3, bright=700), -19, 0.0)
    for i, (dt, m) in enumerate([(0.3, 71), (0.9, 74), (1.5, 76), (2.4, 74), (3.0, 71), (3.6, 69), (4.2, 71)]):
        if dt < crack - 0.2:
            a.dry.add(dt, celesta(rng, m + 12, 0.35), -13, 0.25 if i % 2 else -0.25)
    for t in (A['L0w0'], A['L0w6']):
        a.dry.add(t, timp(rng, 40, 0.4), -10, 0.0)
        a.dry.add(t, pizz(rng, 52, 0.5), -8, -0.1)
    a.dry.add(crack - 1.0, riser(rng, 1.0), -14, 0.0)

    # B · «затрещал дозиметр»: a stab and a timpani hit, then a high tremolo and a heartbeat
    b = S['B'] = Sec(dur, stop=c2, over=0.03)
    b.dry.add(crack, brass(rng, [40, 46, 52, 58], 0.6, bright=2000), -3, 0.0)
    b.dry.add(crack, timp(rng, 40, 1.0), -1, 0.0)
    b.wet.add(crack, crash(rng, 0.6, 1.6), -12, 0.2)
    b.wet.add(crack + 0.1, trem(rng, [76, 77], c2 - crack + 0.1, grow=(0.6, 1.0), bright=2800), -15, 0.15)
    for t in grid(crack + 0.6, c2, BEAT * 2):
        b.dry.add(t, timp(rng, 40, 0.45), -9, 0.0)
        b.dry.add(t + 0.22, timp(rng, 40, 0.3), -12, 0.0)

    # C · «не светится, как в кино»: a cheesy B-movie organ and a theremin glide, cut dead when the real lake comes back;
    # «Радиацию не видно»: only a thin, cold tremolo
    c = S['C'] = Sec(dur, stop=off, dead=True, over=0.02)
    c.wet.add(c2, saws(rng, [52, 56, 59, 63], off - c2 + 0.2, attack=0.15, release=0.2, bright=2600, vib=0.008), -14, 0.0)
    c.dry.add(c2 + 0.1, whistle(rng, 600, 1100, off - c2 - 0.1, vib=6.5), -16, 0.3)
    c.dry.add(A['L2w2'] + 0.05, brass(rng, [52, 53], 0.25, bright=1400), -8, 0.0)
    cc = S['C2'] = Sec(dur, stop=c3, over=0.03)
    cc.wet.add(off + 0.05, trem(rng, [83, 84], c3 - off, grow=(0.2, 0.7), bright=3200), -19, -0.2)
    cc.dry.add(off + 0.05, pizz(rng, 40, 0.7), -5, 0.0)
    cc.dry.add(A['L2w9'], glock(rng, 88, 0.5, 1.6), -12, 0.2)

    # D · step one, «не прыгай»: the ostinato starts; a stab on the cross; bubbles for swimming; a stab on «наглотаешься»
    pat = [40, 52, 40, 52, 43, 55, 42, 54]
    d = S['D'] = Sec(dur, gain=((c3, -2.0), (c4, -2.0)))
    for i, t in enumerate(grid(c3, c4, BEAT / 2)):
        d.dry.add(t, pizz(rng, pat[i % 8], 0.65), -4, -0.1)
    d.dry.add(A['L3w2'] + 0.04, brass(rng, [52, 53], 0.25, bright=1400), -7, 0.0)
    for i, m in enumerate([88, 86, 83, 81, 79, 76]):
        d.dry.add(A['L3w5'] + 0.1 + i * 0.11, xylo(rng, m, 0.4), -12, 0.3 - i * 0.1)
    d.dry.add(A['L3w9'] + 0.1, brass(rng, [52, 53], 0.25, bright=1400), -8, 0.0)

    # E · step two, the fish: a bite, a little fanfare as he lifts it, the cross; «уже не смыть»: a low drone and cold bells
    e = S['E'] = Sec(dur, gain=((c4, -2.0), (A['L4w10'], -3.0), (c5, -4.0)))
    for i, t in enumerate(grid(c4, A['L4w10'], BEAT / 2)):
        e.dry.add(t, pizz(rng, pat[i % 8], 0.6), -4, -0.1)
    for i, m in enumerate([64, 67, 71, 76]):
        e.dry.add(A['L4w4'] + i * 0.1, xylo(rng, m + 12, 0.5), -9, 0.2)
    e.dry.add(A['L4w9'] + 0.02, brass(rng, [52, 53], 0.25, bright=1400), -7, 0.0)
    e.wet.add(A['L4w10'] - 0.1, saws(rng, [40, 46], c5 - A['L4w10'] + 0.1, attack=0.3, release=0.4, bright=600), -14, 0.0)
    for i, m in enumerate([88, 87, 88, 83]):
        e.dry.add(A['L4w10'] + i * 0.3, glock(rng, m, 0.4, 1.4), -13, (i - 1.5) * 0.2)

    # F · step three, the oars: the ostinato drives, a timpani hit on every stroke, a riser to the shore; the dose falls:
    # the music opens into G major as he gets away
    f = S['F'] = Sec(dur, gain=((c5, -2.0), (row1, 0.0), (A['L5e'], -3.0), (c6, -4.0)))
    for i, t in enumerate(grid(c5, land, BEAT / 2)):
        f.dry.add(t, pizz(rng, pat[i % 8], 0.75), -3, -0.1)
        if i % 2:
            f.dry.add(t, pizz(rng, 71 if (i // 8) % 2 == 0 else 72, 0.35), -10, 0.3)
    for t in M['strokes']:
        f.dry.add(t, timp(rng, 40, 0.6), -6, 0.0)
    f.wet.add(row0, trem(rng, [64, 65], row1 - row0, grow=(0.2, 0.9), bright=2400), -15, -0.1)
    f.dry.add(row1 - 1.0, riser(rng, 1.0), -12, 0.0)
    f.dry.add(land, timp(rng, 43, 0.8), -4, 0.0)
    f.wet.add(land, saws(rng, [43, 50, 55, 59], c6 - land, attack=0.4, release=0.5, bright=900), -16, 0.0)
    for i, t in enumerate(grid(land + 0.1, c6, BEAT / 2)):
        f.dry.add(t, pizz(rng, [43, 55, 47, 55][i % 4], 0.55), -6, -0.1)
    for i, m in enumerate([67, 71, 74, 79]):
        f.dry.add(A['L5w15'] - 0.05 + i * 0.12, celesta(rng, m + 12, 0.55), -9, 0.2)

    # G · step four, the yard: a walking bass, a whoosh of brass as the jacket flies, a small fanfare on «90 %»
    g = S['G'] = Sec(dur, gain=((c6, -3.0), (c7, -4.0)))
    walk = [40, 43, 45, 47, 48, 47, 45, 43]
    for i, t in enumerate(grid(c6, c7, BEAT / 2)):
        g.dry.add(t, pizz(rng, walk[i % 8], 0.6), -5, -0.1)
    g.wet.add(c6, saws(rng, [52, 55, 59], c7 - c6, attack=0.6, release=0.5, bright=800), -19, 0.0)
    for t in (M['jacket'] + 0.1, M['boots'] + 0.1):
        g.dry.add(t, xylo(rng, 79, 0.5), -10, 0.2)
    for i, m in enumerate([67, 71, 74]):
        g.dry.add(A['L6w10'] - 0.1 + i * 0.12, brass(rng, [m - 12, m], 0.3, bright=1800), -11, 0.0)

    # H · step five, the shower: a playful celesta and pizzicato; ticks get notes, a stab on the conditioner
    h = S['H'] = Sec(dur, gain=((c7, -3.0), (c8, -3.0)))
    for i, t in enumerate(grid(c7, c8, BEAT / 2)):
        h.dry.add(t, pizz(rng, [40, 52, 47, 52][i % 4], 0.55), -6, -0.1)
    fig = [76, 79, 83, 79]
    for i, t in enumerate(grid(c7 + BEAT / 2, A['L7w8'], BEAT)):
        h.dry.add(t, celesta(rng, fig[i % 4] + 12, 0.35), -13, 0.3 if i % 2 else -0.3)
    for t, m in [(A['L7w3'], 84), (A['L7w5'], 88)]:
        h.dry.add(t, glock(rng, m, 0.6, 1.2), -10, 0.2)
    h.dry.add(A['L7w8'] + 0.05, brass(rng, [52, 53], 0.25, bright=1400), -7, 0.0)

    # I · «Подписывайся…»: warm C with a celesta tune, then B7sus4 → B7 for the loop back into E minor
    end = S['I'] = Sec(dur, gain=((A['L8'], -3.0), (dur, -6.0)))
    mid = A['L8'] + 0.55 * (dur - A['L8'])
    end.wet.add(A['L8'], saws(rng, [48, 55, 60, 64], mid - A['L8'] + 0.3, attack=0.4, release=0.5, bright=1200), -14, 0.0)
    end.wet.add(mid, saws(rng, [47, 52, 54, 57], max(0.4, dur - mid - 0.6), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end.wet.add(dur - 0.5, saws(rng, [47, 51, 54, 57], 0.4, attack=0.1, release=0.4, bright=1000), -17, 0.0)
    for i, (dt, m) in enumerate([(0.0, 76), (0.3, 79), (0.6, 84), (0.9, 83), (1.5, 79), (1.8, 78)]):
        end.dry.add(A['L8'] + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end.dry.add(A['L8'], pizz(rng, 36, 0.8), -3, 0.0)
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
