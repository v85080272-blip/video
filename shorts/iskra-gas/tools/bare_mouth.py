# For the drawn mouth (16.11): each closed-mouth sprite (img/i_<pose>_closed.png) has her closed lips as a thin purple
# line, tilted with the face. Find that line (its two ends, its tilt), and write img/i_<pose>_bare.png — the same sprite
# with the line painted out by the skin round it — so the open mouth can be drawn in its place along the same line.
# The line goes into img/mouths.json as "line": [cx, cy, half width, angle in radians] (sprite pixels).
# usage: python3 tools/bare_mouth.py
import json, math
import numpy as np
from PIL import Image, ImageFilter

M = json.load(open('img/mouths.json'))
for k, m in M.items():
    im = Image.open(f'img/{k}_closed.png').convert('RGBA'); a = np.array(im).astype(float)
    x0, y0, x1, y1 = m['box']; sk = np.array(m['skin'], float)
    X0, Y0, X1, Y1 = x0 - 8, y0 - 8, x1 + 8, y1 + 8
    reg = a[Y0:Y1, X0:X1, :3]
    dist = np.sqrt(((reg - sk) ** 2).sum(2))
    line = (dist > 60) & (reg[..., 2] > reg[..., 1] - 5) & (reg.sum(2) < 520)        # purple-dark, not skin
    ys, xs = np.nonzero(line)
    if len(xs) < 5: print(k, 'no line'); continue
    # keep only the line itself: the connected piece of these pixels nearest the middle of the mouth box
    from collections import deque
    lab = -np.ones(line.shape, int); comps = []
    for sy, sx in zip(ys, xs):
        if lab[sy, sx] >= 0: continue
        q = deque([(sy, sx)]); lab[sy, sx] = len(comps); cc = []
        while q:
            y, x = q.popleft(); cc.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < line.shape[0] and 0 <= xx < line.shape[1] and line[yy, xx] and lab[yy, xx] < 0:
                        lab[yy, xx] = len(comps); q.append((yy, xx))
        comps.append(cc)
    mid = np.array([(y0 + y1) / 2 - Y0, (x0 + x1) / 2 - X0])
    big = [c for c in comps if len(c) >= 12]
    best = min(big or comps, key=lambda c: np.abs(np.array(c) - mid).sum(1).min())
    ys = np.array([p[0] for p in best]) + Y0; xs = np.array([p[1] for p in best]) + X0
    # the two ends: the mean of the leftmost and the rightmost 15 % of the line pixels
    o = np.argsort(xs); n = max(2, len(xs) * 15 // 100)
    L = np.array([xs[o[:n]].mean(), ys[o[:n]].mean()]); R = np.array([xs[o[-n:]].mean(), ys[o[-n:]].mean()])
    c = (L + R) / 2; hw = np.linalg.norm(R - L) / 2; ang = math.atan2(R[1] - L[1], R[0] - L[0])
    # paint the line out: everything not skin-coloured in a band round the line (the line, its soft edge, the little
    # ticks at the corners), filled by letting the skin round it diffuse in
    H_, W_ = a.shape[:2]; yy, xx = np.mgrid[0:H_, 0:W_]
    u = (xx - c[0]) * math.cos(ang) + (yy - c[1]) * math.sin(ang); v = -(xx - c[0]) * math.sin(ang) + (yy - c[1]) * math.cos(ang)
    band = (np.abs(u) <= hw + 6) & (np.abs(v) <= 4.5)
    far = np.sqrt(((a[..., :3] - sk) ** 2).sum(2)) > 22
    mk = band & far
    mk = np.array(Image.fromarray((mk * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
    out = a.copy(); rgb = out[..., :3]; rgb[mk] = sk
    for _ in range(200):
        avg = (np.roll(rgb, 1, 0) + np.roll(rgb, -1, 0) + np.roll(rgb, 1, 1) + np.roll(rgb, -1, 1)) / 4
        rgb[mk] = avg[mk]
    out[..., :3] = rgb
    b = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
    b.save(f'img/{k}_bare.png')
    m['line'] = [round(float(c[0]), 2), round(float(c[1]), 2), round(float(hw), 2), round(ang, 4)]
    print(k, m['line'], len(xs))
json.dump(M, open('img/mouths.json', 'w'), indent=1)
