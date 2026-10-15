# Match the loudness of a voice folder (L*.wav, one gain for all lines) to another, by integrated LUFS of the
# lines played back to back, so the voice sits against the music exactly like in the current video.
# usage: python3 lufs_match.py <reference lines dir> <lines dir to adjust (in place)>
import glob, json, os, re, subprocess, sys, tempfile
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud


def lufs(d):
    with tempfile.TemporaryDirectory() as td:
        lst = os.path.join(td, 'l.txt')
        open(lst, 'w').write(''.join(f"file '{p}'\n" for p in sorted(glob.glob(d + '/L*.wav'))))
        r = subprocess.run(['ffmpeg', '-nostats', '-f', 'concat', '-safe', '0', '-i', lst, '-af', 'ebur128', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1])


ref, tgt = sys.argv[1:3]
a, b = lufs(ref), lufs(tgt)
g = a - b
for p in glob.glob(tgt + '/L*.wav'):
    x, sr = aud.read_wav(p)
    y = x * 10 ** (g / 20)
    pk = np.abs(y).max()
    if pk > 0.95:
        y *= 0.95 / pk
    aud.write_wav(p, y, sr)
print(f'ref {a:.1f} LUFS, before {b:.1f}, gain {g:+.1f} dB, after {lufs(tgt):.1f}')
