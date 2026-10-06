import { rng, fmtSec, DISPLAY } from '../engine.js';
import { look, features, shade } from '../scene.js';

// Five soft balls, elasticity 0% to 100%, under one press that pushes each
// through a hole narrower than the ball. Soft ones squeeze through like
// dough; stiff ones can't bend that far and pop. Soft bodies are rings of
// points held by shape matching (stiffness), edges and an area constraint.

const TAU = Math.PI * 2;
const COLS = 5;
const CW = 216;
const FW = 98; // half width of a column
const Y0 = 660; // top of the column walls
const Y2 = 1250; // the shelf with the hole
const FLOOR = 1760;
const WALL = 8;
const PR = 3;
const N = 40;
const SUB = 3;
const ITER = 6;
const ELASTIC = [0, 0.25, 0.5, 0.75, 1];
const COLORS = ['#ff4d5e', '#ff8c3a', '#ffd23f', '#9be35a', '#3ddc6f'];
const LIMIT = [0.045, 0.1, 0.6, Infinity, Infinity]; // deformation each one survives
const T0 = 1; // the press starts after a beat
const PLUNGE = 1.2;

function makeBlob(i, R, r) {
  const cx = CW / 2 + i * CW;
  const cy = Y2 - WALL - PR - R - 2;
  const e = ELASTIC[i];
  const b = {
    i,
    cx,
    e,
    color: COLORS[i],
    x: [],
    y: [],
    ox: [],
    oy: [],
    qx: [],
    qy: [],
    gx: [],
    gy: [],
    R,
    alpha: 0.5 * (1 - e) * (1 - e) + 0.004,
    stretch: 0.04 + 0.5 * (1 - e) * (1 - e),
    state: 'in',
    at: -1,
    deform: 0,
    drops: [],
    landed: false,
  };
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU + (r() - 0.5) * 0.02;
    const qx = Math.cos(a) * R;
    const qy = Math.sin(a) * R;
    b.qx.push(qx);
    b.qy.push(qy);
    b.x.push(cx + qx);
    b.y.push(cy + qy);
    b.ox.push(cx + qx);
    b.oy.push(cy + qy);
  }
  b.L0 = 2 * R * Math.sin(Math.PI / N);
  b.A0 = area(b);
  return b;
}

function area(b) {
  let a = 0;
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N;
    a += b.x[k] * b.y[j] - b.x[j] * b.y[k];
  }
  return a / 2;
}

function centre(b) {
  let x = 0;
  let y = 0;
  for (let k = 0; k < N; k++) {
    x += b.x[k];
    y += b.y[k];
  }
  return [x / N, y / N];
}

function shapeMatch(b) {
  const [cx, cy] = centre(b);
  let A = 0;
  let B = 0;
  for (let k = 0; k < N; k++) {
    const px = b.x[k] - cx;
    const py = b.y[k] - cy;
    A += b.qx[k] * px + b.qy[k] * py;
    B += b.qx[k] * py - b.qy[k] * px;
  }
  const th = Math.atan2(B, A);
  const c = Math.cos(th);
  const s = Math.sin(th);
  for (let k = 0; k < N; k++) {
    b.gx[k] = cx + b.qx[k] * c - b.qy[k] * s;
    b.gy[k] = cy + b.qx[k] * s + b.qy[k] * c;
    b.x[k] += (b.gx[k] - b.x[k]) * b.alpha;
    b.y[k] += (b.gy[k] - b.y[k]) * b.alpha;
  }
}

function edges(b) {
  for (let k = 0; k < N; k++) {
    const j = (k + 1) % N;
    const dx = b.x[j] - b.x[k];
    const dy = b.y[j] - b.y[k];
    const d = Math.hypot(dx, dy) || 1e-6;
    const diff = d - b.L0;
    // rubber stretches easily but hardly squashes, so points stay spread out
    const k2 = (diff > 0 ? b.stretch : 0.5) * 0.5 * (diff / d);
    b.x[k] += dx * k2;
    b.y[k] += dy * k2;
    b.x[j] -= dx * k2;
    b.y[j] -= dy * k2;
  }
}

