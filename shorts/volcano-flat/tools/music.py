# Score for «Вулкан проснулся», synthesised with numpy (48 kHz stereo, no samples, no third-party music). D minor, a
# beat of 0.6 s (100 BPM), every section starting on the narrator's word from build/cues.json. A breath before the blast;
# the blast is a dark stab, then a drone and a heartbeat on the timpani. Each step of the five has its own colour: a
# pizzicato ostinato that drives into the lightning and stops dead before the strike; an airy pad and celesta for the
# wind and the map; timpani rolling with the mudflow; glassy bells for the ash; the ostinato again for the run to the
# car, cut by the door slam. The end is warm (B♭, then A7), and A7 leads back into the D minor the short starts in.
# The parts stay low (bass, timpani) or high (celesta, bells) and leave the middle to the voice.
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
    te, c2, strike, c5, c6, c7, c8 = M['te'], M['c2'], M['strike'], M['c5'], M['c6'], M['c7'], M['c8']

    # A · the cover and the first half second: a thin high shimmer, the mountain holding its breath
    a = S['A'] = Sec(dur, stop=te, over=0.01)
    a.wet.add(0.0, trem(rng, [86, 87], te + 0.1, grow=(0.05, 0.7), bright=3200), -22, 0.2)
    # «Как выжить при взрыве вулкана?»: two soft low knocks under the question, a riser into the blast
    for t in (A.get('L0w0', 0.12), A.get('L0w2', 0.75)):
        a.dry.add(t, timp(rng, 38, 0.4), -10, 0.0)
        a.dry.add(t, pizz(rng, 50, 0.5), -8, -0.1)
    if te > 1.4:
        a.dry.add(te - 1.3, riser(rng, 1.3), -11, 0.0)

    # B · the blast and «Вулкан проснулся… Опасно другое»: a dark stab, a drone that grows, a heartbeat
    b = S['B'] = Sec(dur, gain=((te, 0.0), (te + 1.0, -2.0)))
    b.dry.add(te, brass(rng, [38, 45, 50, 53], 0.9, bright=1800), -2, 0.0)
    b.dry.add(te, timp(rng, 38, 1.0), 0, 0.0)
    b.wet.add(te, crash(rng, 0.8, 2.4), -8, 0.25)
    b.wet.add(te + 0.3, saws(rng, [38, 45], c2 - te + 0.2, attack=2.5, release=0.6, bright=650), -15, 0.0)
    for t in grid(te + 1.6, A['L2'], BEAT * 2):                     # a slow heartbeat under his first words
        b.dry.add(t, timp(rng, 38, 0.45), -9, 0.0)
        b.dry.add(t + 0.22, timp(rng, 38, 0.3), -12, 0.0)
    for i, t in enumerate(grid(A['L2'], c2 - 0.05, BEAT / 2)):     # «Лава сюда не дойдёт»: the ostinato wakes up
        b.dry.add(t, pizz(rng, [38, 50, 38, 53, 38, 50, 41, 52][i % 8], 0.55 + 0.02 * i), -5, -0.1)
    b.wet.add(A['L2w4'], trem(rng, [62, 63], c2 - A['L2w4'] + 0.1, grow=(0.2, 0.9), bright=2400), -15, 0.15)   # «Опасно другое»
    b.dry.add(A['L2w4'], timp(rng, 39, 0.7), -5, 0.0)

    # C · step one, «слезай с вышки»: the ostinato drives, timpani join on «молнии», a riser, then silence before the hit
    c = S['C'] = Sec(dur, stop=strike - 0.06, over=0.03, gain=((c2, -1.0), (A['L3w10'], 0.0), (strike - 0.1, 1.5)))
    c.dry.add(c2, brass(rng, [50, 57], 0.3, bright=1600), -9, 0.0)
    pat = [38, 50, 38, 50, 41, 53, 40, 52]
    for i, t in enumerate(grid(c2, strike, BEAT / 2)):
        c.dry.add(t, pizz(rng, pat[i % 8], 0.75), -3, -0.1)
        if i % 2:
            c.dry.add(t, pizz(rng, 69 if (i // 8) % 2 == 0 else 70, 0.35), -9, 0.3)
    for i, t in enumerate(grid(A['L3w10'], strike - 0.1, BEAT / 2)):
        c.dry.add(t, timp(rng, 38 if i % 2 == 0 else 45, 0.45 + 0.04 * i), -6, 0.0)
    c.wet.add(A['L3w10'], trem(rng, [62, 63], strike - A['L3w10'], grow=(0.2, 1.0), bright=2600), -13, -0.1)
    c.dry.add(strike - 1.4, riser(rng, 1.4), -8, 0.0)

    # D · the strike: a diminished stab, timpani and a crash; the low strings ring and die
    d = S['D'] = Sec(dur)
    d.dry.add(strike, brass(rng, [38, 44, 50, 56, 62], 0.7, bright=2400), -2, 0.0)
    d.dry.add(strike, timp(rng, 38, 1.0), -1, 0.0)
    d.wet.add(strike, crash(rng, 1.0, 2.6), -5, 0.0)
    d.wet.add(strike + 0.2, saws(rng, [38, 44], c5 - strike, attack=0.1, release=0.8, bright=700), -15, 0.0)

    # E · step two, the wind and the map: an airy pad, a celesta figure, the bass on the beats; the map's marks get notes
    e = S['E'] = Sec(dur, gain=((c5, -3.0), (M['mapOut'], -3.0), (c6, -5.0)))
    e.wet.add(c5, saws(rng, [50, 57, 62], c6 - c5, attack=1.2, release=0.8, bright=900), -18, 0.0)
    for i, t in enumerate(grid(c5, c6, BEAT)):
        e.dry.add(t, pizz(rng, [38, 45, 41, 45][i % 4], 0.6), -5, -0.1)
    fig = [74, 77, 81, 76]
    for i, t in enumerate(grid(c5 + BEAT / 2, M['mapOut'], BEAT)):
        e.dry.add(t, celesta(rng, fig[i % 4], 0.4, 1.2), -10, 0.3 if i % 2 else -0.3)
    e.dry.add(A['L4w3'] - 0.05, whistle(rng, 520, 880, 0.5), -20, 0.4)          # «ветер»: the arrow
    e.dry.add(A['L4w10'] + 0.35, brass(rng, [50, 51], 0.25, bright=1400), -10, 0.0)   # the red cross
    for t, m in [(A['L4w13'] - 0.05, 74), (A['L4w13'] + 0.1, 78), (A['L4w13'] + 0.25, 81)]:   # «поперёк»: the way out
        e.dry.add(t, celesta(rng, m, 0.6), -7, -0.2)
    e.dry.add(M['mapOut'] - 0.25, glock(rng, 86, 0.7, 1.6), -9, -0.2)

    # F · step three, the river: low tremolo as he looks down, the mudflow hits with a stab and timpani rolling faster;
    # «держись выше» climbs out of it
    f = S['F'] = Sec(dur, gain=((c6, -3.0), (M['lahar0'], 0.0), (M['up'], -2.0), (c7, -4.0)))
    for i, t in enumerate(grid(c6, M['down'], BEAT / 2)):
        f.dry.add(t, pizz(rng, [38, 50, 41, 53][i % 4], 0.55), -6, -0.1)
    f.dry.add(A['L5w4'], brass(rng, [50, 51], 0.25, bright=1400), -9, 0.0)          # the cross on the sign
    f.wet.add(M['down'], trem(rng, [38, 39], M['lahar0'] - M['down'] + 0.2, grow=(0.3, 1.0), bright=1500), -12, 0.0)
    f.dry.add(M['lahar0'], brass(rng, [38, 45, 50, 51], 0.6, bright=2000), -3, 0.0)
    f.dry.add(M['lahar0'], timp(rng, 38, 1.0), -1, 0.0)
    f.wet.add(M['lahar0'], crash(rng, 0.8, 2.0), -8, 0.3)
    f.wet.add(M['lahar0'], saws(rng, [38, 44], M['up'] - M['lahar0'], attack=0.3, release=0.6, bright=600), -14, 0.0)
    t, gap = M['lahar0'] + 0.3, 0.3                                # the roll speeds up as the mud comes on
    while t < M['up'] - 0.1:
        f.dry.add(t, timp(rng, 38 if gap > 0.16 else 45, 0.5), -6, 0.0)
        t += gap
        gap = max(0.1, gap * 0.9)
    f.wet.add(M['boatHit'], crash(rng, 0.6, 1.4), -10, -0.2)
    for i, m in enumerate([62, 65, 69, 74, 77]):                    # «держись выше по склону»
        f.dry.add(A['L5w15'] - 0.1 + i * 0.15, pizz(rng, m, 0.7), -5, 0.1)
        f.dry.add(A['L5w15'] - 0.1 + i * 0.15, xylo(rng, m + 12, 0.45), -11, 0.2)
    f.wet.add(A['L5w15'], saws(rng, [53, 57, 60], c7 - A['L5w15'], attack=0.4, release=0.6, bright=900), -17, 0.0)

    # G · step four, ash is glass: soft and eerie, glassy bells on «стекло», a small motif as he wets the scarf
    g = S['G'] = Sec(dur, gain=((c7, -4.0), (c8, -4.0)))
    g.wet.add(c7, saws(rng, [50, 53, 57], c8 - c7, attack=1.0, release=0.6, bright=800), -19, 0.0)
    for i, t in enumerate(grid(c7, c8, BEAT)):
        g.dry.add(t, pizz(rng, [38, 45, 46, 45][i % 4], 0.5), -6, -0.1)
    for i, m in enumerate([86, 89, 93, 91, 96]):
        g.dry.add(A['L6w5'] - 0.05 + i * 0.07, glock(rng, m, 0.5, 1.4), -12, (i - 2) * 0.15)
    for i, m in enumerate([62, 65, 64, 62]):                         # «закрой нос и рот»
        g.dry.add(A['L6w6'] + i * BEAT / 2, celesta(rng, m + 12, 0.45), -10, 0.2)
    g.dry.add(A['L6w12'] + 0.4, celesta(rng, 86, 0.6), -8, 0.0)       # the goggles on

    # H · step five, the run to the car: the ostinato and the timpani again, ticks for the car and the hut, the slam cuts it
    h = S['H'] = Sec(dur, stop=M['slam'], dead=True, over=0.02, gain=((c8, -2.0), (M['slam'] - 0.1, 0.0)))
    for i, t in enumerate(grid(c8, M['slam'], BEAT / 2)):
        h.dry.add(t, pizz(rng, pat[i % 8], 0.75), -3, -0.1)
        if i % 2 == 0:
            h.dry.add(t, timp(rng, 38 if i % 4 == 0 else 45, 0.5), -7, 0.0)
    h.wet.add(c8, trem(rng, [57, 58], M['slam'] - c8, grow=(0.3, 0.9), bright=2200), -15, 0.1)
    h.dry.add(A['L7w3'] + 0.1, celesta(rng, 81, 0.6), -8, 0.2)
    sl = S['slam'] = Sec(dur)
    sl.dry.add(M['slam'], timp(rng, 38, 0.9), -3, 0.0)
    sl.dry.add(M['slam'], brass(rng, [38, 50, 57], 0.3, bright=1600), -7, 0.0)
    sl.wet.add(M['slam'] + 0.15, saws(rng, [50, 57, 62], A['L8'] - M['slam'], attack=0.6, release=0.5, bright=800), -19, 0.0)
    sl.dry.add(A['L7w7'] + 0.1, celesta(rng, 86, 0.6), -8, -0.3)

    # I · «Подписывайся…»: warm B♭ with a celesta tune, then A7sus4 → A7 for the loop back into the blast
    end = S['I'] = Sec(dur, gain=((A['L8'], -3.0), (dur, -6.0)))
    end.wet.add(A['L8'], saws(rng, [46, 53, 58, 62], A['L8w5'] - A['L8'] + 0.3, attack=0.4, release=0.5, bright=1200), -14, 0.0)
    end.wet.add(A['L8w5'], saws(rng, [45, 50, 52, 55], max(0.4, dur - A['L8w5'] - 0.6), attack=0.3, release=0.3, bright=1100), -15, 0.0)
    end.wet.add(dur - 0.5, saws(rng, [45, 49, 52, 55], 0.4, attack=0.1, release=0.4, bright=1000), -17, 0.0)
    for i, (dt, m) in enumerate([(0.0, 74), (0.3, 77), (0.6, 81), (0.9, 79), (1.5, 77), (1.8, 76)]):
        end.dry.add(A['L8'] + 0.15 + dt, celesta(rng, m, 0.55), -8, 0.15)
    end.dry.add(A['L8'], pizz(rng, 34, 0.8), -3, 0.0)
    end.dry.add(A['L8w5'], pizz(rng, 33, 0.7), -4, 0.0)
    for t in grid(A['L8'] + 0.6, dur - 0.1, BEAT):
        end.dry.add(t, timp(rng, 38, 0.3), -12, 0.0)
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
