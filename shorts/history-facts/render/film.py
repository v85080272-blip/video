"""Tunguska 1908 short: timeline, frame renderer (parallel), audio mix, mux.

python3 film.py preview <t0> <t1> [step]   -> PNG stills to /home/user/work/render/preview/
python3 film.py video [out.mp4]              -> full render
"""
import json, math, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import (W, H, FPS, Source, Cam, warp, to_np, to_img, bloom, grade, vignette, grain, radial_light,
                    chroma_shift, Particles, TextLayer, paste_rgba, font, ease_in_out, ease_out, lerp,
                    smooth_noise, fbm_texture)
import captions as capmod

SHOTS = os.environ.get('SHOTS_DIR', '/home/user/work/gen/shots')
VOICE = os.environ.get('VOICE_DIR', '/home/user/work/voice/lines')
SFX = '/home/user/work/sfx'
WORK = '/home/user/work/render'
TL_PATH = os.environ.get('TL_PATH', f'{WORK}/timeline.json')

ORANGE = (255, 150, 40)
YELLOW = (255, 212, 0)

# ------------------------------------------------------------------ script (display text for captions)
# {spoken} gives the words the narrator actually says for a shown token (for timing by syllables).
DISPLAY = {
    'L1': 'В 1908{тысяча девятьсот восьмом} ГОДУ НАД СИБИРЬЮ ВЗОРВАЛОСЬ НЕЧТО В СОТНИ РАЗ МОЩНЕЕ ХИРОСИМЫ.',
    'L2': 'И ДО СИХ ПОР НИКТО ТОЧНО НЕ ЗНАЕТ, ЧТО ЭТО БЫЛО.',
    'L3': 'УТРО 30{тридцатого} ИЮНЯ. ФАКТОРИЯ ВАНАВАРА. МЕСТНЫЙ ЖИТЕЛЬ СЕМЁНОВ СИДИТ НА КРЫЛЬЦЕ.',
    'L4': 'ВДРУГ НЕБО РАСКАЛЫВАЕТСЯ НАДВОЕ, И НАД ЛЕСОМ ВСТАЁТ ОГОНЬ.',
    'L5': 'ЖАР ТАКОЙ, БУДТО НА НЁМ ЗАГОРЕЛАСЬ РУБАШКА. УДАР СБРАСЫВАЕТ ЕГО С КРЫЛЬЦА.',
    'L6': 'А ДО ВЗРЫВА — 65{шестьдесят пять} КИЛОМЕТРОВ.',
    'L7': 'В ТАЙГЕ ПАДАЮТ МИЛЛИОНЫ ДЕРЕВЬЕВ. ПЛОЩАДЬ — ПОЧТИ КАК ВСЯ МОСКВА.',
    'L8': 'НЕСКОЛЬКО НОЧЕЙ НЕБО НАД ЕВРОПОЙ СВЕТИТСЯ ТАК, ЧТО В ПОЛНОЧЬ МОЖНО ЧИТАТЬ ГАЗЕТУ.',
    'L9': 'УЧЁНЫЕ ДОБИРАЮТСЯ ТУДА ТОЛЬКО ЧЕРЕЗ 19{девятнадцать} ЛЕТ. ЛЕОНИД КУЛИК ИЩЕТ ГИГАНТСКИЙ ЖЕЛЕЗНЫЙ МЕТЕОРИТ.',
    'L10': 'И НЕ НАХОДИТ НИЧЕГО. НИ КРАТЕРА. НИ ОСКОЛКОВ.',
    'L11': 'ТОЛЬКО ПОВАЛЕННЫЙ ЛЕС, А В ЦЕНТРЕ — МЁРТВЫЕ ДЕРЕВЬЯ БЕЗ ВЕТОК, КАК ТЕЛЕГРАФНЫЕ СТОЛБЫ.',
    'L12': 'СКОРЕЕ ВСЕГО, В ВОЗДУХЕ ВЗОРВАЛСЯ АСТЕРОИД ИЛИ КОМЕТА. НО СПОРЯТ ОБ ЭТОМ ДО СИХ ПОР.',
    'L13': 'А ТЫ КАК ДУМАЕШЬ, ЧТО ЭТО БЫЛО?',
}
HILITE = {'1908', '30', '65', '19', 'ХИРОСИМЫ.', 'МОСКВА.', 'НИЧЕГО.', 'КОМЕТА.', 'АСТЕРОИД', 'ОГОНЬ.', 'ГАЗЕТУ.',
          'СТОЛБЫ.', 'КИЛОМЕТРОВ.', 'ЛЕТ.'}

