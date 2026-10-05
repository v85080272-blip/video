// Морозилка, серия 2 «Новенький» — Sci-Fi Sitcom Toon, вертикаль 1080×1920
import { clamp, lerp, seg, ss, eo, ei, eio, back, hash, vnoise, TAU } from '/core/lib.js';
import { W, H, INK, init, frame, g, push, pop, translate, rotate, scale, shape, fillOnly, stroke, ell, arc, rr, rect, spline, dot, text, S, noodle, quad } from './toon.js';

init(document.getElementById('c'));
const ST = await (await fetch('story.json')).json();
const SH = ST.shots, EV = ST.ev;
window.DUR = ST.dur;

const PAL = {
  wall: '#9fd6ec', wallS: '#86c4de', rib: '#c3eaf7', floor: '#e3f5fb', floorS: '#c6e6f1', frost: '#f4fcff',
  dough: '#f4e6c6', doughS: '#dcc496', hat: '#8a5a33', hatS: '#6d4426', fur: '#d3a874', furS: '#b88b57', stache: '#f4fcff',
  syr: '#f2c47e', syrS: '#d99c4f', crust: '#c9772f', crustS: '#a65f22', sugar: '#fffaf0',
  bag: '#45b45f', bagS: '#2f8a46', label: '#fff4d2', pea: '#7ccf54',
  skin: '#f2c9a0', skinS: '#d9a57c', sleeve: '#5b7fd6', sleeveS: '#4563ad',
  white: '#ffffff', mouthIn: '#4a1a2a', tongue: '#e8637a', sweat: '#bfe9ff', warm: '#ffe08a',
  pillP: '#e2b66c', pillS: '#f0883c', pillA: '#9fd6ec',
};

// ——— время ———
const q = t => Math.floor(t * 12 + 1e-6) / 12;        // персонажи «на двойках»
const inShot = (t, k) => { const ks = Object.keys(SH); const i = ks.indexOf(k); return t >= SH[k] && (i === ks.length - 1 || t < SH[ks[i + 1]]); };
const shotOf = t => { let cur = 'A'; for (const [k, v] of Object.entries(SH)) if (t >= v) cur = k; return cur; };

