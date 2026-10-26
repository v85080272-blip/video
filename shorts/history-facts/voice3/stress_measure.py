# Last two vowel nuclei of each test phrase (the final two-syllable word): peak loudness in the 500-3000 Hz band and
# duration within 6 dB of the peak. A stressed Russian vowel is longer and louder, so if stress marks are obeyed,
# the A (first syllable) and B (second syllable) variants of the same word should flip.
import glob, os, re, sys, wave
import numpy as np

def read(p):
    w = wave.open(p)
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    return x, w.getframerate()

def contour(x, sr, hop=0.01, win=0.025):
    h, n = int(sr * hop), int(sr * win)
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::h] * np.hanning(n)
    sp = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    band = 10 * np.log10(sp[:, (f >= 500) & (f <= 3000)].sum(1) + 1e-10)
    low = 10 * np.log10(sp[:, (f >= 80) & (f < 500)].sum(1) + 1e-10)
    band = np.convolve(band, np.ones(3) / 3, mode='same')
    voiced = np.convolve(low, np.ones(3) / 3, mode='same') > band - 10   # a stop burst has no voicing below 500 Hz
    return np.where(voiced, band, band - 30)

def peaks(b, floor, prom=5.0):
    out = []
    for i in range(1, len(b) - 1):
        if b[i] >= b[i - 1] and b[i] > b[i + 1] and b[i] > floor:
            l = i
            while l > 0 and b[l - 1] <= b[i]:
                l -= 1
            r = i
            while r < len(b) - 1 and b[r + 1] <= b[i]:
                r += 1
            p = b[i] - max(b[l:i + 1].min(), b[i:r + 1].min())
            if p >= prom:
                out.append(i)
    return out

def extent(b, i, drop=6.0):
    l = i
    while l > 0 and b[l - 1] > b[i] - drop:
        l -= 1
    r = i
    while r < len(b) - 1 and b[r + 1] > b[i] - drop:
        r += 1
    return (r - l + 1) * 10

def measure(p):
    x, sr = read(p)
    b = contour(x, sr)
    top = b.max()
    pk = peaks(b, top - 25)
    if len(pk) >= 2 and b[pk[-2]:pk[-1]].min() < top - 35:   # a release after a stop closure ("-к"), not a vowel
        pk = pk[:-1]
    if len(pk) < 2:
        return None
    i1, i2 = pk[-2], pk[-1]
    return extent(b, i1), extent(b, i2), round(float(b[i1] - top), 1), round(float(b[i2] - top), 1)

if __name__ == '__main__':
    rows = {}
    for p in sorted(glob.glob(os.path.join(sys.argv[1], '*_s*.wav'))):
        name, seed = re.match(r'(.*)_s(\d+)\.wav', os.path.basename(p)).groups()
        try:
            m = measure(p)
        except Exception as e:
            continue
        if not m:
            print(name, seed, 'too few peaks'); continue
        d1, d2, e1, e2 = m
        rows.setdefault(name, []).append(m)
        print(f'{name:15s} s{seed}  v1 {d1:4d} ms {e1:6.1f} dB   v2 {d2:4d} ms {e2:6.1f} dB')
    print()
    for name, r in sorted(rows.items()):
        r = np.array(r, float)
        print(f'{name:15s} d1/d2 {np.mean(r[:,0]/r[:,1]):4.2f}   e1-e2 {np.mean(r[:,2]-r[:,3]):5.1f} dB   n={len(r)}')
