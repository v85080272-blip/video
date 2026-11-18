# Make one syllable's stress clearer in the assembled voice track: a gain on short spans, with 12 ms ramps, in place.
# «уходи́» (L4): the first «у» of the take is the loudest syllable — alone the check hears уходИ, under the score Уходи (doubt).
# −5 dB on «у», +4 dB on «ди» → no warning in the mix.
# usage: python3 tools/emph.py build/voice.wav   (spans below are in seconds of build/voice.wav; rerun after voice.py only)
import sys

import numpy as np
import soundfile as sf

SPANS = [(22.78, 22.90, -5.0),    # «У» of «уходи» (L4)
         (23.11, 23.29, +4.0)]     # «дИ»


def main():
    path = sys.argv[1]
    x, sr = sf.read(path)
    t = np.arange(len(x)) / sr
    g = np.zeros(len(x))
    for a, b, db in SPANS:
        g += db * np.clip(np.minimum((t - a) / 0.012 + 1, (b - t) / 0.012 + 1), 0, 1)
    k = 10 ** (g / 20)
    sf.write(path, x * (k[:, None] if x.ndim > 1 else k), sr, subtype=sf.info(path).subtype)


if __name__ == '__main__':
    main()
