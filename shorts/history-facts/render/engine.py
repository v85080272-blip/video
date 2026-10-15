"""2.5D cinematic renderer for vertical history shorts.

Each shot is one still (SDXL) plus its depth map. The camera is a depth-aware warp:
zoom, pan, dolly (near things grow faster), lateral parallax, roll and shake. The warp is a
PIL mesh transform whose vertices are solved against the depth map, so it runs in C.
On top: particles, fog, light flashes, bloom, grade, grain, vignette, captions and cards.
"""
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

W, H, FPS = 1080, 1920, 30
FONT_DIR = '/usr/share/fonts/truetype/inter/'


def font(name, size):
    import glob, os
    cands = glob.glob(f'/usr/share/fonts/**/{name}', recursive=True)
    if not cands:
        raise FileNotFoundError(name)
    return ImageFont.truetype(cands[0], size)


def ease_in_out(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def ease_out(u, p=3):
    u = min(max(u, 0.0), 1.0)
    return 1 - (1 - u) ** p


def lerp(a, b, u):
    return a + (b - a) * u


# ---------------------------------------------------------------- source prep
class Source:
    """An upscaled still with a smoothed depth map (near = 1)."""

    def __init__(self, img_path, depth_path, up=1.75, sharpen=True, grade_kw=None):
        im = Image.open(img_path).convert('RGB')
        sw, sh = int(im.width * up), int(im.height * up)
        im = im.resize((sw, sh), Image.LANCZOS)
        if sharpen:
            im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=55, threshold=2))
        if grade_kw:
            im = to_img(grade(to_np(im), **grade_kw))
        self.img = im
        d = Image.open(depth_path)
        d = np.asarray(d, np.float32) / 65535.0
        dimg = Image.fromarray((d * 255).astype(np.uint8)).resize((sw, sh), Image.BICUBIC)
        # soften depth so the mesh does not tear; small max-filter keeps foreground edges whole
        dimg = dimg.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(3))
        self.depth_img = dimg
        self.depth = np.asarray(dimg, np.float32) / 255.0
        self.w, self.h = sw, sh

    def depth_at(self, x, y):
        h, w = self.depth.shape
        x = np.clip(x, 0, w - 1.001)
        y = np.clip(y, 0, h - 1.001)
        x0 = x.astype(np.int32)
        y0 = y.astype(np.int32)
        fx = x - x0
        fy = y - y0
        d = self.depth
        return ((d[y0, x0] * (1 - fx) + d[y0, x0 + 1] * fx) * (1 - fy)
                + (d[y0 + 1, x0] * (1 - fx) + d[y0 + 1, x0 + 1] * fx) * fy)


# ---------------------------------------------------------------- camera
class Cam:
    """Camera state for one frame. Units: zoom is relative to cover-fit; pan in source-fraction;
    par = parallax in output px per unit depth (relative to focus d0); dolly = extra zoom per unit depth."""

    def __init__(self, zoom=1.0, panx=0.0, pany=0.0, parx=0.0, pary=0.0, dolly=0.0, d0=0.5, roll=0.0,
                 shakex=0.0, shakey=0.0):
        self.zoom, self.panx, self.pany = zoom, panx, pany
        self.parx, self.pary, self.dolly, self.d0, self.roll = parx, pary, dolly, d0, roll
        self.shakex, self.shakey = shakex, shakey


def solve_mesh(src: Source, cam: Cam, step=24, iters=5):
    """For every output grid vertex find the source point that lands there."""
    gx = np.arange(0, W + step, step, dtype=np.float32)
    gy = np.arange(0, H + step, step, dtype=np.float32)
    px, py = np.meshgrid(gx, gy)
    base = max(W / src.w, H / src.h)
    cx_s = src.w / 2 + cam.panx * src.w
    cy_s = src.h / 2 + cam.pany * src.h
    C = np.array([W / 2, H / 2], np.float32)
    cr, sr = math.cos(-math.radians(cam.roll)), math.sin(-math.radians(cam.roll))
    d = np.full(px.shape, cam.d0, np.float32)
    for _ in range(iters):
        S = base * cam.zoom * (1 + cam.dolly * (d - cam.d0))
        tx = cam.parx * (d - cam.d0) + cam.shakex
        ty = cam.pary * (d - cam.d0) + cam.shakey
        ox = px - C[0] - tx
        oy = py - C[1] - ty
        rx = ox * cr - oy * sr
        ry = ox * sr + oy * cr
        xs = cx_s + rx / S
        ys = cy_s + ry / S
        dn = src.depth_at(xs, ys)
        d = 0.5 * d + 0.5 * dn
    heat = getattr(cam, 'heat', 0.0)
    if heat:
        t = getattr(cam, 't', 0.0)
        band = np.clip(1.0 - py / (H * 0.6), 0, 1) ** 1.5
        xs = xs + heat * 2.2 * band * np.sin(py / 38.0 + t * 7.0 + px / 170.0)
        ys = ys + heat * 1.4 * band * np.sin(px / 45.0 + t * 5.3)
    return gx, gy, xs, ys


