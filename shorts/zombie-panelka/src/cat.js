// Батон — a fat ginger cat. Views: 'sit' (front), 'side' (profile, walking or swiping), 'top' (seen from above), 'head' (peeking).
// Origin: at the ground under the body for sit/side, the body centre for top, the neck for head.
import { g, solid, hose, smoothPath, ellPath, stroke, line, softShadow, px, LIGHT } from './draw.js';
import { TAU, clamp, lerp, rgba, shade } from './lib.js';

export const CAT = { fur: '#f28a2a', furDark: '#c45f17', white: '#fff4e6', nose: '#f08a9a', iris: '#bfe04a', inner: '#f6a7b0' };

const DEF = {
  x: 0, y: 0, s: 1, face: 1, view: 'sit', blink: 0, lookX: 0, lookY: 0, pupil: 1, ears: 0, mouth: 'w', tongue: 0,
  tail: 0, tailT: 0, puff: 0, paw: 0, walk: 0, tilt: 0, bodyTilt: 0, squash: 1, shadow: 0.3, smug: 0,
};

export function drawCat(pose) {
  const p = { ...DEF, ...pose };
  if (p.shadow && p.view !== 'head' && p.view !== 'top') softShadow(p.x, p.y + 3 * p.s, 120 * p.s, 18 * p.s, p.shadow);
  g.save(); g.translate(p.x, p.y); g.scale(p.s * p.face, p.s);
  if (p.view === 'sit') sit(p); else if (p.view === 'side') side(p); else if (p.view === 'top') top(p); else head(p, 0, 0);
  g.restore();
}

function stripes(path, pts, w = 12) {
  g.save(); g.clip(path); g.strokeStyle = rgba(CAT.furDark, 0.85); g.lineCap = 'round';
  for (const s of pts) { g.lineWidth = px(1) * 0 + w; g.beginPath(); g.moveTo(...s[0]); g.quadraticCurveTo(...s[1], ...s[2]); g.stroke(); }
  g.restore();
}

function tailPath(base, ang, curl, len = 150, wid = 34) {
  const pts = [base];
  for (let i = 1; i <= 5; i++) {
    const k = i / 5, a = ang + curl * k * k;
    const prev = pts[pts.length - 1];
    pts.push([prev[0] + Math.sin(a) * len / 5, prev[1] - Math.cos(a) * len / 5]);
  }
  return pts;
}

function sit(p) {
  const sq = p.squash, pf = 1 + p.puff * 0.18;
  g.save(); g.scale(pf / Math.sqrt(sq), sq * pf);
  // tail around the right side
  const tw = Math.sin(p.tailT * 2.2) * 0.35 + p.tail;
  const tp = tailPath([70, -40], 1.4 + tw * 0.3, -2.2 - tw, 170);
  hose(tp, 36 + p.puff * 20, CAT.fur, { rimA: 0.5 });
  // body
  const body = smoothPath([[-30, -205], [30, -205], [92, -150], [112, -60], [98, -6], [0, 6], [-98, -6], [-112, -60], [-92, -150]]);
  solid(body, CAT.fur, [-112, -205, 224, 210]);
  stripes(body, [[[-110, -110], [-80, -95], [-70, -120]], [[110, -110], [80, -95], [70, -120]], [[-110, -70], [-84, -55], [-74, -80]], [[110, -70], [84, -55], [74, -80]]], 13);
  // white bib
  const bib = smoothPath([[0, -180], [44, -140], [50, -70], [26, -14], [-26, -14], [-50, -70], [-44, -140]]);
  solid(bib, CAT.white, [-50, -180, 100, 166], { lw: 0, rimA: 0, hiA: 0.1 });
  stroke(body, 6);
  // front paws (one can lift for a swipe)
  for (const sd of [-1, 1]) {
    const lift = sd > 0 ? p.paw : 0;
    const px0 = sd * 40, py0 = -16 - lift * 70;
    solid(ellPath(px0 + lift * 24, py0, 30, 22), CAT.white, [px0 - 30, py0 - 22, 60, 44], { lw: 5.5 });
    for (const k of [-10, 0, 10]) line([[px0 + lift * 24 + k, py0 + 6], [px0 + lift * 24 + k, py0 + 18]], 3.5);
  }
  g.restore();
  head(p, 0, -190 * sq * pf);
}

