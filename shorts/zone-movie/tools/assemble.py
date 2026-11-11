# Puts «Зона: 5 походов» together: the drawn frame (build/base.mp4, node render.mjs), the intro montage and the five
# episodes in the centre column at their times (build/timeline.json), the intro's top layer (the hook and the subtitles,
# build/top.mov), the sound (build/mix.wav) → out/zona-5-pohodov.mp4.
# usage: python3 tools/assemble.py
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
TL = json.load(open(os.path.join(ROOT, 'build/timeline.json')))
x, y, w, h = TL['center']
args = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', 'build/base.mp4', '-i', 'build/top.mov']
parts = []
for c in TL['clips']:
    args += ['-ss', f"{c['s0']:.3f}", '-t', f"{c['dur']:.3f}", '-i', c['src']]; parts.append(c['t0'])
for s in TL['segs']:
    if s['kind'] == 'ep':
        args += ['-t', f"{s['trim']:.3f}", '-i', s['file']]; parts.append(s['t0'])
args += ['-i', 'build/mix.wav']
f, last = [], '0:v'
for i, t0 in enumerate(parts):
    f.append(f'[{i + 2}:v]scale={w}:{h}:flags=lanczos,setpts=PTS-STARTPTS+{t0:.3f}/TB[c{i}]')
    f.append(f'[{last}][c{i}]overlay={x}:{y}:eof_action=pass[b{i}]'); last = f'b{i}'
f.append(f'[{last}][1:v]overlay=0:0:eof_action=pass,format=yuv420p[v]')
args += ['-filter_complex', ';'.join(f), '-map', '[v]', '-map', f'{len(parts) + 2}:a',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', '30', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
         '-t', f"{TL['dur']:.3f}", '-movflags', '+faststart', 'out/zona-5-pohodov.mp4']
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
subprocess.run(args, cwd=ROOT, check=True)
print('→ out/zona-5-pohodov.mp4')
