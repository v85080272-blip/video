# The picture track of «По крышам»: the Blender frames of each shot (every 2nd or 3rd frame, 66 %) scaled to 1080×1920,
# interpolated to 30 fps, graded like the 3D test (a glow round the lights, cold shadows and warm highlights, a vignette,
# a little grain against banding in the dark) and cut to the shot lengths from build/cues.json.
# usage: python3 tools/bg.py build/cues.json <render dir with f_A … f_G> build/bg.mp4
import json
import os
import subprocess
import sys
import tempfile

FPS = 30
STEP = {'A': 3, 'B': 2, 'C': 2, 'D': 2, 'E': 2, 'F': 3, 'G': 3}
# shot A is the hook, and the three on our roof sit in its upper corner: a little lift and no vignette there
LIFT = {'A': 'eq=gamma=1.18:brightness=0.015,'}
NOVIG = {'A'}
GRADE = ('format=gbrp,split=2[a][b];[b]scale=270:480,colorlevels=rimin=0.55:gimin=0.55:bimin=0.55,gblur=sigma=10,scale=1080:1920[gl];'
         '[a][gl]blend=all_mode=screen:all_opacity=0.6,'
         'colorbalance=rs=-0.05:bs=0.07:rm=-0.02:bm=0.03:rh=0.05:gh=0.01:bh=-0.03,format=yuv444p,'
         'eq=contrast=1.08:saturation=0.9:gamma=0.95,'
         'vignette=angle=PI/4.0,noise=alls=3:allf=t')


def run(cmd):
    subprocess.run(cmd, check=True)


def shot(src, step, n, out, tmp):
    frames = sorted(f for f in os.listdir(src) if f.endswith('.png'))
    seq = os.path.join(tmp, os.path.basename(src))
    os.makedirs(seq, exist_ok=True)
    for i, f in enumerate(frames):
        os.symlink(os.path.abspath(os.path.join(src, f)), os.path.join(seq, f'{i:04d}.png'))
    have = (len(frames) - 1) * step + 1
    assert have >= n, f'{src}: {have} frames at 30 fps, the shot needs {n}'
    name = os.path.basename(src)[2:]
    grade = GRADE.replace(',vignette=angle=PI/4.0', '') if name in NOVIG else GRADE
    vf = f'scale=1080:1920:flags=lanczos,minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,' + LIFT.get(name, '') + grade
    run(['ffmpeg', '-v', 'error', '-y', '-framerate', f'{FPS}/{step}', '-i', os.path.join(seq, '%04d.png'), '-filter_complex', vf,
         '-frames:v', str(n), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', out])


def main():
    cues, rdir, out = sys.argv[1:4]
    D = json.load(open(cues))
    shots = D['marks']['shots']
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for name, t0, t1 in shots:
            n = round(t1 * FPS) - round(t0 * FPS)
            p = os.path.join(tmp, f'{name}.mp4')
            shot(os.path.join(rdir, f'f_{name}'), STEP[name], n, p, tmp)
            parts.append(p); print('shot', name, n, 'frames')
        lst = os.path.join(tmp, 'list.txt')
        open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out])
    print('bg →', out)


if __name__ == '__main__':
    main()
