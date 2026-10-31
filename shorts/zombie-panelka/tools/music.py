# Score for «Зомби в панельке», synthesised with numpy (48 kHz stereo, no samples, no third-party music).
# A D-minor tick-tock groove whose tempo is fitted per step so that every slam lands on a downbeat; each step adds a layer,
# the last beat before a slam drops out into a reverse swell, the pot gag stops the music dead, a riser and a double-time
# countdown end in a tape stop when the power dies. After the blackout: a warm chord for «Ты успел», a dark drone and a
# detuned music box under баба Валя that bends down when the shadow appears and dies at the reveal.
# usage: python3 tools/music.py build/cues.json build/music.wav [stems dir]
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal

from sfx import SR, TAU, n_, tt, lp, hp, bp, colored, white, env, fade, partials, sweep, room, verb, pan


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def at(t):
    return int(round(t * SR))


class Bus:
    def __init__(self, sec):
        self.y = np.zeros((2, at(sec) + 6 * SR))

    def add(self, t, x, gain_db=0.0, p=0.0):
        x = np.asarray(x, float)
        if x.ndim == 1:
            x = pan(x, p)
        i = at(t)
        j = min(self.y.shape[1], i + x.shape[1])
        if j > i:
            self.y[:, i:j] += x[:, :j - i] * 10 ** (gain_db / 20)


# ——————————————————————————— instruments ———————————————————————————
def kick(rng):
    sec = 0.45
    t = tt(sec)
    f = 46 + 120 * np.exp(-t / 0.028)
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = hp(white(rng, sec), 2000) * env(sec, 0.0002, 0.003) * 0.4
    return fade(np.tanh(1.8 * body) * 0.85 + click, 0.0003, 0.04)


def clap(rng):
    sec = 0.35
    t = tt(sec)
    x = bp(white(rng, sec), 900, 6000)
    e = np.zeros_like(t)
    for d in (0.0, 0.009, 0.019):
        e += (t >= d) * np.exp(-np.maximum(0, t - d) / 0.006)
    e += 0.6 * (t >= 0.025) * np.exp(-np.maximum(0, t - 0.025) / 0.07)
    body = np.sin(TAU * 185 * t) * np.exp(-t / 0.04) * 0.3
    return fade((x * e + body) * 0.6, 0.0005, 0.05)


def hat(rng):
    sec = 0.08
    t = tt(sec)
    metal = np.sign(np.sin(TAU * 4170 * t)) * np.sign(np.sin(TAU * 6310 * t))
    x = hp(white(rng, sec), 7000) + 0.3 * hp(metal, 6000)
    return fade(x * np.exp(-t / 0.014) * 0.35, 0.0003, 0.02)


def clock(rng, hi=True):
    sec = 0.12
    fr = [2930, 4410, 6020] if hi else [1960, 2980, 4130]
    y = partials(sec, fr, [0.018, 0.012, 0.007], [1, 0.45, 0.2], rng)
    y = y + bp(white(rng, sec), 1500, 8000) * env(sec, 0.0002, 0.002) * 0.6
    return fade(y * 0.5, 0.0002, 0.02)


def bass(rng, m, dur, bright=1.0):
    """plucky saw bass: each harmonic falls from bright to a dark resting level (a filter envelope, additively)"""
    f = mtof(m)
    t = tt(dur + 0.08)
    y = 0.6 * np.sin(TAU * f * t)
    for h in range(1, int(min(40, 5000 / f)) + 1):
        fh = f * h
        rest = np.exp(-fh / 380)
        tau = 0.04 + 0.1 / (1 + fh / 600)
        y = y + (rest + (1 - rest) * bright * np.exp(-t / tau)) / h * np.sin(TAU * fh * t + rng.uniform(0, TAU))
    e = np.minimum(1, t / 0.004) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.02)) * (0.75 + 0.25 * np.exp(-t / 0.1))
    return fade(y * e * 0.35, 0.0005, 0.02)


