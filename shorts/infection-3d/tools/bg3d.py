# The picture track of the 3D test: the Blender frames of each shot (every other frame, 15 fps, 75 %) scaled to 1080×1920,
# interpolated to 30 fps, graded (a glow round the lights, cold shadows and warm highlights, a vignette, a little grain
# against banding in the dark), cut to the shot lengths from build/cues.json, with black after the last cut.
# usage: python3 tools/bg3d.py build/cues.json <render dir with f_s1 f_s2 f_s3> build/bg.mp4
import json
import os
import subprocess
import sys
import tempfile

FPS = 30
GRADE = ('split=2[a][b];[b]scale=270:480,colorlevels=rimin=0.55:gimin=0.55:bimin=0.55,gblur=sigma=10,scale=1080:1920[gl];'
         '[a][gl]blend=all_mode=screen:all_opacity=0.6,'
         'eq=contrast=1.07:saturation=0.86:gamma=0.95,'
         'colorbalance=rs=-0.04:bs=0.05:rh=0.04:gh=0.01:bh=-0.04,'
         'vignette=angle=PI/4.3,noise=alls=3:allf=t')


def run(cmd):
    subprocess.run(cmd, check=True)


def shot(src, n, out, tmp):
    frames = sorted(f for f in os.listdir(src) if f.endswith('.png'))
    seq = os.path.join(tmp, os.path.basename(src))
    os.makedirs(seq, exist_ok=True)
    for i, f in enumerate(frames):
        os.symlink(os.path.abspath(os.path.join(src, f)), os.path.join(seq, f'{i:04d}.png'))
    have = (len(frames) - 1) * 2 + 1
    assert have >= n, f'{src}: {have} frames at 30 fps, the shot needs {n}'
    vf = ('scale=1080:1920:flags=lanczos,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,' + GRADE)
    run(['ffmpeg', '-v', 'error', '-y', '-framerate', '15', '-i', os.path.join(seq, '%04d.png'), '-filter_complex', vf,
         '-frames:v', str(n), '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', out])


def main():
    cues, rdir, out = sys.argv[1:4]
    D = json.load(open(cues))
    M, dur = D['marks'], D['duration']
    edges = [0.0, M['c1'], M['c2'], M['black'], dur]
    fr = [round(e * FPS) for e in edges]
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for k, name in enumerate(('s1', 's2', 's3')):
            p = os.path.join(tmp, f'{name}.mp4')
            shot(os.path.join(rdir, f'f_{name}'), fr[k + 1] - fr[k], p, tmp)
            parts.append(p)
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
