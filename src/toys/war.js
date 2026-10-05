import { rng, TEAM, ball, shade, fmtClock } from '../engine.js';

const FX = 60;
const FY = 640;
const FW = 960;
const FH = 1180;
const TEAMS = [0, 1, 2, 3]; // red, blue, yellow, green

export default {
  id: 'war',
  tab: 'Война цветов',
  eyebrow: 'COLOR WAR',
  title: ['Война цветов:', 'кто захватит', 'всё поле?'],
  lede: 'Каждый шарик перекрашивает чужие клетки и отскакивает. Подбери сид, где исход решается в последние секунды.',
  hook: ['Какой цвет', 'захватит поле?'],
  params: [
    { key: 'teams', label: 'Команд', min: 2, max: 4, step: 1, value: 4 },
    { key: 'cell', label: 'Размер клетки', min: 24, max: 64, step: 4, value: 40 },
    { key: 'speed', label: 'Скорость', min: 400, max: 1600, step: 50, value: 850 },
    { key: 'balls', label: 'Шариков у команды', min: 1, max: 3, step: 1, value: 1 },
    { key: 'duration', label: 'Длительность, с', min: 10, max: 60, step: 1, value: 20 },
  ],
  seed: 31337,
  search: { label: 'Найти сид с близким финишем', score: (sim) => sim.margin() },

  create(p, seed, fx) {
    const r = rng(seed);
    const s = p.cell;
    const cols = Math.floor(FW / s);
    const rows = Math.floor(FH / s);
    const ox = FX + (FW - cols * s) / 2;
    const oy = FY + (FH - rows * s) / 2;
    const T = p.teams;
    const grid = new Uint8Array(cols * rows);
    const counts = new Array(T).fill(0);

    const owner = (i, j) => {
      if (T === 2) return i < cols / 2 ? 0 : 1;
      if (T === 3) return Math.min(2, Math.floor((i * 3) / cols));
      return (i < cols / 2 ? 0 : 1) + (j < rows / 2 ? 0 : 2);
    };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const t = owner(i, j);
        grid[j * cols + i] = t;
        counts[t]++;
      }
    }

    const br = s * 0.42;
    const balls = [];
    for (let t = 0; t < T; t++) {
      // centre of this team's starting area
      let si = 0;
      let sj = 0;
      let n = 0;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++)
          if (grid[j * cols + i] === t) {
            si += i;
            sj += j;
            n++;
          }
      for (let k = 0; k < p.balls; k++) {
        const a = Math.PI / 4 + Math.floor(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.5;
        balls.push({
          t,
          x: ox + (si / n + 0.5 + (r() - 0.5) * 3) * s,
          y: oy + (sj / n + 0.5 + (r() - 0.5) * 3) * s,
          vx: Math.cos(a) * p.speed,
          vy: Math.sin(a) * p.speed,
        });
      }
    }

    const lastNote = new Array(T).fill(-1);
    const cellColor = TEAMS.map((t) => shade(TEAM[t].color, -0.45));

    const sim = {
      t: 0,
      time: 0,
      done: false,
      counts,
      step(dt) {
        const sub = 3;
        const h = dt / sub;
        for (let q = 0; q < sub; q++) {
          this.t += h;
          for (const b of balls) {
            b.x += b.vx * h;
            b.y += b.vy * h;
            let bounced = false;
            if (b.x - br < ox) {
              b.x = ox + br;
              b.vx = Math.abs(b.vx);
              bounced = true;
            } else if (b.x + br > ox + cols * s) {
              b.x = ox + cols * s - br;
              b.vx = -Math.abs(b.vx);
              bounced = true;
            }
            if (b.y - br < oy) {
              b.y = oy + br;
              b.vy = Math.abs(b.vy);
              bounced = true;
            } else if (b.y + br > oy + rows * s) {
              b.y = oy + rows * s - br;
              b.vy = -Math.abs(b.vy);
              bounced = true;
            }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const i = Math.floor((b.x + dx * br - ox) / s);
              const j = Math.floor((b.y + dy * br - oy) / s);
              if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
              const k = j * cols + i;
              if (grid[k] === b.t) continue;
              counts[grid[k]]--;
              counts[b.t]++;
              grid[k] = b.t;
              if (dx) b.vx = -dx * Math.abs(b.vx);
              else b.vy = -dy * Math.abs(b.vy);
              bounced = true;
              if (this.t - lastNote[b.t] > 0.07) {
                lastNote[b.t] = this.t;
                fx.note(3 + b.t * 3 + ((i + j) % 3), 0.45);
              }
            }
            if (bounced) {
              // a tiny turn on every bounce keeps balls out of endless loops
              let a = Math.atan2(b.vy, b.vx) + (r() - 0.5) * 0.06;
              const m = Math.PI / 2;
              const rel = ((a % m) + m) % m;
              if (rel < 0.2) a += 0.2 - rel;
              if (rel > m - 0.2) a -= rel - (m - 0.2);
              b.vx = Math.cos(a) * p.speed;
              b.vy = Math.sin(a) * p.speed;
            }
          }
        }
        this.time = this.t;
        if (this.t >= p.duration) this.done = true;
      },

      ranking() {
        return counts.map((c, t) => ({ t, c })).sort((a, b) => b.c - a.c);
      },
      margin() {
        const [a, b] = this.ranking();
        return (a.c - b.c) / (cols * rows);
      },

      draw(ctx) {
        const pad = Math.max(2, s * 0.06);
        for (let t = 0; t < T; t++) {
          ctx.fillStyle = cellColor[t];
          for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
              if (grid[j * cols + i] === t) ctx.fillRect(ox + i * s + pad / 2, oy + j * s + pad / 2, s - pad, s - pad);
            }
          }
        }
        for (const b of balls) {
          ctx.fillStyle = '#08071a';
          ctx.beginPath();
          ctx.arc(b.x, b.y, br + 7, 0, Math.PI * 2);
          ctx.fill();
          ball(ctx, b.x, b.y, br, shade(TEAM[TEAMS[b.t]].color, 0.25), b);
        }
        // territory bar under the field
        const total = cols * rows;
        let x = FX;
        const y = FY + FH + 40;
        for (const { t, c } of counts.map((c, t) => ({ t, c }))) {
          const w = (c / total) * FW;
          ctx.fillStyle = TEAM[TEAMS[t]].color;
          ctx.fillRect(x, y, w, 26);
          x += w;
        }
      },

      pills() {
        const total = cols * rows;
        return counts
          .map((c, t) => ({ text: Math.round((c / total) * 100) + '%', color: TEAM[TEAMS[t]].color }))
          .concat([{ text: fmtClock(Math.max(0, p.duration - this.t)) }]);
      },

      banner() {
        const [a] = this.ranking();
        const pct = Math.round((a.c / (cols * rows)) * 100);
        return { lines: ['Победил', `${TEAM[TEAMS[a.t]].name} · ${pct}%`], color: TEAM[TEAMS[a.t]].color };
      },

      summary() {
        const [a, b] = this.ranking();
        const total = cols * rows;
        const pa = Math.round((a.c / total) * 100);
        const pb = Math.round((b.c / total) * 100);
        return {
          duration: p.duration,
          sub: `Победил ${TEAM[TEAMS[a.t]].name.toLowerCase()}: ${pa}% поля · второй ${TEAM[TEAMS[b.t]].name.toLowerCase()}: ${pb}%`,
          bars: counts.map((c, t) => ({ v: c, color: TEAM[TEAMS[t]].color })),
        };
      },
    };
    return sim;
  },
};
