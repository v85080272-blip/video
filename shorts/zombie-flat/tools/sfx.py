# Sound effects (copied from shorts/zombie-panelka/tools/sfx.py), all synthesised with numpy/scipy (no samples): noise shaped by filters,
# damped partials for metal, source-filter voices for the cat and the zombies, synthetic rooms for reverb.
# SFX[name](rng, **cue) returns a mono or stereo float array at 48 kHz.
import numpy as np
from scipy import signal

SR = 48000
TAU = 2 * np.pi


def n_(sec):
    return max(1, int(round(sec * SR)))


def tt(sec):
    return np.arange(n_(sec)) / SR


def db(x):
    return 10 ** (x / 20)


def sos(kind, f, order=2):
    if kind == 'bp':
        return signal.butter(order, [max(10, f[0]), min(f[1], SR / 2 - 100)], 'bandpass', fs=SR, output='sos')
    return signal.butter(order, min(f, SR / 2 - 100), 'lowpass' if kind == 'lp' else 'highpass', fs=SR, output='sos')


def lp(x, f, order=2):
    return signal.sosfilt(sos('lp', f, order), x, axis=-1)


def hp(x, f, order=2):
    return signal.sosfilt(sos('hp', f, order), x, axis=-1)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(sos('bp', (lo, hi), order), x, axis=-1)


def peak(x, f, q, gain_db):
    b, a = signal.iirpeak(f, q, fs=SR)
    return x + (db(gain_db) - 1) * signal.lfilter(b, a, x, axis=-1)


def white(rng, sec):
    return rng.standard_normal(n_(sec))


def colored(rng, sec, slope=-3.0):
    """noise with a spectral slope in dB/octave (0 white, -3 pink, -6 brown), unit RMS"""
    n = n_(sec)
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.maximum(np.fft.rfftfreq(n, 1 / SR), 20.0)
    X *= (f / 1000) ** (slope / 6.02)
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def env(sec, a=0.005, d=0.2, curve=1.0):
    """attack then exponential decay (d = time constant)"""
    t = tt(sec)
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return e ** curve


def fade(x, fi=0.005, fo=0.05):
    n = x.shape[-1]
    g = np.ones(n)
    a, b = min(n, n_(fi)), min(n, n_(fo))
    g[:a] = np.linspace(0, 1, a)
    g[n - b:] *= np.linspace(1, 0, b)
    return x * g


def norm(x, peak_=1.0):
    return x * peak_ / (np.max(np.abs(x)) + 1e-12)


def partials(sec, freqs, decays, amps, rng=None, jitter=0.0):
    t = tt(sec)
    y = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        ph = rng.uniform(0, TAU) if rng is not None else 0
        f2 = f * (1 + (rng.uniform(-jitter, jitter) if rng is not None else 0))
        y += a * np.sin(TAU * f2 * t + ph) * np.exp(-t / d)
    return y


def sweep(sec, f0, f1, kind='exp'):
    """phase of a sine whose frequency glides f0 → f1"""
    k = np.linspace(0, 1, n_(sec))
    f = f0 * (f1 / f0) ** k if kind == 'exp' else f0 + (f1 - f0) * k
    return TAU * np.cumsum(f) / SR


def harm(phase, nh=12, tilt=1.0):
    """band-limited-ish saw-like tone from a phase array"""
    return sum(np.sin(h * phase) / h ** tilt for h in range(1, nh + 1))


def svf_bp(x, fc, q):
    """time-varying band-pass (Chamberlin state-variable filter), fc per sample; for short sounds"""
    y = np.empty_like(x)
    low = band = 0.0
    fc = np.broadcast_to(fc, x.shape)
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc[i], 9000) / SR)
        high = x[i] - low - q * band
        band += f * high
        low += f * band
        y[i] = band
    return y


