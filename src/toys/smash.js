import { rng, ACCENT, DISPLAY } from '../engine.js';
import { look, features } from '../scene.js';
import { fracture, blast, stepShards, drawShards } from '../shards.js';

const TAU = Math.PI * 2;
const FLOOR = 1750;
const WX = 540;
const RX = 250;
const RY = 205;
const WY = FLOOR - RY;
const TOP = 720; // where each ball hangs before it drops
const BALLS = [
  { label: '1 г', kg: 0.001, r: 14 },
  { label: '1 кг', kg: 1, r: 38 },
  { label: '10 кг', kg: 10, r: 60 },
  { label: '100 кг', kg: 100, r: 86 },
  { label: '1 т', kg: 1000, r: 124 },
];
// what the watermelon does, from the hit's energy over its strength
const TIERS = [
  { at: 0, word: 'Цел!', color: '#3ddc6f' },
  { at: 0.3, word: 'Треснул', color: '#ffd23f' },
  { at: 1, word: 'Раскололся', color: '#ff8c3a', spokes: 4, rings: 1, power: 260, keep: 0.5 },
  { at: 5, word: 'Вдребезги', color: '#ff4d5e', spokes: 9, rings: 3, power: 650, keep: 0.75 },
  { at: 50, word: 'В пыль', color: '#ff5fc8', spokes: 15, rings: 4, power: 1200, keep: 0.92 },
];
const HANG = 0.55;
const AFTER = 1.9;
const FADE = 0.35;

const shape = [];
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * TAU;
  shape.push([WX + Math.cos(a) * RX, WY + Math.sin(a) * RY]);
}
// seeds sit on an inner ellipse, the same for every melon
const SEEDS = [];
for (let i = 0; i < 26; i++) {
  const a = (i / 26) * TAU + (i % 2) * 0.12;
  const k = i % 2 ? 0.52 : 0.68;
  SEEDS.push([WX + Math.cos(a) * RX * k, WY + Math.sin(a) * RY * k, a]);
}

