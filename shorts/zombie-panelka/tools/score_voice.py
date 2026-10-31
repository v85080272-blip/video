# Naturalness proxy for narration takes without listening: UTMOS22 (ONNX, HF TigreGotico/utmos-onnx, MIT)
# averaged over 6 s chunks, plus the per-line CER from cut_voice.py's report.json.
# usage: python3 -I score_voice.py <model.onnx> <take.wav> [<take.wav> ...]
import json, os, subprocess, sys
import numpy as np
import onnxruntime as ort

MODEL = sys.argv[1]
so = ort.SessionOptions(); so.intra_op_num_threads = 4
sess = ort.InferenceSession(MODEL, so, providers=['CPUExecutionProvider'])


def load16(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def utmos(x):
    outs = []
    for i in range(0, max(1, len(x) - 32000), 96000):
        c = x[i:i + 96000]
        if len(c) >= 32000:
            outs.append(float(sess.run(None, {'wave': c[None].astype(np.float32)})[0][0]))
    return outs


for path in sys.argv[2:]:
    x = load16(path)
    u = utmos(x)
    print(os.path.basename(path), 'dur', round(len(x) / 16000, 1), 'UTMOS', round(float(np.mean(u)), 2),
          'min', round(min(u), 2), 'chunks', [round(v, 2) for v in u])
