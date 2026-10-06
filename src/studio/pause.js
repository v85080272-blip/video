// «Стоп-кадр»: a pause challenge. A highlight jumps around twelve tiles;
// the viewer pauses the video and whatever is lit is "theirs". One mystery
// tile flashes a jackpot for a few frames only, so people replay to catch it.

import { W, ACCENT, FONT, icon, rng, clamp, ease, hook, endCard, rrect, backdrop, fitFont, splitIcon, pill } from './core.js';

const TOPICS = {
  dinner: {
    name: 'Ужин',
    hook2: 'и узнай свой ужин',
    items: ['🍕 Пицца', '🍣 Роллы', '🍔 Бургер', '🥟 Пельмени', '🌯 Шаурма', '🍝 Паста', '🥗 Салат', '🍜 Рамен', '🥞 Блины', '🍗 Крылышки', '🥣 Доширак'],
    jackpot: '💎 Ужин за чужой счёт',
  },
  power: {
    name: 'Суперсила',
    hook2: 'и узнай свою суперсилу',
    items: ['⏸️ Стоп-время', '👻 Невидимость', '🦅 Полёт', '🧠 Читать мысли', '⚡ Скорость', '🌀 Телепорт', '💪 Суперсила', '🔥 Огонь', '❄️ Лёд', '🐾 Язык зверей', '🔮 Видеть будущее'],
    jackpot: '💎 Все силы сразу',
  },
  future: {
    name: 'Кем станешь в 30',
    hook2: 'и узнай, кем станешь в 30',
    items: ['💼 Миллионер', '🎤 Звезда', '🧑‍🍳 Шеф-повар', '🚀 Космонавт', '🎮 Стример', '🏝️ Живёшь у моря', '💻 Айтишник', '🐈 Кошатник', '🏋️ Качок', '🎬 Режиссёр', '🌾 Фермер'],
    jackpot: '👑 Король мира',
  },
  trip: {
    name: 'Отпуск',
    hook2: 'и узнай, куда поедешь',
    items: ['🏝️ Мальдивы', '🗼 Париж', '🗻 Япония', '🏔️ Алтай', '🌊 Сочи', '🏜️ Дубай', '🏰 Прага', '🐘 Таиланд', '🌋 Камчатка', '🏡 Дача', '🛋️ Диван'],
    jackpot: '💎 Кругосветка',
  },
  pet: {
    name: 'Питомец',
    hook2: 'и узнай своего питомца',
    items: ['🐶 Пёс', '🐱 Кот', '🦊 Лиса', '🐼 Панда', '🐹 Хомяк', '🦜 Попугай', '🐢 Черепаха', '🦔 Ёж', '🐧 Пингвин', '🦦 Выдра', '🐍 Змея'],
    jackpot: '🦄 Единорог',
  },
};

const INTRO = 0.6;
const SLOW = 2.6;
const OUTRO = 3.2;
const COLS = 3;
const ROWS = 4;
const GX = 50;
const GY = 590;
const GAP = 22;
const TW = (W - GX * 2 - GAP * (COLS - 1)) / COLS;
const TH = (1600 - GY - GAP * (ROWS - 1)) / ROWS;

