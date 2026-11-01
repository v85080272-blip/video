// The landing outside the flat on the 20th floor, seen from the stairwell: our steel door (number 80) with its peephole,
// two locks, the chain on the inside and the doormat; the neighbour's padded door (81) to the right; the lift doors to
// the left. Units as in apt.js: floor at y = 0, the hunter at s = 0.6 is about 450 tall. Also the neighbour herself (a
// small round woman in a headscarf and glasses) and the props the «Квартира под защитой» season needs: a suitcase, a
// key, flyers stuck in the door.
import { g, ell, limb, fill, poly, rect, rrect, polyPath, smoothPath, rrPath, inside, col } from './flat.js';
import { lerp, clamp, hash, noise, rgba, mix, bump, TAU } from './lib.js';

export const LAND = { x0: -1100, x1: 1100, ceil: -760 };
export const DOOR = { x0: -140, x1: 140, top: -580, hinge: 'left' };      // ours
export const PEEP = [0, -430];
export const LOCKS = [[96, -330], [96, -230]];
export const HANDLE = [104, -280];
export const MAT = { x0: -170, x1: 170 };
export const NDOOR = { x0: 420, x1: 680, top: -570 };                       // the neighbour's
export const LIFT = { x0: -760, x1: -480, top: -600 };
const C = {
  wallLo: '#7d9a8c', wallHi: '#e9e4d6', band: '#5d7a6c', floor: '#b8a68c', tile: '#a8967c', steel: '#6b4f3a', steelSh: '#553d2c',
  frame: '#3e3a3a', chrome: '#c9d0d6', pad: '#8a2f2f', padSh: '#6e2424', stud: '#d9b45a', mat: '#5a6b4f', matSh: '#46553d',
  lift: '#9aa3ad', liftSh: '#7f8892', paper: '#f6f2e7',
};

// —— the landing: walls (painted green below, white above), the floor tiles, a ceiling lamp ——
export function drawLanding(t, o = {}) {
  const { x0, x1, ceil } = LAND;
  rect(x0, ceil, x1 - x0, -ceil, C.wallHi);
  rect(x0, -340, x1 - x0, 340, C.wallLo); rect(x0, -350, x1 - x0, 12, C.band);
  rect(x0, 0, x1 - x0, 140, C.floor);
  for (let i = 0; i < 24; i++) rect(x0 + i * 92, 0, 4, 140, C.tile);
  rect(x0, ceil - 60, x1 - x0, 60, '#3c3f52');
  ell(0, ceil + 18, 70, 18, o.dark ? '#5a5a52' : '#fff6d8');
  if (!o.dark) ell(0, ceil + 60, 420, 140, 'rgba(255,240,200,0.12)');
  // the lift on the left: two steel leaves and its call button
  const L = LIFT;
  rect(L.x0 - 24, L.top - 24, L.x1 - L.x0 + 48, -L.top + 24, '#5d6570');
  rect(L.x0, L.top, (L.x1 - L.x0) / 2 - 3, -L.top, C.lift); rect((L.x0 + L.x1) / 2 + 3, L.top, (L.x1 - L.x0) / 2 - 3, -L.top, C.lift);
  rrect(L.x1 + 50, -330, 40, 60, 6, '#c9c3b5'); ell(L.x1 + 70, -300, 12, 12, o.liftLit ? '#ffd23f' : '#9aa3ad');
  // the neighbour's padded door with its brass studs and her number
  const N = NDOOR;
  rect(N.x0 - 18, N.top - 18, N.x1 - N.x0 + 36, -N.top + 18, C.frame);
  if (!o.nOpen) {
    rrect(N.x0, N.top, N.x1 - N.x0, -N.top, 6, C.pad);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) ell(N.x0 + 40 + c * 60, N.top + 60 + r * 90, 5, 5, C.stud);
    for (let i = 0; i < 3; i++) limb([[N.x0 + 20, N.top + 120 + i * 160], [N.x1 - 20, N.top + 120 + i * 160]], 3, C.padSh, false);
    ell(N.x1 - 36, -280, 12, 12, C.chrome);
  } else {
    rect(N.x0, N.top, N.x1 - N.x0, -N.top, '#f4dfae');                    // open: her warm hallway behind
    poly([[N.x0, N.top], [N.x0 - 80, N.top + 40], [N.x0 - 80, -10], [N.x0, 0]], C.pad);
  }
  plate(N.x1 - 60, N.top + 60, '81');
}
function plate(x, y, n) { rrect(x - 30, y - 22, 60, 44, 6, '#e9e4d6'); g.save(); g.fillStyle = '#2c2c34'; g.font = '700 30px MonoBold'; g.textAlign = 'center'; g.fillText(n, x, y + 11); g.restore(); }