export function head(p, hx, hy) {
  g.save(); g.translate(hx, hy); g.rotate(p.tilt);
  const pf = 1 + p.puff * 0.12;
  g.scale(pf, pf);
  // ears
  for (const sd of [-1, 1]) {
    const flat = p.ears;                        // 1 = flat back, -1 = perked
    const ex = sd * 66, ey = -92 + Math.max(flat, 0) * 30;
    const tip = [sd * (88 + Math.max(flat, 0) * 52 - Math.min(flat, 0) * 6), -170 + Math.max(flat, 0) * 96 + Math.min(flat, 0) * 22];
    const ear = smoothPath([[ex - sd * 46, ey + 22], tip, [ex + sd * 34, ey + 30]]);
    solid(ear, CAT.fur, [Math.min(ex - sd * 46, tip[0]), tip[1], 90, 120], { lw: 5.5 });
    const inner = smoothPath([[ex - sd * 30, ey + 22], [lerp(ex, tip[0], 0.7), lerp(ey, tip[1], 0.72)], [ex + sd * 20, ey + 28]]);
    solid(inner, CAT.inner, [ex - 30, tip[1], 60, 100], { lw: 0, rimA: 0, shadowA: 0.1, hiA: 0 });
  }
  // head
  const hd = smoothPath([[0, -122], [74, -110], [118, -60], [128, 0], [104, 50], [50, 76], [0, 80], [-50, 76], [-104, 50], [-128, 0], [-118, -60], [-74, -110]]);
  solid(hd, CAT.fur, [-128, -122, 256, 202]);
  stripes(hd, [[[-24, -122], [-20, -96], [-12, -80]], [[0, -126], [0, -100], [0, -84]], [[24, -122], [20, -96], [12, -80]], [[-130, -10], [-104, -4], [-92, -20]], [[130, -10], [104, -4], [92, -20]]], 12);
  // cheeks / muzzle
  const mz = smoothPath([[-70, 20], [-30, 0], [0, 12], [30, 0], [70, 20], [64, 60], [0, 78], [-64, 60]]);
  solid(mz, CAT.white, [-70, 0, 140, 78], { lw: 0, rimA: 0, hiA: 0.05, shadowA: 0.15 });
  stroke(hd, 6);
  // eyes
  for (const sd of [-1, 1]) eye(p, sd * 50, -28, sd);
  // nose + mouth
  const nose = smoothPath([[-15, 14], [15, 14], [0, 30]]);
  solid(nose, CAT.nose, [-15, 14, 30, 16], { lw: 4.5, rimA: 0, hiA: 0.3 });
  if (p.mouth === 'meow' || p.mouth === 'hiss') {
    const open = p.mouth === 'hiss' ? 1 : 0.8;
    const m = smoothPath([[-24, 38], [0, 34], [24, 38], [16, 38 + 30 * open], [0, 44 + 32 * open], [-16, 38 + 30 * open]]);
    g.fillStyle = '#5a1822'; g.fill(m);
    g.save(); g.clip(m); g.fillStyle = '#e0707e'; g.beginPath(); g.ellipse(0, 46 + 34 * open, 16, 12, 0, 0, TAU); g.fill(); g.restore();
    if (p.mouth === 'hiss') for (const sd of [-1, 1]) solid(smoothPath([[sd * 18, 38], [sd * 12, 52], [sd * 8, 38]]), '#ffffff', [sd * 18 - 4, 38, 10, 14], { lw: 3, rimA: 0, hiA: 0 });
    stroke(m, 5);
  } else {
    line([[-22, 40], [-11, 46], [0, 38], [11, 46], [22, 40]], 5, LIGHT.ink, true);
    if (p.tongue > 0.02) {
      const tg = smoothPath([[-9, 42], [9, 42], [10, 42 + 22 * p.tongue], [0, 48 + 26 * p.tongue], [-10, 42 + 22 * p.tongue]]);
      solid(tg, '#ee7584', [-10, 42, 20, 32], { lw: 4.5, rimA: 0 });
    }
  }
  // whiskers
  g.save(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = px(3.2); g.lineCap = 'round';
  for (const sd of [-1, 1]) for (const k of [-1, 0, 1]) {
    g.beginPath(); g.moveTo(sd * 66, 32 + k * 9); g.quadraticCurveTo(sd * 120, 26 + k * 16, sd * 168, 30 + k * 26); g.stroke();
  }
  g.restore();
  g.restore();
}

function eye(p, x, y, sd) {
  const open = clamp(1 - p.blink), rx = 32, ry = 36 * open;
  if (open < 0.1) { line([[x - rx, y + 4], [x, y + 12], [x + rx, y + 4]], 6, LIGHT.ink, true); return; }
  const smugLid = p.smug;                       // half-closed, pleased
  const e = ellPath(x, y, rx, ry);
  g.fillStyle = CAT.iris; g.fill(e);
  g.save(); g.clip(e);
  const gr = g.createRadialGradient(x, y + 10, 2, x, y, rx);
  gr.addColorStop(0, '#f4ffb0'); gr.addColorStop(1, rgba('#7da61c', 1));
  g.fillStyle = gr; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  const pw = 13 * p.pupil, ph = 30 * Math.max(0.5, p.pupil * 0.9);
  const cx = x + p.lookX * 12, cy = y + p.lookY * 8;
  g.fillStyle = '#140d0f'; g.beginPath(); g.ellipse(cx, cy, pw, ph * open, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + 9, cy - 13 * open, 7, 0, TAU); g.fill();
  if (smugLid > 0) { g.fillStyle = CAT.fur; g.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * smugLid * 0.55 + 2); }
  g.restore();
  g.lineWidth = px(5.5); g.strokeStyle = LIGHT.ink; g.stroke(e);
  if (smugLid > 0) line([[x - rx, y - ry + ry * 2 * smugLid * 0.55], [x + rx, y - ry + ry * 2 * smugLid * 0.55]], 5.5);
}

