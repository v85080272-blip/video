// What is drawn over the picture, in screen space. The language comes from the survival-explainer workflow vla sent on
// 27.10 (Kylo): small glowing plaques (an icon, a caps title, a mono caption) tied to the thing they name by a dashed
// leader, mono time stamps («ДЕНЬ 1 — 18:04»), a red diagonal ribbon once per clip, a notebook card with bars, karaoke
// subtitles (the whole phrase at once, words turn white as they are spoken, one coloured word at most) and a vignette.
// The series parts stay: the yellow step badge with its stamp, the red cross, the green tick, the end card.
import { createCanvas } from '@napi-rs/canvas';
import { g, W, H, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside, col } from './flat.js';
import { lerp, clamp, ease, spring, bump, hash, TAU, rgba, mix } from './lib.js';
import { text, stamp, pill, measure, FONTS, INK } from './type.js';

export const NIGHT = { bg0: '#0b0f1a', bg1: '#121a2b', line: '#3b8eea', lineHi: '#8cc4ff', warm: '#ffb84d', danger: '#e53935', ok: '#3ddc84', gold: '#f5c518', paper: '#f6f2e7' };
const RED = '#ff4d4d', GREEN = '#3e9a4a', CREAM = '#fff3d6';
const sp = (t, t0, f = 2.4, d = 7) => (t <= t0 ? 0 : spring(t - t0, f, d));
const scr = () => g.setTransform(1, 0, 0, 1, 0, 0);
function font(size, fam) { g.font = `${size}px ${fam}`; }
function width(str, size, fam) { font(size, fam); return g.measureText(str).width; }
// letters with a soft drop shadow and a thin dark outline (subtitles, plaques, stamps)
function label(str, x, y, size, color, o = {}) {
  const fam = o.fam ?? FONTS.black, a = o.a ?? 1;
  if (a <= 0.003) return;
  g.save(); g.globalAlpha *= a; g.translate(x, y); if (o.rot) g.rotate(o.rot); if (o.k) g.scale(o.k, o.k);
  font(size, fam); g.textAlign = o.align ?? 'center'; g.textBaseline = o.base ?? 'alphabetic';
  if (o.shadow !== false) { g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 14; g.shadowOffsetY = 3; }
  if (o.stroke !== false) { g.lineJoin = 'round'; g.lineWidth = o.strokeW ?? size * 0.09; g.strokeStyle = col(o.strokeColor ?? '#0b0f1a'); g.strokeText(str, 0, 0); g.shadowColor = 'transparent'; }
  g.fillStyle = col(color); g.fillText(str, 0, 0);
  g.restore();
}
export { label };

