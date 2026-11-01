// «Ты» — the hero: big-headed guy in a mustard hoodie, navy sweatpants and red slippers.
// A rubber-hose puppet: origin at the ground between the feet, ~600 units tall at s = 1.
import { g, solid, hose, smoothPath, ellPath, rrPath, stroke, line, softShadow, px, LIGHT, Path2D } from './draw.js';
import { TAU, lerp, clamp, rgba, shade } from './lib.js';

export const HERO = {
  skin: '#f6cfaa', hair: '#3b2418', hoodie: '#f2b632', hoodieDark: '#d18f1e', pants: '#2d3a66',
  slipper: '#d8443a', cord: '#fff6e0', bag: '#e8622c', bagDark: '#b8441c', blush: '#f29b8c',
};

const DEF = {
  x: 0, y: 0, s: 1, face: 1, lean: 0, bob: 0, breathe: 0,
  tilt: 0, turn: 0, lookX: 0, lookY: 0, blink: 0, pupil: 1, browL: 0, browR: 0, browY: 0,
  mouth: 'flat', mouthOpen: 0, sweat: 0, hairUp: 0, blush: 0.35, eyeScale: 1,
  armL: { sh: 0.18, el: 0.15 }, armR: { sh: 0.18, el: 0.15 },
  handL: 'open', handR: 'open', propL: null, propR: null,
  legL: { hip: 0.06, knee: 0 }, legR: { hip: 0.06, knee: 0 },
  backpack: 0, cat: null, shadow: 0.35, hood: 0,
};

const SH = [72, -318], HIP = [38, -152], L1 = 92, L2 = 84, T1 = 82, T2 = 74;

function limbPts(base, a1, bend, l1, l2, side) {
  const e = [base[0] + side * Math.sin(a1) * l1, base[1] + Math.cos(a1) * l1];
  const a2 = a1 + bend;
  const h = [e[0] + side * Math.sin(a2) * l2, e[1] + Math.cos(a2) * l2];
  return [base, e, h, a2];
}

export function heroJoints(p) {
  // world-space hand positions (for attaching props elsewhere)
  const q = { ...DEF, ...p };
  const sx = q.s * q.face, out = {};
  for (const [k, side, arm] of [['L', -1, q.armL], ['R', 1, q.armR]]) {
    const [, , h] = limbPts([SH[0] * side, SH[1] - q.breathe * 6], arm.sh, arm.el, L1, L2, side);
    out['hand' + k] = [q.x + h[0] * sx, q.y + (h[1] + q.bob) * q.s];
  }
  return out;
}

