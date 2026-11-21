"""Where the facecam is, and the ffmpeg filter that turns a 16:9 stream into a 9:16 clip.

Layouts (output 1080x1920):
  split  webcam on top, the middle of the game below (the usual clip layout);
  blur   the whole frame in the middle over a blurred, zoomed copy of itself (no webcam, or a busy HUD);
  crop   a 9:16 cut of the middle (just chatting, the streamer fills the frame).
"""
import os

import numpy as np

os.environ.setdefault('OPENCV_LOG_LEVEL', 'ERROR')          # no decoder chatter from cv2
os.environ.setdefault('OPENCV_FFMPEG_LOGLEVEL', '-8')

W, H = 1080, 1920


def _frames(path, t0, t1, n=14, width=960):
    import cv2
    cap = cv2.VideoCapture(path)
    out = []
    for i in range(n):
        t = t0 + (t1 - t0) * (i + 0.5) / n
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, fr = cap.read()
        if not ok:
            continue
        k = width / fr.shape[1]
        out.append((cv2.resize(fr, (width, int(round(fr.shape[0] * k)))), k))
    cap.release()
    return out


def detect_cam(path, t0, t1, debug_jpg=None):
    """Facecam box (x, y, w, h) in source pixels, or None when no steady face is seen."""
    try:
        import cv2
    except ImportError:
        return None
    frames = _frames(path, t0, t1)
    if not frames:
        return None
    k = frames[0][1]
    find = _face_finder(frames[0][0].shape)
    if find is None:
        return None
    faces = []
    grays = []
    for fi, (fr, _) in enumerate(frames):
        grays.append(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY))
        for (x, y, w, h) in find(fr):
            faces.append((fi, x, y, w, h))
    if not faces:
        return None
    # the webcam face stays in one place; game characters' faces wander
    best, members = None, []
    for f in faces:
        cx, cy = f[1] + f[3] / 2, f[2] + f[4] / 2
        m = [g for g in faces if abs(g[1] + g[3] / 2 - cx) < f[3] * 0.6 and abs(g[2] + g[4] / 2 - cy) < f[4] * 0.6]
        if len({g[0] for g in m}) > len({g[0] for g in members}):
            best, members = f, m
    hits = len({g[0] for g in members})
    if hits < max(3, 0.3 * len(frames)):
        return None
    fx = float(np.median([g[1] for g in members]))
    fy = float(np.median([g[2] for g in members]))
    fw = float(np.median([g[3] for g in members]))
    fh = float(np.median([g[4] for g in members]))
    gh, gw = grays[0].shape
    cx, cy = fx + fw / 2, fy + fh / 2
    if fw > gw * 0.22:                  # a face this big is the whole picture, not a corner webcam
        return None

    # first guess: a 16:9 box around the face, the face a bit above the middle
    bw = min(gw, fw * 3.6)
    bh = min(gh, bw * 9 / 16)
    box = [cx - bw / 2, cy - bh * 0.45, cx + bw / 2, cy + bh * 0.55]

    # webcam frames are straight lines that stay put while the game moves: look for them
    persist = _persistent_edges(grays)
    found = _border(persist, cx, cy, fw, box)
    for i in range(4):
        if found[i] is not None:
            box[i] = found[i]
    # a side without a visible frame goes to the edge of the stream when close to it
    if found[0] is None and box[0] < gw * 0.06:
        box[0] = 0
    if found[1] is None and box[1] < gh * 0.06:
        box[1] = 0
    if found[2] is None and box[2] > gw * 0.94:
        box[2] = gw
    if found[3] is None and box[3] > gh * 0.94:
        box[3] = gh
    x0, y0 = max(0, box[0]), max(0, box[1])
    x1, y1 = min(gw, box[2]), min(gh, box[3])
    if x1 - x0 < fw * 1.4 or y1 - y0 < fh * 1.4:
        return None
    res = tuple(int(round(v / k)) for v in (x0, y0, x1 - x0, y1 - y0))
    if debug_jpg:
        fr = frames[len(frames) // 2][0].copy()
        cv2.rectangle(fr, (int(x0), int(y0)), (int(x1), int(y1)), (0, 255, 255), 3)
        cv2.rectangle(fr, (int(fx), int(fy)), (int(fx + fw), int(fy + fh)), (0, 0, 255), 2)
        cv2.imwrite(debug_jpg, fr)
    return res


YUNET = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'face_detection_yunet_2023mar.onnx')


def _face_finder(shape):
    """frame -> [(x, y, w, h)]: YuNet (OpenCV 4.5.4+ and 5), else the old Haar cascade of OpenCV 4."""
    import cv2
    if hasattr(cv2, 'FaceDetectorYN') and os.path.exists(YUNET):
        det = cv2.FaceDetectorYN.create(YUNET, '', (shape[1], shape[0]), 0.75)

        def find(fr):
            det.setInputSize((fr.shape[1], fr.shape[0]))
            _, faces = det.detect(fr)
            return [tuple(f[:4]) for f in faces if f[2] >= 20] if faces is not None else []
        return find
    if hasattr(cv2, 'CascadeClassifier'):
        casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

        def find(fr):
            g = cv2.equalizeHist(cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY))
            return [tuple(f) for f in casc.detectMultiScale(g, 1.1, 6, minSize=(28, 28))]
        return find
    return None


def _persistent_edges(grays):
    import cv2
    acc_v = np.zeros(grays[0].shape, np.float32)
    acc_h = np.zeros(grays[0].shape, np.float32)
    for g in grays:
        gx = np.abs(cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3))
        gy = np.abs(cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3))
        acc_v += gx > 60
        acc_h += gy > 60
    return acc_v / len(grays), acc_h / len(grays)


