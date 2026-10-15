# Match the tonal balance of a voice to the reference narrator (a "match EQ"): per 1/3-octave band, the
# difference between the reference's long-term spectrum and the voice's, smoothed and limited, applied with
# ffmpeg firequalizer, then gentle compression like a radio voice chain.
# Usage: python3 match_eq.py <voice.wav (or several, comma-separated, to measure)> <out.wav> [in.wav to process]
import json, subprocess, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice4/tools']
from ltas_cmp import bands, CENTERS

REF = ['/home/user/work/refreels/out/ref_excerpt_a.wav', '/home/user/work/refreels/out/a_head.wav',
       '/home/user/work/refreels/out/reel_a.wav']
LO, HI = -6.0, 12.0


def target():
    return np.nanmean([bands(p)[0] for p in REF], axis=0)


def curve(voice_paths):
    v = np.nanmean([bands(p)[0] for p in voice_paths], axis=0)
    d = target() - v
    d = np.convolve(np.pad(d, 1, mode='edge'), np.ones(3) / 3, mode='valid')   # smooth over neighbouring bands
    d[np.array(CENTERS) > 8000] = np.minimum(d[np.array(CENTERS) > 8000], 6.0)  # codec has little up there: don't lift hiss
    d = np.clip(d, LO, HI)
    d[np.array(CENTERS) >= 3150] -= 2.0     # after compression the top end measures ~2 dB brighter than the target
    return d


def chain(g):
    entries = ';'.join(f'entry({c},{v:.1f})' for c, v in zip(CENTERS, g))
    # firequalizer delays the signal by its 20 ms window and alimiter by its lookahead: trim / compensate both,
    # so word timings (captions, cuts) stay valid
    return (f"highpass=f=60,firequalizer=gain_entry='{entries}':delay=0.02:accuracy=4,atrim=start=0.02,asetpts=PTS-STARTPTS,"
            "acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=2,alimiter=limit=0.89:latency=1")


def apply(src, dst, g):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', chain(g), '-ar', '48000', dst], check=True)


if __name__ == '__main__':
    voices = sys.argv[1].split(',')
    out = sys.argv[2]
    src = sys.argv[3] if len(sys.argv) > 3 else voices[0]
    g = curve(voices)
    print(json.dumps({str(c): round(float(v), 1) for c, v in zip(CENTERS, g)}))
    apply(src, out, g)
