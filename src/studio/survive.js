// «Битва месяцев»: twelve balls (birth months, zodiac signs, name letters
// or your own list) bounce inside a ring with a rotating gap. Whoever slips
// out is eliminated; the last ball inside wins. Viewers look for their own
// month and write in the comments how it did.

import {
  W, DT, ACCENT, FONT, icon, rng, clamp, ease, hook, pill, endCard, rrect, ball, hsl, backdrop, splitIcon, fitFont,
} from './core.js';

const SETS = {
  months: {
    name: 'Месяцы рождения',
    hook: ['Найди свой месяц рождения', 'он выживет?'],
    items: [
      ['❄️', 'Январь'], ['💘', 'Февраль'], ['🌷', 'Март'], ['🌧️', 'Апрель'], ['🌼', 'Май'], ['☀️', 'Июнь'],
      ['🍉', 'Июль'], ['🌻', 'Август'], ['🍂', 'Сентябрь'], ['🎃', 'Октябрь'], ['🍁', 'Ноябрь'], ['🎄', 'Декабрь'],
    ].map(([skin, n]) => ({ name: n, label: n.slice(0, 3), skin })),
  },
  zodiac: {
    name: 'Знаки зодиака',
    hook: ['Найди свой знак зодиака', 'он выживет?'],
    items: [
      ['🐏', 'Овен', 'Овен'], ['🐂', 'Телец', 'Телец'], ['👯', 'Близнецы', 'Близн'], ['🦀', 'Рак', 'Рак'],
      ['🦁', 'Лев', 'Лев'], ['🌾', 'Дева', 'Дева'], ['⚖️', 'Весы', 'Весы'], ['🦂', 'Скорпион', 'Скорп'],
      ['🏹', 'Стрелец', 'Стрел'], ['🐐', 'Козерог', 'Козер'], ['🏺', 'Водолей', 'Водол'], ['🐟', 'Рыбы', 'Рыбы'],
    ].map(([skin, n, short]) => ({ name: n, label: short, skin })),
  },
  letters: {
    name: 'Первая буква имени',
    hook: ['Найди первую букву', 'своего имени'],
    items: 'А В Д Е И К Л М Н О С Т'.split(' ').map((l) => ({ name: 'Буква ' + l, label: l })),
  },
};


const CX = W / 2;
const CY = 1000;
const R = 400;
const INTRO = 0.8;
const OUTRO = 3.4;
const MAX_T = 90;

function itemsFor(p) {
  if (p.set !== 'custom') return SETS[p.set].items;
  const lines = (p.custom || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 16);
  const list = lines.length >= 2 ? lines : ['Кошки', 'Собаки'];
  return list.map((line) => {
    const { icon, text } = splitIcon(line);
    return { name: text || icon, label: icon || text.slice(0, 3), emoji: !!icon };
  });
}

