// The places of «Тонкий лёд» in flat shapes, straight in screen space (y down, px at s = 1): the frozen lake on a bright
// winter day (sky, the far shore with snowy pines, the ice with snow patches, far fishermen at their holes, cracks running
// out from under your feet), the ice cut open from the side (the sheet, the hole, the dark water), the STOP map seen from
// above (your footprints from the shore, the hole, thin ice further on), and the 1999 story: snowy mountains, a skier,
// skis and two friends at a hole, the thermometer, the heart monitor.
import { lerp, clamp, TAU, hash } from './lib.js';
import { g, ell, limb, rect, rrect, fill, poly, smoothPath, polyPath, rrPath, inside } from './flat.js';
import { person } from './story.js';

export const SHORE = 760;          // the far shore line, looking over the lake
export const ICE = 1180;           // the top of the ice sheet in the cut-open view
export const THICK = 70;           // how thick the ice is there
function grad(stops, y0 = 0, y1 = 1920, x0 = 0, x1 = 1080) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); }

export function pine(x, y, s, c = '#2f5a46') {
  for (let k = 0; k < 4; k++) { const w = (90 - k * 18) * s, yy = y - k * 46 * s; poly([[x - w, yy], [x, yy - 90 * s], [x + w, yy]], c); poly([[x - w * 0.8, yy - 4 * s], [x, yy - 70 * s], [x + w * 0.2, yy - 30 * s]], '#f4fbff', 0.85); }
  rect(x - 8 * s, y, 16 * s, 26 * s, '#5a4632');
}
function sky(t, bottom = SHORE + 20) {
  grad([[0, '#9fd2f0'], [1, '#eaf6fb']], 0, bottom);
  ell(820, 250, 70, 70, '#fffbe6'); ell(820, 250, 120, 120, 'rgba(255,251,230,0.3)');
  for (let i = 0; i < 3; i++) { const cx = (i * 380 + t * 6) % 1400 - 160, cy = 140 + 100 * (i % 2); ell(cx, cy, 120, 32, 'rgba(255,255,255,0.85)'); ell(cx + 60, cy - 16, 70, 28, 'rgba(255,255,255,0.85)'); }
}

// —— the frozen lake on a bright day; o.cracks: [{x, y, k (0…1 how far they ran), seed}], o.fishers: true ——
export function lake(t, o = {}) {
  sky(t);
  grad([[0, '#f4fbff'], [1, '#e2eef4']], SHORE - 40, SHORE + 30);
  for (let i = 0; i < 16; i++) pine(-20 + i * 74 + 20 * hash(i), SHORE + 8, 0.42 + 0.18 * hash(i * 3), i % 3 ? '#2f5a46' : '#264c3c');
  grad([[0, '#e4f2f8'], [0.4, '#c9e5f1'], [1, '#a7d2e6']], SHORE + 20, 1920);
  for (let i = 0; i < 14; i++) { const y = SHORE + 60 + 1100 * hash(i * 2.3) ** 1.4, k = lerp(0.3, 1.6, (y - SHORE) / 1160); ell(1080 * hash(i * 1.7), y, 160 * k, 26 * k, 'rgba(255,255,255,0.75)'); }
  for (let i = 0; i < 8; i++) { const y = SHORE + 80 + 900 * hash(i * 5.1 + 1) ** 1.3, k = lerp(0.3, 1.6, (y - SHORE) / 1160), x = 1080 * hash(i * 3.3 + 2); limb([[x - 120 * k, y], [x + 120 * k, y + 6 * k]], 3 * k, 'rgba(120,170,200,0.5)', false); }
  if (o.fishers !== false) for (const [x, y, sd] of [[180, SHORE + 70, 1], [520, SHORE + 60, 2], [880, SHORE + 90, 4]]) {
    const s = 0.12; ell(x + 30, y + 4, 14, 5, '#3a5a6a'); rect(x - 16, y - 40, 32, 30, '#6a5a4a');
    person({ x, y: y - 34, s, seed: sd, view: 'side', face: 1, shirt: ['#d9433b', '#3a6aa8', '#e0a030'][sd % 3], hat: '#3a3a44' });
    limb([[x + 20, y - 90], [x + 60, y - 110], [x + 34, y + 2]], 2, '#2a2a2a', false);
  }
  for (const c of o.cracks ?? []) crack(c.x, c.y, c.k, c.seed ?? 0, c.s ?? 1);
}
// cracks running out from (x, y): jagged dark lines with a light edge; k = how far they have run
export function crack(x, y, k, seed = 0, s = 1) {
  if (k <= 0.01) return;
  for (let j = 0; j < 7; j++) {
    const a = (j / 7) * TAU + 0.6 * hash(seed + j), L = (120 + 160 * hash(seed * 3 + j)) * s * k;
    const pts = [[x, y]]; let px = x, py = y;
    for (let i = 1; i <= 5; i++) { const u = i / 5; px = x + Math.cos(a) * L * u + 18 * s * (hash(seed + j * 7 + i) - 0.5); py = y + Math.sin(a) * L * u * 0.38 + 10 * s * (hash(seed + j * 5 + i * 3) - 0.5); pts.push([px, py]); }
    limb(pts, 7 * s, 'rgba(40,80,110,0.85)', false); limb(pts.map(([a1, b1]) => [a1 + 2, b1 - 3]), 2.5 * s, 'rgba(255,255,255,0.9)', false);
    if (j % 2 === 0 && k > 0.5) { const m = pts[3]; limb([m, [m[0] + 50 * s * Math.cos(a + 0.9), m[1] + 20 * s * Math.sin(a + 0.9)]], 4 * s, 'rgba(40,80,110,0.7)', false); }
  }
  ell(x, y, 40 * s * k, 12 * s * k, 'rgba(60,110,140,0.35)');
}

