# Objective liveliness checks for narrator takes: UTMOS (naturalness proxy), pitch movement, pace, pauses.
import sys, os, json, subprocess, tempfile
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools', '/home/user/work/voice/shorts/voxcpm2/shim']
import aud
import onnxruntime as ort

_sess = None
def utmos(x16):
    global _sess
    if _sess is None:
        so = ort.SessionOptions(); so.intra_op_num_threads = int(os.environ.get('UT_THREADS', '4'))
        _sess = ort.InferenceSession('/home/user/work/models/utmos/utmos22_strong.onnx', so, providers=['CPUExecutionProvider'])
    seg = 16000 * 6
    outs = []
    for i in range(0, max(1, len(x16) - 16000 * 2), seg):
        c = x16[i:i + seg]
        if len(c) < 16000 * 2:
            continue
        outs.append(float(_sess.run(None, {'wave': c[None].astype(np.float32)})[0][0]))
    return float(np.mean(outs)) if outs else float('nan'), outs

def load16(path):
    with tempfile.TemporaryDirectory() as td:
        w = os.path.join(td, 'a.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-ar', '16000', '-ac', '1', w], check=True)
        x, sr = aud.read_wav(w)
    return x

def pauses(x, sr, thr=-38.0, min_len=0.18):
    db, n = aud.frames_db(x, sr)
    on = db > thr
    idx = np.where(on)[0]
    if len(idx) == 0:
        return []
    on = on[idx[0]:idx[-1] + 1]
    out, run = [], 0
    for v in on:
        if not v:
            run += 1
        else:
            if run * n / sr >= min_len:
                out.append(run * n / sr)
            run = 0
    return out

def score(path, words=None):
    x = load16(path)
    a, b = aud.trim_bounds(x, 16000)
    y = x[a:b]
    f0 = aud.f0_track(y, 16000)
    st = np.log2(f0) * 12 if len(f0) else np.array([0.0])
    p = pauses(y, 16000)
    m, segs = utmos(y)
    r = dict(file=os.path.basename(path), speech=round(len(y) / 16000, 2), utmos=round(m, 2),
             utmos_segs=[round(s, 2) for s in segs],
             f0_med=round(float(np.median(f0))) if len(f0) else 0,
             f0_sd_st=round(float(np.std(st)), 2),
             f0_range_st=round(float(np.percentile(st, 90) - np.percentile(st, 10)), 1),
             pauses=len(p), pause_total=round(sum(p), 2), longest_pause=round(max(p) if p else 0, 2))
    if words:
        r['wps'] = round(words / (len(y) / 16000), 2)
        r['wps_no_pause'] = round(words / (len(y) / 16000 - sum(p)), 2)
    return r

if __name__ == '__main__':
    words = int(os.environ.get('WORDS', '0')) or None
    for f in sys.argv[1:]:
        print(json.dumps(score(f, words), ensure_ascii=False), flush=True)
