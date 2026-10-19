// 2D-слой монтажа: текст с обводкой, появление/уход, субтитры по словам, панель «/effort», зерно, виньетка.
import { W, H, clamp, lerp, seg, eo, back, spring, rng } from './scene.js';

export const out = document.getElementById('out'), cx = out.getContext('2d');
await document.fonts.load('900 60px Rubik', 'ЁёАаZ'); await document.fonts.load('900 60px Unbounded', 'ЁёАаZ');
const grain = [0, 1, 2, 3].map(s => { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'), d = x.createImageData(540, 960), r = rng(40 + s); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 160; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });

export function txt(text, x, y, { size = 64, font = 'Rubik', fill = '#fff', stroke = '#111', lw = 14, alpha = 1, scale = 1, rot = 0, align = 'center', weight = 900 } = {}) {
  if (alpha <= 0 || scale <= 0) return;
  cx.save(); cx.globalAlpha = clamp(alpha); cx.translate(x, y); cx.rotate(rot); cx.scale(scale, scale);
  cx.font = `${weight} ${size}px ${font}`; cx.textAlign = align; cx.textBaseline = 'middle'; cx.lineJoin = 'round';
  if (lw > 0) { cx.strokeStyle = stroke; cx.lineWidth = lw; cx.strokeText(text, 0, 0); }
  cx.shadowColor = 'rgba(0,0,0,.4)'; cx.shadowBlur = 14; cx.shadowOffsetY = 7; cx.fillStyle = fill; cx.fillText(text, 0, 0); cx.restore();
}
// появление: масштаб + подъём + прозрачность вместе, уход быстрее
export const inOut = (t, a, b, din = .25, dout = .12) => ({ k: back(seg(t, a, a + din)), a: seg(t, a, a + din * .6) * (1 - seg(t, b - dout, b)), y: (1 - eo(seg(t, a, a + din))) * 40 });

export function words(L) {   // время каждого слова по доле букв
  const ws = L.text.split(' '), tot = ws.reduce((s, w) => s + w.length, 0); let acc = 0;
  return ws.map(w => { const s = L.t0 + L.d * acc / tot; acc += w.length; return { w, s, e: L.t0 + L.d * acc / tot }; });
}
// субтитры: по 2 слова, текущее подсвечено цветом говорящего
export function subtitles(t, lines, y = 1440, colors = { C: '#ffe14d', K: '#ffb08a' }) {
  for (const L of lines) {
    if (!L.d || t < L.t0 - .05 || t > L.sub1) continue;
    const ws = words(L); let ci = ws.findIndex(w => t < w.e); if (ci < 0) ci = ws.length - 1;
    const g0 = ci - ci % 2, grp = ws.slice(g0, g0 + 2);
    const pop = back(seg(t, ws[g0].s - .05, ws[g0].s + .12)), a = 1 - seg(t, L.sub1 - .12, L.sub1);
    const size = grp.join('').length > 16 ? 76 : 88;
    cx.font = `900 ${size}px Rubik`; const widths = grp.map(w => cx.measureText(w.w).width), gap = 24, tw = widths.reduce((s, w) => s + w, 0) + gap * (grp.length - 1);
    const sc = Math.min(1, (W - 90) / tw);
    let x = W / 2 - tw * sc / 2;
    grp.forEach((w, i) => { const cur = g0 + i === ci; txt(w.w, x + widths[i] * sc / 2, y, { size: size * sc, fill: cur ? colors[L.who] : '#fff', lw: 20 * sc, scale: pop * (cur ? 1.07 : 1), alpha: a }); x += (widths[i] + gap) * sc; });
  }
}

// панель терминала Claude Code с ползунком /effort
export const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const LEVEL_RU = { low: 'НИЗКИЙ', medium: 'СРЕДНИЙ', high: 'ВЫСОКИЙ', xhigh: 'ОЧЕНЬ ВЫСОКИЙ', max: 'МАКСИМУМ' };
export const LEVEL_COL = { low: '#7de0ff', medium: '#7dff9a', high: '#ffe14d', xhigh: '#ffa64d', max: '#ff5c7a' };
export function effortPanel(t, { x = 90, y = 230, w = W - 180, pos = 1, alpha = 1, scale = 1, cmd = '/effort', typed = 1, note = '' } = {}) {
  if (alpha <= 0) return;
  const h = 300;
  cx.save(); cx.globalAlpha = clamp(alpha); cx.translate(x + w / 2, y + h / 2); cx.scale(scale, scale); cx.translate(-w / 2, -h / 2);
  cx.shadowColor = 'rgba(0,0,0,.45)'; cx.shadowBlur = 40; cx.shadowOffsetY = 16;
  cx.fillStyle = 'rgba(28,24,22,.93)'; cx.beginPath(); cx.roundRect(0, 0, w, h, 34); cx.fill(); cx.shadowColor = 'transparent';
  cx.strokeStyle = '#d97757'; cx.lineWidth = 5; cx.stroke();
  // три точки окна
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { cx.fillStyle = c; cx.beginPath(); cx.arc(40 + i * 34, 38, 10, 0, 7); cx.fill(); });
  cx.font = 'bold 30px "DejaVu Sans Mono"'; cx.fillStyle = '#9b948c'; cx.textBaseline = 'middle'; cx.fillText('Claude Code', 160, 39);
  // строка команды
  cx.font = 'bold 54px "DejaVu Sans Mono"'; cx.fillStyle = '#d97757'; cx.fillText('>', 40, 110);
  const shown = cmd.slice(0, Math.round(cmd.length * clamp(typed))); cx.fillStyle = '#fff'; cx.fillText(shown, 86, 110);
  if (typed < 1 || Math.floor(t * 2.5) % 2 === 0) { const cw = cx.measureText(shown).width; cx.fillStyle = '#fff'; cx.fillRect(92 + cw, 84, 26, 52); }
  // ползунок
  const sx = 70, sw = w - 140, sy = 200, p = clamp(pos / (LEVELS.length - 1));
  cx.fillStyle = '#3a3430'; cx.beginPath(); cx.roundRect(sx, sy - 8, sw, 16, 8); cx.fill();
  const gr = cx.createLinearGradient(sx, 0, sx + sw, 0); LEVELS.forEach((l, i) => gr.addColorStop(i / 4, LEVEL_COL[l]));
  cx.fillStyle = gr; cx.beginPath(); cx.roundRect(sx, sy - 8, Math.max(16, sw * p), 16, 8); cx.fill();
  const cur = Math.round(pos);
  LEVELS.forEach((l, i) => {
    const lx = sx + sw * i / 4; cx.fillStyle = i <= pos + .01 ? LEVEL_COL[l] : '#5a524c'; cx.beginPath(); cx.arc(lx, sy, 11, 0, 7); cx.fill();
    cx.font = `bold ${i === cur ? 34 : 28}px "DejaVu Sans Mono"`; cx.textAlign = 'center'; cx.fillStyle = i === cur ? LEVEL_COL[l] : '#8a827b'; cx.fillText(l, lx, sy + 52);
  });
  const kx = sx + sw * p; cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(kx, sy, 24, 0, 7); cx.fill(); cx.strokeStyle = '#d97757'; cx.lineWidth = 6; cx.stroke();
  cx.restore();
  if (note) txt(note, x + w / 2, y + h + 70, { size: note.length > 12 ? 56 : 66, font: 'Unbounded', fill: LEVEL_COL[LEVELS[Math.round(pos)]], lw: 16, alpha });
}

// цветокор, виньетка, зерно
export function finish(t, { vig = .5, warm = .16, fps = 30 } = {}) {
  cx.save(); cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = `rgba(255,170,90,${warm})`; cx.fillRect(0, 0, W, H); cx.restore();
  const g = cx.createRadialGradient(W / 2, H * .45, H * .24, W / 2, H * .5, H * .8); g.addColorStop(0, 'rgba(30,10,30,0)'); g.addColorStop(1, `rgba(30,10,30,${vig})`); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  cx.save(); cx.globalAlpha = .06; cx.globalCompositeOperation = 'overlay'; cx.drawImage(grain[Math.floor(t * fps) % 4], 0, 0, W, H); cx.restore();
}
