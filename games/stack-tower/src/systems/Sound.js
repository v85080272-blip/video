import { tonesFor } from '../core/Tones.js';
import { gameState } from '../core/GameState.js';

let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function playEvent(ev) {
  if (!ctx || gameState.isMuted) return;
  const now = ctx.currentTime;
  for (const p of tonesFor(ev)) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const t0 = now + p.at;
    osc.type = p.wave;
    osc.frequency.setValueAtTime(p.freq, t0);
    if (p.freqEnd) osc.frequency.exponentialRampToValueAtTime(p.freqEnd, t0 + p.dur);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(p.gain, t0 + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + p.dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + p.dur + 0.02);
  }
}
