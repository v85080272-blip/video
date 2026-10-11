# Minimal stand-in for scipy.signal.butter(..., output='sos') + sosfilt, numpy only.
# Same Butterworth design steps as scipy (buttap, prewarp, lp2lp/lp2hp/lp2bp, bilinear),
# filtering = exact causal LTI response (partial fractions -> impulse response -> FFT convolution).
import numpy as np


class _Filter:
    def __init__(self, z, p, k):
        self.z, self.p, self.k = np.asarray(z, complex), np.asarray(p, complex), float(k)


def _buttap(N):
    m = np.arange(-N + 1, N, 2)
    return np.array([]), -np.exp(1j * np.pi * m / (2 * N)), 1.0


def butter(N, Wn, btype='low', analog=False, output='ba', fs=None):
    assert not analog
    Wn = np.atleast_1d(np.asarray(Wn, float))
    if fs is not None:
        Wn = 2 * Wn / fs
    z, p, k = _buttap(N)
    fs2 = 2.0
    warped = 2 * fs2 * np.tan(np.pi * Wn / fs2)
    btype = {'band': 'bandpass', 'bandpass': 'bandpass', 'low': 'lowpass', 'lowpass': 'lowpass',
             'high': 'highpass', 'highpass': 'highpass'}[btype]
    if btype == 'lowpass':
        wo = warped[0]
        deg = len(p) - len(z)
        z, p, k = wo * z, wo * p, k * wo ** deg
    elif btype == 'highpass':
        wo = warped[0]
        deg = len(p) - len(z)
        k = k * np.real(np.prod(-z) / np.prod(-p))
        z, p = np.append(wo / z, np.zeros(deg)), wo / p
    else:
        bw, wo = warped[1] - warped[0], np.sqrt(warped[0] * warped[1])
        deg = len(p) - len(z)
        zl, pl = z * bw / 2, p * bw / 2
        zl, pl = zl.astype(complex), pl.astype(complex)
        z = np.concatenate([zl + np.sqrt(zl ** 2 - wo ** 2), zl - np.sqrt(zl ** 2 - wo ** 2)])
        p = np.concatenate([pl + np.sqrt(pl ** 2 - wo ** 2), pl - np.sqrt(pl ** 2 - wo ** 2)])
        z = np.append(z, np.zeros(deg))
        k = k * bw ** deg
    # bilinear transform
    f2 = 2 * fs2
    deg = len(p) - len(z)
    k = k * np.real(np.prod(f2 - z) / np.prod(f2 - p))
    z, p = (f2 + z) / (f2 - z), (f2 + p) / (f2 - p)
    z = np.append(z, -np.ones(deg))
    return _Filter(z, p, k)


def _impulse(f, n):
    p, z, k = f.p, f.z, f.k
    # H(z) = k prod(1 - z_j/zz) / prod(1 - p_i/zz) ; equal degree -> direct term + simple poles
    c0 = k * np.prod(-z) / np.prod(-p)
    r = np.array([k * np.prod(1 - z / pi) / np.prod(1 - np.delete(p, i) / pi) for i, pi in enumerate(p)])
    pm = np.abs(p).max()
    L = n if pm == 0 else int(min(n, np.ceil(np.log(1e-14) / np.log(pm)) + 8))
    L = max(L, 1)
    nn = np.arange(L)
    h = np.real((r[None, :] * p[None, :] ** nn[:, None]).sum(1))
    h[0] += np.real(c0)
    return h


def sosfilt(sos, x, axis=-1, zi=None):
    assert zi is None and isinstance(sos, _Filter)
    x = np.asarray(x, float)
    if x.ndim != 1:
        return np.apply_along_axis(lambda v: sosfilt(sos, v), axis, x)
    n = len(x)
    if n == 0:
        return x.copy()
    h = _impulse(sos, n)
    if len(h) * n < 4_000_000:
        return np.convolve(x, h)[:n]
    m = n + len(h) - 1
    nfft = 1 << (m - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:n]
