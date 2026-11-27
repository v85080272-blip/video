# cut a figure out of a reference sheet: the background is the light paper colour connected to the crop's border
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, out, x0, y0, x1, y1 = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
im = np.asarray(Image.open(src).convert('RGB')).astype(np.int32)[y0:y1, x0:x1]
bg = np.median(np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]]), axis=0)
near = np.abs(im - bg).sum(2) < 40
lab, n = ndimage.label(near)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
back = np.isin(lab, list(border))
# enclosed holes of plain paper (between an arm and the body) are background too
paper = np.abs(im - bg).sum(2) < 18
hl, hn = ndimage.label(paper & ~back)
if hn:
    hs = ndimage.sum(paper & ~back, hl, range(1, hn + 1))
    hole = int(sys.argv[7]) if len(sys.argv) > 7 else 250
    back |= np.isin(hl, [i + 1 for i, s_ in enumerate(hs) if s_ > hole])
fg = ~back
fg = ndimage.binary_opening(fg, iterations=1)
keep, k = ndimage.label(fg); sizes = ndimage.sum(fg, keep, range(1, k + 1))
fg = np.isin(keep, [i + 1 for i, s in enumerate(sizes) if s > 400])      # drop specks and stray text
alpha = ndimage.gaussian_filter(fg.astype(float), 0.6)
rgba = np.dstack([im.astype(np.uint8), (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
ys, xs = np.where(alpha > 0.05)
Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).save(out)
print(out, xs.max() - xs.min(), ys.max() - ys.min())