// ——— речь: бормотание по слогам ———
const VOW = /[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/g;
for (const L of ST.lines) L.n = L.n ?? Math.max(3, (L.text.match(VOW) || []).length);
function talk(who, t) {
  const tq = q(t);
  for (const L of ST.lines) {
    if (!L.who.includes(who)) continue;
    const end = L.t0 + L.n * L.sd;
    if (tq < L.t0 || tq >= end) continue;
    const i = Math.floor((tq - L.t0) / L.sd), u = (tq - L.t0) / L.sd - i;
    const amp = L.id === 'scream' ? 1 : .35 + .65 * hash(i * 3.1 + L.t0);
    return { o: amp * Math.pow(Math.sin(Math.PI * clamp(u + .25)), .6), w: .85 + .35 * hash(i * 7.7 + L.t0 * 3), scream: L.id === 'scream' };
  }
  return { o: 0, w: 1, scream: false };
}

// ——— лицо ———
function eye(cx, cy, rx, ry, { lid = 0, look = [0, 0], pupil = 5, skin, closed = false, lw = 6, jit = 0 } = {}) {
  if (closed) { stroke(arc(cx, cy + ry * .1, rx * .8, ry * .4, Math.PI * .1, Math.PI * .9, 14), lw); return; }
  shape(ell(cx, cy, rx, ry, 36), {
    fill: PAL.white, lw, shade: () => {
      dot(cx + look[0] * rx * .55 + jit, cy + look[1] * ry * .5, pupil);
      if (lid > 0) {
        const yl = cy - ry + lid * 2 * ry;
        fillOnly([[cx - rx * 1.3, cy - ry * 1.4], [cx + rx * 1.3, cy - ry * 1.4], [cx + rx * 1.3, yl], [cx - rx * 1.3, yl + ry * .08]], skin, { boil: .5 });
        stroke([[cx - rx * 1.2, yl + ry * .08], [cx + rx * 1.2, yl]], lw);
      }
    }
  });
}
function mouth(cx, cy, mw, { o = 0, w = 1, sm = 0, lw = 6 } = {}) {
  const hw = mw * w / 2, k = mw * .22, lc = [cx - hw, cy - sm * k], rc = [cx + hw, cy - sm * k];
  if (o < .07) { stroke(quad(lc, [cx, cy + sm * k * 1.2], rc, 12), lw); return; }
  const h = o * mw * .7;
  const P = [...quad(lc, [cx, cy - h * .25 + sm * k * .4], rc, 12), ...quad(rc, [cx, cy + h + sm * k * .6], lc, 14)];
  shape(P, {
    fill: PAL.mouthIn, lw, shade: () => {
      if (o > .25) fillOnly(rect(cx - hw * 1.2, cy - h, hw * 2.4, h * .3 + 6), PAL.white, { boil: .3 });
      fillOnly(ell(cx + hw * .15, cy + h * .95, hw * .6, h * .45, 20), PAL.tongue, { boil: .3 });
    }
  });
}
const brow = (x, y, len, tilt, lw = 7) => stroke([[x - len / 2, y + tilt * 9], [x + len / 2, y - tilt * 9]], lw);
const sweat = (x, y, s = 1) => shape(spline([[x, y - 18 * s], [x + 10 * s, y + 4 * s], [x, y + 13 * s], [x - 10 * s, y + 4 * s]]), { fill: PAL.sweat, lw: 5 });

// ——— персонажи (начало координат у подошвы, y вниз) ———
function pelmen(x, y, s, P = {}) {
  const { o = 0, w = 1, look = [0, 0], lid = .35, tilt = 0, jit = 0, sq = 0, sm = 0, pupil = 5, closed = false } = P;
  push(); translate(x + jit, y); scale(s * (1 + sq), s * (1 - sq));
  const body = [];
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * Math.PI, ridge = Math.sin(a) > .3 ? Math.pow(Math.abs(Math.sin(a * 17)), .7) * .055 : 0;
    body.push([-Math.cos(a) * 175 * (1 + ridge), -Math.sin(a) * 205 * (1 + ridge)]);
  }
  for (let i = 1; i < 18; i++) { const u = i / 18; body.push([175 - 350 * u, 9 * Math.sin(u * Math.PI)]); }
  shape(body, { fill: PAL.dough, shade: () => { fillOnly(ell(80, -30, 150, 85), PAL.doughS, { boil: .4 }); fillOnly(ell(-130, -50, 26, 12), PAL.frost, { boil: .3, alpha: .8 }); } });
  // ушанка
  for (const sx of [-1, 1]) shape(rr(sx > 0 ? 112 : -158, -190, 46, 112, 22), { fill: PAL.hat, shade: () => fillOnly(rect(sx > 0 ? 138 : -134, -200, 30, 130), PAL.hatS, { boil: .3 }) });
  shape(ell(0, -228, 112, 58, 40), { fill: PAL.hat, shade: () => fillOnly(ell(50, -205, 90, 40), PAL.hatS, { boil: .3 }) });
  shape(rr(-138, -222, 276, 50, 25), { fill: PAL.fur, shade: () => fillOnly(rect(40, -230, 120, 70), PAL.furS, { boil: .3 }) });
  // лицо
  eye(-44, -132, 40, 46, { lid, look, skin: PAL.dough, pupil, jit: jit * .3, closed });
  eye(44, -132, 40, 46, { lid, look, skin: PAL.dough, pupil, jit: -jit * .3, closed });
  brow(-46, -188, 52, tilt); brow(46, -188, 52, -tilt);
  shape(spline([[-34, -70], [-6, -76], [0, -66], [6, -76], [34, -70], [20, -58], [0, -64], [-20, -58]]), { fill: PAL.stache, lw: 5 });
  mouth(0, -36, 58, { o, w, sm });
  pop();
}
function syrnik(x, y, s, P = {}) {
  const { o = 0, w = 1, look = [0, 0], lid = 0, tilt = .6, jit = 0, sq = 0, sm = 0, pupil = 5, sweats = 0, closed = false } = P;
  push(); translate(x + jit, y); scale(s * (1 + sq), s * (1 - sq));
  shape(rr(-155, -175, 310, 175, 70), { fill: PAL.syr, shade: () => fillOnly(ell(90, -10, 160, 70), PAL.syrS, { boil: .4 }) });
  shape(ell(0, -172, 150, 42, 44), {
    fill: PAL.crust, shade: () => {
      fillOnly(ell(50, -160, 110, 28), PAL.crustS, { boil: .3 });
      for (let i = 0; i < 9; i++) dot(-100 + i * 25 + hash(i) * 12, -178 + (hash(i + 9) - .5) * 30, 4, PAL.sugar);
    }
  });
  eye(-50, -98, 42, 50, { lid, look, skin: PAL.syr, pupil, jit: jit * .3, closed });
  eye(50, -98, 42, 50, { lid, look, skin: PAL.syr, pupil, jit: -jit * .3, closed });
  brow(-52, -158, 54, tilt); brow(52, -158, 54, -tilt);
  mouth(0, -38, 62, { o, w, sm });
  if (sweats > 0) sweat(150, -150 + sweats * 40, 1.1);
  if (sweats > .5) sweat(-160, -120 + (sweats - .5) * 60, .9);
  pop();
}
function peas(x, y, s, P = {}) {
  const { awake = 0, rot = 0, q: qm = 0 } = P;
  push(); translate(x, y); rotate(rot); scale(s);
  shape(rr(-95, -245, 190, 245, 26), { fill: PAL.bag, shade: () => fillOnly(rect(30, -260, 80, 280), PAL.bagS, { boil: .3 }) });
  const zz = []; for (let i = 0; i <= 10; i++) zz.push([-95 + i * 19, -245 + (i % 2 ? -12 : 0)]);
  stroke(zz, 5);
  shape(ell(0, -105, 64, 64, 30), { fill: PAL.label, lw: 5, shade: () => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; shape(ell(Math.cos(a) * 30, -105 + Math.sin(a) * 30, 15, 15, 14), { fill: PAL.pea, lw: 4 }); } } });
  if (awake < .5) { stroke(arc(-34, -190, 18, 8, .2, Math.PI - .2, 10), 5); stroke(arc(34, -190, 18, 8, .2, Math.PI - .2, 10), 5); }
  else { shape(ell(-34, -190, 16, 19), { fill: PAL.white, lw: 5, shade: () => dot(-34, -188, 4) }); shape(ell(34, -190, 16, 19), { fill: PAL.white, lw: 5, shade: () => dot(34, -188, 4) }); }
  stroke(quad([-14, -160], [0, -154], [14, -160], 8), 5);
  if (qm > 0) text('?', 90, -300, { font: `900 ${Math.round(110 * qm)}px Rubik`, fill: PAL.white, outlineW: 14 });
  pop();
}
function bigHand(wx, wy, { grab = 0 } = {}) {   // рука сверху: кисть в (wx, wy)
  shape(noodle([wx - 120, wy - 1500], [wx - 10, wy - 120], 40, 210, 170), { fill: PAL.sleeve, lw: 8, shade: () => fillOnly(rect(wx - 20, wy - 1600, 200, 1500), PAL.sleeveS, { boil: .3 }) });
  push(); translate(wx, wy); scale(1.0);
  const c = grab;   // 0 открытая ладонь, 1 сжатая
  const pts = spline([[-95, -120], [95, -120], [120, -10], [120, 60 + 40 * (1 - c)], [70, 80 + 70 * (1 - c)], [30, 40 + 40 * (1 - c)], [0, 80 + 75 * (1 - c)], [-35, 40 + 40 * (1 - c)], [-70, 80 + 65 * (1 - c)], [-115, 40 + 30 * (1 - c)], [-120, -20]]);
  shape(pts, { fill: PAL.skin, lw: 8, shade: () => fillOnly(rect(50, -140, 120, 300), PAL.skinS, { boil: .3 }) });
  pop();
}

