# Render the shots of «Мёртвый город» one after another, each as long as src/main.js cuts it (build/cues.json: marks.nf frames,
# every marks.step-th frame, the flashes at marks.ev): a restarted run skips the frames already on disk.
# usage: python3 blender/shots.py build/cues.json <render dir> [shots, e.g. ABC] [percent 66] [samples 10]
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PY = '/home/user/work/bpyenv/bin/python'
cues, rdir = sys.argv[1], sys.argv[2]
only = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != '-' else None
pct = sys.argv[4] if len(sys.argv) > 4 else '66'
samples = sys.argv[5] if len(sys.argv) > 5 else '10'
SAMPLES = {'F': '14', 'H': '14', 'G': '12'}             # indoors, the basement, the pit: more bounces to settle
M = json.load(open(cues))['marks']
for name, t0, t1 in M['shots']:
    if only and name not in only:
        continue
    nf, step = M['nf'][name], M['step'][name]
    env = dict(os.environ, EV=','.join(str(x) for x in M['ev'].get(name, [])))
    out = os.path.join(rdir, f'f_{name}')
    print(f'== {name}: {nf} frames, every {step}', flush=True)
    subprocess.run([PY, os.path.join(HERE, 'pripyat.py'), name, f'{nf / 30:.6f}', out, pct, SAMPLES.get(name, samples), str(step)], env=env, check=True)
print('SHOTS DONE', flush=True)
