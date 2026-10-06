// Living backdrops and ball skins. Everything here animates off look.t, a
// clock that keeps running after the sim ends, so the end card never sits on
// a frozen frame and a rendered clip moves exactly like the preview.
// Skins only change how a ball is painted, never the physics, so every seed
// keeps its result.

export const BACKDROPS = [
  { id: 'aurora', name: 'Сияние' },
  { id: 'rays', name: 'Лучи' },
  { id: 'bokeh', name: 'Огоньки' },
  { id: 'plain', name: 'Тёмный, без движения' },
];

export const SKINS = [
  { id: 'glossy', name: 'Глянец' },
  { id: 'face', name: 'Смайлики' },
  { id: 'sport', name: 'Мячи' },
  { id: 'planet', name: 'Планеты' },
];

export const look = {
  bg: 'aurora',
  skin: 'face',
  t: 0,
  // set by a battle while it draws one lane
  lane: -1,
  laneColor: null,
  scale: 1,
  mood: 'idle',
  pulse: 0,
  pulseT: 0,
  tick(dt) {
    this.t += dt;
  },
  // every hit nudges the backdrop, so the picture breathes with the notes
  kick(v = 0.6) {
    this.pulse = Math.min(1.4, this.beat() + v * 0.45);
    this.pulseT = this.t;
  },
  beat() {
    return this.pulse * Math.exp(-(this.t - this.pulseT) * 5);
  },
};

const TAU = Math.PI * 2;
const INK = '#1b1033';

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ---------- backdrops ----------

// a fixed layout, the same on every device and in every clip
function scatter(n, seed) {
  let a = seed >>> 0;
  const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: n }, () => ({ x: r(), y: r(), s: r(), p: r() * TAU, h: r() }));
}
const STARS = scatter(150, 7);
const LIGHTS = scatter(30, 11);

const blobs = new Map();
function blob(color) {
  if (blobs.has(color)) return blobs.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 384;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(192, 192, 0, 192, 192, 192);
  grad.addColorStop(0, rgba(color, 1));
  grad.addColorStop(0.4, rgba(color, 0.5));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 384, 384);
  blobs.set(color, c);
  return c;
}

function base(ctx, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function stars(ctx, w, h, t, beat) {
  ctx.fillStyle = '#ffffff';
  for (const s of STARS) {
    const y = (((s.y * h - t * (10 + s.s * 26)) % h) + h) % h;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + s.s * 2.4) + s.p);
    ctx.globalAlpha = Math.min(1, (0.12 + 0.6 * tw) * (0.5 + s.s * 0.5) + beat * 0.2);
    const r = 1.4 + s.s * 2.4;
    ctx.fillRect(s.x * w - r / 2, y - r / 2, r, r);
  }
  ctx.globalAlpha = 1;
}

const AURORA = ['#6a2cff', '#00a8ff', '#ff2fa8', '#14d8a8'];
function aurora(ctx, w, h, t, beat) {
  base(ctx, w, h, '#0c0828', '#05040f');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  AURORA.forEach((c, i) => {
    const x = w * (0.5 + 0.38 * Math.sin(t * (0.21 + i * 0.05) + i * 1.7));
    const y = h * (0.5 + 0.34 * Math.sin(t * (0.16 + i * 0.04) + i * 2.3));
    const s = w * (1.5 + 0.25 * Math.sin(t * 0.5 + i * 1.3));
    ctx.globalAlpha = 0.3 + beat * 0.14;
    ctx.drawImage(blob(c), x - s / 2, y - s / 2, s, s);
  });
  ctx.restore();
  stars(ctx, w, h, t, beat);
}