// —— the ice cut open from the side: snow and sky above, the sheet, the hole from hx0 to hx1, the dark water below ——
export function iceSection(t, hx0 = 560, hx1 = 780) {
  sky(t, 990);
  for (let i = 0; i < 12; i++) pine(-30 + i * 100 + 30 * hash(i * 2), 980, 0.5 + 0.2 * hash(i), i % 2 ? '#2f5a46' : '#264c3c');
  grad([[0, '#f4fbff'], [1, '#dcebf2']], 960, ICE);
  grad([[0, '#2a6d92'], [1, '#0d2c44']], ICE + THICK - 6, 1920);
  for (let i = 0; i < 10; i++) { const x = (i * 130 + t * 14) % 1180 - 50; limb([[x, ICE + THICK + 60 + 80 * (i % 4)], [x + 60, ICE + THICK + 64 + 80 * (i % 4)]], 4, 'rgba(255,255,255,0.12)', false); }
  // the sheet, both sides of the hole, with a bluish edge where it is cut
  for (const [x0, x1] of [[-20, hx0], [hx1, 1100]]) {
    rect(x0, ICE, x1 - x0, THICK, '#cfe8f4'); rect(x0, ICE, x1 - x0, 14, '#ffffff'); rect(x0, ICE + THICK - 10, x1 - x0, 10, '#9fc8dc');
    for (let i = 0; i < 6; i++) { const x = lerp(x0, x1, (i + 0.5) / 6); limb([[x, ICE + 20], [x + 24, ICE + THICK - 16]], 3, 'rgba(255,255,255,0.6)', false); }
  }
  // the water in the hole, level with the top of the sheet
  rect(hx0, ICE + 12, hx1 - hx0, THICK, '#2a6d92');
  for (let i = 0; i < 5; i++) ell(lerp(hx0 + 20, hx1 - 20, hash(i * 3 + Math.floor(t * 2))), ICE + 14, 16, 5, 'rgba(255,255,255,0.7)');
}
// the water in front of a body in the hole (drawn after the body): the surface line and the sheet edges again
export function waterOver(t, hx0, hx1, a = 0.78) {
  g.save(); g.globalAlpha = a; grad([[0, '#2a6d92'], [1, '#0d2c44']], ICE + 16, 1920, hx0 - 2, hx1 + 2); g.restore();
  limb([[hx0, ICE + 16 + 3 * Math.sin(t * 3)], [hx1, ICE + 16 + 3 * Math.sin(t * 3 + 1)]], 6, 'rgba(255,255,255,0.8)', false);
  for (const [x0, x1] of [[hx0 - 30, hx0], [hx1, hx1 + 30]]) { rect(x0, ICE, x1 - x0, THICK, '#cfe8f4'); rect(x0, ICE, x1 - x0, 14, '#ffffff'); }
}

