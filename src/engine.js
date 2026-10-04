// Shared pieces for every lab: canvas size, fixed timestep, seeded random,
// sound, and the text overlays drawn on top of each simulation.

import { MELODIES, midiToFreq, pentatonicMidi, playTone, createMelodyCursor } from './melody.js';

export const W = 1080;
export const H = 1920;
export const DT = 1 / 120;
export const MAX_T = 120;

export const ACCENT = '#ffd23f';
export const TEAM = [
  { name: 'Красный', color: '#ff4d5e' },
  { name: 'Синий', color: '#4d8bff' },
  { name: 'Жёлтый', color: '#ffd23f' },
  { name: 'Зелёный', color: '#3ddc6f' },
  { name: 'Фиолетовый', color: '#b36bff' },
  { name: 'Оранжевый', color: '#ff8c3a' },
  { name: 'Голубой', color: '#3fe0ff' },
  { name: 'Розовый', color: '#ff5fc8' },
];

// mulberry32: same seed, same run, on every device
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SILENT = { note() {} };

// Runs a whole simulation without drawing, to know its length and outcome.
export function simulate(toy, params, seed) {
  const sim = toy.create(params, seed, SILENT);
  const steps = MAX_T / DT;
  for (let i = 0; i < steps && !sim.done; i++) sim.step(DT);
  return sim;
}

export const fmtSec = (s) => s.toFixed(1).replace('.', ',') + ' с';
export const fmtClock = (s) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

// ---------- sound ----------

export const audio = {
  ctx: null,
  master: null,
  dest: null,
  on: false,
  windowStart: 0,
  count: 0,
  timbre: 'marimba',
  melodyId: 'pentatonic',
  cursor: null,
  lastSong: -1,
  setMelody(id) {
    const m = MELODIES.find((x) => x.id === id) || MELODIES[0];
    this.melodyId = m.id;
    this.cursor = m.notes ? createMelodyCursor(m) : null;
    this.lastSong = -1;
  },
  // one note in the chosen timbre, outside the song and the throttle
  preview() {
    if (!this.on || !this.ctx) return;
    playTone(this.ctx, this.master, midiToFreq(pentatonicMidi(7)), 0.7, this.timbre, this.ctx.currentTime);
  },
  resetMelody() {
    if (this.cursor) this.cursor.reset();
    this.lastSong = -1;
  },
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    if (this.ctx.createMediaStreamDestination) {
      this.dest = this.ctx.createMediaStreamDestination();
      comp.connect(this.dest);
    }
  },
  toggle() {
    this.init();
    if (!this.ctx) return false;
    this.on = !this.on;
    if (this.on) this.ctx.resume();
    return this.on;
  },
  // i: step on a pentatonic scale, 0 is G3. With a song picked, every
  // ordinary hit plays the song's next note instead; 'square' marks a
  // finish event, which keeps its own 8-bit ding.
  note(i, vol = 0.6, wave) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.windowStart > 0.05) {
      this.windowStart = t;
      this.count = 0;
    }
    // finish dings always sound; a tune needs a little air between notes
    const special = wave === 'square';
    if (!special && this.cursor && t - this.lastSong < 0.08) return;
    if (++this.count > 4 && !special) return;
    let midi = pentatonicMidi(i);
    if (!special && this.cursor) {
      this.lastSong = t;
      midi = this.cursor.next();
    }
    playTone(this.ctx, this.master, midiToFreq(midi), vol, special ? 'chip' : this.timbre, t);
  },
};

// ---------- overlays ----------

export const DISPLAY = '"Rubik", "Arial Black", system-ui, sans-serif';

function fitFont(ctx, text, weight, size, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${DISPLAY}`;
  while (ctx.measureText(text).width > maxW && s > 30) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${DISPLAY}`;
  }
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawBackdrop(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 80, W / 2, H * 0.55, H * 0.75);
  g.addColorStop(0, '#17143d');
  g.addColorStop(1, '#08071a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// The top band of the frame: hook question and the live stat pills.
export function drawHook(ctx, lines, pills) {
  const fade = ctx.createLinearGradient(0, 0, 0, 640);
  fade.addColorStop(0, 'rgba(8,7,26,0.96)');
  fade.addColorStop(0.75, 'rgba(8,7,26,0.85)');
  fade.addColorStop(1, 'rgba(8,7,26,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, 640);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  lines.forEach((line, i) => {
    const text = line.toUpperCase();
    fitFont(ctx, text, 900, 88, W - 120);
    ctx.fillStyle = i === lines.length - 1 && lines.length > 1 ? ACCENT : '#ffffff';
    ctx.fillText(text, W / 2, 300 + i * 100);
  });
  ctx.shadowBlur = 0;

  if (!pills || !pills.length) return;
  ctx.font = `800 38px ${DISPLAY}`;
  const padX = 30;
  const gap = 16;
  const dot = 22;
  const widths = pills.map((p) => ctx.measureText(p.text).width + padX * 2 + (p.color ? dot + 12 : 0));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
  let x = (W - total) / 2;
  const y = 470;
  pills.forEach((p, i) => {
    const w = widths[i];
    ctx.fillStyle = 'rgba(30,28,58,0.92)';
    roundRect(ctx, x, y, w, 70, 35);
    ctx.fill();
    let tx = x + padX;
    if (p.color) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(tx + dot / 2, y + 35, dot / 2, 0, Math.PI * 2);
      ctx.fill();
      tx += dot + 12;
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(p.text, tx, y + 49);
    x += w + gap;
  });
  ctx.textAlign = 'center';
}

// The end card, shown after the simulation finishes.
export function drawBanner(ctx, lines, color, alpha) {
  if (!lines) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  const y = 1560;
  ctx.fillStyle = 'rgba(8,7,26,0.82)';
  roundRect(ctx, 90, y - 120, W - 180, 250, 40);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color || ACCENT;
  ctx.stroke();
  ctx.textAlign = 'center';
  lines.forEach((line, i) => {
    const text = line.toUpperCase();
    fitFont(ctx, text, 900, i === 0 ? 64 : 78, W - 260);
    ctx.fillStyle = i === 0 ? '#ffffff' : color || ACCENT;
    ctx.fillText(text, W / 2, y - 30 + i * 96);
  });
  ctx.restore();
}

// A soft glow sprite per colour, cheaper than shadowBlur for many balls.
const sprites = new Map();
export function glowSprite(color, r) {
  const key = color + r;
  if (sprites.has(key)) return sprites.get(key);
  const size = Math.ceil(r * 6);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.3, color + '88');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  sprites.set(key, c);
  return c;
}

export function ball(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export function hueColor(h) {
  // hsl -> hex so sprites and shade() can use it
  h = ((h % 360) + 360) % 360;
  const s = 0.9;
  const l = 0.6;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}
