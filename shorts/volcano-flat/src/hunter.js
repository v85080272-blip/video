// The hunter in flat shapes: blaze-orange jacket, olive trousers, rubber boots, a fur ushanka, a big nose and a beard.
// Legs come from foot positions and arms from hand positions (two-bone IK), so the timeline only says where the feet,
// the hands and the hip are. Local units: he faces left (forward is -x), y up is negative, about 620 px tall at s = 1.
import { lerp, clamp, TAU } from './lib.js';
import { g, frame, ik, limb, ell, fill, polyPath, smoothPath, sample, inside, rrPath, rrect, MONO } from './flat.js';

export const HUN = {
  skin: '#f2c19b', skinSh: '#d99e78', nose: '#e8a07e', beard: '#6a4127', beardSh: '#55331f', jacket: '#f2782f', jacketSh: '#c95c1f',
  collar: '#3a2f46', pants: '#56653d', pantsSh: '#435030', boot: '#24232f', bootHi: '#3a3948', hat: '#7a5236', hatSh: '#5f3f29',
  fur: '#d2ae84', furSh: '#b48f66', eye: '#fff7ea', pupil: '#17162f', brow: '#4a2d1c', mouth: '#3a1a24', tongue: '#d9536a',
  pack: '#3f5a4a', packSh: '#2f4639', strap: '#2a3a31', scarf: '#d9433b', scarfSh: '#ad3029', scarfWet: '#b8342e', scarfWetSh: '#8c2621', lens: '#ffd23f', lensSh: '#e0a91f',
  frameDark: '#24232f', glove: '#3a3948', sleeve: '#ff9150',
};
export const THIGH = 128, SHIN = 124, UPPER = 100, FORE = 96;
const JACKET = [[-56, 84], [-66, 0], [-66, -110], [-56, -180], [-30, -212], [10, -220], [44, -206], [64, -160], [68, -80], [64, 20], [58, 84]];
const SKULL = [[-62, -10], [-60, -52], [-40, -80], [0, -88], [40, -74], [60, -40], [58, 8], [40, 40], [0, 52], [-40, 40]];
const BEARD = [[-70, 6], [-52, -6], [-20, 0], [14, -6], [44, 4], [52, 30], [36, 60], [4, 82], [-34, 78], [-62, 56], [-74, 30]];
const HAT = [[-66, -70], [-60, -118], [-30, -146], [10, -150], [48, -132], [68, -92], [66, -64]];
const FUR_BAND = [[-74, -60], [-72, -90], [-30, -98], [20, -98], [72, -86], [76, -58], [40, -52], [-30, -54]];
const FLAP = [[34, -62], [72, -60], [76, -12], [64, 14], [42, 10], [32, -22]];

// a hand at wrist point w, pointing along angle a; shape: 'fist' | 'open' | 'point' | 'thumb' | 'grip'
export function drawHand(w, a, s, shape = 'fist', fx = 1, color = HUN.skin) {
  const F = frame(w[0], w[1], a, s, 1, 1, fx);
  const c = F.p([16, 0]);
  ell(c[0], c[1], 19 * s, 16 * s, color, a);
  const f = (pts, wd = 10) => limb(F.pts(pts), wd * s, color, false);
  if (shape === 'open') { f([[22, -10], [46, -16]]); f([[26, -2], [52, -2]]); f([[24, 7], [48, 10]]); f([[18, 13], [40, 20]]); f([[8, -12], [22, -26]]); }
  else if (shape === 'point') { f([[24, -6], [56, -8]]); f([[8, -12], [24, -22]]); }
  else if (shape === 'thumb') { f([[10, -10], [8, -42]], 12); }
  else if (shape === 'grip' || shape === 'fist') { f([[8, -12], [24, -18]], 11); }
  return F;
}
// one arm from shoulder S to the wrist target T (world), elbow on side bend; sleeve over most of it
export function drawArmTo(S, T, s, { bend = 1, shade = false, hand = 'fist', handAng = null, fx = 1, sleeve = 0.92 } = {}) {
  const E = ik(S, T, UPPER * s, FORE * s, bend);
  const d = Math.hypot(T[0] - S[0], T[1] - S[1]), reach = Math.min(d, (UPPER + FORE) * s - 1e-3);
  const ang = Math.atan2(T[1] - S[1], T[0] - S[0]);
  const Wp = [S[0] + Math.cos(ang) * reach, S[1] + Math.sin(ang) * reach];
  const W2 = d > reach ? Wp : T;
  const cloth = shade ? HUN.jacketSh : HUN.sleeve, skin = shade ? HUN.skinSh : HUN.skin;
  const fa = Math.atan2(W2[1] - E[1], W2[0] - E[0]);
  const hf = drawHand(W2, handAng ?? fa, s, hand, fx, skin);
  const cuff = [lerp(E[0], W2[0], sleeve), lerp(E[1], W2[1], sleeve)];
  limb([S, E, cuff], 40 * s, cloth);
  ell(cuff[0], cuff[1], 13 * s, 21 * s, shade ? HUN.collar : HUN.jacketSh, fa);
  return { shoulder: S, elbow: E, wrist: W2, hand: hf.p([16, 0]), handFrame: hf };
}

