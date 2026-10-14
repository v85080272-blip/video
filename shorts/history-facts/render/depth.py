"""Depth Anything V2 Small (ONNX, Apache-2.0) -> normalized near=1 depth map saved as 16-bit PNG next to the image."""
import sys, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
MEAN = np.array([0.485, 0.456, 0.406], np.float32); STD = np.array([0.229, 0.224, 0.225], np.float32)
_sess = None
def sess(threads=2):
    global _sess
    if _sess is None:
        so = ort.SessionOptions(); so.intra_op_num_threads = threads
        _sess = ort.InferenceSession('/home/user/work/models/depth_anything_v2_small.onnx', so, providers=['CPUExecutionProvider'])
    return _sess
def depth_of(img: Image.Image, long_side=980):
    w, h = img.size
    s = long_side / max(w, h)
    tw, th = max(14, round(w * s / 14) * 14), max(14, round(h * s / 14) * 14)
    x = np.asarray(img.convert('RGB').resize((tw, th), Image.BICUBIC), np.float32) / 255.0
    x = ((x - MEAN) / STD).transpose(2, 0, 1)[None]
    d = sess().run(None, {'pixel_values': x})[0][0]           # relative inverse depth, bigger = nearer
    lo, hi = np.percentile(d, 1), np.percentile(d, 99.5)
    d = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
    dm = Image.fromarray((d * 65535).astype(np.uint16)).resize((w, h), Image.BICUBIC)
    return dm
if __name__ == '__main__':
    for p in sys.argv[1:]:
        img = Image.open(p)
        dm = depth_of(img)
        out = p.rsplit('.', 1)[0] + '_depth.png'
        dm.save(out); print('depth', out)