def room(rng, rt60=0.6, sec=None, pre=0.008, damp=5000, width=0.5):
    """synthetic stereo impulse response (unit energy)"""
    sec = sec or rt60 * 1.4
    t = tt(sec)
    irs = []
    for c in range(2):
        ir = rng.standard_normal(len(t)) * np.exp(-6.91 * t / rt60)
        ir = lp(ir, damp)
        irs.append(ir)
    m = (irs[0] + irs[1]) / 2
    ir = np.stack([m + width * (irs[0] - m), m + width * (irs[1] - m)])
    ir = np.concatenate([np.zeros((2, n_(pre))), ir], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def verb(x, ir, wet=0.2, dry=1.0):
    x = np.atleast_2d(x)
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    w = np.stack([signal.fftconvolve(x[c], ir[c]) for c in range(2)])
    out = np.zeros_like(w)
    out[:, :x.shape[1]] += dry * x
    return out + wet * w


def pan(x, p):
    """mono → stereo, p in -1..1 (equal power)"""
    a = (p + 1) * np.pi / 4
    return np.stack([np.cos(a) * x, np.sin(a) * x])


# ——————————————————————————— effects ———————————————————————————
def boom(rng, big=1.0, **_):
    sec = 2.6
    t = tt(sec)
    sub = np.sin(sweep(sec, 70, 28)) * np.exp(-t / (0.7 * big))
    body = lp(colored(rng, sec, -6), 300) * env(sec, 0.002, 0.25) * 0.8
    crack = hp(lp(white(rng, sec), 6000), 400) * env(sec, 0.001, 0.035) * 0.6
    y = sub * 1.0 + body + crack
    y = verb(y, room(rng, 2.2, damp=2500), 0.35)
    return norm(y, 0.95)


def groan(rng, sec=1.4, f0=85, **_):
    t = tt(sec)
    k = t / sec
    f = f0 * (1 + 0.25 * np.sin(np.pi * k)) * (1 + 0.04 * np.sin(TAU * 5.5 * t + rng.uniform(0, 6))) * (1 + 0.02 * colored(rng, sec, -6))
    src = harm(TAU * np.cumsum(f) / SR, 30, 0.8) + 0.4 * colored(rng, sec, -3)
    y = bp(src, 300, 700) * 1.0 + bp(src, 900, 1400) * 0.5 + lp(src, 250) * 0.6
    e = np.sin(np.pi * np.clip(k * 1.1, 0, 1)) ** 0.7
    y = y * e * (1 + 0.5 * np.sin(TAU * 11 * t) * k)          # rattle
    return fade(norm(lp(y, 2500), 0.8), 0.05, 0.2)


def whoosh(rng, sec=0.45, f0=500, f1=2500, **_):
    t = tt(sec)
    k = t / sec
    x = colored(rng, sec, -2)
    fc = f0 * (f1 / f0) ** k
    y = svf_bp(x, fc, 0.9)
    e = np.sin(np.pi * k) ** 1.6
    return fade(norm(y * e, 0.8), 0.01, 0.05)


def whoosh_up(rng, **_):
    return whoosh(rng, 0.95, 250, 3500)


def whoosh_short(rng, **_):
    return whoosh(rng, 0.26, 900, 3800)


def whoosh_in(rng, **_):
    sec = 0.55
    k = tt(sec) / sec
    x = colored(rng, sec, -2)
    y = svf_bp(x, 300 * (4000 / 300) ** k, 0.8) * k ** 2.5
    y[-n_(0.01):] *= np.linspace(1, 0, n_(0.01))
    return norm(y, 0.8)


def blip(rng, pitch=1, **_):
    sec = 0.09
    t = tt(sec)
    f = 520 * 2 ** (pitch * 2.2 / 12)
    y = (np.sin(TAU * f * t) + 0.3 * np.sin(TAU * 2 * f * t)) * env(sec, 0.002, 0.03)
    return fade(y * 0.7, 0.002, 0.01)


def thump(rng, sec=0.3, f=80, noise_lp=500, d=0.08, **_):
    t = tt(sec)
    y = np.sin(sweep(sec, f * 1.6, f)) * np.exp(-t / d) + 0.5 * lp(white(rng, sec), noise_lp) * env(sec, 0.001, d * 0.5)
    return fade(norm(y, 0.9), 0.001, 0.05)


def land_soft(rng, **_):
    return thump(rng, 0.25, 140, 900, 0.05) * 0.8


def meow(rng, sec=0.62, f0=(520, 800, 430), **_):
    t = tt(sec)
    k = t / sec
    f = np.interp(k, [0, 0.35, 1], f0) * (1 + 0.012 * np.sin(TAU * 7 * t))
    ph = TAU * np.cumsum(f) / SR
    src = harm(ph, 14, 1.0) + 0.06 * white(rng, sec)
    F1 = np.interp(k, [0, 0.18, 0.5, 1], [350, 650, 950, 420])
    F2 = np.interp(k, [0, 0.18, 0.5, 1], [1900, 2400, 1500, 850])
    F3 = np.interp(k, [0, 0.5, 1], [3000, 2900, 2600])
    y = svf_bp(src, F1, 0.25) + 0.8 * svf_bp(src, F2, 0.2) + 0.35 * svf_bp(src, F3, 0.2)
    e = np.minimum(1, t / 0.05) * np.minimum(1, (sec - t) / 0.18) ** 1.3
    y = hp(y * e, 200)
    return norm(verb(y, room(rng, 0.35, damp=6000), 0.08), 0.85)


def mrr(rng, sec=0.42, **_):
    t = tt(sec)
    k = t / sec
    f = np.interp(k, [0, 0.4, 1], [260, 330, 280])
    src = harm(TAU * np.cumsum(f) / SR, 16, 1.0)
    am = 0.55 + 0.45 * np.sign(np.sin(TAU * 24 * t))           # the rolled «rrr»
    y = (svf_bp(src, np.interp(k, [0, 1], [500, 700]), 0.35) + 0.6 * svf_bp(src, 1600, 0.3)) * lp(am, 300)
    e = np.minimum(1, t / 0.04) * np.minimum(1, (sec - t) / 0.12)
    return norm(hp(y * e, 150), 0.7)


def hiss(rng, sec=0.75, **_):
    t = tt(sec)
    x = white(rng, sec)
    y = bp(x, 2500, 9000, 2) + 0.5 * bp(x, 1200, 2200)
    e = np.minimum(1, t / 0.02) * np.exp(-t / 0.5) * (1 + 0.25 * np.sin(TAU * 13 * t))
    spit = bp(white(rng, sec), 600, 3000) * env(sec, 0.001, 0.03) * 1.5
    return norm((y * e + spit), 0.85)


def hiss_small(rng, **_):
    return hiss(rng, 0.4) * 0.6


def alert(rng, **_):
    out = np.zeros(n_(1.2))
    for i in range(3):
        sec = 0.26
        t = tt(sec)
        tone = np.sign(np.sin(TAU * 853 * t)) * 0.5 + np.sign(np.sin(TAU * 960 * t)) * 0.5
        tone = lp(tone, 4000) * np.minimum(1, t / 0.005) * np.minimum(1, (sec - t) / 0.01)
        a = n_(i * 0.36)
        out[a:a + len(tone)] += tone
    return norm(out, 0.7)


def buzz(rng, dur=0.9, **_):
    t = tt(dur)
    y = np.sign(np.sin(TAU * 170 * t)) * 0.6 + 0.4 * bp(white(rng, dur), 150, 900)
    gate = (np.sin(TAU * 3.2 * t) > -0.2).astype(float)
    y = lp(y, 900) * lp(gate, 40)
    return fade(norm(y, 0.6), 0.01, 0.05)


def power_dip(rng, **_):
    sec = 0.6
    t = tt(sec)
    hum = sum(np.sin(TAU * 100 * h * t) / h for h in range(1, 8))
    crackle = (rng.random(len(t)) > 0.985) * rng.standard_normal(len(t)) * 1.2      # softer: the clip check heard v1's as a click
    y = (0.6 * hum + lp(crackle, 3000)) * env(sec, 0.015, 0.12)
    drop = np.sin(sweep(sec, 160, 40)) * env(sec, 0.01, 0.2) * 0.6
    return norm(y + drop, 0.75)


def tick(rng, f=3200, sec=0.08, **_):
    t = tt(sec)
    y = hp(white(rng, sec), 1500) * env(sec, 0.0005, 0.004) + 0.6 * np.sin(TAU * f * t) * np.exp(-t / 0.012) + 0.4 * np.sin(TAU * f * 1.51 * t) * np.exp(-t / 0.008)
    return fade(norm(y, 0.8), 0.0005, 0.01)


def tick_big(rng, **_):
    y = tick(rng, 2400, 0.25)
    return norm(verb(y, room(rng, 0.5), 0.25), 0.9)


def slam(rng, **_):
    sec = 2.2
    t = tt(sec)
    sub = np.sin(sweep(sec, 95, 42)) * np.exp(-t / 0.45)
    hit = lp(white(rng, sec), 3000) * env(sec, 0.0008, 0.04)
    metal = partials(sec, [196, 311, 467, 622, 933, 1244], [0.9, 0.7, 0.6, 0.5, 0.35, 0.25], [0.5, 0.35, 0.3, 0.2, 0.15, 0.1], rng, 0.01)
    y = sub + 0.8 * hit + 0.5 * metal
    y = verb(y, room(rng, 1.8, damp=4000), 0.3)
    return norm(y, 0.95)


def key(rng, **_):
    sec = 0.18
    out = np.zeros(n_(sec))
    for dt, a in [(0.0, 1.0), (0.045, 0.7)]:
        s = n_(dt)
        c = bp(white(rng, 0.03), 2500, 7000) * env(0.03, 0.0003, 0.004) + 0.5 * partials(0.03, [3400, 5200], [0.01, 0.006], [1, 0.6], rng)
        out[s:s + len(c)] += a * c
    out += 0.4 * thump(rng, sec, 240, 2000, 0.02)[:len(out)]
    return norm(out, 0.8)


def latch(rng, **_):
    sec = 0.45
    t = tt(sec)
    k = t / sec
    slide = bp(white(rng, sec), 1200, 4000) * (0.4 + 0.6 * np.abs(np.sin(TAU * 38 * t))) * (k < 0.7) * np.sin(np.pi * np.clip(k / 0.7, 0, 1))
    out = 0.5 * slide
    s = n_(0.3)
    clack = bp(white(rng, 0.08), 800, 6000) * env(0.08, 0.0005, 0.01) + partials(0.08, [1800, 2900, 4300], [0.03, 0.02, 0.015], [0.8, 0.5, 0.3], rng)
    out[s:s + len(clack)] += clack[:len(out) - s]
    return norm(out, 0.85)


def scrape(rng, dur=0.8, **_):
    t = tt(dur)
    x = colored(rng, dur, -1)
    stick = np.clip(colored(rng, dur, 0) * 0.8 + 0.6, 0, None)
    stick = lp(stick * (0.5 + 0.5 * np.sin(TAU * 23 * t + 2 * np.sin(TAU * 3 * t))), 120)
    y = bp(x, 140, 700) * stick + 0.35 * bp(x, 1200, 2600) * stick
    y = peak(y, 330, 4, 8)
    e = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.05)
    return norm(y * e, 0.75)