// o: hip [x, y], feet { near, far } (world sole points), s, face (-1 left, 1 right), lean (forward, rad), headTilt,
//    hands { near, far }: world wrist targets with { p, bend, shape, ang } (or null for hanging arms),
//    face expression: brow (-1 frown … 1 raised), pop (eyes 0…1), lid (0…1), blink (0…1), look [x, y], mouth (0…1 open),
//    hatJump (px, the hat pops up), flaps (0 down … 1 up), scarf ('neck' | 'mask' | null), scarfWave, glasses (0…1),
//    pack (backpack on), propNear / propFar(handFrame, arm) callbacks to draw what the hands hold.
// the body and head frames for o, without drawing: to aim the hands at the eyes or the mouth
export function framesOf(o) {
  const s = o.s ?? 1, fx = o.face === 1 ? -1 : 1, lean = o.lean ?? 0.05;
  const T = frame(o.hip[0], o.hip[1], fx * -lean, s, fx);
  return { T, H: T.sub(-14, -300, -(o.headTilt ?? 0.04), 1.25), fx, s };
}
export function drawHunter(o) {
  const s = o.s ?? 1, fx = o.face === 1 ? -1 : 1, lean = o.lean ?? 0.05, hs = s * 1.25;
  const T = frame(o.hip[0], o.hip[1], fx * -lean, s, fx);
  const bendLeg = -fx;
  const A = {};
  const legOf = (hipLocal, foot, shade) => {
    const hj = T.p(hipLocal), ankle = [foot[0], foot[1] - 20 * s];
    const knee = ik(hj, ankle, THIGH * s, SHIN * s, bendLeg);
    const c = shade ? HUN.pantsSh : HUN.pants;
    limb([hj, knee], 48 * s, c, false);
    limb([knee, ankle], 40 * s, c, false);
    const b = shade ? HUN.boot : HUN.boot;
    limb([[ankle[0], ankle[1] - 22 * s], [ankle[0], ankle[1] + 4 * s]], 42 * s, b, false);       // boot shaft
    ell(ankle[0] - 16 * s * fx, ankle[1] + 10 * s, 33 * s, 14 * s, b);
    ell(ankle[0] - 30 * s * fx, ankle[1] + 4 * s, 10 * s, 5 * s, HUN.bootHi);
    return knee;
  };
  const hands = o.hands ?? {};
  const SN = T.p([-14, -192]), SF = T.p([18, -198]);
  const hang = (S, side) => [S[0] - fx * (side < 0 ? 34 : 4) * s, S[1] + (UPPER + FORE - 16) * s];

  // far arm, backpack, far leg, near leg, trousers, jacket
  const hf = hands.far;
  const farArm = drawArmTo(SF, hf?.p ?? hang(SF, 1), s, { bend: hf?.bend ?? fx, shade: true, hand: hf?.shape ?? 'fist', handAng: hf?.ang, fx });
  A.farHand = farArm.hand; A.farArm = farArm;
  if (o.propFar) o.propFar(farArm.handFrame, farArm);
  if (o.pack !== false) {
    const bp = T.pts([[44, -196], [104, -186], [112, -60], [52, -40]]);
    fill(smoothPath(bp), HUN.pack);
    inside(smoothPath(bp), () => { const c = T.p([96, -120]); ell(c[0], c[1], 22 * s, 80 * s, HUN.packSh, T.a(0)); });
    const fl = T.pts([[58, -108], [104, -102], [106, -66], [60, -62]]); fill(smoothPath(fl), HUN.packSh);
  }
  legOf([12, 4], o.feet.far, true);
  legOf([-10, 6], o.feet.near, false);
  fill(polyPath(T.pts([[-52, -20], [52, -20], [56, 40], [-54, 40]])), HUN.pants);
  const jk = smoothPath(T.pts(JACKET));
  fill(jk, HUN.jacket);
  inside(jk, () => {
    const b = T.p([60, -100]); ell(b[0], b[1], 26 * s, 140 * s, HUN.jacketSh, T.a(0));          // one shade tone on the back
    limb(T.pts([[-62, -40], [64, -44]]), 12 * s, HUN.jacketSh, false);                             // waist cord
    const pk = T.pts([[-50, 0], [-14, 0], [-12, 44], [-52, 44]]); fill(polyPath(pk), HUN.jacketSh);    // pocket
    if (o.pack !== false) limb(T.pts([[-30, -206], [6, -120], [40, -40]]), 16 * s, HUN.strap, false);      // pack strap
  });
  // collar and neck
  fill(smoothPath(T.pts([[-40, -214], [-30, -236], [20, -240], [40, -222], [30, -204], [-30, -202]])), HUN.collar);
  A.T = T;

  // —— head ——
  const H = T.sub(-14, -300, -(o.headTilt ?? 0.04), 1.25);
  A.head = H.p([0, 0]); A.H = H;
  const skull = smoothPath(H.pts(SKULL));
  fill(skull, HUN.skin);
  inside(skull, () => { const b = H.p([56, -10]); ell(b[0], b[1], 26 * hs, 70 * hs, HUN.skinSh, H.a(0)); });
  // the near ear flap of the hat (down by default)
  const flaps = o.flaps ?? 0;
  // beard with an open mouth inside it
  const bd = smoothPath(H.pts(BEARD));
  fill(bd, HUN.beard);
  inside(bd, () => { const b = H.p([40, 40]); ell(b[0], b[1], 24 * hs, 50 * hs, HUN.beardSh, H.a(0)); });
  const mo = clamp(o.mouth ?? 0, 0, 1);
  const mc = H.p([-40, 22 + 4 * mo]);
  if (mo > 0.03) {
    ell(mc[0], mc[1], (12 + 8 * mo) * hs, (4 + 18 * mo) * hs, HUN.mouth, H.a(0));
    const tg = H.p([-40, 22 + 14 * mo]); if (mo > 0.4) ell(tg[0], tg[1], 9 * hs * mo, 5 * hs * mo, HUN.tongue, H.a(0));
  } else limb(H.pts([[-52, 20], [-30, 22]]), 5 * hs, HUN.mouth, false);
  A.mouth = mc;
  // moustache over the mouth
  fill(smoothPath(H.pts([[-74, 10], [-60, 0], [-40, 6], [-22, 2], [-12, 12], [-30, 18], [-50, 14], [-66, 22]])), HUN.beardSh);
  // nose
  const nz = H.p([-64, -2]); ell(nz[0], nz[1], 20 * hs, 17 * hs, HUN.nose, H.a(0));
  A.nose = nz;
  // eye, brow
  const pop = o.pop ?? 0, look = o.look ?? [-0.5, 0], blink = clamp(o.blink ?? 0, 0, 1);
  const ec = H.p([-34, -22]), rx = 13 * (1 + 0.45 * pop), ry = 16 * (1 + 0.45 * pop);
  if (blink < 0.95) {
    ell(ec[0], ec[1], rx * hs, ry * hs * (1 - blink), HUN.eye, H.a(0));
    const pc = H.p([-34 + look[0] * 6, -22 + look[1] * 7]);
    const pr = 6 * (1 - 0.3 * pop) * hs;
    ell(pc[0], pc[1], pr, Math.min(pr, ry * hs * (1 - blink)), HUN.pupil);
    const lid = clamp((o.lid ?? 0.25) * (1 - pop), 0, 1);
    if (lid > 0.02) {
      const cap = H.pts([[-34 - rx * 1.3, -22 - ry * 1.4], [-34 + rx * 1.3, -22 - ry * 1.4], [-34 + rx * 1.3, -22 - ry + 2 * ry * lid], [-34 - rx * 1.3, -22 - ry + 2 * ry * lid]]);
      inside(polyPath(H.pts(sample([[-34 - rx, -22], [-34, -22 - ry], [-34 + rx, -22], [-34, -22 + ry]], 6))), () => fill(polyPath(cap), HUN.skinSh));
    }
  } else limb(H.pts([[-46, -20], [-22, -20]]), 5 * hs, HUN.pupil, false);
  const brow = o.brow ?? 0;
  const by = -44 - 8 * Math.max(0, brow) - 5 * pop;
  limb(H.pts([[-52, by + 6 * Math.min(0, brow) * -1 + 2], [-18, by - 6 * brow * 0.6 - (brow < 0 ? -8 * brow : 0)]]), 9 * hs, HUN.brow, false);
  // scarf: around the neck, or tied over nose and mouth with tails at the back of the head
  const wave = o.scarfWave ?? 0;
  if (o.scarf === 'neck') {
    fill(smoothPath(T.pts([[-44, -226], [-20, -246], [30, -248], [46, -226], [30, -208], [-30, -206]])), HUN.scarf);
    limb([T.p([-30, -214]), T.p([-44 + 6 * wave, -150]), T.p([-40 + 10 * wave, -110])], 20 * s, HUN.scarfSh);
  } else if (o.scarf === 'mask') {
    const band = H.pts([[-80, -8], [-70, -22], [-10, -18], [50, -24], [60, 14], [20, 30], [-30, 44], [-74, 34]]);
    fill(smoothPath(band), o.scarfWet ? HUN.scarfWet : HUN.scarf);
    inside(smoothPath(band), () => { limb(H.pts([[-76, 14], [56, 4]]), 6 * hs, HUN.scarfSh, false); });
    const k = H.p([58, -4]);
    limb([k, H.p([96 + 6 * wave, -14 + 10 * wave]), H.p([128 + 10 * wave, 0 + 14 * Math.sin(wave * 3)])], 14 * hs, HUN.scarfSh);
    limb([k, H.p([92, 18 - 6 * wave]), H.p([118 + 6 * wave, 34])], 14 * hs, HUN.scarf);
    ell(k[0], k[1], 12 * hs, 12 * hs, HUN.scarfSh);
  }
  // ushanka: fur band, dome and the near flap
  const hj = o.hatJump ?? 0;
  const HT = H.sub(0, -hj, o.hatTilt ?? 0);
  const dome = smoothPath(HT.pts(HAT));
  fill(dome, HUN.hat);
  inside(dome, () => { const b = HT.p([50, -80]); ell(b[0], b[1], 24 * hs, 60 * hs, HUN.hatSh, HT.a(0)); });
  const fb = smoothPath(HT.pts(FUR_BAND)); fill(fb, HUN.fur);
  inside(fb, () => { const b = HT.p([66, -46]); ell(b[0], b[1], 18 * hs, 40 * hs, HUN.furSh, HT.a(0)); });
  const flapPts = FLAP.map(([x, y]) => { const a = -2.4 * flaps; const c = Math.cos(a), sn = Math.sin(a), px = x - 40, py = y + 40; return [40 + px * c - py * sn, -40 + px * sn + py * c]; });
  if (!o.noFlap) { const fp = smoothPath(HT.pts(flapPts)); fill(fp, HUN.fur); inside(fp, () => { const b = HT.p([70, 0]); ell(b[0], b[1], 12 * hs, 40 * hs, HUN.furSh, HT.a(0)); }); }
  A.hatTop = HT.p([0, -120]);
  // glasses
  const gl = clamp(o.glasses ?? 0, 0, 1);
  if (o.glasses != null) {
    const gy = -22 - (1 - gl) * 62;
    limb(H.pts([[-30, gy - 2], [40, gy - 8]]), 5 * hs, HUN.frameDark, false);
    const lc = H.p([-38, gy]); ell(lc[0], lc[1], 24 * hs, 17 * hs, HUN.frameDark, H.a(0));
    ell(lc[0], lc[1], 20 * hs, 13 * hs, HUN.lens, H.a(0));
    const sh = H.p([-30, gy - 4]); ell(sh[0], sh[1], 6 * hs, 4 * hs, '#fff7ea', H.a(-0.4));
  }

  if (o.faceProp) o.faceProp(A);
  // near arm last, in front of everything
  const hn = hands.near;
  const nearArm = drawArmTo(SN, hn?.p ?? hang(SN, -1), s, { bend: hn?.bend ?? fx, hand: hn?.shape ?? 'fist', handAng: hn?.ang, fx });
  A.nearHand = nearArm.hand; A.nearArm = nearArm;
  if (o.propNear) o.propNear(nearArm.handFrame, nearArm);
  return A;
}

