#!/usr/bin/env python3
"""Проверка сценария до озвучки: где голос может ошибиться в ударении, и текст, подготовленный для движка.

    python3 qa/check_text.py сценарий.json [--engine qwen3|voxcpm2|rhvoice|silero] [--out текст_для_голоса.txt]

Печатает омографы с неуверенным выбором, слова-ловушки, слова, где ошибается сам словарь Silero, и слова, в которых
наш голос уже ошибался (qa/known_errors.json). Для RHVoice и Silero TTS в тексте для голоса стоят «+» перед ударными
гласными (RHVoice берёт их только с languages.Russian.stress_marker=+ в RHVoice.conf), для Qwen3-TTS и VoxCPM2 —
только «ё» (знаки им мешают): рискованные слова там лучше заменить.
"""
import argparse, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, 'stress'), HERE]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('script')
    ap.add_argument('--engine', default='any', choices=['qwen3', 'voxcpm2', 'rhvoice', 'silero', 'any'])
    ap.add_argument('--out')
    a = ap.parse_args(argv)
    from check_clip import read_script
    from silero_np import SileroStress
    from textcheck import analyze_text
    text, src = read_script(a.script)
    T = analyze_text(text, SileroStress(), engine=a.engine)
    print(f'Сценарий: {src}. Движок: {a.engine}. {T["note"]}'.strip())
    if T['risky']:
        print('\nПроверьте до озвучки:')
        for r in T['risky']:
            print(f"  {r['display']}: {'; '.join(r['reasons'])}")
    else:
        print('\nРискованных слов нет.')
    if T['traps']:
        print('\nСлова-ловушки (обычно голос справляется, но послушайте): ' + ', '.join(t['display'] for t in T['traps']))
    if a.out:
        open(a.out, 'w', encoding='utf-8').write(T['tts_text'] + '\n')
        print(f'\nТекст для голоса: {a.out}')
    else:
        print('\nТекст для голоса:\n' + T['tts_text'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