def scrape_short(rng, **_):
    sec = 0.3
    t = tt(sec)
    x = white(rng, sec)
    y = bp(x, 1500, 5000) * (0.5 + 0.5 * np.abs(np.sin(TAU * 55 * t))) + 0.4 * np.sin(sweep(sec, 2100, 1700)) * (rng.random() * 0.5 + 0.5)
    return fade(norm(y * np.sin(np.pi * t / sec), 0.6), 0.01, 0.03)


def thud(rng, **_):
    sec = 0.9
    y = thump(rng, sec, 62, 400, 0.16) + 0.35 * bp(white(rng, sec), 300, 1500) * env(sec, 0.001, 0.03)
    rattle = np.zeros(n_(sec))
    for i in range(5):
        s = n_(0.05 + i * 0.045 + rng.uniform(0, 0.01))
        c = partials(0.05, [2300 + rng.uniform(-200, 200), 3600], [0.012, 0.008], [0.25 * (1 - i / 5), 0.15], rng)
        rattle[s:s + len(c)] += c[:len(rattle) - s]
    y = y + rattle
    return norm(verb(y, room(rng, 0.5, damp=3500), 0.18), 0.95)


def swish(rng, **_):
    sec = 0.55
    t = tt(sec)
    k = t / sec
    fab = svf_bp(colored(rng, sec, -1), 700 + 2600 * np.sin(np.pi * k), 0.7) * np.sin(np.pi * k) ** 1.2
    rings = np.zeros(n_(sec))
    for i in range(9):
        s = n_(0.04 + i * 0.045)
        c = partials(0.04, [4200 + 300 * rng.standard_normal(), 6100], [0.01, 0.006], [0.25, 0.12], rng)
        rings[s:s + len(c)] += c[:len(rings) - s]
    return fade(norm(fab + rings, 0.75), 0.01, 0.05)


