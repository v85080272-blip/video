#!/usr/bin/env python3
"""End-to-end check on a made-up stream: no network, no Whisper needed.

A 4-minute 1080p "stream": moving fractal as the game, a face photo as the webcam in the bottom-left corner with a
white frame, voice-like noise with three screams, and a chat with spikes. The test expects the moments to be found
near the screams and chat spikes, the webcam to be found where it was put, and a 1080x1920 clip with subtitles.

  python3 clips/tests/selftest.py [--keep DIR] [--face face.png]
"""
import argparse
import json
import math
import os
import random
import subprocess
import sys
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import layout as L      # noqa: E402
import moments as M     # noqa: E402
import render as R      # noqa: E402
import subs as S        # noqa: E402

DUR = 240
SCREAMS = [(60, 63), (130, 133.5), (200, 204)]
CHAT_SPIKES = [65, 136, 170]          # 170: chat only
CAM = (60, 744, 492, 282)             # webcam box in the stream, with its frame
SR = 48000


def make_audio(path):
    rng = np.random.default_rng(1)
    n = DUR * SR
    t = np.arange(n) / SR
    game = rng.standard_normal(n) * 0.006
    # speech: band noise switched on and off at a syllable pace, in phrases with pauses
    band = np.convolve(rng.standard_normal(n), np.hanning(48), 'same')
    band -= np.convolve(band, np.ones(400) / 400, 'same')
    syll = (np.sin(2 * np.pi * 4.3 * t) > -0.2).astype(float)
    phrase = (np.sin(2 * np.pi * 0.21 * t + 1) > -0.5).astype(float)
    voice = band * syll * phrase * 0.035
    for a, b in SCREAMS:
        m = (t >= a) & (t < b)
        f0 = 520 + 80 * np.sin(2 * np.pi * 3 * t[m])
        ph = 2 * np.pi * np.cumsum(f0) / SR
        voice[m] = 0.32 * (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)) * (0.7 + 0.3 * np.sin(2 * np.pi * 5 * t[m]))
    x = np.clip(game + voice, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


def make_chat(path):
    rnd = random.Random(2)
    rows = []
    for s in range(DUR):
        rate = 1.5
        for c in CHAT_SPIKES:
            if 0 <= s - c < 8:
                rate = 14
        k = sum(1 for _ in range(40) if rnd.random() < rate / 40)
        for _ in range(k):
            spike = rate > 2
            text = rnd.choice(['KEKW', 'ахахахах', 'CLIP IT', 'ОРУ', 'жесть']) if spike else \
                rnd.choice(['привет', 'го дальше', 'какая машина?', 'норм', 'лол', 'когда pc версия'])
            rows.append([s + rnd.random(), text])
    with open(path, 'w', encoding='utf-8') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')


def make_video(face, wav, out):
    x, y, w, h = CAM
    inner_w, inner_h = w - 12, h - 12
    fc = (f'[1:v]crop=512:288:0:0,scale={inner_w + 60}:{inner_h + 34},'
          f"crop={inner_w}:{inner_h}:'30+24*sin(t*0.9)':'17+12*sin(t*1.3)',"
          f'pad={w}:{h}:6:6:white[cam];'
          f'[0:v]scale=1920:1080:flags=bicubic,hue=h=t*8[g];[g][cam]overlay={x}:{y}[v]')
    game = 'life=s=240x135:mold=10:rate=30:ratio=0.15:death_color=#1d2b3a:life_color=#7fbf3f'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', game,
                    '-loop', '1', '-framerate', '30', '-i', face, '-i', wav, '-filter_complex', fc,
                    '-map', '[v]', '-map', '2:a', '-t', str(DUR), '-c:v', 'libx264', '-preset', 'veryfast',
                    '-crf', '34', '-g', '60', '-c:a', 'aac', '-b:a', '128k', out], check=True)