// ——— декорация ———
function set(t, warm) {
  fillOnly(rect(-800, -600, 2700, 1900), PAL.wall, { boil: 0 });
  for (let i = -6; i < 16; i++) { const x = i * 130; fillOnly(rect(x, -600, 46, 1900), PAL.wallS, { boil: .2 }); stroke([[x + 60, -600], [x + 60, 1300]], 4, { line: PAL.rib, boil: .5 }); }
  // иней по краю
  const fr = []; for (let i = 0; i <= 40; i++) { const x = -800 + i * 70; fr.push([x, 160 + (i % 2 ? 40 : 0) + hash(i) * 30]); }
  shape([[-800, -600], [1900, -600], ...fr.reverse()], { fill: PAL.frost, lw: 6, boil: .6 });
  // полка
  fillOnly(rect(-800, 1300, 2700, 1400), PAL.floor, { boil: 0 });
  fillOnly(rect(-800, 1300, 2700, 40), PAL.floorS, { boil: .3 });
  stroke([[-800, 1300], [1900, 1300]], 7);
  for (let i = 0; i < 10; i++) stroke([[-200 + i * 160, 1340], [-420 + i * 230, 2600]], 4, { line: PAL.floorS });
  // кубики льда
  for (const [x, s] of [[-40, 1], [1110, .9], [70, .6]]) {
    shape(rr(x - 70 * s, 1300 - 120 * s, 140 * s, 120 * s, 18 * s), { fill: '#d8f3fc', lw: 6, shade: () => fillOnly(rect(x - 50 * s, 1300 - 110 * s, 28 * s, 60 * s), PAL.white, { boil: .3, alpha: .8 }) });
  }
  // ледяная пыль
  for (let i = 0; i < 26; i++) {
    const x = -300 + hash(i * 3) * 1700, y = (hash(i * 5) * 1600 + t * (30 + hash(i) * 40)) % 1700 - 300;
    dot(x + Math.sin(t * .8 + i) * 20, y, 3 + hash(i * 7) * 3, PAL.white);
  }
}

