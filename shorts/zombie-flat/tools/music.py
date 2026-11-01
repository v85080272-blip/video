# Score for «Правило №6», synthesised with numpy (48 kHz stereo, no samples, no third-party music). 120 BPM, a beat is
# 0.5 s. D minor while the zombie comes: a sneaky pizzicato and celesta, a music-box shimmer for the moon, a bass that
# creeps up a semitone with every step he climbs, a two-note ostinato and tremolo strings under the loom, then dead silence.
# The hiss is a dim-chord hit; a xylophone runs down the stairs with him, one note a step, and the door slam stops the
# music. D major for the smug cat: the stamp, a walking bass, a xylophone note per letter, a sour note for the crooked А,
# a slide whistle for its fall and flight, a bell when it clicks into place; a warm pad and a celesta question at the end
# that settle on A7, the dominant of the D minor the short (and its loop) starts in.
# usage: python3 tools/music.py build/cues.json build/music.wav
import json
import sys

import numpy as np
import soundfile as sf

from sfx import SR, TAU, n_, tt, lp, hp, bp, peak, colored, white, env, fade, partials, sweep, harm, room, verb, pan

BEAT = 0.5


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def at(t):
    return int(round(t * SR))


class Bus:
    def __init__(self, sec, tail=4.0):
        self.y = np.zeros((2, at(sec + tail)))

    def add(self, t, x, gain_db=0.0, p=0.0):
        x = np.asarray(x, float)
        if x.ndim == 1:
            x = pan(x, p)
        i = at(t)
        if i < 0:
            x, i = x[:, -i:], 0
        j = min(self.y.shape[1], i + x.shape[1])
        if j > i:
            self.y[:, i:j] += x[:, :j - i] * 10 ** (gain_db / 20)


# ——————————————————————————— instruments ———————————————————————————
def pizz(rng, m, vel=1.0, cents=0.0):
    """a plucked string: bright harmonics that die fast over a rounder fundamental, a finger click, a wooden body"""
    f = mtof(m) * 2 ** (cents / 1200)
    sec = float(np.clip(0.75 * (196 / f) ** 0.4, 0.3, 1.4))
    t = tt(sec)
    y = np.zeros(len(t))
    for h in range(1, int(min(28, 9000 / f)) + 1):
        y += (1 / h ** 1.1) * np.sin(TAU * f * h * t + rng.uniform(0, TAU)) * np.exp(-t / (sec * 0.32 / (1 + 0.5 * (h - 1))))
    y *= np.minimum(1, t / 0.0025)
    y += bp(white(rng, sec), 1200, 5000) * env(sec, 0.0003, 0.004) * 0.25
    y = peak(peak(y, 280, 1.4, 4), 950, 2.0, 2)
    return fade(y * 0.32 * vel, 0.0005, 0.04)


def celesta(rng, m, vel=1.0, sec=1.8):
    f = mtof(m)
    k = (523 / f) ** 0.35
    y = partials(sec, [f, 2 * f, 3 * f, 4.17 * f], [0.85 * k, 0.28 * k, 0.12 * k, 0.07 * k], [1, 0.22, 0.06, 0.16], rng, 0.0015)
    y *= np.minimum(1, tt(sec) / 0.0015)
    y += bp(white(rng, sec), 2000, 8000) * env(sec, 0.0002, 0.0025) * 0.15
    return fade(y * 0.3 * vel, 0.0003, 0.08)


def xylo(rng, m, vel=1.0, cents=0.0):
    """a hard-mallet bar tuned like a xylophone: the fundamental, the twelfth above it and a dry click"""
    f = mtof(m) * 2 ** (cents / 1200)
    sec = 0.5
    y = partials(sec, [f, 3.0 * f, 9.2 * f], [0.16, 0.05, 0.02], [1, 0.35, 0.1], rng, 0.002)
    y *= np.minimum(1, tt(sec) / 0.0008)
    y += bp(white(rng, sec), 1500, 7000) * env(sec, 0.0002, 0.0018) * 0.3
    return fade(y * 0.34 * vel, 0.0003, 0.04)