def switch(rng, **_):
    sec = 0.12
    out = np.zeros(n_(sec))
    for dt, a in [(0, 1.0), (0.018, 0.6)]:
        s = n_(dt)
        c = bp(white(rng, 0.02), 1500, 8000) * env(0.02, 0.0002, 0.002) + 0.5 * partials(0.02, [2700], [0.006], [1], rng)
        out[s:s + len(c)] += a * c
    return norm(out, 0.8)


def power_off_small(rng, **_):
    sec = 0.5
    t = tt(sec)
    y = sum(np.sin(TAU * 50 * h * t) / h for h in range(1, 6)) * np.exp(-t / 0.12) * 0.5
    return fade(norm(y, 0.4), 0.002, 0.05)


def toggle(rng, **_):
    sec = 0.1
    t = tt(sec)
    y = np.sin(TAU * 1800 * t) * env(sec, 0.0005, 0.012) + 0.5 * bp(white(rng, sec), 2000, 6000) * env(sec, 0.0002, 0.003)
    return norm(y, 0.6)


def clang(rng, big=1.0, **_):
    sec = 3.0 if big >= 1 else 1.2
    t = tt(sec)
    fr = np.array([412, 987, 1563, 2210, 2988, 3861, 4790]) * (1 if big >= 1 else 1.12)
    y = partials(sec, fr, np.array([1.4, 1.0, 0.8, 0.6, 0.45, 0.35, 0.25]) * big, [0.6, 0.55, 0.45, 0.35, 0.25, 0.18, 0.12], rng, 0.01)
    y = y * (1 + 0.15 * np.sin(TAU * 6 * t))                      # wobble
    hit = bp(white(rng, sec), 800, 9000) * env(sec, 0.0005, 0.02) * 1.4
    y = y + hit
    if big >= 1:                                                    # the lid spinning down on the floor
        s, gap, a = 0.35, 0.13, 0.5
        while gap > 0.012 and s < sec - 0.1:
            i = n_(s)
            c = partials(0.12, [2240, 3310, 5120], [0.05, 0.035, 0.02], [a, a * 0.6, a * 0.3], rng, 0.01) + a * 0.6 * bp(white(rng, 0.12), 1500, 7000) * env(0.12, 0.0003, 0.004)
            y[i:i + len(c)] += c[:len(y) - i]
            s += gap
            gap *= 0.86
            a *= 0.93
    y = verb(y, room(rng, 0.8, damp=6000), 0.2)
    return norm(y, 0.95)


