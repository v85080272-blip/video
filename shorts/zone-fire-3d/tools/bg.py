# The picture track of «Рыжий лес» (3D): the Blender frames of each shot (every 2nd or 3rd frame, 66 %) scaled to 1080×1920,
# interpolated to 30 fps, graded for daylight (a soft glow round the brightest things, cool shadows, warm highlights, a vignette,
# a little grain against banding in the dark) and cut to the shot lengths from build/cues.json.
# usage: python3 tools/bg.py build/cues.json <render dir with f_A … f_K> build/bg.mp4
import json
import os
import subprocess
import sys
import tempfile

FPS = 30
STEP = {}                                   # from build/cues.json (marks.step, as src/main.js renders them)
# by day: a soft glow only round the brightest things (the sky over the arch, the lamp), a little more contrast and
# colour than the haze leaves, cool shadows and warm highlights, a light vignette and grain
LIFT = {}      # «Лес горит»: one day, one grade (no 1986 film look)
NOVIG = set()
GRADE = ('format=gbrp,split=2[a][b];[b]scale=270:480,colorlevels=rimin=0.82:gimin=0.82:bimin=0.82,gblur=sigma=12,scale=1080:1920[gl];'
         '[a][gl]blend=all_mode=screen:all_opacity=0.35,'
         'colorbalance=rs=-0.03:bs=0.05:rm=-0.01:bm=0.02:rh=0.04:gh=0.01:bh=-0.03,format=yuv444p,'
         'eq=contrast=1.12:saturation=1.08:gamma=0.97,'
         'vignette=angle=PI/5.0,noise=alls=2:allf=t')


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
    shots = D['marks']['shots']; STEP.update(D['marks']['step'])
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
