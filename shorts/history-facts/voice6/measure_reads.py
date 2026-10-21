# Pitch, intonation range, length and UTMOS of the №7 readings (and the sample) for the listening page.
import json, os, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice4/tools', '/home/user/work/voice2/tools', '/home/user/work/voice/shorts/voxcpm2/tools']
import aud
from mos import ut

J = '/home/user/work/voice6/reads_measure.json'
out = json.load(open(J)) if os.path.exists(J) else {}
for name, p in [a.split('=', 1) for a in sys.argv[1:]]:
    x, sr = aud.read_wav(p)
    f0 = aud.f0_track(x, sr)
    f0 = f0[(f0 > 60) & (f0 < 500)]
    out[name] = dict(f0=round(float(np.median(f0)), 1),
                     range=round(float(12 * np.log2(np.percentile(f0, 90) / np.percentile(f0, 10))), 1),
                     dur=round(len(x) / sr, 1), mos=round(float(ut(p)), 2))
    print(name, out[name], flush=True)
json.dump(out, open(J, 'w'), indent=1)