def warp(src: Source, cam: Cam, step=30, with_depth=False):
    gx, gy, xs, ys = solve_mesh(src, cam, step)
    mesh = []
    for j in range(len(gy) - 1):
        for i in range(len(gx) - 1):
            box = (int(gx[i]), int(gy[j]), int(gx[i + 1]), int(gy[j + 1]))
            quad = (xs[j, i], ys[j, i], xs[j + 1, i], ys[j + 1, i],
                    xs[j + 1, i + 1], ys[j + 1, i + 1], xs[j, i + 1], ys[j, i + 1])
            mesh.append((box, quad))
    out = src.img.transform((W, H), Image.MESH, mesh, resample=Image.BICUBIC)
    dep = src.depth_img.transform((W, H), Image.MESH, mesh, resample=Image.BILINEAR) if with_depth else None
    return out, dep


# ---------------------------------------------------------------- noise helpers
def smooth_noise(seed, t, octaves=3, speed=1.0):
    """Cheap 1-D smooth noise in [-1, 1] from summed sines with random phases."""
    rnd = random.Random(seed)
    v = 0.0
    amp = 1.0
    tot = 0.0
    for o in range(octaves):
        f = (0.7 + rnd.random()) * (2 ** o) * speed
        ph = rnd.random() * 6.283
        v += amp * math.sin(t * f * 6.283 + ph)
        tot += amp
        amp *= 0.5
    return v / tot


def fbm_texture(w, h, seed=0, base=6, octaves=5):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp = 1.0
    tot = 0.0
    for o in range(octaves):
        cw, ch = max(2, base * 2 ** o), max(2, int(base * 2 ** o * h / w))
        small = rng.random((ch, cw)).astype(np.float32)
        layer = np.asarray(Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC),
                           np.float32) / 255.0
        acc += amp * layer
        tot += amp
        amp *= 0.55
    acc /= tot
    acc = (acc - acc.min()) / (acc.max() - acc.min() + 1e-6)
    return acc


# ---------------------------------------------------------------- particles
def sprite(radius, hard=0.0):
    r = int(math.ceil(radius * 3))
    y, x = np.mgrid[-r:r + 1, -r:r + 1].astype(np.float32)
    d2 = (x * x + y * y) / (radius * radius)
    s = np.exp(-d2 * (1 - hard * 0.8))
    return s


