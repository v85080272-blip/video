import { rng, TEAM, W, H, ball, fmtSec } from '../engine.js';

const X0 = 70;
const X1 = W - 70;
const R = 26;

function hitSeg(m, ax, ay, bx, by, e, th, sp) {
  const dx = bx - ax;
  const dy = by - ay;
  let u = ((m.x - ax) * dx + (m.y - ay) * dy) / (dx * dx + dy * dy);
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const px = ax + u * dx;
  const py = ay + u * dy;
  let nx = m.x - px;
  let ny = m.y - py;
  const rr = R + th;
  const d2 = nx * nx + ny * ny;
  if (d2 >= rr * rr) return 0;
  const d = Math.sqrt(d2) || 1e-4;
  nx /= d;
  ny /= d;
  m.x = px + nx * rr;
  m.y = py + ny * rr;
  const svx = sp ? -sp.w * (py - sp.y) : 0;
  const svy = sp ? sp.w * (px - sp.x) : 0;
  const rvx = m.vx - svx;
  const rvy = m.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const tx = -ny;
  const ty = nx;
  const vt = (rvx * tx + rvy * ty) * 0.9985;
  m.vx = svx + nx * -vn * e + tx * vt;
  m.vy = svy + ny * -vn * e + ty * vt;
  return -vn;
}

function hitCirc(m, c, e) {
  const dx = m.x - c.x;
  const dy = m.y - c.y;
  const rr = R + c.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  const d = Math.sqrt(d2) || 1e-4;
  const nx = dx / d;
  const ny = dy / d;
  m.x = c.x + nx * rr;
  m.y = c.y + ny * rr;
  const vn = m.vx * nx + m.vy * ny;
  if (vn >= 0) return 0;
  m.vx -= (1 + e) * vn * nx;
  m.vy -= (1 + e) * vn * ny;
  return -vn;
}

function buildCourse(r, len, density) {
  const segs = [];
  const pegs = [];
  const bumpers = [];
  const spins = [];
  const kinds = ['pegs', 'ramps', 'spin', 'funnel', 'bumpers'];
  let prev = '';
  let y = 560;
  while (y < len - 700) {
    let k = kinds[Math.floor(r() * kinds.length)];
    if (k === prev) k = kinds[(kinds.indexOf(k) + 1 + Math.floor(r() * 4)) % kinds.length];
    prev = k;
    if (k === 'pegs') {
      const rows = 5 + Math.floor(r() * 3 * density);
      const sx = 135 / Math.sqrt(density);
      for (let j = 0; j < rows; j++) {
        const off = (j % 2) * (sx / 2);
        for (let x = X0 + 45 + off; x < X1 - 30; x += sx) {
          pegs.push({ x: x + (r() - 0.5) * 16, y: y + j * 100, r: 11 });
        }
      }
      y += rows * 100 + 120;
    } else if (k === 'ramps') {
      const n = 3;
      let left = r() < 0.5;
      const reach = (X1 - X0) * (0.7 + r() * 0.08);
      for (let i = 0; i < n; i++) {
        if (left) segs.push([X0, y, X0 + reach, y + 190]);
        else segs.push([X1, y, X1 - reach, y + 190]);
        left = !left;
        y += 300;
      }
      y += 140;
    } else if (k === 'spin') {
      const count = density > 1.1 ? 3 : 2;
      for (let i = 0; i < count; i++) {
        const cx = X0 + ((i + 0.5) * (X1 - X0)) / count + (r() - 0.5) * 40;
        spins.push({
          x: cx,
          y: y + 170 + (i % 2) * 60,
          len: 230 + r() * 70,
          a: r() * Math.PI,
          w: (r() < 0.5 ? -1 : 1) * (1.6 + r() * 2.2),
        });
      }
      y += 420;
    } else if (k === 'funnel') {
      const gx = W / 2 + (r() - 0.5) * 300;
      segs.push([X0, y, gx - 75, y + 280]);
      segs.push([X1, y, gx + 75, y + 280]);
      y += 420;
    } else {
      const count = Math.round(3 + r() * 2 * density);
      for (let i = 0; i < count; i++) {
        bumpers.push({
          x: X0 + 100 + r() * (X1 - X0 - 200),
          y: y + 80 + i * (360 / count) + r() * 40,
          r: 44 + r() * 20,
          flash: 0,
        });
      }
      y += 500;
    }
  }
  return { segs, pegs, bumpers, spins };
}

