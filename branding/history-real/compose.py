#!/usr/bin/env python3
"""Channel art for History_real: avatar 800x800, banner 2560x1440 and phone/desktop previews.

The look follows the «Тайны истории» covers (shorts/history-facts on its own branch): a dark warm frame,
embers, a yellow InterDisplay Black title with a black outline, an orange letter-spaced kicker, white text.

ESRGAN=1 runs Real-ESRGAN x4 on the banner background first (slow on CPU, see esrgan_x4).
Usage:
  compose.py avatar  <src.png> <out.png> [--zoom Z] [--cx X] [--cy Y] [--light x,y,radius,strength] [--ring]
  compose.py banner  <src.png> <out.jpg> [--focus F] [--variant A|B]
  compose.py preview <banner.jpg> <avatar.png> <out_dir>
"""
import argparse, glob, os, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WORK = os.environ.get('WORK', '/home/user/work')
SD = f'{WORK}/src/stable-diffusion.cpp/build/bin/sd-cli'
ESRGAN = f'{WORK}/models/RealESRGAN_x4plus.safetensors'

ORANGE = (255, 150, 40)
YELLOW = (255, 212, 0)
WHITE = (255, 255, 255)

# YouTube: banner 2560x1440, text-and-logo safe area 1546x423 in the middle (what a phone shows);
# a computer shows the full-width strip 2560x423, a TV the whole image.
BW, BH = 2560, 1440
SAFE_W, SAFE_H = 1546, 423
STRIP_Y0 = (BH - SAFE_H) // 2
SAFE_X0 = (BW - SAFE_W) // 2


def font(name, size):
    cands = glob.glob(f'/usr/share/fonts/**/{name}', recursive=True)
    if not cands:
        raise FileNotFoundError(name)
    return ImageFont.truetype(cands[0], size)


def text_image(text, fnt, fill, stroke=8, stroke_fill=(0, 0, 0), track=0, squeeze=1.0, shadow=True, colors=None):
    """Text as RGBA: all outlines first, then all fills, so an outline never bites into the next letter.
    colors: optional per-character fill list (same length as text)."""
    pad = stroke * 3 + 40
    asc, desc = fnt.getmetrics()
    tw = int(sum(fnt.getlength(ch) for ch in text) + track * max(0, len(text) - 1)) + 2 * pad
    th = asc + desc + 2 * pad
    xs, x = [], pad
    for ch in text:
        xs.append(x)
        x += fnt.getlength(ch) + track
    ink = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ink)
    if stroke:
        for ch, x in zip(text, xs):
            dr.text((x, pad), ch, font=fnt, fill=stroke_fill, stroke_width=stroke, stroke_fill=stroke_fill)
    for i, (ch, x) in enumerate(zip(text, xs)):
        dr.text((x, pad), ch, font=fnt, fill=(colors[i] if colors else fill))
    im = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    m = 0
    if shadow:
        off = max(3, stroke // 2)
        blur = max(4, stroke)
        m = off * 2 + blur * 2
        sh = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        for ch, x in zip(text, xs):
            sd.text((x + off, pad + off * 2), ch, font=fnt, fill=(0, 0, 0, 180), stroke_width=stroke, stroke_fill=(0, 0, 0, 180))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(blur)))
    im = Image.alpha_composite(im, ink)
    x0, y0, x1, y1 = ink.getbbox()   # crop to the letters plus a margin that holds the shadow
    im = im.crop((x0 - m, y0 - m, x1 + m, y1 + m))
    if squeeze != 1.0:
        im = im.resize((max(1, int(im.width * squeeze)), im.height), Image.LANCZOS)
    im.margin = m                    # layout uses the ink box: size minus 2 * margin
    return im


def paste(base, im, cx, cy):
    """Alpha-composite RGBA `im` onto RGBA `base` centred at (cx, cy)."""
    base.alpha_composite(im, (int(round(cx - im.width / 2)), int(round(cy - im.height / 2))))


# ------------------------------------------------------------------ image helpers
def esrgan_x4(src):
    """Real-ESRGAN x4plus (BSD-3) through sd-cli, only with ESRGAN=1; cached next to the source.
    On 4 CPU cores a 2304x576 still takes about an hour (64 tiles, ~55 s each), so by default the
    background is just resized with Lanczos: for a 2304-wide panorama that is only x1.11."""
    if not os.environ.get('ESRGAN'):
        return src
    out = src[:-4] + '_x4.png'
    if not os.path.exists(out):
        cmd = [SD, '-M', 'upscale', '--upscale-model', ESRGAN, '-i', src, '-o', out, '-t', '4', '--upscale-tile-size', '192']
        r = subprocess.run(cmd, capture_output=True, text=True)
        if not os.path.exists(out):
            raise RuntimeError('esrgan failed: ' + r.stderr[-800:])
    return out


