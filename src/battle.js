// Battle ×3: three toys stacked in one frame, viewers bet in the comments
// which lane finishes first. Either the same toy with three seeds, or a mix
// of different toys (pass arrays of toys and params).

import { W, DT, MAX_T, SILENT, ACCENT, DISPLAY, simulate, fmtSec } from './engine.js';
import { look, drawSkin } from './scene.js';

export const LANES = [
  { n: 1, color: '#ff4d5e' },
  { n: 2, color: '#4d8bff' },
  { n: 3, color: '#3ddc6f' },
];

const GRACE = 5; // seconds the others get after the winner
const SETTLE = 0.5; // a beat after the last result so its badge can land
const DEFAULT_ARENA = { x: 60, y: 740, w: 960, h: 960 };

const TOP = 585;
const BOTTOM = 1895;
const GAP = 14;
const SIDE = 30;
const LANE_W = W - SIDE * 2;
const LANE_H = (BOTTOM - TOP - GAP * 2) / 3;
const PAD = 18;
const BOX = LANE_H - PAD * 2;
const BOX_X = SIDE + LANE_W - PAD - BOX;
const COL_X = SIDE + 44;
const COL_W = BOX_X - 30 - COL_X;
const AV_R = 62;
const AV_X = COL_X + COL_W - AV_R - 8;
const MEDALS = ['#ffd23f', '#dfe5f0', '#e8975a'];
const INK = '#1a1400';

const laneY = (i) => TOP + i * (LANE_H + GAP);
const three = (v) => (Array.isArray(v) ? v : [v, v, v]);

export function supportsBattle(toy) {
  return !!toy.battle;
}

// A lane finishes when its sim is done, or earlier if the sim sets
// finishTime at the decisive moment and keeps animating a bit longer.
function finishOf(sim) {
  if (Number.isFinite(sim.finishTime)) return sim.finishTime;
  return sim.done ? sim.time : Infinity;
}

// 0..1 when the toy can tell; otherwise read a "NN%" pill, otherwise null.
function progressOf(sim, pills) {
  const p = typeof sim.progress === 'function' ? sim.progress() : sim.progress;
  if (Number.isFinite(p)) return Math.max(0, Math.min(1, p));
  for (const pill of pills) {
    const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(pill.text);
    if (m) return Math.max(0, Math.min(1, parseFloat(m[1].replace(',', '.')) / 100));
  }
  return null;
}

// two decimals: in a photo finish the tenths are often the same
const fmt2 = (s) => s.toFixed(2).replace('.', ',') + ' с';
const fmtGap = (g) => (g < 1 ? fmt2(g) : fmtSec(g));

