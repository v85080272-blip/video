#!/bin/bash
M=/home/user/work/models/qwen3tts
B=/home/user/work/src/qwentts.cpp/build/qwen-tts
cd /home/user/work/voice2
python3 -c "
import json
for v in json.load(open('variants.json')): print(v['id'], v['seed'], v['instruct'], sep='\t')
" | while IFS=$'\t' read id seed instr; do
  [ -f "$id.wav" ] && continue
  $B --model $M/qwen-talker-1.7b-voicedesign-Q8_0.gguf --codec $M/qwen-tokenizer-12hz-Q8_0.gguf --instruct "$instr" --lang Russian --seed $seed -o $id.wav < sample.txt > $id.log 2>&1
  echo "done $id $(tail -1 $id.log)"
done
echo ALLDONE
