# Minimal stand-in for the soundfile package: read/write/info for PCM WAV, numpy only.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
import numpy as np
import aud


class _Info:
    def __init__(self, frames, sr):
        self.frames, self.samplerate, self.duration = frames, sr, frames / sr


def read(path, dtype='float64', always_2d=False):
    x, sr = aud.read_wav(path, mono=False)
    return x.astype(dtype), sr


def write(path, data, samplerate, subtype='PCM_16'):
    aud.write_wav(path, np.asarray(data, float), samplerate, bits=24 if subtype == 'PCM_24' else 16)


def info(path):
    x, sr = aud.read_wav(path)
    return _Info(len(x), sr)
