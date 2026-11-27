// Пурга: the hunter's laika in flat shapes. Grey saddle over a white dog, pricked ears, a ring tail over the back, a black
// nose. One rig: stand → sit (sit) → sit up and beg (beg), walking (walk + phase), the head tilts, the ears go back, the
// tail wags, the mouth pants, and in the dark she holds a torch across her jaws (torch: returns where its lens is and
// which way it shines). Local units: she faces right, origin on the floor under her middle, y up is negative.
import { lerp, clamp, TAU } from './lib.js';
import { frame, sample, tube, smoothPath, polyPath, fill, ell, limb, lerpPts, inside, rot } from './flat.js';

export const DOG = {
  coat: '#f4efe6', coatSh: '#d8d0c2', saddle: '#8f877c', saddleSh: '#756e65', nose: '#17162f', eye: '#17162f', inner: '#e8a3a0',
  tongue: '#e8687a', mouth: '#3a1a24', torch: '#2b3346', torchHi: '#55607a', lens: '#ffe7a8', collar: '#d9433b', tag: '#ffd23f',
};
const L2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
// body outlines: standing, sitting (rump on the floor, chest up), sitting up on the haunches (beg)
const BODY = {
  stand: [[134, -150], [104, -98], [20, -102], [-62, -110], [-128, -118], [-140, -160], [-120, -192], [-40, -200], [60, -206], [118, -204]],
  sit: [[112, -150], [92, -110], [40, -70], [-20, -30], [-96, -24], [-118, -70], [-100, -130], [-30, -176], [40, -214], [96, -220]],
  beg: [[70, -190], [64, -140], [40, -90], [0, -34], [-80, -26], [-100, -70], [-84, -140], [-40, -220], [10, -268], [62, -262]],
};
const SADDLE = { stand: [-30, -205, 120, 34], sit: [-20, -180, 100, 40], beg: [-20, -220, 60, 70] };
const HEAD = { stand: [150, -250], sit: [124, -276], beg: [86, -326] };
const TAILR = { stand: [-126, -178], sit: [-104, -120], beg: [-88, -110] };
const SHOULDER = { stand: [84, -138], sit: [72, -140], beg: [44, -190] };
const HIP = { stand: [-92, -136], sit: [-62, -62], beg: [-50, -62] };
const NECK = { stand: [104, -180], sit: [76, -190], beg: [34, -240] };

