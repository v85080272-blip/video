// Батон: a ginger cat in flat shapes. One rig morphs from sitting to the arched Halloween pose (pose), grows spiky fur
// (fur), licks a paw, looks up, hisses, thumps and swings its tail, reaches with the tail, turns its head to the camera
// and blinks slowly. Local units: the cat faces right, origin on the floor under its middle, y up is negative.
import { lerp, clamp, TAU, noise } from './lib.js';
import { frame, sample, resample, spiky, tube, smoothPath, polyPath, ellPath, fill, ell, limb, lerpPts, inside, rot } from './flat.js';

export const CAT = {
  fur: '#ff8a3d', shade: '#d96a2c', stripe: '#cf5a1f', belly: '#ffd8a8', iris: '#d4ef6a', pupil: '#17162f', nose: '#ff6f86',
  mouth: '#4a1626', inner: '#ff9db0', white: '#fff7ea', whisk: '#fff3d6',
};
const BODY_SIT = [[70, 0], [10, 2], [-70, 2], [-118, -16], [-134, -78], [-112, -150], [-66, -200], [-10, -222], [44, -196], [64, -140], [62, -70], [80, -16]];
const BODY_ARCH = [[104, -122], [40, -150], [-40, -166], [-112, -126], [-156, -182], [-144, -278], [-66, -348], [24, -310], [96, -242], [126, -180], [122, -144], [114, -124]];
const FUR_W = [0, 0, 0.15, 0.6, 1, 1, 1, 1, 0.8, 0.35, 0.1, 0];          // fur stands on the rump, back and shoulders
const TAIL_SIT = [[-112, -24], [-158, -14], [-200, -12], [-232, -26], [-244, -58], [-226, -86]];
const TAIL_UP = [[-138, -208], [-156, -268], [-166, -328], [-168, -386], [-162, -438], [-150, -480]];
const HEAD_SIT = [32, -258], HEAD_ARCH = [158, -212], HEAD_LICK = [46, -240];
const R = 74;
const HEAD = [[0, -0.9], [0.62, -0.76], [0.98, -0.3], [1.1, 0.16], [0.9, 0.5], [0.45, 0.74], [0, 0.8], [-0.45, 0.74], [-0.9, 0.5], [-1.1, 0.16], [-0.98, -0.3], [-0.62, -0.76]];
const HEAD_W = [0, 0, 0.3, 1, 1, 0.2, 0, 0.2, 1, 1, 0.3, 0];             // cheek tufts