class Birds:
    """A flock crossing the frame, seen from below: dark silhouettes (body, tail, two wings that beat and foreshorten),
    nearer birds bigger, faster and sharper; optionally each carries a glowing ember with a short spark trail
    (the tinder in «Месть княгини Ольги»). Positions are spread so the flock fills the frame for `dur` seconds."""

    def __init__(self, n=30, seed=1, dir=(1.0, -0.35), speed=260.0, size=(14.0, 70.0), ember=0.0, dur=6.0,
                 area=(0.0, 0.0, 1.0, 0.75), col=(0.05, 0.04, 0.04)):
        rng = np.random.default_rng(seed)
        d = np.array(dir, float)
        d /= np.linalg.norm(d) + 1e-9
        self.n, self.ember, self.col = n, ember, np.array(col, np.float32)
        self.z = rng.random(n)
        self.size = size[0] + (size[1] - size[0]) * self.z ** 1.5
        self.v = d[None, :] * (speed * (0.55 + 0.9 * self.z) * rng.uniform(0.85, 1.15, n))[:, None]
        on = np.stack([(area[0] + (area[2] - area[0]) * rng.random(n)) * W,
                       (area[1] + (area[3] - area[1]) * rng.random(n)) * H], 1)
        self.p0 = on - self.v * rng.uniform(0.0, dur, n)[:, None]       # at that moment the bird is on screen
        self.flap = rng.uniform(4.5, 7.0, n)                            # visual beats per second (30 fps)
        self.ph = rng.uniform(0, 2 * math.pi, n)
        self.wob = rng.uniform(0, 2 * math.pi, n)
        self.ang = math.atan2(d[1], d[0])

    def _pos(self, t):
        p = self.p0 + self.v * t
        p[:, 1] += 6.0 * np.sin(2.1 * t + self.wob) * (0.5 + self.z)
        return p

    def draw(self, frame, t):
        S = 2                                                           # mask at half resolution, soft edges
        m = Image.new('L', (W // S, H // S), 0)
        dr = ImageDraw.Draw(m)
        p = self._pos(t)
        ca, sa = math.cos(self.ang), math.sin(self.ang)
        for i in np.argsort(self.z):
            x, y = p[i]
            s = self.size[i]
            if not (-3 * s < x < W + 3 * s and -3 * s < y < H + 3 * s):
                continue
            w = math.sin(2 * math.pi * self.flap[i] * t + self.ph[i])  # wing beat: span foreshortens up/down
            sp_ = s * (0.3 + 0.7 * abs(w))
            tb = -0.12 * s - 0.1 * s * w                               # wing tips sweep back on the upstroke
            half = [(0.32 * s, 0.0), (0.2 * s, 0.06 * s), (0.14 * s, 0.1 * s), (0.08 * s, 0.45 * sp_),
                    (0.0, 0.8 * sp_), (tb, sp_), (tb - 0.1 * s, 0.85 * sp_), (-0.2 * s, 0.5 * sp_),
                    (-0.2 * s, 0.12 * s), (-0.3 * s, 0.07 * s), (-0.52 * s, 0.15 * s), (-0.54 * s, 0.0)]
            shape = half + [(u, -v) for u, v in reversed(half[1:-1])]
            pts = [((x + u * ca - v * sa) / S, (y + u * sa + v * ca) / S) for u, v in shape]
            dr.polygon(pts, fill=int(255 * (0.55 + 0.45 * self.z[i])))
        m = m.filter(ImageFilter.GaussianBlur(0.6)).resize((W, H), Image.BILINEAR)
        al = np.asarray(m, np.float32)[..., None] / 255.0
        frame *= 1 - al
        frame += al * self.col
        if self.ember <= 0:
            return
        lags = (0.0, 0.05, 0.1, 0.16)                                  # the ember and its spark trail
        P = [self._pos(t - lag) for lag in lags]
        for i in range(self.n):
            for k in range(len(lags)):
                x, y = P[k][i] + np.array([-0.15 * self.size[i] * ca, 0.35 * self.size[i]])
                rad = (1.5 + 3.5 * self.z[i]) * (1.0 - 0.22 * k)
                fl = 0.6 + 0.4 * math.sin(t * 17 + self.ph[i] + k)
                sp = sprite(round(rad * 4) / 4)
                r = sp.shape[0] // 2
                x0, y0 = int(x) - r, int(y) - r
                x1, y1 = x0 + sp.shape[1], y0 + sp.shape[0]
                if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
                    continue
                sx0, sy0 = max(0, -x0), max(0, -y0)
                sx1, sy1 = sp.shape[1] - max(0, x1 - W), sp.shape[0] - max(0, y1 - H)
                col = np.array([1.0, 0.55, 0.16], np.float32) * self.ember * fl * (1.0 - 0.25 * k) * (0.7 + 0.8 * self.z[i])
                frame[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] += sp[sy0:sy1, sx0:sx1, None] * col


class Particles:
    """kind: embers (rising sparks), ash (grey flakes falling), snow, dust (floating motes)."""

    def __init__(self, kind, n, seed=1, depth_par=1.0):
        self.kind, self.n = kind, n
        rng = np.random.default_rng(seed)
        self.x = rng.random(n) * W
        self.y = rng.random(n) * H
        self.z = rng.random(n)  # 0 far .. 1 near
        self.ph = rng.random(n) * 6.283
        self.sp = 0.5 + rng.random(n)
        self.size = rng.random(n)
        self.depth_par = depth_par
        self.cache = {}

    def _spr(self, rad):
        k = round(rad * 4) / 4
        if k not in self.cache:
            self.cache[k] = sprite(max(k, 0.6))
        return self.cache[k]

    def draw(self, frame, t, cam_dx=0.0, cam_dy=0.0, intensity=1.0):
        """frame: float32 HxWx3 (0..1+), additive for embers/dust, alpha-ish for ash/snow."""
        if intensity <= 0:
            return
        k = self.kind
        for i in range(self.n):
            z = self.z[i]
            if k == 'embers':
                vy = -(40 + 160 * z) * self.sp[i]
                vx = 25 * math.sin(t * 1.3 + self.ph[i])
                col = np.array([1.0, 0.55 + 0.25 * self.size[i], 0.18], np.float32) * (0.6 + 1.6 * z)
                rad = 1.2 + 3.5 * z * (0.5 + self.size[i])
                flick = 0.55 + 0.45 * math.sin(t * (6 + 9 * self.size[i]) + self.ph[i])
            elif k == 'ash':
                vy = (18 + 70 * z) * self.sp[i]
                vx = 30 * math.sin(t * 0.7 + self.ph[i]) + 15
                col = np.array([0.55, 0.52, 0.5], np.float32) * (0.35 + 0.5 * z)
                rad = 1.0 + 3.0 * z * (0.4 + self.size[i])
                flick = 0.8
            elif k == 'snow':
                vy = (60 + 160 * z) * self.sp[i]
                vx = 40 * math.sin(t * 0.9 + self.ph[i])
                col = np.array([0.9, 0.93, 1.0], np.float32) * (0.35 + 0.6 * z)
                rad = 1.0 + 4.0 * z * (0.5 + self.size[i])
                flick = 1.0
            else:  # dust motes in light
                vy = -6 * self.sp[i]
                vx = 10 * math.sin(t * 0.4 + self.ph[i])
                col = np.array([1.0, 0.9, 0.7], np.float32) * (0.2 + 0.5 * z)
                rad = 0.8 + 2.5 * z
                flick = 0.6 + 0.4 * math.sin(t * 2 + self.ph[i])
            x = (self.x[i] + vx * t + cam_dx * (0.3 + z) * self.depth_par) % (W + 80) - 40
            y = (self.y[i] + vy * t + cam_dy * (0.3 + z) * self.depth_par) % (H + 80) - 40
            s = self._spr(rad)
            r = s.shape[0] // 2
            x0, y0 = int(x) - r, int(y) - r
            x1, y1 = x0 + s.shape[1], y0 + s.shape[0]
            if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
                continue
            sx0, sy0 = max(0, -x0), max(0, -y0)
            sx1, sy1 = s.shape[1] - max(0, x1 - W), s.shape[0] - max(0, y1 - H)
            patch = s[sy0:sy1, sx0:sx1, None] * col * (flick * intensity)
            frame[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] += patch


# ---------------------------------------------------------------- image ops
def to_np(im):
    return np.asarray(im, np.float32) / 255.0


def to_img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))


