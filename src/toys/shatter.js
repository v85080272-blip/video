import { rng, fmtSec } from '../engine.js';
import { look, features } from '../scene.js';
import { circlePoly, fracture, blast, stepShards, drawShards } from '../shards.js';

const CX = 540;
const CY = 1220;
const R = 440;
const TAU = Math.PI * 2;
const TAIL = 2.6; // seconds of falling glass after the break

// One crack: a jagged line from the rim inward, with a side branch.
function crack(r, ang, len, rnd) {
  const pts = [[Math.cos(ang) * r, Math.sin(ang) * r]];
  let a = ang + Math.PI;
  let x = pts[0][0];
  let y = pts[0][1];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    a += (rnd() - 0.5) * 0.9;
    x += Math.cos(a) * (len / n);
    y += Math.sin(a) * (len / n);
    pts.push([x, y]);
  }
  const k = 1 + Math.floor(rnd() * (pts.length - 2));
  const ba = a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6);
  const branch = [pts[k], [pts[k][0] + Math.cos(ba) * len * 0.35, pts[k][1] + Math.sin(ba) * len * 0.35]];
  return [pts, branch];
}

function glass(ctx, x, y, r, a, cracks) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.3, 'rgba(170,235,255,0.42)');
  g.addColorStop(0.85, 'rgba(90,170,255,0.32)');
  g.addColorStop(1, 'rgba(200,240,255,0.7)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.035);
  ctx.strokeStyle = 'rgba(230,250,255,0.9)';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.42, y - r * 0.48, r * 0.2, r * 0.1, -0.7, 0, TAU);
  ctx.fill();
  if (!cracks.length) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.lineWidth = pass ? Math.max(1.5, r * 0.022) : Math.max(4, r * 0.06);
    ctx.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(20,40,90,0.35)';
    ctx.beginPath();
    for (const line of cracks) {
      for (const pts of line) {
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

export default {
  id: 'shatter',
  tab: 'Хрупкий шар',
  eyebrow: 'GLASS LAB',
  title: ['На каком ударе', 'стеклянный шар', 'разобьётся?'],
  lede: 'Стеклянный шар прыгает в круге, и каждый удар оставляет трещину. Сильный удар ранит больше слабого, а когда прочность кончится, шар разлетится на осколки.',
  hook: ['На каком ударе', 'шар разобьётся?'],
  params: [
    { key: 'strength', label: 'Прочность стекла', min: 10, max: 200, step: 5, value: 45 },
    { key: 'size', label: 'Размер шара', min: 40, max: 160, step: 5, value: 115 },
    { key: 'gravity', label: 'Гравитация', min: 0, max: 3000, step: 50, value: 700 },
    { key: 'kick', label: 'Сила отскока', min: 400, max: 1800, step: 25, value: 600 },
  ],
  seed: 15,
  search: { label: 'Найти сид на 16–20 секунд', target: 18 },
  arena: () => ({ x: CX - R - 40, y: CY - R - 40, w: R * 2 + 80, h: R * 2 + 80 }),

  create(p, seed, fx) {
    const r = rng(seed);
    const pr = rng((seed ^ 0x6a09e667) >>> 0); // looks only, never the physics
    const a0 = r() * TAU;
    const b = { x: CX + (r() - 0.5) * 200, y: CY - 200, vx: Math.cos(a0) * 700, vy: Math.sin(a0) * 700, r: p.size, a: 0, w: 0 };
    const cracks = [];
    let hits = 0;
    let damage = 0;
    let brokeT = -1;
    let shards = [];
    const sparks = [];
    let flash = 0;
    let lastHit = -9;

    function shatter(t, ix, iy) {
      brokeT = t;
      const shape = circlePoly(b.x, b.y, b.r, 36);
      shards = fracture(shape, ix, iy, pr, 22, 4);
      blast(shards, ix, iy, 620, b.vx * 0.35, b.vy * 0.35 - 200, pr);
      for (let i = 0; i < 46; i++) {
        const a = pr() * TAU;
        const v = 300 + pr() * 900;
        sparks.push({ x: ix, y: iy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.4 + pr() * 0.6 });
      }
      flash = 1;
      fx.note(0, 1.2, 'glass');
    }

    return {
      t: 0,
      time: 0,
      done: false,
      get finishTime() {
        return brokeT >= 0 ? brokeT : undefined;
      },
      progress() {
        return Math.min(1, damage / p.strength);
      },
      step(dt) {
        const sub = 2;
        const h = dt / sub;
        for (let s = 0; s < sub; s++) {
          this.t += h;
          if (brokeT >= 0) {
            stepShards(shards, h, p.gravity, null, { x: CX, y: CY, r: R });
            continue;
          }
          b.vy += p.gravity * h;
          b.x += b.vx * h;
          b.y += b.vy * h;
          b.a += b.w * h;
          b.w *= 0.999;
          const dx = b.x - CX;
          const dy = b.y - CY;
          const d = Math.hypot(dx, dy) || 1e-4;
          if (d + b.r < R) continue;
          const nx = dx / d;
          const ny = dy / d;
          const vn = b.vx * nx + b.vy * ny;
          b.x = CX + nx * (R - b.r - 0.5);
          b.y = CY + ny * (R - b.r - 0.5);
          if (vn <= 0) continue;
          b.vx -= 2 * vn * nx;
          b.vy -= 2 * vn * ny;
          const kick = (r() - 0.5) * 320;
          b.vx += -ny * kick;
          b.vy += nx * kick;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp < p.kick) {
            b.vx *= p.kick / sp;
            b.vy *= p.kick / sp;
          }
          // a glancing hit sets the ball spinning, so old cracks travel round
          b.w = (b.vx * -ny + b.vy * nx) / b.r * 0.35;
          hits++;
          lastHit = this.t;
          const hurt = Math.pow(vn / 1000, 2) * 2.2 * (0.6 + r() * 0.8);
          damage += hurt;
          const ix = CX + nx * R;
          const iy = CY + ny * R;
          if (damage >= p.strength) {
            shatter(this.t, ix, iy);
            continue;
          }
          const local = Math.atan2(ny, nx) - b.a;
          cracks.push(crack(b.r, local, b.r * Math.min(1.5, 0.35 + hurt / 5), pr));
          fx.note((hits % 15) + 3, 0.7);
        }
        for (let i = sparks.length - 1; i >= 0; i--) {
          const q = sparks[i];
          q.age += dt;
          q.vy += p.gravity * 0.5 * dt;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          if (q.age > q.life) sparks.splice(i, 1);
        }
        flash = Math.max(0, flash - dt * 3);
        this.time = this.t;
        if (brokeT >= 0 && this.t - brokeT >= TAIL) this.done = true;
      },

      draw(ctx) {
        ctx.save();
        ctx.shadowColor = '#7fd8ff';
        ctx.shadowBlur = 40 + flash * 60;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(CX, CY, R + 5, 0, TAU);
        ctx.stroke();
        ctx.restore();

        if (brokeT < 0) {
          glass(ctx, b.x, b.y, b.r, b.a, cracks);
          if (look.skin === 'face') {
            ctx.save();
            ctx.translate(b.x, b.y);
            const sp = Math.hypot(b.vx, b.vy) || 1;
            const fear = damage / p.strength;
            features(ctx, b.r * 0.85, {
              mood: fear > 0.55 ? 'lose' : 'idle',
              ouch: this.t - lastHit < 0.25,
              lx: b.vx / sp,
              ly: b.vy / sp,
              px: b.r,
            });
            ctx.restore();
          }
        } else {
          const at = { x: b.x, y: b.y };
          drawShards(ctx, shards, (c) => glass(c, at.x, at.y, b.r, b.a, cracks), { width: 2, color: 'rgba(235,250,255,0.85)' });
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#d8f6ff';
          ctx.lineCap = 'round';
          for (const q of sparks) {
            ctx.globalAlpha = 1 - q.age / q.life;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03);
            ctx.stroke();
          }
          ctx.restore();
        }
        if (flash > 0) {
          ctx.save();
          ctx.globalAlpha = flash * 0.2;
          ctx.fillStyle = '#e8fbff';
          ctx.beginPath();
          ctx.arc(CX, CY, R, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      },

      pills() {
        const left = Math.max(0, Math.round(100 - (damage / p.strength) * 100));
        return [{ text: `Ударов: ${hits}` }, { text: brokeT >= 0 ? 'Разбился!' : `Прочность: ${left}%` }];
      },

      banner() {
        return { lines: ['Разбился', `на ${hits}-м ударе`], color: '#7fd8ff' };
      },

      summary() {
        return {
          duration: brokeT >= 0 ? brokeT : this.t,
          sub: brokeT >= 0 ? `Разбился на ${hits}-м ударе, ${shards.length} осколков` : `Пока цел: ${hits} ударов`,
          bars: cracks.map((_, i) => ({ v: i + 1, color: '#7fd8ff' })),
        };
      },
    };
  },
};