export function createBattle(toy, params, seeds, fx = SILENT) {
  const mixed = Array.isArray(toy);
  const toys = three(toy);
  const plist = three(params);

  // each lane hears its own hits, so its avatar can hop on them
  const hitAt = [-9, -9, -9];
  const laneFx = (i) => ({
    note(n, vol, wave) {
      hitAt[i] = look.t;
      fx.note(n, vol, wave);
    },
  });

  const lanes = LANES.map((l, i) => {
    const box = toys[i].arena ? toys[i].arena(plist[i]) : DEFAULT_ARENA;
    const k = BOX / Math.max(box.w, box.h);
    return {
      ...l,
      i,
      seed: seeds[i],
      name: mixed ? toys[i].tab : '',
      sim: toys[i].create(plist[i], seeds[i], laneFx(i)),
      box,
      k,
      offX: BOX_X + (BOX - box.w * k) / 2,
      offY: PAD + (BOX - box.h * k) / 2,
      y: laneY(i),
      place: 0,
      finish: Infinity,
      at: -1,
      dnf: false,
    };
  });
  const order = [];
  let winner = null;
  let endAt = -1;

  function drawLane(ctx, b, l, pills, prog, hot) {
    const P = paints(ctx);
    const y = l.y;
    const won = l === winner;
    const since = l.at < 0 ? -1 : b.done ? 9 : b.t - l.at;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(SIDE, y, LANE_W, LANE_H, 36);
    ctx.fillStyle = P.panel[l.i];
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(BOX_X, y + PAD, BOX, BOX, 26);
    ctx.clip();
    ctx.fillStyle = 'rgba(9,8,28,0.6)';
    ctx.fillRect(BOX_X, y + PAD, BOX, BOX);
    ctx.translate(l.offX, y + l.offY);
    ctx.scale(l.k, l.k);
    ctx.translate(-l.box.x, -l.box.y);
    const mood = won ? 'win' : winner || l.dnf ? 'lose' : 'idle';
    Object.assign(look, { lane: l.i, laneColor: l.color, scale: l.k, mood });
    l.sim.draw(ctx);
    Object.assign(look, { lane: -1, laneColor: null, scale: 1, mood: 'idle' });
    ctx.restore();
    ctx.restore();

    ctx.save();
    if (l.dnf) {
      ctx.fillStyle = 'rgba(8,7,26,0.6)';
      ctx.beginPath();
      ctx.roundRect(SIDE, y, LANE_W, LANE_H, 36);
      ctx.fill();
    }
    if (since >= 0 && since < 0.3 && !l.dnf) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - since / 0.3) * (won ? 0.5 : 0.3);
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.roundRect(SIDE, y, LANE_W, LANE_H, 36);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.roundRect(SIDE + 3, y + 3, LANE_W - 6, LANE_H - 6, 33);
    ctx.strokeStyle = l.color;
    if (won) {
      ctx.lineWidth = 7;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 34 + 12 * Math.sin(b.t * 6);
    } else if (hot) {
      ctx.lineWidth = 6;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 26;
    } else {
      ctx.lineWidth = 5;
      ctx.globalAlpha = l.dnf ? 0.3 : l.place ? 0.75 : 0.5;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = l.dnf ? 0.45 : 1;
    ctx.font = `900 176px ${DISPLAY}`;
    ctx.fillStyle = l.color;
    ctx.fillText(String(l.n), COL_X, y + 196);
    const numW = ctx.measureText(String(l.n)).width;

    if (won) {
      const s = pop(since);
      crown(ctx, P.gold, COL_X + numW + 92, y + 118, 132 * s, -0.16 + 0.05 * Math.sin(b.t * 3));
    } else if (hot) {
      tag(ctx, 'ЛИДЕР', COL_X + numW + 28, y + 96, l.color);
    }

    if (look.skin !== 'glossy') avatar(ctx, l, y, won ? 'win' : winner || l.dnf ? 'lose' : 'idle', hitAt[l.i]);

    if (l.name) {
      fitFont(ctx, l.name.toUpperCase(), 800, 32, COL_W);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(l.name.toUpperCase(), COL_X, y + 234);
    }

    const status = l.place && !l.dnf ? 'Финиш: ' + fmt2(l.finish) : pills[0] ? pills[0].text : '';
    fitFont(ctx, status, 800, 48, COL_W);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(status, COL_X, y + 280);
    ctx.globalAlpha = 1;

    const rowY = y + 312;
    if (l.place) {
      const s = pop(since);
      const text = l.dnf ? 'НЕ УСПЕЛ' : `${l.place} МЕСТО`;
      ctx.font = `900 46px ${DISPLAY}`;
      const bw = ctx.measureText(text).width + 56;
      ctx.save();
      ctx.translate(COL_X + bw / 2, rowY + 38);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.roundRect(-bw / 2, -38, bw, 76, 38);
      ctx.fillStyle = l.dnf ? 'rgba(255,255,255,0.14)' : MEDALS[l.place - 1] || MEDALS[2];
      ctx.fill();
      ctx.fillStyle = l.dnf ? '#aaa7d0' : INK;
      ctx.textAlign = 'center';
      ctx.fillText(text, 0, 16);
      ctx.restore();
      if (!l.dnf && !won && winner) {
        const gap = l.finish - winner.finish;
        ctx.font = `800 44px ${DISPLAY}`;
        ctx.fillStyle = gap < 0.5 ? ACCENT : '#ffffff';
        ctx.globalAlpha = Math.min(1, since * 4);
        ctx.fillText('+' + fmtGap(gap), COL_X + bw + 22, rowY + 54);
        ctx.globalAlpha = 1;
      }
    } else if (prog !== null) {
      const bh = 26;
      const by = rowY + 25;
      ctx.beginPath();
      ctx.roundRect(COL_X, by, COL_W, bh, bh / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();
      if (prog > 0) {
        ctx.beginPath();
        ctx.roundRect(COL_X, by, Math.max(bh, COL_W * prog), bh, bh / 2);
        ctx.fillStyle = l.color;
        if (hot) {
          ctx.shadowColor = l.color;
          ctx.shadowBlur = 18;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  return {
    t: 0,
    time: 0,
    done: false,
    hook: mixed ? ['Кто финиширует', 'первым?'] : toy.battle?.hook || toy.hook,
    seeds: seeds.slice(),
    lanes,
    order,
    get winner() {
      return winner;
    },

    step(dt) {
      if (this.done) return;
      this.t += dt;
      this.time = this.t;
      const fresh = [];
      for (const l of lanes) {
        if (l.dnf || l.sim.done) continue;
        l.sim.step(dt);
        if (l.place || !Number.isFinite(finishOf(l.sim))) continue;
        l.finish = finishOf(l.sim);
        l.at = this.t;
        fresh.push(l);
      }
      fresh.sort((a, b) => a.finish - b.finish || a.i - b.i);
      for (const l of fresh) {
        order.push(l);
        l.place = order.length;
      }
      if (!winner && order.length) {
        winner = order[0];
        fx.note(15, 1, 'square');
      }
      if (endAt < 0) {
        const late = winner ? this.t - winner.at >= GRACE - 1e-9 : this.t >= MAX_T - 1e-9;
        if (order.length === lanes.length) endAt = this.t;
        else if (late) {
          const rest = lanes.filter((l) => !l.place);
          const prog = (l) => progressOf(l.sim, l.sim.pills()) ?? 0;
          rest.sort((a, b) => prog(b) - prog(a) || a.i - b.i);
          rest.forEach((l, i) => {
            l.dnf = true;
            l.place = order.length + 1 + i;
            l.at = this.t;
          });
          endAt = this.t;
        }
      }
      if (endAt >= 0 && this.t - endAt >= SETTLE - 1e-9) this.done = true;
    },

    draw(ctx) {
      const pills = lanes.map((l) => l.sim.pills());
      const prog = lanes.map((l, i) => (l.place ? null : progressOf(l.sim, pills[i])));
      let lead = -1;
      if (!winner) {
        let best = 0;
        let ties = 0;
        prog.forEach((p, i) => {
          if (p === null || p < best) return;
          if (p > best) {
            best = p;
            lead = i;
            ties = 0;
          } else ties++;
        });
        if (ties || best <= 0) lead = -1;
      }
      lanes.forEach((l, i) => drawLane(ctx, this, l, pills[i], prog[i], i === lead));
    },

    pills() {
      if (!winner) return [{ text: this.done ? 'Никто не успел' : 'Пиши в комментах: 1, 2 или 3' }];
      return [{ text: 'Победил №' + winner.n, color: winner.color }, { text: fmtSec(this.t) }];
    },

    banner() {
      if (!winner) return { lines: ['Никто', 'не финишировал'], color: '#aaa7d0' };
      return { lines: ['Победил', '№' + winner.n + ' · ' + fmtSec(winner.finish)], color: winner.color };
    },

    summary() {
      const end = this.t;
      let sub = 'Никто не финишировал за ' + fmtSec(Math.min(end, MAX_T));
      if (winner) {
        const second = order[1];
        sub = `Победил №${winner.n} за ${fmtSec(winner.finish)} · `;
        sub += second ? 'второй отстал на ' + fmtGap(second.finish - winner.finish) : 'остальные не успели';
      }
      return {
        duration: end,
        sub,
        bars: lanes.map((l) => ({ v: Number.isFinite(l.finish) ? l.finish : end, color: l.color })),
      };
    },
  };
}

// Headless run of a whole battle, for the result card.
export function simulateBattle(toy, params, seeds) {
  const b = createBattle(toy, params, seeds, SILENT);
  const steps = Math.ceil((MAX_T + GRACE + SETTLE + 1) / DT);
  for (let i = 0; i < steps && !b.done; i++) b.step(DT);
  return b;
}

// Score of a triple with finish times a <= b <= c (lower is better):
//   dur:   |a - target| costs 0.3/s inside ±1 s, then 1.5/s
//   photo: b - a inside 0.15..0.4 s is free; closer costs 20/s (a dead heat
//          is unreadable), wider costs 4/s
//   third: c - a costs 0.1/s up to 3 s, then 2/s; c - b under 0.1 s costs 10/s
// c - a must stay under SPREAD so the third lane finishes before the cutoff.
const SPREAD = GRACE - 0.5;
const durCost = (d) => (d <= 1 ? d * 0.3 : 0.3 + (d - 1) * 1.5);
const gapCost = (g) => (g < 0.15 ? (0.15 - g) * 20 : g > 0.4 ? (g - 0.4) * 4 : 0);
const spreadCost = (s) => (s <= 3 ? s * 0.1 : 0.3 + (s - 3) * 2);
const tieCost = (h) => (h < 0.1 ? (0.1 - h) * 10 : 0);

function bestTriple(runs, target) {
  const fin = runs.filter((r) => Number.isFinite(r.time)).sort((a, b) => a.time - b.time);
  let best = null;
  for (let i = 0; i < fin.length; i++) {
    const a = fin[i].time;
    const s1 = durCost(Math.abs(a - target));
    if (best && s1 >= best.score) continue;
    for (let j = i + 1; j < fin.length; j++) {
      const g = fin[j].time - a;
      if (g > SPREAD || (best && g > 0.4 && s1 + gapCost(g) >= best.score)) break;
      const s2 = s1 + gapCost(g);
      if (best && s2 >= best.score) continue;
      for (let m = j + 1; m < fin.length; m++) {
        const spread = fin[m].time - a;
        if (spread > SPREAD || (best && s2 + spreadCost(spread) >= best.score)) break;
        const score = s2 + spreadCost(spread) + tieCost(fin[m].time - fin[j].time);
        if (!best || score < best.score) best = { score, runs: [fin[i], fin[j], fin[m]] };
      }
    }
  }
  return best;
}

// Mixed lanes: one candidate pool per lane, best combination across pools.
// Only the runs nearest the target are combined, to keep it cubic-but-small.
function bestMixed(pools, target, keep) {
  const near = pools.map((pool) =>
    pool
      .filter((r) => Number.isFinite(r.time))
      .sort((a, b) => Math.abs(a.time - target) - Math.abs(b.time - target))
      .slice(0, keep),
  );
  let best = null;
  for (const a of near[0]) {
    for (const b of near[1]) {
      for (const c of near[2]) {
        const [x, y, z] = [a.time, b.time, c.time].sort((u, v) => u - v);
        if (z - x > SPREAD) continue;
        const score = durCost(Math.abs(x - target)) + gapCost(y - x) + spreadCost(z - x) + tieCost(z - y);
        if (!best || score < best.score) best = { score, runs: [a, b, c] };
      }
    }
  }
  return best;
}

async function findMixedSeeds(toys, plist, { budgetMs, target, onProgress }) {
  const t0 = performance.now();
  const pools = [[], [], []];
  const seen = [new Set(), new Set(), new Set()];
  let yielded = t0;
  let count = 0;
  let best = null;
  while (performance.now() - t0 < budgetMs) {
    const i = count % 3;
    const seed = 1 + Math.floor(Math.random() * 99999);
    if (seen[i].has(seed)) continue;
    seen[i].add(seed);
    pools[i].push({ seed, time: finishOf(simulate(toys[i], plist[i], seed)) });
    count++;
    if (onProgress) onProgress(count);
    if (count % 150 === 0) {
      best = bestMixed(pools, target, 50);
      if (best && best.score < 0.12) break;
    }
    if (performance.now() - yielded > 30) {
      await new Promise((r) => setTimeout(r, 0));
      yielded = performance.now();
    }
  }
  best = bestMixed(pools, target, 120);
  const pick = best
    ? best.runs
    : pools.map((pool) => pool.slice().sort((a, b) => Math.abs(a.time - target) - Math.abs(b.time - target))[0] || { seed: 1, time: Infinity });
  return { seeds: pick.map((r) => r.seed), score: best ? best.score : Infinity, times: pick.map((r) => r.time), tried: count };
}

export async function findBattleSeeds(toy, params, { budgetMs = 6000, target = 18, onProgress } = {}) {
  if (Array.isArray(toy)) return findMixedSeeds(toy, three(params), { budgetMs, target, onProgress });
  const t0 = performance.now();
  const runs = [];
  const seen = new Set();
  let best = null;
  let yielded = t0;
  while (performance.now() - t0 < budgetMs) {
    const seed = 1 + Math.floor(Math.random() * 99999);
    if (seen.has(seed)) continue;
    seen.add(seed);
    runs.push({ seed, time: finishOf(simulate(toy, params, seed)) });
    if (onProgress) onProgress(runs.length);
    if (runs.length % 25 === 0) {
      best = bestTriple(runs, target);
      if (best && best.score < 0.12 && runs.length >= 150) break;
    }
    // browsers clamp nested setTimeout(0) to 4 ms, so yield every ~30 ms, not every run
    if (performance.now() - yielded > 30) {
      await new Promise((r) => setTimeout(r, 0));
      yielded = performance.now();
    }
  }
  best = bestTriple(runs, target);
  let pick;
  if (best) pick = best.runs.slice();
  else {
    // nothing fits the cutoff: take the runs closest to the target
    pick = runs
      .slice()
      .sort((a, b) => Math.abs(a.time - target) - Math.abs(b.time - target))
      .slice(0, 3);
    while (pick.length < 3) pick.push({ seed: 1 + Math.floor(Math.random() * 99999), time: Infinity });
  }
  // the winner lands on a random lane, so nobody learns to always bet on №1
  for (let i = pick.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pick[i], pick[j]] = [pick[j], pick[i]];
  }
  return { seeds: pick.map((r) => r.seed), score: best ? best.score : Infinity, times: pick.map((r) => r.time), tried: runs.length };
}

// ---------- drawing helpers ----------

const paintCache = new WeakMap();
// The lane's ball, big, next to its number: someone to root for. It hops on
// its lane's hits, cheers when it wins and sulks when it loses.
function avatar(ctx, l, y, mood, hitT) {
  const t = look.t;
  let cy = y + 116 + Math.sin(t * 2.2 + l.i * 2) * 5;
  const hop = Math.max(0, 1 - (t - hitT) / 0.25);
  cy -= hop * hop * 14;
  if (mood === 'win') cy -= Math.abs(Math.sin(t * 6)) * 22;
  ctx.save();
  ctx.globalAlpha = l.dnf ? 0.5 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(AV_X, y + 116 + AV_R + 14, AV_R * 0.75, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  drawSkin(ctx, look.skin, AV_X, cy, AV_R, l.color, null, { mood, variant: l.i, hitT });
  ctx.restore();
}

function paints(ctx) {
  let p = paintCache.get(ctx);
  if (p) return p;
  const gold = ctx.createLinearGradient(0, -48, 0, 44);
  gold.addColorStop(0, '#fff6c2');
  gold.addColorStop(0.45, '#ffd23f');
  gold.addColorStop(1, '#d99a00');
  p = {
    gold,
    panel: LANES.map((l) => {
      const g = ctx.createLinearGradient(SIDE, 0, BOX_X, 0);
      g.addColorStop(0, l.color + '38');
      g.addColorStop(1, l.color + '0a');
      return g;
    }),
  };
  paintCache.set(ctx, p);
  return p;
}

function fitFont(ctx, text, weight, size, maxW) {
  let s = size;
  ctx.font = `${weight} ${s}px ${DISPLAY}`;
  while (ctx.measureText(text).width > maxW && s > 24) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${DISPLAY}`;
  }
}

// ease-out with a little overshoot, 0.35 s long
function pop(since) {
  if (since < 0) return 1;
  const x = Math.min(1, since / 0.35) - 1;
  return 1 + 2.7 * x * x * x + 1.7 * x * x;
}

function tag(ctx, text, x, y, color) {
  ctx.save();
  ctx.font = `900 34px ${DISPLAY}`;
  const w = ctx.measureText(text).width + 36;
  ctx.beginPath();
  ctx.roundRect(x, y - 30, w, 58, 29);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#0b0a22';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + 12);
  ctx.restore();
}

// A gold crown about `size` px wide, jewels in the three lane colours.
function crown(ctx, gold, x, y, size, rot) {
  if (size <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(size / 120, size / 120);
  ctx.beginPath();
  ctx.moveTo(-52, 24);
  ctx.lineTo(-60, -30);
  ctx.lineTo(-28, -2);
  ctx.lineTo(0, -46);
  ctx.lineTo(28, -2);
  ctx.lineTo(60, -30);
  ctx.lineTo(52, 24);
  ctx.closePath();
  ctx.moveTo(-54, 30);
  ctx.roundRect(-54, 28, 108, 18, 6);
  for (const [cx, cy] of [[-60, -30], [0, -46], [60, -30]]) {
    ctx.moveTo(cx + 9, cy);
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  }
  ctx.shadowColor = 'rgba(255,210,63,0.8)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#8a5a00';
  ctx.stroke();
  LANES.forEach((l, i) => {
    ctx.beginPath();
    ctx.arc((i - 1) * 30, 10, 8, 0, Math.PI * 2);
    ctx.fillStyle = l.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  });
  ctx.restore();
}