// —— icons: drawn round (0, 0) in a box of about 2r, in one colour ——
export function icon(kind, r, c) {
  const L = (pts, w = r * 0.16) => limb(pts, w, c, false);
  const P = (pts) => poly(pts, c);
  switch (kind) {
    case 'drop': fill(smoothPath([[0, -r * 0.95], [r * 0.5, -r * 0.1], [r * 0.6, r * 0.35], [0, r * 0.85], [-r * 0.6, r * 0.35], [-r * 0.5, -r * 0.1]]), c); break;
    case 'bolt': P([[r * 0.2, -r], [-r * 0.55, r * 0.12], [-r * 0.05, r * 0.12], [-r * 0.25, r], [r * 0.55, -r * 0.18], [r * 0.05, -r * 0.18]]); break;
    case 'pump': {
      g.lineWidth = r * 0.16; g.strokeStyle = col(c); g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.stroke();
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + (r > 0 ? 0.3 : 0); L([[0, 0], [Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5]], r * 0.14); }
      L([[r * 0.62, -r * 0.2], [r, -r * 0.2]], r * 0.2); L([[-r, r * 0.3], [-r * 0.62, r * 0.3]], r * 0.2); break;
    }
    case 'fridge': rrect(-r * 0.5, -r, r, r * 2, r * 0.16, c); rect(-r * 0.5, -r * 0.3, r, r * 0.08, '#0b0f1a'); rect(r * 0.24, -r * 0.8, r * 0.1, r * 0.34, '#0b0f1a'); rect(r * 0.24, -r * 0.12, r * 0.1, r * 0.5, '#0b0f1a'); break;
    case 'snow': for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3, dx = Math.cos(a) * r * 0.9, dy = Math.sin(a) * r * 0.9; L([[-dx, -dy], [dx, dy]]); } break;
    case 'flame': fill(smoothPath([[0, -r], [r * 0.5, -r * 0.2], [r * 0.55, r * 0.4], [0, r * 0.9], [-r * 0.55, r * 0.4], [-r * 0.35, -r * 0.1], [-r * 0.1, r * 0.05]]), c); break;
    case 'torch': rrect(-r * 0.9, -r * 0.22, r * 1.1, r * 0.44, r * 0.12, c); P([[r * 0.2, -r * 0.36], [r * 0.5, -r * 0.36], [r * 0.5, r * 0.36], [r * 0.2, r * 0.36]]);
      for (const a of [-0.4, 0, 0.4]) L([[r * 0.66, Math.sin(a) * r * 0.5], [r, Math.sin(a) * r * 0.9]], r * 0.12); break;
    case 'battery': g.lineWidth = r * 0.14; g.strokeStyle = col(c); g.stroke(rrPath(-r * 0.85, -r * 0.45, r * 1.55, r * 0.9, r * 0.14)); rect(r * 0.72, -r * 0.2, r * 0.18, r * 0.4, c); rect(-r * 0.66, -r * 0.27, r * 0.6, r * 0.54, c); break;
    case 'toilet': rrect(-r * 0.7, -r, r * 0.6, r * 0.9, r * 0.1, c); fill(smoothPath([[-r * 0.8, -r * 0.05], [r * 0.85, -r * 0.05], [r * 0.6, r * 0.45], [r * 0.15, r * 0.6], [r * 0.25, r], [-r * 0.45, r], [-r * 0.35, r * 0.55], [-r * 0.75, r * 0.3]]), c); break;
    case 'clock': g.lineWidth = r * 0.16; g.strokeStyle = col(c); g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.stroke(); L([[0, 0], [0, -r * 0.55]]); L([[0, 0], [r * 0.4, r * 0.15]]); break;
    case 'stairs': L([[-r, r * 0.8], [-r * 0.5, r * 0.8], [-r * 0.5, r * 0.3], [0, r * 0.3], [0, -r * 0.2], [r * 0.5, -r * 0.2], [r * 0.5, -r * 0.7], [r, -r * 0.7]]); break;
    case 'tap': L([[-r, -r * 0.3], [r * 0.3, -r * 0.3], [r * 0.55, 0], [r * 0.55, r * 0.25]], r * 0.22); L([[-r * 0.25, -r * 0.75], [r * 0.15, -r * 0.75]], r * 0.18); L([[-r * 0.05, -r * 0.75], [-r * 0.05, -r * 0.35]], r * 0.14); break;
    case 'bath': rrect(-r, -r * 0.1, r * 2, r * 0.75, r * 0.3, c); L([[-r * 0.7, r * 0.6], [-r * 0.8, r * 0.95]]); L([[r * 0.7, r * 0.6], [r * 0.8, r * 0.95]]); L([[-r * 0.8, -r * 0.1], [-r * 0.8, -r * 0.8], [-r * 0.4, -r * 0.8]]); break;
    case 'pot': rrect(-r * 0.75, -r * 0.35, r * 1.5, r * 1.1, r * 0.2, c); L([[-r, -r * 0.2], [-r * 0.75, -r * 0.2]], r * 0.2); L([[r * 0.75, -r * 0.2], [r, -r * 0.2]], r * 0.2); rect(-r * 0.85, -r * 0.55, r * 1.7, r * 0.14, c); break;
    case 'bottle': rrect(-r * 0.4, -r * 0.45, r * 0.8, r * 1.4, r * 0.2, c); rect(-r * 0.2, -r * 0.95, r * 0.4, r * 0.55, c); break;
    case 'phone': g.lineWidth = r * 0.16; g.strokeStyle = col(c); g.stroke(rrPath(-r * 0.5, -r * 0.9, r, r * 1.8, r * 0.18)); rect(-r * 0.2, r * 0.58, r * 0.4, r * 0.1, c); break;
    case 'comment': fill(rrPath(-r, -r * 0.75, r * 2, r * 1.3, r * 0.4), c); P([[-r * 0.5, r * 0.5], [-r * 0.65, r], [-r * 0.05, r * 0.5]]);
      for (let i = -1; i <= 1; i++) ell(i * r * 0.5, -r * 0.1, r * 0.14, r * 0.14, '#0b0f1a'); break;
    case 'x': L([[-r * 0.7, -r * 0.7], [r * 0.7, r * 0.7]], r * 0.26); L([[-r * 0.7, r * 0.7], [r * 0.7, -r * 0.7]], r * 0.26); break;
    case 'check': L([[-r * 0.7, 0], [-r * 0.2, r * 0.5], [r * 0.75, -r * 0.55]], r * 0.26); break;
    case 'house': P([[-r, -r * 0.05], [0, -r], [r, -r * 0.05]]); rect(-r * 0.7, -r * 0.05, r * 1.4, r, c); break;
    case 'lungs':                                    // two lobes on a windpipe
      L([[0, -r], [0, -r * 0.2]], r * 0.18); L([[0, -r * 0.25], [-r * 0.3, 0]], r * 0.14); L([[0, -r * 0.25], [r * 0.3, 0]], r * 0.14);
      fill(smoothPath([[-r * 0.18, -r * 0.45], [-r * 0.2, r * 0.6], [-r * 0.55, r * 0.9], [-r * 0.9, r * 0.6], [-r * 0.85, -r * 0.1], [-r * 0.5, -r * 0.6]]), c);
      fill(smoothPath([[r * 0.18, -r * 0.45], [r * 0.2, r * 0.6], [r * 0.55, r * 0.9], [r * 0.9, r * 0.6], [r * 0.85, -r * 0.1], [r * 0.5, -r * 0.6]]), c); break;
    case 'valve': {                                  // a valve hand wheel with spokes
      g.lineWidth = r * 0.2; g.strokeStyle = col(c); g.beginPath(); g.arc(0, 0, r * 0.78, 0, TAU); g.stroke();
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; L([[0, 0], [Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75]], r * 0.14); }
      ell(0, 0, r * 0.2, r * 0.2, c); break;
    }
    case 'fan': for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * TAU / 3); fill(smoothPath([[0, 0], [r * 0.25, -r * 0.35], [r * 0.15, -r * 0.9], [-r * 0.2, -r * 0.8], [-r * 0.12, -r * 0.3]]), c); g.restore(); }
      ell(0, 0, r * 0.18, r * 0.18, c); g.lineWidth = r * 0.12; g.strokeStyle = col(c); g.beginPath(); g.arc(0, 0, r * 0.98, 0, TAU); g.stroke(); break;
    case 'ear': g.lineWidth = r * 0.2; g.strokeStyle = col(c); g.lineCap = 'round';
      g.beginPath(); g.arc(r * 0.05, -r * 0.2, r * 0.55, Math.PI * 1.05, Math.PI * 0.25); g.quadraticCurveTo(r * 0.1, r * 0.4, -r * 0.1, r * 0.85); g.stroke();
      g.beginPath(); g.arc(r * 0.05, -r * 0.15, r * 0.22, Math.PI, Math.PI * 0.2); g.stroke();
      for (const k of [1, 1.6]) { g.lineWidth = r * 0.1; g.beginPath(); g.arc(-r * 0.2, -r * 0.1, r * 0.55 * k, Math.PI * 0.85, Math.PI * 1.25); g.stroke(); } break;
    case 'hatch': g.lineWidth = r * 0.16; g.strokeStyle = col(c); g.beginPath(); g.ellipse(0, r * 0.3, r * 0.9, r * 0.35, 0, 0, TAU); g.stroke();
      P([[-r * 0.85, r * 0.2], [-r * 0.5, -r * 0.8], [r * 0.4, -r * 0.8], [r * 0.85, r * 0.2]]);
      for (let i = 0; i < 3; i++) ell(-r * 0.4 + i * r * 0.4, -r * 0.95 - i * 0.0, r * 0.1, r * 0.1, c); break;
    case 'can': rrect(-r * 0.6, -r * 0.8, r * 1.2, r * 1.7, r * 0.18, c); rect(-r * 0.6, -r * 0.3, r * 1.2, r * 0.5, '#0b0f1a');
      ell(0, -r * 0.05, r * 0.2, r * 0.2, c); rect(-r * 0.45, -r * 1.0, r * 0.9, r * 0.22, c); break;
    case 'up': P([[0, -r], [r * 0.8, -r * 0.1], [r * 0.3, -r * 0.1], [r * 0.3, r * 0.9], [-r * 0.3, r * 0.9], [-r * 0.3, -r * 0.1], [-r * 0.8, -r * 0.1]]); break;
    case 'sub': fill(rrPath(-r, -r * 0.25, r * 2, r * 0.6, r * 0.3), c); P([[-r * 0.1, -r * 0.2], [0, -r * 0.65], [r * 0.4, -r * 0.65], [r * 0.45, -r * 0.2]]);
      L([[r * 0.2, -r * 0.65], [r * 0.2, -r * 0.95]], r * 0.1); P([[-r, 0.05 * r], [-r * 1.25, -r * 0.35], [-r * 1.25, r * 0.45]]); break;
    case 'wrench': L([[-r * 0.65, r * 0.65], [r * 0.3, -r * 0.3]], r * 0.3);
      g.lineWidth = r * 0.3; g.strokeStyle = col(c); g.beginPath(); g.arc(r * 0.45, -r * 0.45, r * 0.38, Math.PI * 0.2, Math.PI * 1.55); g.stroke(); break;
    case 'ruler': rect(-r * 0.25, -r, r * 0.5, r * 2, c); for (let i = 0; i < 6; i++) rect(r * 0.25, -r + i * r * 0.4, (i % 2 ? 0.25 : 0.5) * r, r * 0.1, c); break;
    default: ell(0, 0, r * 0.6, r * 0.6, c);
  }
}