export function drawHero(pose) {
  const p = { ...DEF, ...pose, armL: { ...DEF.armL, ...pose.armL }, armR: { ...DEF.armR, ...pose.armR }, legL: { ...DEF.legL, ...pose.legL }, legR: { ...DEF.legR, ...pose.legR } };
  if (p.shadow) softShadow(p.x, p.y + 4 * p.s, 150 * p.s, 26 * p.s, p.shadow);
  g.save();
  g.translate(p.x, p.y); g.scale(p.s * p.face, p.s);
  g.translate(0, p.bob);
  g.rotate(p.lean);

  const br = p.breathe;
  const sh = [SH[0], SH[1] - br * 6];
  // —— backpack behind the body ——
  if (p.backpack) drawBagBack(p);
  // —— legs ——
  for (const [side, leg] of [[-1, p.legL], [1, p.legR]]) {
    const [a, b, c, a2] = limbPts([HIP[0] * side, HIP[1]], leg.hip, leg.knee, T1, T2, side);
    hose([a, b, c], 46, HERO.pants);
    drawSlipper(c, side, a2);
  }
  // —— back arm (left, drawn behind torso) ——
  drawArm(p, -1, sh, true);
  // —— torso (hoodie) ——
  const tw = 92, bw = 98, top = sh[1] - 10, bot = HIP[1] + 22;
  const torso = smoothPath([
    [-tw + 6, top + 6], [-tw * 0.4, top - 6], [tw * 0.4, top - 6], [tw - 6, top + 6],
    [tw + 6, top + 60], [bw + 4, bot - 50], [bw - 2, bot], [0, bot + 8], [-bw + 2, bot], [-bw - 4, bot - 50], [-tw - 6, top + 60],
  ]);
  solid(torso, HERO.hoodie, [-bw, top, bw * 2, bot - top]);
  // kangaroo pocket
  g.save(); g.clip(torso);
  const pocket = smoothPath([[-58, bot - 70], [58, bot - 70], [72, bot - 12], [-72, bot - 12]]);
  g.fillStyle = rgba(HERO.hoodieDark, 0.35); g.fill(pocket);
  stroke(pocket, 4, rgba(LIGHT.ink, 0.75));
  // hem band
  g.fillStyle = rgba(HERO.hoodieDark, 0.55); g.fillRect(-bw - 10, bot - 12, bw * 2 + 20, 30);
  g.restore();
  stroke(torso, 6);
  // backpack straps over the shoulders
  if (p.backpack) {
    for (const side of [-1, 1]) {
      const st = smoothPath([[side * 40, top - 2], [side * 58, top + 40], [side * 64, top + 110], [side * 50, top + 112], [side * 44, top + 44], [side * 26, top + 2]]);
      solid(st, HERO.bagDark, [side * 26, top, 40, 110], { lw: 4.5, hiA: 0.1 });
    }
  }
  // hood collar behind the head + drawstrings
  const hood = smoothPath([[-86, top + 8], [-74, top - 34], [0, top - 52], [74, top - 34], [86, top + 8], [40, top + 18], [0, top + 22], [-40, top + 18]]);
  solid(hood, shade(HERO.hoodie, -0.08), [-86, top - 52, 172, 74], { lw: 5.5 });
  for (const side of [-1, 1]) line([[side * 20, top + 14], [side * 24 + p.lean * 30, top + 70 + Math.abs(br) * 4]], 6, HERO.cord);
  // —— head ——
  drawHead(p, top);
  // —— front arm ——
  drawArm(p, 1, sh, false);
  // cat peeking out of the backpack over the shoulder
  if (p.cat && p.backpack) p.cat();
  g.restore();
}

function drawArm(p, side, sh, back) {
  const arm = side < 0 ? p.armL : p.armR;
  const [a, b, c, a2] = limbPts([sh[0] * side, sh[1]], arm.sh, arm.el, L1, L2, side);
  const col = back ? shade(HERO.hoodie, -0.1) : HERO.hoodie;
  hose([[a[0] - side * 8, a[1] + 6], b, c], 40, col);
  // cuff
  const cuff = [lerp(b[0], c[0], 0.86), lerp(b[1], c[1], 0.86)];
  g.save(); g.beginPath(); g.arc(cuff[0], cuff[1], 21, 0, TAU); g.fillStyle = HERO.hoodieDark; g.fill(); g.restore();
  const hand = side < 0 ? p.handL : p.handR, prop = side < 0 ? p.propL : p.propR;
  drawHand(c, a2, side, hand, back);
  if (prop) { g.save(); g.translate(c[0], c[1]); g.rotate(-side * a2); prop(side); g.restore(); }
}

export function drawHand(c, ang, side, kind, back) {
  g.save(); g.translate(c[0], c[1]); g.rotate(-side * ang);
  const col = back ? shade(HERO.skin, -0.08) : HERO.skin;
  if (kind === 'fist') {
    solid(ellPath(0, 6, 24, 22), col, [-24, -16, 48, 44], { lw: 5.5 });
  } else if (kind === 'point') {
    solid(smoothPath([[-20, -6], [18, -8], [26, 4], [8, 30], [-10, 28], [-24, 12]]), col, [-24, -8, 50, 38], { lw: 5.5 });
    solid(rrPath(-6 * side - 6, 18, 12, 34, 6), col, [-12, 18, 12, 34], { lw: 5 });
  } else { // open mitten with thumb
    solid(smoothPath([[-22, -4], [20, -6], [26, 20], [14, 40], [-12, 40], [-26, 18]]), col, [-26, -6, 52, 46], { lw: 5.5 });
    solid(ellPath(side * 24, 10, 9, 15, side * 0.5), col, [side * 24 - 9, -5, 18, 30], { lw: 5 });
  }
  g.restore();
}

