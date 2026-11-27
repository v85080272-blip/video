# The open mouth exactly as the artist drew it in each pose (img/i_<pose>.png: the teeth, the coral inside, the pink
# tongue, the dark outline), cut along its own outline — no skin round it, so no ring — into img/i_<pose>_mopen.png
# (RGBA, the size of the sprite, transparent outside the mouth). iskra.js draws it on the bare face (no lip line):
# whole when the voice is loud, squashed towards the upper lip when it is half open — the anime three-step lip flap.
# The mouth's top (the upper lip) and bottom go into img/mouths.json as "art": [top y, bottom y] (sprite pixels).
# usage: python3 tools/mouth_art.py
import json
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

M = json.load(open('img/mouths.json'))
for k, m in M.items():
    a = np.array(Image.open(f'img/{k}.png').convert('RGBA')).astype(float)
    x0, y0, x1, y1 = m['box']; sk = np.array(m['skin'], float)
    X0, Y0, X1, Y1 = x0 - 4, y0 - 4, x1 + 4, y1 + 4
    d = np.sqrt(((a[Y0:Y1, X0:X1, :3] - sk) ** 2).sum(2))
    non = d > 38
    # the mouth: the non-skin piece through the middle of the box
    H, W = non.shape; lab = np.zeros(non.shape, bool)
    cy, cx = (y0 + y1) // 2 - Y0, (x0 + x1) // 2 - X0
    seeds = [(y, x) for y in range(cy - 3, cy + 4) for x in range(cx - 3, cx + 4) if non[y, x]]
    q = deque(seeds)
    for s in seeds: lab[s] = True
    while q:
        y, x = q.popleft()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and non[yy, xx] and not lab[yy, xx]: lab[yy, xx] = True; q.append((yy, xx))
    # fill the holes (light teeth inside the outline): everything not reachable from the border through non-mouth
    out = np.zeros(non.shape, bool); q = deque()
    for y in range(H):
        for x in (0, W - 1):
            if not lab[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
    for x in range(W):
        for y in (0, H - 1):
            if not lab[y, x] and not out[y, x]: out[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H and 0 <= xx < W and not lab[yy, xx] and not out[yy, xx]: out[yy, xx] = True; q.append((yy, xx))
    mask = ~out
    full = np.zeros(a.shape[:2], np.uint8); full[Y0:Y1, X0:X1] = mask * 255
    # take in the soft edge of the outline (1 px), feathered, so it sits on the skin as the artist drew it
    al = Image.fromarray(full).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgba = Image.fromarray(a.astype(np.uint8), 'RGBA'); rgba.putalpha(Image.fromarray(np.minimum(np.array(al), a[..., 3].astype(np.uint8))))
    # a cuter tongue (the owner: «с языком, миленько, как в аниме»): a soft pink round at the bottom of the coral inside,
    # with a faint middle line, laid only over the inside (not the teeth, not the outline)
    ra = np.array(rgba).astype(float); R, G, B = ra[..., 0], ra[..., 1], ra[..., 2]
    inside = (full > 0) & (R > 150) & (G < 140) & (R - G > 70)
    iy, ix = np.nonzero(inside)
    if len(ix) > 20:
        tx, iw = ix.mean(), ix.max() - ix.min() + 1; ih = iy.max() - iy.min() + 1; ty = iy.max() - ih * 0.28
        yy, xx = np.mgrid[0:ra.shape[0], 0:ra.shape[1]]
        e = ((xx - tx) / (iw * 0.36)) ** 2 + ((yy - ty) / (ih * 0.42)) ** 2
        w_ = np.clip((1.15 - e) / 0.5, 0, 1) * inside * 0.8
        pink = np.array([255, 146, 150], float)
        for c in range(3): ra[..., c] = ra[..., c] * (1 - w_) + pink[c] * w_
        groove = (np.abs(xx - tx) < 0.6) & (yy > ty - ih * 0.08) & (yy < ty + ih * 0.08) & inside
        ra[groove, :3] = ra[groove, :3] * 0.9
    rgba = Image.fromarray(np.clip(ra, 0, 255).astype(np.uint8), 'RGBA')
    rgba.save(f'img/{k}_mopen.png')
    ys = np.nonzero(mask.any(1))[0]
    m['art'] = [int(ys.min() + Y0), int(ys.max() + Y0 + 1)]
    print(k, 'mouth px', int(mask.sum()), 'rows', m['art'])
json.dump(M, open('img/mouths.json', 'w'), indent=1)