// a dashed line growing from a to b (k 0…1) with a dot at b
function dashed(a, b, c, w, k = 1) {
  const e = clamp(k), q = [lerp(a[0], b[0], e), lerp(a[1], b[1], e)];
  g.save(); g.setLineDash([w * 2.2, w * 1.6]); g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = col(c);
  g.shadowColor = c; g.shadowBlur = 10;
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(q[0], q[1]); g.stroke(); g.restore();
  if (e > 0.95) { ell(b[0], b[1], w * 2.4, w * 2.4, rgba(c, 0.35)); ell(b[0], b[1], w * 1.3, w * 1.3, c); }
}
export { dashed };

// —— the plaque: an icon in a ring, a caps title and a mono caption, a thin glowing frame in the colour of its meaning
// (green good, gold a resource, red danger); `to` = a screen point it points at with a dashed leader.
// It cascades in from t0 (frame, icon, title, caption ~90 ms apart) and leaves at t1. Returns its box.
export function plaque(t, t0, t1, x, y, o) {
  if (t < t0 - 0.01 || t > t1 + 0.3) return null;
  const c = o.color ?? NIGHT.ok, size = o.size ?? 44, sub = o.sub ?? null, sz2 = Math.max(34, Math.round(size * 0.78));
  const tw = width(o.title, size, FONTS.black), sw = sub ? width(sub, sz2, FONTS.mono) : 0;
  const ir = o.icon ? (sub ? 40 : 32) : 0, pad = 26, h = sub ? size + sz2 + 50 : size + 44;
  const w = Math.round((o.icon ? ir * 2 + 22 : 0) + Math.max(tw, sw) + pad * 2);
  const out = clamp((t - t1) / 0.22), kin = sp(t, t0, 2.6, 9), a = clamp((t - t0) / 0.12) * (1 - out);
  if (a <= 0.003) return null;
  const k = lerp(0.94, 1, clamp(kin)) * (1 - 0.06 * out), bx = Math.round(x - (o.align === 'left' ? 0 : o.align === 'right' ? w : w / 2)), by = Math.round(y - h / 2);
  scr();
  if (o.to) {                                       // the leader first, from the nearest side of the card
    const from = [o.to[0] < bx ? bx : o.to[0] > bx + w ? bx + w : clamp(o.to[0], bx + 20, bx + w - 20), o.to[1] < by ? by : o.to[1] > by + h ? by + h : y];
    g.save(); g.globalAlpha = a; dashed(from, o.to, c, 5, seg01(t, t0 + 0.08, t0 + 0.38)); g.restore();
  }
  g.save(); g.globalAlpha = a; g.translate(bx + w / 2, y); g.scale(k, k); g.translate(-(bx + w / 2), -y);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
  fill(rrPath(bx, by, w, h, 18), 'rgba(11,15,26,0.9)'); g.restore();
  g.save(); g.shadowColor = c; g.shadowBlur = 16; g.lineWidth = 3; g.strokeStyle = col(c); g.stroke(rrPath(bx + 1.5, by + 1.5, w - 3, h - 3, 17)); g.restore();
  const a2 = clamp((t - t0 - 0.05) / 0.1), a3 = clamp((t - t0 - 0.09) / 0.1), a4 = clamp((t - t0 - 0.15) / 0.1);
  let tx = bx + pad;
  if (o.icon) {
    const cx = bx + pad + ir, cy = y;
    g.save(); g.globalAlpha *= a2; ell(cx, cy, ir, ir, rgba(c, 0.18)); g.lineWidth = 3; g.strokeStyle = col(c); g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.stroke();
    g.translate(cx, cy); icon(o.icon, ir * 0.58, c); g.restore();
    tx = cx + ir + 22;
  }
  const ty = sub ? by + 22 + size * 0.82 : y + size * 0.36;
  label(o.title, tx, ty, size, o.titleColor ?? '#ffffff', { align: 'left', a: a3, shadow: false, stroke: false });
  if (sub) label(sub, tx, ty + sz2 + 12, sz2, rgba(o.subColor ?? '#c9d6ea', 1), { fam: FONTS.mono, align: 'left', a: a4, shadow: false, stroke: false });
  g.restore();
  return { x: bx, y: by, w, h };
}
const seg01 = (t, a, b) => ease.out(clamp((t - a) / (b - a)));