function pose3(o, key) {
  const sit = clamp(o.sit ?? 0), beg = clamp(o.beg ?? 0), A = key.stand, B = key.sit, C = key.beg;
  const lerpV = (a, b, t) => (Array.isArray(a[0]) ? lerpPts(a, b, t) : a.map((v, i) => lerp(v, b[i], t)));
  return lerpV(lerpV(A, B, sit), C, beg);
}
// o: x, y (floor point), s, face (1 right / -1 left), sit, beg, walk (0…1) + ph (step phase, cycles), t (breathing),
//    tilt (head, rad), headDy, ears (0 up … 1 back), blink, mouth (0 shut … 1 panting), tongue, wag (0…1) + wagPh,
//    torch (true: a torch in her jaws), look (-1 down … 1 up, the head pitches), glint (eye shine in the dark).
// Returns { head, nose, lens, beamAng, tail }.
export function drawDog(o) {
  const s = o.s ?? 1, face = o.face ?? 1, t = o.t ?? 0, walk = clamp(o.walk ?? 0), ph = (o.ph ?? 0) * TAU;
  const breathe = 1 + 0.018 * Math.sin(t * 5.2) * (1 - walk);
  const bob = walk * 6 * Math.abs(Math.sin(ph));
  const B = frame(o.x, o.y - bob * s, o.rot ?? 0, s, face, 1, breathe);
  const sit = clamp(o.sit ?? 0), beg = clamp(o.beg ?? 0), up = Math.max(sit, beg);
  const out = {};

  // —— legs: far pair first, in the shade tone ——
  const sh = pose3(o, SHOULDER), hp = pose3(o, HIP);
  const stride = (k) => walk * 44 * Math.sin(ph + k), lift = (k) => walk * 22 * Math.max(0, Math.cos(ph + k));
  const frontLeg = (dx, k, c, w) => {
    const S0 = [sh[0] + dx, sh[1]];
    let paw = [sh[0] + 10 + dx * 0.4 + stride(k), -lift(k)];
    if (beg > 0.01) paw = L2(paw, [sh[0] + 46 + dx * 0.3, sh[1] - 26 + dx * 0.2], beg);
    const knee = L2([lerp(S0[0], paw[0], 0.5) + 6, lerp(S0[1], paw[1], 0.55)], [S0[0] + 40, S0[1] + 30], beg);
    limb(B.pts([S0, knee, paw]), w * s, c);
    const p = B.p(paw); fill(smoothPath(B.pts([[paw[0] - 14, paw[1] - 6], [paw[0] + 20, paw[1] - 8], [paw[0] + 24, paw[1] + 2], [paw[0] - 14, paw[1] + 2]])), c);
    return p;
  };
  const hindLeg = (dx, k, c, w) => {
    const H0 = [hp[0] + dx, hp[1]];
    if (up > 0.5) {                                  // folded under: a haunch and a paw in front of it
      ell(B.p(H0)[0], B.p(H0)[1], 58 * s, 50 * s, c, B.a(-0.2));
      const paw = [hp[0] + 52 + dx * 0.5, -6];
      fill(smoothPath(B.pts([[paw[0] - 34, paw[1] - 8], [paw[0] + 22, paw[1] - 10], [paw[0] + 26, paw[1] + 6], [paw[0] - 34, paw[1] + 6]])), c);
      return;
    }
    const paw = [hp[0] + 8 + dx * 0.4 - stride(k), -lift(k)];
    const knee = [hp[0] + 30 + dx * 0.3, -86], hock = [paw[0] - 22, -40];
    limb(B.pts([H0, knee]), (w + 14) * s, c, false);
    limb(B.pts([knee, hock, paw]), w * s, c);
    fill(smoothPath(B.pts([[paw[0] - 14, paw[1] - 6], [paw[0] + 20, paw[1] - 8], [paw[0] + 24, paw[1] + 2], [paw[0] - 14, paw[1] + 2]])), c);
  };
  hindLeg(14, Math.PI, DOG.coatSh, 26);
  frontLeg(-16, 0, DOG.coatSh, 26);

  // —— body with the grey saddle ——
  const ctrl = pose3(o, BODY);
  const body = smoothPath(B.pts(ctrl));
  fill(body, DOG.coat);
  inside(body, () => {
    const sd = pose3(o, SADDLE), c = B.p([sd[0], sd[1]]);
    ell(c[0], c[1], sd[2] * 1.5 * s, sd[3] * 1.6 * s, DOG.saddle, B.a(lerp(0, -0.7, up)));
    const u = B.p([10, lerp(-96, -40, up)]); ell(u[0], u[1], 110 * s, 22 * s, DOG.coatSh, B.a(lerp(0, -0.5, up)));
  });

  // —— near legs ——
  hindLeg(-10, 0, DOG.coat, 28);
  frontLeg(10, Math.PI, DOG.coat, 28);

  // —— tail: a ring over the back, wagging from its root ——
  const root = pose3(o, TAILR), wagA = (o.wag ?? 0) * 0.32 * Math.sin((o.wagPh ?? 0) * TAU);
  const curl = [[0, 0], [-30, -44], [-6, -100], [48, -98], [60, -54], [28, -36]].map(p => rot([root[0] + p[0], root[1] + p[1]], wagA - 0.15 * up, root));
  const tc = sample(B.pts(curl), 8, false);
  fill(smoothPath(tube(tc, u => s * lerp(46, 22, u))), DOG.saddle);
  fill(smoothPath(tube(tc.slice(0, Math.floor(tc.length * 0.85)), u => s * lerp(24, 10, u))), DOG.coatSh);
  out.tail = B.p(curl[curl.length - 1]);

  // —— neck (grey nape, white throat) and the collar with its tag ——
  const hc = pose3(o, HEAD), nb = pose3(o, NECK), pitch = -(o.look ?? 0) * 0.35;
  const hd = [hc[0], hc[1] + (o.headDy ?? 0)];
  limb([B.p(nb), B.p([hd[0] - 14, hd[1] + 6])], 80 * s, DOG.saddle, false);
  limb([B.p([nb[0] + 22, nb[1] + 30]), B.p([hd[0] + 6, hd[1] + 34])], 52 * s, DOG.coat, false);
  const nk = B.p(L2([nb[0] - 16, nb[1] - 26], [hd[0] - 30, hd[1] - 8], 0.45)), nk2 = B.p(L2([nb[0] + 34, nb[1] + 22], [hd[0] + 4, hd[1] + 44], 0.45));
  limb([nk, nk2], 16 * s, DOG.collar, false);
  const tg = L2(nk, nk2, 0.9); ell(tg[0] + 4 * s * face, tg[1] + 10 * s, 9 * s, 9 * s, DOG.tag);

  // —— head ——
  const Hf = B.sub(hc[0], hc[1] + (o.headDy ?? 0), (o.tilt ?? 0) + pitch, 1);
  const P = (x, y) => Hf.p([x, y]);
  const ears = clamp(o.ears ?? 0);
  const ear = (bx, c, cin) => {
    const tip = rot([bx + 4, -112], -1.1 * ears, [bx, -36]);
    fill(polyPath(Hf.pts([[bx - 26, -30], [bx + 22, -40], tip])), c);
    const tin = rot([bx + 2, -92], -1.1 * ears, [bx, -36]);
    fill(polyPath(Hf.pts([[bx - 12, -38], [bx + 10, -44], tin])), cin);
  };
  ear(-16, DOG.saddleSh, DOG.saddleSh);                 // far ear
  const skull = smoothPath(Hf.pts([[-54, -6], [-44, -40], [0, -54], [40, -42], [58, -12], [52, 26], [10, 44], [-40, 36]]));
  fill(skull, DOG.saddle);
  // the white mask: muzzle, cheeks and a stripe up the forehead
  const mask = smoothPath(Hf.pts([[-20, 40], [-30, 14], [6, -2], [14, -40], [26, -40], [34, -6], [70, -6], [100, 2], [104, 18], [82, 36], [30, 46]]));
  fill(mask, DOG.coat);
  inside(mask, () => { const c = P(30, 46); ell(c[0], c[1], 60 * s, 14 * s, DOG.coatSh, Hf.ang); });
  ear(24, DOG.saddle, DOG.inner);                       // near ear
  // jaw: shut, panting, or round a torch
  const mo = clamp(o.mouth ?? 0), torch = !!o.torch;
  const jawOpen = torch ? 0.35 : mo * 0.6;
  const jaw = smoothPath(Hf.pts([[20, 30], [70, 26 + 10 * jawOpen], [96, 22 + 18 * jawOpen], [92, 36 + 20 * jawOpen], [60, 44 + 14 * jawOpen], [24, 44]]));
  if (jawOpen > 0.05) fill(polyPath(Hf.pts([[40, 24], [98, 18], [92, 30 + 20 * jawOpen], [40, 36]])), DOG.mouth);
  if ((o.tongue ?? mo) > 0.15 && !torch) { const tp = P(64, 40 + 16 * jawOpen + 4 * Math.sin(t * 9)); ell(tp[0], tp[1], 14 * s, 20 * s * (o.tongue ?? mo), DOG.tongue, Hf.ang + 0.2); }
  fill(jaw, DOG.coat);
  // nose and eye
  const nz = P(100, 8); ell(nz[0], nz[1], 14 * s, 11 * s, DOG.nose, Hf.ang);
  const blink = clamp(o.blink ?? 0), ec = P(30, -16);
  if (blink < 0.9) {
    ell(ec[0], ec[1], 9 * s, 10.5 * s * (1 - blink), DOG.eye, Hf.ang);
    const hl = P(33, -20); ell(hl[0], hl[1], (o.glint ? 4.5 : 3) * s, (o.glint ? 4.5 : 3) * s, o.glint ? '#fff7d0' : '#ffffff');
  } else limb(Hf.pts([[22, -14], [38, -14]]), 4 * s, DOG.eye, false);
  if (o.brow != null) limb(Hf.pts([[20, -34 - 6 * o.brow], [42, -32 + 4 * o.brow]]), 5 * s, DOG.saddleSh, false);
  out.head = P(0, 0); out.nose = nz; out.mouth = P(80, 30);
  // the torch across the jaws, shining forward along the head
  if (torch) {
    const a = Hf.ang + (face < 0 ? Math.PI : 0), c0 = P(40, 28), c1 = P(124, 26);
    limb([c0, c1], 22 * s, DOG.torch, false);
    limb([P(48, 21), P(118, 20)], 6 * s, DOG.torchHi, false);
    const lens = P(132, 26); ell(lens[0], lens[1], 9 * s, 15 * s, o.torchOff ? '#6b7280' : DOG.lens, Hf.ang);
    out.lens = lens; out.beamAng = a;
    // the near lip over it
    fill(smoothPath(Hf.pts([[30, 20], [62, 18], [76, 26], [60, 34], [30, 32]])), DOG.coat);
  }
  return out;
}