def glock(rng, m, vel=1.0, sec=2.4):
    """the bell for the А: steel bar partials, long and bright"""
    f = mtof(m)
    y = partials(sec, [f, 2.76 * f, 5.40 * f, 8.93 * f], [1.3, 0.45, 0.2, 0.1], [1, 0.38, 0.18, 0.08], rng, 0.001)
    y *= np.minimum(1, tt(sec) / 0.0006)
    y += bp(white(rng, sec), 3000, 10000) * env(sec, 0.0002, 0.002) * 0.2
    return fade(y * 0.3 * vel, 0.0003, 0.1)


def saws(rng, notes, dur, attack=0.3, release=0.4, bright=1500.0, detune=(-0.005, 0.0, 0.0052), spread=0.7, vib=0.0022):
    """an ensemble: detuned saw voices per note spread across the stereo field (strings, pads)"""
    t = tt(dur + release * 3)
    out = np.zeros((2, len(t)))
    for m in notes:
        f0 = mtof(m)
        for k, dt in enumerate(detune):
            p = spread * (k - (len(detune) - 1) / 2) / max(1, (len(detune) - 1) / 2)
            v = 1 + vib * np.sin(TAU * (4.8 + 0.4 * k) * t + rng.uniform(0, TAU))
            ph = TAU * f0 * (1 + dt) * np.cumsum(v) / SR
            s = sum(np.sin(h * ph + rng.uniform(0, TAU)) / h ** 1.15 * np.exp(-f0 * h / bright) for h in range(1, int(7000 / f0) + 1))
            out += pan(s, p)
    e = np.minimum(1, t / attack) ** 1.5 * np.where(t < dur, 1.0, np.exp(-(t - dur) / release))
    return out * e / (len(notes) * len(detune) * 0.6)


def trem(rng, notes, dur, rate=13.0, attack=0.15, release=0.12, grow=(0.3, 1.0), bright=2600.0):
    """tremolo strings: the ensemble bowed fast, swelling from grow[0] to grow[1]"""
    x = saws(rng, notes, dur, attack, release, bright, detune=(-0.006, -0.002, 0.003, 0.007), spread=0.8, vib=0.003)
    t = tt(x.shape[1] / SR)
    bow = 0.45 + 0.55 * np.abs(np.sin(np.pi * rate * t + 0.3 * np.sin(TAU * 1.3 * t)))
    swell = np.interp(t, [0, dur], list(grow))
    return x * bow * swell


def timp(rng, m, vel=1.0):
    f = mtof(m)
    sec = 1.6
    t = tt(sec)
    fs = f * (1 + 0.1 * np.exp(-t / 0.02))
    y = np.sin(TAU * np.cumsum(fs) / SR) * np.exp(-t / 0.55) + partials(sec, [1.504 * f, 1.742 * f, 2.0 * f], [0.3, 0.22, 0.15], [0.5, 0.3, 0.2], rng)
    y += lp(white(rng, sec), 1100) * env(sec, 0.0005, 0.012) * 0.7
    return fade(np.tanh(1.2 * y) * 0.6 * vel, 0.0005, 0.1)


def brass(rng, notes, dur=0.6, bright=2600.0):
    """a stab: detuned saws scooping up into pitch under a closing filter"""
    t = tt(dur + 0.6)
    y = np.zeros(len(t))
    cut = 350 + bright * np.exp(-t / 0.22)
    for m in notes:
        f = mtof(m)
        for dt in (-0.006, 0.0, 0.006):
            ph = TAU * np.cumsum(f * (1 + dt) * (1 - 0.03 * np.exp(-t / 0.035))) / SR + rng.uniform(0, TAU)
            for h in range(1, int(5000 / f) + 1):
                y += np.sin(h * ph) / h * np.exp(-f * h / cut)
    e = np.minimum(1, t / 0.012) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.18)) * (0.55 + 0.45 * np.exp(-t / 0.25))
    return fade(np.tanh(0.8 * y * e / len(notes)), 0.001, 0.05)


