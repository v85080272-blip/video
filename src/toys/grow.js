import { rng, hueColor, fmtSec, ball } from '../engine.js';
import { look, heroColor } from '../scene.js';

const CX = 540;
const CY = 1220;

export default {
  id: 'grow',
  tab: 'Растущий шар',
  eyebrow: 'GROW LAB',
  title: ['Шарик растёт', 'с каждым', 'отскоком'],
  lede: 'Каждый удар о стенку делает шарик больше, а удары всё чаще. Финал сам ускоряется, остаётся подобрать длину.',
  hook: ['Заполнит ли шарик', 'весь круг?'],
  params: [
    { key: 'growth', label: 'Рост за отскок', min: 1, max: 12, step: 0.5, value: 4 },
    { key: 'start', label: 'Стартовый размер', min: 10, max: 80, step: 2, value: 22 },
    { key: 'arena', label: 'Размер круга', min: 300, max: 480, step: 10, value: 440 },
    { key: 'gravity', label: 'Гравитация', min: 0, max: 3000, step: 50, value: 1800 },
    { key: 'kick', label: 'Сила отскока', min: 500, max: 1800, step: 25, value: 1100 },
  ],
  seed: 4242,
  search: { label: 'Найти сид на 16–20 секунд', target: 18 },
  battle: { hook: ['Какой шарик', 'заполнит круг первым?'], seeds: [21984, 5381, 92399] },
  arena: (p) => ({ x: CX - p.arena - 40, y: CY - p.arena - 40, w: p.arena * 2 + 80, h: p.arena * 2 + 80 }),

  create(p, seed, fx) {
    const r = rng(seed);
    const R = p.arena;
    const a0 = r() * Math.PI * 2;
    const b = {
      x: CX + (r() - 0.5) * R * 0.3,
      y: CY - R * 0.35,
      vx: Math.cos(a0) * 700,
      vy: Math.sin(a0) * 700,
      r: p.start,
    };
    const ghosts = [];
    const perSec = [];
    let bounces = 0;
    let hue = 190;

    return {
      t: 0,
      time: 0,
      done: false,
      step(dt) {
        const sub = 2;
        const h = dt / sub;
        for (let s = 0; s < sub && !this.done; s++) {
          this.t += h;
          b.vy += p.gravity * h;
          b.x += b.vx * h;
          b.y += b.vy * h;
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
          bounces++;
          hue += 23;
          perSec[Math.floor(this.t)] = (perSec[Math.floor(this.t)] || 0) + 1;
          ghosts.push({ x: b.x, y: b.y, r: b.r, hue });
          if (ghosts.length > 28) ghosts.shift();
          fx.note(bounces % 15 + 3, 0.7);
          b.r += p.growth;
          if (b.r >= R - 2) {
            b.r = R;
            b.x = CX;
            b.y = CY;
            this.done = true;
            fx.note(20, 1, 'square');
          }
        }
        this.time = this.t;
      },

      draw(ctx) {
        ctx.save();
        ctx.lineWidth = 3;
        for (let i = 0; i < ghosts.length; i++) {
          const g = ghosts[i];
          ctx.globalAlpha = ((i + 1) / ghosts.length) * 0.5;
          ctx.strokeStyle = hueColor(g.hue);
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.shadowColor = hueColor(hue);
        ctx.shadowBlur = 40;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(CX, CY, R + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        const col = hueColor(hue);
        if (look.skin !== 'glossy') {
          ball(ctx, b.x, b.y, b.r, heroColor(col), b);
          return;
        }
        const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.05, b.x, b.y, b.r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.2, col);
        g.addColorStop(1, hueColor(hue + 40));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        if (b.r > 70) {
          ctx.fillStyle = 'rgba(8,7,26,0.75)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `900 ${Math.round(b.r * 0.55)}px "Rubik", "Arial Black", sans-serif`;
          ctx.fillText(String(bounces), b.x, b.y + 4);
          ctx.textBaseline = 'alphabetic';
        }
      },

      progress() {
        return (b.r - p.start) / (R - p.start);
      },

      pills() {
        const fill = Math.round(Math.pow(b.r / R, 2) * 100);
        return [{ text: `Отскоков: ${bounces}` }, { text: `Заполнено: ${fill}%` }];
      },

      banner() {
        return { lines: ['Заполнил круг', 'за ' + fmtSec(this.t)], color: hueColor(hue) };
      },

      summary() {
        const bars = [];
        for (let i = 0; i < Math.ceil(this.t); i++) bars.push({ v: perSec[i] || 0, color: hueColor(190 + i * 23) });
        return {
          duration: this.t,
          sub: `Отскоков: ${bounces} · рост ${String(p.growth).replace('.', ',')} px за удар`,
          bars,
        };
      },
    };
  },
};
