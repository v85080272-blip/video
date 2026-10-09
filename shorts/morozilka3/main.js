// Морозилка, серия 3 «Побег» — Sci-Fi Sitcom Toon, вертикаль 1080×1920
import { clamp, lerp, seg, ss, eo, ei, eio, back, hash, vnoise, TAU } from '/core/lib.js';
import { W, H, INK, init, frame, g, push, pop, translate, rotate, scale, shape, fillOnly, stroke, ell, arc, rr, rect, spline, dot, text, S, noodle, quad } from './toon.js';

init(document.getElementById('c'));
const ST = await (await fetch('story.json')).json();
const SH = ST.shots, EV = ST.ev;
window.DUR = ST.dur;

const PAL = {
  wall: '#6fd3f7', wallS: '#4fbdea', rib: '#b5f0ff', floor: '#dff7ff', floorS: '#a9e3f7', frost: '#f4fcff',
  dough: '#fbe9c2', doughS: '#dcc496', hat: '#8a5a33', hatS: '#6d4426', fur: '#d3a874', furS: '#b88b57', stache: '#f4fcff',
  syr: '#ffc66e', syrS: '#e99a3f', crust: '#d9731f', crustS: '#a65f22', sugar: '#fffaf0',
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
  const { o = 0, w = 1, look = [0, 0], lid = 0, tilt = .6, jit = 0, sq = 0, sm = 0, pupil = 5, sweats = 0, closed = false, burnt = 0 } = P;
  push(); translate(x + jit, y); scale(s * (1 + sq), s * (1 - sq));
  shape(rr(-155, -175, 310, 175, 70), { fill: PAL.syr, shade: () => fillOnly(ell(90, -10, 160, 70), PAL.syrS, { boil: .4 }) });
  shape(ell(0, -172, 150, 42, 44), {
    fill: burnt ? '#5a2a10' : PAL.crust, shade: () => {
      fillOnly(ell(50, -160, 110, 28), burnt ? '#3a1806' : PAL.crustS, { boil: .3 });
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

// ——— яркость: лучи, вспышки, наезды ———
function burst(x, y, t, c1, c2, r = 1600, n = 18) {   // радиальные лучи за героем
  const rot = t * .35;
  fillOnly(ell(x, y, r, r, 40), c1, { boil: 0 });
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * TAU, b = a + TAU / n / 2;
    fillOnly([[x, y], [x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(b) * r, y + Math.sin(b) * r]], c2, { boil: .2 });
  }
}
function puff(x, y, t, t0, k) {   // дымок поднимается
  const u = (t - t0 - k * .35) % 1.4; if (u < 0) return;
  const r = 10 + u * 16;
  shape(ell(x + Math.sin(u * 5 + k) * 15, y - u * 110, r, r * .85, 16), { fill: '#f2f2f2', lw: 5, boil: .6 });
}
// наезд камеры на старте каждой реплики
const punch = t => { let p = 0; for (const L of ST.lines) if (t >= L.t0 && t < L.t0 + .3) p = Math.max(p, 1 - ss(seg(t, L.t0, L.t0 + .3))); return p; };

// ——— камера ———
function cam(t) {
  const k = shotOf(t), pz = 1 + .07 * punch(t);
  if (k === 'A') { const u = seg(t, 0, SH.B); return [790, 1170, lerp(3.0, 2.6, eo(u)) * pz]; }
  if (k === 'B') { const u = seg(t, SH.B, SH.C); return [300, 1170, lerp(2.35, 2.55, ss(u)) * pz]; }
  if (k === 'C') { const u = seg(t, SH.C, SH.D); return [790, 1170, lerp(2.3, 2.6, ss(u)) * pz]; }
  if (k === 'D') return [545, 1080, (t >= EV.jump && t < EV.lift ? 1.36 : 1.26) * pz];
  if (k === 'E') { const u = seg(t, SH.E, EV.lid2); return [lerp(300, 545, ss(seg(t, EV.lid2 - .3, EV.lid2))), 1130, lerp(2.0, 1.26, ss(seg(t, EV.lid2 - .3, EV.lid2))) * (1 + .1 * u * (t < EV.lid2))]; }
  if (k === 'F') { const u = seg(t, SH.F, SH.G); return [790, 1180, lerp(2.4, 2.75, ss(u)) * pz]; }
  if (k === 'G') { const u = seg(t, SH.G, SH.K); return [300, 1170, lerp(2.3, 2.45, ss(u)) * pz]; }
  return [545, 1110, 1];
}
function shake(t) {
  let a = 0;
  if (t < SH.B) a = 6;   // тревога
  for (const [l, d] of [[EV.lid, .5], [EV.lid2, .5]]) if (t >= l && t < l + d) a = Math.max(a, 12 * (1 - seg(t, l, l + d)));
  if (t >= EV.land && t < EV.land + .3) a = Math.max(a, 14 * (1 - seg(t, EV.land, EV.land + .3)));
  for (const sl of [EV.slam, EV.slam2]) if (t >= sl && t < sl + .5) a = Math.max(a, 20 * (1 - seg(t, sl, sl + .5)));
  if (shotOf(t) === 'F') a = Math.max(a, 4);
  const tq = q(t);
  return [(hash(tq * 91) - .5) * 2 * a, (hash(tq * 57 + 3) - .5) * 2 * a];
}
const lidOpen = t => {
  const one = (a, b) => t < a || t >= b + .05 ? 0 : ss(seg(t, a, a + .35)) * (1 - seg(t, b - .05, b + .05));
  return Math.max(one(EV.lid, EV.slam), one(EV.lid2, EV.slam2));
};

// ——— сцена ———
function scene(t) {
  const shot = shotOf(t), tq = q(t);
  const [cx, cy, z] = cam(t), [sx, sy] = shake(t);
  push(); translate(540 + sx, 1130 + sy); scale(z); translate(-cx, -cy);
  set(t);
  if (shot === 'A') burst(790, 1180, t, '#ff5a7a', '#ffd84d');
  if (shot === 'C') burst(790, 1180, t, '#ffd84d', '#ffb13d');
  if (shot === 'F') burst(790, 1180, t, '#ff7a3d', '#ffd84d');
  if (shot === 'G') burst(300, 1180, t, '#9fe7ff', '#d8f6ff');
  // рука и сырник
  let sxp = 790, syp = 1300, ssq = 0, srot = 0, hand = null, sGone = t >= EV.slam && t < EV.lid2 + .1;
  const HX = 600;
  if (t >= EV.lid && t < EV.slam) {
    const d = eo(seg(t, EV.lid + .25, EV.reach)), l = ei(seg(t, EV.lift, EV.lift + .55));
    const hy = lerp(-700, 760, d) - l * 1900;
    hand = [HX, hy, ss(seg(t, EV.catch, EV.catch + .1))];
    if (t >= EV.jump) {   // прыжок по дуге прямо в ладонь
      const u = seg(t, EV.jump, EV.catch), tx = HX, ty = hy + 250;
      sxp = lerp(790, tx, u); syp = lerp(1300, ty, u) - Math.sin(Math.PI * u) * 260; srot = -u * TAU * (t < EV.catch ? 1 : 0);
      if (t >= EV.catch) { sxp = tx; syp = ty; srot = Math.sin(t * 11) * .15; }
    } else if (t >= EV.crouch) ssq = .16 * ss(seg(t, EV.crouch, EV.jump - .05));
  }
  if (t >= EV.lid2 && t < EV.slam2) {   // рука возвращает сырника
    const d = eo(seg(t, EV.lid2 + .1, EV.drop - .05)), l = ei(seg(t, EV.drop + .2, EV.slam2 - .05));
    const hy = lerp(-700, 760, d) - l * 1600;
    hand = [790, hy, 1 - ss(seg(t, EV.drop, EV.drop + .1))];
    if (t < EV.drop) { sxp = 790; syp = hy + 250; srot = Math.sin(t * 13) * .1; }
    else if (t < EV.land) { syp = lerp(760 + 250, 1300, ei(seg(t, EV.drop, EV.land))); srot = seg(t, EV.drop, EV.land) * .3; }
  }
  if (t >= EV.land && t < EV.land + .5) ssq = .25 * Math.cos((t - EV.land) * 30) * (1 - seg(t, EV.land, EV.land + .5));
  const burnt = t >= EV.lid2;
  const P = talk('P', t), Sy = talk('S', t);
  const breath = Math.sin(tq * TAU * .5) * .012;
  // пельмень
  {
    let look = [.6, 0], lid = .45, tilt = 0, o = P.o, w = P.w, sm = 0, pupil = 5, jit = 0;
    if (shot === 'A') { look = [.6, -.1]; lid = .3; }
    if (shot === 'B') { lid = .55; look = [.5, .1]; sm = -.3; }
    if (shot === 'D' && t >= EV.lid) { lid = 0; pupil = 3.5; look = [.3, -.7]; tilt = .8; jit = t < EV.jump ? (hash(tq * 17) - .5) * 8 : 0; o = Math.max(o, t < EV.jump ? .5 : .8); }
    if (shot === 'D' && t >= EV.catch) { look = [.4, -.8]; o = .9; w = .7; }
    if (shot === 'E') { lid = t < EV.sizzle ? .3 : 0; pupil = t < EV.sizzle ? 5 : 3.5; look = t < EV.sizzle ? [.2, -.5] : [.3, -.8]; tilt = t < EV.sizzle ? .2 : .8; }
    if (shot === 'E' && t >= EV.land) { look = [.7, 0]; }
    if (shot === 'G') { lid = .5; look = [.6, 0]; sm = .35; tilt = -.1; }
    pelmen(300, 1300, 1, { o, w, look, lid, tilt, sm, pupil, jit, sq: breath });
  }
  // сырник
  if (!sGone) {
    let look = [-.3, 0], lid = 0, tilt = .7, o = Sy.o, w = Sy.w, sm = 0, pupil = 5, jit = 0, sweats = 0;
    if (shot === 'A') { look = [-.1, 0]; tilt = -.7; sm = .5; pupil = 6; o = Math.max(o, .15); }
    if (shot === 'C') { look = [-.5, -.3]; tilt = -.6; sm = .8; pupil = 6; }
    if (shot === 'D') { look = [-.5, -.6]; tilt = -.8; lid = .25; sm = .3; }
    if (shot === 'D' && t >= EV.jump) { lid = 0; o = Math.max(o, .7); sm = .9; pupil = 6; }
    if (t >= EV.lid2) { pupil = 3; tilt = 1; jit = (hash(tq * 31) - .5) * 10; sweats = 1; look = [-.2, -.2]; }
    push(); translate(sxp, syp); rotate(srot);
    syrnik(0, 0, 1, { o, w, look, lid, tilt, sm, pupil, jit, sweats, sq: ssq + breath, burnt });
    pop();
    if (burnt) for (let k = 0; k < 3; k++) puff(sxp - 70 + k * 70, syp - 205, t, EV.lid2, k);
  }
  if (hand) bigHand(hand[0], hand[1], { grab: hand[2] });
  pop();
  // шипение сковородки за кадром
  if (shot === 'E' && t >= EV.sizzle && t < EV.lid2) {
    const a = back(seg(q(t), EV.sizzle, EV.sizzle + .25));
    push(); translate(540, 330 + Math.sin(t * 40) * 4); scale(a); rotate(-.06);
    text('ПШШШ!', 0, 0, { font: '900 130px Unbounded', fill: '#ff8a3d', outlineW: 18 });
    pop();
  }
  const L = lidOpen(t);
  if (L > 0) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = .26 * L; g.fillStyle = PAL.warm;
    g.beginPath(); g.moveTo(140, 0); g.lineTo(940, 0); g.lineTo(1280, H); g.lineTo(-200, H); g.closePath(); g.fill();
    g.globalAlpha = .85 * L; g.fillRect(0, 0, W, 70 * L); g.globalAlpha = 1;
  }
  if (t < SH.B) {   // красная тревога
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = .12 + .14 * (Math.sin(t * TAU * 3) * .5 + .5); g.fillStyle = '#ff1f4b'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
  if (t >= EV.jump && t < EV.catch) {   // вспышка на прыжке
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .35 * (1 - seg(t, EV.jump, EV.jump + .25)); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  }
  for (const sl of [EV.slam, EV.slam2]) if (t >= sl && t < sl + .35) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .5 * (1 - seg(t, sl, sl + .35)); g.fillStyle = '#0b1830'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
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
const WHO = { P: ['ПЕЛЬМЕНЬ ПЕТРОВИЧ', PAL.pillP], S: ['СЫРНИК', PAL.pillS] };
function subs(t) {
  for (const L of ST.lines) {
    if (t < L.sub0 || t >= L.sub1) continue;
    const [name, col] = WHO[L.who], pp = back(seg(q(t), L.sub0, L.sub0 + .2));
    const lines = wrap(L.text, 66, 920), y0 = 1590;
    g.setTransform(1, 0, 0, 1, 0, 0); g.font = '900 34px Rubik';
    const pw = g.measureText(name).width + 48;
    push(); translate(540, y0 - 96); scale(pp);
    shape(rr(-pw / 2, -30, pw, 60, 30), { fill: col, lw: 6 });
    text(name, 0, 2, { font: '900 34px Rubik', fill: INK });
    pop();
    const hot = L.text.includes('!');
    lines.forEach((s, i) => outlined(s, 540, y0 + i * 82, 66 * (.85 + .15 * pp), { fill: hot ? '#ffe14d' : PAL.white }));
  }
}
function titleTag(t) {   // крючок: штамп «ПЛАН ПОБЕГА» с первого кадра
  if (t > 4.4) return;
  const a = 1, out = 1 - seg(t, 4.0, 4.4);
  push(); translate(540, 260); scale((t < .3 ? 1.12 - .12 * eo(seg(t, 0, .3)) : 1) * out); rotate(-.07 + Math.sin(t * 20) * .01 * (t < SH.B));
  shape(rr(-410, -90, 820, 180, 30), { fill: '#ff2d55', lw: 10 });
  text('🚨', -352, -4, { font: '76px "Noto Color Emoji"' });
  text('ПЛАН ПОБЕГА', 58, -4, { font: '900 70px Unbounded', fill: PAL.white, outlineW: 0 });
  pop();
  if (a > 0 && out > 0) { g.globalAlpha = out; outlined('морозилка · серия 3', 540, 400, 44, { ow: 10 }); g.globalAlpha = 1; }
}

// ——— финальная карточка ———
function card(t) {
  const u = t - SH.K;
  push(); set(t); pop();
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = .3; g.fillStyle = '#0b3a66'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  const a = back(seg(q(t), SH.K, SH.K + .3));
  push(); translate(540, 420); scale(a); rotate(-.03);
  text('КТО', 0, -80, { font: '900 120px Unbounded', fill: PAL.white, outlineW: 18 });
  text('СЛЕДУЮЩИЙ?', 0, 60, { font: '900 96px Unbounded', fill: '#ffe14d', outlineW: 18 });
  pop();
  const items = [[290, 'P', 'ПЕЛЬМЕНЬ', PAL.pillP], [790, 'S', 'СЫРНИК', PAL.pillS]];
  items.forEach(([x, who, name, col], i) => {
    const b = back(seg(q(t), SH.K + .35 + i * .2, SH.K + .65 + i * .2), 2.2);
    if (b <= 0) return;
    const wig = Math.sin((u + i) * TAU * .8) * .04;
    push(); translate(x, 1000); scale(b); rotate(wig);
    shape(ell(0, 0, 210, 210, 60), {
      fill: col, lw: 9, shade: () => {
        const tq = q(t), bl = (Math.floor(tq * 12) + i * 5) % 40 < 2;
        if (who === 'P') pelmen(0, 175, 1.0, { lid: .2, look: [i ? -.3 : .3, 0], closed: bl, sm: .3 });
        else syrnik(0, 165, 1.0, { lid: 0, look: [-.3, 0], tilt: .8, closed: bl, sweats: .6, burnt: 1 });
      }
    });
    shape(rr(-170, 190, 340, 84, 30), { fill: PAL.white, lw: 7 });
    text(name, 0, 234, { font: '900 52px Rubik', fill: INK });
    pop();
  });
  const c = eo(seg(t, SH.K + 1.0, SH.K + 1.4));
  if (c > 0) { g.globalAlpha = c; outlined('Сбежит ли он снова? Пиши 👇', 540, 1440 + (1 - c) * 40, 54); g.globalAlpha = 1; }
}
function frostWipe(t) {
  const a = seg(t, EV.frostwipe, SH.K), b = seg(t, SH.K, SH.K + .3);
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
  if (t < SH.K) { scene(t); subs(t); titleTag(t); }
  else card(t);
  frostWipe(t);
};
window.EV = Object.entries(EV).map(([type, t]) => ({ t, type }));
await document.fonts.load('900 60px Rubik', 'Пельмень Aa ?!.,1—');
await document.fonts.load('900 60px Unbounded', 'МОРОЗИЛКА ПЛАН ПОБЕГА ПШ?1');
await document.fonts.load('60px "Noto Color Emoji"', '👇🚨');
window.READY = true;
