// Channel avatar in the look of the flat «Как выжить» cartoons: the hunter (ушанка, beard) and his laika Пурга, drawn with
// the same code as the episodes (../../shorts/submarine-flat/src), big in the frame, smiling at the viewer, a thumbs up,
// a white sticker outline so they stand off a bright background. Platforms crop an avatar to a circle, so everything
// that matters stays inside it, and it has to read at 48 px in comments.
// usage: node avatar.mjs <out dir>      → avatar-<variant>.png (800×800) and preview.png (circles at 400, 98 and 48 px)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EP = path.join(ROOT, '../../shorts/submarine-flat');
const { createCanvas, GlobalFonts } = createRequire(path.join(EP, 'package.json'))('@napi-rs/canvas');
const { setCtx, MONO, fill, ell, inside, limb, polyPath, smoothPath } = await import(path.join(EP, 'src/flat.js'));
const { drawHunter, framesOf, HUN } = await import(path.join(EP, 'src/hunter.js'));
const { drawDog } = await import(path.join(EP, 'src/dog.js'));
const { TAU } = await import(path.join(EP, 'src/lib.js'));
for (const [f, n] of [['Oswald-700.ttf', 'Oswald'], ['RussoOne.ttf', 'Russo'], ['InterDisplay-Black.otf', 'InterBlack']])
  GlobalFonts.registerFromPath(path.join(EP, 'fonts', f), n);

const N = 800, C = N / 2;
const out = process.argv[2] ?? path.join(ROOT, 'out');
fs.mkdirSync(out, { recursive: true });

// the backgrounds: two tones of rays from behind his head, a darker rim where the circle ends
const BG = {
  sun: { a: '#ffd23f', b: '#ffc21a', rim: '#f2a516' },
  sea: { a: '#3fc6e0', b: '#2fb3cf', rim: '#1f8fb0' },
  coral: { a: '#ff7a59', b: '#ff6a47', rim: '#e04f33' },
};
function rays(bg, cx, cy) {
  g.fillStyle = bg.a; g.fillRect(0, 0, N, N);
  const n = 18;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    fill(polyPath([[cx, cy], [cx + Math.cos(a0) * 1400, cy + Math.sin(a0) * 1400], [cx + Math.cos(a1) * 1400, cy + Math.sin(a1) * 1400]]), bg.b);
  }
  g.save(); g.lineWidth = 46; g.strokeStyle = bg.rim; g.beginPath(); g.arc(C, C, C - 4, 0, TAU); g.stroke(); g.restore();
}

// a character twice: first as a white silhouette nudged round in a ring (the sticker edge), then itself on top
function sticker(draw, w = 14) {
  MONO.on = true; MONO.color = '#ffffff';
  for (let k = 0; k < 16; k++) { g.save(); g.translate(Math.cos(k / 16 * TAU) * w, Math.sin(k / 16 * TAU) * w); draw(); g.restore(); }
  MONO.on = false;
  draw();
}

