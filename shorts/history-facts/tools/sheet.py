# Contact sheet of generated shots: python3 sheet.py <shots dir> <out.jpg> [cols]
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
fs = sorted(f for f in glob.glob(os.path.join(d, '*.png')) if '_depth' not in f and '_unused' not in f)
tw, th = 256, 448
rows = (len(fs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
try:
    fnt = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except Exception:
    fnt = ImageFont.load_default()
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((tw, th))
    x, y = (i % cols) * tw, (i // cols) * (th + 22)
    sheet.paste(im, (x, y))
    dr.text((x + 4, y + th + 3), os.path.basename(f)[:-4], fill=(230, 230, 230), font=fnt)
sheet.save(out, quality=82)
print(len(fs), 'shots ->', out)
