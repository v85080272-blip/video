# Side-by-side spectrograms (0-8 kHz, dB) of short clips, labelled, for eyeballing voice texture.
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud

out = sys.argv[1]
items = [a.split('=', 1) for a in sys.argv[2:]]
rows = []
for label, p in items:
    x, sr = aud.read_wav(p)
    if sr != 48000:
        t = np.arange(int(len(x) * 48000 / sr)) * sr / 48000
        x = np.interp(t, np.arange(len(x)), x)
        sr = 48000
    x = x[:int(6.0 * sr)]
    x = x / (np.abs(x).max() + 1e-9)
    n, hop = 2048, 240
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    S = 20 * np.log10(np.abs(np.fft.rfft(fr, axis=1)) + 1e-9)
    f = np.fft.rfftfreq(n, 1 / sr)
    S = S[:, f <= 8000].T[::-1]
    S = np.clip((S - (S.max() - 70)) / 70, 0, 1)
    img = (np.stack([S ** 0.8 * 255, S ** 1.6 * 230, (1 - S) * S * 4 * 160], -1)).astype(np.uint8)
    im = Image.fromarray(img).resize((1200, 340))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 520, 30], fill=(0, 0, 0))
    d.text((8, 6), label, fill=(255, 255, 255), font=ImageFont.load_default(18))
    for k in range(1, 8):
        y = int(340 - k * 1000 / 8000 * 340)
        d.line([(1150, y), (1200, y)], fill=(255, 255, 255))
        d.text((1120, y - 9), f'{k}k', fill=(255, 255, 255), font=ImageFont.load_default(14))
    rows.append(im)
sheet = Image.new('RGB', (1200, 340 * len(rows) + 6 * (len(rows) - 1)), (40, 40, 40))
for i, im in enumerate(rows):
    sheet.paste(im, (0, i * 346))
sheet.save(out, quality=88)
print(out)
