# takes/lines.json for ../voice/scripts/manifest.py, from the scores that score_takes.py wrote.
# usage: python3 takes_meta.py <takes dir> [voice name, default v5]
import json, os, re, sys

TAKES = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else 'v5'
sc = json.load(open(os.path.join(TAKES, 'scores.json')))
out = {}
for fn, s in sc.items():
    m = re.match(r'(L\d+)_s(\d+)\.wav$', fn)
    if not m:
        continue
    out[fn[:-4]] = dict(seed=int(m.group(2)), cfg=None, tts=f'Qwen3-TTS 1.7B Base, ICL clone of ref/{VOICE}.wav',
                        cer=s.get('cer'), utmos=s.get('utmos'), sim=s.get('sim'))
json.dump(dict(sorted(out.items())), open(os.path.join(TAKES, 'lines.json'), 'w'), ensure_ascii=False, indent=1)
print(len(out), 'takes')
