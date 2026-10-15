# Soft tonal touch for the narrator lines (voice round 4): the series match-EQ curve at half strength, no compressor,
# so the voice keeps some of the reference's dense bass and bright top without the "radio" artificiality.
# The curve is saved, already halved, in voice5/dance_s1/eq_curve_soft.json: voice4/tools/match_eq.py measured it
# against the reference reels, whose audio stays out of the repo.
# usage: python3 soft_eq.py <cut dir> <out dir> [curve json]
import glob, json, os, shutil, subprocess, sys

src, dst = sys.argv[1:3]
curve_p = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dance_s1',
                                                             'eq_curve_soft.json')
curve = json.load(open(curve_p))
os.makedirs(dst, exist_ok=True)
e = ';'.join(f'entry({c},{v:.1f})' for c, v in curve.items())
# firequalizer delays the signal by its 20 ms window: trimmed, so the word times in manifest.json stay valid
chain = f"highpass=f=60,firequalizer=gain_entry='{e}':delay=0.02:accuracy=4,atrim=start=0.02,asetpts=PTS-STARTPTS"
for p in sorted(glob.glob(os.path.join(src, 'L*.wav'))):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-af', chain, '-ar', '48000',
                    os.path.join(dst, os.path.basename(p))], check=True)
for f in ('manifest.json', 'gaps.json'):
    if os.path.exists(os.path.join(src, f)):
        shutil.copy(os.path.join(src, f), os.path.join(dst, f))
json.dump(curve, open(os.path.join(dst, 'eq_curve.json'), 'w'))
print('soft eq', os.path.normpath(curve_p), '->', dst)
