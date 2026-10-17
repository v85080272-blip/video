#!/bin/bash
# Re-read the narrator lines whose stress was wrong, in the same voice: clone take p4s1 with the Qwen3-TTS Base model
# (ICL; reference = its own L13–L14) and read each line with its neighbour for context, four seeds each.
# «Внизу — они» read as Они in every seed once the score was under it, so L17 became «Внизу — зомби» (L17z, six seeds).
# Cut each take with tools/cut_voice.py and a two-line script, let the stress check pick, then tools/patch_lines.py.
# usage: bash voice/narrator_patch.sh
set -e
W=/home/user/work/zombie/patchA; M=/home/user/work/models; B=/home/user/work/qwentts.cpp/build/qwen-tts
mkdir -p $W/takes $W/logs && cd $W
python3 - <<'PY'
import json, soundfile as sf
sp = json.load(open('/home/user/work/zombie/voice2/c_p4s1/spans.json'))['lines']
x, sr = sf.read('/home/user/work/zombie/voice2/takes/p4s1.wav')
sf.write('ref.wav', x[int((sp['L13'][0] - 0.05) * sr):int((sp['L14'][1] + 0.1) * sr)], sr, subtype='PCM_16')
open('ref.txt', 'w').write('Четвёртое. Тревожный рюкзак. Фонарик, аптечка, пауэрбанк, еда на три дня.')
PY
printf '%s' 'Второе. Стань невидимым. Задёрни шторы, выключи свет, телефон на беззвучный.' > text_L8.txt
printf '%s' 'Третье. Вода. Набери ванну, кастрюли, бутылки. Без света насосы встанут, и воды не будет.' > text_L12.txt
printf '%s' 'Пятое. Путь отхода. Лифт — ловушка. Внизу — зомби.' > text_L17z.txt
for ks in 'L8 1 2 3 4' 'L12 1 2 3 4' 'L17z 1 2 3 4 5 6'; do set -- $ks; k=$1; shift; for s in "$@"; do
  [ -f takes/${k}_s$s.wav ] || QT_THREADS=4 $B --model $M/qwen-talker-1.7b-base-Q8_0.gguf --codec $M/qwen-tokenizer-12hz-Q8_0.gguf \
    --ref-wav ref.wav --ref-text ref.txt --lang Russian --seed $s -o takes/${k}_s$s.wav < text_$k.txt > logs/${k}_s$s.log 2>&1
done; done
echo "used in version 2: L8 seed 1, L12 seed 3, L17 seed 1"