function keepArea(b) {
  const C = area(b) - b.A0;
  let sum = 0;
  const gx = [];
  const gy = [];
  for (let k = 0; k < N; k++) {
    const nx = (k + 1) % N;
    const pv = (k + N - 1) % N;
    gx[k] = 0.5 * (b.y[nx] - b.y[pv]);
    gy[k] = 0.5 * (b.x[pv] - b.x[nx]);
    sum += gx[k] * gx[k] + gy[k] * gy[k];
  }
  if (sum < 1e-9) return;
  const lam = (-C / sum) * 0.9;
  for (let k = 0; k < N; k++) {
    b.x[k] += lam * gx[k];
    b.y[k] += lam * gy[k];
  }
}

// segments of one column: side walls above and below the shelf, the shelf
// on both sides of the hole
function walls(cx, hole) {
  return [
    [cx - FW, Y0, cx - FW, FLOOR],
    [cx + FW, Y0, cx + FW, FLOOR],
    [cx - FW, Y2, cx - hole, Y2],
    [cx + hole, Y2, cx + FW, Y2],
  ];
}

function collide(b, segs, press, tip, plunger) {
  for (let k = 0; k < N; k++) {
    let x = b.x[k];
    let y = b.y[k];
    for (const [ax, ay, bx, by] of segs) {
      const ex = bx - ax;
      const ey = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)));
      const px = ax + ex * t;
      const py = ay + ey * t;
      const dx = x - px;
      const dy = y - py;
      const d = Math.hypot(dx, dy);
      const min = WALL + PR;
      if (d < min && d > 1e-6) {
        x = px + (dx / d) * min;
        y = py + (dy / d) * min;
        // a little grip on the walls
        b.ox[k] += (x - b.ox[k]) * 0.2;
        b.oy[k] += (y - b.oy[k]) * 0.2;
      }
    }
    if (y < press + PR) y = press + PR;
    if (y < tip + PR && Math.abs(x - b.cx) < plunger) y = tip + PR;
    b.x[k] = x;
    b.y[k] = y;
  }
}

// Squeezed between the press and the shelf, the ball flows sideways into the
// hole like dough, instead of staying pinned in the gap.
function flow(b, span) {
  for (let k = 0; k < N; k++) {
    const dx = b.cx - b.x[k];
    if (b.y[k] > Y2 - WALL - 30 && b.y[k] < Y2 + WALL && Math.abs(dx) > span) {
      b.x[k] += Math.sign(dx) * 0.7;
    }
  }
}

// Through the hole, the ball stops being a pressed soft body: it falls as one
// piece, eases back to round and wobbles like jelly when it lands.
function release(b) {
  const [cx, cy] = centre(b);
  b.c = { x: cx, y: cy, vy: 300 };
  b.sx = b.x.map((x) => x - cx);
  b.sy = b.y.map((y) => y - cy);
  b.wob = 0;
  b.wobT = 0;
}

// returns true on the first touch of the floor
function fall(b, dt, g, t) {
  const c = b.c;
  let landed = false;
  c.vy += g * dt;
  c.y += c.vy * dt;
  const k = 1 - Math.exp(-dt * (4 + 8 * (1 - b.e)));
  for (let i = 0; i < N; i++) {
    b.sx[i] += (b.qx[i] - b.sx[i]) * k;
    b.sy[i] += (b.qy[i] - b.sy[i]) * k;
  }
  if (c.y + b.R > FLOOR - PR) {
    c.y = FLOOR - PR - b.R;
    if (c.vy > 150) {
      b.wob = Math.min(0.32, c.vy / 3500) * (0.6 + b.e * 0.6);
      b.wobT = t;
      landed = !b.landed;
      b.landed = true;
    }
    c.vy = 0;
  }
  const w = b.wob * Math.exp(-(t - b.wobT) * 3) * Math.cos((t - b.wobT) * 20);
  for (let i = 0; i < N; i++) {
    b.x[i] = c.x + b.sx[i] * (1 + w);
    // squash around the bottom, so the jelly stays on the floor
    b.y[i] = Math.min(FLOOR - PR, c.y + b.R * w + b.sy[i] * (1 - w));
  }
  return landed;
}

