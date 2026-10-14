#!/usr/bin/env bash
# Keeps the VoxCPM2 TTS server (llama-tts-server, port 8099, 2 threads) up next to the image generator:
#  - before every (re)start waits until `free -m` shows >= 6.5 GB available AND the shared Bash memory cgroup
#    (limit 14.3 GB, sd-cli lives there too) has >= 6.5 GB headroom; re-checks every 50 s;
#  - runs the server with oom_score_adj 800 so that, if the cgroup ever runs out, the kernel kills the TTS
#    server (or whisper, 1000) instead of sd-cli; a killed server is restarted after the memory check.
# usage: nohup setsid bash serve.sh > serve.log 2>&1 &      stop: touch $VOICE/STOP_TTS; kill <server pid>
VOICE=/home/user/work/voice
VOX_HOME=$VOICE/vox
PORT=${PORT:-8099}
BIN=$VOX_HOME/src/llama.cpp-omni/build/bin/llama-tts-server
CG=/sys/fs/cgroup/memory/process_api/01a1366a-e5e1-716f-98df-7640a8c9001e/claude-code-bash
echo 900 > /proc/self/oom_score_adj
rm -f "$VOICE/STOP_TTS"

headroom_mb() {   # limit - (rss + shmem) of the shared cgroup, MB
  [ -r "$CG/memory.limit_in_bytes" ] || { echo 99999; return; }
  local lim rss shm
  lim=$(cat "$CG/memory.limit_in_bytes")
  rss=$(awk '$1=="total_rss"{print $2}' "$CG/memory.stat")
  shm=$(awk '$1=="total_shmem"{print $2}' "$CG/memory.stat")
  echo $(( (lim - rss - shm) / 1048576 ))
}

while [ ! -f "$VOICE/STOP_TTS" ]; do
  while :; do
    avail=$(free -m | awk '/^Mem:/{print $7}')
    head=$(headroom_mb)
    [ "$avail" -ge 6500 ] && [ "$head" -ge 6500 ] && break
    echo "$(date -u +%T) waiting for memory: available ${avail} MB, cgroup headroom ${head} MB"
    sleep 50
  done
  echo "$(date -u +%T) starting server (available ${avail} MB, cgroup headroom ${head} MB)"
  choom -n 800 -- "$BIN" --host 127.0.0.1 --port "$PORT" -t 2 \
    --voxcpm2-base-lm "$VOX_HOME/models/VoxCPM2-GGUF/VoxCPM2-BaseLM-Q8_0.gguf" \
    --voxcpm2-acoustic "$VOX_HOME/models/VoxCPM2-GGUF/VoxCPM2-Acoustic-F16.gguf" >> "$VOICE/tts-server.log" 2>&1 &
  echo $! > "$VOICE/tts-server.pid"
  wait $!
  echo "$(date -u +%T) server exited with code $?"
  sleep 5
done
echo "$(date -u +%T) STOP_TTS found, supervisor exits"
