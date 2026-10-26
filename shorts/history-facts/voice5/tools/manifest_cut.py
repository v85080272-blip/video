# manifest.json (words with times for captions and cuts) for lines cut from a continuous read (cut_cont.py),
# through the usual voice/scripts/manifest.py.
# usage: python3 manifest_cut.py <cut dir> <script.json> <take name>
import json, os, subprocess, sys, tempfile

D, SCRIPT, TAKE = sys.argv[1:4]
S = json.load(open(SCRIPT))
alts = S.get('alts', {})
cfg = dict(lines={l['id']: dict(who='N', text=l['text'], alts=alts.get(l['id'], [])) for l in S['lines']},
           chosen={l['id']: f"{l['id']}_{TAKE}" for l in S['lines']})
with tempfile.TemporaryDirectory() as td:
    json.dump(cfg, open(f'{td}/cfg.json', 'w'), ensure_ascii=False)
    os.makedirs(f'{td}/takes')
    json.dump({f"{l['id']}_{TAKE}": dict(seed=None, cfg=None, tts=f'Qwen3-TTS 1.7B Base, continuous read {TAKE}')
               for l in S['lines']}, open(f'{td}/takes/lines.json', 'w'))
    subprocess.run(['python3', '/home/user/work/voice/scripts/manifest.py', f'{td}/cfg.json', f'{td}/takes', D], check=True,
                   env=dict(os.environ, VOX_HOME='/home/user/work/voice/vox', WHISPER_THREADS='4'))