// —— the service stamp at the top left: a mono line typed on, a blinking dot ——
export function timeStamp(t, t0, t1, str, o = {}) {
  if (t < t0 || t > t1 + 0.25) return;
  const x = o.x ?? 60, y = o.y ?? 150, size = o.size ?? 40, out = clamp((t - t1) / 0.2), a = clamp((t - t0) / 0.1) * (1 - out);
  const n = Math.min(str.length, Math.floor((t - t0) / 0.035) + 1), shown = str.slice(0, n);
  const w = width(str, size, FONTS.mono) + 84, h = size + 34;
  scr(); g.save(); g.globalAlpha = a;
  fill(rrPath(x, y - h / 2, w, h, 12), 'rgba(11,15,26,0.82)');
  g.save(); g.lineWidth = 2; g.strokeStyle = rgba(o.color ?? NIGHT.line, 0.9); g.stroke(rrPath(x + 1, y - h / 2 + 1, w - 2, h - 2, 11)); g.restore();
  const on = ((t - t0) % 1) < 0.6;
  ell(x + 30, y, 10, 10, on ? (o.dot ?? NIGHT.danger) : rgba(o.dot ?? NIGHT.danger, 0.3));
  label(shown, x + 54, y + size * 0.36, size, '#ffffff', { fam: FONTS.mono, align: 'left', shadow: false, stroke: false });
  g.restore();
}

