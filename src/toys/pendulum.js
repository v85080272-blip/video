import { hueColor, glowSprite, fmtClock } from '../engine.js';

const PX = 540;
const PY = 660;
const LONGEST = 1100;

export default {
  id: 'pendulum',
  tab: 'Маятники',
  eyebrow: 'PENDULUM WAVE',
  title: ['Маятники', 'расходятся', 'и снова сходятся'],
  lede: 'У каждого маятника свой период, поэтому они рисуют волны и змейки, а в конце цикла снова выстраиваются в линию.',
  hook: ['Смотри, как они', 'снова сойдутся'],
  params: [
    { key: 'n', label: 'Маятников', min: 8, max: 24, step: 1, value: 15 },
    { key: 'cycle', label: 'Полный цикл, с', min: 10, max: 90, step: 1, value: 30 },
    { key: 'k', label: 'Колебаний у медленного', min: 6, max: 40, step: 1, value: 12 },
    { key: 'amp', label: 'Размах, °', min: 10, max: 60, step: 1, value: 26 },
  ],
  seed: null,
  search: null,

  create(p, seed, fx) {
    const A = (p.amp * Math.PI) / 180;
    const pend = [];
    const T0 = p.cycle / p.k;
    // real pendulums: length grows with the square of the period;
    // the longest one is capped so the widest swing stays in frame
    const longest = Math.min(LONGEST, 470 / Math.sin(A));
    for (let i = 0; i < p.n; i++) {
      const T = p.cycle / (p.k + i);
      pend.push({ T, L: longest * Math.pow(T / T0, 2), c: hueColor((i / p.n) * 300), side: 1, trail: [] });
    }

    return {
      t: 0,
      time: 0,
      done: false,
      step(dt) {
        this.t += dt;
        pend.forEach((q, i) => {
          const side = Math.sin((2 * Math.PI * this.t) / q.T) >= 0 ? 1 : -1;
          if (side !== q.side) {
            q.side = side;
            fx.note(i % 20 + 2, 0.5, 'sine');
          }
        });
        this.time = this.t;
        if (this.t >= p.cycle) this.done = true;
      },

      draw(ctx) {
        const pos = pend.map((q) => {
          const th = A * Math.cos((2 * Math.PI * this.t) / q.T);
          return [PX + Math.sin(th) * q.L, PY + Math.cos(th) * q.L];
        });

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 2;
        for (const q of pend) {
          ctx.beginPath();
          ctx.arc(PX, PY, q.L, Math.PI / 2 - A, Math.PI / 2 + A);
          ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [x, y] of pos) {
          ctx.moveTo(PX, PY);
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        // the "snake" through every bob
        ctx.strokeStyle = 'rgba(255,210,63,0.55)';
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();

        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(PX - 70, PY - 10, 140, 14);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        pend.forEach((q, i) => {
          const [x, y] = pos[i];
          q.trail.push(x, y);
          if (q.trail.length > 20) q.trail.splice(0, 2);
          ctx.strokeStyle = q.c + '66';
          ctx.lineWidth = 14;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(q.trail[0], q.trail[1]);
          for (let k = 2; k < q.trail.length; k += 2) ctx.lineTo(q.trail[k], q.trail[k + 1]);
          ctx.stroke();
          const g = glowSprite(q.c, 26);
          ctx.drawImage(g, x - 60, y - 60, 120, 120);
        });
        ctx.restore();
        pend.forEach((q, i) => {
          const [x, y] = pos[i];
          ctx.fillStyle = q.c;
          ctx.beginPath();
          ctx.arc(x, y, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.arc(x - 7, y - 7, 7, 0, Math.PI * 2);
          ctx.fill();
        });
      },

      pills() {
        return [{ text: `${fmtClock(this.t)} / ${fmtClock(p.cycle)}` }, { text: `Маятников: ${p.n}` }];
      },

      banner() {
        return { lines: ['Через ' + p.cycle + ' с', 'снова в линию'], color: '#ffd23f' };
      },

      summary() {
        return {
          duration: p.cycle,
          sub: `Медленный качнётся ${p.k} раз, быстрый ${p.k + p.n - 1} раз за цикл`,
          bars: pend.map((q, i) => ({ v: p.k + i, color: q.c })),
        };
      },
    };
  },
};
