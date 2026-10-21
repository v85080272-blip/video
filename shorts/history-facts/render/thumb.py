"""Preview covers (thumbnails) 1080x1920 for the feed and the channel grid: one still with a punchier grade and 2–4 big
words, built for a phone-size glance (vla 21.10: «нужно придумать обложку цепляющую для превью»).

Rules from thumbnail guides: one focal point (a face or the words), 3–4 words at most, strong contrast, and a check at
grid size. Everything important stays inside the middle 3:4 (y 240–1680), which Instagram's profile grid keeps.
Most YouTube channels can only pick a frame of a Short (uploading a custom Shorts thumbnail is for partner channels since
July 2026), so the chosen cover also goes into the video's first frames (see the episode's COVER_IMG).

Usage: python3 thumb.py <spec.json> <out_dir>      writes <out_dir>/<id>.jpg per variant and <out_dir>/grid.jpg
Spec: a list of variants, each {id, img, cam: {zoom, panx, pany}, grade: {...engine.grade}, glow: {x, y, r, strength,
color} (a blast of light from a point, fractions of the frame), bloom, vignette, band: {y, h, strength} (a dark band
behind the words), tag: {text, y}, lines: [{text, y, size, color | box}]}.
color is white or yellow; box (yellow or red) puts the line on a plaque.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import W, H, font, TextLayer, paste_rgba, grade, bloom, vignette, to_np, to_img

WHITE, YELLOW, RED, ORANGE, INK = (255, 255, 255), (255, 212, 0), (214, 32, 32), (255, 150, 40), (20, 16, 10)
COLORS = dict(white=WHITE, yellow=YELLOW)
BOXES = dict(yellow=(YELLOW, INK), red=(RED, WHITE))
TEXT = TextLayer()


def fit(img, zoom=1.0, panx=0.0, pany=0.0):
    """Cover-fit the still to 1080x1920, then zoom in and pan (fractions of the still)."""
    s = max(W / img.width, H / img.height) * zoom
    w, h = W / s, H / s
    cx = img.width / 2 + panx * img.width
    cy = img.height / 2 + pany * img.height
    cx = min(max(cx, w / 2), img.width - w / 2)
    cy = min(max(cy, h / 2), img.height - h / 2)
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    return img.resize((W, H), Image.LANCZOS, box=box)


def plaque(a, im, cx, cy, fill, pad=(34, 14)):
    """A solid plaque behind a line of text, slightly wider than the words."""
    bw, bh = im.width + 2 * pad[0], im.height + 2 * pad[1]
    x0, y0 = int(cx - bw / 2), int(cy - bh / 2)
    box = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(box).rounded_rectangle((0, 0, bw - 1, bh - 1), radius=18, fill=fill + (255,))
    sh = Image.new('RGBA', (bw + 60, bh + 60), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((30, 38, bw + 29, bh + 37), radius=18, fill=(0, 0, 0, 150))
    paste_rgba(a, sh.filter(ImageFilter.GaussianBlur(12)), x0 + (bw + 60) / 2 - 30, y0 + (bh + 60) / 2 - 30)
    paste_rgba(a, box, x0 + bw / 2, y0 + bh / 2)


def make(v):
    img = Image.open(v['img']).convert('RGB')
    c = v.get('cam', {})
    im = fit(img, c.get('zoom', 1.0), c.get('panx', 0.0), c.get('pany', 0.0))
    im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
    a = to_np(im)
    a = grade(a, **v.get('grade', {}))
    g = v.get('glow')
    if g:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.hypot(xx - g['x'] * W, yy - g['y'] * H) / (g.get('r', 0.8) * W)
        a = a + g.get('strength', 0.9) * np.exp(-d ** 2)[..., None] * np.array(g.get('color', (1.0, 0.95, 0.85)), np.float32)
    if v.get('bloom'):
        a = bloom(a, strength=v['bloom'])
    a = vignette(a, v.get('vignette', 0.45))
    b = v.get('band')
    if b:
        yy = np.arange(H, dtype=np.float32)
        band = np.exp(-((yy - b['y']) / (b['h'] / 2)) ** 2)[:, None, None]
        a = a * (1 - b.get('strength', 0.55) * band)
    a = np.clip(a, 0, 1)
    tg = v.get('tag')
    if tg:
        t = TEXT.render(tg['text'], font('Inter-ExtraBold.otf', 50), ORANGE, stroke=6, track=8)
        paste_rgba(a, t, W / 2, tg.get('y', 300))
    for ln in v.get('lines', []):
        fnt = font('InterDisplay-Black.otf', ln.get('size', 200))
        if ln.get('box'):
            fill, ink = BOXES[ln['box']]
            t = TEXT.render(ln['text'], fnt, ink, stroke=0, shadow=False, squeeze=0.9, track=-4)
            sc = min(1.0, 900 / t.width)
            if sc < 1.0:
                t = t.resize((int(t.width * sc), int(t.height * sc)), Image.LANCZOS)
            plaque(a, t, W / 2, ln['y'], fill)
            paste_rgba(a, t, W / 2, ln['y'])
        else:
            t = TEXT.render(ln['text'], fnt, COLORS[ln.get('color', 'white')], stroke=ln.get('stroke', 14), squeeze=0.9,
                            track=-4)
            paste_rgba(a, t, W / 2, ln['y'], scale=min(1.0, 980 / t.width))
    return to_img(a)


def main(spec_path, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    spec = json.load(open(spec_path))
    outs = []
    for v in spec:
        im = make(v)
        p = os.path.join(out_dir, f"{v['id']}.jpg")
        im.save(p, quality=95)
        outs.append(im)
        print('cover', p)
    # grid-size check: how the covers read at about the size of a phone's channel grid
    gw, gh = 240, 427
    grid = Image.new('RGB', (gw * len(outs) + 20 * (len(outs) - 1), gh), (235, 235, 235))
    for k, im in enumerate(outs):
        grid.paste(im.resize((gw, gh), Image.LANCZOS), (k * (gw + 20), 0))
    grid.save(os.path.join(out_dir, 'grid.jpg'), quality=90)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