def check(cond, msg):
    print(('ok    ' if cond else 'FAIL  ') + msg)
    return cond


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--keep', help='folder to keep the files in')
    ap.add_argument('--face', help='a photo with a face (default: astronaut from scikit-image)')
    a = ap.parse_args()
    d = a.keep or tempfile.mkdtemp(prefix='clips_test_')
    os.makedirs(d, exist_ok=True)
    face = a.face
    if not face:
        import cv2
        import skimage.data
        face = os.path.join(d, 'face.png')
        cv2.imwrite(face, cv2.cvtColor(skimage.data.astronaut(), cv2.COLOR_RGB2BGR))
    stream = os.path.join(d, 'stream.mp4')
    chatf = os.path.join(d, 'chat.jsonl')
    if not os.path.exists(stream):
        wav = os.path.join(d, 'audio.wav')
        make_audio(wav)
        make_video(face, wav, stream)
        os.remove(wav)
    make_chat(chatf)
    ok = True

    import chat as C
    chat = C.load(chatf)
    frames = M.loudness(stream)
    sig, raw = M.signals(DUR, frames, chat, None, lag=5)
    ms, _ = M.pick(DUR, sig, raw, top=4, length=30, skip_start=20, frames=frames)
    M.summary(ms)
    events = [(a + b) / 2 for a, b in SCREAMS] + [c - 5 + 3 for c in CHAT_SPIKES[2:]]
    for e in events:
        ok &= check(any(m['start'] <= e <= m['end'] for m in ms), f'момент около {e:.0f} с найден')
    for m in ms:
        ok &= check(25 <= m['end'] - m['start'] <= 35, f'момент {m["n"]}: длина {m["end"] - m["start"]:.1f} с')

    cam = L.detect_cam(stream, 50, 80, debug_jpg=os.path.join(d, 'cam.jpg'))
    print('  вебка:', cam, 'на самом деле:', CAM)
    good = cam and all(abs(p - q) <= 24 for p, q in zip(cam, CAM))
    ok &= check(bool(good), 'вебка найдена с точностью до 24 px')

    # subtitles without Whisper: made-up word timings
    S.transcribe = lambda wav, model='small', lang=None: [
        {'start': 1.0 + i * 0.35, 'end': 1.3 + i * 0.35, 'word': w} for i, w in
        enumerate('ну всё блять меня сбили на мотоцикле прямо у полиции, ахахах!'.split())]
    for lay in ('split', 'blur'):
        out = os.path.join(d, f'clip_{lay}.mp4')
        m = ms[0]
        R.render(stream, m['start'], m['end'] - m['start'], out, os.path.join(d, 'work'), layout=lay,
                 title='КОГДА ЗАШЁЛ В GTA 6 В ПЕРВЫЙ РАЗ', credit='twitch.tv/streamer', mat=True)
        pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', out],
                                       capture_output=True, check=True).stdout)
        v = next(s for s in pr['streams'] if s['codec_type'] == 'video')
        ok &= check((v['width'], v['height']) == (1080, 1920), f'{lay}: кадр {v["width"]}×{v["height"]}')
        ok &= check(any(s['codec_type'] == 'audio' for s in pr['streams']), f'{lay}: есть звук')
        snap = os.path.join(d, f'clip_{lay}.jpg')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '2.4', '-i', out, '-frames:v', '1', snap], check=True)
    # the swear word (3rd made-up word, 1.70-2.00 s) is covered by the 1 kHz beep
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(d, 'clip_split.mp4'), '-ac', '1', '-ar', '16000',
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, '<i2').astype(float)[int(1.72 * 16000):int(1.98 * 16000)]
    sp, fr = np.abs(np.fft.rfft(x)), np.fft.rfftfreq(len(x), 1 / 16000)
    ok &= check(sp[(fr > 900) & (fr < 1100)].sum() / sp.sum() > 0.8, 'мат в звуке запикан')
    ass = open(os.path.join(d, 'work', 'clip_split.ass'), encoding='utf-8').read()
    ok &= check('Б***Ь' in ass and 'БЛЯТЬ' not in ass, 'мат в субтитрах замаскирован')
    print('\nфайлы:', d)
    print('ВСЁ ХОРОШО' if ok else 'ЕСТЬ ОШИБКИ')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
