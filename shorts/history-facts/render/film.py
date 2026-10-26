"""History-facts shorts («Тайны истории»): timeline, frame renderer (parallel). Episode content lives in episodes/<name>.py.

EPISODE=dance1518 python3 film.py preview <t0> <t1> [step]   -> stills to /home/user/work/render/preview/
EPISODE=dance1518 python3 film.py video [out.mp4]              -> full render (EPISODE defaults to tunguska)
"""
import importlib, json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import (W, H, FPS, Source, Cam, warp, to_np, to_img, bloom, grade, vignette, grain, radial_light,
                    chroma_shift, Particles, Birds, TextLayer, paste_rgba, font, ease_in_out, ease_out, lerp,
                    smooth_noise, fbm_texture)
import captions as capmod

SHOTS = os.environ.get('SHOTS_DIR', '/home/user/work/gen/shots')
VOICE = os.environ.get('VOICE_DIR', '/home/user/work/voice/lines')
SFX = '/home/user/work/sfx'
WORK = '/home/user/work/render'
TL_PATH = os.environ.get('TL_PATH', f'{WORK}/timeline.json')

ORANGE = (255, 150, 40)
YELLOW = (255, 212, 0)


EPISODE = os.environ.get('EPISODE', 'tunguska')
EP = importlib.import_module(f'episodes.{EPISODE}')
DISPLAY, HILITE, GAPS, LEAD_IN, TAIL = EP.DISPLAY, EP.HILITE, EP.GAPS, EP.LEAD_IN, EP.TAIL
if os.environ.get('GAPS_JSON'):     # the narrator's own pauses from a continuous read (voice5/cut_cont.py)
    GAPS = dict(GAPS, **json.load(open(os.environ['GAPS_JSON'])))
LINE_IDS = list(DISPLAY)
SPEED = float(os.environ.get('VOICE_SPEED', '1.06'))
if 'TL_PATH' in os.environ:
    TL_PATH = os.environ['TL_PATH']
elif EPISODE != 'tunguska':
    TL_PATH = f'{WORK}/timeline_{EPISODE}.json'


def voice_files():
    """Speed up each chosen line once (atempo keeps pitch) into WORK/voice/."""
    vdir = f'{WORK}/voice' if VOICE == '/home/user/work/voice/lines' else os.path.join(VOICE, '_film')
    os.makedirs(vdir, exist_ok=True)
    out = {}
    for lid in LINE_IDS:
        src = f'{VOICE}/{lid}.wav'
        dst = f'{vdir}/{lid}_x{SPEED:.2f}.wav'
        if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', f'atempo={SPEED}', '-ar', '48000',
                            '-ac', '1', '-c:a', 'pcm_s16le', dst], check=True)
        out[lid] = dst
    return out


def wav_dur(p):
    import wave
    with wave.open(p) as w:
        return w.getnframes() / w.getframerate()



# ------------------------------------------------------------------ timeline
class Ctx:
    """What an episode's layout() gets: line and word times, and add() for shots."""

    def __init__(self, lines, words, total):
        self.lines, self.words, self.total, self.shots = lines, words, total, []
        self.shots_dir = SHOTS

    def L(self, lid):
        return self.lines[lid]

    def at(self, lid, frac):
        return self.lines[lid]['start'] + frac * (self.lines[lid]['end'] - self.lines[lid]['start'])

    def add(self, img, start, end, **kw):
        self.shots.append(dict(img=img, start=start, end=end, **kw))

    def word_t(self, lid, prefix, which='start', nth=0):
        k = 0
        for (w, a, b) in self.words[lid]:
            if w.startswith(prefix):
                if k == nth:
                    return a if which == 'start' else b
                k += 1
        return self.lines[lid]['start']

    def word_before(self, lid, prefix):
        """Start of the word right before the first word starting with prefix (e.g. "в" before "полночь")."""
        ws = self.words[lid]
        for i, (w, a, b) in enumerate(ws):
            if w.startswith(prefix):
                return ws[i - 1][1] if i > 0 else a
        return self.lines[lid]['start']

    def has_shot(self, prefix):
        return any(f.startswith(prefix + '_s') and f.endswith('.png') and '_depth' not in f for f in os.listdir(SHOTS))