def _border(persist, cx, cy, fw, box):
    """Left, top, right, bottom webcam border near the guess, or None for each side not found."""
    pv, ph = persist
    gh, gw = pv.shape
    out = [None] * 4
    ys = slice(int(max(0, cy - fw * 0.9)), int(min(gh, cy + fw * 0.9)))
    xs = slice(int(max(0, cx - fw * 0.9)), int(min(gw, cx + fw * 0.9)))
    # (side, profile along the search axis, search range)
    col = pv[ys].mean(axis=0)
    row = ph[:, xs].mean(axis=1)
    sides = [
        (0, col, (cx - fw * 3.2, cx - fw * 0.9)),
        (2, col, (cx + fw * 0.9, cx + fw * 3.2)),
        (1, row, (cy - fw * 2.4, cy - fw * 0.8)),
        (3, row, (cy + fw * 0.9, cy + fw * 2.6)),
    ]
    for side, prof, (a, b) in sides:
        a, b = int(max(1, a)), int(min(len(prof) - 2, b))
        if b <= a:
            continue
        seg = prof[a:b]
        best = float(seg.max())
        if best <= 0.55:                 # no edge in more than half the frames along most of the side
            continue
        # the room behind the streamer is static too: of the strong lines take the one farthest from the face
        idx = np.flatnonzero(seg >= max(0.55, 0.75 * best))
        i = int(idx[0] if side in (0, 1) else idx[-1])
        out[side] = float(a + i)
    return out


def parse_box(s):
    v = [float(x) for x in s.split(',')]
    if len(v) != 4:
        raise ValueError('--cam нужно как x,y,w,h')
    return tuple(int(x) for x in v)


def plan(layout, sw, sh, cam=None, zoom=1.0, game_x=0.5):
    """filter_complex body from [0:v] to [v], plus where subtitles and the title go."""
    if layout == 'auto':
        layout = 'split' if cam else 'blur'
    if layout == 'split' and not cam:
        raise ValueError('для split нужна вебка: её не нашли, укажи --cam x,y,w,h или выбери --layout blur')
    if layout == 'split':
        x, y, w, h = cam
        ch = int(np.clip(round(W * h / w / 2) * 2, 560, 860))      # webcam height in the clip
        gh_ = H - ch
        cw_, chh = _fit(w, h, W / ch)                               # crop the webcam box to the strip
        cx0 = x + (w - cw_) / 2
        cy0 = y + (h - chh) * 0.4
        gcw, gch = _fit(sw, sh, W / gh_)
        gcw, gch = gcw / zoom, gch / zoom
        gx = np.clip(sw * game_x - gcw / 2, 0, sw - gcw)
        # keep the webcam out of the game picture: move the crop off it by up to 15% of the width
        if x < gx + gcw and x + w > gx:
            room, pad = sw * 0.15, sw * 0.012
            if x + w / 2 < sw / 2:
                gx = min(gx + room, x + w + pad, sw - gcw)
            else:
                gx = max(gx - room, x - pad - gcw, 0)
        gy = (sh - gch) / 2
        f = (f'[0:v]split=2[c][g];'
             f'[c]crop={_e(cw_)}:{_e(chh)}:{_e(cx0)}:{_e(cy0)},scale={W}:{ch}:flags=lanczos,setsar=1[cam];'
             f'[g]crop={_e(gcw)}:{_e(gch)}:{_e(gx)}:{_e(gy)},scale={W}:{gh_}:flags=lanczos,setsar=1[game];'
             f'[cam][game]vstack[v]')
        # the title sits on the seam (it would cover the face on top); the subtitles go lower when there is one
        return {'layout': 'split', 'filter': f, 'sub_y': ch + 10, 'sub_y_title': ch + 250, 'title_y': ch,
                'credit_y': ch - 40, 'credit_y_title': ch - 150}
    if layout == 'blur':
        fw_, fh_ = sw / zoom, sh / zoom
        fg_h = int(round(W * fh_ / fw_ / 2) * 2)
        fy = (H - fg_h) // 2 - 60
        f = (f'[0:v]split=2[b][f];'
             f'[b]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=28:4,eq=brightness=-0.12[bg];'
             f'[f]crop={_e(fw_)}:{_e(fh_)},scale={W}:{fg_h}:flags=lanczos,setsar=1[fg];'
             f'[bg][fg]overlay=0:{fy}[v]')
        return {'layout': 'blur', 'filter': f, 'sub_y': fy + fg_h + 150, 'title_y': max(260, fy - 190),
                'credit_y': fy + fg_h + 16}
    if layout == 'crop':
        cw_, chh = _fit(sw, sh, W / H)
        cw_, chh = cw_ / zoom, chh / zoom
        gx = np.clip(sw * game_x - cw_ / 2, 0, sw - cw_)
        f = (f'[0:v]crop={_e(cw_)}:{_e(chh)}:{_e(gx)}:{_e((sh - chh) / 2)},scale={W}:{H}:flags=lanczos,setsar=1[v]')
        return {'layout': 'crop', 'filter': f, 'sub_y': int(H * 0.68), 'title_y': 330, 'credit_y': int(H * 0.68) - 150}
    raise ValueError(f'нет такого layout: {layout}')


def _fit(w, h, aspect):
    """Largest w x h crop with the given aspect inside a w x h box."""
    if w / h > aspect:
        return h * aspect, h
    return w, w / aspect


def _e(v):
    return str(int(round(v)) // 2 * 2)