// —— the red diagonal ribbon with one phrase (the accent, once per clip): wipes in from the left, out to the right ——
export function ribbon(t, t0, t1, str, o = {}) {
  if (t < t0 || t > t1 + 0.3) return;
  const y = o.y ?? 700, ang = o.rot ?? -0.12, size = o.size ?? 104, hh = size * 0.78;
  const kin = ease.out(clamp((t - t0) / 0.28)), kout = ease.in(clamp((t - t1) / 0.25));
  scr(); g.save(); g.translate(540, y); g.rotate(ang);
  const x0 = lerp(-1400, -900, kin) + 1800 * kout, x1 = lerp(-900, 900, kin) + 1800 * kout;
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 30; g.shadowOffsetY = 10; rect(x0, -hh, x1 - x0, 2 * hh, NIGHT.danger); g.restore();
  rect(x0, -hh, x1 - x0, 8, '#ff6b5e'); rect(x0, hh - 8, x1 - x0, 8, '#a8231f');
  g.beginPath(); g.rect(x0, -hh, x1 - x0, 2 * hh); g.clip();
  const shake = 6 * Math.exp(-(t - t0) * 6) * Math.sin((t - t0) * 60);
  label(str, shake, size * 0.36, size, '#ffffff', { strokeColor: '#7a1512', shadow: false, k: lerp(1.15, 1, clamp(sp(t, t0 + 0.1, 2.4, 8))) });
  g.restore();
}