# gap (s) after each line before the next one starts
GAPS = {'L1': 0.30, 'L2': 0.45, 'L3': 0.30, 'L4': 0.15, 'L5': 0.75, 'L6': 0.45, 'L7': 0.35, 'L8': 0.45,
        'L9': 0.35, 'L10': 0.30, 'L11': 0.40, 'L12': 0.45, 'L13': 0.0}
LEAD_IN = 0.25
TAIL = 1.6
SPEED = float(os.environ.get('VOICE_SPEED', '1.06'))


def voice_files():
    """Speed up each chosen line once (atempo keeps pitch) into WORK/voice/."""
    vdir = f'{WORK}/voice' if VOICE == '/home/user/work/voice/lines' else f'{WORK}/voice_alt'
    os.makedirs(vdir, exist_ok=True)
    out = {}
    for i in range(1, 14):
        lid = f'L{i}'
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
def build_timeline():
    vf = voice_files()
    t = LEAD_IN
    lines = {}
    for i in range(1, 14):
        lid = f'L{i}'
        d = wav_dur(vf[lid])
        lines[lid] = {'start': t, 'end': t + d, 'wav': vf[lid]}
        t += d + GAPS[lid]
    total = lines['L13']['end'] + TAIL
    L = lambda k: lines[k]

    def at(lid, frac):
        return L(lid)['start'] + frac * (L(lid)['end'] - L(lid)['start'])

    shots = []

    def add(img, start, end, **kw):
        shots.append(dict(img=img, start=start, end=end, **kw))

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

    def word_t(lid, prefix, which='start'):
        for (w, a, b) in words[lid]:
            if w.startswith(prefix):
                return a if which == 'start' else b
        return L(lid)['start']

    def word_before(lid, prefix):
        """Start of the word right before the first word starting with prefix (e.g. "в" before "полночь")."""
        ws = words[lid]
        for i, (w, a, b) in enumerate(ws):
            if w.startswith(prefix):
                return ws[i - 1][1] if i > 0 else a
        return L(lid)['start']

    # --- shots (cut points on line starts or on specific words)
    c1 = L('L2')['start'] - 0.12
    c1a = word_before('L1', 'СОТНИ') - 0.05          # "в сотни раз" -> closer on the fireball
    hiro = word_t('L1', 'ХИРОСИМЫ')
    s01_fx = dict(embers=70, heat=1.0, bloom=0.9, fire=1.0,
                  grade=dict(exposure=0.05, contrast=1.08, sat=1.05, warm=0.6, demagenta=0.6))
    add('s01_fireball', 0.0, c1a, cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.08), pany=(0.0, -0.01), parx=(0, 14)),
        fx=dict(s01_fx, flash=[(0.12, 0.45, 0.7)], shake=[(0.12, 1.4, 16)]))
    add('s01_fireball', c1a, c1, into='zoom', cam=dict(zoom=(1.34, 1.46), pany=(0.03, 0.03), parx=(-10, 10)),
        fx=dict(s01_fx, punch=[(hiro, 0.07)], shake=[(hiro, 0.6, 10)]))
    c2 = L('L3')['start'] - 0.1
    add('s14_mystery', c1, c2, cam=dict(zoom=(1.08, 1.0), parx=(-26, 26), dolly=(0.06, 0.0)),
        fx=dict(fog=0.35, ash=40, grade=dict(exposure=-0.15, contrast=1.05, sat=0.85, teal=0.8)), into='zoom')
    c3 = word_t('L3', 'МЕСТНЫЙ') - 0.08
    add('s02_trading_post', c2, c3, cam=dict(zoom=(1.0, 1.07), panx=(-0.02, 0.02), parx=(-20, 20)),
        fx=dict(dust=40, fog=0.18, grade=dict(exposure=0.05, contrast=1.02, sat=0.95, warm=0.5)), into='fade')
    c4 = L('L4')['start'] - 0.06
    add('s03_semenov_porch', c3, c4, cam=dict(zoom=(1.04, 1.12), dolly=(0.0, 0.10), pany=(0.0, -0.01)),
        fx=dict(dust=30, grade=dict(exposure=0.0, contrast=1.04, sat=0.95, warm=0.55)))
    c5 = L('L5')['start'] - 0.06
    fire_t = word_t('L4', 'ОГОНЬ')
    add('s04_sky_splits', c4, c5, cam=dict(zoom=(1.0, 1.16), pany=(0.01, -0.02), dolly=(0.0, 0.08)),
        fx=dict(embers=50, flash=[(fire_t, 0.6, 1.1)], shake=[(fire_t, 1.3, 16)], heat=0.7, bloom=1.0, punch=[(fire_t, 0.08)], fire=1.0,
                grade=dict(exposure=0.0, contrast=1.1, sat=1.08, warm=0.8, demagenta=0.85)))
    hit_t = word_t('L5', 'УДАР')
    c5b = hit_t - 0.04
    add('s05_heat_face', c5, c5b, into='zoom',
        cam=dict(zoom=(1.06, 1.18), dolly=(0.0, 0.08), parx=(10, -10)),
        fx=dict(embers=60, heat=0.9, bloom=0.9,
                light=dict(x=0.15, y=0.25, r=1.2, col=(0.55, 0.22, 0.02), flicker=0.25),
                grade=dict(exposure=0.05, contrast=1.1, sat=1.05, warm=0.9)))
    # the blow: back on the porch, the frame is knocked sideways
    add('s03_semenov_porch', c5b, L('L5')['end'] + 0.35,
        cam=dict(zoom=(1.16, 1.32), roll=(-2.0, -9.0), pany=(0.0, 0.03)),
        fx=dict(embers=80, ash=60, flash=[(hit_t, 0.5, 1.6)], shake=[(hit_t, 1.2, 40)], smear=[(hit_t, 0.7, 70)], heat=0.8, bloom=1.0,
                punch=[(hit_t, 0.14)], light=dict(x=0.85, y=0.15, r=1.3, col=(0.7, 0.3, 0.05), flicker=0.35),
                blackout=(L('L5')['end'] + 0.05, L('L5')['end'] + 0.35),
                grade=dict(exposure=0.1, contrast=1.12, sat=1.0, warm=1.2)))
    c6 = L('L7')['start'] - 0.08
    add('s06b_distant_blast_s63', L('L5')['end'] + 0.35, c6,
        cam=dict(zoom=(1.0, 1.1), pany=(0.0, -0.01), parx=(-12, 12)),
        fx=dict(ring=dict(start=L('L6')['start'] + 0.2, x=0.5, y=0.322, r=300), bloom=0.8, dust=20,
                punch=[(word_t('L6', '65'), 0.06)],
                grade=dict(exposure=0.0, contrast=1.06, sat=1.0, warm=0.4)))
    c7 = word_t('L7', 'ПЛОЩАДЬ') - 0.08
    add('s07_shockwave_forest', c6, c7, into='zoom', cam=dict(zoom=(1.0, 1.14), panx=(0.02, -0.02), dolly=(0.0, 0.12)),
        fx=dict(ash=70, shake=[(c6, 2.0, 14)], smear=[(c6, 0.5, 40)], bloom=0.7, heat=0.5, punch=[(c6, 0.05)],
                grade=dict(exposure=0.0, contrast=1.08, sat=1.0, warm=0.6)))
    c8 = L('L8')['start'] - 0.08
    add('s08d_blowdown_s86', c7, c8, cam=dict(zoom=(1.14, 1.0), roll=(-1.5, 1.0), pary=(0, -14)),
        fx=dict(fog=0.15, ash=30, grade=dict(exposure=0.0, contrast=1.16, sat=0.9, warm=0.25, teal=0.3, demagenta=0.7)))
    c9 = L('L9')['start'] - 0.08
    c8b = word_before('L8', 'ПОЛНОЧЬ') - 0.05        # "в полночь можно читать газету" -> closer on the reader
    s09_fx = dict(dust=25, bloom=0.8, skyglow=dict(amt=1.2, h=0.6, far=0.45, col=(1.0, 0.85, 0.64)),
                  grade=dict(exposure=0.05, contrast=1.04, sat=0.95, warm=0.3, teal=0.4))
    add('s09_europe_night', c8, c8b, into='fade', cam=dict(zoom=(1.0, 1.08), pany=(0.015, -0.01), parx=(-18, 18)), fx=s09_fx)
    add('s09_europe_night', c8b, c9, cam=dict(zoom=(1.42, 1.5), panx=(0.1, 0.11), pany=(-0.02, -0.03), parx=(-8, 8)), fx=s09_fx)
    c10 = L('L10')['start'] - 0.08
    k_split = word_t('L9', 'ЛЕОНИД') - 0.08
    has_b = any(f.startswith('s10b_kulik_closeup_s') and f.endswith('.png') and '_depth' not in f
                for f in os.listdir(SHOTS))
    old_look = dict(snow=110, fog=0.15, oldfilm=True, grade=dict(exposure=0.0, contrast=1.08, sat=0.35, warm=0.9))
    if has_b:
        add('s10_kulik_expedition', c9, k_split, cam=dict(zoom=(1.0, 1.08), panx=(0.015, -0.015), parx=(-22, 22)),
            fx=old_look, into='flash')
        add('s10b_kulik_closeup', k_split, c10, cam=dict(zoom=(1.04, 1.14), dolly=(0.0, 0.08), parx=(12, -12)),
            fx=dict(old_look, snow=60))
    else:
        add('s10_kulik_expedition', c9, c10, cam=dict(zoom=(1.0, 1.1), panx=(0.015, -0.015), parx=(-22, 22)),
            fx=old_look, into='flash')
    c11 = L('L11')['start'] - 0.08
    c10b = word_before('L10', 'КРАТЕРА') - 0.05        # "ни кратера. ни осколков." -> closer on the lone explorer
    s11_fx = dict(fog=0.3, grade=dict(exposure=-0.05, contrast=1.04, sat=0.8, teal=0.6, demagenta=0.7))
    add('s11_empty_swamp', c10, c10b, cam=dict(zoom=(1.12, 1.04), dolly=(0.08, 0.0)),
        fx=dict(s11_fx, punch=[(word_t('L10', 'НИЧЕГО'), 0.05)]))
    add('s11_empty_swamp', c10b, c11, cam=dict(zoom=(1.42, 1.52), panx=(0.09, 0.1), pany=(0.0, 0.01), parx=(-10, 10)),
        fx=dict(s11_fx, punch=[(word_t('L10', 'ОСКОЛКОВ'), 0.04)]))
    c11b = word_before('L11', 'В') - 0.05              # "только поваленный лес, | а в центре ..."
    add('s08c_fallen_forest_s85', c11, c11b, into='zoom', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.1), parx=(-16, 16)),
        fx=dict(fog=0.25, ash=25, grade=dict(exposure=-0.06, contrast=1.08, sat=0.75, teal=0.6, demagenta=0.85)))
    c12 = L('L12')['start'] - 0.08
    add('s12_telegraph_forest', c11b, c12, cam=dict(zoom=(1.0, 1.1), parx=(-30, 30), dolly=(0.0, 0.06)),
        fx=dict(fog=0.45, ash=35, grade=dict(exposure=-0.1, contrast=1.06, sat=0.75, teal=0.8)))
    c12b = word_t('L12', 'НО') - 0.06                  # "но спорят об этом до сих пор" -> back to the mystery
    add('s13_comet', c12, c12b, into='fade', cam=dict(zoom=(1.0, 1.12), pany=(-0.01, 0.01), parx=(-14, 14)),
        fx=dict(bloom=1.0, dust=20, grade=dict(exposure=0.0, contrast=1.08, sat=1.0, teal=0.5, warm=0.3, demagenta=0.85)))
    c13 = L('L13')['start'] - 0.1
    add('s14_mystery', c12b, c13, into='zoom', cam=dict(zoom=(1.38, 1.48), panx=(-0.05, -0.04), pany=(0.11, 0.12), parx=(-12, 12)),
        fx=dict(fog=0.35, ash=30, grade=dict(exposure=-0.12, contrast=1.06, sat=0.85, teal=0.8)))
    add('s01_fireball_s12', c13, total, cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.10), parx=(10, -10)),
        fx=dict(embers=70, heat=1.0, bloom=0.9, fire=1.0, grade=dict(exposure=0.0, contrast=1.08, sat=1.05, warm=0.6)),
        into='flash')

    cards = [
        dict(text='65 КМ', sub='ДО ЭПИЦЕНТРА', start=word_t('L6', '65'), end=c6 - 0.05, y=900, count=True),
        dict(text='2000+ КМ²', sub='ПОВАЛЕННОГО ЛЕСА', start=word_t('L7', 'ПЛОЩАДЬ'), end=c8 - 0.05, y=700, count=True),
        dict(text='19 ЛЕТ', sub='СПУСТЯ', start=word_t('L9', '19'), end=(k_split - 0.05) if has_b else (c10 - 0.1), y=700, count=True),
    ]
    tags = [
        dict(text='ВАНАВАРА · 30 ИЮНЯ 1908', start=c2 + 0.15, end=c4 - 0.1),
        dict(text='ЕВРОПА · НОЧИ ПОСЛЕ ВЗРЫВА', start=c8 + 0.15, end=c8b - 0.1),
        dict(text='ЭКСПЕДИЦИЯ КУЛИКА · 1927', start=c9 + 0.3, end=word_t('L9', '19') - 0.05),
        dict(text='ЭПИЦЕНТР', start=c11b + 0.15, end=c12 - 0.1),
        dict(text='ВЕРСИЯ УЧЁНЫХ', start=c12 + 0.15, end=c12b - 0.1),
    ]
    cover = dict(start=0.0, end=word_t('L1', 'НЕЧТО') - 0.1)
    tl = dict(total=total, lines=lines, shots=shots, cards=cards, cover=cover, tags=tags,
              words={k: v for k, v in words.items()})
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
    sel = json.load(open(f'{WORK}/picks.json')) if os.path.exists(f'{WORK}/picks.json') else {}
    name = sel.get(img_id)
    if not name:
        cands = sorted(f for f in os.listdir(SHOTS) if f.startswith(img_id + '_s') and f.endswith('.png')
                       and '_depth' not in f and '_lat' not in f and '_unused' not in f)
        name = cands[0]
    return f'{SHOTS}/{name}'


