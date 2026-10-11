#!/usr/bin/env bash
# VoxCPM2 (OpenBMB, Apache-2.0) on CPU without PyPI: llama.cpp-omni + GGUF weights from Hugging Face,
# whisper.cpp for checking every take. Needs git, cmake, a C++ compiler, curl; network: github.com, huggingface.co, *.hf.co.
# usage: VOX_HOME=~/voxcpm2 bash setup.sh
set -euo pipefail
VOX_HOME=${VOX_HOME:-$HOME/voxcpm2}
mkdir -p "$VOX_HOME"/src "$VOX_HOME"/models/VoxCPM2-GGUF "$VOX_HOME"/models/whisper
cd "$VOX_HOME"/src

[ -d llama.cpp-omni ] || git clone --depth 1 https://github.com/tc-mb/llama.cpp-omni.git
# LLAMA_OPENSSL=OFF: with OpenSSL the TTS server becomes an HTTPS server without a certificate and cannot bind.
cmake -S llama.cpp-omni -B llama.cpp-omni/build -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON \
  -DLLAMA_CURL=OFF -DLLAMA_OPENSSL=OFF -DLLAMA_BUILD_TESTS=OFF
cmake --build llama.cpp-omni/build -j"$(nproc)" --target voxcpm2-cli llama-tts-server

[ -d whisper.cpp ] || git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git
cmake -S whisper.cpp -B whisper.cpp/build -G Ninja -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON -DWHISPER_BUILD_TESTS=OFF -DWHISPER_SDL2=OFF
cmake --build whisper.cpp/build -j"$(nproc)" --target whisper-cli

get() {  # repo file dir sha256
  [ -f "$3/$2" ] && echo "$4  $3/$2" | sha256sum -c --quiet && return
  curl -sS -L --retry 10 --retry-delay 5 -C - -o "$3/$2" "https://huggingface.co/$1/resolve/main/$2"
  echo "$4  $3/$2" | sha256sum -c
}
G="$VOX_HOME"/models/VoxCPM2-GGUF
get DennisHuang648/VoxCPM2-GGUF VoxCPM2-BaseLM-Q8_0.gguf "$G" 0113177abd11303503bf0b705e1613ec5f0a8508cc74a7dfd0f99312b962a962
get DennisHuang648/VoxCPM2-GGUF VoxCPM2-Acoustic-F16.gguf "$G" 5bde898488ad635ff55d24da53543768fa33d5e5cdc538ce190e5ef831038e85
get ggerganov/whisper.cpp ggml-large-v3-turbo-q8_0.bin "$VOX_HOME"/models/whisper 317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1
echo "ready: $VOX_HOME"
