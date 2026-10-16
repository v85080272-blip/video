#!/usr/bin/env bash
# One-time setup of the clip checks in a fresh container: Python packages and models into ~/.cache/qa.
#   bash qa/setup.sh            everything (about 3 GB of downloads, a few minutes)
#   bash qa/setup.sh --no-asr   without Whisper (no check that the voice says the script)
# Without Hugging Face access it copies the models from /mnt/project-files/models/qa-cache when that exists.
# Models: Russian wav2vec2 XLSR-53 letter recogniser (jonatasgrosman, Apache-2.0; ONNX export by onnx-community)
# with the stress head of meter2 (siriusfreak, Apache-2.0), Silero Stress 1.5 (MIT, converted to numpy here,
# torch not needed), faster-whisper large-v3-turbo (MIT). Revisions are pinned.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="${QA_CACHE:-$HOME/.cache/qa}"
ASR=1
[ "${1:-}" = "--no-asr" ] && ASR=0
mkdir -p "$CACHE"
PIP="python3 -m pip install -q --disable-pip-version-check"
py_has() { python3 -c "import $1" 2>/dev/null; }

echo "== packages"
py_has numpy || $PIP numpy
py_has onnxruntime || $PIP onnxruntime
py_has huggingface_hub || $PIP huggingface_hub
py_has onnx || $PIP onnx
if [ "$ASR" = 1 ]; then py_has faster_whisper || $PIP faster-whisper; fi
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing: apt-get install -y ffmpeg"; exit 1; }

# a thread whose network has no Hugging Face takes the models another thread left in the shared folder
SHARED_MODELS=/mnt/project-files/models/qa-cache
for f in meter/meter.onnx silero_stress/silero_stress.npz whisper-turbo/model.bin; do
  d="${f%%/*}"
  [ "$d" = whisper-turbo ] && [ "$ASR" = 0 ] && continue
  if [ -f "$SHARED_MODELS/$f" ] && [ ! -f "$CACHE/$f" ]; then
    echo "== $d from $SHARED_MODELS"
    mkdir -p "$CACHE/$d" && cp -r "$SHARED_MODELS/$d/." "$CACHE/$d/"
  fi
done

echo "== letter recogniser and stress head (1.3 GB)"
if [ ! -f "$CACHE/meter/meter.onnx" ] || [ ! -f "$CACHE/meter/head.npz" ]; then
  python3 - "$CACHE/meter" <<'EOF'
import sys
from huggingface_hub import hf_hub_download
d = sys.argv[1]
for f in ('vocab.json', 'onnx/model.onnx'):
    hf_hub_download('onnx-community/wav2vec2-large-xlsr-53-russian-ONNX', f, local_dir=d,
                    revision='df5ba1d9e0f9a34c44eec437b441f4ae43c842eb')
hf_hub_download('siriusfreak/qwen3-tts-12hz-1.7b-ru-stress-cf', 'meter/head.pt', local_dir=d,
                revision='c16b3af3db3095120efc1ebb73f6522442bcb3b1')
EOF
  python3 "$HERE/stress/meter.py" prepare "$CACHE/meter"
  rm -rf "$CACHE/meter/onnx"
fi

echo "== stress dictionary (Silero Stress, 40 MB)"
if [ ! -f "$CACHE/silero_stress/silero_stress.npz" ]; then
  T="$(mktemp -d)"
  python3 -m pip download -q --disable-pip-version-check --no-deps silero-stress==1.5 -d "$T"
  python3 - "$T" <<'EOF'
import glob, sys, zipfile
whl = glob.glob(sys.argv[1] + '/silero_stress-*.whl')[0]
with zipfile.ZipFile(whl) as z:
    open(sys.argv[1] + '/accentor.pt', 'wb').write(z.read('silero_stress/data/accentor.pt'))
EOF
  python3 "$HERE/stress/silero_np.py" "$T/accentor.pt" "$CACHE/silero_stress"
  rm -rf "$T"
fi

if [ "$ASR" = 1 ] && [ ! -f "$CACHE/whisper-turbo/model.bin" ]; then
  echo "== Whisper large-v3-turbo (1.6 GB)"
  python3 - "$CACHE/whisper-turbo" <<'EOF'
import sys
from huggingface_hub import snapshot_download
snapshot_download('mobiuslabsgmbh/faster-whisper-large-v3-turbo', local_dir=sys.argv[1])
EOF
fi

echo "== self-test"
python3 "$HERE/tests/selftest.py"
echo "ready: python3 $HERE/check_clip.py <clip.mp4> --text <script>"