// a smooth outline through control points with a weight per point, evened out for spikes
function weighted(ctrl, w, step) {
  return resample(sample(ctrl.map((p, i) => [p[0], p[1], w[i]]), 10), step);
}
const L = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// o: x, y (world floor point), s, face (1 right / -1 left), pose (0 sit … 1 arched), fur (spikes 0…1), t (for trembling),
//    lick (0…1) + lickPh, head: turn (0 front … 1 profile), tilt, blink, pupil (1 round … 0 slit), look [x, y], ears (flatten),
//    mouth ('w' | 'hiss' | 'smile'), hiss (0…1), tail: thump (0…1), swish amount + swishPh, reach {x, y, k} (local target),
//    squash (1 = none) for anticipation. Returns world anchors (head, mouth, tail tip).
export function drawCat(o) {
  const s = o.s ?? 1, face = o.face ?? 1, pose = o.pose ?? 0, fur = o.fur ?? 0, t = o.t ?? 0, sq = o.squash ?? 1;
  const lick = o.lick ?? 0, ph = o.lickPh ?? 0;
  const grow = 1 + 0.16 * clamp(pose, 0, 1.2);
  const B = frame(o.x, o.y, o.rot ?? 0, s * grow, face, 1 / Math.sqrt(sq), sq);
  const fcol = o.colors?.fur ?? CAT.fur, shcol = o.colors?.shade ?? CAT.shade;

  // —— tail ——
  let tail = lerpPts(TAIL_SIT, TAIL_UP, clamp(pose, 0, 1.1));
  const root = tail[0];
  if (o.thump) tail = tail.map((p, i) => (i ? rot(p, 0.75 * o.thump * (i / 5), root) : p));
  if (o.swish) tail = tail.map((p, i) => {
    const k = i / 5, a = Math.sin(TAU * (o.swishPh ?? 0) - i * 0.9) * o.swish * k * k;
    return rot(p, a * 0.5, root);
  });
  if (o.reach && o.reach.k > 0) {
    const { x: rx, y: ry, k } = o.reach, mid = [lerp(root[0], rx, 0.35) - 40, lerp(root[1], ry, 0.75)];
    const bez = u => [(1 - u) ** 2 * root[0] + 2 * u * (1 - u) * mid[0] + u * u * rx, (1 - u) ** 2 * root[1] + 2 * u * (1 - u) * mid[1] + u * u * ry];
    tail = tail.map((p, i) => L(p, bez(i / 5), k));
  }
  const tc = sample(B.pts(tail), 8, false);
  const tw = u => s * grow * (lerp(30, 22, u) + fur * 34 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.1)));
  let tOut = tube(tc, tw);
  if (fur > 0.02) tOut = spiky(resample(tOut, 9 * s), (p, i) => fur * 26 * s * (0.75 + 0.35 * noise(i * 0.7 + t * 9, 3)), 4, 0, 2.6);
  fill(smoothPath(tOut), fcol);
  const tipW = B.p(tail[5]);

  // —— far legs (one shade tone) ——
  const legs = {
    farHind: [L([-90, -30], [-96, -138], pose), L([-80, -10], [-100, -6], pose)],
    farFront: [L([36, -110], [86, -140], pose), L([44, -8], [92, -6], pose)],
    nearHind: [L([-70, -22], [-122, -132], pose), L([-28, -8], [-128, -6], pose)],
    nearFront: [L([58, -120], [104, -132], pose), L([70, -8], [116, -6], pose)],
  };
  const leg = ([a, b], c, w = 30) => {
    const [A, Bp] = [B.p(a), B.p(b)];
    limb([A, Bp], (w + 6 * clamp(pose)) * s * grow, c);
    ell(Bp[0] + 6 * face * s, Bp[1] - 4 * s, 20 * s * grow, 11 * s * grow, c);
  };
  leg(legs.farHind, shcol, 28); leg(legs.farFront, shcol, 28);

  // —— body ——
  const ctrl = lerpPts(BODY_SIT, BODY_ARCH, pose);
  let outline = weighted(B.pts(ctrl), FUR_W, 11 * s);
  if (fur > 0.02) outline = spiky(outline, (p, i) => fur * p[2] * 44 * s * (0.8 + 0.3 * noise(i * 0.9 + t * 11, 7)), 4, 0, 2.4);
  const body = polyPath(outline);
  fill(body, fcol);
  inside(body, () => {
    // shade where the body meets the floor or curves under; belly patch; stripes across the back
    const sh = B.p(L([-30, -6], [-20, -142], pose));
    ell(sh[0], sh[1], 120 * s * grow, (pose > 0.5 ? 16 : 26) * s, shcol, B.a(0));
    const bp = B.p(L([50, -128], [112, -178], pose));
    ell(bp[0], bp[1], 30 * s * grow, lerp(72, 44, pose) * s, o.colors?.belly ?? CAT.belly, B.a(lerp(-0.08, -0.35, pose)));
    const cen = B.p(L([-30, -100], [-20, -222], pose));
    for (const [a, b, u, len0] of [[4, 5, 0.6, 50], [5, 6, 0.45, 56], [6, 7, 0.3, 50], [3, 4, 0.5, 40]]) {
      const P = L(B.p(ctrl[a]), B.p(ctrl[b]), u), dx = cen[0] - P[0], dy = cen[1] - P[1], d = Math.hypot(dx, dy) || 1;
      const len = len0 * (1 - 0.45 * clamp(pose)), T = [-(dy / d), dx / d], w = 11 * s * grow * (1 - 0.3 * clamp(pose));
      fill(polyPath([[P[0] + T[0] * w - dx / d * 20, P[1] + T[1] * w - dy / d * 20], [P[0] - T[0] * w - dx / d * 20, P[1] - T[1] * w - dy / d * 20],
        [P[0] + dx / d * len * s, P[1] + dy / d * len * s]]), o.colors?.stripe ?? CAT.stripe);
    }
  });
  leg(legs.nearHind, fcol, 30);

  // —— head ——
  const hc = L(L(HEAD_SIT, HEAD_ARCH, pose), HEAD_LICK, lick);
  const bob = lick * Math.sin(TAU * ph);
  const tilt = (o.tilt ?? 0) + lick * (0.32 + 0.07 * bob) + pose * 0.12;
  const Hf = B.sub(hc[0], hc[1] - 5 * bob, tilt, (1 + 0.14 * clamp(pose, 0, 1.2)) / grow);
  const anchors = drawHead(Hf, o, { fur: fcol, t, s });
  anchors.tail = tipW;

  // —— near front leg: on the floor, or up at the mouth when licking ——
  if (lick > 0.01) {
    const sh = B.p(legs.nearFront[0]), floorPaw = B.p(legs.nearFront[1]);
    const mouth = Hf.p([0.62 * R * (o.turn ?? 0.55) + 0.32 * R, 0.5 * R]);
    const paw = L(floorPaw, [mouth[0] + 4 * face * s * Math.sin(TAU * ph), mouth[1] + 8 * s * Math.cos(TAU * ph)], ease3(lick));
    const elbow = L(L(sh, floorPaw, 0.5), [sh[0] + 46 * face * s, sh[1] - 30 * s], ease3(lick));
    limb([sh, elbow, paw], 30 * s, fcol);
    ell(paw[0], paw[1], 20 * s, 15 * s, fcol, B.a(-0.6 * lick));
    ell(paw[0] + 4 * face * s, paw[1] + 2 * s, 10 * s, 7 * s, CAT.inner, 0, lick);
  } else leg(legs.nearFront, fcol, 30);
  return anchors;
}
const ease3 = u => u * u * (3 - 2 * u);