function drawSlipper(c, side, ang) {
  g.save(); g.translate(c[0], c[1] + 6);
  const sl = smoothPath([[-26 + side * 4, -14], [24 + side * 14, -12], [44 + side * 10, 2], [30 + side * 10, 16], [-26 + side * 4, 14], [-34 + side * 4, 0]]);
  solid(sl, HERO.slipper, [-34, -14, 78, 30], { lw: 5.5 });
  // fluffy band
  g.save(); g.clip(sl); g.fillStyle = 'rgba(255,240,230,.55)'; g.fillRect(-40, -18, 90, 10); g.restore();
  g.restore();
}

function drawHead(p, top) {
  g.save();
  const neck = [0, top - 14];
  g.translate(neck[0], neck[1]); g.rotate(p.tilt); g.translate(-neck[0], -neck[1]);
  const cx = p.turn * 10, cy = top - 132, R = 122;
  // ears
  for (const side of [-1, 1]) {
    const ex = cx + side * (R - 8) - p.turn * 14 * side * side;
    solid(ellPath(ex, cy + 14, 22, 30), HERO.skin, [ex - 22, cy - 16, 44, 60], { lw: 5.5 });
    g.save(); g.strokeStyle = rgba(shade(HERO.skin, -0.35), 0.8); g.lineWidth = px(4); g.beginPath(); g.arc(ex, cy + 16, 10, side > 0 ? -1.2 : 1.9, side > 0 ? 1.2 : 4.3); g.stroke(); g.restore();
  }
  // head shape (slightly wider cheeks)
  const head = smoothPath([[cx, cy - R * 1.02], [cx + R * 0.78, cy - R * 0.74], [cx + R * 1.0, cy - R * 0.05], [cx + R * 0.86, cy + R * 0.62], [cx + R * 0.38, cy + R * 0.95], [cx - R * 0.38, cy + R * 0.95], [cx - R * 0.86, cy + R * 0.62], [cx - R * 1.0, cy - R * 0.05], [cx - R * 0.78, cy - R * 0.74]]);
  solid(head, HERO.skin, [cx - R, cy - R, R * 2, R * 2]);
  // blush
  for (const side of [-1, 1]) {
    g.save(); g.globalAlpha = p.blush; g.fillStyle = HERO.blush;
    g.beginPath(); g.ellipse(cx + side * 70 + p.turn * 16, cy + 44, 24, 13, 0, 0, TAU); g.fill(); g.restore();
  }
  // eyes
  const fx = cx + p.turn * 26, ey = cy + 2 - p.browY * 2;
  for (const side of [-1, 1]) drawEye(p, fx + side * 48, ey, side);
  // nose
  g.save(); g.strokeStyle = rgba(shade(HERO.skin, -0.45), 0.9); g.lineWidth = px(5); g.lineCap = 'round';
  g.beginPath(); g.arc(fx + 4, cy + 40, 12, 0.3, 2.4); g.stroke(); g.restore();
  // mouth
  drawMouth(p, fx + 2, cy + 78);
  // sweat drop
  if (p.sweat > 0.01) {
    const sy = cy - 40 + p.sweat * 30;
    g.save(); g.globalAlpha = clamp(p.sweat * 3);
    solid(smoothPath([[cx + R * 0.92, sy - 22], [cx + R * 0.92 + 13, sy + 6], [cx + R * 0.92, sy + 16], [cx + R * 0.92 - 13, sy + 6]]), '#bfe6ff', [cx + R * 0.92 - 13, sy - 22, 26, 38], { lw: 4.5, hiA: 0.5 });
    g.restore();
  }
  // hair
  drawHair(p, cx, cy, R);
  // brows
  for (const side of [-1, 1]) {
    const b = side < 0 ? p.browL : p.browR, bx = fx + side * 48, by = ey - 64 - p.browY * 14;
    const inner = [bx - side * 26, by + b * 14 * -1 + 4], outer = [bx + side * 26, by - b * 6];
    // positive brow = worried (inner end up), negative = angry (inner end down)
    const pIn = [bx - side * 28, by - b * 14 + 6], pOut = [bx + side * 26, by + b * 4 - 2];
    line([pIn, [bx, by - 6 - Math.abs(b) * 2], pOut], 11, '#24140d', true);
    void inner; void outer;
  }
  g.restore();
}

