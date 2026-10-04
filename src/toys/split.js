import { rng, hueColor, glowSprite, fmtSec } from '../engine.js';

const CX = 540;
const CY = 1220;
const R = 460;
const HUES = 12;

export default {
  id: 'split',
  tab: 'Размножение',
  eyebrow: 'SPLIT LAB',
  title: ['Каждый отскок', 'добавляет', 'новый шарик'],
  lede: 'Сначала один шарик, через двадцать секунд сотни. Шанс копии решает, как быстро начнётся хаос.',
  hook: ['Каждый отскок =', 'новый шарик'],
  params: [
    { key: 'cap', label: 'Лимит шариков', min: 50, max: 800, step: 10, value: 400 },
    { key: 'chance', label: 'Шанс копии', min: 0.05, max: 1, step: 0.05, value: 0.2 },
    { key: 'size', label: 'Размер шарика', min: 6, max: 24, step: 1, value: 12 },
    { key: 'gravity', label: 'Гравитация', min: 0, max: 2500, step: 50, value: 1200 },
    { key: 'kick', label: 'Сила отскока', min: 500, max: 1600, step: 25, value: 1000 },
  ],
  seed: 777,
  search: { label: 'Найти сид на 16–20 секунд', target: 18 },
  battle: { hook: (p) => ['Где первым', `будет ${p.cap} шариков?`], seeds: [41661, 14594, 5985] },
  arena: () => ({ x: CX - R - 40, y: CY - R - 40, w: R * 2 + 80, h: R * 2 + 80 }),

  create(p, seed, fx) {
    const r = rng(seed);
    const a0 = r() * Math.PI * 2;
    const balls = [{ x: CX, y: CY - 200, vx: Math.cos(a0) * 600, vy: Math.sin(a0) * 600, h: 0 }];
    const perSec = [];
    let capT = -1;
    let lastNote = -1;

    return {
      t: 0,
      time: 0,
      done: false,
      // battle mode: the lane finishes when the cap is hit, not 2 s later
      get finishTime() {
        return capT >= 0 ? capT : undefined;
      },
      progress() {
        return balls.length / p.cap;
      },
      step(dt) {
        this.t += dt;
        const n = balls.length;
        const lim = R - p.size;
        for (let i = 0; i < n; i++) {
          const b = balls[i];
          b.vy += p.gravity * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          const dx = b.x - CX;
          const dy = b.y - CY;
          const d2 = dx * dx + dy * dy;
          if (d2 < lim * lim) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          b.x = CX + nx * (lim - 0.5);
          b.y = CY + ny * (lim - 0.5);
          const vn = b.vx * nx + b.vy * ny;
          if (vn <= 0) continue;
          b.vx -= 2 * vn * nx;
          b.vy -= 2 * vn * ny;
          const kick = (r() - 0.5) * 260;
          b.vx += -ny * kick;
          b.vy += nx * kick;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp < p.kick) {
            b.vx *= p.kick / sp;
            b.vy *= p.kick / sp;
          }
          if (balls.length < p.cap && r() < p.chance) {
            const turn = (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.4);
            const c = Math.cos(turn);
            const s = Math.sin(turn);
            balls.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, h: (b.h + 1) % HUES });
            if (this.t - lastNote > 0.06) {
              lastNote = this.t;
              fx.note(Math.min(22, 2 + Math.floor(Math.log2(balls.length) * 2)), 0.55);
            }
            if (balls.length >= p.cap && capT < 0) {
              capT = this.t;
              fx.note(22, 1, 'square');
            }
          }
        }
        const sec = Math.floor(this.t);
        perSec[sec] = balls.length;
        this.time = this.t;
        if (capT >= 0 && this.t - capT > 2) this.done = true;
      },

      draw(ctx) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.shadowColor = '#7f6bff';
        ctx.shadowBlur = 36;
        ctx.beginPath();
        ctx.arc(CX, CY, R + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glow = p.size * 2.2;
        for (const b of balls) {
          const spr = glowSprite(hueColor(b.h * 30), p.size);
          ctx.drawImage(spr, b.x - glow, b.y - glow, glow * 2, glow * 2);
        }
        ctx.restore();
        for (const b of balls) {
          ctx.fillStyle = hueColor(b.h * 30);
          ctx.beginPath();
          ctx.arc(b.x, b.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      },

      pills() {
        return [{ text: `Шариков: ${balls.length}` }, { text: fmtSec(this.t) }];
      },

      banner() {
        return { lines: [`${p.cap} шариков`, 'за ' + fmtSec(capT)], color: '#ffd23f' };
      },

      summary() {
        const bars = [];
        for (let i = 0; i < perSec.length; i++) bars.push({ v: perSec[i] || 0, color: hueColor(i * 30) });
        return {
          duration: this.t,
          sub: `Лимит ${p.cap} набран на ${fmtSec(Math.max(0, capT))} · шанс копии ${Math.round(p.chance * 100)}%`,
          bars,
        };
      },
    };
  },
};
