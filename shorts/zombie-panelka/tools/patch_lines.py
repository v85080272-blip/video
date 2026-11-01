# Replace some lines of a cut narration with the same lines cut from re-read takes (a wrong stress fixed by a new take).
# The base and every patch are cut dirs from cut_voice.py; a patch's breath replaces the base breath of that line.
# usage: python3 patch_lines.py <base cut dir> <out dir> <line id>=<patch cut dir> [...]
import json
import os
import shutil
import sys

base, out = sys.argv[1:3]
patches = dict(a.split('=', 1) for a in sys.argv[3:])
os.makedirs(out, exist_ok=True)
for f in os.listdir(base):
    if f.endswith('.wav') or f in ('words.json', 'gaps.json', 'report.json'):
        shutil.copy(os.path.join(base, f), out)
words = json.load(open(os.path.join(base, 'words.json')))
report = json.load(open(os.path.join(base, 'report.json')))
for lid, src in patches.items():
    shutil.copy(os.path.join(src, f'{lid}.wav'), out)
    if os.path.exists(os.path.join(out, f'B_{lid}.wav')):
        os.remove(os.path.join(out, f'B_{lid}.wav'))
    if os.path.exists(os.path.join(src, f'B_{lid}.wav')):
        shutil.copy(os.path.join(src, f'B_{lid}.wav'), out)
    words[lid] = json.load(open(os.path.join(src, 'words.json')))[lid]
    report[lid] = dict(json.load(open(os.path.join(src, 'report.json')))[lid], patch=os.path.abspath(src))
    print(lid, '←', src, report[lid])
json.dump(words, open(os.path.join(out, 'words.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(report, open(os.path.join(out, 'report.json'), 'w'), ensure_ascii=False, indent=1)