// —— the notebook card: a lined sheet with ring holes, rows with an icon, a label and a bar that fills ——
// rows: [{ icon, label, value 0…1, color, note }]
export function paperCard(t, t0, t1, x, y, rows, o = {}) {
  if (t < t0 || t > t1 + 0.3) return;
  const w = o.w ?? 760, rh = 120, h = 90 + rows.length * rh, out = clamp((t - t1) / 0.22);
  const k = sp(t, t0, 2.4, 8) * (1 - ease.in(out));
  if (k <= 0.01) return;
  scr(); g.save(); g.translate(x, y); g.rotate(o.rot ?? -0.035); g.scale(lerp(0.94, 1, clamp(k)), lerp(0.94, 1, clamp(k))); g.globalAlpha = clamp(k * 3) * (1 - out);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 30; g.shadowOffsetY = 12; rrect(-w / 2, -h / 2, w, h, 14, NIGHT.paper); g.restore();
  for (let i = 1; i < rows.length + 1; i++) rect(-w / 2 + 20, -h / 2 + 60 + i * rh - 10, w - 40, 3, '#bcd3ea');
  rect(-w / 2 + 92, -h / 2, 3, h, '#e88a8a');
  for (let i = 0; i < 6; i++) { const hx = -w / 2 + 70 + i * (w - 140) / 5; ell(hx, -h / 2 + 26, 13, 13, '#2a3346'); limb([[hx, -h / 2 + 26], [hx, -h / 2 - 16]], 8, '#9aa3b5', false); }
  rows.forEach((r, i) => {
    const ry = -h / 2 + 60 + i * rh + rh / 2 - 6, ka = clamp((t - t0 - 0.12 - i * 0.1) / 0.14);
    g.save(); g.globalAlpha *= ka;
    g.save(); g.translate(-w / 2 + 50, ry); icon(r.icon, 26, r.color ?? '#2a3346'); g.restore();
    label(r.label, -w / 2 + 120, ry - 4, 42, '#1d2433', { align: 'left', shadow: false, stroke: false });
    if (r.note) label(r.note, w / 2 - 34, ry - 4, 42, r.color ?? '#1d2433', { align: 'right', shadow: false, stroke: false });
    const bw = w - 160, fillK = ease.out(clamp((t - t0 - 0.3 - i * 0.12) / 0.7)) * (r.value ?? 1);
    rrect(-w / 2 + 120, ry + 18, bw - 40, 22, 11, '#dcd6c6');
    rrect(-w / 2 + 120, ry + 18, Math.max(22, (bw - 40) * fillK), 22, 11, r.color ?? NIGHT.ok);
    g.restore();
  });
  g.restore();
}

