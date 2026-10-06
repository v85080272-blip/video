// Song mode and instrument voices for the hit sounds: every hit can play
// the next note of a well-known tune instead of a pentatonic step.
// Only public-domain melodies, one MIDI note per hit; the hits make the rhythm.

export const MELODIES = [
  { id: 'pentatonic', name: 'Пентатоника', notes: null },
  {
    id: 'korobeiniki',
    name: 'Коробейники (Тетрис)',
    notes: [
      // E5 B4 C5 D5 C5 B4 A4 A4 C5 E5 D5 C5 B4 C5 D5 E5 C5 A4 A4
      76, 71, 72, 74, 72, 71, 69, 69, 72, 76, 74, 72, 71, 72, 74, 76, 72, 69, 69,
      // D5 F5 A5 G5 F5 E5 C5 E5 D5 C5 B4 B4 C5 D5 E5 C5 A4 A4
      74, 77, 81, 79, 77, 76, 72, 76, 74, 72, 71, 71, 72, 74, 76, 72, 69, 69,
    ],
  },
  {
    id: 'ode',
    name: 'Ода к радости',
    notes: [
      // E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 E5 D5 D5
      76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74, 76, 76, 74, 74,
      // E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 D5 C5 C5
      76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74, 76, 74, 72, 72,
      // D5 D5 E5 C5 D5 E5 F5 E5 C5 D5 E5 F5 E5 D5 C5 D5 G4
      74, 74, 76, 72, 74, 76, 77, 76, 72, 74, 76, 77, 76, 74, 72, 74, 67,
      // E5 E5 F5 G5 G5 F5 E5 D5 C5 C5 D5 E5 D5 C5 C5
      76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74, 76, 74, 72, 72,
    ],
  },
  {
    id: 'elise',
    name: 'К Элизе',
    notes: [
      // E5 D#5 E5 D#5 E5 B4 D5 C5 A4
      76, 75, 76, 75, 76, 71, 74, 72, 69,
      // C4 E4 A4 B4, E4 G#4 B4 C5
      60, 64, 69, 71, 64, 68, 71, 72,
      // E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4
      64, 76, 75, 76, 75, 76, 71, 74, 72, 69,
      // C4 E4 A4 B4, E4 C5 B4 A4
      60, 64, 69, 71, 64, 72, 71, 69,
    ],
  },
  {
    id: 'yolochka',
    name: 'В лесу родилась ёлочка',
    notes: [
      // G4 E5 E5 D5 E5 C5 G4 G4: в лесу родилась ёлочка
      67, 76, 76, 74, 76, 72, 67, 67,
      // G4 E5 E5 F5 D5 G5: в лесу она росла
      67, 76, 76, 77, 74, 79,
      // G5 A5 A5 F5 F5 E5 D5 C5: зимой и летом стройная
      79, 81, 81, 77, 77, 76, 74, 72,
      // G4 E5 E5 D5 E5 C5: зелёная была
      67, 76, 76, 74, 76, 72,
    ],
  },
  {
    id: 'kalinka',
    name: 'Калинка',
    notes: [
      // E5 D5 B4 C5 D5 B4 C5 D5 C5 B4 A4: калинка, калинка, калинка моя
      76, 74, 71, 72, 74, 71, 72, 74, 72, 71, 69,
      // E5 E5 D5 C5 B4 C5 D5 B4 C5 D5 C5 B4 A4: в саду ягода малинка, малинка моя
      76, 76, 74, 72, 71, 72, 74, 71, 72, 74, 72, 71, 69,
    ],
  },
];

export const TIMBRES = [
  { id: 'marimba', name: 'Маримба' },
  { id: 'bell', name: 'Колокольчик' },
  { id: 'chip', name: '8-бит' },
  { id: 'soft', name: 'Мягкий' },
];

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiName = (m) => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// The note engine.audio.note(i) plays: step 0 is G3 (196 Hz), pentatonic above it.
const SCALE = [0, 2, 4, 7, 9];
export function pentatonicMidi(i) {
  i = Math.max(0, Math.min(24, Math.round(i)));
  return 55 + Math.floor(i / 5) * 12 + SCALE[i % 5];
}

export function createMelodyCursor(melody) {
  const notes = Array.isArray(melody) ? melody : (melody && melody.notes) || null;
  let i = 0;
  return {
    length: notes ? notes.length : 0,
    get index() {
      return i;
    },
    // null for the pentatonic entry: the caller keeps its own note
    next() {
      if (!notes || !notes.length) return null;
      const m = notes[i];
      i = (i + 1) % notes.length;
      return m;
    },
    reset() {
      i = 0;
    },
  };
}

// ---------- voices ----------

