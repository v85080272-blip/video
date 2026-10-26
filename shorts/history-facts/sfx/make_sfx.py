#!/usr/bin/env python3
"""
make_sfx.py -- original sound-effects kit for a ~55 s cinematic short about the
Tunguska event (30 June 1908, Siberian taiga).

Everything is synthesized from scratch with numpy only (no samples, no downloads):
coloured noise by FFT shaping, RBJ biquads evaluated exactly in the FFT domain,
STFT time-varying filters, PolyBLEP saws, FM, narrow-band noise oscillators,
a pass-by (distance / Doppler / air absorption) model, synthetic convolution
reverb, a zero-overshoot lookahead limiter, seamless loop crossfades.

Output: 48 kHz / 24-bit stereo WAVs + manifest.json next to this script.
Usage:   python3 make_sfx.py                 (render everything)
         python3 make_sfx.py --only tick,boom_big
"""
import os
for _v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")
import sys
import json
import time
import wave
import zlib
import argparse
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

SR = 48000
TAU = 2.0 * np.pi
OUTDIR = os.path.dirname(os.path.abspath(__file__))


# ----------------------------------------------------------------------------
# basic helpers
# ----------------------------------------------------------------------------
def rng_for(name, k=0):
    """deterministic generator per sound / layer (re-runs give identical files)"""
    return np.random.default_rng(zlib.crc32(f"{name}:{k}".encode()))


def ns(sec):
    return int(round(sec * SR))


def tvec(n):
    return np.arange(n) / SR


def db2a(db):
    return 10.0 ** (np.asarray(db, dtype=float) / 20.0)


def a2db(a):
    return 20.0 * np.log10(np.maximum(np.abs(a), 1e-12))


def rms(x):
    return float(np.sqrt(np.mean(np.square(x))))


def nfast(n):
    """smallest 2^a*3^b*5^c >= n (fast FFT length)"""
    n = int(n)
    best = 1 << max(0, (n - 1).bit_length())
    p5 = 1
    while p5 < best:
        p35 = p5
        while p35 < best:
            p = p35
            while p < n:
                p *= 2
            best = min(best, p)
            p35 *= 3
        p5 *= 5
    return best


def place(dst, src, t0, gain=1.0):
    """add src (mono or stereo) into dst (stereo) starting at time t0 (clipped)"""
    src = np.atleast_2d(src)
    i0 = ns(t0)
    a, b = max(0, i0), min(dst.shape[-1], i0 + src.shape[-1])
    if b > a:
        dst[:, a:b] += gain * src[:, a - i0:b - i0]
    return dst


def st(x):
    """mono -> (2, n) copy; stereo passes through"""
    x = np.atleast_2d(np.asarray(x, dtype=float))
    return np.vstack([x, x]) if x.shape[0] == 1 else x


# ----------------------------------------------------------------------------
# filters: exact biquad / one-pole responses applied in the FFT domain
# ----------------------------------------------------------------------------
def bq_coefs(kind, f0, Q=0.7071, gain_db=0.0):
    """RBJ audio-EQ-cookbook coefficients; f0 / Q may be arrays (broadcast)"""
    f0 = np.clip(np.asarray(f0, dtype=float), 1.0, 0.49 * SR)
    w0 = TAU * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2.0 * np.asarray(Q, dtype=float))
    A = 10.0 ** (np.asarray(gain_db, dtype=float) / 40.0)
    one = np.ones_like(cw)
    a = (1 + alpha, -2 * cw, 1 - alpha)
    if kind == 'lp':
        b = ((1 - cw) / 2, 1 - cw, (1 - cw) / 2)
    elif kind == 'hp':
        b = ((1 + cw) / 2, -(1 + cw), (1 + cw) / 2)
    elif kind == 'bp':                     # 0 dB peak gain
        b = (alpha, 0 * one, -alpha)
    elif kind == 'notch':
        b = (one, -2 * cw, one)
    elif kind == 'ap':
        b = (1 - alpha, -2 * cw, 1 + alpha)
    elif kind == 'peak':
        b = (1 + alpha * A, -2 * cw, 1 - alpha * A)
        a = (1 + alpha / A, -2 * cw, 1 - alpha / A)
    elif kind == 'ls':
        sa = 2 * np.sqrt(A) * alpha
        b = (A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw),
             A * ((A + 1) - (A - 1) * cw - sa))
        a = ((A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw),
             (A + 1) + (A - 1) * cw - sa)
    elif kind == 'hs':
        sa = 2 * np.sqrt(A) * alpha
        b = (A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw),
             A * ((A + 1) + (A - 1) * cw - sa))
        a = ((A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw),
             (A + 1) - (A - 1) * cw - sa)
    else:
        raise ValueError(kind)
    return b, a


def bq_resp(kind, f0, Q, gain_db, f):
    b, a = bq_coefs(kind, f0, Q, gain_db)
    z1 = np.exp(-1j * TAU * np.asarray(f, dtype=float) / SR)
    z2 = z1 * z1
    return (b[0] + b[1] * z1 + b[2] * z2) / (a[0] + a[1] * z1 + a[2] * z2)


def bq_mag(kind, f0, f, Q=0.7071, gain_db=0.0):
    return np.abs(bq_resp(kind, f0, Q, gain_db, f))


BW4 = (0.5411961, 1.3065630)          # 4th-order Butterworth section Qs


def stage_resp(stg, f):
    kind, f0 = stg[0], stg[1]
    if kind in ('lp1', 'hp1'):
        a = np.exp(-TAU * np.asarray(f0, dtype=float) / SR)
        z1 = np.exp(-1j * TAU * np.asarray(f, dtype=float) / SR)
        if kind == 'lp1':
            return (1 - a) / (1 - a * z1)
        return (1 + a) / 2 * (1 - z1) / (1 - a * z1)
    if kind in ('lp4', 'hp4'):
        k = kind[:2]
        return bq_resp(k, f0, BW4[0], 0.0, f) * bq_resp(k, f0, BW4[1], 0.0, f)
    Q = stg[2] if len(stg) > 2 else 0.7071
    g = stg[3] if len(stg) > 3 else 0.0
    return bq_resp(kind, f0, Q, g, f)


def chain_resp(spec, f):
    H = np.ones(np.shape(f), dtype=complex)
    for stg in spec:
        H = H * stage_resp(stg, f)
    return H


def filt(x, spec, pad_s=1.0, circular=False):
    """Apply a cascade of IIR stages (list of tuples) or a callable H(f).
    Linear mode = causal IIR result (zero padded, tail dropped);
    circular=True keeps a periodic signal periodic (for loops)."""
    x = np.asarray(x, dtype=float)
    n = x.shape[-1]
    N = n if circular else nfast(n + int(pad_s * SR))
    X = np.fft.rfft(x, N, axis=-1)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    H = spec(f) if callable(spec) else chain_resp(spec, f)
    return np.fft.irfft(X * H, N, axis=-1)[..., :n]


def fftconv(x, h, n_out=None):
    x = np.asarray(x, dtype=float)
    h = np.asarray(h, dtype=float)
    n = x.shape[-1] + h.shape[-1] - 1
    N = nfast(n)
    y = np.fft.irfft(np.fft.rfft(x, N, axis=-1) * np.fft.rfft(h, N, axis=-1), N, axis=-1)
    return y[..., :(n_out or n)]


def tv_filter(x, gain_fn, nfft=2048, hop=None, block=256):
    """Time-varying zero-phase filtering by STFT overlap-add.
    gain_fn(t[:,None], f[None,:]) -> magnitude (frames x bins); t = frame centre (s)."""
    x = np.asarray(x, dtype=float)
    mono = x.ndim == 1
    x2 = np.atleast_2d(x)
    C, n = x2.shape
    hop = hop or nfft // 4
    win = 0.5 - 0.5 * np.cos(TAU * np.arange(nfft) / nfft)
    nfr = int(np.ceil((n + nfft) / hop)) + 1
    L = (nfr - 1) * hop + nfft
    xp = np.zeros((C, L))
    xp[:, nfft:nfft + n] = x2
    starts = np.arange(nfr) * hop
    tf = (starts + nfft / 2 - nfft) / SR
    fr = np.fft.rfftfreq(nfft, 1.0 / SR)
    y = np.zeros((C, L))
    wsum = np.zeros(L)
    w2 = win * win
    for s in starts:
        wsum[s:s + nfft] += w2
    for b0 in range(0, nfr, block):
        sl = slice(b0, min(nfr, b0 + block))
        G = np.broadcast_to(gain_fn(tf[sl][:, None], fr[None, :]), (sl.stop - sl.start, fr.size))
        for c in range(C):
            v = sliding_window_view(xp[c], nfft)[starts[sl]] * win
            out = np.fft.irfft(np.fft.rfft(v, axis=1) * G, nfft, axis=1) * win
            for i, s in enumerate(starts[sl]):
                y[c, s:s + nfft] += out[i]
    y /= np.maximum(wsum, 1e-9)
    y = y[:, nfft:nfft + n]
    return y[0] if mono else y


def at(arr, t):
    """sample an audio-rate control array at times t (any shape)"""
    return np.interp(t, tvec(len(arr)), arr)


# ----------------------------------------------------------------------------
# sources: noise, control curves, envelopes, oscillators
# ----------------------------------------------------------------------------
def colored(n, rng, slope_db=-3.0, fmin=15.0, fmax=None, channels=None):
    """Gaussian noise with spectral slope (dB/oct): 0 white, -3 pink, -6 brown.
    Unit RMS per channel. Periodic over n samples."""
    shape = (n,) if channels is None else (channels, n)
    X = np.fft.rfft(rng.standard_normal(shape), axis=-1)
    f = np.maximum(np.fft.rfftfreq(n, 1.0 / SR), 1e-3)
    g = (f / 1000.0) ** (slope_db / 6.0206)
    g = g * (f / fmin) ** 2 / (1.0 + (f / fmin) ** 2)
    if fmax:
        g = g / np.sqrt(1.0 + (f / fmax) ** 8)
    g[0] = 0.0
    y = np.fft.irfft(X * g, n, axis=-1)
    return y / (np.std(y, axis=-1, keepdims=True) + 1e-12)


def smooth_rand(n, rate, rng, ctrl=None):
    """band-limited random curve (mean 0, unit std), energy below ~rate Hz"""
    ctrl = ctrl or max(100.0, 8.0 * rate)
    m = int(n / SR * ctrl) + 8
    X = np.fft.rfft(rng.standard_normal(m))
    f = np.fft.rfftfreq(m, 1.0 / ctrl)
    X *= np.exp(-0.5 * (f / rate) ** 2)
    X[0] = 0.0
    c = np.fft.irfft(X, m)
    c /= c.std() + 1e-12
    return np.interp(tvec(n), np.arange(m) / ctrl, c)


