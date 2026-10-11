# Audio helpers without scipy/soundfile: WAV I/O, trimming, pitch, ASR (whisper.cpp), CER.
import os, re, struct, subprocess, tempfile
import numpy as np

VOX_HOME = os.path.expanduser(os.environ.get('VOX_HOME', '~/voxcpm2'))   # see ../setup.sh
WHISPER = os.path.join(VOX_HOME, 'src/whisper.cpp/build/bin/whisper-cli')
WMODEL = os.path.join(VOX_HOME, 'models/whisper/ggml-large-v3-turbo-q8_0.bin')


def read_wav(path, mono=True):
    """Float32 samples (mono mix unless mono=False) + sample rate. PCM 16/24/32 and IEEE float."""
    b = open(path, 'rb').read()
    assert b[:4] == b'RIFF' and b[8:12] == b'WAVE', path
    i, fmt, data = 12, None, None
    while i + 8 <= len(b):
        cid, size = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        body = b[i + 8:i + 8 + size]
        if cid == b'fmt ':
            fmt = struct.unpack('<HHIIHH', body[:16])
        elif cid == b'data':
            data = body
        i += 8 + size + (size & 1)
    tag, ch, sr, _, _, bits = fmt
    if tag == 0xFFFE:
        tag = 3 if bits == 32 and b'\x03\x00\x00\x00\x00\x00\x10\x00' in b[:200] else 1
    if tag == 3:
        x = np.frombuffer(data, '<f4' if bits == 32 else '<f8').astype(np.float32)
    elif bits == 16:
        x = np.frombuffer(data[:len(data) // 2 * 2], '<i2').astype(np.float32) / 32768
    elif bits == 24:
        a = np.frombuffer(data[:len(data) // 3 * 3], np.uint8).reshape(-1, 3).astype(np.int32)
        v = a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16)
        x = (np.where(v >= 1 << 23, v - (1 << 24), v)).astype(np.float32) / (1 << 23)
    elif bits == 32:
        x = np.frombuffer(data, '<i4').astype(np.float32) / 2 ** 31
    else:
        raise ValueError(bits)
    if ch > 1:
        x = x[:len(x) // ch * ch].reshape(-1, ch)
        if mono:
            x = x.mean(1)
    return x, sr


def write_wav(path, x, sr, bits=16):
    x = np.asarray(x, np.float64)
    ch = 1 if x.ndim == 1 else x.shape[1]
    x = np.clip(x, -1, 1)
    if bits == 16:
        raw = (x * 32767).round().astype('<i2').tobytes()
    else:
        v = (x * (2 ** 23 - 1)).round().astype(np.int32).reshape(-1)
        raw = np.stack([v & 255, (v >> 8) & 255, (v >> 16) & 255], 1).astype(np.uint8).tobytes()
    ba = ch * bits // 8
    hdr = b'RIFF' + struct.pack('<I', 36 + len(raw)) + b'WAVE' + b'fmt ' + struct.pack('<IHHIIHH', 16, 1, ch, sr, sr * ba, ba, bits)
    open(path, 'wb').write(hdr + b'data' + struct.pack('<I', len(raw)) + raw)


def frames_db(x, sr, win=0.02):
    n = max(1, int(sr * win))
    m = len(x) // n
    e = (x[:m * n].reshape(m, n) ** 2).mean(1)
    return 10 * np.log10(e + 1e-12), n


def trim_bounds(x, sr, thr=-45.0):
    """Like ffmpeg silenceremove at both ends: first/last 20 ms frame above thr dBFS."""
    db, n = frames_db(x, sr)
    on = np.where(db > thr)[0]
    if len(on) == 0:
        return 0, len(x)
    return on[0] * n, min(len(x), (on[-1] + 1) * n)


def longest_gap(x, sr, thr=-40.0):
    """Longest internal pause (s) between first and last loud frame."""
    db, n = frames_db(x, sr)
    on = np.where(db > thr)[0]
    if len(on) < 2:
        return 0.0
    return float((np.diff(on).max() - 1) * n / sr)


def f0_track(x, sr, fmin=70, fmax=700):
    """YIN-style pitch on 16 kHz; returns f0 (Hz) of voiced 10 ms frames."""
    if sr != 16000:
        k = 16000 / sr
        t = np.arange(int(len(x) * k)) / k
        x = np.interp(t, np.arange(len(x)), x)
        sr = 16000
    W, H = 640, 160
    tmin, tmax = int(sr / fmax), int(sr / fmin)
    db, _ = frames_db(x, sr, H / sr)
    gate = db.max() - 30
    out = []
    for i in range(0, len(x) - W - tmax, H):
        if db[min(i // H, len(db) - 1)] < gate:
            continue
        fr = x[i:i + W + tmax]
        d = np.array([np.sum((fr[:W] - fr[tau:tau + W]) ** 2) for tau in range(tmax + 1)])
        cm = d[1:] * np.arange(1, tmax + 1) / (np.cumsum(d[1:]) + 1e-12)
        cm = np.concatenate([[1.0], cm])
        cand = np.where(cm[tmin:] < 0.2)[0]
        if len(cand) == 0:
            continue
        tau = cand[0] + tmin
        while tau + 1 <= tmax and cm[tau + 1] < cm[tau]:
            tau += 1
        if 0 < tau < tmax:   # parabolic refine
            a, b_, c = cm[tau - 1], cm[tau], cm[tau + 1]
            den = a - 2 * b_ + c
            tau = tau + (0.5 * (a - c) / den if abs(den) > 1e-12 else 0)
        out.append(sr / tau)
    return np.array(out)


def stats(path):
    x, sr = read_wav(path)
    a, b = trim_bounds(x, sr)
    y = x[a:b]
    f0 = f0_track(y, sr)
    rms = 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-12) if len(y) else -99
    st = dict(dur=len(x) / sr, speech=(b - a) / sr, lead=a / sr, rms=round(float(rms), 1),
              peak=round(float(np.abs(x).max()), 3), gap=round(longest_gap(y, sr), 2), voiced=len(f0))
    if len(f0) >= 5:
        st.update(f0=round(float(np.median(f0))), f0lo=round(float(np.percentile(f0, 10))),
                  f0hi=round(float(np.percentile(f0, 90))))
    return st


def asr(path, prompt=None):
    """Russian transcript via whisper.cpp large-v3-turbo."""
    with tempfile.TemporaryDirectory() as td:
        w = os.path.join(td, 'a.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ar', '16000', '-ac', '1', w], check=True)
        cmd = [WHISPER, '-m', WMODEL, '-l', 'ru', '-f', w, '-nt', '-np', '-t', '4']
        if prompt:
            cmd += ['--prompt', prompt]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return ' '.join(r.stdout.split())


def norm_text(s):
    s = s.lower().replace('ё', 'е')
    s = re.sub(r'[^a-zа-я0-9 ]+', ' ', s)
    return ' '.join(s.split())


def cer(ref, hyp):
    r, h = norm_text(ref), norm_text(hyp)
    d = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (rc != hc))
    return d[len(h)] / max(1, len(r))


def ltas(path, bands=40, fmax=8000):
    """Long-term log-mel spectrum of the loud frames: a rough timbre fingerprint."""
    x, sr = read_wav(path)
    a, b = trim_bounds(x, sr)
    x = x[a:b]
    n, hop = 1024, 256
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    mel = lambda h: 2595 * np.log10(1 + h / 700)
    edges = 700 * (10 ** (np.linspace(mel(60), mel(fmax), bands + 2) / 2595) - 1)
    fb = np.array([np.clip(np.minimum((f - lo) / (c - lo), (hi - f) / (hi - c)), 0, None)
                   for lo, c, hi in zip(edges[:-2], edges[1:-1], edges[2:])])
    E = S @ fb.T
    e = E.sum(1)
    loud = e > np.percentile(e, 50)
    v = np.log(E[loud] + 1e-10).mean(0)
    return v - v.mean()


def timbre_sim(a, b):
    va, vb = ltas(a), ltas(b)
    return float(va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-12))