// Each partial: [wave, frequency ratio, level, attack s, decay s].
// Levels are fractions of the 0.3 * vol peak engine.js uses.
const VOICES = {
  marimba: [
    ['sine', 1, 0.85, 0.005, 0.6],
    ['sine', 4, 0.28, 0.002, 0.12],
  ],
  bell: [
    ['sine', 1, 0.7, 0.002, 1.5],
    ['sine', 2.76, 0.3, 0.002, 0.7],
    ['sine', 5.4, 0.16, 0.001, 0.3],
  ],
  chip: [['square', 1, 0.55, 0.002, 0.32]],
  soft: [['triangle', 1, 1, 0.008, 0.492]],
};
const WAVES = ['sine', 'square', 'sawtooth', 'triangle'];

// A short filtered noise tick for the mallet hitting the bar.
const noise = new WeakMap();
function noiseBuffer(ctx) {
  let b = noise.get(ctx);
  if (b) return b;
  const len = Math.ceil(ctx.sampleRate * 0.04);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 0x2f6b1d;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  noise.set(ctx, b);
  return b;
}

function envelope(param, peak, t, attack, decay) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// Each chain lets go of its nodes as soon as its source stops.
function release(src, chain) {
  src.onended = () => {
    src.onended = null;
    src.disconnect();
    for (const node of chain) node.disconnect();
  };
}

// Schedules one note into dest. timbre is a TIMBRES id or a plain oscillator
// wave ('square' etc.), which gets the classic engine.js envelope.
// Returns false when nothing was scheduled.
export function playTone(ctx, dest, freq, vol, timbre, when = ctx ? ctx.currentTime : 0) {
  if (!ctx || !dest || !(freq > 0) || !(vol > 0)) return false;
  const t = Math.max(when, ctx.currentTime);
  const peak = 0.3 * Math.min(vol, 2);
  const parts = VOICES[timbre] || [[WAVES.includes(timbre) ? timbre : 'triangle', 1, 1, 0.008, 0.492]];
  const top = ctx.sampleRate * 0.45;
  let played = 0;

  for (const [wave, ratio, level, attack, decay] of parts) {
    const f = freq * ratio;
    if (f >= top) continue;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = f;
    envelope(g.gain, peak * level, t, attack, decay);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
    release(o, [g]);
    played++;
  }

  if (timbre === 'marimba' && played) {
    const n = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    n.buffer = noiseBuffer(ctx);
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(top * 0.8, Math.max(1500, freq * 5));
    bp.Q.value = 1.2;
    envelope(g.gain, peak * 0.22, t, 0.001, 0.03);
    n.connect(bp);
    bp.connect(g);
    g.connect(dest);
    n.start(t);
    n.stop(t + 0.04);
    release(n, [bp, g]);
  }
  return played > 0;
}

// ---------- impacts ----------

// Noise-made hits for things that break. Not notes, so they skip the song.
export const CRASHES = ['glass', 'smash', 'thud'];

const longNoise = new WeakMap();
function noiseLong(ctx) {
  let b = longNoise.get(ctx);
  if (b) return b;
  const len = Math.ceil(ctx.sampleRate * 1.2);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 0x51ed27;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = s / 2147483648 - 1;
  }
  longNoise.set(ctx, b);
  return b;
}

function burst(ctx, dest, t, type, freq, q, peak, decay) {
  const n = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  n.buffer = noiseLong(ctx);
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  envelope(g.gain, peak, t, 0.002, decay);
  n.connect(f);
  f.connect(g);
  g.connect(dest);
  n.start(t, (t * 7.3) % 0.5);
  n.stop(t + decay + 0.05);
  release(n, [f, g]);
}

function drop(ctx, dest, t, from, to, peak, decay) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + decay);
  envelope(g.gain, peak, t, 0.003, decay);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + decay + 0.05);
  release(o, [g]);
}

export function playCrash(ctx, dest, kind, vol, when = ctx ? ctx.currentTime : 0) {
  if (!ctx || !dest || !(vol > 0)) return false;
  const t = Math.max(when, ctx.currentTime);
  const v = 0.45 * Math.min(vol, 2);
  if (kind === 'glass') {
    burst(ctx, dest, t, 'highpass', 2800, 0.7, v * 0.9, 0.45);
    // little tinkles of falling pieces, the same every time for the same moment
    let s = Math.floor(t * 1000) | 1;
    for (let i = 0; i < 7; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const at = t + 0.03 + (s / 4294967296) * 0.5;
      playTone(ctx, dest, 2600 + (s % 3800), vol * 0.25, 'sine', at);
    }
  } else if (kind === 'smash') {
    burst(ctx, dest, t, 'bandpass', 900, 0.6, v * 1.2, 0.55);
    burst(ctx, dest, t, 'lowpass', 300, 0.8, v, 0.3);
    drop(ctx, dest, t, 140, 38, v * 1.4, 0.4);
  } else {
    burst(ctx, dest, t, 'lowpass', 500, 0.7, v * 0.8, 0.12);
    drop(ctx, dest, t, 160, 70, v, 0.16);
  }
  return true;
}