// ——— блинчик ———
function blin(x, y, s, P = {}) {
  const { o = 0, w = 1, look = [0, 0], lid = 0, tilt = -.3, jit = 0, sq = 0, sm = .9, pupil = 5, closed = false } = P;
  push(); translate(x + jit, y); scale(s * (1 + sq), s * (1 - sq));
  const tri = spline([[-185, -10], [0, -250], [185, -10], [0, 8]]);
  shape(tri, { fill: '#f6cf7a', shade: () => {
    fillOnly(ell(70, -40, 140, 70), '#e2ab4f', { boil: .4 });
    for (let i = 0; i < 9; i++) fillOnly(ell(-90 + hash(i) * 180, -40 - hash(i + 4) * 150, 9 + hash(i + 8) * 8, 6 + hash(i + 2) * 6), '#c98a34', { boil: .3 });
  } });
  stroke(quad([-150, -40], [0, -8], [150, -40], 14), 5);
  eye(-42, -125, 36, 42, { lid, look, skin: '#f6cf7a', pupil, closed });
  eye(42, -125, 36, 42, { lid, look, skin: '#f6cf7a', pupil, closed });
  brow(-44, -178, 44, tilt); brow(44, -178, 44, -tilt);
  fillOnly(ell(-88, -88, 20, 11), '#ff9a8a', { boil: .3, alpha: .8 }); fillOnly(ell(88, -88, 20, 11), '#ff9a8a', { boil: .3, alpha: .8 });
  mouth(0, -72, 56, { o, w, sm });
  pop();
}

