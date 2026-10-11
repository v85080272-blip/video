// 2D-слой монтажа: текст с обводкой, появление/уход, субтитры по словам, зерно, виньетка.
import { W, H, clamp, lerp, seg, eo, back, spring, rng } from './core.js';

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
export function subtitles(t, lines, y = 1440, colors = { P: '#ffc46b', N: '#8fe3ff' }) {
  for (const L of lines) {
    if (!L.d || !L.text || t < L.t0 - .05 || t > L.sub1) continue;
    const ws = words(L); let ci = ws.findIndex(w => t < w.e); if (ci < 0) ci = ws.length - 1;
    const g0 = ci - ci % 2, grp = ws.slice(g0, g0 + 2);
    const pop = back(seg(t, ws[g0].s - .05, ws[g0].s + .12)), a = 1 - seg(t, L.sub1 - .12, L.sub1);
    const size = grp.join('').length > 16 ? 76 : 88;
    cx.font = `900 ${size}px Rubik`; const widths = grp.map(w => cx.measureText(w.w).width), gap = 38, tw = widths.reduce((s, w) => s + w, 0) + gap * (grp.length - 1);
    const sc = Math.min(1, (W - 90) / tw);
    let x = W / 2 - tw * sc / 2;
    grp.forEach((w, i) => { const cur = g0 + i === ci; txt(w.w, x + widths[i] * sc / 2, y, { size: size * sc, fill: cur ? colors[L.who] : '#fff', lw: 20 * sc, scale: pop * (cur ? 1.07 : 1), alpha: a }); x += (widths[i] + gap) * sc; });
  }
}

// цветокор, виньетка, зерно
export function finish(t, { vig = .5, warm = .16, fps = 30 } = {}) {
  cx.save(); cx.globalCompositeOperation = 'soft-light'; cx.fillStyle = `rgba(255,170,90,${warm})`; cx.fillRect(0, 0, W, H); cx.restore();
  const g = cx.createRadialGradient(W / 2, H * .45, H * .24, W / 2, H * .5, H * .8); g.addColorStop(0, 'rgba(30,10,30,0)'); g.addColorStop(1, `rgba(30,10,30,${vig})`); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  cx.save(); cx.globalAlpha = .06; cx.globalCompositeOperation = 'overlay'; cx.drawImage(grain[Math.floor(t * fps) % 4], 0, 0, W, H); cx.restore();
}
