#!/bin/bash
# VoiceDesign casting: every (instruct, seed) reads sample.txt -> cast/<id>.wav
M=/home/user/work/models/qwen3tts
B=/home/user/work/src/qwentts.cpp/build/qwen-tts
cd /home/user/work/voice3 && mkdir -p cast
python3 -c "
import json
for v in json.load(open('variants.json')): print(v['id'], v['seed'], v['instruct'], sep='\t')
" | while IFS=$'\t' read id seed instr; do
  [ -f cast/$id.wav ] && continue
  QT_THREADS=4 $B --model $M/qwen-talker-1.7b-voicedesign-Q8_0.gguf --codec $M/qwen-tokenizer-12hz-Q8_0.gguf --instruct "$instr" --lang Russian --seed $seed -o cast/$id.wav < sample.txt > cast/$id.log 2>&1
  echo "done $id $(tail -1 cast/$id.log)"
done
echo ALLDONE
