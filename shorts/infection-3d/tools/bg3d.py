# The picture track of the 3D test: the Blender frames of each shot (every other frame, 15 fps, 75 %) scaled to 1080×1920,
# interpolated to 30 fps, dusted, graded (a glow round the lights, cold shadows and warm highlights, a vignette, a little
# grain against banding in the dark), cut to the shot lengths from build/cues.json, with black after the last cut.
# The lift shot has real haze and dust from Blender (f_s2v, VOL=1); its volume noise gets a light temporal denoise. The
# other two get dust here: motes at different depths (near ones big and out of focus), drifting, lit only where the frame
# itself is lit — in the torch beam, down the shaft.
# usage: python3 tools/bg3d.py build/cues.json <render dir with f_s1 f_s2[v] f_s3> build/bg.mp4
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

FPS, W, H = 30, 1080, 1920
# in RGB (gbrp): the glow is a screen blend of the blurred highlights, which in YUV would tint the whole frame
GRADE = ('format=gbrp,split=2[a][b];[b]scale=270:480,colorlevels=rimin=0.6:gimin=0.6:bimin=0.6,gblur=sigma=10,scale=1080:1920[gl];'
         '[a][gl]blend=all_mode=screen:all_opacity=0.55,'
         'colorbalance=rs=-0.05:bs=0.06:rm=-0.02:bm=0.02:rh=0.04:gh=0.01:bh=-0.03,format=yuv444p,'
         'eq=contrast=1.1:saturation=0.85:gamma=0.88:brightness=-0.02,'
         'vignette=angle=PI/4.0,noise=alls=3:allf=t')


def run(cmd):
    subprocess.run(cmd, check=True)


class Dust:
    """motes in screen space: depth z 0 (near, big, soft) … 1 (far, a point); each drifts and twinkles a little, and is
    as bright as the light around it in the frame (a blurred luminance map), so the dark stays dark"""

    def __init__(self, n, seed, fall=(0.0, 0.0), inward=0.0, gain=1.0):
        r = np.random.default_rng(seed)
        self.z = r.uniform(0, 1, n) ** 0.7
        self.x, self.y = r.uniform(-40, W + 40, n), r.uniform(-40, H + 40, n)
        sp = 4 + 14 * (1 - self.z)                                         # px per second: near ones move more
        self.vx = r.normal(0, 1, n) * sp + fall[0] * (1 - self.z)
        self.vy = r.normal(0, 1, n) * sp + fall[1] * (1 - self.z)
        self.ph, self.om = r.uniform(0, 6.28, n), r.uniform(1.0, 3.0, n)
        self.inward, self.gain = inward, gain
        self.rad = 1.7 + 12.0 * (1 - self.z) ** 2.2                         # sprite radius
        self.pk = (0.55 + 0.45 * self.z) * r.uniform(0.6, 1.0, n)          # soft near ones are dimmer at the peak
        self.spr = {}

    def sprite(self, rad):
        k = round(rad * 2) / 2
        if k not in self.spr:
            s = int(np.ceil(k * 2.6)) + 1
            yy, xx = np.mgrid[-s:s + 1, -s:s + 1]
            d = np.sqrt(xx ** 2 + yy ** 2) / max(k, 0.6)
            self.spr[k] = np.clip(np.exp(-d ** 2 * 1.6) * 1.15 - 0.03, 0, 1) if k > 3 else np.exp(-d ** 2 * 2.2)
        return self.spr[k]

    def apply(self, img, t):
        f = img.astype(np.float32)
        lum = (0.3 * f[..., 0] + 0.59 * f[..., 1] + 0.11 * f[..., 2])[::16, ::16] / 255.0
        lum = smooth(lum, 4)
        cx, cy = W / 2, H / 2
        x = self.x + self.vx * t + self.inward * (cx - self.x) * t * (1 - self.z)
        y = self.y + self.vy * t + self.inward * (cy - self.y) * t * (1 - self.z)
        add = np.zeros((H, W), np.float32)
        for i in range(len(x)):
            xi, yi = int(x[i]), int(y[i])
            if not (0 <= xi < W and 0 <= yi < H):
                continue
            L = lum[min(lum.shape[0] - 1, yi // 16), min(lum.shape[1] - 1, xi // 16)]
            a = self.gain * self.pk[i] * np.clip((L - 0.3) / 0.45, 0, 1) ** 1.2 * (0.75 + 0.25 * np.sin(self.om[i] * t + self.ph[i]))
            if a < 0.01:
                continue
            sp = self.sprite(self.rad[i]); s = sp.shape[0] // 2
            y0, y1, x0, x1 = max(0, yi - s), min(H, yi + s + 1), max(0, xi - s), min(W, xi + s + 1)
            add[y0:y1, x0:x1] += a * sp[y0 - yi + s:y1 - yi + s, x0 - xi + s:x1 - xi + s]
        add = np.minimum(add, 1.2)[..., None] * np.array([255, 246, 230], np.float32)
        return np.clip(f + add * (1 - f / 320), 0, 255).astype(np.uint8)


def smooth(a, r):
    k = np.exp(-np.arange(-2 * r, 2 * r + 1) ** 2 / (2 * r * r)); k /= k.sum()
    a = np.apply_along_axis(lambda v: np.convolve(np.pad(v, 2 * r, mode='edge'), k, 'valid'), 0, a)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, 2 * r, mode='edge'), k, 'valid'), 1, a)


