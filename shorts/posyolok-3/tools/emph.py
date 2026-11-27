# Make one syllable's stress clearer in the assembled voice track: a gain on short spans, with 12 ms ramps, in place.
# The take of «на двери́» (L5) has the stressed «и» quieter than the «е» before it: alone it reads дверИ (0.82),
# but under the engine and the score the stress check hears двЕри. +6 dB on «и» and −3 dB on «е» → дверИ (0.85) in the mix.
# usage: python3 tools/emph.py build/voice.wav   (spans below are in seconds of build/voice.wav; rerun after voice.py only)
import sys

import numpy as np
import soundfile as sf

SPANS = [(24.865, 24.995, -3.0),    # «двЕ» of «двери» (L5)
         (25.035, 25.155, +6.0)]    # «рИ»


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
