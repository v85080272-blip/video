# Voice profile of a recording (a reference reel or a candidate voice), for matching voices without listening:
# pitch (median, spread), speaking rate, pauses, spectral tilt, background level between phrases, and the
# Qwen3-TTS speaker embedding (.spk, 2048 floats) for timbre similarity.
# Usage: python3 voice_profile.py <audio or video> <out_dir> [name]   -> <out_dir>/<name>.wav/.spk/.json
import json, os, re, subprocess, sys
import numpy as np
sys.path[:0] = ['/home/user/work/voice/shorts/voxcpm2/tools']
os.environ.setdefault('VOX_HOME', '/home/user/work/voice/vox')
import aud

M = '/home/user/work/models/qwen3tts'
CODEC = '/home/user/work/src/qwentts.cpp/build/qwen-codec'
VOWELS = set('аеёиоуыэюя')


def to_wav(src, dst, sr=24000):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', str(sr), '-c:a', 'pcm_s16le', dst],
                   check=True)


def speech_frames(x, sr, win=0.02):
    db, n = aud.frames_db(x, sr, win)
    top = np.percentile(db, 98)
    # floor: the quietest 10% of frames (music bed or room tone between phrases)
    floor = np.percentile(db, 10)
    thr = max(top - 30, floor + 8)
    return db > thr, db, top, floor, n


def ltas_tilt(x, sr):
    """Spectral tilt of loud frames: dB difference between 2-5 kHz and 100-1000 Hz (brighter voice -> higher)."""
    n = 1024
    fr = np.lib.stride_tricks.sliding_window_view(x, n)[::n // 2] * np.hanning(n)
    e = (fr ** 2).mean(1)
    fr = fr[e > np.percentile(e, 60)]
    sp = (np.abs(np.fft.rfft(fr, axis=1)) ** 2).mean(0)
    f = np.fft.rfftfreq(n, 1 / sr)
    lo = sp[(f >= 100) & (f < 1000)].mean()
    hi = sp[(f >= 2000) & (f < 5000)].mean()
    return float(10 * np.log10(hi / lo))


def chunked_asr(x, sr, sp, n, out_dir, name, target=8.0):
    """Whisper skips whole phrases on long clips, so cut at pauses into chunks of about 8 s."""
    win = n / sr
    cuts, last = [0], 0.0
    quiet = np.where(~sp)[0] * win
    for t in quiet:
        if t - last >= target:
            cuts.append(t); last = t
    cuts.append(len(x) / sr)
    texts = []
    for i, (a, b) in enumerate(zip(cuts[:-1], cuts[1:])):
        if b - a < 0.3:
            continue
        p = os.path.join(out_dir, f'{name}_chunk{i}.wav')
        aud.write_wav(p, x[int(a * sr):int(b * sr)], sr)
        texts.append(aud.asr(p))
        os.remove(p)
    return ' '.join(' '.join(texts).split())


def profile(src, out_dir, name=None, max_spk=20.0):
    os.makedirs(out_dir, exist_ok=True)
    name = name or os.path.splitext(os.path.basename(src))[0]
    wav = os.path.join(out_dir, name + '.wav')
    to_wav(src, wav)
    x, sr = aud.read_wav(wav)
    sp, db, top, floor, n = speech_frames(x, sr)
    win = n / sr
    speech_t = float(sp.sum() * win)
    # pauses: runs of non-speech frames between speech, longer than 150 ms
    idx = np.where(sp)[0]
    pauses = []
    if len(idx) > 1:
        gaps = np.diff(idx) - 1
        pauses = [g * win for g in gaps if g * win >= 0.15]
    f0 = aud.f0_track(x, sr)
    f0 = f0[(f0 > 60) & (f0 < 500)]
    text = chunked_asr(x, sr, sp, n, out_dir, name)
    syl = sum(ch in VOWELS for ch in text.lower())
    prof = dict(name=name, dur=round(len(x) / sr, 2), speech=round(speech_t, 2), text=text, syllables=syl,
                rate=round(syl / max(speech_t, 0.1), 2),
                pauses=len(pauses), pause_mean=round(float(np.mean(pauses)), 2) if pauses else 0.0,
                f0_med=round(float(np.median(f0)), 1) if len(f0) else None,
                f0_p10=round(float(np.percentile(f0, 10)), 1) if len(f0) else None,
                f0_p90=round(float(np.percentile(f0, 90)), 1) if len(f0) else None,
                tilt=round(ltas_tilt(x, sr), 1), floor_db=round(float(floor - top), 1))
    if prof['f0_med']:
        prof['f0_range_st'] = round(12 * np.log2(prof['f0_p90'] / prof['f0_p10']), 1)
    # speaker embedding from the first max_spk seconds of speech (the speaker encoder wants a clean clip)
    clip = os.path.join(out_dir, name + '_spk.wav')
    a = int(idx[0] * n) if len(idx) else 0
    aud.write_wav(clip, x[a:a + int(max_spk * sr)], sr)
    subprocess.run([CODEC, '--model', f'{M}/qwen-tokenizer-12hz-Q8_0.gguf', '--talker', f'{M}/qwen-talker-1.7b-base-Q8_0.gguf',
                    '-i', clip], capture_output=True, check=True)
    prof['spk'] = clip[:-4] + '.spk'
    json.dump(prof, open(os.path.join(out_dir, name + '.json'), 'w'), ensure_ascii=False, indent=1)
    return prof


if __name__ == '__main__':
    p = profile(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    print(json.dumps({k: v for k, v in p.items() if k != 'text'}, ensure_ascii=False))
    print(p['text'])