def crash(rng, vel=1.0, sec=2.0):
    t = tt(sec)
    y = hp(white(rng, sec), 3500) * np.exp(-t / 0.55) + 0.4 * bp(white(rng, sec), 1500, 4000) * np.exp(-t / 0.2)
    y += 0.12 * partials(sec, [3313, 3967, 4721, 5873, 6311, 7207], [0.22, 0.18, 0.15, 0.12, 0.1, 0.09], [1, 0.7, 0.8, 0.6, 0.5, 0.5], rng, 0.01)
    return fade(y * np.minimum(1, t / 0.001) * 0.3 * vel, 0.0005, 0.2)


def whistle(rng, f0, f1, sec, vib=5.5):
    """a slide whistle: a breathy sine gliding exponentially"""
    t = tt(sec)
    k = t / sec
    f = f0 * (f1 / f0) ** k * (1 + 0.012 * np.sin(TAU * vib * t))
    y = np.sin(TAU * np.cumsum(f) / SR) + 0.05 * np.sin(2 * TAU * np.cumsum(f) / SR)
    breath = bp(white(rng, sec), 1500, 6000) * 0.04
    e = np.minimum(1, t / 0.02) * np.minimum(1, (sec - t) / 0.03)
    return fade((y + breath) * e * 0.3, 0.003, 0.02)


def riser(rng, sec):
    t = tt(sec)
    k = t / sec
    noise = bp(colored(rng, sec, -1), 300, 7000) * k ** 2
    tone = harm(sweep(sec, 110, 440), 12, 1.2) * k ** 2.5 * 0.15
    return fade(lp(noise * 0.25 + tone, 2500 + 4000 * k[-1]), 0.05, 0.01)


def choke(y, t, over=0.02):
    """stop dead at t: a short fade, then silence"""
    i, k = at(t), at(over)
    y[:, i:i + k] *= np.linspace(1, 0, k)
    y[:, i + k:] = 0


class Sec:
    """one section of the score: a dry bus (short room) and a wet one (long room); it may stop dead at `stop`, with its
    reverb (dead=True: silence right after) or before it (the room still rings out)"""
    def __init__(self, dur, stop=None, dead=False, over=0.02, gain=((0, 0.0),)):
        self.dry, self.wet, self.stop, self.dead, self.over, self.gain = Bus(dur), Bus(dur), stop, dead, over, gain

    def render(self, rooms):
        d, w = self.dry.y.copy(), self.wet.y.copy()
        if self.stop is not None and not self.dead:
            choke(d, self.stop, self.over); choke(w, self.stop, self.over)
        y = verb(d, rooms[0], 0.12)[:, :d.shape[1]] + verb(w, rooms[1], 0.22)[:, :w.shape[1]]
        if self.stop is not None and self.dead:
            choke(y, self.stop, self.over)
        t = np.arange(y.shape[1]) / SR                       # the section's level over time: the arc of the whole short
        return y * 10 ** (np.interp(t, [p[0] for p in self.gain], [p[1] for p in self.gain]) / 20)