def source(img_id, grade_kw=None):
    key = (img_id, json.dumps(grade_kw or {}, sort_keys=True))
    if key not in _SRC:
        p = pick(img_id)
        dp = p[:-4] + '_depth.png'
        if not os.path.exists(dp):
            import depth as dmod
            dmod.depth_of(Image.open(p)).save(dp)
        _SRC[key] = Source(p, dp, grade_kw=grade_kw)
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
    cam = Cam(zoom=interp(c, 'zoom', ue, 1.0) * punch, panx=interp(c, 'panx', ue, 0.0), pany=interp(c, 'pany', ue, 0.0),
              parx=interp(c, 'parx', ue, 0.0), pary=interp(c, 'pary', ue, 0.0), dolly=interp(c, 'dolly', ue, 0.0),
              d0=c.get('d0', 0.5), roll=interp(c, 'roll', ue, 0.0), shakex=sx, shakey=sy)
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


def render_shot(sh, t, n):
    cam, u = cam_for(sh, t)
    fx = sh.get('fx', {})
    src = source(sh['img'], fx.get('grade'))
    need_depth = fx.get('fog', 0) > 0 or 'skyglow' in fx
    im, dep = warp(src, cam, with_depth=need_depth)
    a = to_np(im)
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
        fl = 1 + L.get('flicker', 0) * smooth_noise(5, t * 3.0)
        a = a + radial_light(L['x'] * W, L['y'] * H, L['r'] * W, L['col']) * fl
    # particles
    dx = -cam.parx * 0.5 * (u - 0.5)
    for kind in ('embers', 'ash', 'snow', 'dust'):
        if fx.get(kind):
            key = (sh['img'], kind)
            if key not in _PART:
                _PART[key] = Particles(kind, fx[kind], seed=hash(key) % 1000)
            _PART[key].draw(a, t - sh['start'], cam_dx=dx * 2, cam_dy=0)
    # flashes
    for (t0, dur, k) in fx.get('flash', []):
        if t0 - 0.04 <= t < t0 + dur:
            e = 1.0 if t < t0 + 0.06 else (1 - (t - t0 - 0.06) / (dur - 0.06)) ** 2
            a = a + e * k * np.array([1.0, 0.85, 0.65], np.float32)
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
    y0 = 300
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
    yr = tl_text.render('1908', F('InterDisplay-Black.otf', 300), YELLOW, stroke=12, squeeze=0.9, track=-8)
    paste_rgba(a, yr, W / 2, 625 + lift * 0.5, alpha=al, scale=min(1.0, 760 / yr.width))
    for i, txt in enumerate(lines):
        im = tl_text.render(txt, F('InterDisplay-Black.otf', 128), (255, 255, 255), stroke=9, squeeze=0.86, track=-2)
        paste_rgba(a, im, W / 2, 835 + i * 128 + lift, alpha=al, scale=min(1.0, 880 / im.width))


_BAND = None


def _band():
    global _BAND
    if _BAND is None:
        yy = np.linspace(-1, 1, 300)[:, None, None]
        _BAND = (1 - 0.32 * np.exp(-(yy / 0.55) ** 2)).astype(np.float32)
    return _BAND


def draw_captions(a, t, tl, tl_text):
    for lid, ws in tl['words'].items():
        if not ws:
            continue
        if not (ws[0][1] - 0.15 <= t <= ws[-1][2] + 0.25):
            continue
        chunks = capmod.chunk(ws)
        if lid == 'L1':  # the cover carries the start of the hook
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
    # transition out: zoom into the next shot
    idx = shots.index(cur)
    if idx + 1 < len(shots) and shots[idx + 1].get('into') == 'zoom':
        left = cur['end'] - t
        if 0 <= left < 0.14:
            a = radial_blur(a, 0.10 * (1 - left / 0.14))
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
    draw_captions(a, t, tl, _TEXT)
    # final fade
    if t > tl['total'] - 0.4:
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