// —— the STOP map, from above: the shore at the bottom, your footprints out to the hole, thin ice further on ——
export function iceMap(t, k, o = {}) {
  if (k <= 0.01) return;
  g.save(); g.translate(540, 760); g.scale(k, k); g.rotate(-0.02);
  const w = 860, h = 680;
  rrect(-w / 2 + 10, -h / 2 + 12, w, h, 32, 'rgba(0,0,0,0.45)');
  g.save(); g.clip(rrPath(-w / 2, -h / 2, w, h, 32));
  rect(-w / 2, -h / 2, w, h, '#cfe8f4');
  fill(smoothPath([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, -h / 2 + 260], [200, -h / 2 + 300], [-100, -h / 2 + 240], [-w / 2, -h / 2 + 280]]), '#9cc6dc');     // thin ice, darker
  g.fillStyle = '#4a7a96'; g.font = '700 30px Oswald'; g.textAlign = 'center'; g.fillText('ТОНКИЙ ЛЁД', 240, -h / 2 + 90);
  rect(-w / 2, h / 2 - 150, w, 150, '#f4fbff');                       // the shore
  for (let i = 0; i < 9; i++) { const x = -w / 2 + 50 + i * 100; ell(x, h / 2 - 50, 34, 34, '#2f5a46'); ell(x - 6, h / 2 - 58, 14, 10, '#f4fbff'); }
  g.fillStyle = '#2f5a46'; g.font = '700 30px Oswald'; g.fillText('БЕРЕГ', 0, h / 2 - 104);
  // your footprints from the shore to the hole
  const hole = [40, -30];
  for (let i = 0; i < 9; i++) { const u = i / 9, x = lerp(-120, hole[0], u), y = lerp(h / 2 - 150, hole[1] + 70, u); ell(x + (i % 2 ? 12 : -12), y, 10, 16, 'rgba(60,90,110,0.55)'); }
  ell(hole[0], hole[1], 90, 60, '#123a55'); ell(hole[0], hole[1], 90, 60, 'rgba(255,255,255,0.15)');
  for (let j = 0; j < 6; j++) { const a = j * TAU / 6 + 0.3; limb([[hole[0] + 90 * Math.cos(a), hole[1] + 60 * Math.sin(a)], [hole[0] + 150 * Math.cos(a + 0.1), hole[1] + 95 * Math.sin(a + 0.1)]], 4, 'rgba(40,80,110,0.7)', false); }
  ell(hole[0], hole[1] - 6, 30, 30, '#f2c19b'); ell(hole[0], hole[1] - 22, 34, 22, '#7a5a3a');           // you, from above
  limb([[hole[0] - 30, hole[1]], [hole[0] - 80, hole[1] + 14]], 16, '#f2782f', false); limb([[hole[0] + 30, hole[1]], [hole[0] + 80, hole[1] + 14]], 16, '#f2782f', false);
  g.restore();
  const a1 = clamp(o.arrows ?? 0), a2 = clamp(o.arrows2 ?? 0), ans = clamp(o.answer ?? 0);
  const arrow = (pts, u, c, num, lab) => {
    if (u <= 0.01) return;
    const n = pts.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), r = f - i, tip = [lerp(pts[i][0], pts[i + 1][0], r), lerp(pts[i][1], pts[i + 1][1], r)];
    g.save(); g.setLineDash([26, 16]); limb([...pts.slice(0, i + 1), tip], 14, c, false); g.restore();
    const ang = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    g.save(); g.translate(tip[0], tip[1]); g.rotate(ang); poly([[20, 0], [-22, -22], [-22, 22]], c); g.restore();
    ell(lab[0], lab[1], 34, 34, c); g.fillStyle = '#ffffff'; g.font = '700 46px Russo'; g.textAlign = 'center'; g.fillText(num, lab[0], lab[1] + 16);
  };
  arrow([[hole[0] + 70, hole[1] - 40], [hole[0] + 170, hole[1] - 140]], a1, ans > 0.5 ? '#d62828' : '#ffd23f', '1', [hole[0] + 210, hole[1] - 110]);
  arrow([[hole[0] - 40, hole[1] + 70], [-120, h / 2 - 170]], a2, ans > 0.5 ? '#2f8f4e' : '#ffd23f', '2', [-170, hole[1] + 150]);
  g.restore();
}

