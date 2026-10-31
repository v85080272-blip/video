#!/bin/bash
# Cast the narrator with Qwen3-TTS VoiceDesign (no cloning): each description × seed reads the whole script in one pass.
# Descriptions: voice/narrator_prompts.tsv (id <tab> English description). Version 2 uses p4 seed 1 («уставший выживший»).
# usage: bash voice/narrator_takes.sh [<id> <seed> ...]     (default: the eight takes cast for version 2)
cd "$(dirname "$0")"
export M=/home/user/work/models
export B=/home/user/work/qwentts.cpp/build/qwen-tts
export OUT=/home/user/work/zombie/voice2
one() {
  pid=$1; seed=$2
  instr=$(awk -F'\t' -v p="$pid" '$1==p {print $2}' narrator_prompts.tsv)
  id=${pid}s${seed}
  [ -f $OUT/takes/$id.wav ] && return
  python3 -c "import json, sys; sys.stdout.write('\n'.join(l['text'] for l in json.load(open('script.json'))['lines']))" |
    QT_THREADS=2 $B --model $M/qwen-talker-1.7b-voicedesign-Q8_0.gguf --codec $M/qwen-tokenizer-12hz-Q8_0.gguf \
      --instruct "$instr" --lang Russian --seed $seed -o $OUT/takes/$id.wav > $OUT/logs/$id.log 2>&1
  echo "$id done (exit $?)"
}
export -f one
mkdir -p $OUT/takes $OUT/logs
jobs=("$@"); [ ${#jobs[@]} -eq 0 ] && jobs=(p1 1 p2 1 p3 1 p1 2 p2 2 p4 1 p5 1 p2 3)
printf "%s %s\n" "${jobs[@]}" | xargs -P 2 -L 1 bash -c 'one $0 $1'   # two at a time: ~5.6 GB RAM each