// —— karaoke subtitles: a phrase of up to two lines appears whole (scale 0.94 → 1), unsaid words are white at 50 %,
// each turns white as it is spoken; at most one word in colour (gold important, red danger). The zone 56–74 % of the
// height is theirs: nothing else goes there.
export const SUB = { y: 1230, size: 82, lead: 96, maxW: 900 };
const bare = w => w.replace(/[.,!?…:;«»]/g, '').toUpperCase();
// words: [{w, s, e}]; a phrase ends at a sentence end, or before it would pass maxWords / maxChars
export function phrases(words, maxWords = 6, maxChars = 26, sizes = null) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push(cur); cur = []; };
  for (const w of words) {
    if (w.w === '—' || w.w === '-') continue;
    if (sizes) { cur.push(w); if (cur.length >= sizes[out.length]) flush(); continue; }
    const len = cur.reduce((a, x) => a + bare(x.w).length + 1, 0) + bare(w.w).length;
    if (cur.length >= maxWords || (cur.length && len > maxChars)) flush();
    cur.push(w);
    if (/[.?!:]$/.test(w.w)) flush();
  }
  flush();
  return out;
}
// split a phrase into two lines of about equal width
function lines2(words, size) {
  if (words.length < 3) return [words];
  const ws = words.map(w => width(w.txt, size, FONTS.black)), total = ws.reduce((a, b) => a + b, 0);
  let best = 1, bd = Infinity, acc = 0;
  for (let i = 1; i < words.length; i++) { acc += ws[i - 1]; const d = Math.abs(acc - (total - acc)); if (d < bd) { bd = d; best = i; } }
  return [words.slice(0, best), words.slice(best)];
}
export function karaoke(t, groups, hot = {}) {
  let gi = -1;
  for (let i = 0; i < groups.length; i++) if (t >= groups[i][0].s - 0.08) gi = i;
  if (gi < 0) return;
  const grp = groups[gi], next = groups[gi + 1];
  const t0 = grp[0].s - 0.08, hideAt = Math.min(next ? next[0].s - 0.08 : Infinity, grp[grp.length - 1].e + 0.4);
  if (t >= hideAt) return;                                   // the old phrase goes at once
  const size = SUB.size, words = grp.map(w => ({ ...w, txt: bare(w.w) }));
  let colored = false;
  for (const w of words) if (!colored && hot[w.txt]) { w.c = hot[w.txt]; colored = true; }
  const ls = lines2(words, size), k = lerp(0.94, 1, ease.out(clamp((t - t0) / 0.14)));
  scr(); g.save(); g.translate(540, SUB.y); g.scale(k, k);
  ls.forEach((line, li) => {
    const gap = size * 0.28, ws = line.map(w => width(w.txt, size, FONTS.black));
    const lw = ws.reduce((a, b) => a + b, 0) + gap * (line.length - 1), fit = Math.min(1, SUB.maxW / lw);
    let x = -lw * fit / 2;
    const y = (li - (ls.length - 1) / 2) * SUB.lead + size * 0.36;
    line.forEach((w, i) => {
      const said = t >= w.s - 0.03, pop = said ? 1 + 0.06 * bump(clamp((t - w.s + 0.03) / 0.16)) : 1;
      const c = w.c && said ? w.c : '#ffffff', a = said ? 1 : 0.5;
      label(w.txt, x + ws[i] * fit / 2, y, size * fit * pop, c, { a, strokeW: size * 0.1 });
      x += (ws[i] + gap) * fit;
    });
  });
  g.restore();
}

// —— grain and a soft vignette over everything (the grain changes once per video frame, not per motion-blur sub-frame) ——
let GRAIN = null, VIG = null;
export function initHud() {
  GRAIN = createCanvas(256, 256);
  const c = GRAIN.getContext('2d'), img = c.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = hash(i * 1.37 + 0.11) > 0.5 ? 255 : 0; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = Math.round(4 + 12 * hash(i * 0.73 + 5.1)); }
  c.putImageData(img, 0, 0);
  VIG = createCanvas(W, H);
  const v = VIG.getContext('2d'), gr = v.createRadialGradient(W / 2, H * 0.46, H * 0.3, W / 2, H * 0.46, H * 0.72);
  gr.addColorStop(0, 'rgba(5,7,14,0)'); gr.addColorStop(1, 'rgba(5,7,14,0.42)');
  v.fillStyle = gr; v.fillRect(0, 0, W, H);
}
export function finish(t, vig = 1) {
  scr();
  if (vig > 0) { g.save(); g.globalAlpha = vig; g.drawImage(VIG, 0, 0); g.restore(); }
  // no film grain: changing every frame it made the file 30 times bigger and the platforms' compression wipes it out anyway
}

