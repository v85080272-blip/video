# Minimal stand-in for scipy.ndimage 1-D filters (mode='reflect' == numpy 'symmetric', origin=0).
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view


def _pad(x, size):
    left = size // 2
    return np.pad(np.asarray(x, float), (left, size - left - 1), mode='symmetric')


def maximum_filter1d(x, size):
    return sliding_window_view(_pad(x, size), size).max(axis=1)


def uniform_filter1d(x, size):
    c = np.concatenate([[0.0], np.cumsum(_pad(x, size))])
    return (c[size:] - c[:-size]) / size