function rays(ctx, w, h, t, beat) {
  base(ctx, w, h, '#170a36', '#07051a');
  const cx = w / 2;
  const cy = h * 0.6;
  const R = h;
  const n = 16;
  const hue = (t * 14) % 360;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.14);
  for (let k = 0; k < 2; k++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    const col = `hsla(${(hue + k * 150) % 360}, 95%, 62%,`;
    g.addColorStop(0, col + (0.22 + beat * 0.12) + ')');
    g.addColorStop(0.6, col + '0.07)');
    g.addColorStop(1, col + '0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = k; i < n; i += 2) {
      const a = (i / n) * TAU;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, a, a + TAU / n);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
  const v = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, h * 0.75);
  v.addColorStop(0, 'rgba(5,4,15,0)');
  v.addColorStop(1, 'rgba(5,4,15,0.8)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  stars(ctx, w, h, t, beat);
}

const LIGHT_COLORS = ['#ff4fd8', '#4d8bff', '#ffd23f', '#3fe0ff', '#b36bff'];
function bokeh(ctx, w, h, t, beat) {
  base(ctx, w, h, '#0b1030', '#05040f');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of LIGHTS) {
    const r = 50 + b.s * 150;
    const span = h + r * 2;
    const y = ((((b.y * span - t * (16 + (1 - b.s) * 40)) % span) + span) % span) - r;
    const x = b.x * w + Math.sin(t * 0.5 + b.p) * 50;
    ctx.globalAlpha = (0.2 + 0.2 * (1 - b.s)) * (1 + beat * 0.7);
    ctx.drawImage(blob(LIGHT_COLORS[Math.floor(b.h * LIGHT_COLORS.length)]), x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  stars(ctx, w, h, t, beat);
}

function plain(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h * 0.55, 80, w / 2, h * 0.55, h * 0.75);
  g.addColorStop(0, '#17143d');
  g.addColorStop(1, '#08071a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const BG = { aurora, rays, bokeh, plain };

export function drawScene(ctx, w, h) {
  (BG[look.bg] || plain)(ctx, w, h, look.t, Math.min(1, look.beat()));
}

// ---------- skins ----------

// Each ball is remembered between frames: how far it rolled and when it last
// turned sharply, so skins can spin and squash on a bounce.
const mem = new WeakMap();
let nextId = 1;
function track(st, x, y, r) {
  if (!st) return null;
  const t = look.t;
  let m = mem.get(st);
  if (!m) {
    m = { x, y, t, vx: 0, vy: 0, rot: 0, hitT: -9, nx: 0, ny: 1, id: nextId++ };
    mem.set(st, m);
    return m;
  }
  const dt = t - m.t;
  if (dt > 1e-6) {
    const vx = (x - m.x) / dt;
    const vy = (y - m.y) / dt;
    const dvx = vx - m.vx;
    const dvy = vy - m.vy;
    const dv = Math.hypot(dvx, dvy);
    const turn = vx * m.vx + vy * m.vy < 0.5 * Math.hypot(vx, vy) * Math.hypot(m.vx, m.vy);
    if (dt < 0.1 && dv > 700 && turn) {
      m.hitT = t;
      m.nx = dvx / dv;
      m.ny = dvy / dv;
    }
    if (dt < 0.1) m.rot += (vx >= 0 ? 1 : -1) * (Math.hypot(x - m.x, y - m.y) / Math.max(r, 1));
    m.x = x;
    m.y = y;
    m.t = t;
    m.vx = vx;
    m.vy = vy;
  }
  return m;
}

// squash along the push of the bounce, stretch across it
function squash(ctx, hitT, nx, ny) {
  const e = 1 - (look.t - hitT) / 0.2;
  if (!(e > 0)) return;
  const k = 0.3 * e * e;
  const a = Math.atan2(ny, nx);
  ctx.rotate(a);
  ctx.scale(1 - k, 1 + k);
  ctx.rotate(-a);
}

function sphere(ctx, r, light, mid, dark) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

// soft light and shadow on top of a pattern, so flat drawings read as balls
function volume(ctx, r) {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
}

function glossy(ctx, r, color) {
  sphere(ctx, r, '#ffffff', color, shade(color, -0.35));
}

function face(ctx, r, color, m, o, px) {
  sphere(ctx, r, shade(color, 0.6), color, shade(color, -0.32));
  const t = look.t;
  const mood = o.mood || 'idle';
  const hit = o.hitT !== undefined ? o.hitT : m ? m.hitT : -9;
  const ouch = t - hit < 0.25;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  if (px < 6) {
    // too small for features: two dots still read as a face
    ctx.beginPath();
    ctx.arc(-r * 0.33, -r * 0.12, r * 0.17, 0, TAU);
    ctx.arc(r * 0.33, -r * 0.12, r * 0.17, 0, TAU);
    ctx.fill();
    return;
  }
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, TAU);
  ctx.strokeStyle = shade(color, -0.6);
  ctx.stroke();
  ctx.strokeStyle = INK;

  let lx = 0;
  let ly = 0;
  if (m) {
    const sp = Math.hypot(m.vx, m.vy);
    if (sp > 40) {
      lx = m.vx / sp;
      ly = m.vy / sp;
    }
  }
  features(ctx, r, { mood, ouch, lx, ly, px, phase: (m ? m.id : (o.variant || 0) + 1) * 1.37 });
}

// Eyes, cheeks and mouth around (0, 0) for a face of radius r, on any body.
// f: { mood: idle|win|lose, ouch, lx, ly (where the eyes look), px, phase }
export function features(ctx, r, f) {
  const { mood = 'idle', ouch = false, lx = 0, ly = 0, px = r, phase = 0 } = f;
  const t = look.t;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  const ex = r * 0.34;
  const ey = -r * 0.16;
  const er = r * (ouch ? 0.27 : 0.23);
  const blink = (t + phase) % 3.6 < 0.12;
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (mood === 'win') {
      ctx.beginPath();
      ctx.arc(x, ey + er * 0.35, er * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (blink && !ouch) {
      ctx.beginPath();
      ctx.moveTo(x - er * 0.8, ey);
      ctx.lineTo(x + er * 0.8, ey);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, ey, er, er * 1.15, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      const pr = er * (ouch ? 0.38 : 0.55);
      ctx.arc(x + lx * er * 0.4, ey + ly * er * 0.45, pr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + lx * er * 0.4 - pr * 0.35, ey + ly * er * 0.45 - pr * 0.4, pr * 0.3, 0, TAU);
      ctx.fill();
      if (mood === 'lose') {
        // sad brows
        ctx.beginPath();
        ctx.moveTo(x - s * er * 0.9, ey - er * 1.65);
        ctx.lineTo(x + s * er * 0.8, ey - er * 1.25);
        ctx.stroke();
      }
    }
  }

  if (px >= 14) {
    ctx.fillStyle = 'rgba(255,90,140,0.35)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * r * 0.55, r * 0.2, r * 0.15, r * 0.09, 0, 0, TAU);
      ctx.fill();
    }
  }

  ctx.fillStyle = INK;
  const my = r * 0.3;
  if (mood === 'win') {
    ctx.beginPath();
    ctx.arc(0, my - r * 0.08, r * 0.34, 0.1, Math.PI - 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5f7a';
    ctx.beginPath();
    ctx.arc(0, my + r * 0.16, r * 0.13, Math.PI, 0);
    ctx.fill();
  } else if (ouch) {
    ctx.beginPath();
    ctx.ellipse(0, my, r * 0.11, r * 0.14, 0, 0, TAU);
    ctx.fill();
  } else if (mood === 'lose') {
    ctx.beginPath();
    ctx.arc(0, my + r * 0.2, r * 0.22, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, my - r * 0.14, r * 0.26, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }
}

// two arcs bulging toward the middle, from circles left and right of the ball
function seams(ctx, d, R, a) {
  ctx.moveTo(-d + R * Math.cos(-a), R * Math.sin(-a));
  ctx.arc(-d, 0, R, -a, a);
  ctx.moveTo(d + R * Math.cos(Math.PI - a), R * Math.sin(Math.PI - a));
  ctx.arc(d, 0, R, Math.PI - a, Math.PI + a);
}

// 0 basketball, 1 football, 2 tennis
function sport(ctx, r, color, m, o, px) {
  const kind = o.variant !== undefined ? o.variant % 3 : look.lane >= 0 ? look.lane : m ? m.id % 3 : 0;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  ctx.rotate(m ? m.rot : look.t * 1.5);
  ctx.lineWidth = r * 0.075;
  if (kind === 0) {
    ctx.fillStyle = '#ff8a2a';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    if (px >= 4) {
      ctx.strokeStyle = '#2a1408';
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      seams(ctx, r * 1.33, r * 0.95, 0.9);
      ctx.stroke();
    }
  } else if (kind === 1) {
    ctx.fillStyle = '#f4f6fb';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = '#1b1b24';
    const pent = (cx, cy, s, rot) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + (i / 5) * TAU - Math.PI / 2;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * s, cy + Math.sin(a) * s);
      }
      ctx.closePath();
      ctx.fill();
    };
    pent(0, 0, r * 0.34, 0);
    if (px >= 4) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        pent(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.3, Math.PI / 5 + a);
      }
      ctx.strokeStyle = '#8a8fa0';
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - Math.PI / 2;
        ctx.moveTo(Math.cos(a) * r * 0.34, Math.sin(a) * r * 0.34);
        ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#d4f03c';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    if (px >= 4) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      seams(ctx, r * 1.2, r * 0.82, 1.1);
      ctx.stroke();
    }
  }
  ctx.restore();
  volume(ctx, r);
}