def build_timeline():
    vf = voice_files()
    t = LEAD_IN
    lines = {}
    for lid in LINE_IDS:
        d = wav_dur(vf[lid])
        lines[lid] = {'start': t, 'end': t + d, 'wav': vf[lid]}
        t += d + GAPS[lid]
    total = lines[LINE_IDS[-1]]['end'] + TAIL

    # word-level times for captions and beat-accurate cuts
    words = {}
    man_path = os.path.join(VOICE, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for lid in lines:
        wt = None
        if 'script_words' in man.get(lid, {}):  # recogniser timings from the voice step
            wt = capmod.word_times_manifest(DISPLAY[lid], man[lid]['script_words'], SPEED)
        if wt is None:
            wt = capmod.word_times(DISPLAY[lid], lines[lid]['wav'])
        words[lid] = [(w, lines[lid]['start'] + a, lines[lid]['start'] + b) for (w, a, b) in wt]

    c = Ctx(lines, words, total)
    lay = EP.layout(c)
    # closing call to subscribe after the last line (vla 16.10: «вместо колокола надо добавить байт в конце»);
    # an episode can pass its own 'endcard' from layout() or set ENDCARD = None (episodes published without it)
    ec = getattr(EP, 'ENDCARD', {})
    if ec is not None and 'endcard' not in lay:
        # 'over_last': the card comes up that many seconds into the last line, so the clip can end on the last word
        # and loop back to the start (vla 17.10, YouTube's advice: no dead tail, a CTA plaque instead)
        st = (lines[LINE_IDS[-1]]['start'] + ec['over_last']) if 'over_last' in ec else lines[LINE_IDS[-1]]['end'] + 0.3
        lay['endcard'] = dict(ec, start=st)
    cover = dict(getattr(EP, 'COVER', {}), **lay['cover'])
    tl = dict(total=total, lines=lines, shots=c.shots, cards=lay.get('cards', []), cover=cover, tags=lay.get('tags', []),
              words={k: v for k, v in words.items()}, episode=EPISODE, loop=bool(getattr(EP, 'LOOP', False)))
    for k in lay:
        if k not in tl:
            tl[k] = lay[k]
    json.dump(tl, open(TL_PATH, 'w'), ensure_ascii=False, indent=1)
    return tl


# ------------------------------------------------------------------ per-process caches
_SRC = {}
_PART = {}
_TEXT = None
_FOG = None
_FONTS = {}


def pick(img_id):
    if os.path.exists(f'{SHOTS}/{img_id}.png'):
        return f'{SHOTS}/{img_id}.png'
    pj = f'{SHOTS}/picks.json' if os.path.exists(f'{SHOTS}/picks.json') else f'{WORK}/picks.json'
    sel = json.load(open(pj)) if os.path.exists(pj) else {}
    name = sel.get(img_id)
    if not name:
        cands = sorted(f for f in os.listdir(SHOTS) if f.startswith(img_id + '_s') and f.endswith('.png')
                       and '_depth' not in f and '_lat' not in f and '_unused' not in f)
        name = cands[0]
    return f'{SHOTS}/{name}'


def ensure_depth(p):
    """Depth map next to the still; written to a temp file and renamed, so a parallel worker never reads half a PNG."""
    dp = p[:-4] + '_depth.png'
    if not os.path.exists(dp):
        import depth as dmod
        tmp = f'{dp[:-4]}.{os.getpid()}.tmp.png'
        dmod.depth_of(Image.open(p)).save(tmp)
        os.replace(tmp, dp)
    return dp


def source(img_id, grade_kw=None):
    key = (img_id, json.dumps(grade_kw or {}, sort_keys=True))
    if key not in _SRC:
        p = pick(img_id)
        _SRC[key] = Source(p, ensure_depth(p), grade_kw=grade_kw)
    return _SRC[key]


def F(name, size):
    k = (name, size)
    if k not in _FONTS:
        _FONTS[k] = font(name, size)
    return _FONTS[k]


def fog_tex():
    global _FOG
    if _FOG is None:
        _FOG = fbm_texture(W // 4 + 200, H // 4, seed=3, base=5, octaves=5)
    return _FOG


def interp(spec, key, u, default):
    if key not in spec:
        return default
    a, b = spec[key]
    return lerp(a, b, u)


# ------------------------------------------------------------------ frame
def cam_for(sh, t):
    u = (t - sh['start']) / max(sh['end'] - sh['start'], 1e-3)
    ue = ease_in_out(u) * 0.7 + u * 0.3
    c = sh.get('cam', {})
    fx = sh.get('fx', {})
    sx = sy = 0.0
    for (t0, dur, amp) in fx.get('shake', []):
        if t0 <= t < t0 + dur:
            k = (1 - (t - t0) / dur) ** 2 * amp
            sx += k * smooth_noise(11, t * 7.0)
            sy += k * smooth_noise(23, t * 7.0)
    punch = 1.0
    for (t0, amt) in fx.get('punch', []):
        if t0 <= t < t0 + 0.5:
            k = (t - t0) / 0.5
            punch *= 1 + amt * (math.sin(min(k * 3.0, 1.0) * math.pi / 2) * (1 - k) ** 1.5)
    roll = 0.0
    for b in fx.get('beat', []):        # camera dances to the music: a punch (and a bob) on every beat, a sway
        if b['t0'] <= t < b['t1']:
            ph = (t - b['grid']) / b['period']
            p = ph % 1.0
            k = math.sin(min(p / 0.12, 1.0) * math.pi / 2) * (1 - p) ** 2.5
            e = max(0.0, min(1.0, (t - b['t0']) / 0.2, (b['t1'] - t) / 0.2))
            punch *= 1 + b.get('zoom', 0.02) * k * e
            sy += b.get('bob', 0.0) * k * e
            roll += b.get('sway', 0.0) * math.sin(math.pi * ph) * e
    for (t0, dur, dy, droll) in fx.get('drop', []):     # the camera falls (accelerating), then stays down
        if t >= t0:
            k = min(1.0, (t - t0) / dur) ** 2
            sy += dy * k
            roll += droll * k
    cam = Cam(zoom=interp(c, 'zoom', ue, 1.0) * punch, panx=interp(c, 'panx', ue, 0.0), pany=interp(c, 'pany', ue, 0.0),
              parx=interp(c, 'parx', ue, 0.0), pary=interp(c, 'pary', ue, 0.0), dolly=interp(c, 'dolly', ue, 0.0),
              d0=c.get('d0', 0.5), roll=interp(c, 'roll', ue, 0.0) + roll, shakex=sx, shakey=sy)
    cam.heat = fx.get('heat', 0.0)
    cam.t = t
    return cam, u


def project(sh, t, fx_, fy_):
    """Screen position of a source point (fractions of the image) under this shot's camera at time t."""
    cam, _ = cam_for(sh, t)
    src = source(sh['img'], sh.get('fx', {}).get('grade'))
    xs, ys = fx_ * src.w, fy_ * src.h
    d = float(src.depth_at(np.array([xs]), np.array([ys]))[0])
    base = max(W / src.w, H / src.h)
    S = base * cam.zoom * (1 + cam.dolly * (d - cam.d0))
    rx = (xs - (src.w / 2 + cam.panx * src.w)) * S
    ry = (ys - (src.h / 2 + cam.pany * src.h)) * S
    a = math.radians(cam.roll)
    ox, oy = rx * math.cos(a) - ry * math.sin(a), rx * math.sin(a) + ry * math.cos(a)
    return (W / 2 + ox + cam.parx * (d - cam.d0) + cam.shakex,
            H / 2 + oy + cam.pary * (d - cam.d0) + cam.shakey, S)


_VID = {}


def video_frame(sh, t, cam):
    """A moving scene (a Gemini clip extracted to JPEGs at FPS, vla 20.10) instead of a still: the clip's frame at the
    shot's own time, cover-fitted; the camera's zoom, pan, shake and roll still apply as a crop. 'video' = dict(dir=,
    t0=offset into the clip, speed=1.0)."""
    v = sh['video']
    d = v['dir']
    if d not in _VID:
        _VID[d] = sorted(f for f in os.listdir(d) if f.endswith('.jpg'))
    fr = _VID[d]
    i = int(round((v.get('t0', 0.0) + (t - sh['start']) * v.get('speed', 1.0)) * FPS))
    if v.get('pingpong') and i >= len(fr):          # a scene shorter than its shot runs back instead of freezing
        k = i % (2 * len(fr) - 2)
        i = k if k < len(fr) else 2 * len(fr) - 2 - k
    im = Image.open(os.path.join(d, fr[max(0, min(len(fr) - 1, i))])).convert('RGB')
    sw, sh_ = im.size
    s = max(W / sw, H / sh_) * max(cam.zoom, 1.0)
    cw, ch = W / s, H / s
    cx = min(max(sw / 2 + cam.panx * sw - cam.shakex / s, cw / 2), sw - cw / 2)
    cy = min(max(sh_ / 2 + cam.pany * sh_ - cam.shakey / s, ch / 2), sh_ - ch / 2)
    if abs(cam.roll) > 0.01:
        im = im.rotate(cam.roll, resample=Image.BILINEAR, center=(cx, cy))
    im = im.resize((W, H), Image.BICUBIC, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
    a = to_np(im)
    if sh.get('fx', {}).get('grade'):
        a = grade(a, **sh['fx']['grade'])
    return a


def render_shot(sh, t, n):
    cam, u = cam_for(sh, t)
    fx = sh.get('fx', {})
    if 'video' in sh:
        a, dep = video_frame(sh, t, cam), None
        fx = {k: v for k, v in fx.items() if k not in ('fog', 'skyglow', 'focus')}    # no depth map for a moving scene
    else:
        src = source(sh['img'], fx.get('grade'))
        need_depth = fx.get('fog', 0) > 0 or 'skyglow' in fx or 'focus' in fx
        im, dep = warp(src, cam, with_depth=need_depth)
        a = to_np(im)
    # rack focus (vizavi-motion): the sharp plane travels in depth through keys [(t, depth: 0 far .. 1 near), ...],
    # whatever lies off it softens up to r px
    if 'focus' in fx:
        fc = fx['focus']
        ks = fc['keys']
        fd = ks[0][1] if t < ks[0][0] else ks[-1][1]
        for (ta, da), (tb, db) in zip(ks, ks[1:]):
            if ta <= t < tb:
                fd = lerp(da, db, ease_in_out((t - ta) / max(tb - ta, 1e-3)))
        off = np.abs(np.asarray(dep, np.float32) / 255.0 - fd)
        w = np.clip((off - fc.get('dof', 0.08)) * fc.get('gain', 4.0), 0, 1)
        soft = to_np(to_img(a).filter(ImageFilter.GaussianBlur(fc.get('r', 9))))
        a = a + (soft - a) * w[..., None]
    # a falling camera (fx 'drop') smears vertically by half the distance it travels in a frame
    for (t0, dur, dy, droll) in fx.get('drop', []):
        if t0 <= t < t0 + dur:
            r = int(abs(dy) * (t - t0) / dur ** 2 / FPS)
            if r >= 2:
                c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0), (0, 0)), mode='edge'), axis=0)
                a = (c[2 * r + 1:] - c[:-2 * r - 1]) / (2 * r + 1)
    # glowing night sky (silvery-orange, brightest at the top, only where the scene is far away)
    if 'skyglow' in fx:
        g = fx['skyglow']
        far = 1 - np.asarray(dep, np.float32) / 255.0
        yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
        vert = np.clip(1 - yy / g.get('h', 0.6), 0, 1) ** 1.3
        m = np.clip((far - g.get('far', 0.55)) * 4, 0, 1) * vert
        k = g.get('amt', 0.7) * (1 + 0.05 * smooth_noise(31, t * 1.3))
        col = np.array(g.get('col', (1.0, 0.78, 0.52)), np.float32)
        a = 1 - (1 - np.clip(a, 0, 1)) * (1 - m[..., None] * col * k)
    # fog: animated fbm, stronger far away
    if fx.get('fog', 0) > 0:
        f = fog_tex()
        ox = int((t * 22) % 200)
        fog = f[:, ox:ox + W // 4]
        fog = np.asarray(Image.fromarray((fog * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255
        far = 1 - np.asarray(dep, np.float32) / 255.0
        amt = fx['fog'] * (0.35 + 0.65 * far) * (0.5 + 0.8 * fog)
        fogcol = np.array([0.72, 0.74, 0.78], np.float32)
        a = a * (1 - amt[..., None]) + fogcol * amt[..., None]
    # living fire: bright warm pixels flicker with an upward-drifting noise field
    if fx.get('fire'):
        k = fx['fire']
        lum = a[..., 0] * 0.5 + a[..., 1] * 0.4 + a[..., 2] * 0.1
        mask = np.clip((lum - 0.45) * 3.0, 0, 1) * np.clip((a[..., 0] - a[..., 2]) * 3.0, 0, 1)
        f = fog_tex()
        oy = int((t * 60) % (f.shape[0] - H // 8 - 1)) if f.shape[0] > H // 8 + 1 else 0
        ox = int((t * 9) % 150)
        nz = f[oy:oy + H // 8, ox:ox + W // 8] if f.shape[0] >= oy + H // 8 else f[:H // 8, :W // 8]
        nz = np.asarray(Image.fromarray((nz * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255
        flick = 1 + k * (0.22 * (nz - 0.5) * 2 + 0.08 * smooth_noise(9, t * 4.0))
        a = a * (1 + mask[..., None] * (flick[..., None] - 1))
    # local light (fire glow)
    if 'light' in fx:
        L = fx['light']
        fl = 1 + L.get('flicker', 0) * smooth_noise(5, t * L.get('rate', 3.0))
        a = a + radial_light(L['x'] * W, L['y'] * H, L['r'] * W, L['col']) * fl
    # particles
    dx = -cam.parx * 0.5 * (u - 0.5)
    for kind in ('embers', 'ash', 'snow', 'dust', 'rain', 'bubbles', 'blizzard'):
        if fx.get(kind):
            key = (sh['img'], kind)
            if key not in _PART:
                _PART[key] = Particles(kind, fx[kind], seed=hash(key) % 1000)
            _PART[key].draw(a, t - sh['start'], cam_dx=dx * 2, cam_dy=0)
    # a flock crossing the frame (Birds in engine.py); several flocks per shot as a list
    for i, bf in enumerate(fx.get('birds', [])):    # 't0': the flock's own clock (absolute), so it can span shots
        key = (sh['img'], 'birds', i, json.dumps(bf, sort_keys=True))
        if key not in _PART:
            _PART[key] = Birds(**{k: v for k, v in bf.items() if k != 't0'})
        if t >= bf.get('t0', sh['start']):
            _PART[key].draw(a, t - bf.get('t0', sh['start']))
    # flashes
    for f in fx.get('flash', []):           # (t0, dur, strength[, colour]): warm by default, blue-white for lightning
        t0, dur, k = f[:3]
        if t0 - 0.04 <= t < t0 + dur:
            e = 1.0 if t < t0 + 0.06 else (1 - (t - t0 - 0.06) / (dur - 0.06)) ** 2
            a = a + e * k * np.array(f[3] if len(f) > 3 else (1.0, 0.85, 0.65), np.float32)
            if e > 0.3:
                a = chroma_shift(a, 6 * e)
    # shockwave smear: a horizontal motion blur that dies out
    for (t0, dur, px) in fx.get('smear', []):
        if t0 <= t < t0 + dur:
            r = int(px * (1 - (t - t0) / dur) ** 2)
            if r >= 2:
                c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r), (0, 0)), mode='edge'), axis=1)
                a = (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)
    if fx.get('bloom'):
        a = bloom(a, strength=fx['bloom'] * 0.55)
    if fx.get('oldfilm'):
        rng = np.random.default_rng(n * 7 + 1)
        a *= 0.92 + 0.08 * rng.random()          # exposure flicker
        for _ in range(rng.integers(1, 4)):        # vertical scratches
            x = int(rng.random() * W)
            a[:, x:x + 2] = a[:, x:x + 2] * 0.55 + 0.45 * (0.85 if rng.random() < 0.5 else 0.15)
        for _ in range(rng.integers(4, 12)):       # dust specks
            x, y = int(rng.random() * (W - 8)), int(rng.random() * (H - 8))
            r = int(1 + rng.random() * 3)
            a[y:y + r, x:x + r] = 0.08 if rng.random() < 0.7 else 0.9
    if 'blackout' in fx:
        b0, b1 = fx['blackout']
        if b0 <= t < b1:
            a = a * 0.0
    return a


def draw_ring(a, t, spec, sh):
    """Expanding shockwave ring pinned to a point of the image (x, y = fractions of the source)."""
    t0 = spec['start']
    if t < t0:
        return
    u = min((t - t0) / 0.9, 1.0)
    cx, cy, S = project(sh, t, spec['x'], spec['y'])
    r = 40 + spec.get('r', 330) * ease_out(u, 3)
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    alpha = int(235 * (0.6 + 0.4 * (1 - u)))
    for k, wdt in ((0, 7), (1, 3)):
        rr = r - k * 18
        d.ellipse((cx - rr, cy - rr * 0.42, cx + rr, cy + rr * 0.42), outline=(255, 150, 40, alpha if k == 0 else alpha // 2), width=wdt)
    d.ellipse((cx - 9, cy - 9, cx + 9, cy + 9), fill=(255, 230, 180, 255))
    glow = ov.filter(ImageFilter.GaussianBlur(8))
    paste_rgba(a, glow, W / 2, H / 2)
    paste_rgba(a, ov, W / 2, H / 2)


def draw_card(a, t, cd, tl_text):
    if not (cd['start'] <= t < cd['end']):
        return
    u = (t - cd['start']) / 0.22
    out = (cd['end'] - t) / 0.2
    sc = 1.0 + 0.55 * (1 - ease_out(min(u, 1), 3))
    al = min(1.0, u * 1.6) * min(1.0, out)
    text = cd['text']
    if cd.get('steps'):                 # the number steps on given words ("день, второй, третий")
        import re as _re
        cur = None
        for (ts, val) in cd['steps']:
            if t >= ts:
                cur = (ts, val)
        if cur:
            m = _re.search(r'\d+', text)
            text = text[:m.start()] + str(cur[1]) + text[m.end():]
            if cur[0] > cd['start'] + 0.01:
                sc *= 1 + 0.22 * (1 - ease_out(min(1.0, (t - cur[0]) / 0.18), 3))
    if cd.get('count'):
        import re as _re
        m = _re.search(r'\d+', text)
        if m:
            target = int(m.group(0))
            k = ease_out(min(1.0, (t - cd['start']) / cd.get('count_dur', 0.5)), 2)
            text = text[:m.start()] + str(int(round(target * k))) + text[m.end():]
    big = tl_text.render(text, F('InterDisplay-Black.otf', 190), (255, 255, 255), stroke=10, squeeze=0.92, track=-4)
    paste_rgba(a, big, W / 2, cd['y'], scale=sc, alpha=al)
    if cd.get('sub'):
        sub = tl_text.render(cd['sub'], F('Inter-ExtraBold.otf', 52), ORANGE, stroke=6, track=6)
        paste_rgba(a, sub, W / 2, cd['y'] + 150, scale=1.0, alpha=al * min(1.0, max(0.0, (u - 0.5) * 2)))


def draw_tag(a, t, tg, tl_text):
    if not (tg['start'] <= t < tg['end']):
        return
    u = min(1.0, (t - tg['start']) / 0.25)
    out = min(1.0, (tg['end'] - t) / 0.25)
    al = min(u, out)
    im = tl_text.render(tg['text'], F('Inter-ExtraBold.otf', 46), (255, 255, 255), stroke=0, shadow=False, track=5)
    bar_w = im.width + 56
    x0 = int(W / 2 - bar_w / 2 + (1 - ease_out(u, 3)) * -40)
    y0 = int(tg.get('y', 300))          # a shot whose face sits high moves its tag below the chin
    # dark pill with an orange edge
    region = a[y0:y0 + 76, max(0, x0):min(W, x0 + bar_w)]
    region *= 1 - 0.62 * al
    a[y0:y0 + 76, max(0, x0):max(0, x0) + 8] = a[y0:y0 + 76, max(0, x0):max(0, x0) + 8] * (1 - al) + np.array(ORANGE, np.float32) / 255 * al
    paste_rgba(a, im, x0 + 30, y0 + 38, alpha=al, anchor='left')


def draw_cover(a, t, cv, tl_text, static=False):
    if not static and not (cv['start'] <= t < cv['end']):
        return
    if static:
        al = 1.0
        lift = 0.0
    else:
        out = (cv['end'] - t) / 0.35
        al = min(1.0, out)
        lift = (1 - min(1.0, out)) * -60
    # darken top for legibility
    grad = np.clip(1 - np.linspace(0, 1, H)[:, None] / 0.62, 0, 1) ** 1.6
    a *= (1 - 0.55 * al * grad[..., None])
    lines = cv.get('lines', ['ЧТО ВЗОРВАЛОСЬ', 'НАД СИБИРЬЮ?'])
    tag = tl_text.render(cv.get('tag', 'ТАЙНЫ ИСТОРИИ · №1'), F('Inter-ExtraBold.otf', 48), ORANGE, stroke=5, track=8)
    paste_rgba(a, tag, W / 2, 455 + lift, alpha=al)
    yr = tl_text.render(cv.get('year', '1908'), F('InterDisplay-Black.otf', 300), YELLOW, stroke=12, squeeze=0.9, track=-8)
    paste_rgba(a, yr, W / 2, 625 + lift * 0.5, alpha=al, scale=min(1.0, 760 / yr.width))
    for i, txt in enumerate(lines):
        im = tl_text.render(txt, F('InterDisplay-Black.otf', 128), (255, 255, 255), stroke=9, squeeze=0.86, track=-2)
        paste_rgba(a, im, W / 2, 835 + i * 128 + lift, alpha=al, scale=min(1.0, 880 / im.width))
    if cv.get('part'):                  # «ЧАСТЬ 1» on a yellow plaque under the title (a story told in parts)
        im = tl_text.render(cv['part'], F('InterDisplay-Black.otf', 84), (24, 18, 8), stroke=0, shadow=False, track=4)
        y = int(835 + len(lines) * 128 + 40 + lift)
        bw, bh = im.width + 16, 118
        x0, y0 = int(W / 2 - bw / 2), y - bh // 2
        box = a[max(0, y0):y0 + bh, max(0, x0):x0 + bw]
        box *= 1 - al
        box += np.array(YELLOW, np.float32) / 255 * al
        paste_rgba(a, im, W / 2, y, alpha=al)


def draw_endcard(a, t, ec, tl_text):
    """«Подпишись» in the cover's layout, so the Shorts loop back to the cover reads as one design."""
    if t < ec['start']:
        return
    u = t - ec['start']
    al = min(1.0, u / 0.3)
    grad = np.clip(1 - np.linspace(0, 1, H)[:, None] / 0.66, 0, 1) ** 1.4
    a *= (1 - 0.62 * al * grad[..., None])
    tag = tl_text.render(ec.get('tag', 'ТАЙНЫ ИСТОРИИ'), F('Inter-ExtraBold.otf', 48), ORANGE, stroke=5, track=8)
    paste_rgba(a, tag, W / 2, 455, alpha=al)
    big = tl_text.render(ec.get('big', 'ПОДПИШИСЬ,'), F('InterDisplay-Black.otf', 190), YELLOW, stroke=12, squeeze=0.9,
                         track=-4)
    pop = 1.0 + 0.35 * (1 - ease_out(min(1.0, u / 0.28), 3)) + 0.03 * np.sin(2 * np.pi * 1.1 * max(0.0, u - 0.5))
    paste_rgba(a, big, W / 2, 620, alpha=al, scale=min(1.0, 900 / big.width) * pop)
    for i, txt in enumerate(ec.get('lines', ['ЧТОБЫ НЕ ПРОПУСКАТЬ', 'ДРУГИЕ ИСТОРИИ'])):
        ai = min(1.0, max(0.0, (u - 0.2 - 0.15 * i) / 0.25))
        im = tl_text.render(txt, F('InterDisplay-Black.otf', 116), (255, 255, 255), stroke=9, squeeze=0.86, track=-2)
        paste_rgba(a, im, W / 2, 805 + i * 122 + (1 - ease_out(ai, 3)) * 30, alpha=ai, scale=min(1.0, 880 / im.width))


_BAND = None


def _band():
    global _BAND
    if _BAND is None:
        yy = np.linspace(-1, 1, 300)[:, None, None]
        _BAND = (1 - 0.32 * np.exp(-(yy / 0.55) ** 2)).astype(np.float32)
    return _BAND


def draw_hook_text(a, t, tl, tl_text):
    """Live hook text (vizavi-motion): the hook's lines build up big in the middle of the frame, word by word, each
    word slamming in from above with a trail; a line flies off when the next one starts. The bottom captions skip
    these lines. Words spoken under the cover come up together when the cover lifts."""
    ht = tl.get('hook_text')
    if not ht:
        return
    ids = ht['lines']
    cov = tl['cover']['end']
    hotset = {x.strip('.,!?:;') for x in HILITE}
    fnt = F('InterDisplay-Black.otf', ht.get('size', 132))
    for i, lid in enumerate(ids):
        ws = tl['words'][lid]
        if not ws:
            continue
        shown = [(w, max(w0 - 0.06, cov + 0.02)) for (w, w0, w1) in ws if t >= max(w0 - 0.06, cov + 0.02)]
        if not shown:
            continue
        # the line is gone before the next one's first word comes up
        nxt = tl['words'][ids[i + 1]][0][1] - 0.24 if i + 1 < len(ids) and tl['words'][ids[i + 1]] else ws[-1][2] + ht.get('hold', 0.35)
        if t >= nxt + 0.16:
            continue
        gone = max(0.0, (t - nxt) / 0.16)       # 0 .. 1 while the line flies off upwards
        al_line = 1 - gone
        # rows of words that fit the frame
        ims = [(tl_text.render(w, fnt, YELLOW if w.strip('.,!?:;') in hotset else (255, 255, 255), stroke=10,
                               squeeze=0.9, track=-2), ta) for (w, ta) in shown]
        allw = [tl_text.render(w, fnt, (255, 255, 255), stroke=10, squeeze=0.9, track=-2).width for (w, _, _) in ws]
        space = 30
        rows, cur, cw = [], [], 0
        for k, wd in enumerate(allw):
            if cur and cw + space + wd > 940:
                rows.append(cur)
                cur, cw = [], 0
            cur.append(k)
            cw += (space if len(cur) > 1 else 0) + wd
        rows.append(cur)
        lh = ht.get('size', 132) * 1.08
        y0 = ht.get('y', 860) - (len(rows) - 1) * lh / 2 - gone * 90
        band = np.exp(-((np.arange(H, dtype=np.float32) - ht.get('y', 860)) / (lh * (len(rows) + 1) * 0.6)) ** 2)
        a *= (1 - 0.45 * band * al_line)[:, None, None]
        for r, row in enumerate(rows):
            rw = sum(allw[k] for k in row) + space * (len(row) - 1)
            x = W / 2 - rw / 2
            for k in row:
                if k < len(ims):
                    im, ta = ims[k]
                    u = min(1.0, (t - ta) / 0.16)
                    sc = (1 + 0.6 * (1 - ease_out(u, 3))) * (1 + 0.25 * gone)
                    al = min(1.0, (t - ta) / 0.07) * al_line
                    cx, cy = x + allw[k] / 2, y0 + r * lh
                    for g in (3, 2, 1):           # the trail of a word slamming down
                        tr = (1 - u) ** 2
                        if tr > 0.02:
                            paste_rgba(a, im, cx, cy - g * 26 * tr, scale=sc, alpha=al * 0.22 * tr * (4 - g) / 3)
                    paste_rgba(a, im, cx, cy, scale=sc, alpha=al)
                x += allw[k] + space


def draw_captions(a, t, tl, tl_text):
    skip = set((tl.get('hook_text') or {}).get('lines', []))
    for lid, ws in tl['words'].items():
        if not ws or lid in skip:
            continue
        if not (ws[0][1] - 0.15 <= t <= ws[-1][2] + 0.25):
            continue
        chunks = capmod.chunk(ws)
        if lid == LINE_IDS[0]:  # the cover carries the start of the hook
            chunks = [ch for ch in chunks if ch[0][1] >= tl['cover']['end'] - 0.1]
        for ci, ch in enumerate(chunks):
            c0 = ch[0][1] - 0.08
            c1 = chunks[ci + 1][0][1] - 0.08 if ci + 1 < len(chunks) else ch[-1][2] + 0.25
            if not (c0 <= t < c1):
                continue
            fnt = F('Inter-ExtraBold.otf', 92)
            pieces = []
            hotset = {x.strip('.,!?:;') for x in HILITE}
            for wi, (w, w0, w1) in enumerate(ch):
                nxt = ch[wi + 1][1] if wi + 1 < len(ch) else w1 + 0.3
                current = (w0 - 0.06) <= t < (nxt - 0.06)
                spoken = t >= w0 - 0.06
                hot = w.strip('.,!?:;') in hotset
                if hot and spoken:
                    col = YELLOW
                elif current:
                    col = ORANGE
                else:
                    col = (255, 255, 255)
                pieces.append(tl_text.render(w, fnt, col, stroke=9, shadow=False))
            space = 26
            tw = sum(p.width for p in pieces) + space * (len(pieces) - 1)
            scale = min(1.0, 900 / max(tw, 1))
            pop = 1.0 + 0.12 * (1 - ease_out(min((t - c0) / 0.12, 1.0), 2))
            x = W / 2 - tw * scale * pop / 2
            y = 1235
            band = _band()
            a[y - 150:y + 150] *= band
            for p in pieces:
                paste_rgba(a, p, x, y, scale=scale * pop, anchor='left')
                x += (p.width + space) * scale * pop
            return


def render_frame(n, tl=None):
    global _TEXT
    if tl is None:
        tl = _TL
    if _TEXT is None:
        _TEXT = TextLayer()
    t = n / FPS
    shots = tl['shots']
    cur = None
    for sh in shots:
        if sh['start'] <= t < sh['end']:
            cur = sh
    if cur is None:
        cur = shots[-1]
    a = render_shot(cur, t, n)
    # transitions in
    into = cur.get('into')
    dt = t - cur['start']
    if into == 'flash' and dt < 0.25:
        a = a + (1 - dt / 0.25) ** 2 * 1.3
    if into == 'fade' and dt < 0.3:
        a = a * (dt / 0.3)
    if into == 'zoom' and dt < 0.22:
        a = radial_blur(a, 0.12 * (1 - dt / 0.22) ** 1.5)
    if into == 'whip' and dt < 0.16:
        a = whip_blur(a, 1 - dt / 0.16, -1)
    # transition out: zoom (or whip) into the next shot
    idx = shots.index(cur)
    if idx + 1 < len(shots) and shots[idx + 1].get('into') == 'zoom':
        left = cur['end'] - t
        if 0 <= left < 0.14:
            a = radial_blur(a, 0.10 * (1 - left / 0.14))
    if idx + 1 < len(shots) and shots[idx + 1].get('into') == 'whip':
        left = cur['end'] - t
        if 0 <= left < 0.12:
            a = whip_blur(a, 1 - left / 0.12, 1)
    fxr = cur.get('fx', {}).get('ring')
    if fxr:
        draw_ring(a, t, fxr, cur)
    a = vignette(a, 0.42)
    a = grain(a, n, 0.04)
    draw_cover(a, t, tl['cover'], _TEXT)
    for cd in tl['cards']:
        draw_card(a, t, cd, _TEXT)
    for tg in tl.get('tags', []):
        draw_tag(a, t, tg, _TEXT)
    draw_hook_text(a, t, tl, _TEXT)
    draw_captions(a, t, tl, _TEXT)
    if tl.get('endcard'):
        draw_endcard(a, t, tl['endcard'], _TEXT)
    # final fade (a looping clip cuts straight back to its first frame instead)
    if not tl.get('loop') and t > tl['total'] - 0.4:
        a = a * max(0.0, (tl['total'] - t) / 0.4)
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


_TL = None


def radial_blur(a, amt, n=5):
    if amt <= 0.002:
        return a
    im = to_img(a)
    acc = a.copy()
    for i in range(1, n):
        sc = 1 + amt * i / (n - 1)
        cw, ch = int(W / sc), int(H / sc)
        x0, y0 = (W - cw) // 2, (H - ch) // 2
        acc += to_np(im.crop((x0, y0, x0 + cw, y0 + ch)).resize((W, H), Image.BILINEAR))
    return acc / n


def whip_blur(a, k, sign):
    """Whip pan between two shots (vizavi-motion): the frame slides sideways and smears, hardest at the cut; the old
    shot leaves to the left (sign 1), the new one arrives from the right (sign -1)."""
    r = int(64 * k ** 1.5)
    if r < 2:
        return a
    s = int(150 * k ** 2)
    if s > 0:
        pad = np.repeat(a[:, -1:] if sign > 0 else a[:, :1], s, axis=1)
        a = np.concatenate([a[:, s:], pad], axis=1) if sign > 0 else np.concatenate([pad, a[:, :-s]], axis=1)
    c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r), (0, 0)), mode='edge'), axis=1)
    return (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)


def _init_worker(tl):
    global _TL
    _TL = tl
    os.environ['OMP_NUM_THREADS'] = '1'


def _rf(n):
    return render_frame(n).tobytes()


def render_video(out_path, workers=3):
    tl = build_timeline()
    nframes = int(round(tl['total'] * FPS))
    print('frames', nframes, 'duration', round(tl['total'], 2), flush=True)
    for img in dict.fromkeys(sh['img'] for sh in tl['shots'] if 'video' not in sh):    # every depth map once, first
        ensure_depth(pick(img))
    silent = out_path[:-4] + '_silent.mp4'
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                           '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17',
                           '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', silent],
                          stdin=subprocess.PIPE)
    from multiprocessing import Pool
    t0 = time.time()
    with Pool(workers, initializer=_init_worker, initargs=(tl,)) as pool:
        for i, buf in enumerate(pool.imap(_rf, range(nframes), chunksize=3)):
            ff.stdin.write(buf)
            if i % 60 == 0:
                print(f'frame {i}/{nframes} {time.time() - t0:.0f}s', flush=True)
    ff.stdin.close()
    ff.wait()
    return tl, silent


def preview(t0, t1, step):
    tl = build_timeline()
    _init_worker(tl)
    os.makedirs(f'{WORK}/preview', exist_ok=True)
    t = t0
    while t <= t1:
        n = int(round(t * FPS))
        Image.fromarray(render_frame(n, tl)).save(f'{WORK}/preview/f_{n:05d}.jpg', quality=88)
        t += step
    print('total', tl['total'])


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'timeline':
        tl = build_timeline()
        for sh in tl['shots']:
            print(f"{sh['img']:24s} {sh['start']:6.2f} {sh['end']:6.2f}")
        print('total', tl['total'])
    elif cmd == 'preview':
        preview(float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]) if len(sys.argv) > 4 else 1.0)
    elif cmd == 'video':
        render_video(sys.argv[2] if len(sys.argv) > 2 else f'{WORK}/out.mp4', workers=int(os.environ.get('WORKERS', '3')))