def gust_curve(n, rate, rng, lo=0.0, hi=1.0, sharp=1.6):
    """0..1 gust intensity from a smooth random curve through a sigmoid"""
    r = smooth_rand(n, rate, rng)
    g = 1.0 / (1.0 + np.exp(-sharp * r))
    return lo + (hi - lo) * g


def env_pts(n, pts, db=False):
    """piecewise-linear breakpoint envelope [(t, v), ...]; db=True -> values in dB"""
    tt = np.array([p[0] for p in pts], dtype=float)
    vv = np.array([p[1] for p in pts], dtype=float)
    y = np.interp(tvec(n), tt, vv)
    return db2a(y) if db else y


def env_ad(n, t0, att, dec, hold=0.0):
    """onset at t0, raised-cosine attack, optional hold, exponential decay (time const.)"""
    t = tvec(n) - t0
    e = np.zeros(n)
    m = (t >= 0) & (t < att)
    e[m] = 0.5 - 0.5 * np.cos(np.pi * t[m] / att)
    m = (t >= att) & (t < att + hold)
    e[m] = 1.0
    m = t >= att + hold
    e[m] = np.exp(-(t[m] - att - hold) / dec)
    return e


def fade(x, fin=0.0, fout=0.0):
    x = np.array(x, dtype=float, copy=True)
    n = x.shape[-1]
    if fin > 0:
        k = max(1, ns(fin))
        x[..., :k] *= 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    if fout > 0:
        k = max(1, ns(fout))
        x[..., n - k:] *= 0.5 + 0.5 * np.cos(np.pi * (np.arange(k) + 1) / k)
    return x


def phase_of(freq, phi0=0.0):
    return phi0 + TAU * np.cumsum(np.asarray(freq, dtype=float)) / SR


def osc_sine(freq, n=None, phi0=0.0):
    if np.ndim(freq) == 0:
        freq = np.full(n, float(freq))
    return np.sin(phase_of(freq, phi0))


def osc_saw(freq, n=None, phi0=0.0):
    """PolyBLEP band-limited sawtooth (freq scalar or per-sample array)"""
    if np.ndim(freq) == 0:
        freq = np.full(n, float(freq))
    dt = np.asarray(freq, dtype=float) / SR
    ph = (phi0 / TAU + np.cumsum(dt)) % 1.0
    y = 2.0 * ph - 1.0
    m = ph < dt
    u = ph[m] / dt[m]
    y[m] -= u + u - u * u - 1.0
    m = ph > 1.0 - dt
    u = (ph[m] - 1.0) / dt[m]
    y[m] -= u * u + u + u + 1.0
    return y


def nb_noise(n, fc, bw, rng):
    """narrow-band noise around fc (scalar or array) with ~bw Hz bandwidth, unit RMS"""
    a = smooth_rand(n, bw / 2.0, rng)
    b = smooth_rand(n, bw / 2.0, rng)
    ph = phase_of(np.broadcast_to(np.asarray(fc, dtype=float), (n,)), rng.uniform(0, TAU))
    return (a * np.cos(ph) - b * np.sin(ph)) / np.sqrt(2.0)


def softclip(x, drive=2.0):
    return np.tanh(drive * x) / np.tanh(drive)


# ----------------------------------------------------------------------------
# space: panning, decorrelation, reverb, Doppler pass-by
# ----------------------------------------------------------------------------
def pan(x, p):
    """constant-power pan of mono x; p scalar or array in [-1, 1] -> (2, n)"""
    th = (np.clip(p, -1.0, 1.0) + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(th), x * np.sin(th)])


def widen(x, width, rng, stages=10):
    """mono -> stereo via M/S with an all-pass decorrelated side (mono compatible)"""
    fr = np.exp(rng.uniform(np.log(120.0), np.log(11000.0), stages))
    qs = rng.uniform(0.4, 1.6, stages)
    side = filt(x, [('ap', f0, q) for f0, q in zip(fr, qs)], pad_s=0.1) * width
    return np.stack([x + side, x - side])


def mono_bass(x, fc=100.0):
    """fold everything below fc to the centre (keeps sub/LFE content mono-solid)"""
    x = st(x)
    lo = filt(x, [('lp4', fc)], pad_s=0.3)
    return x - lo + lo.mean(axis=0, keepdims=True)


def make_ir(rt_lo, rt_hi, rng, dur=None, predelay=0.012, er=10, er_span=0.07,
            er_frac=0.25, build=0.012, lo_cut=None, hi_cut=None):
    """Synthetic stereo reverb IR: band-split decaying noise (frequency-dependent
    RT60), early reflections, pre-delay. Unit energy per channel."""
    dur = dur or 1.15 * max(rt_lo, rt_hi)
    n = ns(dur)
    t = tvec(n)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    cen = np.array([63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000.0])
    u = np.clip((np.log2(cen) - np.log2(125)) / (np.log2(8000) - np.log2(125)), 0, 1)
    rts = rt_lo * (rt_hi / rt_lo) ** u
    lf, lc = np.log2(np.maximum(f, 1.0)), np.log2(cen)
    masks = []
    for i in range(len(cen)):
        m = np.zeros_like(f)
        if i == 0:
            m[lf <= lc[0]] = 1.0
        else:
            s = (lf > lc[i - 1]) & (lf <= lc[i])
            m[s] = np.sin(0.5 * np.pi * (lf[s] - lc[i - 1]) / (lc[i] - lc[i - 1])) ** 2
        if i == len(cen) - 1:
            m[lf > lc[i]] = 1.0
        else:
            s = (lf > lc[i]) & (lf <= lc[i + 1])
            m[s] = np.cos(0.5 * np.pi * (lf[s] - lc[i]) / (lc[i + 1] - lc[i])) ** 2
        masks.append(m)
    ir = np.zeros((2, n))
    for c in range(2):
        X = np.fft.rfft(rng.standard_normal(n))
        for m, rt in zip(masks, rts):
            ir[c] += np.fft.irfft(X * m, n) * np.exp(-6.9078 * t / rt)
    ir *= 1.0 - np.exp(-t / build)
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    for c in range(2):                                   # early reflections
        d = np.sort(rng.uniform(0.004, er_span, er))
        g = rng.uniform(0.4, 1.0, er) * np.exp(-d / er_span) * rng.choice([-1.0, 1.0], er)
        g *= np.sqrt(er_frac / np.sum(g ** 2))
        for di, gi in zip(d, g):
            ir[c, ns(di)] += gi
    spec = []
    if lo_cut:
        spec.append(('hp', lo_cut, 0.7071))
    if hi_cut:
        spec.append(('lp', hi_cut, 0.7071))
    if spec:
        ir = filt(ir, spec, pad_s=0.05)
    ir = np.concatenate([np.zeros((2, ns(predelay))), ir], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


def reverb(x, ir, wet=0.25, dry=1.0):
    """convolution reverb; mono or stereo in -> stereo out (same length)"""
    x2 = st(x)
    n = x2.shape[-1]
    w = fftconv(x2, ir, n_out=n)
    return dry * x2 + wet * w


def frac_delay(x, d_samples):
    """time-varying delay (samples, array) by linear interpolation"""
    idx = np.arange(x.shape[-1]) - d_samples
    return np.interp(idx, np.arange(x.shape[-1]), x, left=0.0, right=0.0)


def passby(src, t0, v, r0, pan_width=0.9, lp_near=14000.0, lp_far=1200.0,
           amp_exp=1.0, itd=0.00055, c=343.0, pre=0.0):
    """Moving-source model on a mono source buffer (source time 0 == output time -pre).
    Distance -> gain (1/r^amp_exp), propagation delay (Doppler), air/obstruction
    low-pass and azimuth (constant-power pan + interaural delay). Returns (2, n)."""
    n = src.shape[-1] - ns(pre)
    t = tvec(n)
    xpos = v * (t - t0)
    dist = np.sqrt(r0 ** 2 + xpos ** 2)
    delay = dist / c
    y = np.interp((t - delay + pre) * SR, np.arange(src.shape[-1]), src, left=0.0, right=0.0)
    prox = r0 / dist
    y = y * prox ** amp_exp
    lp_t = lambda tt: lp_far + (lp_near - lp_far) * at(prox, tt) ** 2
    y = tv_filter(y, lambda tt, f: bq_mag('lp', lp_t(tt), f, 0.6), nfft=1024)
    az = np.clip(xpos / np.sqrt(xpos ** 2 + r0 ** 2), -1, 1) * pan_width
    out = pan(y, az)
    dl = np.maximum(az, 0) * itd * SR                       # source right -> delay left
    dr = np.maximum(-az, 0) * itd * SR
    out[0] = frac_delay(out[0], dl)
    out[1] = frac_delay(out[1], dr)
    return out, prox


# ----------------------------------------------------------------------------
# dynamics, loops, measurement, I/O
# ----------------------------------------------------------------------------
def limiter(x, ceiling_db=-1.0, look_ms=3.0, circular=False):
    """zero-overshoot lookahead limiter: sliding-min of required gain, smoothed
    by a window no wider than the min window (so the gain never exceeds it)."""
    x2 = np.atleast_2d(x)
    thr = float(db2a(ceiling_db))
    pk = np.max(np.abs(x2), axis=0)
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-12))
    if g.min() >= 1.0:
        return x
    H = max(1, ns(look_ms / 1000.0))
    mode = 'wrap' if circular else 'edge'
    gmin = sliding_window_view(np.pad(g, H, mode=mode), 2 * H + 1).min(axis=-1)
    w = np.hanning(2 * H + 3)[1:-1]
    w /= w.sum()
    gs = fftconv(np.pad(gmin, H, mode=mode), w)[2 * H:2 * H + g.size]
    return x2 * np.minimum(gs, g)


