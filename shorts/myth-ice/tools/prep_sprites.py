# Искра's poses for lip sync: in each pose (img/i_*.png, cut from the user's sheets) find the open mouth, then write
#   img/<pose>_closed.png — the same pose with the mouth painted over in skin and a closed smiling line drawn,
#   img/<pose>_mouth.png  — the open mouth alone (an ellipse of the original pixels), to be drawn squashed by how loud
#                           the voice is (src/iskra.js);
# and img/mouths.json with each mouth's box in the pose's own pixels.
# usage: python3 tools/prep_sprites.py
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(os.path.dirname(HERE), 'img')
# the open mouth of each pose, marked by hand on a 4× grid: its box and the two corners of the lips
MARK = {'i_hi': ([158, 98, 184, 114], (160, 106), (183, 100)), 'i_explain': ([130, 107, 156, 127], (132, 113), (155, 109)),
        'i_left': ([229, 107, 251, 124], (230, 112), (250, 111)), 'i_right': ([129, 104, 153, 122], (130, 110), (152, 106)),
        'i_truth': ([141, 111, 174, 134], (143, 120), (171, 114))}
out = {}
for p, (box, L, R) in MARK.items():
    im = Image.open(os.path.join(IMG, p + '.png')).convert('RGBA'); a = np.asarray(im).astype(int)
    h, w = a.shape[:2]
    x0, y0, x1, y1 = box
    # the skin just under the mouth
    ring = a[y1 + 2:y1 + 8, x0 + 3:x1 - 3].reshape(-1, 4)
    ring = ring[(ring[:, 3] > 200) & (ring[:, 0] > 200) & (ring[:, 1] > 150)]
    skin = tuple(int(v) for v in np.median(ring[:, :3], axis=0)) if len(ring) else (250, 210, 182)
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).ellipse([x0 - 1, y0 - 1, x1 + 1, y1 + 1], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.7))
    mouth = Image.new('RGBA', (w, h)); mouth.paste(im, (0, 0), mask)
    bb = [x0 - 2, y0 - 2, x1 + 3, y1 + 3]
    mouth.crop(bb).save(os.path.join(IMG, p + '_mouth.png'))
    closed = im.copy()
    patch = Image.new('RGBA', (w, h), skin + (255,)); pm = Image.new('L', (w, h), 0)
    ImageDraw.Draw(pm).ellipse([x0 - 3, y0 - 2, x1 + 3, y1 + 4], fill=255); pm = pm.filter(ImageFilter.GaussianBlur(1.2))
    closed.paste(patch, (0, 0), pm)
    # the closed lips: a small smiling curve, drawn 4× bigger and scaled down so it is smooth
    S = 4; lay = Image.new('RGBA', (w * S, h * S)); d = ImageDraw.Draw(lay)
    my = (L[1] + R[1]) / 2 + 2.5                                                    # the middle a little lower
    pts = [((L[0] + (R[0] - L[0]) * t) * S, ((1 - t) ** 2 * L[1] + 2 * (1 - t) * t * my + t * t * R[1]) * S) for t in np.linspace(0, 1, 24)]
    d.line(pts, fill=(96, 34, 52, 255), width=7, joint='curve')
    for q in (pts[0], pts[-1]): d.ellipse([q[0] - 3, q[1] - 3, q[0] + 3, q[1] + 3], fill=(96, 34, 52, 255))
    closed.alpha_composite(lay.resize((w, h), Image.LANCZOS))
    closed.save(os.path.join(IMG, p + '_closed.png'))
    out[p] = dict(box=bb, top=y0, skin=skin, size=[w, h])
    print(p, bb, skin)
json.dump(out, open(os.path.join(IMG, 'mouths.json'), 'w'), indent=1)
