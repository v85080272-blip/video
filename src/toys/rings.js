import { rng, ball, glowSprite, fmtSec } from '../engine.js';

const CX = 540;
const CY = 1220;
const R_IN = 90;
const R_OUT = 460;
const TAU = Math.PI * 2;
const SUB = 4;
const MAX_V = 2600;
const TAIL = 1.2; // seconds of shatter after the escape, before the end card
const TRAIL = 12;
const PALETTE = ['#2f7bff', '#8f4dff', '#ff3dd8', '#ff3b5c', '#ff8a1f', '#ffe234', '#38f06a', '#2ee8ff'];

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, f) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * f));
};

function ringColor(f) {
  const x = f * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(x));
  return mix(PALETTE[i], PALETTE[i + 1], x - i);
}

// Radii, stroke and ball size: crowded rings get thinner lines and a smaller ball.
function layout(n) {
  const sp = (R_OUT - R_IN) / Math.max(1, n - 1);
  const rad = [];
  for (let i = 0; i < n; i++) rad.push(R_IN + sp * i);
  return { rad, sw: Math.min(10, Math.max(4, sp * 0.3)), br: Math.min(14, Math.max(8, sp * 0.45)) };
}

export default {
  id: 'rings',
  tab: 'Кольца',
  eyebrow: 'RING LAB',
  title: ['Сможет ли шарик', 'выбраться', 'из колец?'],
  lede: 'Шарик прыгает внутри вращающихся колец и ищет щель. Каждое пройденное кольцо разлетается на осколки, а ширина щели решает, сколько продлится побег.',
  hook: ['Сможет ли шарик', 'выбраться?'],
  params: [
    { key: 'rings', label: 'Колец', min: 4, max: 24, step: 1, value: 12 },
    { key: 'gap', label: 'Ширина щели, °', min: 40, max: 140, step: 5, value: 90 },
    { key: 'spin', label: 'Скорость вращения', min: 0.2, max: 3, step: 0.1, value: 1.2 },
    { key: 'gravity', label: 'Гравитация', min: 0, max: 3000, step: 50, value: 1800 },
    { key: 'kick', label: 'Сила отскока', min: 500, max: 1800, step: 25, value: 1150 },
  ],
  seed: 56403,
  search: { label: 'Найти сид на 16–20 секунд', target: 18 },
  battle: { hook: ['Какой шарик', 'выберется первым?'], seeds: [31559, 43346, 36535] },

  arena() {
    const s = R_OUT + 40;
    return { x: CX - s, y: CY - s, w: s * 2, h: s * 2 };
  },

  create(p, seed, fx) {
    const r = rng(seed);
    const pr = rng((seed ^ 0x2c1b3c6d) >>> 0); // visuals only, never touches the physics sequence
    const n = Math.round(p.rings);
    const { rad, sw, br } = layout(n);
    const rings = rad.map((R, i) => {
      const f = n > 1 ? i / (n - 1) : 0;
      const color = ringColor(f);
      const next = i < n - 1 ? rad[i + 1] - sw / 2 - br - R : Infinity;
      return {
        r: R,
        f,
        color,
        core: mix(color, '#ffffff', 0.6),
        half: (p.gap * (1 - 0.35 * f) * Math.PI) / 360,
        fit: Math.asin(br / R),
        cap: sw / 2 / R,
        a0: r() * TAU,
        w: p.spin * (0.6 + 0.8 * r()) * (i % 2 ? -1 : 1),
        inner: R - sw / 2 - br,
        // the ring counts as passed once the ball is through it, or as far as the next ring allows
        brk: R + Math.max(0, Math.min(sw / 2 + br, next)),
        passing: false,
        broken: false,
        hits: 0,
        flash: 0,
      };
    });
    const a0 = r() * TAU;
    const b = { x: CX, y: CY, vx: Math.cos(a0) * 600, vy: Math.sin(a0) * 600 };
    const trail = [];
    const sparks = [];
    const shards = [];
    const waves = [];
    let k = 0;
    let bounces = 0;
    let shake = 0;

    const angle = (c, t) => c.a0 + c.w * t;

    function bounce(c, nx, ny) {
      b.x = CX + nx * (c.inner - 0.5);
      b.y = CY + ny * (c.inner - 0.5);
      const vn = b.vx * nx + b.vy * ny;
      if (vn <= 0) return;
      b.vx -= 2 * vn * nx;
      b.vy -= 2 * vn * ny;
      const kick = (r() - 0.5) * 320;
      b.vx += -ny * kick;
      b.vy += nx * kick;
      const sp = Math.hypot(b.vx, b.vy);
      const lim = sp < p.kick ? p.kick : sp > MAX_V ? MAX_V : sp;
      b.vx *= lim / sp;
      b.vy *= lim / sp;
      bounces++;
      c.hits++;
      c.flash = 1;
      const hx = CX + nx * (c.r - sw / 2);
      const hy = CY + ny * (c.r - sw / 2);
      for (let j = 0; j < 5; j++) burst(hx, hy, Math.atan2(-ny, -nx), 2.2, 180, 500, c.color, 0.25);
      fx.note(Math.min(22, 2 + Math.round(c.f * 14) + (c.hits % 4) * 2), 0.55);
    }

    function burst(x, y, a, spread, v0, v1, color, life) {
      const ang = a + (pr() - 0.5) * spread;
      const v = v0 + pr() * (v1 - v0);
      sparks.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, age: 0, life: life * (1 + pr()), s: 2 + pr() * 3, color });
    }

    function shatter(c, t) {
      c.broken = true;
      c.passing = false;
      const last = c === rings[n - 1];
      const ang = angle(c, t);
      const span = TAU - 2 * c.half;
      const m = Math.round(6 + c.r / 40);
      for (let j = 0; j < m; j++) {
        const a = ang + c.half + ((j + 0.5) / m) * span;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const out = 70 + pr() * 200;
        const tang = c.w * c.r * 0.35;
        shards.push({
          x: CX + ca * c.r,
          y: CY + sa * c.r,
          vx: ca * out - sa * tang + (pr() - 0.5) * 120,
          vy: sa * out + ca * tang + (pr() - 0.5) * 120 - 80,
          a,
          va: (pr() - 0.5) * 7,
          span: (span / m) * 0.72,
          r: c.r,
          age: 0,
          life: 0.6 + pr() * 0.45,
          color: c.color,
          core: c.core,
        });
      }
      const dust = Math.round(14 + c.r * 0.08);
      for (let j = 0; j < dust; j++) {
        const a = ang + c.half + pr() * span;
        burst(CX + Math.cos(a) * c.r, CY + Math.sin(a) * c.r, a, 1.2, 160, 520, c.color, 0.5);
      }
      // the last ring goes out with confetti in every ring colour
      if (last) for (let j = 0; j < 60; j++) burst(b.x, b.y, pr() * TAU, 0, 250, 900, rings[Math.floor(pr() * n)].color, 0.55);
      waves.push({ r: c.r, color: last ? '#ffffff' : c.color, age: 0 });
      shake = last ? 1.6 : 1;
      fx.note(last ? 24 : Math.min(23, 8 + Math.round(c.f * 14)), 1, 'square');
    }

    function advance(list, dt, g, drag) {
      let w = 0;
      for (let i = 0; i < list.length; i++) {
        const q = list[i];
        q.age += dt;
        if (q.age >= q.life) continue;
        q.vy += g * dt;
        q.vx *= drag;
        q.vy *= drag;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.va) q.a += q.va * dt;
        list[w++] = q;
      }
      list.length = w;
    }

    return {
      t: 0,
      time: 0,
      done: false,
      finished: false,
      finishT: 0,
      ball: b,
      rings,
      // battle mode reads these: the escape moment and how far along it is
      get finishTime() {
        return this.finished ? this.finishT : undefined;
      },
      progress() {
        return k / n;
      },
      step(dt) {
        const h = dt / SUB;
        for (let s = 0; s < SUB; s++) {
          this.t += h;
          b.vy += p.gravity * h;
          b.x += b.vx * h;
          b.y += b.vy * h;
          const dx = b.x - CX;
          const dy = b.y - CY;
          const d = Math.hypot(dx, dy) || 1e-4;
          // only the innermost unbroken ring collides; a break hands over to the next one at once
          while (k < n) {
            const c = rings[k];
            if (d <= c.inner && !c.passing) break;
            let off = Math.atan2(dy, dx) - angle(c, this.t);
            off -= Math.round(off / TAU) * TAU;
            const fits = Math.abs(off) + c.fit <= c.half;
            if (c.passing) {
              if (d >= c.brk) {
                shatter(c, this.t);
                if (++k === n) {
                  this.finished = true;
                  this.finishT = this.t;
                }
                continue;
              }
              if (d < c.inner) {
                c.passing = false;
                break;
              }
              // half way out the ring may turn under the ball: past the line it keeps going
              if (fits || d >= c.r) break;
              c.passing = false;
            } else if (fits) {
              c.passing = true;
              break;
            }
            bounce(c, dx / d, dy / d);
            break;
          }
        }
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > MAX_V * 1.3) {
          b.vx *= (MAX_V * 1.3) / sp;
          b.vy *= (MAX_V * 1.3) / sp;
        }
        trail.push(b.x, b.y);
        if (trail.length > TRAIL * 2) trail.splice(0, 2);
        for (const c of rings) if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 4);
        advance(sparks, dt, 900, 0.985);
        advance(shards, dt, 1100, 0.99);
        let w = 0;
        for (const q of waves) if ((q.age += dt) < 0.55) waves[w++] = q;
        waves.length = w;
        shake = Math.max(0, shake - dt * 5);
        this.time = this.t;
        if (this.finished && this.t - this.finishT >= TAIL) this.done = true;
      },

      draw(ctx) {
        ctx.save();
        if (shake > 0) ctx.translate(Math.sin(this.t * 97) * shake * 7, Math.cos(this.t * 83) * shake * 7);
        ctx.lineCap = 'round';

        // neon tubes: two soft additive passes, then the solid line and a bright core
        ctx.globalCompositeOperation = 'lighter';
        for (const c of rings) {
          if (c.broken) continue;
          const a = angle(c, this.t);
          ctx.strokeStyle = c.color;
          ctx.beginPath();
          ctx.arc(CX, CY, c.r, a + c.half + c.cap, a + TAU - c.half - c.cap);
          ctx.globalAlpha = 0.1 + c.flash * 0.12;
          ctx.lineWidth = sw * (3.4 + c.flash);
          ctx.stroke();
          ctx.globalAlpha = 0.22 + c.flash * 0.35;
          ctx.lineWidth = sw * 2;
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        for (const c of rings) {
          if (c.broken) continue;
          const a = angle(c, this.t);
          ctx.beginPath();
          ctx.arc(CX, CY, c.r, a + c.half + c.cap, a + TAU - c.half - c.cap);
          ctx.strokeStyle = c.flash > 0 ? mix(c.color, '#ffffff', c.flash * 0.7) : c.color;
          ctx.lineWidth = sw;
          ctx.stroke();
          ctx.strokeStyle = c.core;
          ctx.lineWidth = sw * 0.35;
          ctx.stroke();
        }

        ctx.globalCompositeOperation = 'lighter';
        for (const q of waves) {
          const f = q.age / 0.55;
          ctx.globalAlpha = (1 - f) * 0.7;
          ctx.strokeStyle = q.color;
          ctx.lineWidth = sw * (1.6 - f);
          ctx.beginPath();
          ctx.arc(CX, CY, q.r + f * 90, 0, TAU);
          ctx.stroke();
        }
        // a shard is a piece of its ring's arc, spinning around its own middle
        for (const q of shards) {
          const f = q.age / q.life;
          const half = (q.span / 2) * (1 - f * 0.6);
          ctx.beginPath();
          ctx.arc(q.x - Math.cos(q.a) * q.r, q.y - Math.sin(q.a) * q.r, q.r, q.a - half, q.a + half);
          ctx.strokeStyle = q.color;
          ctx.globalAlpha = (1 - f) * 0.3;
          ctx.lineWidth = sw * 2.6;
          ctx.stroke();
          ctx.globalAlpha = 1 - f * f;
          ctx.lineWidth = sw;
          ctx.stroke();
          ctx.strokeStyle = q.core;
          ctx.lineWidth = sw * 0.35;
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        for (const q of sparks) {
          const f = q.age / q.life;
          ctx.globalAlpha = 1 - f;
          ctx.strokeStyle = q.color;
          ctx.lineWidth = q.s;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - q.vx * 0.025, q.y - q.vy * 0.025);
          ctx.stroke();
        }

        const tint = rings[Math.min(k, n - 1)].color;
        const fade = this.finished ? Math.max(0, 1 - (this.t - this.finishT) / TAIL) : 1;
        const m = trail.length / 2;
        ctx.fillStyle = tint;
        for (let i = 0; i < m - 1; i++) {
          const f = (i + 1) / m;
          ctx.globalAlpha = f * 0.45 * fade;
          ctx.beginPath();
          ctx.arc(trail[i * 2], trail[i * 2 + 1], br * (0.35 + 0.6 * f), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 0.85 * fade;
        const g = br * 3;
        ctx.drawImage(glowSprite('#ffffff', br), b.x - g, b.y - g, g * 2, g * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = fade;
        ball(ctx, b.x, b.y, br, '#f2f4ff');
        ctx.restore();
      },

      pills() {
        return [{ text: `Колец: ${n - k}` }, { text: fmtSec(this.finished ? this.finishT : this.t) }];
      },

      banner() {
        return { lines: ['Выбрался за', fmtSec(this.finishT)], color: '#ffd23f' };
      },

      summary() {
        return {
          duration: this.finished ? this.finishT : this.t,
          sub: `Отскоков: ${bounces} · колец пройдено: ${k} из ${n}`,
          bars: rings.map((c) => ({ v: c.hits, color: c.color })),
        };
      },
    };
  },
};