// ——— камера ———
function cam(t) {
  const k = shotOf(t);
  if (k === 'A') return [545, 1120, 1.26];
  if (k === 'B') { const u = seg(t, SH.B, SH.C); return [545, 1170, lerp(2.3, 2.45, ss(u))]; }
  if (k === 'C') { const u = seg(t, SH.C, SH.D); return [300, 1170, lerp(2.3, 2.5, ss(u))]; }
  if (k === 'D') return [545, 1140, 1.32];
  if (k === 'E') return [545, 1120, 1.26];
  if (k === 'F') { const u = seg(t, SH.F, SH.G); return [790, 1190, lerp(2.3, 2.5, ss(u))]; }
  return [545, 1110, 1];
}
function shake(t) {
  let a = 0;
  for (const [l, d] of [[EV.lid1, .5], [EV.lid, .6]]) if (t >= l && t < l + d) a = Math.max(a, 12 * (1 - seg(t, l, l + d)));
  if (t >= EV.land && t < EV.land + .3) a = Math.max(a, 10 * (1 - seg(t, EV.land, EV.land + .3)));
  for (const sl of [EV.slam1, EV.slam]) if (t >= sl && t < sl + .5) a = Math.max(a, 20 * (1 - seg(t, sl, sl + .5)));
  const tq = q(t);
  return [(hash(tq * 91) - .5) * 2 * a, (hash(tq * 57 + 3) - .5) * 2 * a];
}
const lidOpen = t => {
  const one = (a, b) => t < a || t >= b + .05 ? 0 : ss(seg(t, a, a + .35)) * (1 - seg(t, b - .05, b + .05));
  return Math.max(one(EV.lid1, EV.slam1), one(EV.lid, EV.slam));
};

// ——— сцена ———
function scene(t) {
  const shot = shotOf(t), tq = q(t);
  const [cx, cy, z] = cam(t), [sx, sy] = shake(t);
  push(); translate(540 + sx, 1130 + sy); scale(z); translate(-cx, -cy);
  set(t);
  // где блинчик и рука
  let bx = 545, by = 1300, bsq = 0, hand = null, gone = t >= EV.slam;
  if (t < EV.drop) { const d = eo(seg(t, EV.lid1 + .2, EV.drop - .1)); by = lerp(-300, 1000, d); hand = [bx, by - 230, 1]; }
  else if (t < EV.land) { by = lerp(1000, 1300, ei(seg(t, EV.drop, EV.land))); }
  else if (t < EV.land + .5) { bsq = .22 * Math.cos((t - EV.land) * 30) * (1 - seg(t, EV.land, EV.land + .5)); }
  if (t >= EV.drop && t < EV.slam1) { const u = ei(seg(t, EV.drop + .1, EV.slam1 - .2)); hand = [545, lerp(770, -700, u), 0]; }
  if (t >= EV.lid && t < EV.slam) {
    const d = eo(seg(t, EV.lid + .3, EV.grab - .05)), l = ei(seg(t, EV.lift, EV.lift + .55));
    const hy = lerp(-600, 1060, d) - l * 1800;
    hand = [545, hy, ss(seg(t, EV.grab - .1, EV.grab + .1))];
    if (t >= EV.grab) { by = hy + 240; }
  }
  const B = talk('B', t), P = talk('P', t), Sy = talk('S', t);
  const breath = Math.sin(tq * TAU * .5) * .012;
  // пельмень
  {
    let look = [.6, 0], lid = .45, tilt = 0, o = P.o, w = P.w, sm = 0, pupil = 5, jit = 0;
    if (shot === 'A') { look = [.5, -.4]; lid = .2; }
    if (shot === 'C') { lid = .55; look = [.5, .1]; sm = -.3; }
    if (shot === 'D') { lid = .5; look = [.7, 0]; }
    if (shot === 'E' && t < EV.slam) { lid = 0; pupil = 3.5; look = [.3, -.6]; tilt = .7; jit = (hash(tq * 17) - .5) * 6; }
    if (shot === 'E' && t >= EV.slam || shot === 'F') { lid = .5; look = [.5, 0]; sm = -.2; }
    pelmen(300, 1300, 1, { o, w, look, lid, tilt, sm, pupil, jit, sq: breath });
  }
  // сырник
  {
    let look = [-.6, 0], lid = 0, tilt = .7, o = Sy.o, w = Sy.w, sm = 0, pupil = 5, jit = 0, sweats = 0;
    if (shot === 'A') { look = [-.5, -.4]; pupil = 4; sweats = .3; }
    if (shot === 'D') { look = [-.7, 0]; sweats = .4; }
    if (shot === 'E' && t < EV.slam) { pupil = 3.5; look = [-.3, -.6]; tilt = 1; jit = (hash(tq * 31) - .5) * 8; sweats = 1; }
    if (shot === 'F') { lid = .35; tilt = .9; look = [-.2, .2]; sm = -.3; }
    syrnik(790, 1300, 1, { o, w, look, lid, tilt, sm, pupil, jit, sweats, sq: breath });
  }
  // блинчик
  if (!gone) {
    let o = B.o, w = B.w, look = [0, 0], sm = .9, lid = 0, tilt = -.3, jit = 0, pupil = 6;
    if (shot === 'A' && t < EV.land) { o = .9; w = 1.2; pupil = 4; }
    if (shot === 'D') { look = [Math.sin(tq * 3) * .7, 0]; o = 0; sm = .6; }
    if (shot === 'E' && t >= EV.grab) { pupil = 3.5; tilt = .8; sm = 0; jit = (hash(tq * 13) - .5) * 6; }
    const rot = t >= EV.grab ? Math.sin(t * 9) * .12 : 0;
    push(); translate(bx, by); rotate(rot);
    blin(0, 0, .95, { o, w, look, sm, lid, tilt, jit, pupil, sq: bsq + breath });
    pop();
    if (shot === 'D' && t >= EV.wave) {   // машет: блик-ручка
      const u = Math.sin((t - EV.wave) * 14);
      text('👋', bx + 170, by - 210 + u * 6, { font: '90px "Noto Color Emoji"', rot: u * .3 });
    }
  }
  if (shot === 'D') {   // сверчок-тишина: «...»
    const a = seg(t, EV.cricket, EV.cricket + .3);
    if (a > 0) text('...', 545, 760, { font: '900 120px Rubik', fill: PAL.white, outlineW: 14 });
  }
  if (hand) bigHand(hand[0], hand[1], { grab: hand[2] });
  pop();
  const L = lidOpen(t);
  if (L > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = .22 * L; g.fillStyle = PAL.warm;
    g.beginPath(); g.moveTo(140, 0); g.lineTo(940, 0); g.lineTo(1280, H); g.lineTo(-200, H); g.closePath(); g.fill();
    g.globalAlpha = .85 * L; g.fillRect(0, 0, W, 70 * L); g.globalAlpha = 1;
  }
  for (const sl of [EV.slam1, EV.slam]) if (t >= sl && t < sl + .35) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .5 * (1 - seg(t, sl, sl + .35)); g.fillStyle = '#0b1830'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}

