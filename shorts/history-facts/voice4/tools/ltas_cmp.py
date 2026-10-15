# 1/3-octave long-term spectrum of speech frames (minus the music/room bed measured in pauses), relative to the
# 250-1000 Hz level, so voices can be compared by tonal balance. Usage: python3 ltas_cmp.py a.wav b.wav ...
import sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
import aud

CENTERS = [100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000]


def bands(path, sr_t=24000):
    x, sr = aud.read_wav(path)
    n = 2048
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::n // 4] * np.hanning(n)
    e = 10 * np.log10((fr ** 2).mean(1) + 1e-20)
    sp = np.abs(np.fft.rfft(fr, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    top, floor = np.percentile(e, 98), np.percentile(e, 10)
    # speech-active frames by a fixed level threshold (a percentile split would shift after EQ, when sibilant
    # frames get louder), minus the music/room bed measured in the quietest frames
    loud = sp[e > max(top - 35, floor + 10)].mean(0)
    bed = sp[e < floor + 3].mean(0)
    voice = np.maximum(loud - bed, loud * 0.05)
    out = []
    for c in CENTERS:
        m = (f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))
        out.append(10 * np.log10(voice[m].mean() + 1e-20) if m.any() else np.nan)
    out = np.array(out)
    ref = np.nanmean(out[[4, 5, 6, 7, 8, 9, 10]])
    return out - ref, 10 * np.log10(loud.sum() / bed.sum())


if __name__ == '__main__':
    print('band Hz   ' + ' '.join(f'{c:>6}' for c in CENTERS))
    for p in sys.argv[1:]:
        b, snr = bands(p)
        print(f'{p.split("/")[-1][:18]:18s} ' + ' '.join(f'{v:6.1f}' for v in b) + f'   bed {snr:.0f} dB')