// the hunter from the chest up, facing right with his eye on us, a wide open smile, a thumbs up held out past his beard.
// The episodes give him only an «o» mouth, so the smile, a glint in the eye and a blush are drawn over his face here
// (head-local units, the front of the face at −x), before his near arm.
function smile(A, s, look) {
  const H = A.H, hs = s * 1.25, arc = [];
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; arc.push([-38 + 25 * Math.cos(a), 13 + 31 * Math.sin(a)]); }
  const m = polyPath(H.pts([[-63, 14], [-13, 11], ...arc]));
  fill(m, HUN.mouth);
  inside(m, () => {
    fill(polyPath(H.pts([[-66, 6], [-10, 4], [-10, 22], [-66, 24]])), '#ffffff');
    const tg = H.p([-36, 44]); ell(tg[0], tg[1], 15 * hs, 10 * hs, HUN.tongue, H.a(0));
  });
  fill(smoothPath(H.pts([[-74, 10], [-60, 0], [-40, 6], [-22, 2], [-12, 12], [-30, 14], [-50, 10], [-66, 18]])), HUN.beardSh);
  const nz = H.p([-64, -2]); ell(nz[0], nz[1], 20 * hs, 17 * hs, HUN.nose, H.a(0));
  const bl = H.p([-16, -2]); ell(bl[0], bl[1], 13 * hs, 8 * hs, '#ff8f7a', H.a(0), 0.55);
  const gl = H.p([-34 + look[0] * 6 - 2.5, -22 + look[1] * 7 - 3]); ell(gl[0], gl[1], 2.4 * hs, 2.4 * hs, '#ffffff');
}
// a thumbs up that reads at 48 px: a chunky fist with the curled fingers towards us and a thick thumb straight up. The
// episodes' 'thumb' hand is a thin thumb on a small fist, which in a circle reads as a raised index finger.
function thumbsUp(W, s, tilt = -0.12) {
  const c = Math.cos(tilt), sn = Math.sin(tilt), P = ([x, y]) => [W[0] + (x * c - y * sn) * s, W[1] + (x * sn + y * c) * s];
  const fist = smoothPath([[-30, -30], [26, -34], [40, -18], [40, 26], [24, 38], [-28, 36], [-38, 20], [-38, -18]].map(P));
  fill(fist, HUN.skin);
  inside(fist, () => {
    const d = P([-30, 22]); ell(d[0], d[1], 30 * s, 22 * s, HUN.skinSh, tilt);
    for (const y of [-12, 4, 20]) limb([P([0, y]), P([38, y + 1])], 5 * s, HUN.skinSh, false);
  });
  limb([P([-22, -18]), P([-24, -78])], 30 * s, HUN.skin, false);
  const n = P([-24, -84]); ell(n[0], n[1], 9 * s, 7 * s, '#f8d4b6', tilt);
}
function hunter({ x, y, s, hand = 'thumb', look = [0.05, 0.1], tilt = 0.06 }) {
  const o = { s, face: 1, hip: [x, y], feet: { near: [x, y + 400], far: [x, y + 400] }, legs: false, lean: 0.02, headTilt: tilt,
    jacket: true, pack: false, brow: 0.45, pop: 0.2, lid: 0, blink: 0, look, mouth: 0, flaps: 0, faceProp: A => smile(A, s, look) };
  const F = framesOf(o), sh = F.T.p([-14, -192]);
  const far = { p: [sh[0] + 20 * s, sh[1] + 300 * s], shape: 'fist' };   // hangs down out of the frame
  if (hand === 'thumb') {
    o.hands = { near: { p: [sh[0] + 140 * s, sh[1] - 20 * s], shape: 'bare', bend: -1 }, far };
    o.propNear = (hf, arm) => thumbsUp([arm.wrist[0] + 14 * s, arm.wrist[1] - 26 * s], s * 1.05);
  } else if (hand === 'wave') {
    o.hands = { near: { p: [sh[0] + 140 * s, sh[1] - 120 * s], shape: 'open', ang: -Math.PI / 2 - 0.25, bend: -1 }, far };
  } else o.hands = { near: { p: [sh[0] + 60 * s, sh[1] + 130 * s], shape: 'fist' }, far };
  return drawHunter(o);
}
function dog({ x, y, s, face = 1, look = 0.35 }) {
  return drawDog({ x, y, s, face, sit: 1, t: 0.3, mouth: 0.8, tongue: 1, look, blink: 0, wag: 0, tilt: -0.12, ears: 0, glint: 1 });
}

// the pair: Пурга on the left with her tongue out, looking up at him; he smiles at us with a thumbs up
function duo(bg) {
  rays(bg, 400, 330);
  sticker(() => dog({ x: 10, y: 790, s: 1.2, face: 1, look: 0.4 }));
  sticker(() => hunter({ x: 395, y: 880, s: 1.38 }));
}
const VARIANTS = {
  duo_sun: () => duo(BG.sun),          // A · sunny yellow, the brightest in a feed
  duo_sea: () => duo(BG.sea),          // B · sea blue, the submarine episode's colour
  solo_coral: () => {                  // C · the hunter alone, bigger, on coral
    rays(BG.coral, 380, 330);
    sticker(() => hunter({ x: 310, y: 1010, s: 1.7 }));
  },
};

const canvas = createCanvas(N, N), ctx = canvas.getContext('2d'), g = ctx;          // flat.js draws on the same context
setCtx(ctx);
const files = [];
const only = process.argv[3]?.split(',');
for (const [name, draw] of Object.entries(VARIANTS)) {
  if (only && !only.includes(name)) continue;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  draw();
  const f = path.join(out, `avatar-${name}.png`);
  fs.writeFileSync(f, canvas.encodeSync('png'));
  files.push([name, f]);
}

// the preview: each variant as the platforms show it, a circle at 400, 98 and 48 px, on a light and a dark page
const { loadImage } = createRequire(path.join(EP, 'package.json'))('@napi-rs/canvas');
const PW = 1500, row = 470, P = createCanvas(PW, row * files.length * 1), pc = P.getContext('2d');
setCtx(pc);
pc.fillStyle = '#ffffff'; pc.fillRect(0, 0, PW, P.height); pc.fillStyle = '#0f0f0f'; pc.fillRect(PW / 2 + 160, 0, PW / 2 - 160, P.height);
for (let i = 0; i < files.length; i++) {
  const img = await loadImage(files[i][1]), y0 = i * row + 20;
  const circle = (x, y, d) => { pc.save(); pc.beginPath(); pc.arc(x + d / 2, y + d / 2, d / 2, 0, TAU); pc.clip(); pc.drawImage(img, x, y, d, d); pc.restore(); };
  circle(20, y0, 420);
  for (const [k, bgx] of [[0, 480], [1, PW / 2 + 200]]) {
    circle(bgx, y0 + 40, 98); circle(bgx + 130, y0 + 65, 48); circle(bgx + 200, y0 + 77, 24);
    pc.font = '700 30px Oswald'; pc.fillStyle = k ? '#f1f1f1' : '#0f0f0f'; pc.fillText(files[i][0], bgx, y0 + 200);
  }
}
fs.writeFileSync(path.join(out, 'preview.png'), P.encodeSync('png'));
console.log(files.map(f => f[1]).join('\n'), '\n', path.join(out, 'preview.png'));