function inside(ctx) {
  ctx.fillStyle = '#2e9e3e';
  ctx.beginPath();
  ctx.ellipse(WX, WY, RX, RY, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e9f7cf';
  ctx.beginPath();
  ctx.ellipse(WX, WY, RX - 12, RY - 12, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(WX, WY - 20, 10, WX, WY, RX);
  g.addColorStop(0, '#ff6b7f');
  g.addColorStop(1, '#e5233f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(WX, WY, RX - 22, RY - 22, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1c1014';
  for (const [x, y, a] of SEEDS) {
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 11, a + Math.PI / 2, 0, TAU);
    ctx.fill();
  }
}

function outside(ctx) {
  const g = ctx.createRadialGradient(WX - RX * 0.35, WY - RY * 0.45, 10, WX, WY, RX);
  g.addColorStop(0, '#7fe08a');
  g.addColorStop(0.5, '#2fa244');
  g.addColorStop(1, '#14612a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(WX, WY, RX, RY, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(10,60,25,0.75)';
  ctx.lineWidth = 20;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const y = WY - RY + (k / 12) * RY * 2;
      const bend = Math.sin((k / 12) * Math.PI);
      const x = WX + i * RX * 0.3 * (0.35 + 0.65 * bend) + Math.sin(k * 1.7 + i) * 5;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(WX - RX * 0.45, WY - RY * 0.5, RX * 0.18, RY * 0.09, -0.5, 0, TAU);
  ctx.fill();
}

function iron(ctx, x, y, r, label) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, '#f2f4ff');
  g.addColorStop(0.25, '#8d93a8');
  g.addColorStop(0.7, '#3a3f52');
  g.addColorStop(1, '#14161f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  if (r < 34) return;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(r * (label.length > 4 ? 0.42 : 0.55))}px ${DISPLAY}`;
  ctx.fillText(label, x, y + r * 0.05);
  ctx.textBaseline = 'alphabetic';
}

export default {
  id: 'smash',
  tab: '1 г … 1 т',
  eyebrow: 'MASS LAB',
  title: ['Шарик 1 г, 1 кг', '… и 1 тонна', 'против арбуза'],
  lede: 'Пять шариков разной массы по очереди падают на арбуз. Лёгкие отскакивают, потом появляется трещина, а дальше арбуз разлетается всё мельче. Прочность решает, на каком весе он сдастся.',
  hook: ['С какого веса', 'арбуз лопнет?'],
  params: [
    { key: 'strength', label: 'Прочность арбуза, Дж', min: 5, max: 3000, step: 5, value: 60 },
    { key: 'height', label: 'Высота падения, м', min: 1, max: 10, step: 0.5, value: 3 },
    { key: 'gravity', label: 'Гравитация', min: 1000, max: 5000, step: 100, value: 2600 },
  ],
  seed: 7,

  create(p, seed, fx) {
    const r = rng(seed);
    let round = -1;
    let t0 = 0;
    let ball;
    let melon;
    let shards = [];
    let drops = [];
    let splats = [];
    let shake = 0;
    let firstBreak = null;
    const results = [];

    function next(t) {
      round++;
      t0 = t;
      const B = BALLS[round];
      ball = { ...B, x: WX + (r() - 0.5) * 40, y: TOP - B.r, vx: 0, vy: 0, fall: false, hitT: -9 };
      melon = { whole: true, wob: 0, cracks: [], hitT: -9, tier: null, glad: false };
      shards = [];
      drops = [];
      splats = [];
    }

    function hit(t, nx, ny) {
      const E = ball.kg * 9.81 * p.height;
      const q = E / p.strength;
      let tier = TIERS[0];
      for (const T of TIERS) if (q >= T.at) tier = T;
      melon.tier = tier;
      melon.hitT = t;
      results.push(tier);
      const ix = ball.x - nx * ball.r;
      const iy = ball.y - ny * ball.r;
      if (!tier.spokes) {
        // bounce off; a hard enough one leaves a crack where it landed
        const vn = ball.vx * nx + ball.vy * ny;
        ball.vx -= 1.4 * vn * nx;
        ball.vy -= 1.4 * vn * ny;
        ball.vx += (r() < 0.5 ? -1 : 1) * (120 + r() * 120);
        melon.wob = 1;
        if (tier.at > 0) {
          for (let i = 0; i < 4; i++) {
            const pts = [[ix, iy]];
            let a = Math.PI / 2 + (i - 1.5) * 0.55 + (r() - 0.5) * 0.3;
            let x = ix;
            let y = iy;
            for (let k = 0; k < 4; k++) {
              a += (r() - 0.5) * 0.6;
              x += Math.cos(a) * 34;
              y += Math.sin(a) * 34;
              pts.push([x, y]);
            }
            melon.cracks.push(pts);
          }
        }
        melon.glad = true;
        fx.note(0, tier.at > 0 ? 1 : 0.6, 'thud');
        return;
      }
      if (!firstBreak) firstBreak = { ball: ball.label, word: tier.word };
      melon.whole = false;
      shards = fracture(shape, ix, iy, r, tier.spokes, tier.rings);
      blast(shards, ix, iy, tier.power, 0, -tier.power * 0.25, r);
      ball.vy *= tier.keep;
      const n = Math.round(tier.power / 14);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.05 + r() * 0.9);
        const v = tier.power * (0.4 + r() * 0.9);
        drops.push({ x: ix + (r() - 0.5) * 60, y: iy + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 4 + r() * 9 });
      }
      shake = Math.min(1.6, tier.power / 700);
      fx.note(0, Math.min(2, 0.6 + tier.power / 800), 'smash');
    }

    next(0);

    return {
      t: 0,
      time: 0,
      done: false,
      progress() {
        return round / BALLS.length;
      },
      step(dt) {
        this.t += dt;
        const local = this.t - t0;
        if (!ball.fall && local >= HANG) {
          ball.fall = true;
        }
        if (ball.fall) {
          ball.vy += p.gravity * dt;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          if (melon.whole) {
            // the melon as a circle after squeezing y, good enough for a ball
            const dx = ball.x - WX;
            const dy = (ball.y - WY) * (RX / RY);
            const d = Math.hypot(dx, dy) || 1;
            if (d < RX + ball.r) {
              // squeezed-space normal back to a real one: stretch y by RX/RY
              const ux = dx / d;
              const uy = (dy / d) * (RX / RY);
              const un = Math.hypot(ux, uy);
              const nx = ux / un;
              const ny = uy / un;
              const pen = (RX + ball.r - d) * 0.9;
              ball.x += nx * pen;
              ball.y += ny * pen;
              const vn = ball.vx * nx + ball.vy * ny;
              if (vn < 0) {
                if (!melon.tier) hit(this.t, nx, ny);
                else {
                  ball.vx -= 1.3 * vn * nx;
                  ball.vy -= 1.3 * vn * ny;
                }
              }
            }
          }
          if (ball.y + ball.r > FLOOR) {
            ball.y = FLOOR - ball.r;
            if (ball.vy > 120) fx.note(0, Math.min(1.4, ball.r / 60), 'thud');
            if (ball.vy > 0) ball.vy = -ball.vy * 0.3;
            ball.vx *= 0.85;
            if (Math.abs(ball.vy) < 80) ball.vy = 0;
            if (ball.r > 100 && ball.hitT < 0) {
              ball.hitT = this.t;
              shake = Math.max(shake, 1.2);
            }
          }
          ball.vx *= 0.999;
        }
        stepShards(shards, dt, p.gravity, FLOOR, null);
        for (const d of drops) {
          if (d.done) continue;
          d.vy += p.gravity * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          if (d.y > FLOOR) {
            d.done = true;
            splats.push({ x: d.x, w: d.s * (2 + Math.min(3, Math.abs(d.vx) / 300)) });
          }
        }
        melon.wob = Math.max(0, melon.wob - dt * 2.5);
        shake = Math.max(0, shake - dt * 3);
        const last = round === BALLS.length - 1;
        if (melon.tier && this.t - melon.hitT >= (last ? 1.6 : AFTER + FADE)) {
          if (last) this.done = true;
          else next(this.t);
        }
        this.time = this.t;
      },

      draw(ctx) {
        const local = this.t - t0;
        ctx.save();
        if (shake > 0) ctx.translate(Math.sin(this.t * 91) * shake * 14, Math.cos(this.t * 77) * shake * 10);

        const fl = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 200);
        fl.addColorStop(0, '#2a2560');
        fl.addColorStop(1, '#0d0b26');
        ctx.fillStyle = fl;
        ctx.fillRect(-40, FLOOR, 1160, 260);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(-40, FLOOR, 1160, 4);

        const fade = melon.tier && round < BALLS.length - 1 ? Math.max(0, 1 - (this.t - melon.hitT - AFTER) / FADE) : 1;
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#e5233f';
        for (const s of splats) {
          ctx.beginPath();
          ctx.ellipse(s.x, FLOOR + 3, s.w, 5, 0, 0, TAU);
          ctx.fill();
        }

        if (melon.whole) {
          const pop = Math.min(1, local / 0.3);
          const s = pop < 1 ? 1 - Math.pow(1 - pop, 3) * 1 + Math.sin(pop * Math.PI) * 0.15 : 1;
          const w = melon.wob * Math.sin(this.t * 34) * 0.07;
          ctx.save();
          ctx.translate(WX, FLOOR);
          ctx.scale(s * (1 + w), s * (1 - w));
          ctx.translate(-WX, -FLOOR);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(WX, FLOOR + 4, RX * 0.85, 12, 0, 0, TAU);
          ctx.fill();
          outside(ctx);
          if (melon.cracks.length) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            for (const [wd, col] of [[9, '#3b0a12'], [4, '#ff4d64']]) {
              ctx.lineWidth = wd;
              ctx.strokeStyle = col;
              ctx.beginPath();
              for (const c of melon.cracks) c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
              ctx.stroke();
            }
          }
          if (look.skin === 'face') {
            ctx.save();
            ctx.translate(WX, WY + 10);
            const dx = ball.x - WX;
            const dy = ball.y - WY;
            const d = Math.hypot(dx, dy) || 1;
            const near = ball.fall && !melon.tier;
            features(ctx, RY * 0.72, {
              mood: melon.glad && this.t - melon.hitT > 0.35 ? 'win' : near || melon.cracks.length ? 'lose' : 'idle',
              ouch: this.t - melon.hitT < 0.35,
              lx: dx / d,
              ly: dy / d,
              px: RY,
            });
            ctx.restore();
          }
          ctx.restore();
        } else {
          drawShards(ctx, shards, inside, { width: 2, color: 'rgba(40,10,15,0.5)' });
          ctx.fillStyle = '#ff3b55';
          for (const d of drops) {
            if (d.done) continue;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.s, 0, TAU);
            ctx.fill();
          }
        }

        const enter = Math.min(1, local / 0.25);
        ctx.globalAlpha = fade * enter;
        iron(ctx, ball.x, ball.y, ball.r * (0.6 + 0.4 * enter), ball.label);
        if (!ball.fall || ball.r < 34) {
          ctx.font = `900 ${ball.r < 34 ? 64 : 56}px ${DISPLAY}`;
          ctx.textAlign = 'left';
          ctx.fillStyle = ACCENT;
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 12;
          ctx.fillText(ball.label, ball.x + ball.r + 24, ball.y + 20);
          ctx.shadowBlur = 0;
        }
        ctx.restore();

        if (melon.tier) {
          const since = this.t - melon.hitT;
          const k = Math.min(1, since / 0.18);
          const s = 0.6 + 0.4 * k + Math.sin(Math.min(1, since / 0.3) * Math.PI) * 0.15;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(WX, 1010);
          ctx.rotate(-0.06);
          ctx.scale(s, s);
          const text = melon.tier.word.toUpperCase();
          ctx.font = `900 112px ${DISPLAY}`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 18;
          ctx.strokeStyle = 'rgba(8,7,26,0.85)';
          ctx.lineJoin = 'round';
          ctx.strokeText(text, 0, 0);
          ctx.fillStyle = melon.tier.color;
          ctx.fillText(text, 0, 0);
          ctx.restore();
        }
      },

      pills() {
        const B = BALLS[Math.max(0, round)];
        return [{ text: `Шарик: ${B.label}` }, { text: `Раунд ${Math.max(1, round + 1)} из ${BALLS.length}` }];
      },

      banner() {
        if (!firstBreak) return { lines: ['Арбуз выдержал', 'даже тонну'], color: '#3ddc6f' };
        return { lines: ['Арбуз сдался', `на ${firstBreak.ball}`], color: '#ff4d5e' };
      },

      summary() {
        return {
          duration: this.t,
          sub: results.map((t, i) => `${BALLS[i].label}: ${t.word.toLowerCase()}`).join(' · '),
          bars: results.map((t, i) => ({ v: i + 1, color: t.color })),
        };
      },
    };
  },
};