export default {
  id: 'race',
  tab: 'Гонка шариков',
  eyebrow: 'RACE LAB',
  title: ['Гонка шариков,', 'где зрители', 'спорят в комментах'],
  lede: 'Трасса собирается из сида. Подбери гонку с напряжённым финишем и спроси зрителей, кто придёт первым.',
  hook: ['Кто придёт', 'первым?'],
  params: [
    { key: 'n', label: 'Шариков', min: 2, max: 8, step: 1, value: 6 },
    { key: 'len', label: 'Длина трассы', min: 3000, max: 12000, step: 500, value: 5000 },
    { key: 'gravity', label: 'Гравитация', min: 600, max: 2600, step: 50, value: 1400 },
    { key: 'bounce', label: 'Упругость', min: 0.2, max: 0.95, step: 0.05, value: 0.55 },
    { key: 'density', label: 'Препятствия', min: 0.5, max: 1.6, step: 0.1, value: 1 },
  ],
  seed: 2741,
  search: { label: 'Найти сид на 16–20 секунд', target: 18 },

  create(p, seed, fx) {
    const r = rng(seed);
    const len = p.len;
    const course = buildCourse(r, len, p.density);
    const marbles = [];
    const span = X1 - X0 - 120;
    for (let i = 0; i < p.n; i++) {
      marbles.push({
        i,
        x: X0 + 60 + (p.n === 1 ? span / 2 : (i * span) / (p.n - 1)) + (r() - 0.5) * 10,
        y: 250 + (r() - 0.5) * 30,
        vx: (r() - 0.5) * 120,
        vy: 0,
        done: false,
        still: 0,
        lastNote: -1,
        trail: [],
      });
    }

    const sim = {
      t: 0,
      time: 0,
      done: false,
      cam: -420,
      order: [],
      step(dt) {
        const sub = 3;
        const h = dt / sub;
        for (let s = 0; s < sub; s++) {
          this.t += h;
          for (const sp of course.spins) sp.a += sp.w * h;
          for (const m of marbles) {
            if (m.done) continue;
            m.vy += p.gravity * h;
            const sp2 = m.vx * m.vx + m.vy * m.vy;
            if (sp2 > 2600 * 2600) {
              const k = 2600 / Math.sqrt(sp2);
              m.vx *= k;
              m.vy *= k;
            }
            m.x += m.vx * h;
            m.y += m.vy * h;
            if (m.x < X0 + R) {
              m.x = X0 + R;
              m.vx = Math.abs(m.vx) * p.bounce;
            } else if (m.x > X1 - R) {
              m.x = X1 - R;
              m.vx = -Math.abs(m.vx) * p.bounce;
            }
            let hit = 0;
            if (this.t < 0.7) hit = Math.max(hit, hitSeg(m, X0, 300, X1, 300, 0.2, 4));
            for (const sg of course.segs) {
              const lo = Math.min(sg[1], sg[3]) - 40;
              const hi = Math.max(sg[1], sg[3]) + 40;
              if (m.y < lo || m.y > hi) continue;
              hit = Math.max(hit, hitSeg(m, sg[0], sg[1], sg[2], sg[3], p.bounce * 0.6, 5));
            }
            for (const pg of course.pegs) {
              if (Math.abs(pg.y - m.y) > 40) continue;
              hit = Math.max(hit, hitCirc(m, pg, p.bounce));
            }
            for (const b of course.bumpers) {
              if (Math.abs(b.y - m.y) > 90) continue;
              const v = hitCirc(m, b, 1);
              if (v) {
                b.flash = 1;
                const speed = Math.hypot(m.vx, m.vy);
                if (speed < 900) {
                  m.vx *= 900 / speed;
                  m.vy *= 900 / speed;
                }
                hit = Math.max(hit, 600);
              }
            }
            for (const sp of course.spins) {
              if (Math.abs(sp.y - m.y) > sp.len / 2 + 40) continue;
              const c = Math.cos(sp.a) * (sp.len / 2);
              const sn = Math.sin(sp.a) * (sp.len / 2);
              hit = Math.max(hit, hitSeg(m, sp.x - c, sp.y - sn, sp.x + c, sp.y + sn, p.bounce, 9, sp));
            }
            if (hit > 260 && this.t - m.lastNote > 0.09) {
              m.lastNote = this.t;
              fx.note(4 + m.i * 2 + Math.floor((m.y / len) * 6), Math.min(1, hit / 1400));
            }
            if (m.y > len) {
              m.done = true;
              m.t = this.t;
              this.order.push(m);
              fx.note(15 + Math.max(0, 5 - this.order.length), 1, 'square');
            }
          }
          for (let a = 0; a < marbles.length; a++) {
            const A = marbles[a];
            if (A.done) continue;
            for (let b = a + 1; b < marbles.length; b++) {
              const B = marbles[b];
              if (B.done) continue;
              const dx = B.x - A.x;
              const dy = B.y - A.y;
              const d2 = dx * dx + dy * dy;
              if (d2 >= 4 * R * R) continue;
              const d = Math.sqrt(d2) || 1e-4;
              const nx = dx / d;
              const ny = dy / d;
              const o = (2 * R - d) / 2;
              A.x -= nx * o;
              A.y -= ny * o;
              B.x += nx * o;
              B.y += ny * o;
              const rel = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
              if (rel < 0) {
                const j = (-(1 + 0.85) * rel) / 2;
                A.vx -= j * nx;
                A.vy -= j * ny;
                B.vx += j * nx;
                B.vy += j * ny;
              }
            }
          }
        }
        for (const m of marbles) {
          if (m.done) continue;
          if (Math.hypot(m.vx, m.vy) < 30) m.still += dt;
          else m.still = 0;
          if (m.still > 1.2 && this.t > 1) {
            m.vx = (r() - 0.5) * 600;
            m.vy = -300;
            m.still = 0;
          }
          m.trail.push(m.x, m.y);
          if (m.trail.length > 24) m.trail.splice(0, 2);
        }
        for (const b of course.bumpers) b.flash = Math.max(0, b.flash - dt * 3);

        const racing = marbles.filter((m) => !m.done);
        const lead = racing.length ? Math.max(...racing.map((m) => m.y)) : len;
        const target = Math.max(-420, Math.min(len + 420 - H, lead - 950));
        this.cam += (target - this.cam) * Math.min(1, dt * 5);

        this.time = this.t;
        const winner = this.order[0];
        if (!racing.length || (winner && this.t - winner.t > 4)) {
          for (const m of racing.sort((a, b) => b.y - a.y)) this.order.push(m);
          this.done = true;
        }
      },

      draw(ctx) {
        const cam = this.cam;
        ctx.save();
        ctx.translate(0, -cam);
        const top = cam - 60;
        const bottom = cam + H + 60;

        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(X0, Math.max(top, -500), X1 - X0, Math.min(bottom, len + 400) - Math.max(top, -500));
        ctx.strokeStyle = '#3a3670';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(X0 - 4, Math.max(top, -500));
        ctx.lineTo(X0 - 4, Math.min(bottom, len + 400));
        ctx.moveTo(X1 + 4, Math.max(top, -500));
        ctx.lineTo(X1 + 4, Math.min(bottom, len + 400));
        ctx.stroke();

        if (this.t < 0.7) {
          ctx.setLineDash([24, 16]);
          ctx.strokeStyle = '#ffd23f';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(X0, 300 + R);
          ctx.lineTo(X1, 300 + R);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.lineCap = 'round';
        ctx.strokeStyle = '#8a84e6';
        ctx.lineWidth = 12;
        for (const s of course.segs) {
          if (Math.max(s[1], s[3]) < top || Math.min(s[1], s[3]) > bottom) continue;
          ctx.beginPath();
          ctx.moveTo(s[0], s[1]);
          ctx.lineTo(s[2], s[3]);
          ctx.stroke();
        }
        ctx.fillStyle = '#6c66c4';
        for (const pg of course.pegs) {
          if (pg.y < top || pg.y > bottom) continue;
          ctx.beginPath();
          ctx.arc(pg.x, pg.y, pg.r, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const b of course.bumpers) {
          if (b.y < top - 80 || b.y > bottom + 80) continue;
          ctx.fillStyle = `rgba(255,95,200,${0.18 + b.flash * 0.5})`;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ff5fc8';
          ctx.lineWidth = 7;
          ctx.stroke();
        }
        ctx.strokeStyle = '#eeeaff';
        ctx.lineWidth = 18;
        for (const sp of course.spins) {
          if (sp.y < top - 200 || sp.y > bottom + 200) continue;
          const c = Math.cos(sp.a) * (sp.len / 2);
          const sn = Math.sin(sp.a) * (sp.len / 2);
          ctx.beginPath();
          ctx.moveTo(sp.x - c, sp.y - sn);
          ctx.lineTo(sp.x + c, sp.y + sn);
          ctx.stroke();
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
          ctx.fill();
        }

        // checkered finish line
        if (len > top && len < bottom + 40) {
          const sq = 30;
          for (let row = 0; row < 2; row++) {
            for (let x = X0, k = 0; x < X1; x += sq, k++) {
              ctx.fillStyle = (k + row) % 2 ? '#111' : '#f4f4f4';
              ctx.fillRect(x, len + row * sq, Math.min(sq, X1 - x), sq);
            }
          }
        }

        for (const m of marbles) {
          const col = TEAM[m.i].color;
          if (!m.done && m.trail.length > 4) {
            ctx.strokeStyle = col + '55';
            ctx.lineWidth = R * 1.2;
            ctx.beginPath();
            ctx.moveTo(m.trail[0], m.trail[1]);
            for (let k = 2; k < m.trail.length; k += 2) ctx.lineTo(m.trail[k], m.trail[k + 1]);
            ctx.stroke();
          }
          const place = this.order.indexOf(m);
          const x = m.done ? X0 + 60 + place * 70 : m.x;
          const y = m.done ? len + 110 : m.y;
          ball(ctx, x, y, R, col);
        }
        ctx.restore();

        // progress rail on the left edge
        const railTop = 640;
        const railH = H - railTop - 80;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(28, railTop, 10, railH);
        for (const m of marbles) {
          const f = Math.max(0, Math.min(1, m.y / len));
          ctx.fillStyle = TEAM[m.i].color;
          ctx.beginPath();
          ctx.arc(33, railTop + f * railH, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      },

      pills() {
        const racing = marbles.filter((m) => !m.done);
        const lead = this.order[0] || racing.reduce((a, b) => (b.y > a.y ? b : a), racing[0]);
        return [
          { text: (this.order[0] ? 'Победил' : 'Лидер') + ': ' + TEAM[lead.i].name, color: TEAM[lead.i].color },
          { text: fmtSec(this.t) },
        ];
      },

      banner() {
        const w = this.order[0];
        return { lines: ['Победил', TEAM[w.i].name], color: TEAM[w.i].color };
      },

      summary() {
        const [a, b] = this.order;
        const gap = b && b.t ? fmtSec(b.t - a.t) : '—';
        return {
          duration: this.t,
          sub: `Победил ${TEAM[a.i].name.toLowerCase()} · отрыв от второго ${gap}`,
          bars: this.order.map((m) => ({ v: m.t || this.t, color: TEAM[m.i].color })),
        };
      },
    };
    return sim;
  },
};