def shot(src, n, out, tmp, dust=None, pre=''):
    frames = sorted(f for f in os.listdir(src) if f.endswith('.png'))
    seq = os.path.join(tmp, os.path.basename(src))
    os.makedirs(seq, exist_ok=True)
    for i, f in enumerate(frames):
        os.symlink(os.path.abspath(os.path.join(src, f)), os.path.join(seq, f'{i:04d}.png'))
    have = (len(frames) - 1) * 2 + 1
    assert have >= n, f'{src}: {have} frames at 30 fps, the shot needs {n}'
    vf = 'scale=1080:1920:flags=lanczos,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' + (',' + pre if pre else '')
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-framerate', '15', '-i', os.path.join(seq, '%04d.png'), '-vf', vf,
                            '-frames:v', str(n), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                            '-filter_complex', GRADE, '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', out],
                           stdin=subprocess.PIPE)
    k = 0
    while True:
        buf = dec.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        if dust:
            img = dust.apply(img, k / FPS)
        enc.stdin.write(img.tobytes())
        k += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    assert k == n, f'{src}: {k} frames out, {n} wanted'


def main():
    cues, rdir, out = sys.argv[1:4]
    D = json.load(open(cues))
    M, dur = D['marks'], D['duration']
    edges = [0.0, M['c1'], M['c2'], M['black'], dur]
    fr = [round(e * FPS) for e in edges]
    have = lambda d, n: os.path.isdir(os.path.join(rdir, d)) and len(os.listdir(os.path.join(rdir, d))) >= n
    # the hazy renders (VOL=1: real haze, dust and depth of field) when they are complete; otherwise the plain ones with 2D dust
    s1 = 'f_s1v' if have('f_s1v', 49) else 'f_s1'
    s2 = 'f_s2v' if have('f_s2v', 49) else 'f_s2'
    s3 = 'f_s3v' if have('f_s3v', 71) else 'f_s3'
    plan = [(s1, None if s1 == 'f_s1v' else Dust(200, 1, fall=(0, 4), inward=0.04, gain=1.7), ''),     # falling slowly down the shaft
            (s2, None, 'colorlevels=rimin=0.40:gimin=0.40:bimin=0.40,hqdn3d=1.5:1.5:5:5' if s2 == 'f_s2v' else ''),   # the haze lifts the blacks: put them back
            (s3, None if s3 == 'f_s3v' else Dust(220, 3, fall=(2, 2), gain=1.9), 'colorlevels=rimin=0.15:gimin=0.15:bimin=0.15,hqdn3d=1.5:1.5:5:5' if s3 == 'f_s3v' else '')]
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for k, (src, dust, pre) in enumerate(plan):
            p = os.path.join(tmp, f's{k + 1}.mp4')
            shot(os.path.join(rdir, src), fr[k + 1] - fr[k], p, tmp, dust, pre)
            parts.append(p)
            print('shot', k + 1, src, fr[k + 1] - fr[k], 'frames')
        p = os.path.join(tmp, 'black.mp4')
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=black:s=1080x1920:r={FPS}', '-frames:v', str(fr[4] - fr[3]),
             '-c:v', 'libx264', '-crf', '10', '-pix_fmt', 'yuv420p', p])
        parts.append(p)
        lst = os.path.join(tmp, 'list.txt')
        open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out])
    print('bg', fr, '→', out)


if __name__ == '__main__':
    main()
