#!/bin/bash
# Full build: timeline -> frames -> mix -> mux. Usage: [EPISODE=dance1518] assemble.sh <out.mp4>
set -euo pipefail
EP=${EPISODE:-tunguska}
export EPISODE=$EP
OUT=${1:-/home/user/work/render/$EP.mp4}
cd /home/user/work/render
if [ "$EP" = tunguska ]; then
  TL=${TL_PATH:-/home/user/work/render/timeline.json}; MIX=/home/user/work/render/mix.wav
else
  TL=${TL_PATH:-/home/user/work/render/timeline_$EP.json}; MIX=/home/user/work/render/mix_$EP.wav
fi
export TL_PATH=$TL
python3 film.py video "$OUT"
python3 mix.py "$TL" "$MIX"
SILENT="${OUT%.mp4}_silent.mp4"
ffmpeg -y -loglevel error -i "$SILENT" -i "$MIX" -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