function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const survive = {
  id: 'survive',
  tab: 'Битва месяцев',
  blurb:
    'Каждый ищет в кадре свой месяц и болеет за него, а потом пишет в комментах «я март, вылетел первым». Комменты и пересмотры двигают ролик сильнее лайков.',
  fields: [
    { id: 'set', label: 'Кто дерётся', type: 'select', value: 'months',
      options: [...Object.entries(SETS).map(([k, s]) => [k, s.name]), ['custom', 'Свой список']] },
    { id: 'custom', label: 'Свой список (по строке, можно с эмодзи)', type: 'textarea', when: (p) => p.set === 'custom',
      value: '🍕 Пицца\n🍣 Роллы\n🍔 Бургер\n🥟 Пельмени\n🌯 Шаурма\n🍝 Паста\n🥞 Блины\n🍜 Рамен' },
    { id: 'hook1', label: 'Заголовок', type: 'text', value: SETS.months.hook[0] },
    { id: 'hook2', label: 'Вторая строка (жёлтая)', type: 'text', value: SETS.months.hook[1] },
    { id: 'speed', label: 'Скорость шаров', type: 'range', min: 400, max: 1200, step: 20, value: 760, unit: '' },
    { id: 'gap', label: 'Ширина выхода, °', type: 'range', min: 20, max: 60, step: 1, value: 30, unit: '°' },
    { id: 'spin', label: 'Вращение выхода, °/с', type: 'range', min: 0, max: 160, step: 5, value: 60, unit: '°/с' },
    { id: 'grow', label: 'Выход растёт, °/с', type: 'range', min: 0, max: 4, step: 0.1, value: 1.0, unit: '°/с' },
    { id: 'target', label: 'Длина ролика для подбора, с', type: 'range', min: 12, max: 40, step: 1, value: 20, unit: ' с' },
  ],
  // switching the set refills the hook with that set's default
  onChange(id, p) {
    if (id === 'set' && SETS[p.set]) {
      p.hook1 = SETS[p.set].hook[0];
      p.hook2 = SETS[p.set].hook[1];
      return true;
    }
    if (id === 'set' && p.set === 'custom') {
      p.hook1 = 'Найди свою любимую еду';
      p.hook2 = 'она выживет?';
      return true;
    }
    return false;
  },

  create(p, seed, snd) {
    const rand = rng(seed);
    const items = itemsFor(p);
    const n = items.length;
    const r = n <= 12 ? 58 : 58 * Math.sqrt(12 / n);
    const balls = [];
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * (R - r - 20);
        x = CX + Math.cos(a) * d;
        y = CY + Math.sin(a) * d;
        tries++;
      } while (tries < 400 && balls.some((b) => Math.hypot(b.x - x, b.y - y) < r * 2 + 8));
      const a = rand() * Math.PI * 2;
      balls.push({
        i, x, y, vx: Math.cos(a) * p.speed, vy: Math.sin(a) * p.speed,
        color: hsl((i * 360) / n + 8, 0.85, 0.58),
        item: items[i], state: 'in', place: 0, outT: 0, alpha: 1,
      });
    }
    const spinDir = rand() < 0.5 ? -1 : 1;

    const sim = {
      t: 0, balls, r, gapAt: rand() * Math.PI * 2, gap: 0,
      winner: null, endT: 0, over: false, flashes: [], exits: [],
      remaining: n,
      step(dt) {
        this.t += dt;
        if (this.winner) {
          // winner glides up to the spotlight
          const w = this.winner;
          w.x += (CX - w.x) * Math.min(1, dt * 3);
          w.y += (860 - w.y) * Math.min(1, dt * 3);
          for (const b of balls) {
            if (b.state === 'out') fall(b, dt);
            else if (b.state === 'escaping') { b.x += b.vx * dt; b.y += b.vy * dt; this.checkOut(b); }
          }
          if (this.t - this.endT > OUTRO) this.over = true;
          return;
        }
        if (this.t < INTRO) return;
        const tp = this.t - INTRO;
        this.gapAt += spinDir * (p.spin * Math.PI / 180) * dt;
        this.gap = Math.min(Math.PI * 1.2, (p.gap + p.grow * tp) * Math.PI / 180);

        this.ticks = (this.ticks || 0) + 1;
        for (const b of balls) {
          if (b.state === 'out') { fall(b, dt); continue; }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          // a short comet tail: one sample every 3 steps, 8 samples kept
          if (this.ticks % 3 === 0) {
            (b.trail ||= []).push(b.x, b.y);
            if (b.trail.length > 16) b.trail.splice(0, 2);
          }
        }
        // ball vs ball, equal masses
        for (let i = 0; i < n; i++) {
          const a = balls[i];
          if (a.state === 'out') continue;
          for (let j = i + 1; j < n; j++) {
            const b = balls[j];
            if (b.state === 'out') continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d >= r * 2 || d === 0) continue;
            const nx = dx / d, ny = dy / d;
            const push = (r * 2 - d) / 2;
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rel > 0) {
              a.vx -= rel * nx; a.vy -= rel * ny;
              b.vx += rel * nx; b.vy += rel * ny;
              snd.blip(330 + ((a.i + b.i) % 7) * 40, 'tick', 0.4);
            }
          }
        }
        // the ring
        const edge = Math.asin(Math.min(1, r / R));
        for (const b of balls) {
          if (b.state === 'out') continue;
          const dx = b.x - CX, dy = b.y - CY;
          const d = Math.hypot(dx, dy);
          if (b.state === 'escaping') {
            this.checkOut(b);
            continue;
          }
          if (d + r <= R) continue;
          const a = Math.atan2(dy, dx);
          const fits = Math.abs(angDiff(a, this.gapAt)) + edge < this.gap / 2;
          if (fits && this.remaining > 1) {
            b.state = 'escaping';
            this.remaining--;
            continue;
          }
          const nx = dx / d, ny = dy / d;
          const vn = b.vx * nx + b.vy * ny;
          if (vn > 0) {
            b.vx -= 2 * vn * nx;
            b.vy -= 2 * vn * ny;
            snd.blip(520 + (b.i % 6) * 70, 'pop', 0.35);
          }
          b.x = CX + nx * (R - r);
          b.y = CY + ny * (R - r);
        }
        // keep every ball at the chosen speed so the energy never dies down
        for (const b of balls) {
          if (b.state !== 'in') continue;
          const s = Math.hypot(b.vx, b.vy) || 1;
          b.vx *= p.speed / s;
          b.vy *= p.speed / s;
        }
        if (this.remaining === 1 || this.t > MAX_T) {
          const inside = balls.filter((b) => b.state === 'in');
          this.winner = inside.sort((x, y) => Math.hypot(x.x - CX, x.y - CY) - Math.hypot(y.x - CX, y.y - CY))[0];
          this.winner.place = 1;
          // anyone left inside on a timeout shares the rest of the places
          inside.slice(1).forEach((b, k) => { b.state = 'out'; b.place = 2 + k; b.outT = this.t; });
          this.endT = this.t;
          snd.chord([523, 659, 784, 1047]);
        }
      },
      // an escaping ball is out once it clears the ring completely
      checkOut(b) {
        if (Math.hypot(b.x - CX, b.y - CY) - r <= R + 6) return;
        b.state = 'out';
        this.exits.push(b);
        b.place = n - this.exits.length + 1;
        b.outT = this.t;
        this.flashes.push({ b, t: this.t });
        snd.blip(140, 'boom', 0.7);
      },
      draw(ctx) { draw(ctx, this, p, n); },
    };
    return sim;
  },

  // Seed whose clip lands near the target length, with a final duel that lasts a few seconds.
  search(p, from) {
    let best = null;
    for (let s = from; s < from + 240; s++) {
      const sim = this.create(p, s, { blip() {}, chord() {} });
      while (!sim.winner && sim.t < MAX_T + 1) sim.step(DT);
      const ex = sim.exits;
      const duel = ex.length >= 2 ? ex[ex.length - 1].outT - ex[ex.length - 2].outT : 0;
      const score = Math.abs(sim.endT - p.target) + (duel < 2 ? (2 - duel) * 3 : 0) + (sim.t > MAX_T ? 50 : 0);
      if (!best || score < best.score) best = { seed: s, score, len: sim.endT + OUTRO };
    }
    return best;
  },
};

