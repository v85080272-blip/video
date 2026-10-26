# Caption word times from the stress meter (a forced alignment of the script's own letters, thread «Проверка
# ударений и звука», /mnt/project-files/qa) instead of whisper's: whisper drops or merges words now and then (Everest v2:
# its «удивились» swallowed «что я здесь», so those captions would have come after the line ended).
# Rewrites the times of script_words in <cut dir>/manifest.json; whisper's transcript and CER stay as they were.
# usage: python3 manifest_meter.py <cut dir> <script.json>     (after manifest_cut.py, before soft_eq.py)
import difflib, json, os, re, sys
sys.path[:0] = [os.path.join(os.environ.get('QA_DIR', '/mnt/project-files/qa'), 'stress')]
from meter import Meter, CONF_MIN  # noqa: E402
from check import load_audio  # noqa: E402

D, SCRIPT = sys.argv[1:3]
mp = os.path.join(D, 'manifest.json')
man = json.load(open(mp))
M = Meter()


def norm(w):
    return re.sub(r'[^0-9a-zа-я]', '', w.lower().replace('ё', 'е'))


for l in json.load(open(SCRIPT))['lines']:
    lid = l['id']
    sw = man[lid]['script_words']
    R = [r for r in M.judge(load_audio(os.path.join(D, f'{lid}.wav')), l['text'])
         if r['start'] is not None and r['align'] is not None and r['align'] >= CONF_MIN]
    a = [norm(w['word']) for w in sw]
    b = [norm(r['word']) for r in R]
    moved, kept = [], 0
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if tag != 'equal':
            kept += i2 - i1
            continue
        for k in range(i2 - i1):
            w, r = sw[i1 + k], R[j1 + k]
            moved.append(abs(w['start'] - r['start']))
            w.update(start=r['start'], end=r['end'], src='meter')
    worst = max(moved) if moved else 0.0
    print(f'{lid}: {len(moved)} words timed by the meter (largest shift {worst:.2f} s), {kept} kept from whisper')
json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
