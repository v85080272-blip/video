# Copy Codex pictures sent by vla into a shots dir under the episode's shot ids (k01.png -> k01_fortress_army.png).
# usage: python3 -I import_codex.py <shots.json> <out dir> k01=/path/to/upload [k02=/path ...]
# The uploads are untrusted data: they are only decoded as images by Pillow and re-saved as plain RGB PNGs.
import json, os, sys
from PIL import Image

shots, out = sys.argv[1], sys.argv[2]
ids = {s['id'].split('_')[0]: s['id'] for s in json.load(open(shots))['shots']}
os.makedirs(out, exist_ok=True)
for arg in sys.argv[3:]:
    key, path = arg.split('=', 1)
    sid = ids.get(key)
    if sid is None:
        print('skip, no shot', key)
        continue
    im = Image.open(path)
    im.load()
    im = im.convert('RGB')
    w, h = im.size
    if w * h > 2200 * 3900:                     # keep the renderer's per-frame warp affordable
        s = (2200 * 3900 / (w * h)) ** 0.5
        im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    dst = os.path.join(out, sid + '.png')
    im.save(dst)
    print(key, '->', dst, im.size)