function deformation(b) {
  let s = 0;
  for (let k = 0; k < N; k++) s += Math.hypot(b.x[k] - b.gx[k], b.y[k] - b.gy[k]);
  return s / N / b.R;
}

function blobPath(ctx, b) {
  ctx.beginPath();
  for (let k = 0; k <= N; k++) {
    const a = k % N;
    const n = (k + 1) % N;
    const mx = (b.x[a] + b.x[n]) / 2;
    const my = (b.y[a] + b.y[n]) / 2;
    if (k === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(b.x[a], b.y[a], mx, my);
  }
  ctx.closePath();
}

export default {
  id: 'squish',
  tab: 'Эластичность',
  eyebrow: 'SQUISH LAB',
  title: ['Эластичность', 'от 0% до 100%:', 'кто пролезет?'],
  lede: 'Пресс давит пять шариков в дырку уже их самих. Мягкие протискиваются, как тесто, и выпадают снизу. Жёсткие не могут так сжаться и лопаются.',
  hook: ['Эластичность 0–100%:', 'кто пролезет?'],
  params: [
    { key: 'hole', label: 'Ширина дырки', min: 30, max: 120, step: 2, value: 74 },
    { key: 'size', label: 'Размер шарика', min: 50, max: 90, step: 2, value: 74 },
    { key: 'speed', label: 'Скорость пресса', min: 5, max: 60, step: 1, value: 16 },
    { key: 'gravity', label: 'Гравитация', min: 300, max: 3000, step: 50, value: 1400 },
  ],
  seed: 3,

  create(p, seed, fx) {
    const r = rng(seed);
    const hole = p.hole / 2;
    const blobs = ELASTIC.map((_, i) => makeBlob(i, p.size, r));
    const segs = blobs.map((b) => walls(b.cx, hole));
    const start = Y2 - WALL - p.size * 2 - 40;
    const stop = Y2 - WALL - PR - 4;
    const plunger = hole - 6;
    const tipEnd = Y2 + WALL + 70;
    let lastEvent = 0;

    return {
      t: 0,
      time: 0,
      done: false,
      press: start,
      tip: start,
      blobs,
      progress() {
        return blobs.filter((b) => b.state !== 'in').length / COLS;
      },
      step(dt) {
        this.t += dt;
        // the head comes down to the shelf, then its rod plunges through the
        // hole to push the rest out, holds, and everything goes back up
        const down = (stop - start) / p.speed;
        const u = this.t - T0;
        const back = u - down - PLUNGE - 0.4;
        if (u < down) {
          this.press = start + Math.max(0, u) * p.speed;
          this.tip = this.press;
        } else if (back < 0) {
          this.press = stop;
          this.tip = stop + Math.min(1, (u - down) / PLUNGE) * (tipEnd - stop);
        } else {
          this.tip = Math.max(stop, tipEnd - back * 400);
          const up = back - (tipEnd - stop) / 400;
          this.press = up > 0 ? Math.max(start, stop - up * 300) : stop;
          if (this.tip < this.press) this.tip = this.press;
        }
        const h = dt / SUB;
        for (const b of blobs) {
          for (const d of b.drops) {
            d.vy += p.gravity * dt;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
          }
          if (b.state === 'popped') continue;
          if (b.state === 'out') {
            if (fall(b, dt, p.gravity, this.t)) {
              lastEvent = Math.max(lastEvent, this.t);
              fx.note(0, 0.6, 'thud');
            }
            continue;
          }
          for (let s = 0; s < SUB; s++) {
            for (let k = 0; k < N; k++) {
              const vx = (b.x[k] - b.ox[k]) * 0.996;
              const vy = (b.y[k] - b.oy[k]) * 0.996;
              b.ox[k] = b.x[k];
              b.oy[k] = b.y[k];
              b.x[k] += vx;
              b.y[k] += vy + p.gravity * h * h;
            }
            for (let it = 0; it < ITER; it++) {
              shapeMatch(b);
              edges(b);
              keepArea(b);
              collide(b, segs[b.i], this.press, this.tip, plunger);
              if (this.press > Y2 - WALL - b.R) flow(b, this.tip > this.press + 1 ? plunger : hole - 4);
            }
          }
          b.deform = deformation(b);
          if (b.state === 'in') {
            if (b.deform > LIMIT[b.i]) {
              b.state = 'popped';
              b.at = this.t;
              lastEvent = this.t;
              const [cx, cy] = centre(b);
              for (let k = 0; k < N; k += 2) {
                const dx = b.x[k] - cx;
                const dy = b.y[k] - cy;
                const d = Math.hypot(dx, dy) || 1;
                const v = 350 + r() * 450;
                b.drops.push({ x: b.x[k], y: b.y[k], vx: (dx / d) * v, vy: (dy / d) * v - 250, s: 6 + r() * 10 });
              }
              fx.note(0, 0.9, 'smash');
            } else if (b.y.filter((y) => y > Y2 + WALL).length >= N * 0.7) {
              b.state = 'out';
              b.at = this.t;
              release(b);
              lastEvent = this.t;
              fx.note(8 + b.i * 2, 1);
            }
          }
        }
        const settled = blobs.every((b) => b.state === 'popped' || b.landed);
        if ((settled && this.t - lastEvent > 1.6) || this.t > 40) this.done = true;
        this.time = this.t;
      },

      draw(ctx) {
        // the press: one bar, a rod and a head per column
        const top = this.press - (start - (Y0 - 30));
        ctx.save();
        const steel = ctx.createLinearGradient(0, top - 60, 0, top + 10);
        steel.addColorStop(0, '#c9cede');
        steel.addColorStop(1, '#5d6378');
        ctx.fillStyle = '#4a4f63';
        ctx.fillRect(500, 0, 80, Math.max(0, top - 40));
        ctx.fillStyle = steel;
        ctx.beginPath();
        ctx.roundRect(20, top - 60, 1040, 60, 14);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(20, top - 22, 1040, 22, [0, 0, 14, 14]);
        ctx.clip();
        for (let x = 20; x < 1060; x += 44) {
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x + 22, top - 22);
          ctx.lineTo(x + 44, top - 22);
          ctx.lineTo(x + 22, top);
          ctx.fill();
        }
        ctx.restore();
        for (const b of blobs) {
          ctx.fillStyle = '#7d8398';
          ctx.fillRect(b.cx - 14, top, 28, this.press - top - 26);
          const head = ctx.createLinearGradient(0, this.press - 28, 0, this.press);
          head.addColorStop(0, '#dfe3ee');
          head.addColorStop(1, '#6a7086');
          ctx.fillStyle = head;
          ctx.beginPath();
          ctx.roundRect(b.cx - FW + WALL + 2, this.press - 28, (FW - WALL - 2) * 2, 28, 8);
          ctx.fill();
        }
        ctx.restore();

        // column glass and the shelf
        for (const b of blobs) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(b.cx - FW, Y0, FW * 2, Y2 - Y0);
          ctx.fillStyle = 'rgba(200,220,255,0.35)';
          ctx.fillRect(b.cx - FW - 3, Y0, 6, FLOOR - Y0);
          ctx.fillRect(b.cx + FW - 3, Y0, 6, FLOOR - Y0);
          const shelf = ctx.createLinearGradient(0, Y2 - WALL, 0, Y2 + WALL);
          shelf.addColorStop(0, '#e9ecf5');
          shelf.addColorStop(1, '#8a90a6');
          ctx.fillStyle = shelf;
          ctx.beginPath();
          ctx.roundRect(b.cx - FW, Y2 - WALL, FW - hole, WALL * 2, [0, WALL, WALL, 0]);
          ctx.roundRect(b.cx + hole, Y2 - WALL, FW - hole, WALL * 2, [WALL, 0, 0, WALL]);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(200,220,255,0.35)';
        ctx.fillRect(0, FLOOR, 1080, 5);

        for (const b of blobs) {
          if (b.state !== 'popped') {
            const [cx, cy] = centre(b);
            const g = ctx.createRadialGradient(cx - b.R * 0.4, cy - b.R * 0.5, 4, cx, cy, b.R * 1.3);
            g.addColorStop(0, shade(b.color, 0.55));
            g.addColorStop(0.55, b.color);
            g.addColorStop(1, shade(b.color, -0.35));
            ctx.fillStyle = g;
            blobPath(ctx, b);
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = shade(b.color, -0.5);
            ctx.stroke();
            if (look.skin === 'face') {
              ctx.save();
              ctx.translate(cx, cy);
              const squeezed = b.state === 'in' && b.deform > 0.03;
              features(ctx, b.R * 0.62, {
                mood: b.state === 'out' ? 'win' : squeezed ? 'lose' : 'idle',
                ouch: b.state === 'in' && b.deform > 0.08,
                lx: 0,
                ly: b.state === 'in' ? 0.6 : 0,
                px: b.R,
                phase: b.i * 1.9,
              });
              ctx.restore();
            }
          }
          if (b.drops.length) {
            const f = Math.max(0, 1 - (this.t - b.at) / 1.1);
            ctx.globalAlpha = f;
            ctx.fillStyle = b.color;
            for (const d of b.drops) {
              ctx.beginPath();
              ctx.arc(d.x, d.y, d.s * (0.6 + 0.4 * f), 0, TAU);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
          }
        }

        ctx.textAlign = 'center';
        for (const b of blobs) {
          ctx.font = `900 54px ${DISPLAY}`;
          ctx.fillStyle = b.color;
          ctx.fillText(Math.round(b.e * 100) + '%', b.cx, FLOOR + 82);
          if (b.state === 'in') continue;
          const since = this.t - b.at;
          const s = Math.min(1, since / 0.15) + Math.sin(Math.min(1, since / 0.3) * Math.PI) * 0.2;
          ctx.save();
          ctx.translate(b.cx, Y2 + 70);
          ctx.rotate(-0.08);
          ctx.scale(s, s);
          ctx.font = `900 36px ${DISPLAY}`;
          const text = b.state === 'popped' ? 'ЛОПНУЛ' : 'ПРОЛЕЗ';
          ctx.lineWidth = 10;
          ctx.lineJoin = 'round';
          ctx.strokeStyle = 'rgba(8,7,26,0.85)';
          ctx.strokeText(text, 0, 0);
          ctx.fillStyle = b.state === 'popped' ? '#ff4d5e' : '#3ddc6f';
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      },

      pills() {
        const out = blobs.filter((b) => b.state !== 'in' && b.state !== 'popped').length;
        const pop = blobs.filter((b) => b.state === 'popped').length;
        return [{ text: `Пролезли: ${out}` }, { text: `Лопнули: ${pop}` }];
      },

      banner() {
        const out = blobs.filter((b) => b.state === 'out').length;
        return { lines: ['Пролезли', `${out} из ${COLS}`], color: '#3ddc6f' };
      },

      summary() {
        return {
          duration: this.t,
          sub: blobs.map((b) => `${Math.round(b.e * 100)}%: ${b.state === 'popped' ? 'лопнул' : b.state === 'out' ? 'пролез за ' + fmtSec(b.at) : 'застрял'}`).join(' · '),
          bars: blobs.map((b) => ({ v: b.at > 0 ? b.at : this.t, color: b.color })),
        };
      },
    };
  },
};