// —— 1999: snowy mountains, the slope, a frozen stream ——
export function mountains(t, o = {}) {
  grad([[0, '#8fc4e6'], [1, '#e6f3fa']], 0, 1100);
  for (const [x, y, w, c] of [[180, 620, 420, '#9fb4c8'], [620, 560, 520, '#8aa2b8'], [980, 640, 400, '#9fb4c8']]) {
    poly([[x - w, 1100], [x, y], [x + w, 1100]], c); poly([[x - w * 0.28, y + 160], [x, y], [x + w * 0.28, y + 160], [x + w * 0.1, y + 130], [x - w * 0.05, y + 170]], '#f4fbff');
  }
  grad([[0, '#f4fbff'], [1, '#dbe9f1']], 1000, 1920);
  for (let i = 0; i < 10; i++) pine(60 + i * 110 + 20 * hash(i), 1060 + 30 * hash(i * 2), 0.5, '#2f5a46');
  // the stream: a bluish band of ice across the bottom
  fill(smoothPath([[-40, 1500], [300, 1470], [700, 1520], [1120, 1480], [1120, 1600], [700, 1640], [300, 1590], [-40, 1620]]), '#bcdcea');
  if ((o.broken ?? 0) > 0) { const k = o.broken; ell(540, 1555, 120 * k, 40 * k, '#123a55'); crack(540, 1555, k, 9, 0.8); }
}
export function skier(x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.rot ?? 0.25);
  limb([[-150 * s, 6 * s], [190 * s, 6 * s], [215 * s, -14 * s]], 9 * s, '#2a2a34', false);
  person({ x: 0, y: 0, s, seed: 1, view: 'side', face: 1, shirt: '#d9433b', shorts: '#2a2a44', skin: '#f0c6a0', hair: '#c9a05a', pony: true, hat: '#3a6aa8', arm: [90, -330] });
  limb([[30 * s, -330 * s], [-60 * s, 0]], 5 * s, '#4a4a54', false);
  g.restore();
}
export function thermometer(x, y, k, val) {
  if (k <= 0.01) return;
  g.save(); g.translate(x, y); g.scale(k, k);
  rrect(-60, -330, 120, 520, 60, 'rgba(11,15,26,0.85)');
  rrect(-22, -290, 44, 380, 22, '#f2f2f2'); ell(0, 120, 46, 46, '#f2f2f2');
  const u = clamp((val - 10) / 30), top = lerp(90, -290, u);
  rect(-12, top, 24, 110 - top, '#e53935'); ell(0, 120, 34, 34, '#e53935');
  for (let i = 0; i <= 6; i++) { const yy = lerp(90, -290, i / 6); limb([[22, yy], [38, yy]], 3, '#c9d6ea', false); }
  g.restore();
}
export function heartLine(x, y, w, t, t0, on) {
  g.save(); rrect(x - 10, y - 70, w + 20, 140, 16, 'rgba(11,15,26,0.88)');
  const pts = []; for (let i = 0; i <= 120; i++) { const u = i / 120, xx = x + u * w, ph = ((u * 3 - (t - t0) * 1.2) % 1 + 1) % 1; pts.push([xx, y + (on ? (ph > 0.45 && ph < 0.5 ? -50 : ph >= 0.5 && ph < 0.55 ? 34 : 0) : 0)]); }
  limb(pts, 5, on ? '#3dd68c' : '#e53935', false);
  g.restore();
}