// —— props (drawn in screen space at a hand; fx = -1 when he faces left) ——
export function binoculars(x, y, s, fx = -1, ang = 0) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(fx * -1, 1);
  for (const dy of [-15, 15]) {
    rrect(-46 * s, (dy - 13) * s, 70 * s, 26 * s, 8 * s, HUN.frameDark);
    rrect(-54 * s, (dy - 11) * s, 12 * s, 22 * s, 4 * s, '#4a4a66');
  }
  rrect(-20 * s, -6 * s, 30 * s, 12 * s, 4 * s, '#4a4a66');
  g.restore();
}
export function phone(x, y, s, ang = 0, glow = 1, pic = false) {
  g.save(); g.translate(x, y); g.rotate(ang);
  rrect(-24 * s, -44 * s, 48 * s, 88 * s, 9 * s, HUN.frameDark);
  rrect(-19 * s, -37 * s, 38 * s, 70 * s, 5 * s, '#7fd0ff', glow);
  if (pic && glow > 0.2) {                       // what he is filming: a tiny volcano and its cloud
    fill(polyPath([[-16 * s, 26 * s], [-3 * s, 6 * s], [5 * s, 6 * s], [17 * s, 26 * s]]), '#4b4f74');
    ell(1 * s, -6 * s, 11 * s, 10 * s, '#7a7582'); ell(-5 * s, -16 * s, 9 * s, 8 * s, '#7a7582'); ell(8 * s, -20 * s, 8 * s, 7 * s, '#7a7582');
    ell(1 * s, 6 * s, 4 * s, 2 * s, '#ff6a2a');
  }
  ell(14 * s, -30 * s, 4 * s, 4 * s, '#ff4d4d');
  g.restore();
}
// the scarf off the neck, hanging from the hand at p; wet 0…1 darkens it from the top down where the water lands
export function cloth(p, s, wet = 0, wave = 0) {
  const w = 70 * s, L = 150 * s, sw = 10 * s * wave;
  const pts = [[p[0] - 8 * s, p[1] - 6 * s], [p[0] + 10 * s, p[1] - 4 * s], [p[0] + w / 2 + sw * 0.3, p[1] + L * 0.5], [p[0] + w / 2 + sw, p[1] + L],
    [p[0] - w / 2 + sw, p[1] + L + 6 * s], [p[0] - w / 2 + sw * 0.3, p[1] + L * 0.5]];
  const path = smoothPath(pts);
  fill(path, HUN.scarf);
  inside(path, () => {
    limb([[p[0] + 4 * s, p[1]], [p[0] + w * 0.25 + sw, p[1] + L]], 12 * s, HUN.scarfSh, false);
    if (wet > 0) ell(p[0], p[1] + 10 * s, w * 0.75, (16 + 120 * wet) * s, HUN.scarfWetSh);
  });
}
export function flask(x, y, s, ang = 0) {
  g.save(); g.translate(x, y); g.rotate(ang);
  rrect(-20 * s, -36 * s, 40 * s, 66 * s, 12 * s, '#9aa6b8');
  rrect(-20 * s, -36 * s, 14 * s, 66 * s, 7 * s, '#c7d0dc');
  rrect(-9 * s, -50 * s, 18 * s, 16 * s, 4 * s, '#5d6a7c');
  g.restore();
}