// —— our door: steel with a quilted pattern, two locks, the peephole, the handle; o.open 0…1 swings it in; o.ajar 0…1 a
// crack at the edge; o.scratch the lock is scratched; o.flyers 0…n leaflets stuck between door and frame ——
export function drawDoor(t, o = {}) {
  const D = DOOR, w = D.x1 - D.x0;
  rect(D.x0 - 22, D.top - 22, w + 44, -D.top + 22, C.frame);
  const op = clamp(o.open ?? 0), ajar = clamp(o.ajar ?? 0);
  if (op > 0.01 || ajar > 0.01) {                                          // the flat behind the open door
    const gap = op > 0.01 ? w * op : 26 * ajar;
    rect(D.x1 - gap, D.top, gap, -D.top, o.dark ? '#0b0e18' : '#e9dcc0');
  }
  const leafW = op > 0.01 ? w * (1 - op) : w - 26 * ajar;
  if (leafW > 4) {
    rrect(D.x0, D.top, leafW, -D.top, 4, C.steel);
    g.save(); g.beginPath(); g.rect(D.x0, D.top, leafW, -D.top); g.clip();
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const x = D.x0 + 30 + j * 80, y = D.top + 40 + i * 88; poly([[x + 30, y], [x + 60, y + 34], [x + 30, y + 68], [x, y + 34]], C.steelSh); }
    rect(D.x0, D.top, 14, -D.top, C.steelSh);
    g.restore();
    if (op < 0.05) {
      for (const [lx, ly] of LOCKS) { const x = lx - 26 * ajar; rrect(x - 14, ly - 22, 28, 44, 8, C.chrome); rect(x - 2, ly - 12, 4, 24, '#3a3f4a'); }
      if (o.scratch) for (let i = 0; i < 6; i++) limb([[LOCKS[0][0] - 20 + 6 * i, LOCKS[0][1] - 30 + 4 * (i % 2)], [LOCKS[0][0] - 4 + 6 * i, LOCKS[0][1] + 26]], 2, 'rgba(240,240,240,0.9)', false);
      const hx = HANDLE[0] - 26 * ajar;
      rrect(hx - 50, HANDLE[1] - 8, 60, 16, 8, C.chrome); ell(hx, HANDLE[1], 14, 14, C.chrome);
      ell(PEEP[0], PEEP[1], 12, 12, '#2c2c34'); ell(PEEP[0], PEEP[1], 8, 8, o.peepLit ? '#ffe7a8' : '#4a5064');
      plate(0, D.top + 70, '80');
    }
  }
  const n = o.flyers ?? 0;                                                  // the leaflets stuck in the frame
  for (let i = 0; i < n; i++) {
    const x = D.x1 - 8 + 6 * (i % 2), y = -360 + i * 26, a = -0.5 + 0.25 * i;
    g.save(); g.translate(x, y); g.rotate(a); rect(-6, -40, 70, 80, ['#f6f2e7', '#ffd23f', '#9fd8ff', '#ffb3b3'][i % 4]); rect(4, -26, 44, 6, 'rgba(0,0,0,0.25)'); rect(4, -10, 34, 6, 'rgba(0,0,0,0.2)'); g.restore();
  }
}
// —— the doormat, lifted at one corner by o.lift 0…1 (showing the key under it when o.key) ——
export function drawMat(t, o = {}) {
  const { x0, x1 } = MAT, lift = clamp(o.lift ?? 0);
  if (o.key && lift > 0.05) key(x1 - 70, -4, 0.8, 0.2);
  fill(polyPath([[x0, 4], [x1 - 140 * lift, 4 - 60 * lift], [x1, 18 - 10 * lift], [x0 + 20, 20]]), C.mat);
  for (let i = 0; i < 5; i++) limb([[x0 + 30 + i * 60, 8], [x0 + 30 + i * 60 - 30 * lift, 16]], 3, C.matSh, false);
}