function planet(ctx, r, color, m, o, px) {
  const v = o.variant !== undefined ? o.variant : look.lane >= 0 ? look.lane : m ? m.id : 0;
  const ringed = v % 3 !== 1;
  const spin = m ? m.rot : look.t * 1.2;
  const ring = (front) => {
    if (!ringed || px < 5) return;
    ctx.save();
    ctx.rotate(-0.38);
    ctx.scale(1, 0.28);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.62, front ? 0 : Math.PI, front ? Math.PI : TAU);
    ctx.strokeStyle = rgba(shade(color, 0.55), 0.85);
    ctx.lineWidth = r * 0.36;
    ctx.stroke();
    ctx.restore();
  };
  ring(false);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  if (px >= 4) {
    for (let i = -3; i <= 3; i++) {
      const y = i * r * 0.3 + Math.sin(spin * 0.5 + i) * r * 0.04;
      ctx.fillStyle = i % 2 ? shade(color, -0.22) : shade(color, 0.28);
      ctx.fillRect(-r, y - r * 0.07, r * 2, r * 0.14);
    }
    // a storm that rolls across as the planet spins
    const sx = ((((spin * r * 0.35) % (r * 3)) + r * 3) % (r * 3)) - r * 1.5;
    ctx.fillStyle = rgba(shade(color, -0.45), 0.8);
    ctx.beginPath();
    ctx.ellipse(sx, r * 0.28, r * 0.24, r * 0.12, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  volume(ctx, r);
  ring(true);
}

const PAINT = { glossy, face, sport, planet };

// Paints one ball in the current skin. st is any object that lives as long
// as the ball (its physics state); without it the ball still draws, it just
// can't spin or squash. o: { mood, variant, hitT } overrides for avatars.
export function drawSkin(ctx, skin, x, y, r, color, st, o = {}) {
  const m = track(st, x, y, r);
  ctx.save();
  ctx.translate(x, y);
  if (o.hitT !== undefined) squash(ctx, o.hitT, 0, 1);
  else if (m) squash(ctx, m.hitT, m.nx, m.ny);
  const paint = PAINT[skin] || glossy;
  if (!o.mood && look.mood !== 'idle') o = { ...o, mood: look.mood };
  paint(ctx, r, color, m, o, r * look.scale);
  ctx.restore();
}

// The main ball takes its lane's colour in a battle, so faces match lanes.
export const heroColor = (fallback) => look.laneColor || fallback;