function side(p) {
  // profile facing +x; walk cycle via p.walk (phase in cycles)
  const w = p.walk * TAU, bob = Math.abs(Math.sin(w)) * 6;
  g.save(); g.translate(0, -bob); g.rotate(p.bodyTilt);
  const tw = Math.sin(p.tailT * 2.4) * 0.3 + p.tail;
  hose(tailPath([-130, -110], -0.6 + tw * 0.4, 1.3 + tw, 170), 34 + p.puff * 18, CAT.fur);
  // far legs
  for (const [lx, ph] of [[-80, 0.5], [70, 0]]) {
    const a = Math.sin(w + ph * TAU) * 0.45;
    hose([[lx, -80], [lx + Math.sin(a) * 40, -40], [lx + Math.sin(a) * 66, -6 + bob]], 36, shade(CAT.fur, -0.2), { rimA: 0 });
  }
  const body = smoothPath([[-150, -110], [-60, -150], [60, -150], [130, -118], [140, -60], [100, -40], [-110, -40], [-160, -70]]);
  solid(body, CAT.fur, [-160, -150, 300, 112]);
  stripes(body, [[[-90, -152], [-80, -110], [-96, -80]], [[-40, -156], [-34, -112], [-46, -84]], [[10, -156], [16, -112], [4, -84]]], 14);
  const belly = smoothPath([[-90, -56], [80, -56], [96, -40], [-100, -40]]);
  g.save(); g.clip(body); g.fillStyle = CAT.white; g.fill(belly); g.restore();
  stroke(body, 6);
  // near legs (one front leg can swipe forward with p.paw)
  for (const [lx, ph, front] of [[-100, 0, false], [96, 0.5, true]]) {
    let a = Math.sin(w + ph * TAU) * 0.45;
    if (front && p.paw > 0) a = -p.paw * 1.6;
    const knee = [lx + Math.sin(a) * 42, -58 + Math.cos(a) * 0 + 18];
    const foot = [lx + Math.sin(a) * 76, -8 + bob - (front ? p.paw * 70 : 0)];
    hose([[lx, -86], knee, foot], 38, CAT.fur);
    solid(ellPath(foot[0] + 8, foot[1], 22, 14), CAT.white, [foot[0] - 14, foot[1] - 14, 44, 28], { lw: 5 });
  }
  g.restore();
  // head in 3/4 profile
  const hp = { ...p, lookX: p.lookX + 0.6 };
  g.save(); g.translate(118, -146 - bob); g.scale(0.74, 0.74); head(hp, 0, 0); g.restore();
}

function top(p) {
  // seen from above, facing +x; origin at body centre
  const tw = Math.sin(p.tailT * 2.4) * 0.4 + p.tail;
  hose(tailPath([-120, 0], -1.4 + tw * 0.5, -0.9 * Math.sin(tw * 2), 160), 32, CAT.fur);
  const w = p.walk * TAU;
  for (const [lx, ly, ph] of [[60, -60, 0], [60, 60, 0.5], [-70, -58, 0.5], [-70, 58, 0]]) {
    const k = Math.sin(w + ph * TAU) * 18;
    solid(ellPath(lx + k, ly * 1.08, 22, 18), CAT.white, [lx + k - 22, ly - 18, 44, 36], { lw: 5 });
  }
  const body = ellPath(0, 0, 135, 78);
  solid(body, CAT.fur, [-135, -78, 270, 156]);
  stripes(body, [[[-80, -80], [-70, 0], [-80, 80]], [[-30, -84], [-22, 0], [-30, 84]], [[20, -84], [28, 0], [20, 84]]], 14);
  stroke(body, 6);
  g.save(); g.translate(140, 0);
  for (const sd of [-1, 1]) {
    const ear = smoothPath([[18, sd * 30], [70, sd * 70], [-8, sd * 62]]);
    solid(ear, CAT.fur, [-8, sd > 0 ? 30 : -70, 78, 40], { lw: 5 });
  }
  const hd = ellPath(10, 0, 70, 66);
  solid(hd, CAT.fur, [-60, -66, 140, 132]);
  stripes(hd, [[[-40, -30], [0, -26], [40, -18]], [[-44, 0], [0, 0], [44, 0]], [[-40, 30], [0, 26], [40, 18]]], 11);
  stroke(hd, 6);
  g.restore();
}