function fall(b, dt) {
  b.vy += 2600 * dt;
  b.x += b.vx * dt * 0.6;
  b.y += b.vy * dt;
  b.alpha = Math.max(0, b.alpha - dt * 0.9);
}

function label(ctx, b, x, y, r) {
  const it = b.item;
  if (it.skin) {
    // themed skin: a big emoji with the short name on a band underneath
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    icon(ctx, it.skin, x, y - r * 0.2, r * 1.05);
    const text = it.label.toUpperCase();
    fitFont(ctx, text, 900, Math.round(r * 0.4), r * 1.55);
    ctx.lineWidth = r * 0.12;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, x, y + r * 0.52);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y + r * 0.52);
    return;
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (it.emoji) {
    icon(ctx, it.label, x, y, r * 1.3);
  } else {
    const size = it.label.length === 1 ? r * 1.05 : r * 0.62;
    ctx.font = `900 ${Math.round(size)}px ${FONT}`;
    ctx.fillText(it.label.toUpperCase(), x, y + r * 0.05);
  }
}

function draw(ctx, sim, p, n) {
  backdrop(ctx, undefined, undefined, sim.t);
  hook(ctx, [p.hook1, p.hook2], 210, 88);

  // live counter
  const left = sim.winner ? 1 : sim.balls.filter((b) => b.state !== 'out').length;
  pill(ctx, `Осталось: ${left} из ${n}`, W / 2, 440, { size: 40 });

  // ring with its gap
  const g = sim.t < INTRO ? p.gap * Math.PI / 180 : sim.gap;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = ACCENT;
  ctx.shadowBlur = sim.winner ? 50 : 26;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(CX, CY, R + 7, sim.gapAt + g / 2, sim.gapAt - g / 2 + Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawTable(ctx, sim, n);

  // balls: the fallen ones first so the living stay on top
  const order = [...sim.balls].sort((a, b) => (a.state === 'out') - (b.state === 'out')).reverse();
  for (const b of sim.balls) {
    if (b.state === 'out' || !b.trail || b === sim.winner) continue;
    const tr = b.trail;
    for (let k = 0; k < tr.length; k += 2) {
      const f = (k + 2) / (tr.length + 2);
      ctx.globalAlpha = f * 0.28;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(tr[k], tr[k + 1], sim.r * (0.35 + 0.55 * f), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const b of order) {
    if (b === sim.winner) continue;
    if (b.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ball(ctx, b.x, b.y, sim.r, b.color);
    label(ctx, b, b.x, b.y, sim.r);
    ctx.restore();
  }
  if (sim.winner) {
    const w = sim.winner;
    const k = ease((sim.t - sim.endT) / 0.8);
    const rr = sim.r * (1 + k * 1.3);
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 60 * k;
    ball(ctx, w.x, w.y, rr, w.color);
    ctx.restore();
    label(ctx, w, w.x, w.y, rr);
  } else if (sim.t < INTRO) {
    // pulse before the start so viewers can spot their ball
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(sim.t * 14);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#fff';
    for (const b of sim.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, sim.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // "выбыл" flash right under the ring
  const f = sim.flashes[sim.flashes.length - 1];
  if (f && sim.t - f.t < 1.1 && !sim.winner) {
    const a = 1 - Math.max(0, (sim.t - f.t - 0.7) / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    const s = 1 + 0.25 * (1 - ease((sim.t - f.t) / 0.2));
    ctx.translate(W / 2, 1488);
    ctx.scale(s, s);
    pill(ctx, `${f.b.item.name} вылетает · ${f.b.place} место`, 0, -40, { size: 42, bg: '#ff4d5e' });
    ctx.restore();
  }

  if (sim.winner) {
    const a = (sim.t - sim.endT - 0.5) / 0.4;
    endCard(ctx, ['Последним выжил', sim.winner.item.name, 'Пиши свой в комменты 👇'], a, 1180);
  }
}

// Every contestant as a chip: crossed out with its place once it falls.
function drawTable(ctx, sim, n) {
  const cols = 4;
  const rows = Math.ceil(n / cols);
  const gap = 12;
  const cw = (W - 80 - gap * (cols - 1)) / cols;
  const ch = Math.min(76, (1880 - 1560 - gap * (rows - 1)) / rows);
  const top = 1880 - rows * ch - (rows - 1) * gap;
  sim.balls.forEach((b, i) => {
    const x = 40 + (i % cols) * (cw + gap);
    const y = top + Math.floor(i / cols) * (ch + gap);
    const out = b.state === 'out';
    const win = b === sim.winner;
    ctx.save();
    ctx.globalAlpha = out ? 0.45 : 1;
    ctx.fillStyle = win ? ACCENT : 'rgba(30,28,64,0.92)';
    rrect(ctx, x, y, cw, ch, ch / 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(x + ch / 2, y + ch / 2, ch * 0.28, 0, Math.PI * 2);
    ctx.fill();
    const text = out ? `${b.place}. ${b.item.name}` : b.item.name;
    fitFont(ctx, text, 800, Math.round(ch * 0.4), cw - ch - 14);
    ctx.fillStyle = win ? '#1a1400' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + ch * 0.95, y + ch / 2 + 1);
    if (out) {
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + ch * 0.9, y + ch / 2);
      ctx.lineTo(x + cw - 14, y + ch / 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}
