// The zombie in flat shapes: a hunched green lump in a torn purple shirt and brown trousers, arms out in front.
// Legs come from foot positions (two-bone IK), so the timeline only says where the feet and the hip are.
// Local units: he faces left (forward is -x), y up is negative, about 620 px tall at s = 1.
import { lerp, clamp } from './lib.js';
import { frame, ik, limb, ell, fill, polyPath, smoothPath, sample, inside } from './flat.js';

export const ZOM = {
  skin: '#8fbf7a', skinSh: '#6c9a5e', socket: '#5a8550', shirt: '#5b4b8a', shirtSh: '#45386c', pants: '#7a5a44', pantsSh: '#5c4333',
  shoe: '#1d1c3d', eye: '#fff3d6', pupil: '#17162f', mouth: '#3a1a33', tooth: '#f2ead0', hair: '#2f3d25', drool: '#c9f0d8',
};
export const THIGH = 135, SHIN = 132, UPPER = 112, FORE = 108;
const SHIRT_TOP = [[-42, 12], [-48, -60], [-50, -140], [-40, -200], [-16, -228], [20, -232], [44, -205], [52, -140], [48, -60], [40, 12]];
const SHIRT_HEM = [[30, 26], [18, 8], [6, 30], [-6, 10], [-18, 28], [-30, 8]];
const SKULL = [[-64, -26], [-56, -60], [-24, -76], [6, -70], [24, -78], [52, -58], [66, -14], [58, 26], [34, 40], [-18, 38], [-60, 18]];
const JAW = [[-58, 20], [32, 14], [46, 34], [26, 60], [-24, 60], [-54, 44]];
const HINGE = [30, 20];

// one arm in the frame F of its shoulder (local angles: pi points forward); sleeve: share of the upper arm in cloth
export function drawArm(F, { aU, aF, aH, sleeve = 0.6, shade = false, cut = false, stump = false }) {
  const skin = shade ? ZOM.skinSh : ZOM.skin, cloth = shade ? ZOM.shirtSh : ZOM.shirt;
  if (stump) {                                 // only a short sleeve with the torn shoulder left
    const e = F.p([Math.cos(aU) * 34, Math.sin(aU) * 34]);
    limb([F.p([0, 0]), e], 44 * F.s, cloth);
    ell(e[0], e[1], 15 * F.s, 15 * F.s, ZOM.mouth);
    return {};
  }
  const e = [Math.cos(aU) * UPPER, Math.sin(aU) * UPPER], w = [e[0] + Math.cos(aF) * FORE, e[1] + Math.sin(aF) * FORE];
  const S = F.p([0, 0]), E = F.p(e), Wp = F.p(w), s = F.s;
  limb([S, E, Wp], 32 * s, skin);
  const sl = F.p([e[0] * sleeve, e[1] * sleeve]);
  limb([S, sl], 42 * s, cloth);
  if (cut) {                                   // torn end at the shoulder of an arm that came off
    fill(polyPath(F.pts([[-8, -20], [6, -24], [2, -10], [12, -2], [0, 6], [8, 18], [-8, 20]])), ZOM.mouth);
  }
  const Hf = F.sub(w[0], w[1], aH);
  const hand = Hf.p([14, 0]);
  ell(hand[0], hand[1], 20 * s, 16 * s, skin, Hf.a(0));
  for (const [a, b] of [[[22, -9], [50, -14]], [[26, 0], [56, 2]], [[22, 9], [47, 15]], [[8, -12], [22, -24]]]) limb([Hf.p(a), Hf.p(b)], 10 * s, skin, false);
  return { shoulder: S, elbow: E, wrist: Wp, hand };
}