def pad(rng, notes, dur, bright=1.0, attack=0.35):
    """three detuned saws per note spread across the stereo field, dark and slow"""
    t = tt(dur + 0.7)
    out = np.zeros((2, len(t)))
    for m in notes:
        f0 = mtof(m)
        for k, (dt, p) in enumerate([(-0.0045, -0.75), (0.0, 0.0), (0.0048, 0.75)]):
            vib = 1 + 0.0022 * np.sin(TAU * (4.6 + 0.5 * k) * t + rng.uniform(0, TAU))
            ph = TAU * f0 * (1 + dt) * np.cumsum(vib) / SR
            s = sum(np.sin(h * ph + rng.uniform(0, TAU)) / h ** 1.25 * np.exp(-f0 * h / (1500 * bright))
                    for h in range(1, int(4000 / f0) + 1))
            out += pan(s, p)
    e = np.minimum(1, t / attack) ** 2 * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.25))
    return out * e / (len(notes) * 2.0)


def pluck(rng, m, dur=0.3):
    f = mtof(m)
    t = tt(dur)
    y = sum(np.sin(TAU * f * h * t + rng.uniform(0, TAU)) / h ** 1.1 * np.exp(-t / (0.12 / h ** 0.6))
            for h in range(1, int(6000 / f) + 1))
    return fade(y * np.minimum(1, t / 0.002) * 0.4, 0.0005, 0.03)


def braam(rng, dur=0.8, notes=(26, 38, 45, 50)):
    """low brass hit: a closing filter over detuned saws"""
    t = tt(dur + 0.5)
    y = np.zeros(len(t))
    cut = 300 + 1900 * np.exp(-t / 0.3)
    for m in notes:
        f = mtof(m)
        for dt in (-0.006, 0.006):
            ph = TAU * f * (1 + dt) * t + rng.uniform(0, TAU)
            for h in range(1, int(3000 / f) + 1):
                y += np.sin(h * ph) / h * np.exp(-f * h / cut)
    e = np.minimum(1, t / 0.025) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.2)) * (0.6 + 0.4 * np.exp(-t / 0.4))
    return fade(np.tanh(0.9 * y * e / len(notes)), 0.001, 0.05)


def mbox(rng, m, cents=0.0, dur=2.2, bends=()):
    """music-box tine: fundamental, a weak octave and two fast inharmonic modes; bends = [(t, cents, over)] pitch drops"""
    t = tt(dur)
    c = np.full(len(t), cents) + 7 * np.sin(TAU * 0.7 * t + rng.uniform(0, TAU))       # wow
    for b_t, b_c, b_over in bends:
        c += b_c * np.clip((t - b_t) / b_over, 0, 1) ** 1.5
    f = mtof(m) * 2 ** (c / 1200)
    out = np.zeros(len(t))
    for det in (-4, 4):                                                                  # two tines, slightly apart
        ph = TAU * np.cumsum(f * 2 ** (det / 1200)) / SR
        for mult, a, d in [(1.0, 1.0, 1.4), (2.0, 0.12, 0.5), (4.16, 0.25, 0.12), (6.27, 0.18, 0.05)]:
            out += a * np.sin(mult * ph) * np.exp(-t / d)
    out += bp(white(rng, dur), 3000, 9000) * env(dur, 0.0002, 0.003) * 0.4
    return fade(out * 0.25, 0.0005, 0.1)


def drone(rng, sec, low=(26, 27), high=(81, 82), bow=1.0):
    """two low tones a semitone apart (beating), a dark bowed D and a tremolo string pair high up"""
    t = tt(sec)
    lo = sum(np.sin(TAU * mtof(m) * t + rng.uniform(0, TAU)) for m in low) * 0.22 + lp(colored(rng, sec, -6), 120) * 0.18
    mid = sum(np.sin(h * TAU * mtof(38) * (1 + d) * t + rng.uniform(0, TAU)) / h for d in (-0.003, 0.003) for h in range(1, 16))
    mid = lp(mid, 700) * 0.22
    trem = 0.5 + 0.5 * np.sin(TAU * 6.3 * t)
    hi = sum(np.sin(TAU * mtof(m) * t + rng.uniform(0, TAU)) for m in high) * trem * 0.035 * bow
    air = bp(colored(rng, sec, -1), 2200, 5000) * trem * 0.02 * bow
    return np.stack([lo + mid + hi + air, lo + mid + 0.8 * hi + air * 1.2])


