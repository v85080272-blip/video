# Final checks of a rendered episode: per-line Whisper on the full mix, loudness, mid-shot contact sheet.
# Usage: python3 check_final.py <final.mp4> <timeline.json> <script.json> <sheet.jpg>
import json, os, subprocess, sys, tempfile
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
os.environ.setdefault('VOX_HOME', '/home/user/work/voice/vox')
os.environ.setdefault('WHISPER_THREADS', '4')
import aud
from PIL import Image, ImageDraw, ImageFont

video, tl_p, script_p, sheet_p = sys.argv[1:5]
tl = json.load(open(tl_p))
texts = {l['id']: l['text'] for l in json.load(open(script_p))['lines']}
DIG = [('тысяча пятьсот восемнадцатом', '1518'), ('тысяча девятьсот восьмом', '1908'), ('шестьдесят пять', '65'),
       ('девятнадцать', '19'), ('тридцатого', '30'), ('девятьсот сорок шестом', '946'), ('двадцать', '20'),
       ('пять тысяч', '5000'), ('пять тысяч', '5 000'), ('пять тысяч', '5 тысяч'),
       ('три голубя и три воробья', '3 голубя и 3 воробья')]

# 1. intelligibility: each line cut from the final mix (voice + music + sfx)
worst = 0.0
with tempfile.TemporaryDirectory() as td:
    for lid, L in tl['lines'].items():
        a, b = max(0.0, L['start'] - 0.15), L['end'] + 0.25
        w = os.path.join(td, lid + '.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', video,
                        '-vn', '-ac', '1', '-ar', '16000', w], check=True)
        hyp = aud.asr(w)
        ref = texts[lid]
        refs = [ref] + [ref.replace(x, y) for x, y in DIG if x in ref]
        c = min(aud.cer(r, hyp) for r in refs)
        worst = max(worst, c)
        print(f'{lid:4s} CER {c:.3f} | {hyp}', flush=True)
print(f'worst CER {worst:.3f}')

# 2. loudness of the whole file
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                   capture_output=True, text=True)
summ = r.stderr[r.stderr.rfind('Summary:'):]
print(' '.join(summ.split()))

# 3. contact sheet: the middle of every shot, labelled with time and image id
tw, th = 216, 384
shots = tl['shots']
cols = 6
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 20)), (18, 18, 18))
dr = ImageDraw.Draw(sheet)
fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
with tempfile.TemporaryDirectory() as td:
    for i, s in enumerate(shots):
        t = (s['start'] + s['end']) / 2
        f = os.path.join(td, f'{i}.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1',
                        '-vf', f'scale={tw}:{th}', f], check=True)
        x, y = (i % cols) * tw, (i // cols) * (th + 20)
        sheet.paste(Image.open(f).convert('RGB'), (x, y))
        dr.text((x + 3, y + th + 3), f'{t:5.1f}s {s["img"][:22]}', fill=(230, 230, 230), font=fnt)
sheet.save(sheet_p, quality=80)
print('sheet ->', sheet_p)
