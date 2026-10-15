# Give every line of an episode the reference narrator's tonal balance: one match-EQ curve per voice, measured on
# all its lines together, applied to each line (timing preserved), word manifest copied along.
# Usage: python3 eq_lines.py <lines dir with L*.wav + manifest.json> <out dir>
import glob, json, os, shutil, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice4/tools']
import match_eq

src, dst = sys.argv[1:3]
os.makedirs(dst, exist_ok=True)
lines = sorted(glob.glob(os.path.join(src, 'L*.wav')), key=lambda p: int(os.path.basename(p)[1:-4]))
g = match_eq.curve(lines)
json.dump({str(c): round(float(v), 1) for c, v in zip(match_eq.CENTERS, g)}, open(os.path.join(dst, 'eq_curve.json'), 'w'))
for p in lines:
    match_eq.apply(p, os.path.join(dst, os.path.basename(p)), g)
for f in ('manifest.json',):
    if os.path.exists(os.path.join(src, f)):
        shutil.copy(os.path.join(src, f), os.path.join(dst, f))
print('eq', ' '.join(f'{c}:{v:+.0f}' for c, v in zip(match_eq.CENTERS, g)))
print(len(lines), 'lines ->', dst)
