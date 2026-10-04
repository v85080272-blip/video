// Shared pieces for the Trend Studio formats: frame size, seeded random,
// a tiny synth, and the text helpers every format draws with.

export const W = 1080;
export const H = 1920;
export const DT = 1 / 120;
export const ACCENT = '#ffd23f';
export const FONT = '"Rubik", "Arial Black", system-ui, sans-serif';
export const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

// mulberry32: same seed, same clip, on every device
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);

// ---------- sound ----------

export const SILENT = { blip() {}, chord() {} };

export const sound = {
  ctx: null,
  master: null,
  dest: null,
  on: false,
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
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
  // one short note; type 'tick' | 'pop' | 'boom' | 'bell'
  blip(freq, type = 'pop', vol = 0.5) {
    if (!this.on || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    const len = { tick: 0.05, pop: 0.18, boom: 0.5, bell: 0.9 }[type] || 0.2;
    o.type = { tick: 'square', pop: 'triangle', boom: 'sine', bell: 'sine' }[type] || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (type === 'boom') o.frequency.exponentialRampToValueAtTime(freq * 0.35, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * (type === 'tick' ? 0.35 : 1), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + len + 0.02);
  },
  chord(freqs) {
    freqs.forEach((f, i) => setTimeout(() => this.blip(f, 'bell', 0.45), i * 90));
  },
};

// ---------- drawing ----------

export function fitFont(ctx, text, weight, size, maxW, family = FONT) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 24) {
    s -= 3;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function backdrop(ctx, top = '#1a1446', bottom = '#07061a') {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Big hook text at the top. The last line is yellow when there are two.
export function hook(ctx, lines, y = 250, size = 92) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 20;
  lines.filter(Boolean).forEach((line, i, all) => {
    const text = line.toUpperCase();
    fitFont(ctx, text, 900, size, W - 110);
    ctx.fillStyle = i === all.length - 1 && all.length > 1 ? ACCENT : '#ffffff';
    ctx.fillText(text, W / 2, y + i * (size + 14));
  });
  ctx.restore();
}

export function pill(ctx, text, x, y, opts = {}) {
  const { bg = 'rgba(30,28,64,0.92)', color = '#fff', size = 40, align = 'center' } = opts;
  ctx.save();
  ctx.font = `800 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 1.75;
  const left = align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = bg;
  rrect(ctx, left, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, y + h / 2 + 2);
  ctx.restore();
  return w;
}

// End card: a framed box with a white first line and a yellow second line.
export function endCard(ctx, lines, alpha, y = 1560, color = ACCENT) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const h = 110 + lines.length * 92;
  ctx.fillStyle = 'rgba(8,7,26,0.88)';
  rrect(ctx, 80, y - h / 2, W - 160, h, 44);
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const text = line.toUpperCase();
    fitFont(ctx, text, 900, i === 1 ? 84 : 60, W - 250);
    ctx.fillStyle = i === 1 ? color : '#ffffff';
    ctx.fillText(text, W / 2, y - ((lines.length - 1) * 92) / 2 + i * 92);
  });
  ctx.restore();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0');
}

export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(f(0)) + to(f(8)) + to(f(4));
}

export function ball(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(color, 0.55));
  g.addColorStop(0.35, color);
  g.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// "🍕 Пицца" -> { icon: '🍕', text: 'Пицца' }; a line without a leading emoji keeps icon ''.
export function splitIcon(line) {
  const m = line.trim().match(/^(\p{Extended_Pictographic}[\p{Extended_Pictographic}‍️\p{Emoji_Modifier}]*|[♈-♓]️?)\s*(.*)$/u);
  return m ? { icon: m[1], text: m[2] } : { icon: '', text: line.trim() };
}
