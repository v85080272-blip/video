#!/usr/bin/env bash
# Final channel art from the chosen stills (see README.md). OUT defaults to ./out.
set -euo pipefail
cd "$(dirname "$0")"
G=${GEN_OUT:-/home/user/work/gen/branding}
OUT=${OUT:-out}
mkdir -p "$OUT"
# the stills: SDXL Lightning, 5 steps, seeds as in prompts.json
GEN_OUT=$G python3 gen.py prompts.json av_storyteller_close --seeds 62
GEN_OUT=$G python3 gen.py prompts.json bnp_skyline --seeds 201
# avatar: centred hooded storyteller, extra warm light from the lamp flame under the beard
python3 compose.py avatar "$G/av_storyteller_close_s62.png" "$OUT/avatar-800.png" \
  --zoom 1.06 --cx 0.5 --cy 0.52 --light 0.49,0.86,0.55,0.55
# banner: pyramids at both sides, quiet sky in the middle for the title
python3 compose.py banner "$G/bnp_skyline_s201.png" "$OUT/banner-2560x1440.jpg" --focus 0.47 --variant B
python3 compose.py preview "$OUT/banner-2560x1440.jpg" "$OUT/avatar-800.png" "$OUT"