def to_f(im):
    return np.asarray(im.convert('RGB'), np.float32) / 255.0


def to_im(a):
    return Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8))


def grade(a, warmth=0.06, contrast=1.08, lift=0.0, sat=1.08):
    """Warm, slightly punchy grade in the spirit of the covers."""
    lum = (a * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    a = lum + (a - lum) * sat
    a = (a - 0.5) * contrast + 0.5 + lift
    a = a * np.array([1 + warmth, 1 + warmth * 0.25, 1 - warmth], np.float32)
    return np.clip(a, 0, 1)


def vignette(h, w, cx=0.5, cy=0.5, rx=0.75, ry=0.75, power=2.2, strength=0.6):
    y, x = np.ogrid[0:h, 0:w]
    r = np.sqrt(((x / w - cx) / rx) ** 2 + ((y / h - cy) / ry) ** 2)
    return (1 - strength * np.clip(r, 0, 1) ** power).astype(np.float32)[..., None]


def embers(w, h, n, seed, y_bias=0.0, size=(1.5, 5.0), bokeh=0, glow=1.0, avoid=None, keep=0.15):
    """Additive layer of glowing sparks; y_bias > 0 puts more of them low in the frame.
    avoid=(cx, cy, rx, ry) keeps only the share `keep` of them inside that ellipse (text, a face)."""
    rng = np.random.default_rng(seed)
    layer = Image.new('RGB', (w, h), (0, 0, 0))
    dr = ImageDraw.Draw(layer)
    cols = [(255, 196, 96), (255, 150, 50), (255, 226, 160), (255, 120, 30)]
    for _ in range(n):
        x = rng.uniform(0, w)
        y = h * (1 - rng.uniform(0, 1) ** (1 + y_bias))
        if avoid is not None:
            cx, cy, rx, ry = avoid
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 and rng.random() >= keep:
                continue
        r = rng.uniform(*size)
        c = cols[rng.integers(len(cols))]
        k = rng.uniform(0.35, 1.0)
        dr.ellipse((x - r, y - r, x + r, y + r), fill=tuple(int(v * k) for v in c))
    for _ in range(bokeh):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(10, 34)
        c = cols[rng.integers(len(cols))]
        k = rng.uniform(0.10, 0.28)
        dr.ellipse((x - r, y - r, x + r, y + r), fill=tuple(int(v * k) for v in c))
    sharp = to_f(layer)
    soft = to_f(layer.filter(ImageFilter.GaussianBlur(6)))
    wide = to_f(layer.filter(ImageFilter.GaussianBlur(18)))
    return sharp * 0.9 + soft * 1.6 * glow + wide * 1.2 * glow


def grain(a, amount, seed=7):
    rng = np.random.default_rng(seed)
    g = rng.normal(0, amount, a.shape[:2]).astype(np.float32)[..., None]
    lum = a.mean(-1, keepdims=True)
    return np.clip(a + g * (0.35 + 0.65 * np.clip(1 - np.abs(lum - 0.45) * 1.4, 0, 1)), 0, 1)


def screen(a, b):
    return 1 - (1 - a) * (1 - np.clip(b, 0, 1))


# ------------------------------------------------------------------ avatar
def make_avatar(src, out, zoom=1.0, cx=0.5, cy=0.5, ring=False, size=800, seed=3, light=None):
    """light=(x, y, radius, strength) in source fractions: extra warm lantern light from that point."""
    im = Image.open(src).convert('RGB')
    sw, sh = im.size
    s = min(sw, sh) / zoom
    x0 = min(max(cx * sw - s / 2, 0), sw - s)     # keep the crop inside the picture
    y0 = min(max(cy * sh - s / 2, 0), sh - s)
    box = (x0, y0, x0 + s, y0 + s)
    big = size * 2  # work at 2x for clean edges, downsample at the end
    im = im.resize((big, big), Image.LANCZOS, box=box)
    a = grade(to_f(im), warmth=0.05, contrast=1.06)
    if light:
        lx, ly, lr, ls = light
        px, py = (lx * sw - x0) / s * big, (ly * sh - y0) / s * big   # source -> crop pixels
        y, x = np.ogrid[0:big, 0:big]
        r = np.sqrt((x - px) ** 2 + (y - py) ** 2) / (lr * big)
        f = (np.clip(1 - r, 0, 1) ** 1.8).astype(np.float32)[..., None]
        warm = np.array([1.0, 0.62, 0.26], np.float32)
        lum = a.mean(-1, keepdims=True)
        a = np.clip(a + f * ls * warm * (0.25 + lum), 0, 1)     # lights what is there, keeps the dark dark
    a = a * vignette(big, big, rx=0.72, ry=0.72, power=2.5, strength=0.75)
    a = screen(a, embers(big, big, 46, seed, y_bias=0.9, size=(2.0, 5.0), bokeh=0, glow=0.7,
                         avoid=(big / 2, big * 0.45, big * 0.36, big * 0.46), keep=0.0) * 0.8)
    if ring:
        y, x = np.ogrid[0:big, 0:big]
        r = np.sqrt((x - big / 2) ** 2 + (y - big / 2) ** 2) / (big / 2)
        band = np.exp(-((r - 0.955) / 0.012) ** 2).astype(np.float32)[..., None]
        halo = np.exp(-((r - 0.955) / 0.05) ** 2).astype(np.float32)[..., None]
        gold = np.array([1.0, 0.78, 0.30], np.float32)
        a = screen(a, band * gold * 0.95 + halo * gold * 0.25)
    a = grain(a, 0.012)
    to_im(a).resize((size, size), Image.LANCZOS).save(out, optimize=True)
    print('avatar', out)


# ------------------------------------------------------------------ banner
def title_block(variant='A', s=0.86):
    """Kicker, channel name and tagline stacked as one RGBA block; s scales the whole block."""
    kicker = text_image('ТАЙНЫ ИСТОРИИ', font('Inter-ExtraBold.otf', round(50 * s)), ORANGE, stroke=round(6 * s), track=14 * s)
    name = 'HISTORY_REAL'
    if variant == 'A':      # all yellow, like the year on the covers
        cols = None
    else:                   # HISTORY yellow, _REAL white, like year + headline on the covers
        cols = [YELLOW] * 7 + [WHITE] * 5
    title = text_image(name, font('InterDisplay-Black.otf', round(160 * s)), YELLOW, stroke=round(12 * s), track=-2 * s,
                       squeeze=0.94, colors=cols)
    tag = text_image('Невероятно, но это было на самом деле', font('Inter-ExtraBold.otf', round(54 * s)), WHITE,
                     stroke=round(6 * s), track=1 * s)
    parts, gaps = (kicker, title, tag), (round(30 * s), round(34 * s))     # gaps between the letters themselves
    inks = [(p.width - 2 * p.margin, p.height - 2 * p.margin) for p in parts]
    M = max(p.margin for p in parts)
    w = max(iw for iw, _ in inks) + 2 * M
    h = sum(ih for _, ih in inks) + sum(gaps) + 2 * M
    blk = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    y = M
    for i, p in enumerate(parts):
        blk.alpha_composite(p, ((w - p.width) // 2, y - p.margin))
        if i == 0:   # thin orange rules either side of the kicker, fading outwards
            ky = y + inks[0][1] // 2
            L, gap, t = round(150 * s), round(26 * s), max(2, round(4 * s))
            line = np.zeros((t, L, 4), np.uint8)
            line[..., :3] = ORANGE
            line[..., 3] = (np.linspace(1, 0, L, dtype=np.float32) ** 1.4 * 255).astype(np.uint8)[None, :]
            right = Image.fromarray(line, 'RGBA')
            half = inks[0][0] // 2 + gap
            blk.alpha_composite(right, (w // 2 + half, ky - t // 2))
            blk.alpha_composite(right.transpose(Image.FLIP_LEFT_RIGHT), (w // 2 - half - L, ky - t // 2))
        y += inks[i][1] + (gaps[i] if i < len(gaps) else 0)
    blk.margin = M
    return blk


def make_banner(src, out, focus=0.5, variant='A', seed=5):
    up = Image.open(esrgan_x4(src)).convert('RGB')
    sw = BW
    sh = round(up.height * BW / up.width)
    img = up.resize((sw, sh), Image.LANCZOS)
    a_img = grade(to_f(img), warmth=0.04, contrast=1.06)
    # place the source so that its row `focus` (0..1) sits in the middle of the visible strip
    oy = int(round(BH / 2 - focus * sh))
    if sh >= BH:
        oy = min(max(oy, BH - sh), 0)
    y0, y1 = max(0, oy), min(BH, oy + sh)
    ys = np.arange(BH)
    rows = ys - oy
    rows = np.where(rows < 0, -rows - 1, rows)               # mirror above the picture
    rows = np.where(rows >= sh, 2 * sh - rows - 1, rows)     # and below it
    rows = np.clip(rows, 0, sh - 1)
    canvas = a_img[rows]
    if y0 > 0 or y1 < BH:
        # TV-only margins: a blurred mirror of the picture that sinks into darkness; the sharp picture
        # melts into it over a ramp that ends before the visible strip, so phones and computers never see it
        blur = grade(to_f(img.filter(ImageFilter.GaussianBlur(22))), warmth=0.04, contrast=1.06)[rows]
        dist = np.maximum(np.maximum(y0 - ys, 0), np.maximum(ys - (y1 - 1), 0)).astype(np.float32)
        fade = (0.10 + 0.90 * np.exp(-dist / 240))[:, None, None]
        alpha = np.ones(BH, np.float32)
        if y0 > 0:
            L = max(8, min(110, STRIP_Y0 - y0))
            alpha = np.minimum(alpha, np.clip((ys - y0) / L, 0, 1))
        if y1 < BH:
            L = max(8, min(110, (y1 - 1) - (STRIP_Y0 + SAFE_H)))
            alpha = np.minimum(alpha, np.clip(((y1 - 1) - ys) / L, 0, 1))
        alpha = (alpha * alpha * (3 - 2 * alpha))[:, None, None]
        canvas = canvas * alpha + blur * fade * (1 - alpha)
    a = canvas.astype(np.float32)
    # darken behind the title, keep the sides alive
    cy = BH / 2
    y, x = np.ogrid[0:BH, 0:BW]
    r = np.sqrt(((x - BW / 2) / 760) ** 2 + ((y - cy) / 250) ** 2)
    a = a * (1 - 0.55 * np.clip(1 - r, 0, 1) ** 1.3)[..., None].astype(np.float32)
    # whole-strip edge falloff for a cinematic band
    a = a * vignette(BH, BW, rx=0.62, ry=0.62, power=2.4, strength=0.5)
    a = screen(a, embers(BW, BH, 240, seed, y_bias=1.2, size=(1.4, 4.5), bokeh=0, glow=0.7,
                         avoid=(BW / 2, cy, 760, 230)) * 0.8)
    a = grain(a, 0.010)
    base = to_im(a).convert('RGBA')
    blk = title_block(variant)
    paste(base, blk, BW / 2, cy)
    base.convert('RGB').save(out, quality=93, optimize=True, progressive=True)
    print('banner', out, os.path.getsize(out) // 1024, 'KB')


# ------------------------------------------------------------------ previews
def round_mask(w, h, r):
    m = Image.new('L', (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), r * 4, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def circle_mask(d):
    m = Image.new('L', (d * 4, d * 4), 0)
    ImageDraw.Draw(m).ellipse((0, 0, d * 4 - 1, d * 4 - 1), fill=255)
    return m.resize((d, d), Image.LANCZOS)


def preview_phone(banner, avatar, out):
    """Roughly the YouTube iPhone channel page from vla's screenshot (1179 px wide)."""
    W, H = 1179, 1240
    bg = (15, 15, 15)
    im = Image.new('RGB', (W, H), bg)
    dr = ImageDraw.Draw(im)
    # top bar
    dr.line((84, 214, 62, 240, 84, 266), fill=WHITE, width=7, joint='curve')
    dr.ellipse((938, 214, 984, 260), outline=WHITE, width=6)
    dr.line((978, 254, 994, 270), fill=WHITE, width=7)
    for yy in (220, 242, 264):
        dr.ellipse((1088, yy - 6, 1100, yy + 6), fill=WHITE)
    # banner: the safe area, rounded
    b = Image.open(banner).convert('RGB').crop((SAFE_X0, STRIP_Y0, SAFE_X0 + SAFE_W, STRIP_Y0 + SAFE_H))
    bw, bh = 1084, round(1084 * SAFE_H / SAFE_W)
    im.paste(b.resize((bw, bh), Image.LANCZOS), (48, 311), round_mask(bw, bh, 26))
    # avatar
    d = 216
    av = Image.open(avatar).convert('RGB').resize((d, d), Image.LANCZOS)
    im.paste(av, (48, 646), circle_mask(d))
    dr.text((314, 650), 'History_real', font=font('Inter-Bold.otf', 70), fill=WHITE)
    dr.text((316, 752), '@History_realing', font=font('Inter-Medium.otf', 38), fill=(241, 241, 241))
    dr.text((430, 818), '8 подписчиков ›', font=font('Inter-SemiBold.otf', 38), fill=(170, 170, 170))
    for i, c in enumerate([(30, 90, 70), (90, 90, 90), (70, 90, 110)]):
        dr.ellipse((318 + i * 26, 818, 362 + i * 26, 862), fill=c, outline=bg, width=3)
    # buttons
    for x0, x1, label in ((48, 580, 'Аналитика'), (605, 1133, 'Параметры канала')):
        dr.rounded_rectangle((x0, 892, x1, 1010), 59, fill=(39, 39, 39))
        f = font('Inter-SemiBold.otf', 40)
        tw = f.getlength(label)
        dr.text(((x0 + x1) / 2 - tw / 2, 928), label, font=f, fill=WHITE)
    # tabs
    f = font('Inter-SemiBold.otf', 44)
    for cx, label, on in ((202, 'Главная', False), (585, 'Видео', True), (950, 'Shorts', False)):
        tw = f.getlength(label)
        dr.text((cx - tw / 2, 1100), label, font=f, fill=WHITE if on else (170, 170, 170))
    dr.line((0, 1196, W, 1196), fill=(60, 60, 60), width=2)
    dr.rounded_rectangle((440, 1188, 730, 1194), 3, fill=WHITE)
    im.save(out, optimize=True)
    print('preview', out)


def preview_desktop(banner, avatar, out):
    """Roughly the YouTube channel page in a browser: the full-width strip, then avatar and name."""
    W, H = 1920, 760
    bg = (15, 15, 15)
    im = Image.new('RGB', (W, H), bg)
    dr = ImageDraw.Draw(im)
    b = Image.open(banner).convert('RGB').crop((0, STRIP_Y0, BW, STRIP_Y0 + SAFE_H))
    bw = 1800
    bh = round(bw * SAFE_H / BW)
    im.paste(b.resize((bw, bh), Image.LANCZOS), (60, 40), round_mask(bw, bh, 18))
    d = 200
    av = Image.open(avatar).convert('RGB').resize((d, d), Image.LANCZOS)
    y = 40 + bh + 36
    im.paste(av, (60, y), circle_mask(d))
    dr.text((300, y + 6), 'History_real', font=font('Inter-Bold.otf', 64), fill=WHITE)
    dr.text((302, y + 92), '@History_realing · 8 подписчиков', font=font('Inter-Medium.otf', 28), fill=(170, 170, 170))
    dr.text((302, y + 136), 'Тайны истории: невероятно, но это было на самом деле', font=font('Inter-Medium.otf', 28), fill=(170, 170, 170))
    for x0, x1, label in ((300, 610, 'Настроить вид канала'), (630, 900, 'Управление видео')):
        dr.rounded_rectangle((x0, y + 190, x1, y + 246), 28, fill=(39, 39, 39))
        f = font('Inter-SemiBold.otf', 24)
        tw = f.getlength(label)
        dr.text(((x0 + x1) / 2 - tw / 2, y + 204), label, font=f, fill=WHITE)
    im.save(out, optimize=True)
    print('preview', out)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['avatar', 'banner', 'preview'])
    ap.add_argument('a')
    ap.add_argument('b')
    ap.add_argument('c', nargs='?')
    ap.add_argument('--zoom', type=float, default=1.0)
    ap.add_argument('--cx', type=float, default=0.5)
    ap.add_argument('--cy', type=float, default=0.5)
    ap.add_argument('--ring', action='store_true')
    ap.add_argument('--light', help='x,y,radius,strength in source fractions')
    ap.add_argument('--focus', type=float, default=0.5)
    ap.add_argument('--variant', default='A')
    o = ap.parse_args()
    if o.mode == 'avatar':
        make_avatar(o.a, o.b, o.zoom, o.cx, o.cy, o.ring,
                    light=tuple(float(v) for v in o.light.split(',')) if o.light else None)
    elif o.mode == 'banner':
        make_banner(o.a, o.b, o.focus, o.variant)
    else:
        os.makedirs(o.c, exist_ok=True)
        preview_phone(o.a, o.b, os.path.join(o.c, 'preview-phone.png'))
        preview_desktop(o.a, o.b, os.path.join(o.c, 'preview-desktop.png'))