def true_peak(x, os_=4, taps=48):
    """max |x| including os_-times oversampled inter-sample values"""
    x2 = np.atleast_2d(x)
    tp = float(np.max(np.abs(x2)))
    k = np.arange(-taps // 2 + 1, taps // 2 + 1)
    win = np.kaiser(k.size, 9.0)
    for j in range(1, os_):
        h = np.sinc(k + j / os_) * win
        h /= h.sum()
        tp = max(tp, float(np.max(np.abs(fftconv(x2, h)))))
    return tp


def loopify(x, n_loop, n_xf):
    """seamless loop: crossfade the material after the loop end into the start
    (equal-power, for uncorrelated material). x: (C, >= n_loop + n_xf)."""
    out = np.array(x[:, :n_loop], copy=True)
    tail = x[:, n_loop:n_loop + n_xf]
    u = (np.arange(n_xf) + 0.5) / n_xf
    out[:, :n_xf] = out[:, :n_xf] * np.sin(0.5 * np.pi * u) + tail * np.cos(0.5 * np.pi * u)
    return out


def write_wav(path, x, bits=24):
    x2 = st(x)
    y = np.ascontiguousarray(np.clip(x2.T, -1.0, 1.0))
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setframerate(SR)
        if bits == 24:
            q = np.ascontiguousarray(np.round(y * 8388607.0).astype('<i4'))
            w.setsampwidth(3)
            w.writeframes(q.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes())
        else:
            w.setsampwidth(2)
            w.writeframes(np.round(y * 32767.0).astype('<i2').tobytes())


def read_wav(path):
    with wave.open(path, 'rb') as w:
        ch, sw, n = w.getnchannels(), w.getsampwidth(), w.getnframes()
        raw = np.frombuffer(w.readframes(n), dtype=np.uint8)
    if sw == 3:
        b = raw.reshape(-1, 3).astype(np.int32)
        v = (b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v) / 8388607.0
    else:
        v = raw.view('<i2') / 32767.0
    return v.reshape(-1, ch).T


BANDS = [(0, 60), (60, 100), (100, 250), (250, 500), (500, 2000), (2000, 6000), (6000, 24000)]


def band_fracs(x, bands=BANDS):
    x2 = np.atleast_2d(x)
    f = np.fft.rfftfreq(x2.shape[-1], 1.0 / SR)
    P = np.sum(np.abs(np.fft.rfft(x2, axis=-1)) ** 2, axis=0)
    tot = P.sum() + 1e-30
    fr = {f"{a}-{b}": float(P[(f >= a) & (f < b)].sum() / tot) for a, b in bands}
    return fr, float((P * f).sum() / tot), f, P


def frac_between(f, P, lo, hi):
    return float(P[(f >= lo) & (f < hi)].sum() / (P.sum() + 1e-30))


def short_rms(x, win_s=0.01):
    """RMS envelope (both channels), centred moving window"""
    p = np.mean(np.atleast_2d(x) ** 2, axis=0)
    k = max(1, ns(win_s))
    c = np.concatenate([[0.0], np.cumsum(p)])
    e = np.zeros_like(p)
    lo = np.clip(np.arange(p.size) - k // 2, 0, p.size)
    hi = np.clip(np.arange(p.size) + k // 2 + 1, 0, p.size)
    e[:] = (c[hi] - c[lo]) / (hi - lo)
    return np.sqrt(e)


def seam_metrics(x, win_s=0.05):
    """loop-joint checks: wrap-around step vs. typical sample steps, and the
    short-term level across the joint vs. the level range inside the file"""
    x2 = np.atleast_2d(x)
    k = ns(win_s)
    jj = np.concatenate([x2[:, -k:], x2[:, :k]], axis=1)          # +-win_s around the joint
    d = np.abs(np.diff(jj, axis=1))
    step = d[:, k - 1]                                             # the wrap-around step itself
    loc = np.delete(d, k - 1, axis=1)
    step_pct = float(max(np.mean(loc[c] < step[c]) for c in range(x2.shape[0])) * 100)
    joint = np.concatenate([x2[:, -k:], x2[:, :k]], axis=1)
    r_joint = a2db(rms(joint))
    m = x2.shape[1] // k
    blocks = x2[:, :m * k].reshape(x2.shape[0], m, k)
    r_blocks = a2db(np.sqrt(np.mean(blocks ** 2, axis=(0, 2)) * 2 / 2))
    return {"wrap_step_percentile": round(step_pct, 1),
            "joint_rms_db": round(float(r_joint), 2),
            "block_rms_db_range": [round(float(np.percentile(r_blocks, 1)), 2),
                                   round(float(np.percentile(r_blocks, 99)), 2)]}


# ============================================================================
# sound registry
# ============================================================================
REG = {}


def sound(name, dur, kind, desc, hit=None, norm=('peak', -1.0), loop=False, hp=15.0,
          fout=0.0, checks=()):
    """kind: hit | oneshot | loop | bed.  hit: designed sync time (s) or 'measure'.
    checks: (label, lo_hz, hi_hz, min_frac, max_frac) on the final file."""
    def deco(fn):
        REG[name] = dict(fn=fn, dur=dur, kind=kind, desc=desc, hit=hit, norm=norm,
                         loop=loop, hp=hp, fout=fout, checks=list(checks))
        return fn
    return deco


# ============================================================================
# 1) big distant explosion
# ============================================================================
@sound('boom_big', 9.0, 'hit', hit=0.10, hp=12.0, fout=0.4,
       desc="Huge distant explosion: N-wave crack + terrain echoes, 62->32 Hz sub boom, "
            "7-8 s rolling low rumble tail, big outdoor reverb.",
       checks=[('energy <100 Hz', 0, 100, 0.60, 1.0), ('energy >2 kHz', 2000, 24000, 0.0, 0.03)])
def gen_boom_big(name, D):
    n, T0 = ns(D), 0.10
    r = lambda k: rng_for(name, k)
    t = tvec(n)
    tt = np.maximum(t - T0, 0.0)
    # crack: band-limited N-wave (shock front) + short noise burst
    Tn = 0.016
    rel = t - T0
    nwave = np.where((rel >= 0) & (rel < Tn), 1.0 - 2.0 * rel / Tn, 0.0)
    nwave = filt(nwave, [('lp', 3200, 0.7071), ('hp', 35, 0.7071)])
    burst = filt(r(1).standard_normal(n), [('hp', 600, 0.7071), ('lp', 5500, 0.7071)])
    burst *= env_ad(n, T0, 0.0004, 0.007)
    crack = nwave / np.max(np.abs(nwave)) + 0.45 * burst / np.max(np.abs(burst))
    crack_st = st(crack)
    # terrain / forest-edge echoes of the crack, each darker and from another side
    for d, g, lp, p in [(0.052, 0.42, 2400, -0.7), (0.118, 0.33, 1800, 0.6), (0.205, 0.26, 1400, -0.3),
                        (0.33, 0.19, 1100, 0.8), (0.51, 0.13, 850, -0.8), (0.74, 0.08, 700, 0.2)]:
        e = np.zeros(n)
        i = ns(d)
        e[i:] = crack[:n - i]
        crack_st += g * pan(filt(e, [('lp', lp, 0.7071)]), p) * np.sqrt(2)
    # sub boom: falling sine with slight saturation
    fsub = 32.0 + 30.0 * np.exp(-tt / 0.45)
    sub = softclip(osc_sine(fsub, phi0=0.0) * env_ad(n, T0, 0.012, 1.0, hold=0.08), 1.3)
    # body: brown noise, low-pass closing from ~1.7 kHz to ~80 Hz (filter first, then envelope)
    fcb = lambda x_: 120.0 + 1650.0 * np.exp(-np.maximum(x_ - T0, 0.0) / 0.16)
    body = tv_filter(colored(n, r(2), -6.0, fmin=20, channels=2),
                     lambda x_, f: bq_mag('lp', fcb(x_), f, 0.8) ** 2, nfft=1024)
    body *= env_ad(n, T0, 0.006, 0.65)
    # rolling rumble: 4th-order low-passed brown noise with random rolling swells
    rum = filt(colored(n, r(3), -6.0, fmin=18, channels=2), [('lp4', 140.0), ('hp', 22.0, 0.7071)])
    common = smooth_rand(n, 1.2, r(4))
    roll = np.stack([np.exp(0.6 * (0.8 * common + 0.6 * smooth_rand(n, 1.6, r(5 + c)))) for c in range(2)])
    roll /= roll.mean()
    rum_env = env_pts(n, [(0, -90), (T0, -90), (T0 + 0.3, -8), (T0 + 0.9, -2), (2.2, -6), (4.0, -12),
                          (6.0, -19), (7.6, -28), (8.6, -45), (9.0, -70)], db=True)
    rumble = rum * roll * rum_env
    # mid growl: gives the rumble a texture on small speakers
    growl = filt(colored(n, r(7), -3.0, channels=2), [('bp', 210, 0.8), ('lp', 700, 0.7071)])
    growl *= roll * env_pts(n, [(0, -90), (T0, -90), (T0 + 0.12, 0), (1.2, -6), (3.0, -18), (5.5, -34),
                                (7.5, -60)], db=True)
    ir = make_ir(4.5, 1.1, r(9), dur=5.5, predelay=0.035, er=14, er_span=0.3, er_frac=0.35, lo_cut=30)
    x = 1.0 * st(sub)
    x += reverb(0.6 * crack_st + 0.55 * body + 0.22 * growl, ir, wet=0.55, dry=1.0)
    x += reverb(0.34 * rumble, ir, wet=0.30, dry=1.0)
    return dict(x=x)


# ============================================================================
# 2) cinematic hook: braam + sub drop
# ============================================================================
@sound('boom_hook', 3.0, 'hit', hit=0.02, hp=18.0, fout=0.35,
       desc="Punchy cinematic opener: kick punch + 88->30 Hz sub drop + distorted low brass-like "
            "braam (D1/D2/A2 detuned saws, opening filter, pitch scoop), hall reverb.",
       checks=[('energy <250 Hz', 0, 250, 0.55, 1.0), ('energy 100-2000 Hz', 100, 2000, 0.12, 0.5)])
def gen_boom_hook(name, D):
    n, T0 = ns(D), 0.02
    r = lambda k: rng_for(name, k)
    tt = np.maximum(tvec(n) - T0, 0.0)
    kick = osc_sine(48.0 + 150.0 * np.exp(-tt / 0.028)) * env_ad(n, T0, 0.0015, 0.22)
    sub = softclip(1.3 * osc_sine(30.0 + 58.0 * np.exp(-tt / 0.40), phi0=0.4)
                   * env_ad(n, T0, 0.006, 0.55, hold=0.06), 1.5)
    scoop = 2.0 ** (-(45.0 / 1200.0) * np.exp(-tt / 0.07))
    L, R = np.zeros(n), np.zeros(n)
    rr = r(1)
    for f0, g in [(36.71, 0.9), (73.42, 1.0), (110.0, 0.5), (146.83, 0.3)]:
        for det, p in [(-9.0, -0.65), (0.0, 0.0), (8.0, 0.65)]:
            drift = 1.0 + 0.0012 * smooth_rand(n, 2.5, rr)
            s = g * osc_saw(f0 * 2 ** (det / 1200.0) * scoop * drift, phi0=rr.uniform(0, TAU))
            th = (p + 1) * np.pi / 4
            L += s * np.cos(th)
            R += s * np.sin(th)
    fc = lambda x_: 130.0 + 2600.0 * (1 - np.exp(-np.maximum(x_ - T0, 0) / 0.035)) \
        * np.exp(-np.maximum(x_ - T0, 0) / 0.7)
    braam = tv_filter(np.stack([L, R]), lambda x_, f: bq_mag('lp', fc(x_), f, 1.5)
                      * bq_mag('peak', 650.0, f, 1.0, 6.0), nfft=1024)
    braam *= env_ad(n, T0, 0.010, 0.48, hold=0.14)
    braam = softclip(2.8 * braam / np.max(np.abs(braam)), 1.8)
    braam = filt(braam, [('lp', 5200, 0.7071), ('hp', 32, 0.7071)])
    hitn = filt(colored(n, r(2), 0.0, channels=2), [('hp', 180, 0.7071), ('lp', 4500, 0.7071)])
    hitn *= env_ad(n, T0, 0.0005, 0.014)
    ir = make_ir(2.6, 0.9, r(3), predelay=0.02, er_span=0.09, lo_cut=60)
    x = st(0.85 * kick + 0.75 * sub)
    x += reverb(0.85 * braam + 0.35 * hitn, ir, wet=0.32, dry=1.0)
    return dict(x=mono_bass(x, 100.0))


# ============================================================================
# 3) shockwave: rushing wind blast passing by (Doppler model)
# ============================================================================
@sound('shockwave', 4.0, 'hit', hit=1.45, hp=20.0, fout=0.3,
       desc="Rushing wind blast that passes left->right: roaring filtered noise with whistling "
            "resonances, physical Doppler/distance sweep, pressure thump, debris and turbulent tail.",
       checks=[('energy 100-6000 Hz', 100, 6000, 0.55, 1.0)])
def gen_shockwave(name, D):
    n, T0, pre = ns(D), 1.45, 1.2
    r = lambda k: rng_for(name, k)
    m = n + ns(pre)
    src = 0.9 * colored(m, r(1), -3.0, fmin=60) + 0.5 * colored(m, r(2), -6.0, fmin=70)
    whis = filt(colored(m, r(3), 0.0), [('bp', 520, 6.0)])
    whis2 = filt(colored(m, r(4), 0.0), [('bp', 1300, 8.0)])
    src += 0.5 * whis / whis.std() + 0.3 * whis2 / whis2.std()
    src *= 1.0 + 0.35 * smooth_rand(m, 9.0, r(5))
    y, prox = passby(src, T0, v=130.0, r0=9.0, pan_width=0.85, lp_near=13000.0, lp_far=900.0,
                     amp_exp=1.25, pre=pre)
    tt = np.maximum(tvec(n) - T0, 0.0)
    thump = osc_sine(38.0 + 30.0 * np.exp(-tt / 0.12)) * env_ad(n, T0 - 0.02, 0.03, 0.25)
    thump += 0.8 * filt(colored(n, r(6), -6.0, fmin=25), [('lp', 140, 0.7071)]) * env_ad(n, T0 - 0.03, 0.04, 0.3)
    aft = tv_filter(colored(n, r(7), -3.0, channels=2),
                    lambda x_, f: bq_mag('lp', 500.0 + 3500.0 * np.exp(-np.maximum(x_ - T0, 0) / 0.5), f, 0.7),
                    nfft=1024)
    aft *= env_pts(n, [(0, -90), (T0 - 0.15, -40), (T0 + 0.08, 0), (T0 + 0.8, -9), (D, -36)], db=True)
    aft *= np.clip(1.0 + 0.45 * smooth_rand(n, 2.5, r(8)), 0.2, None)
    deb = np.zeros((2, n))
    rr = r(9)
    for _ in range(140):
        td = T0 + 0.05 + rr.exponential(0.45)
        if td > D - 0.05:
            continue
        L = ns(rr.uniform(0.002, 0.012))
        tk = np.arange(L) / SR
        click = rr.standard_normal(L) * np.exp(-tk / (tk[-1] / 4 + 1e-4))
        click = filt(click, [('bp', rr.uniform(900, 4500), 1.5)], pad_s=0.01)
        a = 0.25 * rr.lognormal(0, 0.6) * np.exp(-(td - T0) / 0.8)
        place(deb, pan(click, rr.uniform(-0.9, 0.9)), td, a)
    x = y / np.max(np.abs(y)) + 0.30 * st(thump) / np.max(np.abs(thump)) + 0.35 * aft / np.max(np.abs(aft))
    x += 0.5 * deb / (np.max(np.abs(deb)) + 1e-9) * 0.4
    ir = make_ir(2.2, 0.7, r(10), predelay=0.02, er_span=0.12, lo_cut=50)
    return dict(x=reverb(x, ir, wet=0.22))


# ============================================================================
# 4) earthquake rumble
# ============================================================================
@sound('rumble_long', 8.0, 'hit', hit='measure', hp=14.0, fout=0.6,
       desc="Earthquake-like low rumble: tremoring brown-noise rumble below 100 Hz, ~34 Hz groan, "
            "rock/earth grinding rattle; swells to a peak (hit_s) and dies away.",
       checks=[('energy <100 Hz', 0, 100, 0.65, 1.0)])
def gen_rumble_long(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    com = filt(colored(n, r(1), -6.0, fmin=15), [('lp4', 95.0)])
    base = np.stack([0.7 * com + 0.7 * filt(colored(n, r(2 + c), -6.0, fmin=15), [('lp4', 95.0)])
                     for c in range(2)])
    swell = np.exp(0.5 * smooth_rand(n, 0.35, r(4)))
    tremor = np.clip(1.0 + 0.32 * smooth_rand(n, 7.0, r(5)), 0.1, None)
    groan = nb_noise(n, 34.0 + 5.0 * smooth_rand(n, 0.3, r(6)), 5.0, r(7))
    rr = r(8)
    grains = np.zeros(n)
    for td in np.cumsum(rr.exponential(1 / 16.0, 400)):
        if td >= D:
            break
        grains[ns(td)] += rr.lognormal(0, 0.5)
    grains = fftconv(grains, np.hanning(ns(0.04)))[:n]
    grind = filt(colored(n, r(9), -3.0, channels=2), [('bp', 330, 0.9), ('lp', 900, 0.7071)])
    grind *= grains / (grains.max() + 1e-9)
    env = env_pts(n, [(0, -60), (0.4, -30), (1.5, -10), (2.6, -2), (3.2, 0), (4.4, -3), (5.6, -6),
                      (6.6, -12), (7.5, -26), (8.0, -60)], db=True)
    x = (base * swell * tremor + 0.55 * st(groan) + 0.25 * grind / grind.std()) * env
    ir = make_ir(1.8, 0.6, r(10), predelay=0.02, lo_cut=25)
    return dict(x=reverb(x, ir, wet=0.2))


# ============================================================================
# 5) whooshes (pass-by model)
# ============================================================================
def make_whoosh(name, D, T0, v, r0, res_f, body=0.3):
    n, pre = ns(D), 0.3
    r = lambda k: rng_for(name, k)
    m = n + ns(pre)
    res = filt(colored(m, r(2), 0.0), [('bp', res_f, 2.5)])
    air = filt(colored(m, r(3), 0.0), [('hp', 4500, 0.7071)])
    s = 0.7 * colored(m, r(1), -1.5) + 0.6 * res / res.std() + 0.25 * air / air.std()
    y, prox = passby(s, T0, v, r0, pan_width=0.8, lp_near=12000.0, lp_far=700.0, amp_exp=1.6, pre=pre)
    low = filt(colored(n, r(4), -3.0, fmin=60), [('hp', 80, 0.7071), ('lp', 260, 0.7071)]) * prox ** 3
    return dict(x=y / np.max(np.abs(y)) + body * st(low) / np.max(np.abs(low)))


@sound('whoosh_short', 0.6, 'oneshot', hit=0.33, hp=30.0, fout=0.08,
       desc="Short transition whoosh (L->R pass-by of airy noise with Doppler resonance).",
       checks=[('energy 300-8000 Hz', 300, 8000, 0.5, 1.0)])
def gen_whoosh_short(name, D):
    return make_whoosh(name, D, 0.33, 45.0, 1.6, 950.0)


@sound('whoosh_long', 1.5, 'oneshot', hit=0.90, hp=30.0, fout=0.15,
       desc="Long transition whoosh (slower L->R pass-by, deeper body, Doppler resonance).",
       checks=[('energy 300-8000 Hz', 300, 8000, 0.45, 1.0)])
def gen_whoosh_long(name, D):
    return make_whoosh(name, D, 0.90, 22.0, 1.8, 700.0, body=0.4)


# ============================================================================
# 6) tension risers (hard cut at the end)
# ============================================================================
def make_riser(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    t = tvec(n)
    u = t / D
    fc = lambda x_: 250.0 * (9000.0 / 250.0) ** (np.clip(x_ / D, 0, 1) ** 1.6)
    nz = tv_filter(colored(n, r(1), -1.0, channels=2),
                   lambda x_, f: bq_mag('bp', fc(x_), f, 1.2) + 0.25 * bq_mag('hp', fc(x_), f), nfft=1024)
    nz *= u ** 2.5
    semis = 12.0 * u ** 1.8
    L, R = np.zeros(n), np.zeros(n)
    rr = r(2)
    for f0, p in [(146.83, -0.5), (220.0, 0.5), (293.66, -0.2), (311.13, 0.25)]:
        for det in (-7.0, 7.0):
            s = osc_saw(f0 * 2 ** ((semis * 100 + det) / 1200.0), phi0=rr.uniform(0, TAU))
            th = (np.clip(p + det / 30.0, -1, 1) + 1) * np.pi / 4
            L += s * np.cos(th)
            R += s * np.sin(th)
    tonal = tv_filter(np.stack([L, R]),
                      lambda x_, f: bq_mag('lp', 500.0 * 14.0 ** np.clip(x_ / D, 0, 1), f, 1.0), nfft=1024)
    trem_rate = 4.0 + 14.0 * u ** 1.5
    trem = 1.0 - (0.15 + 0.5 * u) * (0.5 + 0.5 * np.sin(phase_of(trem_rate)))
    tonal *= u ** 2.0 * trem
    sub = osc_sine(40.0 * 2 ** (u * 1.1)) * u ** 2
    # reverse-reverb swell into the cut
    m = ns(min(D, 3.0))
    stab = np.zeros(m)
    k = ns(0.06)
    stab[:k] = r(3).standard_normal(k) * np.exp(-np.arange(k) / (0.015 * SR))
    stab[:k] += 0.8 * np.sin(TAU * 293.66 * np.arange(k) / SR) * np.exp(-np.arange(k) / (0.03 * SR))
    ir = make_ir(2.5, 1.0, r(4), dur=m / SR, predelay=0.0)
    rev = fftconv(st(stab), ir, n_out=m)[:, ::-1]
    rev = rev * np.linspace(0, 1, m) ** 1.5
    revf = np.zeros((2, n))
    revf[:, n - m:] = rev
    x = 0.6 * nz / np.max(np.abs(nz)) + 0.5 * tonal / np.max(np.abs(tonal)) \
        + 0.22 * st(sub) + 0.5 * revf / np.max(np.abs(revf))
    return dict(x=x)


@sound('riser_2s', 2.0, 'oneshot', hit=2.0, hp=25.0, fout=0.003,
       desc="2 s tension riser (noise sweep + rising detuned cluster with accelerating tremolo + "
            "reverse-reverb swell), ends abruptly for a hard cut (hit_s = cut).")
def gen_riser_2s(name, D):
    return make_riser(name, D)


@sound('riser_4s', 4.0, 'oneshot', hit=4.0, hp=25.0, fout=0.003,
       desc="4 s tension riser (same design, longer build), ends abruptly for a hard cut (hit_s = cut).")
def gen_riser_4s(name, D):
    return make_riser(name, D)


# ============================================================================
# 7) sub drop, 8) soft impact
# ============================================================================
@sound('sub_drop', 1.5, 'hit', hit=0.02, hp=12.0, fout=0.15,
       desc="Sub drop: sine gliding 122->27 Hz with soft saturation and a faint 2nd harmonic.",
       checks=[('energy <120 Hz', 0, 120, 0.85, 1.0)])
def gen_sub_drop(name, D):
    n, T0 = ns(D), 0.02
    tt = np.maximum(tvec(n) - T0, 0.0)
    f = 27.0 + 95.0 * np.exp(-tt / 0.32)
    env = env_ad(n, T0, 0.004, 0.55, hold=0.05)
    s = osc_sine(f) + 0.12 * osc_sine(2 * f, phi0=0.5)
    click = filt(rng_for(name, 1).standard_normal(n), [('hp', 150, 0.7071), ('lp', 2500, 0.7071)])
    click *= env_ad(n, T0, 0.0003, 0.002)
    return dict(x=st(softclip(1.2 * s * env, 1.2) + 0.08 * click / np.max(np.abs(click))))


@sound('impact_soft', 0.8, 'hit', hit=0.015, hp=25.0, fout=0.12,
       desc="Soft text-slam impact: short low thump, padded 'fwump', tiny crisp top, small room.",
       checks=[('energy <250 Hz', 0, 250, 0.5, 1.0), ('energy 100-2000 Hz', 100, 2000, 0.12, 0.6)])
def gen_impact_soft(name, D):
    n, T0 = ns(D), 0.015
    r = lambda k: rng_for(name, k)
    tt = np.maximum(tvec(n) - T0, 0.0)
    body = osc_sine(46.0 + 50.0 * np.exp(-tt / 0.05)) * env_ad(n, T0, 0.002, 0.16)
    thud = filt(colored(n, r(1), 0.0, channels=2), [('lp', 500, 0.8)]) * env_ad(n, T0, 0.001, 0.04)
    fwump = filt(colored(n, r(2), 0.0, channels=2), [('bp', 210, 1.2)]) * env_ad(n, T0, 0.004, 0.09)
    snap = filt(colored(n, r(3), 0.0, channels=2), [('hp', 2500, 0.7071), ('lp', 7000, 0.7071)])
    snap *= env_ad(n, T0, 0.0004, 0.005)
    x = st(0.8 * body) + 0.8 * thud / np.max(np.abs(thud)) + 0.6 * fwump / np.max(np.abs(fwump)) \
        + 0.14 * snap / np.max(np.abs(snap))
    ir = make_ir(0.45, 0.25, r(4), predelay=0.004, er_span=0.03)
    return dict(x=mono_bass(reverb(x, ir, wet=0.16), 100.0))


# ============================================================================
# ambience helpers
# ============================================================================
def loop_buffer(D, xf, pre):
    """sizes for a loop render: pre-roll (filters/reverb settle) + loop + crossfade tail"""
    return ns(pre + D + xf), ns(pre), ns(D), ns(xf)


def bird_note(dur, f0, f1, rng, shape='exp', vib=(0.0, 0.0), h2=0.05, att=0.008, rel=0.02):
    """FM bird note: swept carrier + sinusoidal FM (vibrato) + faint 2nd harmonic"""
    n = ns(dur)
    u = np.arange(n) / n
    if shape == 'exp':
        f = f0 * (f1 / f0) ** u
    elif shape == 'arch':
        f = f0 + (f1 - f0) * np.sin(np.pi * u)
    else:
        f = f0 + (f1 - f0) * u
    if vib[1] > 0:
        f = f + vib[1] * np.sin(TAU * vib[0] * np.arange(n) / SR + rng.uniform(0, TAU))
    ph = phase_of(f, rng.uniform(0, TAU))
    y = np.sin(ph) + h2 * np.sin(2 * ph + 0.3)
    a, rl = max(1, ns(att)), max(1, ns(rel))
    e = np.ones(n)
    e[:a] = 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    e[-rl:] = 0.5 + 0.5 * np.cos(np.pi * (np.arange(rl) + 1) / rl)
    return y * e


def seq(parts):
    """concatenate (gap_s, mono, gain) parts into one phrase"""
    out = []
    for gap, y, g in parts:
        out.append(np.zeros(ns(gap)))
        out.append(g * y)
    return np.concatenate(out)


def ph_whistle(rng, k=1.0):          # two-note "fee-bee" whistle
    return seq([(0, bird_note(0.30, 4200 * k, 3950 * k, rng, vib=(34, 28)), 1.0),
                (0.06, bird_note(0.36, 3480 * k, 3360 * k, rng, vib=(30, 22)), 0.8)])


def ph_chirps(rng, cnt=4, k=1.0):    # quick rising chirps
    return seq([(0.09 if i else 0, bird_note(rng.uniform(0.04, 0.06), 2600 * k * rng.uniform(0.95, 1.05),
                                             5200 * k * rng.uniform(0.95, 1.05), rng, att=0.004, rel=0.012),
                 1.0 - 0.12 * i) for i in range(cnt)])


def ph_trill(rng, dur=1.2):          # descending trill, ~18 notes/s
    notes = int(dur * 18)
    parts = []
    for i in range(notes):
        u = i / max(1, notes - 1)
        fc = 4900 - 1100 * u
        g = np.sin(np.pi * min(1.0, 0.15 + u)) ** 0.5 * (1 - 0.3 * u)
        parts.append((0.0205 if i else 0, bird_note(0.035, fc + 380, fc - 380, rng, shape='lin',
                                                    att=0.004, rel=0.012), g))
    return seq(parts)


def ph_warble(rng, dur=0.55):        # FM warble with matching AM
    n = ns(dur)
    t = np.arange(n) / SR
    fm = 21.0
    f = 3500 + 200 * t / dur + 650 * np.sin(TAU * fm * t)
    y = np.sin(phase_of(f, rng.uniform(0, TAU))) * (0.65 + 0.35 * np.sin(TAU * fm * t + 1.0))
    return y * np.sin(np.pi * t / dur) ** 0.6


def creak(dur, rng, rate=(40.0, 95.0)):
    """dead-tree creak: stick-slip pulse train exciting wooden body modes"""
    n = ns(dur)
    rt = rate[0] + (rate[1] - rate[0]) * (0.5 + 0.5 * np.tanh(smooth_rand(n, 2.5, rng)))
    ph = np.cumsum(rt) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    p = np.zeros(n)
    p[idx] = 1.0 + 0.35 * rng.standard_normal(idx.size)
    tk = np.arange(ns(0.06)) / SR
    body = sum(a * np.exp(-tk / tau) * np.sin(TAU * f * rng.uniform(0.97, 1.03) * tk)
               for f, tau, a in [(380, 0.025, 1.0), (760, 0.015, 0.6), (1150, 0.010, 0.4),
                                 (1830, 0.006, 0.25), (2600, 0.004, 0.15)])
    y = fftconv(p, body)[:n]
    u = np.arange(n) / n
    return y * np.sin(np.pi * u) ** 0.7 * (0.75 + 0.25 * np.tanh(smooth_rand(n, 4.0, rng)))


# ============================================================================
# 9) morning taiga ambience (loop)
# ============================================================================
@sound('ambience_morning_taiga', 12.0, 'loop', hit=0.0, norm=('rms', -28.0), loop=True, hp=30.0,
       desc="Loopable morning taiga: gentle gusting wind in pines, sparse FM-synth birdsong "
            "(whistles, chirps, trill, warble at 2-6 kHz, near & far), distant river on the right.",
       checks=[('energy 100-6000 Hz', 100, 6000, 0.7, 1.0)])
def gen_taiga(name, D):
    xf, pre = 1.5, 1.0
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    r = lambda k: rng_for(name, k)
    g = gust_curve(n, 0.12, r(1), sharp=1.4)
    gs = np.stack([g, np.roll(g, ns(0.35))])               # gust travels across the stereo field
    fcw = lambda x_: 700.0 + 900.0 * at(g, x_)
    wind = tv_filter(colored(n, r(2), -3.0, channels=2),
                     lambda x_, f: (bq_mag('bp', fcw(x_), f, 0.55) + 0.06 * bq_mag('hp', 3500.0, f))
                     * bq_mag('hs', 4000.0, f, 0.7071, -4.0), nfft=2048)
    wind *= 0.3 + 0.7 * gs ** 1.5
    hiss = filt(colored(n, r(3), 0.0, channels=2), [('hp', 3000, 0.7071), ('lp', 9000, 0.7071)]) * gs ** 2
    low = filt(colored(n, r(4), -6.0, fmin=30, channels=2), [('lp', 180, 0.7071)])
    river = filt(colored(n, r(5), -3.0, channels=2),
                 [('hp', 160, 0.7), ('lp', 1600, 0.7), ('peak', 450, 0.8, 3.0)])
    river *= 1.0 + 0.08 * smooth_rand(n, 6.0, r(6))
    rb = r(7)
    bub = np.zeros(n)
    for td in np.cumsum(rb.exponential(1 / 45.0, int(45 * n / SR * 1.3))):
        if td >= n / SR - 0.05:
            break
        L = ns(rb.uniform(0.008, 0.025))
        f0 = rb.uniform(300, 1100)
        tk = np.arange(L) / SR
        b = np.sin(phase_of(f0 * (1 + rb.uniform(0.3, 0.6) * tk / tk[-1]))) * np.hanning(L)
        bub[ns(td):ns(td) + L] += rb.lognormal(0, 0.5) * b
    bub = filt(bub, [('lp', 1500, 0.7071)])
    river = river / rms(river) + 0.25 * bub / rms(bub)
    river = np.stack([0.55 * river[0], 1.0 * river[1]])
    # birds: (loop position s, phrase, pan, gain, far?)
    rb = r(8)
    plan = [(1.8, ph_whistle(rb), -0.4, 1.0, False), (3.3, ph_chirps(rb, 4), 0.55, 0.6, False),
            (4.9, ph_trill(rb), -0.75, 0.75, True), (6.6, ph_whistle(rb, 1.03), -0.35, 0.9, False),
            (7.8, ph_warble(rb), 0.2, 0.55, False), (9.3, ph_chirps(rb, 3, 0.97), 0.6, 0.55, False),
            (10.4, ph_whistle(rb, 0.98), 0.85, 0.45, True)]
    near, far = np.zeros((2, n)), np.zeros((2, n))
    for pos, y, p, gain, is_far in plan:
        place(far if is_far else near, pan(y, p), pre + pos, gain)
    near = filt(near, [('lp', 9000, 0.7071)])
    far = filt(far, [('lp', 6500, 0.7071)])
    ir = make_ir(1.3, 0.5, r(9), predelay=0.015, er_span=0.06, lo_cut=150)
    birds = reverb(near, ir, wet=0.28) + reverb(far, ir, wet=0.65, dry=0.8)
    stem_birds = (near + far)[:, n0:n0 + nl]
    bed = wind / rms(wind) + 0.12 * hiss / rms(hiss) + 0.25 * low / rms(low) + 0.4 * river
    x = bed + 6.0 * rms(bed) * birds / np.max(np.abs(birds))
    x = loopify(x[:, n0:], nl, nx)
    fr, _, f, P = band_fracs(stem_birds)
    return dict(x=x, extra_checks=[('bird stem energy 2-6 kHz', frac_between(f, P, 2000, 6000), 0.80, 1.0)])


# ============================================================================
# 10) cold eerie wind in the dead forest (loop)
# ============================================================================
@sound('ambience_wind_dead_forest', 15.0, 'loop', hit=0.0, norm=('rms', -28.0), loop=True, hp=25.0,
       desc="Loopable cold, eerie wind in the dead forest: slow gusts, low resonant howls whose pitch "
            "follows the gusts, faint branch whistle, distant dead-tree creaks, wide reverb.",
       checks=[('energy 100-3000 Hz', 100, 3000, 0.6, 1.0)])
def gen_dead_forest(name, D):
    xf, pre = 2.0, 1.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    r = lambda k: rng_for(name, k)
    g = gust_curve(n, 0.07, r(1), sharp=1.8)
    fcb = lambda x_: 450.0 + 1300.0 * at(g, x_)
    base = tv_filter(colored(n, r(2), -3.0, channels=2),
                     lambda x_, f: bq_mag('bp', fcb(x_), f, 0.7) + 0.15 * bq_mag('hp', 2500.0, f), nfft=2048)
    base *= 0.22 + 0.78 * g ** 1.6
    howl = np.zeros((2, n))
    for k, (f0, p, a) in enumerate([(212.0, -0.55, 1.0), (318.0, 0.35, 0.7), (472.0, 0.7, 0.45)]):
        fcur = f0 * (1.0 + 0.22 * (g - 0.5) + 0.015 * smooth_rand(n, 0.5, r(10 + k)))
        howl += pan(nb_noise(n, fcur, 7.0, r(20 + k)) * g ** 2.2 * a, p)
    wh = pan(nb_noise(n, 1240.0 * (1.0 + 0.3 * (g - 0.5)), 3.0, r(30)) * g ** 4, 0.1)
    low = filt(colored(n, r(31), -6.0, fmin=20, channels=2), [('lp4', 75.0)])
    cr = np.zeros((2, n))
    rc = r(32)
    for pos, dur, p in [(4.2, 1.1, -0.6), (10.8, 0.8, 0.5)]:
        c = filt(creak(dur, rc), [('lp', 2500, 0.7071), ('hp', 200, 0.7071)])
        place(cr, pan(c / np.max(np.abs(c)), p), pre + pos)
    ir = make_ir(2.4, 0.8, r(40), predelay=0.025, er_span=0.1, lo_cut=80)
    x = base / rms(base) + 0.6 * howl / rms(howl) + 0.10 * wh / rms(wh) + 0.3 * low / rms(low)
    x = reverb(x, ir, wet=0.3) + reverb(7.0 * cr, ir, wet=0.8, dry=0.5)
    return dict(x=loopify(x[:, n0:], nl, nx))


# ============================================================================
# 11) fire crackle (loop)
# ============================================================================
def crackle_click(rng, fc, tau, noise=0.6):
    L = max(8, ns(tau * 7))
    tk = np.arange(L) / SR
    return np.exp(-tk / tau) * (np.sin(TAU * fc * tk + rng.uniform(0, TAU)) + noise * rng.standard_normal(L))


@sound('fire_crackle', 8.0, 'loop', hit=0.0, norm=('rms', -28.0), loop=True, hp=35.0,
       desc="Loopable campfire: crisp wood crackles, pops and occasional snaps over a soft flame "
            "roar, flame licks and ember hiss; bursty density, wide stereo.",
       checks=[('energy >1 kHz', 1000, 24000, 0.35, 1.0)])
def gen_fire(name, D):
    xf, pre = 1.0, 0.5
    n, n0, nl, nx = loop_buffer(D, xf, pre)
    r = lambda k: rng_for(name, k)
    roar = filt(colored(n, r(1), -6.0, fmin=30, channels=2), [('lp', 260, 0.7071), ('hp', 40, 0.7071)])
    roar *= 1.0 + 0.25 * smooth_rand(n, 4.0, r(2))
    lick = filt(colored(n, r(3), -3.0, channels=2), [('bp', 550, 0.9)]) * gust_curve(n, 0.6, r(4)) ** 3
    hiss = filt(colored(n, r(5), 0.0, channels=2), [('hp', 2500, 0.7071), ('lp', 7500, 0.7071)])
    hiss *= 0.6 + 0.4 * gust_curve(n, 0.3, r(6))
    dens = 10.0 + 18.0 * gust_curve(n, 0.5, r(8))
    rr = r(7)
    cr = np.zeros((2, n))
    tcur = 0.0
    while True:
        tcur += rr.exponential(1 / 30.0)
        if tcur >= n / SR - 0.12:
            break
        if rr.random() > dens[ns(tcur)] / 30.0:
            continue
        amp = min(0.25 * rr.lognormal(0, 0.7), 0.8)
        typ = rr.random()
        y = np.zeros(ns(0.1))
        if typ < 0.78:                                     # micro crackle (1-4 clicks)
            o = 0.0
            for _ in range(rr.integers(1, 5)):
                c = crackle_click(rr, rr.uniform(1500, 6000), rr.uniform(0.00015, 0.0008), 0.35)
                i = ns(o)
                y[i:i + c.size] += c[:y.size - i] * rr.uniform(0.4, 1.0)
                o += rr.uniform(0.0005, 0.004)
        elif typ < 0.95:                                   # pop
            c = crackle_click(rr, rr.uniform(700, 2600), rr.uniform(0.0015, 0.005))
            y[:c.size] += 1.6 * c
            c = crackle_click(rr, rr.uniform(3000, 6000), 0.0003)
            y[:c.size] += c
        else:                                              # snap: cluster + low knock
            for _ in range(rr.integers(5, 13)):
                c = crackle_click(rr, rr.uniform(1500, 6500), rr.uniform(0.0002, 0.001))
                i = ns(rr.uniform(0.0, 0.07))
                y[i:i + c.size] += c[:y.size - i] * rr.uniform(0.5, 1.2)
            c = crackle_click(rr, rr.uniform(180, 320), 0.006)
            y[:c.size] += 1.2 * c
            amp *= 2.2
        place(cr, pan(y, rr.uniform(-0.7, 0.7)), tcur, amp)
    cr = filt(cr, [('hp', 300, 0.7071), ('lp', 8500, 0.7071), ('hs', 5000, 0.7071, -3.0)], pad_s=0.2)
    ir = make_ir(0.9, 0.4, r(9), predelay=0.008, er_span=0.04, lo_cut=150)
    cr = reverb(cr, ir, wet=0.12)
    bed = 0.55 * roar / rms(roar) + 0.30 * lick / rms(lick) + 0.12 * hiss / rms(hiss)
    x = bed + 2.2 * rms(bed) * cr / rms(cr)
    return dict(x=loopify(x[:, n0:], nl, nx))


# ============================================================================
# 12) heartbeat, 13) clock tick
# ============================================================================
@sound('heartbeat', 1.6, 'hit', hit=0.05, hp=20.0, fout=0.2,
       desc="Two deep cinematic heartbeats (lub-dub x2 at ~75 bpm), chest-muffled, hit_s = first lub.",
       checks=[('energy <200 Hz', 0, 200, 0.75, 1.0), ('energy 100-500 Hz', 100, 500, 0.08, 0.4)])
def gen_heartbeat(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    t = tvec(n)

    def thump(t0, f0, f1, att, dec, amp, k):
        tt = np.maximum(t - t0, 0.0)
        s = osc_sine(f1 + (f0 - f1) * np.exp(-tt / 0.04)) * env_ad(n, t0, att, dec)
        nz = filt(r(k).standard_normal(n), [('lp', 220, 0.7071), ('hp', 25, 0.7071)]) * env_ad(n, t0, att, 0.8 * dec)
        kn = filt(r(k + 50).standard_normal(n), [('bp', 170, 1.6)]) * env_ad(n, t0, 0.003, 0.025)
        return amp * (s + 0.5 * nz / np.max(np.abs(nz)) + 0.4 * kn / np.max(np.abs(kn)))

    x = np.zeros(n)
    for i, b in enumerate((0.05, 0.85)):
        x += thump(b, 62.0, 44.0, 0.008, 0.05, 1.0 - 0.04 * i, 1 + 2 * i)
        x += thump(b + 0.30, 75.0, 55.0, 0.005, 0.035, 0.72, 2 + 2 * i)
    x = softclip(1.4 * x / np.max(np.abs(x)), 1.3)
    ir = make_ir(0.25, 0.12, r(9), predelay=0.003, er_span=0.015, lo_cut=40, hi_cut=900)
    return dict(x=mono_bass(reverb(widen(x, 0.12, r(10)), ir, wet=0.15), 120.0))


@sound('tick', 0.1, 'hit', hit=0.005, hp=150.0, fout=0.01,
       desc="Clock tick: two-impact escapement click with brass/steel modes and a small wooden case.",
       checks=[('energy >1 kHz', 1000, 24000, 0.6, 1.0)])
def gen_tick(name, D):
    n = ns(D)
    rr = rng_for(name, 1)
    t = tvec(n)
    modes = [(1630, 0.012, 1.0), (2870, 0.008, 0.7), (4120, 0.006, 0.6), (5370, 0.0045, 0.45),
             (7300, 0.003, 0.3), (950, 0.018, 0.35), (450, 0.015, 0.25)]

    def strike(t0, a):
        tt = t - t0
        m = tt >= 0
        y = np.zeros(n)
        for f, tau, g in modes:
            y[m] += g * np.exp(-tt[m] / tau) * np.sin(TAU * f * rr.uniform(0.99, 1.01) * tt[m])
        c = filt(rr.standard_normal(n), [('hp', 3000, 0.7071)], pad_s=0.05) * env_ad(n, t0, 0.0001, 0.0003)
        return a * (y / np.max(np.abs(y)) + 0.8 * c / np.max(np.abs(c)))

    x = strike(0.005, 1.0) + strike(0.0115, 0.35)
    ir = make_ir(0.25, 0.15, rng_for(name, 2), predelay=0.002, er_span=0.015)
    return dict(x=reverb(x, ir, wet=0.10))


# ============================================================================
# 14) vintage camera shutter + flash powder, 15) newspaper rustle
# ============================================================================
@sound('camera_shutter_flash', 0.6, 'hit', hit=0.055, hp=40.0, fout=0.06,
       desc="Vintage camera: leaf-shutter click, magnesium flash-powder 'foomp' with sizzle (hit_s), "
            "shutter close clack, small studio room.")
def gen_camera(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    rr = r(1)
    t = tvec(n)

    def mech(t0, a, modes, k):
        tt = t - t0
        m = tt >= 0
        y = np.zeros(n)
        for f, tau, g in modes:
            y[m] += g * np.exp(-tt[m] / tau) * np.sin(TAU * f * tt[m])
        c = filt(r(k).standard_normal(n), [('hp', 2000, 0.7071)], pad_s=0.05) * env_ad(n, t0, 0.0001, 0.0004)
        return a * (y / np.max(np.abs(y)) + 0.7 * c / np.max(np.abs(c)))

    shut = [(2400, 0.006, 1.0), (3900, 0.005, 0.8), (5500, 0.004, 0.6), (7100, 0.003, 0.4), (1250, 0.008, 0.5)]
    clos = [(1200, 0.010, 1.0), (2100, 0.007, 0.8), (3300, 0.005, 0.6), (4700, 0.003, 0.3)]
    x = mech(0.02, 0.55, shut, 2) + mech(0.0225, 0.35, shut, 3)
    x += 0.12 * np.sin(TAU * 3300 * np.maximum(t - 0.021, 0)) * env_ad(n, 0.021, 0.001, 0.04)
    x += mech(0.30, 0.42, clos, 4) + mech(0.304, 0.25, shut, 5)
    T0 = 0.055
    tt = np.maximum(t - T0, 0.0)
    pop = tv_filter(colored(n, r(6), -1.5),
                    lambda x_, f: bq_mag('lp', 700.0 + 3500.0 * np.exp(-np.maximum(x_ - T0, 0) / 0.04), f, 0.7),
                    nfft=512)
    pop *= env_ad(n, T0, 0.001, 0.07)
    thump = osc_sine(70.0 + 50.0 * np.exp(-tt / 0.03)) * env_ad(n, T0, 0.002, 0.06)
    whoosh = filt(colored(n, r(7), -3.0), [('bp', 800, 0.9)]) * env_ad(n, T0, 0.02, 0.12)
    sz = np.zeros(n)
    tcur = T0
    while tcur < T0 + 0.4:
        tcur += rr.exponential(1 / 260.0)
        if tcur >= D - 0.01:
            break
        c = crackle_click(rr, rr.uniform(3000, 9000), rr.uniform(0.0001, 0.0004))
        i = ns(tcur)
        sz[i:i + c.size] += c[:n - i] * rr.lognormal(0, 0.5) * np.exp(-(tcur - T0) / 0.12)
    sz += 0.3 * filt(colored(n, r(8), 0.0), [('hp', 3500, 0.7071)]) * env_ad(n, T0, 0.003, 0.15)
    flash = pop / np.max(np.abs(pop)) + 0.35 * thump + 0.35 * whoosh / np.max(np.abs(whoosh)) \
        + 0.45 * sz / np.max(np.abs(sz))
    y = st(0.9 * x) + widen(1.4 * flash, 0.35, r(9))
    ir = make_ir(0.6, 0.3, r(10), predelay=0.006, er_span=0.03, lo_cut=100)
    return dict(x=reverb(y, ir, wet=0.15))


@sound('paper_rustle', 1.0, 'oneshot', hit=0.30, hp=80.0, fout=0.08,
       desc="Newspaper rustle: two handling gestures of dense crinkles + sheet swish + soft flap.",
       checks=[('energy >1 kHz', 1000, 24000, 0.55, 1.0)])
def gen_paper(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    rr = r(1)
    t = tvec(n)

    def bump(c, w):
        u = np.clip((t - c) / w, -1, 1)
        return 0.5 + 0.5 * np.cos(np.pi * u)

    motion = bump(0.30, 0.20) + 0.65 * bump(0.68, 0.17)
    cr = np.zeros((2, n))
    tcur = 0.0
    while True:
        tcur += rr.exponential(1 / 1400.0)
        if tcur >= D - 0.01:
            break
        mv = motion[ns(tcur)]
        if rr.random() > mv / 1.0:
            continue
        c = crackle_click(rr, rr.uniform(1500, 7000), rr.uniform(0.0001, 0.0006))
        place(cr, pan(c, rr.uniform(-0.4, 0.4)), tcur, rr.lognormal(0, 0.7) * mv)
    fcs = lambda x_: 1200.0 + 2500.0 * at(motion, x_)
    sw = tv_filter(colored(n, r(2), -3.0, channels=2), lambda x_, f: bq_mag('bp', fcs(x_), f, 0.8), nfft=512)
    sw *= np.clip(motion, 0, None) ** 1.2
    flap = filt(colored(n, r(3), 0.0, channels=2), [('bp', 300, 1.2)])
    flap *= env_ad(n, 0.26, 0.01, 0.05) + 0.6 * env_ad(n, 0.63, 0.01, 0.05)
    x = cr / np.max(np.abs(cr)) + 0.45 * sw / np.max(np.abs(sw)) + 0.25 * flap / np.max(np.abs(flap))
    ir = make_ir(0.4, 0.25, r(4), predelay=0.004, er_span=0.025, lo_cut=150)
    return dict(x=reverb(x, ir, wet=0.10))


# ============================================================================
# 16) drone beds
# ============================================================================
@sound('drone_bed', 60.0, 'bed', hit=0.0, norm=('rms', -28.0), hp=28.0, fout=4.0,
       desc="Dark ambient drone bed in D minor (D/A/F, detuned PolyBLEP saws + sines, slow "
            "breathing and filter drift, long reverb, carved 2-4 kHz for narration). 2.5 s fade-in, 4 s fade-out.",
       checks=[('energy <1 kHz', 0, 1000, 0.85, 1.0), ('energy 2-6 kHz', 2000, 6000, 0.0, 0.02)])
def gen_drone(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    rr = r(1)
    t = tvec(n)
    L, R = np.zeros(n), np.zeros(n)
    for i, (f0, a, k) in enumerate([(73.42, 1.0, 1), (110.0, 0.7, 2), (146.83, 0.6, 3),
                                    (174.61, 0.45, 2), (220.0, 0.35, 1)]):
        breath = 0.7 + 0.3 * np.sin(TAU * k * t / D + rr.uniform(0, TAU))
        for det, p in [(-8.0, -0.7), (0.0, 0.0), (7.0, 0.7)]:
            drift = 2 ** ((det + 3.0 * smooth_rand(n, 0.08, rr)) / 1200.0)
            s = a * breath * osc_saw(f0 * drift, phi0=rr.uniform(0, TAU))
            th = (p + 1) * np.pi / 4
            L += s * np.cos(th)
            R += s * np.sin(th)
    mod = smooth_rand(n, 0.05, r(2))
    lfo = lambda x_: 0.5 * np.sin(TAU * 2 * x_ / D + 0.3) + 0.3 * np.sin(TAU * 5 * x_ / D + 1.7) + 0.2 * at(mod, x_)
    fc = lambda x_: 480.0 * 2 ** (1.3 * lfo(x_))
    saws = tv_filter(np.stack([L, R]), lambda x_, f: bq_mag('lp', fc(x_), f, 1.1) * bq_mag('lp', 1.5 * fc(x_), f, 0.7),
                     nfft=4096)
    sines = np.zeros((2, n))
    for f0, a, p in [(73.42, 0.6, 0.0), (146.83, 0.4, -0.3), (220.0, 0.25, 0.3), (293.66, 0.12, -0.5),
                     (349.23, 0.07, 0.5)]:
        vib = 1.0 + 0.0008 * np.sin(TAU * 0.11 * t + rr.uniform(0, TAU))
        sw = 0.6 + 0.4 * np.sin(TAU * rr.integers(1, 4) * t / D + rr.uniform(0, TAU))
        sines += pan(a * sw * osc_sine(f0 * vib, phi0=rr.uniform(0, TAU)), p)
    sub = 0.25 * (0.6 + 0.4 * np.sin(TAU * t / D)) * osc_sine(36.71, n)
    air = filt(colored(n, r(3), -3.0, channels=2), [('bp', 1100, 0.7)]) * gust_curve(n, 0.04, r(4)) ** 2
    x = saws / rms(saws) + 0.8 * sines / rms(sines) + st(0.6 * sub / rms(sub)) + 0.10 * air / rms(air)
    x = filt(x, [('hp', 30, 0.7071), ('peak', 2800, 0.8, -6.0), ('lp', 5000, 0.7071)])
    ir = make_ir(5.0, 2.0, r(5), dur=6.0, predelay=0.03, er_span=0.12, lo_cut=40)
    x = reverb(x, ir, wet=0.55, dry=0.8)
    # slow leveller: 4 s power envelope, gain = env^-0.5 in amplitude terms (halves swings in dB)
    k = ns(4.0) // 480
    p = np.convolve(np.mean(x ** 2, axis=0)[::480], np.hanning(k) / np.hanning(k).sum(), 'same')
    g = np.interp(t, np.arange(p.size) * 480 / SR, (p / p.mean()) ** -0.25)
    return dict(x=x * g)


@sound('drone_bed_tension', 20.0, 'bed', hit=20.0, norm=('rms', -28.0), hp=28.0, fout=0.04,
       desc="Rising-tension bed in D minor: accelerating low D pulses (70->132 bpm), opening dissonant "
            "cluster, tremolo highs and noise swell building to the end (hit_s = end, cut to the hit).",
       checks=[('energy <500 Hz', 0, 500, 0.6, 1.0)])
def gen_tension(name, D):
    n = ns(D)
    r = lambda k: rng_for(name, k)
    rr = r(1)
    t = tvec(n)
    u = t / D
    beat_ph = np.cumsum((70.0 + 62.0 * u ** 1.3) / 60.0) / SR
    hits = np.nonzero(np.diff(np.floor(beat_ph)) > 0)[0] + 1
    bright, dark = np.zeros(n), np.zeros(n)
    for i in np.concatenate([[ns(0.05)], hits]):
        a = 0.5 + 0.5 * u[i]
        bright += a * env_ad(n, i / SR, 0.004, 0.06)
        dark += a * env_ad(n, i / SR, 0.006, 0.16 - 0.06 * u[i])
    saw = osc_saw(73.42, n, 0.3) + 0.7 * osc_saw(73.42 * 2 ** (6 / 1200), n, 1.1)
    pulse = filt(saw, [('lp', 1200, 0.9)]) * bright + filt(saw, [('lp', 250, 0.8)]) * dark
    pulse = pulse / np.max(np.abs(pulse)) + 0.9 * osc_sine(36.71, n) * dark / np.max(dark)
    L, R = np.zeros(n), np.zeros(n)
    for f0, a, p in [(146.83, 1.0, -0.5), (155.56, 0.35, 0.6), (220.0, 0.7, 0.3), (293.66, 0.5, -0.2)]:
        for det in (-6.0, 6.0):
            s = a * osc_saw(f0 * 2 ** (det / 1200.0), n, rr.uniform(0, TAU))
            th = (np.clip(p + det / 20.0, -1, 1) + 1) * np.pi / 4
            L += s * np.cos(th)
            R += s * np.sin(th)
    clus = tv_filter(np.stack([L, R]), lambda x_, f: bq_mag('lp', 300.0 * (2500 / 300.0) ** np.clip(x_ / D, 0, 1) ** 1.5,
                                                            f, 1.0), nfft=2048)
    clus *= db2a(-18.0 + 18.0 * u ** 1.2)
    trem = 0.5 + 0.5 * np.sin(phase_of(8.0 + 6.0 * u))
    hi = (osc_sine(587.33, n) + 0.6 * osc_sine(880.0, n, 1.0)) * trem * np.clip((t - 8.0) / 10.0, 0, 1) ** 2
    nz = tv_filter(colored(n, r(2), -1.0, channels=2),
                   lambda x_, f: bq_mag('bp', 400.0 * 15 ** np.clip((x_ - 12.0) / 8.0, 0, 1), f, 1.0), nfft=2048)
    nz *= np.clip((t - 12.0) / 8.0, 0, 1) ** 2.5
    x = 1.0 * st(pulse) + 0.55 * clus / np.max(np.abs(clus)) + 0.12 * widen(hi, 0.4, r(3)) \
        + 0.35 * nz / np.max(np.abs(nz))
    ir = make_ir(3.0, 1.2, r(4), predelay=0.02, er_span=0.1, lo_cut=50)
    return dict(x=reverb(x, ir, wet=0.25))


# ============================================================================
# 17) closing sting
# ============================================================================
@sound('sting_end', 3.0, 'hit', hit=0.03, hp=30.0, fout=0.6,
       desc="Mysterious closing sting: inharmonic FM bells (D5, D4, tritone G#5 shimmer) over a low D "
            "bloom, long hall reverb tail.")
def gen_sting(name, D):
    n, T0 = ns(D), 0.03
    r = lambda k: rng_for(name, k)
    tt = np.maximum(tvec(n) - T0, 0.0)

    def bell(fc, ratio, I0, itau, atau, amp):
        idx = I0 * np.exp(-tt / itau)
        return amp * np.sin(TAU * fc * tt + idx * np.sin(TAU * fc * ratio * tt)) * env_ad(n, T0, 0.0015, atau)

    b1 = bell(587.33, 1.4, 6.0, 0.35, 1.3, 1.0)
    b2 = bell(293.66, 3.5, 3.0, 0.25, 1.7, 0.55)
    b3 = bell(830.61, 1.4, 4.0, 0.25, 0.9, 0.22)
    bloom = osc_sine(73.42, n) + 0.5 * filt(osc_saw(73.42 * 1.003, n), [('lp', 300, 0.7071)])
    bloom *= env_ad(n, T0, 0.12, 1.4)
    x = pan(b1, -0.15) + pan(b2, 0.2) + pan(b3, 0.45) + 0.5 * st(bloom)
    ir = make_ir(3.5, 1.4, r(1), predelay=0.025, er_span=0.1, lo_cut=60)
    return dict(x=reverb(x, ir, wet=0.45))


# ============================================================================
# render / finalize / analyse / manifest
# ============================================================================
def finalize(x, spec):
    x = st(x)
    if spec['loop']:
        x = filt(x, [('hp', spec['hp'], 0.7071)], circular=True)
        x = x - x.mean(axis=1, keepdims=True)
    else:
        x = filt(x, [('hp', spec['hp'], 0.7071)])
        x = fade(x, spec.get('fin', 0.002) if spec['name'] != 'drone_bed' else 2.5, spec['fout'])
        w = np.hanning(x.shape[1] + 2)[1:-1]
        x = x - np.mean(x, axis=1, keepdims=True) * w / w.mean()   # sub-0.5 Hz bump, ends stay 0
    mode, target = spec['norm']
    if mode == 'peak':
        x = x * (db2a(target) / true_peak(x))
    else:
        for it in range(8):
            x = x * (db2a(target) / rms(x))
            if spec['loop']:
                x = x - x.mean(axis=1, keepdims=True)
            if true_peak(x) <= db2a(-1.05):
                break
            x = limiter(x, -1.6 - 0.5 * it, look_ms=2.0, circular=spec['loop'])
    return x


def analyse(x, spec, extra):
    pk, tp, r = float(np.max(np.abs(x))), true_peak(x), rms(x)
    dc = float(np.max(np.abs(np.mean(x, axis=1))))
    clip = int(np.sum(np.abs(x) >= 0.99999))
    fr, cen, f, P = band_fracs(x)
    corr = float(np.corrcoef(x[0], x[1])[0, 1])
    env = short_rms(x, float(np.clip(x.shape[1] / SR / 40.0, 0.0025, 0.1)))
    t_pk = float(np.argmax(env) / SR)
    res = []
    res.append(('no clipping', clip, 0, 0))
    res.append(('|DC| < -80 dBFS', round(float(a2db(dc)), 1), -400, -80))
    mode, target = spec['norm']
    if mode == 'peak':
        res.append(('true peak dBTP', round(float(a2db(tp)), 2), target - 0.3, target + 0.05))
    else:
        res.append(('RMS dBFS', round(float(a2db(r)), 2), target - 0.3, target + 0.3))
        res.append(('true peak <= -1 dBTP', round(float(a2db(tp)), 2), -99, -0.95))
    for lab, lo, hi, mn, mx in spec['checks']:
        res.append((lab, round(frac_between(f, P, lo, hi), 3), mn, mx))
    for lab, v, mn, mx in extra.get('extra_checks', []):
        res.append((lab, round(v, 3), mn, mx))
    seam = None
    if spec['loop']:
        seam = seam_metrics(x)
        res.append(('loop wrap step percentile', seam['wrap_step_percentile'], 0, 99.5))
        lo, hi = seam['block_rms_db_range']
        res.append(('loop joint RMS within file range', seam['joint_rms_db'], lo - 1.0, hi + 1.0))
    info = dict(peak_dbfs=round(float(a2db(pk)), 2), true_peak_dbtp=round(float(a2db(tp)), 2),
                rms_dbfs=round(float(a2db(r)), 2), dc_dbfs=round(float(a2db(dc)), 1),
                lr_correlation=round(corr, 3), centroid_hz=round(cen), measured_peak_s=round(t_pk, 3),
                band_energy={k: round(v, 3) for k, v in fr.items()})
    if seam:
        info['loop_seam'] = seam
    return info, res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--outdir', default=OUTDIR)
    a = ap.parse_args()
    try:
        os.nice(10)
    except OSError:
        pass
    os.makedirs(a.outdir, exist_ok=True)
    names = [s for s in a.only.split(',') if s] or list(REG)
    mpath = os.path.join(a.outdir, 'manifest.json')
    old = {}
    if os.path.exists(mpath):
        try:
            old = {e['file']: e for e in json.load(open(mpath))['files']}
        except (ValueError, KeyError):
            old = {}
    fails = 0
    for nm in names:
        spec = dict(REG[nm], name=nm)
        t0 = time.time()
        out = spec['fn'](nm, spec['dur'])
        x = finalize(out['x'][:, :ns(spec['dur'])], spec)
        assert x.shape == (2, ns(spec['dur'])), x.shape
        path = os.path.join(a.outdir, nm + '.wav')
        write_wav(path, x)
        xr = read_wav(path)
        info, res = analyse(xr, spec, out)
        hit = spec['hit']
        if hit == 'measure':
            hit = info['measured_peak_s']
        old[nm + '.wav'] = dict(file=nm + '.wav', duration_s=round(xr.shape[1] / SR, 3), hit_s=round(float(hit), 3),
                                description=spec['desc'], type=spec['kind'], loopable=spec['loop'], **info)
        bad = [c for c in res if not (c[2] <= c[1] <= c[3])]
        fails += len(bad)
        print(f"{nm:28s} {xr.shape[1] / SR:5.2f}s  pk {info['peak_dbfs']:6.2f}  tp {info['true_peak_dbtp']:6.2f}  "
              f"rms {info['rms_dbfs']:6.2f}  dc {info['dc_dbfs']:6.1f}  corr {info['lr_correlation']:5.2f}  "
              f"cen {info['centroid_hz']:5d}Hz  pk@{info['measured_peak_s']:6.3f}s hit {hit}  "
              f"[{time.time() - t0:4.1f}s]", flush=True)
        for c in res:
            flag = 'ok ' if c[2] <= c[1] <= c[3] else 'FAIL'
            if flag != 'ok ' or c[0] not in ('no clipping',):
                print(f"      {flag} {c[0]}: {c[1]}  (want {c[2]}..{c[3]})")
        print("      bands:", info['band_energy'], flush=True)
    order = [k + '.wav' for k in REG if k + '.wav' in old]
    man = dict(title="Tunguska 1908 short - original synthesized SFX kit",
               generator="make_sfx.py (numpy only, re-runnable, deterministic seeds)",
               sample_rate=SR, channels=2, bit_depth=24,
               level_policy="hits/one-shots normalised to -1 dBTP true peak; ambiences/beds to -28 dBFS RMS",
               hit_s_note="sync point in seconds: onset of the main hit, centre of a pass-by, cut point of a "
                          "riser/tension bed, measured loudest point for rumble_long; 0.0 for loops/beds",
               files=[old[k] for k in order])
    with open(mpath, 'w') as fh:
        json.dump(man, fh, indent=2, ensure_ascii=False)
    print(f"wrote {len(order)} entries to {mpath}; failed checks: {fails}")
    return 0 if fails == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