// ——— титры и субтитры ———
function outlined(str, x, y, size, { fill = PAL.white, font = 'Rubik', ow = 14, align = 'center' } = {}) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `900 ${size}px ${font}, 'Noto Color Emoji'`; g.textAlign = align; g.textBaseline = 'middle';
  g.wordSpacing = `${Math.round(size * .28)}px`; g.lineJoin = 'round'; g.lineWidth = ow; g.strokeStyle = INK; g.strokeText(str, x, y); g.fillStyle = fill; g.fillText(str, x, y);
}
function wrap(str, size, maxW) {
  g.font = `900 ${size}px Rubik`; g.wordSpacing = `${Math.round(size * .28)}px`; const words = str.split(' '), out = []; let cur = '';
  for (const w of words) { const tryS = cur ? cur + ' ' + w : w; if (g.measureText(tryS).width > maxW && cur) { out.push(cur); cur = w; } else cur = tryS; }
  if (cur) out.push(cur); return out;
}
const WHO = { P: ['ПЕЛЬМЕНЬ ПЕТРОВИЧ', PAL.pillP], S: ['СЫРНИК', PAL.pillS], B: ['БЛИНЧИК', '#f6cf7a'], PS: ['ВСЕ', PAL.pillA] };
function subs(t) {
  for (const L of ST.lines) {
    if (t < L.sub0 || t >= L.sub1) continue;
    const [name, col] = WHO[L.who], pp = back(seg(q(t), L.sub0, L.sub0 + .2));
    const lines = wrap(L.text, 62, 900), y0 = 1590;
    // плашка говорящего
    g.setTransform(1, 0, 0, 1, 0, 0); g.font = '900 34px Rubik';
    const pw = g.measureText(name).width + 48;
    push(); translate(540, y0 - 92); scale(pp);
    shape(rr(-pw / 2, -30, pw, 60, 30), { fill: col, lw: 6 });
    text(name, 0, 2, { font: '900 34px Rubik', fill: INK });
    pop();
    lines.forEach((s, i) => outlined(s, 540, y0 + i * 78, 62 * (.85 + .15 * pp)));
  }
}
function titleTag(t) {
  if (t > 3.8) return;
  const a = back(seg(q(t), .15, .45)), out = 1 - seg(t, 3.4, 3.8);
  push(); translate(540, 250); scale(a * out); rotate(-.04);
  shape(rr(-330, -70, 660, 140, 34), { fill: '#2f6fd8', lw: 8 });
  text('МОРОЗИЛКА', 0, -8, { font: '900 74px Unbounded', fill: PAL.white, outlineW: 0 });
  pop();
  outlined('серия 2 · новенький', 540, 360, 44, { ow: 10 });
}

