#!/bin/bash
# Timeline + audio mix (voice, music, sounds) of the dance episode for one voice folder, no video frames.
# usage: make_mix.sh <voice dir> <name> [gaps json]
set -euo pipefail
cd /home/user/work/render
export EPISODE=dance1518 SHOTS_DIR=/home/user/work/ep2/shots VOICE_DIR=$1 VOICE_SPEED=1.0 TL_PATH=/home/user/work/voice5/tl_$2.json
if [ -n "${3:-}" ]; then export GAPS_JSON=$3; fi
python3 film.py timeline | tail -1
python3 mix.py "$TL_PATH" /home/user/work/voice5/mix_$2.wav
