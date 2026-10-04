// «Найди лишнее»: a ladder of levels, each a bigger grid with one odd tile
// (a different shade, Ш among Щ, 6 among 9, a slightly different emoji).
// A countdown runs, then the answer is circled. Viewers pause, rewatch and
// brag in the comments about the level they reached.

import { W, ACCENT, FONT, EMOJI, rng, clamp, ease, hook, pill, endCard, rrect, hsl, backdrop, fitFont } from './core.js';

const PAIRS = {
  letters: [['Ш', 'Щ'], ['И', 'Й'], ['Ь', 'Ъ'], ['Е', 'Ё'], ['З', 'Э'], ['Ц', 'Щ'], ['П', 'Н'], ['Б', 'В']],
  digits: [['6', '9'], ['3', '8'], ['1', '7'], ['5', '6'], ['0', '8'], ['2', '7'], ['4', '1']],
  emoji: [['😀', '😃'], ['😐', '😑'], ['🙂', '🙃'], ['😺', '😸'], ['🌑', '🌚'], ['🐻', '🐨'], ['🍏', '🍎'], ['😴', '😪']],
};

const INTRO = 0.6;
const REVEAL = 0.95;
const OUTRO = 3.2;
const TOP = 600;
const BOTTOM = 1640;

export const odd = {
  id: 'odd',
  tab: 'Найди лишнее',
  blurb:
    'Головоломка «найди отличие» с таймером. Зрители ставят паузу и пересматривают, а время просмотра для алгоритма решает всё. Лестница уровней держит до конца, а «на каком сдался?» собирает комменты.',
  fields: [
    { id: 'theme', label: 'Что искать', type: 'select', value: 'color',
      options: [['color', 'Другой оттенок'], ['letters', 'Буквы (Ш и Щ)'], ['digits', 'Цифры (6 и 9)'], ['emoji', 'Эмодзи'], ['mixed', 'Всё вперемешку']] },
    { id: 'hook1', label: 'Заголовок', type: 'text', value: 'Только 1% дойдёт' },
    { id: 'hook2', label: 'Вторая строка ({n} = число уровней)', type: 'text', value: 'до {n} уровня' },
    { id: 'levels', label: 'Уровней', type: 'range', min: 3, max: 7, step: 1, value: 5, unit: '' },
    { id: 'secs', label: 'Секунд на уровень', type: 'range', min: 2, max: 8, step: 0.5, value: 3, unit: ' с' },
    { id: 'hard', label: 'Сложность', type: 'range', min: 1, max: 5, step: 1, value: 3, unit: '' },
  ],

  create(p, seed, snd) {
    const rand = rng(seed);
    const L = p.levels;
    const themes = ['color', 'letters', 'digits', 'emoji'];
    const levels = [];
    for (let i = 0; i < L; i++) {
      const k = L === 1 ? 1 : i / (L - 1);
      const cols = Math.round(4 + p.hard * 0.5 + k * (3 + p.hard * 0.6));
      const rows = Math.round(cols * 1.15);
      const theme = p.theme === 'mixed' ? themes[Math.floor(rand() * themes.length)] : p.theme;
      const lv = { cols, rows, theme, odd: Math.floor(rand() * cols * rows) };
      if (theme === 'color') {
        lv.hue = rand() * 360;
        lv.sat = 0.55 + rand() * 0.3;
        lv.base = 0.5;
        // the gap in lightness shrinks with each level and with difficulty
        lv.delta = (0.16 - k * 0.1) * (1.25 - p.hard * 0.12) * (rand() < 0.5 ? 1 : -1);
      } else {
        const list = PAIRS[theme];
        const pair = list[Math.floor(rand() * list.length)];
        const flip = rand() < 0.5;
        lv.a = flip ? pair[1] : pair[0];
        lv.b = flip ? pair[0] : pair[1];
      }
      levels.push(lv);
    }
    const per = INTRO + p.secs + REVEAL;
    const total = L * per + OUTRO;
    let lastTick = -1;

    return {
      t: 0, over: false, levels, per, total, len: total,
      step(dt) {
        this.t += dt;
        const i = Math.floor(this.t / per);
        const local = this.t - i * per;
        if (i < L) {
          // one tick per remaining second, a pop when the answer shows
          const mark = local < INTRO ? -1 : local < INTRO + p.secs ? Math.floor(local - INTRO) : 99;
          const key = i * 1000 + mark;
          if (mark >= 0 && key !== lastTick) {
            lastTick = key;
            if (mark === 99) snd.blip(880, 'bell', 0.5);
            else snd.blip(mark >= p.secs - 1.5 ? 990 : 660, 'tick', 0.8);
          }
        }
        if (this.t >= total) this.over = true;
      },
      draw(ctx) { draw(ctx, this, p); },
    };
  },
};

