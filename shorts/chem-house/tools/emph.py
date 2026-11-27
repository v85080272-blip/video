# Make one syllable's stress clearer in the assembled voice track: a gain on short spans, with 12 ms ramps, in place.
# «дыши́» (L5): in the take the «ы» is long and loud, the stressed «и» short — under the score the check hears дЫши.
# −6 dB on «ы», +5 dB on «и».
# usage: python3 tools/emph.py build/voice.wav   (spans below are in seconds of build/voice.wav; rerun after voice.py only)
import sys

import numpy as np
import soundfile as sf

SPANS = [(22.64, 22.78, -6.0),    # «дЫ» of «дыши» (L5)
         (22.81, 22.87, +5.0)]     # «шИ»


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