// o: hip [x, y], feet { near, far } (world, sole points), s, face (-1 left, 1 right), lean (forward, rad), headTilt,
//    arms { near, far }: { aU, aF, aH } local angles, armOff (near arm gone), carry (draws the lost arm in the far hand),
//    jaw (0…1), pop (eyes 0…1), look [x, y], hairUp (0…1), lid (0…1 droop of the near eye), drool (0…1 length)
export function drawZombie(o) {
  const s = o.s ?? 1, fx = o.face === 1 ? -1 : 1, lean = o.lean ?? 0.18;
  const T = frame(o.hip[0], o.hip[1], fx * -lean, s, fx);
  const bend = -fx;
  const legOf = (hipLocal, foot, shade) => {
    const hj = T.p(hipLocal), ankle = [foot[0], foot[1] - 18 * s];
    const knee = ik(hj, ankle, THIGH * s, SHIN * s, bend);
    const c = shade ? ZOM.pantsSh : ZOM.pants;
    limb([hj, knee], 50 * s, c, false);
    limb([knee, ankle], 42 * s, c, false);
    ell(ankle[0] - 20 * s * fx, ankle[1] + 9 * s, 34 * s, 15 * s, ZOM.shoe);
  };
  const arms = o.arms ?? {};
  const armNear = arms.near ?? { aU: Math.PI + lean, aF: Math.PI + lean - 0.15, aH: Math.PI + lean - 0.7 };
  const armFar = arms.far ?? { aU: Math.PI + lean + 0.1, aF: Math.PI + lean - 0.05, aH: Math.PI + lean - 0.6 };
  const anchors = {};

  // far arm, far leg, near leg, hips, shirt
  const farA = drawArm(T.sub(14, -212), { ...armFar, sleeve: 1.05, shade: true });
  anchors.farHand = farA.hand; anchors.farWrist = farA.wrist;
  if (o.carry) o.carry(farA);
  legOf([10, 2], o.feet.far, true);
  legOf([-8, 4], o.feet.near, false);
  fill(polyPath(T.pts([[-46, -30], [44, -30], [50, 30], [-48, 30]])), ZOM.pants);
  const shirt = polyPath([...T.pts(sample(SHIRT_TOP, 6, false)), ...T.pts(SHIRT_HEM)]);
  fill(shirt, ZOM.shirt);
  inside(shirt, () => {
    const b = T.p([46, -110]); ell(b[0], b[1], 26 * s, 130 * s, ZOM.shirtSh, T.a(0));
    fill(polyPath(T.pts([[-30, -132], [-12, -144], [-4, -128], [-14, -112], [-28, -116]])), ZOM.skinSh);   // a hole in the shirt
  });

  // neck and head
  const H = T.sub(-16, -286, -(o.headTilt ?? 0.12));
  limb([T.p([0, -214]), H.p([10, 30])], 34 * s, ZOM.skinSh, false);
  const jaw = clamp(o.jaw ?? 0, 0, 1.2), pop = o.pop ?? 0, look = o.look ?? [-0.6, 0.2];
  const mi = H.p([-20, 30 + 10 * jaw]); ell(mi[0], mi[1], 44 * s, (10 + 30 * jaw) * s, ZOM.mouth, H.a(-0.2 * jaw));
  // hair strands, standing up when scared
  for (const [bx, by, k] of [[-16, -72, 0], [4, -72, 1], [26, -78, 2]]) {
    const up = o.hairUp ?? 0, len = 30 + 22 * up;
    const tip = [bx + lerp(16 + 6 * k, -4 + 8 * (k - 1), up), by - len], mid = [bx + lerp(14, 0, up), by - len * 0.6];
    limb(H.pts([[bx, by + 6], mid, tip]), 5 * s, ZOM.hair);
  }
  const skull = smoothPath(H.pts(SKULL));
  fill(skull, ZOM.skin);
  inside(skull, () => {
    const b = H.p([62, 0]); ell(b[0], b[1], 30 * s, 80 * s, ZOM.skinSh, H.a(0));
    limb(H.pts([[-6, -60], [14, -52], [34, -40]]), 4 * s, ZOM.socket);                         // stitched scar
    for (const [x, y] of [[0, -58], [14, -52], [28, -44]]) limb(H.pts([[x - 4, y - 7], [x + 4, y + 7]]), 3.5 * s, ZOM.socket, false);
  });
  const nose = H.p([-66, 4]); ell(nose[0], nose[1], 12 * s, 10 * s, ZOM.skinSh, H.a(0));
  const ear = H.p([50, 6]); ell(ear[0], ear[1], 12 * s, 18 * s, ZOM.skinSh, H.a(0.2));
  for (const [x, y] of [[-46, 31], [-30, 33]]) fill(polyPath(H.pts([[x, y - 4], [x + 10, y - 4], [x + 9, y + 9], [x + 1, y + 9]])), ZOM.tooth);
  const J = H.sub(HINGE[0], HINGE[1], -0.62 * jaw);
  const jawPts = J.pts(JAW.map(([x, y]) => [x - HINGE[0], y - HINGE[1]]));
  fill(smoothPath(jawPts), ZOM.skin);
  fill(polyPath(J.pts([[-74, -2], [-62, -2], [-66, -14]])), ZOM.tooth);
  const chin = J.p([-80, 30]); anchors.mouth = J.p([-80, 14]); anchors.chin = chin;
  // eyes: big bulging near eye in a dark socket, small far eye
  for (const [ex, ey, rx, ry, pr, near] of [[-22, -14, 21, 23, 5.5, true], [-54, -18, 13, 17, 4.5, false]]) {
    const k = 1 + 0.55 * pop, c = H.p([ex, ey]);
    if (near) { const so = H.p([ex + 2, ey - 2]); ell(so[0], so[1], 28 * s, 30 * s, ZOM.socket, H.a(0)); }
    ell(c[0], c[1], rx * k * s, ry * k * s, ZOM.eye, H.a(0));
    const pc = H.p([ex + look[0] * rx * 0.45, ey + look[1] * ry * 0.45]);
    ell(pc[0], pc[1], pr * (1 - 0.35 * pop) * s, pr * (1 - 0.35 * pop) * s, ZOM.pupil);
    const lid = (o.lid ?? 0.35) * (1 - pop) * (near ? 1 : 1.3);
    if (lid > 0.02) {
      const cap = H.pts([[ex - rx * 1.25, ey - ry * 1.3], [ex + rx * 1.25, ey - ry * 1.3], [ex + rx * 1.25, ey - ry + 2 * ry * lid], [ex - rx * 1.25, ey - ry + 2 * ry * lid]]);
      inside(polyPath(H.pts(sample([[ex - rx, ey], [ex, ey - ry], [ex + rx, ey], [ex, ey + ry]], 6).map(p => p))), () => fill(polyPath(cap), ZOM.skin));
    }
  }
  anchors.head = H.p([0, 0]);
  const drool = o.drool ?? 0;
  if (drool > 0.01) {
    const a = anchors.mouth, len = 70 * drool * s;
    limb([a, [a[0], a[1] + len]], 7 * s, ZOM.drool, false);
    ell(a[0], a[1] + len, 9 * s, 11 * s, ZOM.drool);
  }

  // near arm (or the torn shoulder)
  const nearF = T.sub(-6, -208);
  if (!o.armOff) {
    const a = drawArm(nearF, { ...armNear, sleeve: 0.55 });
    anchors.nearHand = a.hand; anchors.nearWrist = a.wrist;
  } else {
    drawArm(nearF, { aU: Math.PI * 0.62, stump: true });
  }
  anchors.nearShoulder = nearF.p([0, 0]);
  anchors.T = T;
  return anchors;
}