# ——————————————————————————— the score ———————————————————————————
def score(M, dur):
    rng = np.random.default_rng(6)
    S = {}

    # A · 0–2: Батон on guard. Celesta on the word pops, a sneaky pizzicato, tremolo shivers with the caption
    a = S['A'] = Sec(dur, gain=((0, -2.0),))
    for t, m in [(0.0, 74), (0.25, 77), (0.5, 81)]:
        a.dry.add(t, celesta(rng, m, 0.9), -2, 0.15)
    for t, m, v in [(0.0, 38, 1.0), (0.0, 50, 0.7), (0.5, 57, 0.55), (1.0, 33, 0.9), (1.0, 53, 0.6), (1.5, 52, 0.55)]:
        a.dry.add(t, pizz(rng, m, v), 0, -0.1 if m < 45 else 0.2)
    sh = S['shiver'] = Sec(dur, stop=1.95, gain=((0, -2.0),))
    sh.wet.add(1.2, trem(rng, [74, 75], 0.75, grow=(0.1, 1.0)), -10, 0.0)

    # B–D · 2–10: the reveal, the climb, the loom; everything stops dead at 10
    c = S['C'] = Sec(dur, stop=10.0, dead=True, over=0.03, gain=((2.0, -8.0), (3.5, -8.0), (7.5, -4.0), (9.9, 0.0)))
    # the reveal under the moon: a soft timpani, a low drone that grows until the silence, a music-box shimmer
    c.wet.add(2.0, saws(rng, [38, 45], 8.0, attack=6.0, release=0.05, bright=600), -18, 0.0)
    c.dry.add(2.55, timp(rng, 38, 0.6), -4, 0.0)
    c.wet.add(2.55, saws(rng, [50, 56], 0.9, attack=0.05, release=0.6, bright=1200), -14, 0.0)
    for i in range(12):
        c.dry.add(2.55 + i * 0.0625, celesta(rng, 86 if i % 2 == 0 else 80, 0.55 * (1 - i / 14), 1.2), -6, 0.35)
    # the climb: a bass note on every step, a semitone higher each time; a high pizz ticks between them
    for i, m in enumerate(range(38, 46)):
        t = 3.5 + i * BEAT
        c.dry.add(t, pizz(rng, m, 0.95), -1, -0.05)
        c.dry.add(t, pizz(rng, m + 12, 0.55), -3, 0.05)
        c.dry.add(t + BEAT / 2, pizz(rng, 69, 0.3 + 0.03 * i), -6, 0.3)
    # the loom: two notes a semitone apart, closer and closer; tremolo strings and a riser
    ost = [7.5, 8.0, 8.5, 9.0, 9.25, 9.5, 9.625, 9.75, 9.8125, 9.875, 9.9375]
    for i, t in enumerate(ost):
        m = 45 if i % 2 == 0 else 46
        c.dry.add(t, pizz(rng, m, 0.8 + 0.02 * i), -1, -0.05)
        c.dry.add(t, pizz(rng, m + 12, 0.5), -4, 0.05)
    c.wet.add(7.5, trem(rng, [69, 70], 2.5, grow=(0.25, 1.0)), -9, -0.1)
    c.wet.add(8.75, trem(rng, [81, 82], 1.25, grow=(0.2, 1.0)), -13, 0.15)
    c.dry.add(8.5, riser(rng, 1.5), -9, 0.0)

    # F · 11–12.86: the hiss. A diminished stab, timpani, a crash; trembling low strings; the arm bounces; a double take
    f = S['F'] = Sec(dur, gain=((11.0, -1.0), (11.35, -3.0)))
    f.dry.add(11.0, brass(rng, [50, 53, 56, 59, 62], 0.55), -2, 0.0)
    f.dry.add(11.0, timp(rng, 38, 1.0), -1, 0.0)
    f.wet.add(11.0, crash(rng, 0.9), -6, 0.2)
    f.wet.add(11.3, trem(rng, [50, 56], 1.5, rate=11, grow=(0.6, 0.35), bright=1800), -11, 0.0)
    for t, m in [(11.6, 79), (11.9, 76), (12.18, 73)]:
        f.dry.add(t, xylo(rng, m, 0.8), -3, 0.4)
    f.dry.add(12.05, pizz(rng, 45, 0.8), -2, -0.1)                  # «doo… DOO?»
    f.dry.add(12.42, pizz(rng, 57, 0.9), -2, -0.1)
    f.dry.add(12.58, whistle(rng, 380, 1250, 0.28), -10, 0.1)        # gathers himself and…

    # G · 12.86–15.93: the run. A note a step, down the stairs; timpani on the beat; low strings; up into the door
    g = S['G'] = Sec(dur, stop=15.93, dead=True, over=0.015, gain=((12.86, -3.0), (15.9, 0.0)))
    notes = [81, 79, 77, 76, 74, 73] + [74, 69, 74, 69, 74, 69] + [69, 67, 65, 64, 62, 61, 58] + [57, 58, 59, 60, 61]
    for t, m in zip(M['RUN'], notes):
        g.dry.add(t, xylo(rng, m, 0.7), -4, 0.25)
        g.dry.add(t, pizz(rng, m - 12, 0.45), -6, -0.15)
    g.dry.add(13.0, brass(rng, [50, 53, 57, 62], 0.25), -6, 0.0)
    for i, t in enumerate(np.arange(13.0, 15.9, BEAT)):
        g.dry.add(t, timp(rng, 38 if i % 2 == 0 else 33, 0.65), -5, 0.0)
    g.wet.add(13.0, trem(rng, [38, 50], 2.93, rate=12, grow=(0.5, 1.0), bright=1500), -12, 0.0)
    g.dry.add(M['GRAB_T'], celesta(rng, 86, 0.6), -6, 0.3)
    s = S['slam'] = Sec(dur)
    s.dry.add(15.93, timp(rng, 38, 1.0), -2, 0.0)
    s.dry.add(15.93, brass(rng, [38, 50, 57, 62], 0.3), -5, 0.0)

    # H · 16–19.5: D major. The stamp, a walking bass with off-beat chords, a xylophone note per letter (the А is sour)
    h = S['H'] = Sec(dur, gain=((16.0, -3.0),))
    h.dry.add(M['T_STAMP'], brass(rng, [50, 54, 57, 62], 0.35, bright=2200), -5, 0.0)
    h.dry.add(M['T_STAMP'], timp(rng, 38, 0.8), -4, 0.0)
    for t, m in [(16.5, 38), (17.0, 42), (17.5, 45), (18.0, 47)]:
        h.dry.add(t, pizz(rng, m, 0.9), -1, -0.1)
    for t in (16.75, 17.25, 17.75, 18.25):
        for m in (54, 57):
            h.dry.add(t, pizz(rng, m, 0.42), -5, 0.2)
    for i, (t, m) in enumerate(zip(M['LETTER_T'], [74, 76, 78, 79, 81, 83, 81, 83, 85, 86])):
        h.dry.add(t, xylo(rng, m, 0.8, cents=-70 if i == 9 else 0), -3, (i % 5 - 2) * 0.12)
    h.dry.add(18.35, whistle(rng, 1150, 300, 0.17), -9, -0.2)          # the А falls…
    h.dry.add(M['T_A_KICK'], whistle(rng, 330, 1180, 0.24), -10, -0.1)  # …and flies back
    h.dry.add(M['T_A_SNAP'], glock(rng, 86, 0.9), -4, 0.0)               # click: in place
    h.dry.add(M['T_A_SNAP'], celesta(rng, 74, 0.6), -6, -0.2)
    h.dry.add(M['T_A_SNAP'], celesta(rng, 81, 0.6), -6, 0.2)
    h.dry.add(M['T_A_SNAP'], pizz(rng, 38, 0.9), -2, 0.0)
    h.dry.add(M['T_A_SNAP'], pizz(rng, 50, 0.6), -4, 0.0)

    # I · 19.5–22.5: he looks at us. A warm Dmaj7, the celesta asks the question, then A7sus4 → A7 for the loop
    e = S['I'] = Sec(dur, gain=((19.5, -4.0), (22.5, -8.0)))
    e.wet.add(19.55, saws(rng, [50, 54, 57, 61], 2.0, attack=0.5, release=0.5, bright=1300), -12, 0.0)
    e.wet.add(21.5, saws(rng, [45, 50, 52, 55], 0.5, attack=0.15, release=0.2, bright=1100), -14, 0.0)
    e.wet.add(22.0, saws(rng, [45, 49, 52, 55], 0.3, attack=0.1, release=0.35, bright=1000), -16, 0.0)
    for t, m, v in [(20.0, 78, 0.8), (20.25, 81, 0.8), (20.5, 86, 0.75), (20.75, 85, 0.85), (21.25, 83, 0.45), (21.75, 81, 0.4)]:
        e.dry.add(t, celesta(rng, m, v), -4, 0.1)
    for t, m in [(21.3, 90), (21.36, 93)]:                          # the smile twinkles
        e.dry.add(t, celesta(rng, m, 0.35, 1.0), -9, 0.3)
    e.dry.add(20.0, pizz(rng, 38, 0.7), -3, 0.0)
    e.dry.add(21.5, pizz(rng, 33, 0.6), -4, 0.0)
    return S, rng


def main():
    cues, out = sys.argv[1], sys.argv[2]
    D = json.load(open(cues))
    dur, M = D['duration'], D['marks']
    S, rng = score(M, dur)
    rooms = (room(rng, 0.9, damp=6000, width=0.7), room(rng, 2.0, damp=4500, width=0.9))
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
