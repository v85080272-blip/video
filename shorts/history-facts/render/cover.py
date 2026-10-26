"""Cover 1080x1920 = first frame of the video (same layout as film.draw_cover)."""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import film
from engine import Cam, warp, to_np, grade, bloom, vignette, TextLayer, W, H


def make_cover(out_path, variant='A'):
    tl = film.build_timeline()
    if variant == 'B':
        tl['cover']['lines'] = film.EP.COVER_B
    film._init_worker(tl)
    frame = film.render_frame(0, tl)
    Image.fromarray(frame).save(out_path, quality=95)
    print('cover', out_path)


if __name__ == '__main__':
    make_cover(sys.argv[1] if len(sys.argv) > 1 else '/home/user/work/render/cover.jpg',
               sys.argv[2] if len(sys.argv) > 2 else 'A')
