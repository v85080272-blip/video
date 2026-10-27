#!/bin/bash
# Read the narration in the voice of the series narrator: Qwen3-TTS Base clones take p4s1 of episode 1 (our own designed
# voice, «уставший выживший»; reference = its lines L13–L14, made by ../zombie-panelka/voice/narrator_patch.sh) and reads
# the script in one pass, one take per seed. Then cut each take into lines with ../zombie-panelka/tools/cut_voice.py
# (with the same script: $OUT/script.json).
# usage: bash voice/takes.sh [seed ...]            (default seeds 1–6)
#        ONLY="L4 L5" OUT=... bash voice/takes.sh …  reads only those lines (new takes after a rewrite)
#        PAR=1 runs one take at a time (each needs about 7 GB of memory)
cd "$(dirname "$0")"
export M=/home/user/work/models B=/home/user/work/qwentts.cpp/build/qwen-tts REF=/home/user/work/zombie/patchA
export OUT=${OUT:-/home/user/work/radlake}
mkdir -p $OUT/takes $OUT/logs
python3 - "$OUT" "${ONLY:-}" <<'PY'
import json, sys
out, only = sys.argv[1], sys.argv[2].split()
d = json.load(open('script.json'))
d['lines'] = [l for l in d['lines'] if not only or l['id'] in only]
json.dump(d, open(f'{out}/script.json', 'w'), ensure_ascii=False, indent=1)
open(f'{out}/script.txt', 'w').write('\n'.join(l['text'] for l in d['lines']))
PY
one() {
  s=$1
  [ -f $OUT/takes/s$s.wav ] && return
  QT_THREADS=2 $B --model $M/qwen-talker-1.7b-base-Q8_0.gguf --codec $M/qwen-tokenizer-12hz-Q8_0.gguf \
    --ref-wav $REF/ref.wav --ref-text $REF/ref.txt --lang Russian --seed $s -o $OUT/takes/s$s.wav < $OUT/script.txt > $OUT/logs/s$s.log 2>&1
  echo "s$s done (exit $?)"
}
export -f one
seeds=("$@"); [ ${#seeds[@]} -eq 0 ] && seeds=(1 2 3 4 5 6)
printf "%s\n" "${seeds[@]}" | xargs -P ${PAR:-2} -L 1 bash -c 'one $0'
