#!/bin/bash
# Full build: timeline -> frames -> mix -> mux. Usage: assemble.sh <out.mp4>
set -euo pipefail
OUT=${1:-/home/user/work/render/tunguska.mp4}
cd /home/user/work/render
python3 film.py video "$OUT"
python3 mix.py /home/user/work/render/timeline.json /home/user/work/render/mix.wav
SILENT="${OUT%.mp4}_silent.mp4"
ffmpeg -y -loglevel error -i "$SILENT" -i /home/user/work/render/mix.wav -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
