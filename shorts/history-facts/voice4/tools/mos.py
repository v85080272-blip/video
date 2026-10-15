# UTMOS (naturalness 1-5, no listening) for a list of wav files. Usage: python3 mos.py a.wav b.wav ...
import os, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice2/tools', '/home/user/work/voice/shorts/voxcpm2/tools']
os.environ.setdefault('VOX_HOME', '/home/user/work/voice/vox')
import aud, score


def ut(path):
    x = score.load16(path)
    a, b = aud.trim_bounds(x, 16000)
    y = x[a:b]
    if len(y) > 16000 * 8:
        return float(score.utmos(y)[0])
    if score._sess is None:
        score.utmos(np.zeros(16000 * 3, np.float32))
    return float(score._sess.run(None, {'wave': y[None].astype(np.float32)})[0][0])


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(f'{ut(p):.2f}  {os.path.basename(p)}', flush=True)