def clang_small(rng, **_):
    return clang(rng, 0.5) * 0.6


def water(rng, dur=5.0, **_):
    t = tt(dur)
    x = colored(rng, dur, -1)
    y = bp(x, 400, 5000) * 0.6 + bp(x, 120, 400) * 0.4
    # droplets / bubbles: short rising sine chirps
    nb = int(dur * 35)
    for _ in range(nb):
        s = rng.uniform(0, dur - 0.05)
        f0 = rng.uniform(700, 2400)
        d = rng.uniform(0.01, 0.03)
        c = np.sin(sweep(d, f0, f0 * 1.6)) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * rng.uniform(0.2, 0.6)
        i = n_(s)
        y[i:i + len(c)] += c
    fill = 1 + 0.3 * t / dur                                        # the tub's resonance rises as it fills
    y = peak(y, 600 * fill[len(fill) // 2], 2, 4)
    return fade(norm(y, 0.6), 0.15, 0.25)


def sputter(rng, **_):
    sec = 1.3
    out = np.zeros(n_(sec))
    s = 0.0
    while s < 0.9:
        d = rng.uniform(0.04, 0.12)
        c = bp(white(rng, d), 300, 4000) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * rng.uniform(0.4, 1.0)
        c += 0.6 * np.sin(sweep(d, rng.uniform(150, 300), rng.uniform(60, 120))) * np.sin(np.pi * np.linspace(0, 1, n_(d)))
        i = n_(s)
        out[i:i + len(c)] += c[:len(out) - i]
        s += d + rng.uniform(0.02, 0.12)
    knock = thump(rng, 0.3, 110, 800, 0.05) * 0.7
    i = n_(0.95)
    out[i:i + len(knock)] += knock[:len(out) - i]
    return fade(norm(out, 0.75), 0.005, 0.1)


def clunk(rng, **_):
    sec = 0.5
    y = partials(sec, [330, 742, 1188, 1810], [0.18, 0.12, 0.08, 0.05], [0.6, 0.4, 0.3, 0.15], rng, 0.02) + 0.4 * thump(rng, sec, 120, 1200, 0.03)
    return norm(y, 0.8)


def pop(rng, pitch=0, **_):
    sec = 0.09
    t = tt(sec)
    f0 = 900 * 2 ** (pitch * 3 / 12)
    y = np.sin(sweep(sec, f0, f0 * 0.35)) * env(sec, 0.001, 0.03)
    return fade(norm(y, 0.7), 0.001, 0.01)


def splash(rng, **_):
    sec = 0.5
    y = bp(white(rng, sec), 500, 6000) * env(sec, 0.002, 0.07)
    for _ in range(10):
        d = rng.uniform(0.01, 0.025)
        c = np.sin(sweep(d, rng.uniform(900, 2000), rng.uniform(1800, 3000))) * np.sin(np.pi * np.linspace(0, 1, n_(d))) * 0.4
        i = n_(rng.uniform(0.02, 0.4))
        y[i:i + len(c)] += c[:len(y) - i]
    return norm(y, 0.7)


def drop(rng, **_):
    sec = 0.35
    rustle = bp(white(rng, sec), 1500, 7000) * env(sec, 0.002, 0.06) * 0.5
    return norm(thump(rng, sec, 110, 700, 0.05) + rustle, 0.8)


def thump_bag(rng, **_):
    sec = 0.6
    rustle = bp(colored(rng, sec, -1), 800, 6000) * env(sec, 0.003, 0.15) * 0.6
    return norm(thump(rng, sec, 75, 600, 0.09) + rustle, 0.9)


def ui(rng, **_):
    sec = 0.25
    t = tt(sec)
    y = (np.sin(TAU * 1320 * t) + 0.35 * np.sin(TAU * 2640 * t)) * env(sec, 0.002, 0.06)
    y[n_(0.08):] += (np.sin(TAU * 1760 * t[:len(t) - n_(0.08)]) * env(sec - 0.08, 0.002, 0.06))
    return norm(y, 0.5)


def error(rng, **_):
    sec = 0.6
    t = tt(sec)
    y = (np.sign(np.sin(TAU * 138 * t)) + np.sign(np.sin(TAU * 146.8 * t))) * 0.5
    y = lp(y, 1800) * np.minimum(1, t / 0.005) * np.minimum(1, (sec - t) / 0.03)
    return norm(y, 0.6)


def horde(rng, dur=3.5, **_):
    out = np.zeros(n_(dur))
    for i in range(12):
        s = rng.uniform(0, dur - 1.0)
        g_ = groan(rng, rng.uniform(0.9, 1.6), rng.uniform(70, 130)) * rng.uniform(0.3, 0.8)
        j = n_(s)
        out[j:j + len(g_)] += g_[:len(out) - j]
    rumble = lp(colored(rng, dur, -6), 180) * 0.5
    k = tt(dur) / dur
    out = (out + rumble) * np.minimum(1, k * 3) * (0.6 + 0.4 * k)
    return fade(norm(lp(out, 2200), 0.8), 0.1, 0.3)


def route(rng, dur=2.4, **_):
    t = tt(dur)
    k = t / dur
    notes = [62, 65, 69, 72, 74, 77, 81, 84]
    out = np.zeros(n_(dur))
    for i, m in enumerate(notes):
        s = i * dur / len(notes)
        f = 440 * 2 ** ((m - 69) / 12)
        d = 0.25
        tn = tt(d)
        c = (np.sin(TAU * f * tn) + 0.3 * np.sin(TAU * 2 * f * tn)) * env(d, 0.003, 0.08)
        j = n_(s)
        out[j:j + len(c)] += c[:len(out) - j]
    riser = np.sin(sweep(dur, 300, 900)) * k ** 2 * 0.2
    return fade(norm(out + riser, 0.5), 0.01, 0.1)


def beep(rng, sec=0.13, **_):
    t = tt(sec)
    y = np.sin(TAU * 1000 * t) + 0.2 * np.sin(TAU * 3000 * t)
    return fade(y * 0.6, 0.003, 0.01)


def beep_long(rng, **_):
    return beep(rng, 0.5)


def power_down(rng, **_):
    sec = 3.0
    t = tt(sec)
    ph = sweep(1.5, 320, 28)
    tone = harm(ph, 20, 1.0)
    tone = np.concatenate([tone, np.zeros(n_(sec) - len(tone))])
    cut = np.exp(-t / 0.5)
    y = np.zeros(n_(sec))
    for i in range(0, len(y), 512):                                 # a low-pass that closes as the power dies
        f = max(120, 6000 * np.exp(-i / SR / 0.35))
        b, a = signal.butter(1, f, 'lowpass', fs=SR)
        y[i:i + 512] = signal.lfilter(b, a, tone[i:i + 512])
    y = y * cut * 0.8
    hum = sum(np.sin(TAU * 50 * h * t) / h for h in range(1, 6)) * np.exp(-t / 0.25) * 0.3
    relay = thump(rng, 0.4, 90, 2500, 0.05)
    y[:len(relay)] += relay * 0.9
    y = y + hum
    return norm(verb(y, room(rng, 1.4, damp=2000), 0.25), 0.95)


def click(rng, **_):
    sec = 0.08
    y = bp(white(rng, sec), 1200, 9000) * env(sec, 0.0002, 0.003) + 0.5 * partials(sec, [1900, 3100], [0.01, 0.006], [1, 0.5], rng)
    return norm(y, 0.8)


def scratch(rng, **_):
    sec = rng.uniform(0.32, 0.5)
    t = tt(sec)
    k = t / sec
    x = white(rng, sec)
    grains = np.zeros(len(t))
    s = 0.0
    while s < sec:
        i = n_(s)
        grains[i:i + n_(0.004)] += rng.uniform(0.4, 1.0)
        s += rng.uniform(0.008, 0.022)
    grains = lp(grains, 900)
    y = bp(x, 1800, 6500) * grains + 0.5 * bp(x, 300, 900) * grains
    y = y * np.sin(np.pi * k) ** 0.6
    y = lp(y, 3200)                                                 # through the door
    return norm(verb(y, room(rng, 0.45, damp=3000), 0.15), 0.8)


def door_rattle(rng, **_):
    sec = 0.9
    out = np.zeros(n_(sec))
    for i in range(7):
        s = n_(i * 0.09 + rng.uniform(0, 0.02))
        c = thump(rng, 0.15, 90, 1200, 0.03) * (1 - i / 8) + partials(0.15, [1900, 2700], [0.03, 0.02], [0.4, 0.2], rng)
        out[s:s + len(c)] += c[:len(out) - s]
    return norm(out, 0.8)


def heartbeat(rng, dur=3.0, bpm0=88, bpm1=112, **_):
    out = np.zeros(n_(dur))
    s = 0.0
    while s < dur - 0.3:
        bpm = bpm0 + (bpm1 - bpm0) * s / dur
        for dt, a in [(0, 1.0), (0.26, 0.7)]:
            c = np.sin(sweep(0.25, 70, 38)) * env(0.25, 0.004, 0.06) * a
            c += lp(white(rng, 0.25), 200) * env(0.25, 0.002, 0.02) * 0.3 * a
            i = n_(s + dt)
            out[i:i + len(c)] += c[:len(out) - i]
        s += 60 / bpm
    return norm(lp(out, 300), 0.9)


def sting(rng, sec=1.6, level=1.0, **_):
    t = tt(sec)
    notes = [50, 51, 56, 62, 63]                                     # a dissonant cluster
    y = np.zeros_like(t)
    for m in notes:
        f = 440 * 2 ** ((m - 69) / 12)
        for dt in (-0.004, 0.004):
            y += harm(TAU * f * (1 + dt) * t + rng.uniform(0, 6), 20, 1.0)
    y = lp(y, 2500) * np.minimum(1, t / 0.02) * np.exp(-t / (0.5 * sec))
    stab = bp(white(rng, sec), 400, 5000) * env(sec, 0.001, 0.05)
    low = np.sin(sweep(sec, 80, 40)) * np.exp(-t / 0.4) * 0.8
    y = norm(y, 0.6) + 0.4 * stab + low * level
    return norm(verb(y, room(rng, 2.0, damp=3500), 0.35), 0.9)


def sting_small(rng, **_):
    return sting(rng, 1.0, 0.4) * 0.7


def sting_big(rng, **_):
    y = sting(rng, 2.6, 1.2)
    rev = whoosh(rng, 0.7, 200, 5000)
    out = np.zeros((2, y.shape[1] + n_(0.7)))
    out[:, :len(rev)] += 0.4 * rev
    out[:, n_(0.6):n_(0.6) + y.shape[1]] += y
    return norm(out, 0.95)


def zap(rng, **_):
    sec = 0.35
    t = tt(sec)
    y = np.sign(np.sin(TAU * 120 * t)) * 0.5 * (rng.random(len(t)) > 0.3) + bp(white(rng, sec), 2000, 8000) * (rng.random(len(t)) > 0.9) * 1.5
    return fade(norm(lp(y, 6000) * env(sec, 0.001, 0.12), 0.6), 0.001, 0.05)


def cut(rng, **_):
    return thump(rng, 0.5, 45, 200, 0.12) * 0.8


def hit_end(rng, **_):
    y = boom(rng, 1.3)
    return y


def amb_city(rng, dur=4.0, **_):
    t = tt(dur)
    rumble = lp(colored(rng, dur, -6), 160) * 0.5
    wind = svf_bp(colored(rng, dur, -2)[::8], 0.0 + 600 + 300 * np.sin(TAU * 0.13 * t[::8]), 0.6)
    wind = np.interp(np.arange(len(t)), np.arange(0, len(t), 8)[:len(wind)], wind) * 0.25
    siren = np.zeros_like(t)
    for f_lo, f_hi, per, ph, a in [(620, 1150, 3.6, 0.0, 0.35), (480, 900, 4.4, 1.7, 0.22)]:
        f = f_lo + (f_hi - f_lo) * (0.5 - 0.5 * np.cos(TAU * t / per + ph))
        siren += a * np.sin(TAU * np.cumsum(f) / SR)
    siren = lp(siren, 1400) * 0.6
    rotor = lp(white(rng, dur), 300) * (0.5 + 0.5 * np.sign(np.sin(TAU * 11 * t))) * 0.12
    y = rumble + wind + siren + rotor
    for s in rng.uniform(0.3, max(0.4, dur - 1.5), size=int(dur / 2.2)):
        g_ = groan(rng, rng.uniform(1.0, 1.5), rng.uniform(75, 110)) * 0.25
        i = n_(s)
        y[i:i + len(g_)] += lp(g_, 1200)[:len(y) - i]
    y = verb(y, room(rng, 1.6, damp=2500, width=0.9), 0.4)
    return fade(norm(y, 0.6), 0.2, 0.4)


def amb_room(rng, dur=2.0, **_):
    t = tt(dur)
    y = lp(colored(rng, dur, -4), 400) * 0.25 + 0.05 * np.sin(TAU * 50 * t)
    y += lp(amb_city(rng, dur)[0][:len(t)], 900) * 0.35             # the city through the glass
    return fade(y, 0.1, 0.2)


def amb_stairs(rng, dur=10.0, **_):
    t = tt(dur)
    hum = sum(np.sin(TAU * 100 * h * t + h) / h ** 1.3 for h in range(1, 10)) * 0.08
    air = lp(colored(rng, dur, -4), 600) * 0.2
    y = hum + air
    for s in np.arange(0.7, dur, 1.9):                             # a dripping pipe
        d = clunk(rng)[: n_(0.15)] * 0.12
        i = n_(s + rng.uniform(-0.2, 0.2))
        y[i:i + len(d)] += d[:len(y) - i]
    y = verb(y, room(rng, 1.8, damp=2500), 0.3)
    return fade(norm(y, 0.35), 0.4, 0.5)


SFX = {k: v for k, v in globals().items() if callable(v) and not k.startswith('_') and k not in (
    'n_', 'tt', 'db', 'sos', 'lp', 'hp', 'bp', 'peak', 'white', 'colored', 'env', 'fade', 'norm', 'partials', 'sweep', 'harm',
    'svf_bp', 'room', 'verb', 'pan', 'thump')}
SFX['thump'] = thump