// —— the series parts: red cross, green tick, the step badge and stamp, the end card ——
export function redX(x, y, size, k, rot = -0.08) {
  if (k <= 0.01) return;
  scr(); g.save(); g.translate(x, y);
  const z = lerp(1.8, 1, Math.min(1, k)) * Math.min(1, k * 4); g.scale(z, z); g.rotate(rot);
  for (const [c, d] of [[INK, 8], [RED, 0]]) for (const s of [-1, 1]) limb([[-size + d, -size * s + d], [size + d, size * s + d]], size * 0.42, c, false);
  g.restore();
}
export function tick(x, y, k, r = 74) {
  if (k <= 0.01) return;
  scr(); g.save(); g.translate(x, y); const z = lerp(1.6, 1, Math.min(1, k)) * Math.min(1, k * 4) * r / 74; g.scale(z, z); g.rotate(-0.06);
  ell(6, 8, 74, 74, INK); ell(0, 0, 74, 74, CREAM);
  for (const [c, d] of [[INK, 6], [GREEN, 0]]) limb([[-34 + d, 2 + d], [-8 + d, 30 + d], [38 + d, -28 + d]], 22, c, false);
  g.restore();
}
export function stepHeader(t, n, str, t0, t1, y = 330) {
  if (t < t0 || t > t1 + 0.3) return;
  const kin = sp(t, t0, 2.4, 7), kout = clamp((t - t1) / 0.25);
  const k = kin * (1 - ease.in(kout));
  if (k <= 0.01) return;
  const size = 62, sw = measure(str, size) + size * 0.6, total = 128 + 26 + sw, x0 = 540 - total / 2;
  scr(); g.save(); g.translate(x0 + 64, y); g.scale(k, k); g.rotate(-0.08 * (1 - kin));
  ell(6, 8, 64, 64, INK); ell(0, 0, 64, 64, '#ffd23f');
  text(String(n), 0, 30, 88, INK, { shadow: false });
  g.restore();
  const ks = sp(t, t0 + 0.12, 2.2, 8) * (1 - ease.in(kout));
  if (ks > 0.01) { scr(); g.save(); stamp(str, x0 + 128 + 26 + sw / 2, y, size, { k: lerp(1.8, 1, Math.min(1, ks)), rot: -0.04, a: Math.min(1, ks * 3), color: /^НЕ |^БЕЗ /.test(str) ? RED : '#2f8f4e' }); g.restore(); }
}
export function endCard(t, t0, out = 0, y = 300) {
  if (t < t0) return;
  const k = sp(t, t0, 2.4, 7) * (1 - out), kb = sp(t, t0 + 0.15, 2.6, 6) * (1 + 0.08 * bump(((t - t0 - 0.9) % 1.2) / 0.25)) * (1 - out);
  scr(); g.save();
  if (k > 0.01) {
    const hw = measure('КАК ВЫЖИТЬ', 56, FONTS.cond) / 2 + 30;
    g.save(); g.translate(540, y); g.scale(k, k); fill(polyPath([[-hw + 6, -38 + 8], [hw + 6, -38 + 8], [hw + 6, 38 + 8], [-hw + 6, 38 + 8]]), INK);
    fill(polyPath([[-hw, -38], [hw, -38], [hw, 38], [-hw, 38]]), '#ffd23f'); g.restore();
    text('КАК ВЫЖИТЬ', 540, y + 20, 56 * k, INK, { fam: FONTS.cond, shadow: false });
  }
  pill('ПОДПИСЫВАЙСЯ', 540, y + 170, 80, { k: kb });
  g.restore();
}