function cellText(lv, idx) {
  return idx === lv.odd ? lv.b : lv.a;
}

function draw(ctx, sim, p) {
  backdrop(ctx, '#132046', '#060a1a');
  const L = sim.levels.length;
  hook(ctx, [p.hook1, (p.hook2 || '').replace('{n}', L)], 210, 88);

  const i = Math.min(L - 1, Math.floor(sim.t / sim.per));
  const local = sim.t - i * sim.per;
  const lv = sim.levels[i];
  const finished = sim.t >= L * sim.per;

  pill(ctx, `Уровень ${i + 1} из ${L}`, W / 2, 430, { size: 42, bg: finished ? 'rgba(30,28,64,0.92)' : ACCENT, color: finished ? '#fff' : '#1a1400' });

  const cell = Math.min((W - 100) / lv.cols, (BOTTOM - TOP) / lv.rows);
  const gw = cell * lv.cols;
  const gh = cell * lv.rows;
  const x0 = (W - gw) / 2;
  const y0 = TOP + (BOTTOM - TOP - gh) / 2;
  const intro = local < INTRO && !finished;
  const reveal = local >= INTRO + p.secs || finished;
  const appear = intro ? ease(local / INTRO) : 1;

  ctx.save();
  ctx.globalAlpha = appear;
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const idx = r * lv.cols + c;
      const x = x0 + c * cell;
      const y = y0 + r * cell;
      const dim = reveal && idx !== lv.odd ? 0.25 : 1;
      ctx.globalAlpha = appear * dim;
      if (lv.theme === 'color') {
        ctx.fillStyle = hsl(lv.hue, lv.sat, lv.base + (idx === lv.odd ? lv.delta : 0));
        rrect(ctx, x + cell * 0.06, y + cell * 0.06, cell * 0.88, cell * 0.88, cell * 0.18);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fam = lv.theme === 'emoji' ? EMOJI : FONT;
        ctx.font = `${lv.theme === 'emoji' ? '' : '800 '}${Math.round(cell * 0.7)}px ${fam}`;
        ctx.fillText(cellText(lv, idx), x + cell / 2, y + cell / 2 + cell * 0.04);
      }
    }
  }
  ctx.restore();

  if (intro) {
    // big level number slams in
    const k = ease(local / 0.35);
    ctx.save();
    ctx.globalAlpha = 1 - clamp((local - 0.45) / 0.3, 0, 1);
    ctx.translate(W / 2, 1120);
    ctx.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k);
    ctx.fillStyle = ACCENT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 30;
    ctx.font = `900 170px ${FONT}`;
    ctx.fillText(`${i + 1}`, 0, 0);
    ctx.restore();
  }

  if (reveal) {
    const c = lv.odd % lv.cols;
    const r = Math.floor(lv.odd / lv.cols);
    const cx = x0 + c * cell + cell / 2;
    const cy = y0 + r * cell + cell / 2;
    const k = ease((local - INTRO - p.secs) / 0.3);
    ctx.save();
    ctx.strokeStyle = '#ff3b4f';
    ctx.lineWidth = 12;
    ctx.shadowColor = '#ff3b4f';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (0.75 + (1 - k) * 1.5), 0, Math.PI * 2 * (finished ? 1 : k));
    ctx.stroke();
    ctx.restore();
    if (!finished) pill(ctx, 'Вот оно! Успел?', W / 2, 1700, { size: 46, bg: '#ff3b4f' });
  } else if (!intro) {
    // countdown bar with the seconds left
    const left = INTRO + p.secs - local;
    const f = left / p.secs;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rrect(ctx, 90, 1716, W - 180, 34, 17);
    ctx.fill();
    ctx.fillStyle = f < 0.35 ? '#ff3b4f' : ACCENT;
    rrect(ctx, 90, 1716, (W - 180) * f, 34, 17);
    ctx.fill();
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    fitFont(ctx, 'x', 900, 64, 999);
    ctx.fillText(Math.ceil(left).toString(), W / 2, 1840);
    ctx.restore();
  }

  if (finished) {
    endCard(ctx, ['Дошёл до конца?', 'На каком сдался?', 'Пиши в комменты 👇'], (sim.t - L * sim.per) / 0.4, 1120);
  }
}