function drawEye(p, x, y, side) {
  const es = p.eyeScale, rx = 40 * es, ry = 50 * es;
  const open = clamp(1 - p.blink);
  if (open < 0.08) { line([[x - rx, y + 6], [x, y + 14], [x + rx, y + 6]], 7, LIGHT.ink, true); return; }
  const eye = ellPath(x, y, rx, ry * open);
  g.fillStyle = '#ffffff'; g.fill(eye);
  g.save(); g.clip(eye);
  // soft top shadow of the lid
  const gr = g.createLinearGradient(x, y - ry, x, y + ry * 0.3);
  gr.addColorStop(0, 'rgba(120,130,170,.45)'); gr.addColorStop(1, 'rgba(120,130,170,0)');
  g.fillStyle = gr; g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  const pr = 21 * p.pupil * es, px0 = x + p.lookX * (rx - pr - 4) * 0.9, py0 = y + p.lookY * (ry * open - pr - 4) * 0.8 + 4;
  g.fillStyle = '#20161f'; g.beginPath(); g.arc(px0, py0, pr, 0, TAU); g.fill();
  g.fillStyle = '#4a3328'; g.beginPath(); g.arc(px0, py0, pr * 0.62, 0, TAU); g.fill();
  g.fillStyle = '#120c12'; g.beginPath(); g.arc(px0, py0, pr * 0.42, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px0 + pr * 0.38, py0 - pr * 0.42, pr * 0.34, 0, TAU); g.fill();
  g.beginPath(); g.arc(px0 - pr * 0.35, py0 + pr * 0.4, pr * 0.14, 0, TAU); g.fill();
  g.restore();
  g.lineWidth = px(6); g.strokeStyle = LIGHT.ink; g.stroke(eye);
}

function drawMouth(p, x, y) {
  const m = p.mouth, o = p.mouthOpen;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  if (m === 'smile') {
    line([[x - 30, y - 6], [x, y + 10], [x + 30, y - 6]], 7, LIGHT.ink, true);
  } else if (m === 'flat') {
    line([[x - 22, y + 2], [x + 22, y]], 7);
  } else if (m === 'worry') {
    line([[x - 26, y + 6], [x - 12, y - 2], [x + 2, y + 4], [x + 16, y - 2], [x + 28, y + 6]], 6.5, LIGHT.ink, true);
  } else if (m === 'o' || m === 'open') {
    const w = m === 'o' ? 14 + o * 6 : 30 + o * 6, h = m === 'o' ? 16 + o * 10 : 26 + o * 22;
    const mp = ellPath(x, y + h * 0.3, w, h);
    g.fillStyle = '#5b1a24'; g.fill(mp);
    g.save(); g.clip(mp); g.fillStyle = '#e46a74'; g.beginPath(); g.ellipse(x, y + h * 1.05, w * 0.8, h * 0.55, 0, 0, TAU); g.fill(); g.restore();
    stroke(mp, 6);
  } else if (m === 'grit') {
    const mp = rrPath(x - 34, y - 12, 68, 28, 12);
    g.fillStyle = '#ffffff'; g.fill(mp);
    line([[x - 32, y + 2], [x + 32, y + 2]], 3.5);
    for (const k of [-16, 0, 16]) line([[x + k, y - 10], [x + k, y + 14]], 3.5);
    stroke(mp, 6);
  } else if (m === 'smirk') {
    line([[x - 24, y + 4], [x + 6, y + 6], [x + 28, y - 8]], 7, LIGHT.ink, true);
  }
  g.restore();
}

