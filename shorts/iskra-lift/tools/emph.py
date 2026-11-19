# Make one syllable's stress clearer in the assembled voice track: a gain on short spans, with 12 ms ramps, in place.
# «откры́ть» (L7): in the take the first «о» is 3 dB louder than the stressed «ы» — under the score the check hears Открыть.
# −6 dB on «о», +5 dB on «ы».
# usage: python3 tools/emph.py build/voice.wav   (spans below are in seconds of build/voice.wav; rerun after voice.py only)
import sys

import numpy as np
import soundfile as sf

SPANS = [(38.83, 38.95, -6.0),    # «О» of «открыть» (L7)
         (39.07, 39.19, +5.0)]     # «ЫТЬ»


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
