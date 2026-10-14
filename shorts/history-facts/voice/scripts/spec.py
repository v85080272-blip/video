# Spectrogram sheet (PIL + numpy) to eyeball takes: 0-12 kHz log spectrogram, pitch dots (70-300 Hz band at the
# bottom strip), energy curve, 0.5 s ticks, optional word marks from a takes/manifest JSON.
# usage: python3 spec.py out.png a.wav [b.wav ...]   (env WORDS=<json with name->words> optional)
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vt  # noqa: E402
import aud  # noqa: E402

OUT, files = sys.argv[1], sys.argv[2:]
PX_PER_S, H_SPEC, H_F0, H_EN = 120, 200, 70, 40
WJ = json.load(open(os.environ['WORDS'])) if os.environ.get('WORDS') else {}
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','sch','','y','','e','yu','ya']))


def tr(w):
    return ''.join(TR.get(c, TR.get(c.lower(), c).upper() if c.lower() in TR else c) for c in w).encode('ascii', 'replace').decode()


rows = []
for f in files:
    x, sr = aud.read_wav(f)
    n, hop = 2048, sr // PX_PER_S
    xp = np.pad(x, (n // 2, n // 2))
    fr = np.lib.stride_tricks.sliding_window_view(xp, n)[::hop] * np.hanning(n)
    S = 20 * np.log10(np.abs(np.fft.rfft(fr, axis=1)) + 1e-9)
    fq = np.fft.rfftfreq(n, 1 / sr)
    S = S[:, fq <= 12000]
    top = S.max()
    img = np.clip((S - (top - 80)) / 80, 0, 1)                 # 80 dB range
    img = img[:, ::-1].T                                       # freq high at top
    idx = np.linspace(0, img.shape[0] - 1, H_SPEC).astype(int)
    spec = (img[idx] * 255).astype(np.uint8)
    W = spec.shape[1]
    canvas = Image.new('RGB', (W + 60, H_SPEC + H_F0 + H_EN + 30), 'white')
    sp = Image.fromarray(spec, 'L').convert('RGB')
    canvas.paste(sp, (50, 20))
    d = ImageDraw.Draw(canvas)
    d.text((2, 2), os.path.basename(f) + f'  {len(x) / sr:.2f}s', fill='black')
    for khz in (2, 4, 6, 8, 10):
        y = 20 + int(H_SPEC * (1 - khz / 12))
        d.text((2, y - 5), f'{khz}k', fill='gray')
    # pitch strip
    y0 = 20 + H_SPEC
    k = 16000 / sr
    x16 = np.interp(np.arange(int(len(x) * k)) / k, np.arange(len(x)), x)
    Wn, Hn = 640, 160
    db16, _ = aud.frames_db(x16, 16000, Hn / 16000)
    gate = db16.max() - 30
    for i in range(0, len(x16) - Wn - 229, Hn):
        if db16[min(i // Hn, len(db16) - 1)] < gate:
            continue
        f0 = aud.f0_track(x16[i:i + Wn + 230], 16000)
        if len(f0):
            fv = f0[0]
            if 60 <= fv <= 300:
                px = 50 + int((i + Wn / 2) / 16000 * PX_PER_S)
                py = y0 + H_F0 - int((np.log2(fv / 60) / np.log2(300 / 60)) * H_F0)
                d.ellipse([px - 1, py - 1, px + 1, py + 1], fill='blue')
    for hz in (80, 100, 150, 200):
        py = y0 + H_F0 - int((np.log2(hz / 60) / np.log2(300 / 60)) * H_F0)
        d.line([(46, py), (50 + W, py)], fill=(220, 220, 255))
        d.text((2, py - 5), f'{hz}', fill='gray')
    # energy
    y1 = y0 + H_F0
    db, nn = aud.frames_db(x, sr, 1 / PX_PER_S)
    for i, v in enumerate(db):
        h = int(np.clip((v + 70) / 70, 0, 1) * H_EN)
        d.line([(50 + i, y1 + H_EN), (50 + i, y1 + H_EN - h)], fill='darkgreen')
    # ticks
    for t in np.arange(0, len(x) / sr, 0.5):
        px = 50 + int(t * PX_PER_S)
        d.line([(px, 15), (px, 20)], fill='red' if abs(t - round(t)) < 1e-6 else 'gray')
        if abs(t - round(t)) < 1e-6:
            d.text((px + 2, 6), f'{t:.0f}', fill='red')
    name = os.path.splitext(os.path.basename(f))[0]
    ws = WJ.get(name, {}).get('words') if isinstance(WJ.get(name), dict) else None
    if ws:
        for w in ws:
            a, b = 50 + int(w['start'] * PX_PER_S), 50 + int(w['end'] * PX_PER_S)
            d.line([(a, y1 + H_EN + 2), (b, y1 + H_EN + 2)], fill='purple', width=2)
            d.text((a, y1 + H_EN + 4), tr(w['word'])[:12], fill='purple')
    rows.append(canvas)
Wmax = max(r.width for r in rows)
sheet = Image.new('RGB', (Wmax, sum(r.height for r in rows)), 'white')
y = 0
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height
sheet.save(OUT)
print(OUT, sheet.size)
