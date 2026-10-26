# Put re-voiced takes into an episode without touching its other lines: chosen take -> export (-20 dBFS) ->
# word manifest -> the episode's saved match-EQ curve (lines_eq/eq_curve.json) -> lines_eq, ready to render.
# usage: python3 swap_lines.py <voice id> <episode voice dir with takes/ lines/ lines_eq/ lines_cfg.json> L12=L12_s14[,L13=...]
import json, os, shutil, subprocess, sys, tempfile
sys.path[:0] = ['/home/user/work/voice4/tools']
import match_eq

V, D = sys.argv[1], sys.argv[2]
picks = dict(p.split('=') for p in sys.argv[3].split(','))
T2 = '/home/user/work/voice2/tools'
VOX = '/home/user/work/voice/shorts/voxcpm2/tools'
MAN = '/home/user/work/voice/scripts/manifest.py'
env = dict(os.environ, VOX_HOME='/home/user/work/voice/vox', WHISPER_THREADS='4')

cfg_p = f'{D}/lines_cfg.json'
cfg = json.load(open(cfg_p))
cfg['chosen'].update(picks)
json.dump(cfg, open(cfg_p, 'w'), ensure_ascii=False, indent=1)
subprocess.run(['python3', f'{T2}/takes_meta.py', f'{D}/takes', V], check=True, env=env)
with tempfile.TemporaryDirectory() as td:
    only = os.path.join(td, 'cfg.json')
    json.dump(dict(cfg, chosen={k: cfg['chosen'][k] for k in picks}), open(only, 'w'), ensure_ascii=False)
    subprocess.run(['python3', f'{VOX}/export.py', only, f'{D}/takes', f'{D}/lines', '-20'], check=True, env=env)
subprocess.run(['python3', MAN, cfg_p, f'{D}/takes', f'{D}/lines', ','.join(picks)], check=True, env=env)
curve = json.load(open(f'{D}/lines_eq/eq_curve.json'))
g = [curve[str(c)] for c in match_eq.CENTERS]
for lid in picks:
    match_eq.apply(f'{D}/lines/{lid}.wav', f'{D}/lines_eq/{lid}.wav', g)
shutil.copy(f'{D}/lines/manifest.json', f'{D}/lines_eq/manifest.json')
print('swapped', picks, '->', f'{D}/lines_eq')