function itemsFor(p) {
  if (p.topic !== 'custom') {
    const t = TOPICS[p.topic];
    return { items: t.items.map(splitIcon), jackpot: splitIcon(t.jackpot) };
  }
  const lines = (p.custom || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const jl = lines.find((l) => l.startsWith('!'));
  const plain = lines.filter((l) => !l.startsWith('!'));
  const items = plain.slice(0, 11).map(splitIcon);
  while (items.length < 11) items.push({ icon: '❔', text: '...' });
  return { items, jackpot: splitIcon(jl ? jl.slice(1) : '💎 Джекпот') };
}

export const pause = {
  id: 'pause',
  tab: 'Стоп-кадр',
  blurb:
    'Пауза-челлендж: «останови видео и узнай свой ужин». Каждый жмёт паузу по нескольку раз, а 💎 мелькает всего на пару кадров, поэтому ролик пересматривают. В комменты пишут, что выпало.',
  fields: [
    { id: 'topic', label: 'Тема', type: 'select', value: 'dinner',
      options: [...Object.entries(TOPICS).map(([k, t]) => [k, t.name]), ['custom', 'Своя тема']] },
    { id: 'custom', label: '11 вариантов по строке, джекпот со знаком !', type: 'textarea', when: (p) => p.topic === 'custom',
      value: '🍕 Пицца\n🍣 Роллы\n🍔 Бургер\n🥟 Пельмени\n🌯 Шаурма\n🍝 Паста\n🥗 Салат\n🍜 Рамен\n🥞 Блины\n🍗 Крылышки\n🥣 Доширак\n!💎 Джекпот' },
    { id: 'hook1', label: 'Заголовок', type: 'text', value: 'Останови видео' },
    { id: 'hook2', label: 'Вторая строка (жёлтая)', type: 'text', value: TOPICS.dinner.hook2 },
    { id: 'hz', label: 'Скачков в секунду', type: 'range', min: 4, max: 14, step: 1, value: 8, unit: '' },
    { id: 'dur', label: 'Длина перебора, с', type: 'range', min: 6, max: 18, step: 1, value: 10, unit: ' с' },
    { id: 'jf', label: 'Джекпот виден, кадров (60 к/с)', type: 'range', min: 1, max: 8, step: 1, value: 3, unit: '' },
  ],
  onChange(id, p) {
    if (id === 'topic' && TOPICS[p.topic]) {
      p.hook2 = TOPICS[p.topic].hook2;
      return true;
    }
    return false;
  },

  create(p, seed, snd) {
    const rand = rng(seed);
    const { items, jackpot } = itemsFor(p);
    const mystery = Math.floor(rand() * 12);
    // tile index -> item index (or -1 for the mystery tile)
    const tiles = [];
    for (let i = 0, k = 0; i < 12; i++) tiles.push(i === mystery ? -1 : k++);

    // the whole run of jumps, computed up front so every replay is identical
    const plan = [];
    let t = INTRO;
    let cur = -1;
    const pick = () => {
      let n;
      do n = Math.floor(rand() * 12); while (n === cur || n === mystery);
      return n;
    };
    const jackT = INTRO + p.dur * (0.35 + rand() * 0.4);
    let jackDone = false;
    while (t < INTRO + p.dur) {
      if (!jackDone && t >= jackT) {
        jackDone = true;
        const d = p.jf / 60;
        plan.push({ t, idx: mystery, jack: true });
        t += d;
        continue;
      }
      cur = pick();
      plan.push({ t, idx: cur });
      t += 1 / p.hz;
    }
    // slow-down: gaps stretch out like a roulette wheel
    let gap = 1 / p.hz;
    const slowEnd = t + SLOW;
    while (t < slowEnd) {
      cur = pick();
      plan.push({ t, idx: cur });
      gap *= 1.32;
      t += gap;
    }
    const stopT = t;
    const total = stopT + OUTRO;
    let pi = -1;

    return {
      t: 0, over: false, len: total, plan, stopT, tiles, items, jackpot, mystery,
      final: plan[plan.length - 1].idx,
      cur: -1, jack: false,
      step(dt) {
        this.t += dt;
        while (pi + 1 < plan.length && plan[pi + 1].t <= this.t) {
          pi++;
          this.cur = plan[pi].idx;
          this.jack = !!plan[pi].jack;
          this.since = plan[pi].t;
          snd.blip(this.jack ? 1568 : 700 + (this.cur % 4) * 90, this.jack ? 'bell' : 'tick', 0.9);
          if (pi === plan.length - 1) snd.chord([523, 659, 784]);
        }
        if (this.t >= total) this.over = true;
      },
      draw(ctx) { draw(ctx, this, p); },
    };
  },
};

function drawTile(ctx, x, y, w, h, it, lit, dim, gold) {
  ctx.save();
  ctx.globalAlpha = dim ? 0.35 : 1;
  if (lit) {
    ctx.shadowColor = gold ? '#7df9ff' : ACCENT;
    ctx.shadowBlur = 50;
  }
  ctx.fillStyle = lit ? (gold ? '#7df9ff' : ACCENT) : 'rgba(34,31,74,0.95)';
  rrect(ctx, x, y, w, h, 34);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  icon(ctx, it.icon, x + w / 2, y + h * 0.38, h * 0.52);
  fitFont(ctx, it.text.toUpperCase(), 900, 38, w - 30);
  ctx.fillStyle = lit ? '#1a1400' : '#ffffff';
  ctx.fillText(it.text.toUpperCase(), x + w / 2, y + h * 0.8);
  ctx.restore();
}

function draw(ctx, sim, p) {
  backdrop(ctx, '#2a0f3f', '#0a0618', sim.t);
  hook(ctx, [p.hook1, p.hook2], 210, 90);
  const done = sim.t >= sim.stopT;

  for (let i = 0; i < 12; i++) {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = GX + c * (TW + GAP);
    const y = GY + r * (TH + GAP);
    const lit = sim.cur === i;
    let pop = lit ? 1 + 0.06 * (1 - ease((sim.t - sim.since) / 0.08)) : 1;
    if (done && lit) pop = 1 + 0.08 * Math.sin(Math.min(1, (sim.t - sim.stopT) / 0.3) * Math.PI);
    ctx.save();
    ctx.translate(x + TW / 2, y + TH / 2);
    ctx.scale(pop, pop);
    if (sim.tiles[i] === -1) {
      const show = lit && sim.jack;
      drawTile(ctx, -TW / 2, -TH / 2, TW, TH, show ? sim.jackpot : { icon: '❓', text: 'Секрет' }, show, done, true);
    } else {
      drawTile(ctx, -TW / 2, -TH / 2, TW, TH, sim.items[sim.tiles[i]], lit, done && !lit, false);
    }
    ctx.restore();
  }

  if (!done) {
    pill(ctx, `${sim.jackpot.icon} мелькнёт всего один раз. Поймаешь?`, W / 2, 1690, { size: 40 });
  } else {
    const it = sim.items[sim.tiles[sim.final]];
    const a = (sim.t - sim.stopT - 0.4) / 0.4;
    endCard(ctx, [`Без паузы выпало: ${it.text}`, 'А что поймал ты? 👇'], a, 1765);
  }
}
