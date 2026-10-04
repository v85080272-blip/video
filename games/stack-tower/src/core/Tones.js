// Sound design shared by the live game (Web Audio) and the video capture
// (offline WAV synth in scripts/capture.mjs), so the clip sounds like the game.

const PENTATONIC = [0, 2, 4, 7, 9];

function note(step, base = 523.25) {
  const octave = Math.floor(step / PENTATONIC.length);
  const semis = PENTATONIC[step % PENTATONIC.length] + 12 * octave;
  return base * Math.pow(2, semis / 12);
}

// Returns a list of partials: { at, freq, freqEnd, dur, gain, wave }.
export function tonesFor(ev) {
  if (ev.type === 'perfect') {
    const f = note(Math.min(ev.combo - 1, 11));
    return [
      { at: 0, freq: f, dur: 0.32, gain: 0.32, wave: 'triangle' },
      { at: 0, freq: f * 2, dur: 0.18, gain: 0.08, wave: 'sine' },
    ];
  }
  if (ev.type === 'cut') {
    const f = note(ev.floor % 5, 261.63);
    return [
      { at: 0, freq: f, dur: 0.16, gain: 0.3, wave: 'triangle' },
      { at: 0, freq: 90, freqEnd: 55, dur: 0.12, gain: 0.35, wave: 'sine' },
    ];
  }
  if (ev.type === 'fail') {
    return [
      { at: 0, freq: 330, freqEnd: 110, dur: 0.7, gain: 0.3, wave: 'square' },
      { at: 0.05, freq: 70, freqEnd: 40, dur: 0.6, gain: 0.45, wave: 'sine' },
    ];
  }
  if (ev.type === 'reveal') {
    return [0, 4, 7, 12].map((s, i) => ({
      at: i * 0.09, freq: 523.25 * Math.pow(2, s / 12), dur: 0.5, gain: 0.22, wave: 'triangle',
    }));
  }
  return [];
}
