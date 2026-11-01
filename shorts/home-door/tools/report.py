# A look at a mix without listening: momentary loudness of the score, the effects and the mix over time with the cues
# marked, a spectrogram, and per cue how loud the effect is against the score around it. Writes a PNG next to the mix.
# usage: python3 tools/report.py build/cues.json build/music.wav build/mix.wav
import json
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf
from scipy import signal

from mix import momentary, lufs, true_peak_db, SR


def main():
    cues_path, music_path, mix_path = sys.argv[1:4]
    D = json.load(open(cues_path))
    music = sf.read(music_path, always_2d=True)[0].T
    mix = sf.read(mix_path, always_2d=True)[0].T
    n = mix.shape[1]
    music = music[:, :n] * 10 ** ((lufs(mix) - lufs(music[:, :n])) / 20)    # on the mix's scale (approximately)
    lv = json.load(open(mix_path.replace('.wav', '_levels.json')))
    mm, mx = momentary(music), momentary(mix)
    t = np.arange(n) / SR
    step = 480
    fig, ax = plt.subplots(2, 1, figsize=(22, 9), sharex=True, gridspec_kw=dict(height_ratios=[1.2, 1]))
    ax[0].plot(t[::step], mx[::step], lw=1.2, color='#222', label='mix')
    ax[0].plot(t[::step], mm[::step], lw=1, color='#2a7', label='score (scaled)')
    for c in D['cues']:
        ax[0].axvline(c['t'], color='#d55', lw=0.5, alpha=0.5)
        ax[0].text(c['t'], -12, c['name'], rotation=90, fontsize=6, va='top', color='#a33')
    ax[0].set_ylim(-60, -5); ax[0].set_ylabel('momentary LUFS'); ax[0].legend(loc='lower left'); ax[0].grid(alpha=0.3)
    f, tt_, S = signal.spectrogram(mix.mean(0), SR, nperseg=2048, noverlap=1536)
    ax[1].pcolormesh(tt_, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-120, vmax=-40)
    ax[1].set_yscale('symlog', linthresh=200); ax[1].set_ylim(30, 16000); ax[1].set_xlabel('s')
    ax[1].set_xticks(np.arange(0, n / SR + 0.01, 0.5))
    plt.tight_layout()
    png = mix_path.replace('.wav', '_report.png')
    plt.savefig(png, dpi=80)
    print(f'mix {lufs(mix):.2f} LUFS, true peak {true_peak_db(mix):.2f} dBTP → {png}')


if __name__ == '__main__':
    main()
