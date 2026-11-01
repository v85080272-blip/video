#!/bin/bash
# wait for the narrator takes to finish, then design Баба Валя's voice: several seeds of one description
cd /home/user/work/zombie/valya
until grep -q "CONT DONE" /home/user/work/zombie/voice/gen.log; do sleep 5; done
M=/home/user/work/models
B=/home/user/work/qwentts.cpp/build/qwen-tts
I1="Elderly Russian grandmother, about 78 years old, kind and warm voice, soft, slightly trembling and breathy, speaking gently and quietly, pleading, as if talking through a closed door at night"
I2="Old woman, 80 years old, sweet grandmotherly voice with a slight rasp, slow, tender, a little shaky, whispering kindly"
for v in "a 11 $I1" "a 12 $I1" "a 13 $I1" "a 14 $I1" "b 21 $I2" "b 22 $I2" "b 23 $I2" "b 24 $I2"; do
  set -- $v; id=$1$2; seed=$2; shift 2; instr="$*"
  [ -f "$id.wav" ] && continue
  QT_THREADS=4 $B --model $M/qwen-talker-1.7b-voicedesign-Q8_0.gguf --codec $M/qwen-tokenizer-12hz-Q8_0.gguf --instruct "$instr" --lang Russian --seed $seed -o $id.wav < text.txt > $id.log 2>&1
  echo "done $id $(tail -1 $id.log)"
done
echo ALLDONE