// ——— финальная карточка ———
function card(t) {
  const u = t - SH.G;
  push(); set(t); pop();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .35; g.fillStyle = '#0b3a66'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  const a = back(seg(q(t), SH.G, SH.G + .3));
  push(); translate(540, 420); scale(a); rotate(-.03);
  text('КТО', 0, -80, { font: '900 120px Unbounded', fill: PAL.white, outlineW: 18 });
  text('СЛЕДУЮЩИЙ?', 0, 60, { font: '900 96px Unbounded', fill: '#ffe14d', outlineW: 18 });
  pop();
  const items = [[290, 'P', 'ПЕЛЬМЕНЬ', PAL.pillP], [790, 'S', 'СЫРНИК', PAL.pillS]];
  items.forEach(([x, who, name, col], i) => {
    const b = back(seg(q(t), SH.G + .35 + i * .2, SH.G + .65 + i * .2), 2.2);
    if (b <= 0) return;
    const wig = Math.sin((u + i) * TAU * .8) * .04;
    push(); translate(x, 1000); scale(b); rotate(wig);
    shape(ell(0, 0, 210, 210, 60), {
      fill: col, lw: 9, shade: () => {
        const tq = q(t), bl = (Math.floor(tq * 12) + i * 5) % 40 < 2;
        if (who === 'P') pelmen(0, 175, 1.0, { lid: .2, look: [i ? -.3 : .3, 0], closed: bl, sm: .3 });
        else syrnik(0, 165, 1.0, { lid: 0, look: [-.3, 0], tilt: .8, closed: bl, sweats: .6 });
      }
    });
    shape(rr(-170, 190, 340, 84, 30), { fill: PAL.white, lw: 7 });
    text(name, 0, 234, { font: '900 52px Rubik', fill: INK });
    pop();
  });
  const c = eo(seg(t, SH.G + 1.0, SH.G + 1.4));
  if (c > 0) { g.globalAlpha = c; outlined('Голосуй в комментах 👇', 540, 1440 + (1 - c) * 40, 64); g.globalAlpha = 1; }
}
function frostWipe(t) {   // переход в карточку: иней наползает и сходит
  const a = seg(t, EV.frostwipe, SH.G), b = seg(t, SH.G, SH.G + .3);
  if (a <= 0 || b >= 1) return;
  const cover = a < 1 ? eo(a) : 1 - ei(b);
  const yy = cover * (H + 200);
  const pts = [[-20, -20], [W + 20, -20]];
  for (let i = 0; i <= 12; i++) { const x = W + 20 - i * (W + 40) / 12; pts.push([x, yy - 60 + (i % 2 ? 60 : 0)]); }
  shape(pts, { fill: PAL.frost, lw: 9 });
}

// ——— кадр ———
window.render = t => {
  frame(t);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = PAL.wall; g.fillRect(0, 0, W, H);
  if (t < SH.G) { scene(t); subs(t); titleTag(t); }
  else card(t);
  frostWipe(t);
};
window.EV = Object.entries(EV).map(([type, t]) => ({ t, type }));
await document.fonts.load('900 60px Rubik', 'Пельмень Aa ?!.,1');
await document.fonts.load('900 60px Unbounded', 'МОРОЗИЛКА ?1');
await document.fonts.load('60px "Noto Color Emoji"', '👇');
window.READY = true;