// —— props ——
export function key(x, y, s = 1, a = 0) {
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  ell(-24, 0, 18, 18, '#d9b45a'); ell(-24, 0, 8, 8, 'rgba(0,0,0,0.25)');
  rect(-8, -5, 54, 10, '#d9b45a'); rect(32, 4, 6, 10, '#d9b45a'); rect(42, 4, 6, 14, '#d9b45a');
  g.restore();
}
export function suitcase(x, y, s = 1) {                                    // (x, y) = the bottom centre
  g.save(); g.translate(x, y); g.scale(s, s);
  rrect(-90, -230, 180, 220, 18, '#3c7ad6'); rect(-90, -150, 180, 10, '#2f62ad'); rect(-90, -90, 180, 10, '#2f62ad');
  limb([[-30, -230], [-30, -290], [30, -290], [30, -230]], 10, '#2c3140');
  ell(-60, -6, 12, 12, '#2c3140'); ell(60, -6, 12, 12, '#2c3140');
  rrect(-50, -200, 60, 40, 6, '#ffd23f');
  g.restore();
}

// —— the neighbour: a small round woman in a flowered headscarf and big glasses; o.face ±1, o.hands { near:[x,y] }, o.wave ——
export function drawGranny(o) {
  const s = o.s ?? 0.6, x = o.x, face = o.face ?? -1, t = o.t ?? 0;
  g.save(); g.translate(x, o.y ?? 0); g.scale(s * face, s);
  ell(-30, -14, 34, 16, '#4a3a33'); ell(36, -14, 34, 16, '#4a3a33');                       // shoes
  fill(smoothPath([[-110, -40], [-90, -330], [-40, -420], [40, -420], [90, -330], [110, -40]]), '#7a4f8a');   // the dressing gown
  inside(smoothPath([[-110, -40], [-90, -330], [-40, -420], [40, -420], [90, -330], [110, -40]]), () => { for (let i = 0; i < 8; i++) ell(-80 + 24 * i, -100 - 30 * (i % 3), 10, 10, '#d9b45a'); rect(-110, -200, 220, 18, '#5d3a6e'); });
  // the arms: one on her hip, the near one reaching to o.hands.near (local coords) or hanging
  limb([[-70, -370], [-120, -260], [-80, -200]], 30, '#6e4580');
  const hn = o.reach ?? [70, -220], wave = o.wave ? 20 * Math.sin(t * 9) : 0;
  limb([[70, -370], [lerp(70, hn[0], 0.5) + 30, lerp(-370, hn[1], 0.5) - 10], [hn[0] + wave, hn[1]]], 30, '#6e4580');
  ell(hn[0] + wave, hn[1], 20, 20, '#f2c9a8');
  // head: face, cheeks, glasses, the headscarf tied under the chin
  ell(0, -500, 78, 84, '#f2c9a8'); ell(-34, -470, 16, 10, '#f0a8a0'); ell(34, -470, 16, 10, '#f0a8a0');
  for (const ex of [-28, 28]) { g.lineWidth = 6; g.strokeStyle = col('#2c2c34'); g.beginPath(); g.arc(ex, -510, 22, 0, TAU); g.stroke(); ell(ex + 4 * (o.look ?? 0), -510, 6, 7, '#2c2c34'); }
  limb([[-8, -512], [8, -512]], 5, '#2c2c34', false);
  const sm = o.smile ?? 0.5; limb([[-18, -462], [0, -456 + 8 * sm], [18, -462]], 5, '#8a3a3a');
  fill(smoothPath([[-96, -480], [-90, -580], [0, -620], [90, -580], [96, -480], [70, -520], [0, -560], [-70, -520]]), '#d9433b');
  for (let i = 0; i < 5; i++) ell(-60 + 30 * i, -560 - 12 * (i % 2), 8, 8, '#ffd23f');
  poly([[-30, -430], [30, -430], [0, -400]], '#d9433b');
  g.restore();
}
