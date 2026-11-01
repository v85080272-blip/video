# Instruments of the score (copied from shorts/zombie-flat/tools/music.py): plucked strings, celesta, xylophone, bells,
# saw ensembles and tremolo strings, timpani, brass stabs, a crash, a riser; Bus and Sec mix them with rooms.
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