def bloom(a, thresh=0.72, strength=0.6, radius=28):
    small = to_img(np.clip((a - thresh) / (1 - thresh), 0, 1)).resize((W // 4, H // 4), Image.BILINEAR)
    small = small.filter(ImageFilter.GaussianBlur(radius / 4))
    big = to_np(small.resize((W, H), Image.BILINEAR))
    return a + big * strength


def grade(a, exposure=0.0, contrast=1.0, sat=1.0, warm=0.0, teal=0.0, lift=0.0, gamma=1.0, demagenta=0.0):
    if demagenta:  # pull purple/magenta fringes (R and B above G) back toward neutral
        m = np.clip(np.minimum(a[..., 0], a[..., 2]) - a[..., 1], 0, None)[..., None]
        a = a - demagenta * m * np.array([1.0, 0.0, 1.0], np.float32)
    a = a * (2 ** exposure)
    if gamma != 1.0:
        a = np.power(np.clip(a, 0, None), 1 / gamma)
    lum = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    a = lum[..., None] + (a - lum[..., None]) * sat
    if contrast != 1.0:
        a = (a - 0.5) * contrast + 0.5
    if warm or teal:
        l = np.clip(lum, 0, 1)[..., None]
        a = a + warm * l * np.array([0.10, 0.03, -0.08], np.float32) + teal * (1 - l) * np.array([-0.05, 0.02, 0.06], np.float32)
    if lift:
        a = a * (1 - lift) + lift
    return a


_VIG = None


def vignette(a, strength=0.38):
    global _VIG
    if _VIG is None:
        y, x = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.sqrt(((x - W / 2) / (W * 0.62)) ** 2 + ((y - H / 2) / (H * 0.62)) ** 2)
        _VIG = np.clip(1 - r ** 2.2, 0, 1)[..., None]
    return a * (1 - strength + strength * _VIG)


_GRAIN = None


def grain(a, frame_idx, amount=0.045):
    global _GRAIN
    if _GRAIN is None:
        rng = np.random.default_rng(7)
        _GRAIN = []
        for _ in range(8):
            g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
            g = np.repeat(np.repeat(g, 2, 0), 2, 1)
            _GRAIN.append(g[..., None])
    g = _GRAIN[frame_idx % 8]
    lum = a[..., 1:2]
    w = 0.35 + 0.65 * np.clip(1 - np.abs(lum - 0.45) * 1.4, 0, 1)
    a += g * (amount * w)
    return a


def radial_light(cx, cy, radius, color, power=2.0):
    y, x = np.ogrid[0:H, 0:W]
    r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2).astype(np.float32) / radius
    f = np.clip(1 - r, 0, 1) ** power
    return f[..., None] * np.array(color, np.float32)


def chroma_shift(a, px):
    if px < 0.5:
        return a
    p = int(round(px))
    out = a.copy()
    out[:, p:, 0] = a[:, :-p, 0]
    out[:, :-p, 2] = a[:, p:, 2]
    return out


# ---------------------------------------------------------------- text
class TextLayer:
    def __init__(self):
        self.cache = {}

    def render(self, text, fnt, fill, stroke=8, stroke_fill=(0, 0, 0), shadow=True, track=0, squeeze=1.0):
        key = (text, id(fnt), fill, stroke, stroke_fill, shadow, track, squeeze)
        if key in self.cache:
            return self.cache[key]
        pad = stroke * 3 + 30
        # measure with tracking
        widths = [fnt.getbbox(ch)[2] - fnt.getbbox(ch)[0] if ch != ' ' else fnt.getlength(' ') for ch in text]
        asc, desc = fnt.getmetrics()
        tw = int(sum(fnt.getlength(ch) for ch in text) + track * max(0, len(text) - 1)) + 2 * pad
        th = asc + desc + 2 * pad
        im = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        x = pad
        if shadow:
            sh = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
            sd = ImageDraw.Draw(sh)
            xx = pad
            for ch in text:
                sd.text((xx + 4, pad + 8), ch, font=fnt, fill=(0, 0, 0, 170), stroke_width=stroke, stroke_fill=(0, 0, 0, 170))
                xx += fnt.getlength(ch) + track
            sh = sh.filter(ImageFilter.GaussianBlur(10))
            im = Image.alpha_composite(im, sh)
            dr = ImageDraw.Draw(im)
        for ch in text:
            dr.text((x, pad), ch, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
            x += fnt.getlength(ch) + track
        im = im.crop(im.getbbox())
        if squeeze != 1.0:
            im = im.resize((max(1, int(im.width * squeeze)), im.height), Image.LANCZOS)
        self.cache[key] = im
        return im


def paste_rgba(frame, im, cx, cy, scale=1.0, alpha=1.0, anchor='center'):
    """Alpha-composite an RGBA PIL image onto float frame at center (cx, cy)."""
    if alpha <= 0.002:
        return
    if abs(scale - 1.0) > 1e-3:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.BICUBIC)
    a = np.asarray(im, np.float32) / 255.0
    h, w = a.shape[:2]
    if anchor == 'center':
        x0, y0 = int(round(cx - w / 2)), int(round(cy - h / 2))
    else:  # left-center
        x0, y0 = int(round(cx)), int(round(cy - h / 2))
    x1, y1 = x0 + w, y0 + h
    sx0, sy0 = max(0, -x0), max(0, -y0)
    sx1, sy1 = w - max(0, x1 - W), h - max(0, y1 - H)
    if sx1 <= sx0 or sy1 <= sy0:
        return
    sub = a[sy0:sy1, sx0:sx1]
    al = sub[..., 3:4] * alpha
    region = frame[max(0, y0):min(H, y1), max(0, x0):min(W, x1)]
    region[:] = region * (1 - al) + sub[..., :3] * al