// head in its own frame (x towards the face side): ears, cheeks with tufts, muzzle, eyes, nose, mouth, whiskers
function drawHead(F, o, { fur: fcol, t, s }) {
  const turn = o.turn ?? 0.55, blink = clamp(o.blink ?? 0), pupil = o.pupil ?? 1, look = o.look ?? [0.3, 0];
  const ears = o.ears ?? 0, hiss = o.mouth === 'hiss' ? clamp(o.hiss ?? 1, 0, 1.2) : 0, fur = o.fur ?? 0;
  const fx = 0.55 * R * turn, P = (x, y) => F.p([x, y]);
  // ears behind the head
  for (const side of [-1, 1]) {
    const base = [side * 0.58 * R + 0.16 * R * turn, -0.6 * R];
    const a = side * (0.2 + 1.05 * ears), h = (1 - 0.35 * ears) * R;
    const tri = [[-0.32 * R, 0.05 * R], [0.3 * R, 0.05 * R], [0.02 * R, -0.8 * h]].map(p => rot(p, a)).map(p => [p[0] + base[0], p[1] + base[1]]);
    fill(polyPath(F.pts(tri)), side > 0 && turn > 0.4 ? CAT.shade : fcol);
    const inn = [[-0.17 * R, 0], [0.15 * R, 0], [0.0, -0.55 * h]].map(p => rot(p, a)).map(p => [p[0] + base[0], p[1] + base[1]]);
    fill(polyPath(F.pts(inn)), CAT.inner);
  }
  // skull with cheek tufts
  let head = weighted(F.pts(HEAD.map(([x, y]) => [x * R, y * R])), HEAD_W, 9 * F.s);
  head = spiky(head, p => p[2] * (5 + 10 * fur) * F.s, 3, 0, 1.6);
  const hp = polyPath(head);
  fill(hp, fcol);
  inside(hp, () => {
    for (const k of [-1, 0, 1]) {                                   // forehead stripes
      const x = k * 0.22 * R + fx * 0.55;
      fill(polyPath(F.pts([[x - 0.07 * R, -0.95 * R], [x + 0.07 * R, -0.95 * R], [x, (-0.52 + 0.08 * Math.abs(k)) * R]])), CAT.stripe);
    }
    const ch = F.p([0, 0.95 * R]); ell(ch[0], ch[1], 0.9 * R * F.s, 0.32 * R * F.s, CAT.shade, F.ang);   // under the chin
  });
  // muzzle patch
  const mz = P(fx + 0.06 * R * turn, (0.38 - 0.06 * hiss) * R);
  ell(mz[0], mz[1], 0.42 * R * F.s, 0.3 * R * F.s, CAT.belly, F.ang);
  // eyes
  const eyes = [[fx - 0.36 * R * (1 - 0.25 * turn), 1], [fx + 0.36 * R * (1 - 0.55 * turn), 1 - 0.42 * turn]];
  for (const [ex, k] of eyes) {
    const c = P(ex, -0.05 * R), rx = 0.22 * R * k * F.s * (1 + 0.15 * hiss), ry = 0.26 * R * F.s * (1 + 0.1 * hiss);
    if (blink > 0.88) {
      const pts = F.pts([[ex - 0.22 * R * k, -0.06 * R], [ex, 0.03 * R], [ex + 0.22 * R * k, -0.06 * R]]);
      limb(pts, 0.055 * R * F.s, CAT.mouth);
      continue;
    }
    ell(c[0], c[1], rx, ry, CAT.iris, F.ang);
    const pc = P(ex + look[0] * 0.07 * R, -0.05 * R + look[1] * 0.07 * R);
    ell(pc[0], pc[1], lerp(0.035, 0.15, pupil) * R * k * F.s, 0.21 * R * F.s, CAT.pupil, F.ang);
    const hl = P(ex + 0.07 * R * k, -0.14 * R); ell(hl[0], hl[1], 0.045 * R * F.s, 0.045 * R * F.s, '#ffffff');
    if (blink > 0.01) {                                              // upper lid comes down in fur colour
      const lid = ellPath(c[0], c[1], rx * 1.06, ry * 1.06, F.ang);
      inside(lid, () => {
        const top = P(ex, -0.05 * R - 0.27 * R), cut = P(ex, -0.05 * R - 0.27 * R + 0.54 * R * blink);
        const d = [Math.sin(F.ang) * 200, -Math.cos(F.ang) * 200];
        fill(polyPath([[top[0] - 200 + d[0], top[1] + d[1]], [top[0] + 200 + d[0], top[1] + d[1]], [cut[0] + 200, cut[1]], [cut[0] - 200, cut[1]]]), fcol);
      });
    }
    if (hiss > 0.05 || o.brows) {                                    // angry brows
      const b = F.pts([[ex - 0.2 * R * k, -0.4 * R], [ex + 0.18 * R * k, -0.27 * R]]);
      limb(b, 0.07 * R * F.s, CAT.mouth, false);
    }
  }
  // nose, mouth
  const nx = fx + 0.06 * R * turn, ny = (0.2 - 0.05 * hiss) * R;
  fill(polyPath(F.pts([[nx - 0.1 * R, ny - 0.04 * R], [nx + 0.1 * R, ny - 0.04 * R], [nx, ny + 0.07 * R]])), CAT.nose);
  if (hiss > 0.02) {
    const h = 0.52 * R * hiss, top = ny + 0.1 * R;
    const m = F.pts([[nx - 0.28 * R, top], [nx + 0.28 * R, top], [nx + 0.2 * R, top + h], [nx - 0.2 * R, top + h]]);
    fill(smoothPath(m), CAT.mouth);
    const tg = P(nx, top + h * 0.8); ell(tg[0], tg[1], 0.16 * R * F.s, 0.08 * R * F.s, CAT.inner, F.ang);
    for (const sd of [-1, 1]) fill(polyPath(F.pts([[nx + sd * 0.24 * R, top - 0.01 * R], [nx + sd * 0.12 * R, top - 0.01 * R], [nx + sd * 0.17 * R, top + 0.24 * R * hiss]])), CAT.white);
  } else if (o.mouth === 'smile') {
    limb(F.pts([[nx - 0.17 * R, 0.27 * R], [nx - 0.08 * R, 0.33 * R], [nx, 0.27 * R], [nx + 0.08 * R, 0.33 * R], [nx + 0.17 * R, 0.27 * R]]), 0.045 * R * F.s, CAT.mouth);
  } else {
    limb(F.pts([[nx - 0.15 * R, 0.29 * R], [nx - 0.07 * R, 0.33 * R], [nx, 0.27 * R], [nx + 0.07 * R, 0.33 * R], [nx + 0.15 * R, 0.29 * R]]), 0.04 * R * F.s, CAT.mouth);
  }
  if ((o.tongue ?? 0) > 0.05) {
    const tg = P(nx + 0.22 * R * turn + 0.05 * R, 0.4 * R); ell(tg[0], tg[1], 0.13 * R * F.s * o.tongue, 0.08 * R * F.s, CAT.inner, F.ang + 0.4);
  }
  // whiskers
  const spread = 1 + 0.6 * hiss + 0.3 * fur;
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x0 = nx + sd * 0.26 * R, y0 = 0.32 * R + k * 0.06 * R;
    const len = (sd > 0 ? 1 - 0.35 * turn : 1) * 0.85 * R;
    const pts = F.pts([[x0, y0], [x0 + sd * len * 0.6, y0 - 0.04 * R + (k - 1) * 0.07 * R * spread], [x0 + sd * len, y0 - 0.02 * R + (k - 1) * 0.15 * R * spread]]);
    limb(pts, 2.6 * F.s, CAT.whisk);
  }
  return { head: P(0, 0), mouth: P(nx, 0.45 * R), eyes: eyes.map(([ex]) => P(ex, -0.05 * R)) };
}