function drawHair(p, cx, cy, R) {
  const up = p.hairUp;
  const top = cy - R * 1.02;
  // main mop
  const pts = [
    [cx - R * 1.02, cy - R * 0.12], [cx - R * 0.98, cy - R * 0.62], [cx - R * 0.7, cy - R * 1.0], [cx - R * 0.2, cy - R * 1.2 - up * 18],
    [cx + R * 0.35, cy - R * 1.16 - up * 14], [cx + R * 0.82, cy - R * 0.92], [cx + R * 1.04, cy - R * 0.42], [cx + R * 1.0, cy - R * 0.12],
    // fringe zig-zag
    [cx + R * 0.84, cy - R * 0.5], [cx + R * 0.64, cy - R * 0.66], [cx + R * 0.46, cy - R * 0.5], [cx + R * 0.24, cy - R * 0.7],
    [cx + R * 0.02, cy - R * 0.52], [cx - R * 0.22, cy - R * 0.72], [cx - R * 0.42, cy - R * 0.54], [cx - R * 0.66, cy - R * 0.7], [cx - R * 0.88, cy - R * 0.46],
  ];
  const hp = smoothPath(pts);
  solid(hp, HERO.hair, [cx - R, top - 20, R * 2, R * 1.1], { rimA: LIGHT.rimA * 0.8, hiA: 0.12 });
  // highlight streaks
  g.save(); g.clip(hp); g.strokeStyle = 'rgba(255,220,190,.18)'; g.lineWidth = px(6); g.lineCap = 'round';
  for (const k of [-0.5, -0.1, 0.3]) { g.beginPath(); g.moveTo(cx + R * k, cy - R * 1.05); g.quadraticCurveTo(cx + R * (k + 0.15), cy - R * 0.85, cx + R * (k + 0.05), cy - R * 0.62); g.stroke(); }
  g.restore();
  // cowlick strands on top (stand up when frightened)
  for (const [k, len] of [[-0.1, 1], [0.12, 0.8]]) {
    const bx = cx + R * k, by = top + 6;
    const tipx = bx + 26 + k * 40 - up * 10, tipy = by - 50 * len - up * 55;
    const s = smoothPath([[bx - 10, by + 6], [bx + 4, by - 20 * len], [tipx, tipy], [bx + 14, by - 10], [bx + 12, by + 8]]);
    solid(s, HERO.hair, [bx - 10, tipy, 40, by - tipy + 8], { lw: 5, hiA: 0.1 });
  }
  if (up > 0.2) { // extra fright spikes
    for (const k of [-0.55, 0.5]) {
      const bx = cx + R * k, by = top + 26 + Math.abs(k) * 26;
      const s = smoothPath([[bx - 26, by + 14], [bx + k * 40, by - 52 * up], [bx + 26, by + 14]]);
      solid(s, HERO.hair, [bx - 26, by - 52, 52, 66], { lw: 5, hiA: 0.1 });
    }
  }
}

function drawBagBack(p) {
  const bag = rrPath(-118, -360, 236, 230, 50);
  solid(bag, HERO.bag, [-118, -360, 236, 230], { hiA: 0.15 });
  const flap = rrPath(-104, -372, 208, 70, 30);
  solid(flap, HERO.bagDark, [-104, -372, 208, 70], { lw: 5 });
}