def rswell(rng, sec):
    """reverse cymbal and a sucked-in low tone that end exactly on the next hit"""
    t = tt(sec)
    k = t / sec
    y = hp(colored(rng, sec, -1), 1500) * k ** 3 * 0.45 + np.sin(sweep(sec, 45, 110)) * k ** 2 * 0.3
    y[-n_(0.004):] *= np.linspace(1, 0, n_(0.004))
    return y


def riser(rng, sec):
    t = tt(sec)
    k = t / sec
    x = colored(rng, sec, -1)
    y = np.zeros_like(x)
    zi, blk = None, 1024
    for i in range(0, len(x), blk):                                    # a band-pass sweeping 300 Hz → 8 kHz
        fc = 300 * (8000 / 300) ** (i / len(x))
        s = signal.butter(2, [fc * 0.7, min(fc * 1.4, 20000)], 'bandpass', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        y[i:i + blk], zi = signal.sosfilt(s, x[i:i + blk], zi=zi)
    tones = sum(np.sin(sweep(sec, f0, f0 * 3)) for f0 in (196, 293.7, 392))
    return (y * 0.5 + tones * 0.05) * k ** 2.2


def tape_stop(x, i0, sec):
    """slow the bus to a halt from sample i0 over sec seconds (everything after is silent)"""
    N = n_(sec)
    i = np.arange(N)
    src = i0 + i - i ** 2 / (2 * N)
    out = x.copy()
    for c in range(2):
        out[c, i0:i0 + N] = np.interp(src, np.arange(x.shape[1]), x[c]) * np.linspace(1, 0.3, N)
    out[:, i0 + N:] = 0
    out[:, i0 + N - n_(0.01):i0 + N] *= np.linspace(1, 0, n_(0.01))
    return out


# ——————————————————————————— the score ———————————————————————————
PROG = [  # bass root, pad voicing, arp notes: Dm | B♭ | Gm | A
    (38, (57, 62, 65), (74, 77, 81)),
    (34, (53, 58, 62), (74, 77, 82)),
    (31, (55, 58, 62), (74, 79, 82)),
    (33, (52, 57, 61), (73, 76, 81)),
]
LULLABY = [(81, 1), (77, 1), (74, 1), (77, 1), (76, 1), (74, 1), (73, 1), (76, 1), (79, 1), (77, 3),
           (81, 1), (77, 1), (74, 1), (77, 1)]


def score(A, total, seed=7):
    rng = np.random.default_rng(seed)
    S = {k: Bus(total) for k in ('drums', 'clock', 'bass', 'pad', 'arp', 'fx', 'post')}
    beeps = [A['zero'] - 2.7, A['zero'] - 1.8, A['zero'] - 0.9, A['zero']]

    # intro: a dark drone that swells under the first lines and fades out across the first step
    d_end = A['s1'] + 2.0
    d = drone(rng, d_end - 0.45, bow=0.7)
    k = tt(d_end - 0.45) / (d_end - 0.45)
    d *= np.minimum(1, k * 5) * (0.55 + 0.45 * np.clip((tt(d_end - 0.45) + 0.45) / A['timer'], 0, 1)) * np.clip((d_end - 0.45 - tt(d_end - 0.45)) / 2.0, 0, 1)
    S['pad'].add(0.45, d, -4)

    sections = [('pre', A['timer'], A['s1']), ('s1', A['s1'], A['s2']), ('s2', A['s2'], A['s3']),
                ('s3', A['s3'], A['s4']), ('s4', A['s4'], A['s5']), ('s5', A['s5'], beeps[0])]
    mute = (A['clang'], None)                                          # the pot gag: dead stop until the cat looks innocent
    for name, a, b in sections:
        nb = max(1, round((b - a) / 0.5))
        p = (b - a) / nb
        lvl = ['pre', 's1', 's2', 's3', 's4', 's5'].index(name)
        if name == 's2':
            mute = (A['clang'], a + 18 * p)
        for i in range(nb):
            tb = a + i * p
            last = i == nb - 1 and name != 's5'
            bar, beat = divmod(i, 4)
            root, chord, arp = PROG[bar % 4]
            muted = name == 's2' and mute[0] - 0.02 <= tb < mute[1]
            if not (name == 's2' and mute[0] - 0.02 <= tb < mute[1] - p):     # the clock comes back one beat earlier
                S['clock'].add(tb, clock(rng, i % 2 == 0), -2 if i % 2 == 0 else -4, 0.15 if i % 2 == 0 else -0.15)
            if last:
                S['fx'].add(tb, rswell(rng, p), -4 + lvl)
                continue
            if muted or lvl == 0:
                continue
            # bass: eighths, the off-eighth an octave up from step 3
            for e8 in range(2):
                m = root + (12 if (e8 == 1 and lvl >= 3 and beat % 2 == 1) else 0)
                S['bass'].add(tb + e8 * p / 2, bass(rng, m, p / 2 * 0.85, 0.5 + 0.1 * lvl), (-1 if e8 == 0 else -4) - (3 if lvl == 1 else 0))
            if lvl >= 2 and (beat in (0, 2) or (lvl >= 4 and beat == 2)):
                S['drums'].add(tb, kick(rng), -1)
            if lvl >= 4 and beat == 2:
                S['drums'].add(tb + p / 2, kick(rng), -5)
            if lvl >= 3 and beat in (1, 3):
                S['drums'].add(tb, clap(rng), -7, 0.05)
            if lvl >= 4:
                S['drums'].add(tb + p / 2, hat(rng), -12, 0.25)
            if lvl >= 3 and beat == 0:                                   # one chord per bar, cut before the gap
                bar_end = min(a + (bar * 4 + 4) * p, b - p if name != 's5' else b)
                S['pad'].add(tb, pad(rng, chord, bar_end - tb - 0.05, 0.6 + 0.1 * lvl), -9)
            if lvl >= 4:
                seq = (0, 1, 2, 3) if beat % 2 == 0 else (2, 1, 0, 1)
                for j, q in enumerate(seq):
                    m = arp[q] if q < 3 else arp[0] + 12
                    S['arp'].add(tb + j * p / 4, pluck(rng, m, 0.3), -11 + (2 if j == 0 else 0), 0.35 if j % 2 else -0.35)
        if name == 's5':                                                  # riser and a snare roll into the countdown
            r0 = A['below']
            S['fx'].add(r0, riser(rng, b - r0), -6)
            roll0 = b - 2 * p
            for j in range(16):
                tj = roll0 + j * p / 8
                S['drums'].add(tj, clap(rng), -20 + 12 * j / 15, 0.1 * (-1) ** j)

    # countdown: double time, low brass on every beep, the bass pedalling D in octaves
    p = 0.45
    for i in range(6):
        tb = beeps[0] + i * p
        S['drums'].add(tb, kick(rng), 0)
        S['clock'].add(tb, clock(rng, i % 2 == 0), -1, 0.15 if i % 2 == 0 else -0.15)
        for e8 in range(2):
            S['bass'].add(tb + e8 * p / 2, bass(rng, 38 + 12 * e8, p / 2 * 0.85, 1.0), -2)
        if i % 2 == 0:
            S['fx'].add(tb, braam(rng, 0.8), -3)
        S['drums'].add(tb + p / 2, hat(rng), -10)
    S['fx'].add(beeps[3], braam(rng, 1.2), -1)
    S['drums'].add(beeps[3], kick(rng), 0)

    groove = sum(S[k].y for k in ('drums', 'clock', 'bass', 'pad', 'arp', 'fx'))
    # verb on the groove, then the pot-gag silence and the tape stop
    ir = room(rng, 1.1, damp=4500, width=0.8)
    send = S['drums'].y * 0.5 + S['pad'].y + S['arp'].y + S['clock'].y * 0.6
    wet = np.stack([signal.fftconvolve(send[c], ir[c])[:groove.shape[1]] for c in range(2)])
    groove = groove + 0.22 * wet
    g = np.ones(groove.shape[1])
    i0, i1 = at(mute[0]), at(mute[1] - (A['s3'] - A['s2']) / 21) - n_(0.03)
    g[i0:i1] = 0
    g[i0 - n_(0.012):i0] = np.linspace(1, 0, n_(0.012))
    g[i1:i1 + n_(0.03)] = np.linspace(0, 1, n_(0.03))
    groove = groove * g
    groove = tape_stop(groove, at(A['black1']), 0.6)

    # after the blackout
    post = S['post']
    post.add(A['uspel'] - 0.15, pad(rng, (53, 57, 60, 64), 1.3, 0.7, attack=0.25), -6)          # «Ты успел»: F maj7
    dk_a, dk_b = A['i'], A['black']
    sec = dk_b - dk_a
    tk = tt(sec) + dk_a
    shape = np.interp(tk, [dk_a, A['approach'], A['vStart'] - 0.5, A['vStart'] + 0.1, A['reveal'], dk_b - 0.05, dk_b],
                      [0.15, 0.8, 0.85, 0.3, 0.35, 1.25, 0.0])
    post.add(dk_a, drone(rng, sec, bow=1.0) * shape, -8)
    t0, beat = A['vLull'], 0.5
    s = t0
    for m, ln in LULLABY:
        if s >= A['reveal']:
            break
        kk = (s - t0) / (A['reveal'] - t0)
        cents = -8 - 55 * kk ** 1.6 + rng.uniform(-6, 6)
        bends = []
        if s <= A['figure'] < s + ln * beat + 0.6:
            bends.append((A['figure'] - s, -150, 0.8))
        if s <= A['reveal'] < s + 2.2:
            bends.append((A['reveal'] - s, -320, 0.45))
        y = mbox(rng, m, cents, 2.2, bends)
        if any(b[1] == -320 for b in bends):                              # the mechanism dies at the reveal
            cut = n_(A['reveal'] - s + 0.5)
            if cut < len(y):
                y[cut:] = 0
                y[cut - n_(0.05):cut] *= np.linspace(1, 0, n_(0.05))
        post.add(s, verb(y, room(rng, 1.2, damp=7000), 0.3), -12, -0.2)
        s += ln * beat
    for j, m in enumerate((69, 65, 62)):                                   # the end card: three last notes, out of tune
        y = mbox(rng, m, -70 - 10 * j, 3.0)
        post.add(A['ask'] + 0.55 + 0.8 * j, verb(y, room(rng, 1.6, damp=6000), 0.35), -11, -0.2)
    end = total - A['ask']
    e = drone(rng, end, bow=0.5) * np.minimum(1, tt(end) / 0.8) * np.clip((end - tt(end)) / 0.6, 0, 1)
    post.add(A['ask'], e, -13)

    return groove + post.y, S


def main():
    cues = json.load(open(sys.argv[1]))
    A, total = cues['anchors'], cues['total']
    mix, stems = score(A, total)
    mix = mix[:, :at(total)]
    peak = np.max(np.abs(mix))
    mix = mix * (0.89 / peak)                                               # headroom; levels are set in the mix
    sf.write(sys.argv[2], mix.T, SR, subtype='FLOAT')
    if len(sys.argv) > 3:
        os.makedirs(sys.argv[3], exist_ok=True)
        for k, b in stems.items():
            sf.write(os.path.join(sys.argv[3], k + '.wav'), (b.y[:, :at(total)] * 0.89 / peak).T, SR, subtype='FLOAT')
    print(f'music {total:.2f}s, peak scaled from {peak:.2f} → {sys.argv[2]}')


if __name__ == '__main__':
    main()
