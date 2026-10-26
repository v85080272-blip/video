# Zoomed view of one stretch of a take for stress checks: 0-5 kHz spectrogram at 400 px/s, pitch dots,
# energy (dB) curve of the 300-2500 Hz band with 10 ms grid lines.
# usage: python3 zoom.py out.png t0 t1 a.wav [b.wav ...]  (same t0/t1 for all) or a.wav@t0:t1 per file
import os, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402
import aud  # noqa: E402

OUT = sys.argv[1]
T0, T1 = float(sys.argv[2]), float(sys.argv[3])
items = sys.argv[4:]
PX, HS, HF, HE = 400, 220, 90, 90
rows = []
for it in items:
    f, t0, t1 = it, T0, T1
    if '@' in it:
        f, rng = it.split('@')
        t0, t1 = map(float, rng.split(':'))
    x, sr = aud.read_wav(f)
    a, b = int(t0 * sr), min(len(x), int(t1 * sr))
    n, hop = 1024, sr // PX
    xp = np.pad(x, (n // 2, n // 2))
    fr = np.lib.stride_tricks.sliding_window_view(xp[a:b + n], n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    fq = np.fft.rfftfreq(n, 1 / sr)
    Sd = 10 * np.log10(S[:, fq <= 5000] + 1e-12)
    img = np.clip((Sd - (Sd.max() - 70)) / 70, 0, 1)[:, ::-1].T
    idx = np.linspace(0, img.shape[0] - 1, HS).astype(int)
    spec = (img[idx] * 255).astype(np.uint8)
    W = spec.shape[1]
    cv = Image.new('RGB', (W + 60, HS + HF + HE + 30), 'white')
    cv.paste(Image.fromarray(spec, 'L').convert('RGB'), (50, 20))
    d = ImageDraw.Draw(cv)
    d.text((2, 2), f'{os.path.basename(f)} {t0:.2f}-{t1:.2f}s', fill='black')
    for khz in (1, 2, 3, 4):
        y = 20 + int(HS * (1 - khz / 5))
        d.text((2, y - 5), f'{khz}k', fill='gray')
        d.line([(46, y), (50, y)], fill='gray')
    band = 10 * np.log10(S[:, (fq > 300) & (fq < 2500)].sum(1) + 1e-12)
    y0 = 20 + HS
    # pitch per 10 ms
    k = 16000 / sr
    seg = x[max(0, a - sr // 20):b + sr // 20]
    x16 = np.interp(np.arange(int(len(seg) * k)) / k, np.arange(len(seg)), seg)
    off = (a - max(0, a - sr // 20)) / sr
    for i in range(0, len(x16) - 870, 160):
        f0 = aud.f0_track(x16[i:i + 870], 16000)
        tt = (i + 320) / 16000 - off
        if len(f0) and 60 <= f0[0] <= 300 and 0 <= tt <= (t1 - t0):
            px = 50 + int(tt * PX)
            py = y0 + HF - int(np.log2(f0[0] / 60) / np.log2(300 / 60) * HF)
            d.ellipse([px - 2, py - 2, px + 2, py + 2], fill='blue')
    for hz in (80, 100, 150, 200):
        py = y0 + HF - int(np.log2(hz / 60) / np.log2(300 / 60) * HF)
        d.line([(46, py), (50 + W, py)], fill=(220, 220, 255))
        d.text((2, py - 5), f'{hz}', fill='gray')
    y1 = y0 + HF
    top = band.max()
    pts = [(50 + i, y1 + HE - int(np.clip((v - (top - 40)) / 40, 0, 1) * HE)) for i, v in enumerate(band)]
    d.line(pts, fill='darkgreen', width=2)
    for db in (0, 10, 20, 30):
        yy = y1 + HE - int((40 - db) / 40 * HE)
        d.line([(46, yy), (50 + W, yy)], fill=(225, 240, 225))
    for t in np.arange(0, t1 - t0 + 1e-9, 0.05):
        px = 50 + int(t * PX)
        big = abs(t * 10 - round(t * 10)) < 1e-6
        d.line([(px, 14 if big else 17), (px, 20)], fill='red' if big else 'gray')
        if big:
            d.text((px + 1, 4), f'{t0 + t:.1f}', fill='red')
    rows.append(cv)
Wm = max(r.width for r in rows)
sheet = Image.new('RGB', (Wm, sum(r.height for r in rows)), 'white')
y = 0
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height
sheet.save(OUT)
print(OUT, sheet.size)
