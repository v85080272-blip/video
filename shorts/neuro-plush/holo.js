// Голограммы Нейро: ползунок уровня рассуждения с «точками вычислений», значки «простой/сложная»,
// карта комнаты с тремя маршрутами, большая схема «Операция Батарея» с котом-разведчиком, значки времени и ресурсов.
// Каждая панель — CanvasTexture на плоскости в 3D (аддитивно, светится через bloom).
import { THREE, scene, clamp, lerp, seg, eo, back, hash, V } from './core.js';
import { BOX_A, BOX_B, VAC_Z, RADIATOR } from './room.js';

const CY = '127,232,255', OR = '255,176,90', RD = '255,92,110', GR = '120,255,170';
function panel(cw, ch, w, h) {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  mat.color.setScalar(1.55);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.renderOrder = 10; m.visible = false; scene.add(m);
  // тёмная подложка под свечением, чтобы надписи читались на светлой стене
  const bc = document.createElement('canvas'); bc.width = cw / 4; bc.height = ch / 4; const bx = bc.getContext('2d'); bx.fillStyle = '#fff'; bx.beginPath(); bx.roundRect(2, 2, bc.width - 4, bc.height - 4, 7); bx.fill();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x041018, transparent: true, opacity: .58, alphaMap: new THREE.CanvasTexture(bc), depthWrite: false, side: THREE.DoubleSide }));
  back.renderOrder = 9; back.position.z = -.002; m.add(back);
  return { c, x: c.getContext('2d'), tex, mat, m, back, cw, ch };
}
function frameBox(x, cw, ch, a = 1, col = CY) {
  x.save(); x.globalAlpha = a;
  x.fillStyle = `rgba(30,120,190,.16)`; x.beginPath(); x.roundRect(6, 6, cw - 12, ch - 12, 26); x.fill();
  x.strokeStyle = `rgba(${col},.55)`; x.lineWidth = 3; x.stroke();
  x.strokeStyle = `rgba(${col},1)`; x.lineWidth = 7; x.lineCap = 'round'; const L = 34;
  [[14, 14, 1, 1], [cw - 14, 14, -1, 1], [14, ch - 14, 1, -1], [cw - 14, ch - 14, -1, -1]].forEach(([px, py, sx, sy]) => { x.beginPath(); x.moveTo(px, py + sy * L); x.lineTo(px, py); x.lineTo(px + sx * L, py); x.stroke(); });
  for (let y = 10; y < ch; y += 6) { x.fillStyle = 'rgba(127,232,255,.035)'; x.fillRect(8, y, cw - 16, 2); }   // строки развёртки
  x.restore();
}
const glow = (x, col, b = 18) => { x.shadowColor = `rgba(${col},1)`; x.shadowBlur = b; };
function label(x, s, px, py, size, col = CY, a = 1, align = 'center') { x.save(); x.globalAlpha = a; glow(x, col, 12); x.fillStyle = `rgba(${col},1)`; x.font = `900 ${size}px Rubik`; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(s, px, py); x.restore(); }
function dot(x, px, py, r, col = CY, a = 1) { x.save(); x.globalAlpha = a; glow(x, col, r * 2.2); x.fillStyle = `rgba(${col},1)`; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.restore(); }

// ——— 1. ползунок ———
export const slider = panel(640, 320, .3, .15);
const LV = ['НИЗКИЙ', 'СРЕДНИЙ', 'ВЫСОКИЙ'];
// lv 0..2 (может быть >2 для «максимум»: вспышка), dots 0..1 — показывать точки вычислений, title 0..1
export function drawSlider(t, { lv = 0, dots = 0, title = 0, a = 1, push = 0 } = {}) {
  const { x, cw, ch } = slider; x.clearRect(0, 0, cw, ch);
  frameBox(x, cw, ch, a);
  x.save(); x.globalAlpha = a;
  if (title > 0) label(x, 'УРОВЕНЬ РАССУЖДЕНИЯ', cw / 2, 46, 34, CY, title);
  const x0 = 80, x1 = cw - 80, ty = 222, k = clamp(lv / 2);
  x.lineCap = 'round'; x.strokeStyle = `rgba(${CY},.35)`; x.lineWidth = 12; x.beginPath(); x.moveTo(x0, ty); x.lineTo(x1, ty); x.stroke();
  const hot = clamp(lv - 1.6, 0, 1), col = hot > .5 ? OR : CY;
  glow(x, col, 16); x.strokeStyle = `rgba(${col},1)`; x.beginPath(); x.moveTo(x0, ty); x.lineTo(lerp(x0, x1, k), ty); x.stroke(); x.shadowBlur = 0;
  LV.forEach((s, i) => { const px = lerp(x0, x1, i / 2), on = k >= i / 2 - .01; dot(x, px, ty, on ? 11 : 8, on ? col : CY, on ? 1 : .5); label(x, s, px, ty + 52, 27, on ? col : CY, on ? 1 : .55); });
  const kx = lerp(x0, x1, k); dot(x, kx, ty, 22 + push * 6, '255,255,255'); x.save(); x.strokeStyle = `rgba(${col},1)`; x.lineWidth = 5; x.beginPath(); x.arc(kx, ty, 22 + push * 6, 0, 7); x.stroke(); x.restore();
  // точки вычислений над ползунком: чем выше уровень, тем больше точек и связей
  if (dots > 0) {
    const n = Math.round(lerp(3, 30, k)), pts = [];
    for (let i = 0; i < n; i++) { const px = 90 + hash(i * 3.7) * (cw - 180), py = 88 + hash(i * 9.1) * 74; pts.push([px + Math.sin(t * 2 + i) * 4, py + Math.cos(t * 1.7 + i) * 3, i]); }
    x.strokeStyle = `rgba(${CY},${.35 * dots})`; x.lineWidth = 2;
    pts.forEach(([px, py, i]) => { const j = Math.floor(hash(i * 5.3) * n); if (j !== i && j < n) { x.beginPath(); x.moveTo(px, py); x.lineTo(pts[j][0], pts[j][1]); x.stroke(); } });
    pts.forEach(([px, py, i]) => dot(x, px, py, 5 + 2 * Math.sin(t * 6 + i), col, dots * (.6 + .4 * Math.sin(t * 5 + i * 2))));
  }
  x.restore(); slider.tex.needsUpdate = true;
}

// ——— 2. значки «простой / сложная» ———
export const icons = panel(640, 300, .34, .16);
export function drawIcons(t, { l = 0, r = 0, a = 1 } = {}) {
  const { x, cw, ch } = icons; x.clearRect(0, 0, cw, ch); frameBox(x, cw, ch, a);
  x.save(); x.globalAlpha = a;
  x.strokeStyle = `rgba(${CY},.3)`; x.lineWidth = 2; x.beginPath(); x.moveTo(cw / 2, 40); x.lineTo(cw / 2, ch - 40); x.stroke();
  if (l > 0) { const s = back(clamp(l)); x.save(); x.translate(cw * .25, 120); x.scale(s, s); dot(x, 0, 0, 24, GR); x.restore(); label(x, 'ПРОСТОЙ', cw * .25, 210, 34, GR, clamp(l * 2 - .5)); label(x, 'быстрый ответ', cw * .25, 252, 25, CY, clamp(l * 2 - 1)); }
  if (r > 0) {
    const P = [[-70, -30], [-20, -62], [40, -40], [75, 10], [20, 30], [-45, 35], [5, -5], [-80, 15], [60, -70]];
    x.save(); x.translate(cw * .75, 122);
    P.forEach(([px, py], i) => { const k = clamp(r * 9 - i); if (k <= 0) return; P.forEach(([qx, qy], j) => { if (j < i && hash(i * 7 + j) < .45) { x.strokeStyle = `rgba(${OR},${.6 * k})`; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke(); } }); dot(x, px, py, 9 * back(k), OR, k); });
    x.restore(); label(x, 'СЛОЖНАЯ', cw * .75, 210, 34, OR, clamp(r * 2 - .5)); label(x, 'разобрать подробнее', cw * .75, 252, 25, CY, clamp(r * 2 - 1));
  }
  x.restore(); icons.tex.needsUpdate = true;
}

// ——— 3. карта комнаты (вид сверху, вперёд = вверх; левая сторона карты = левая от дивана = мировой +X) ———
export const map = panel(560, 700, .34, .425);
export const ROUTES = {
  A: [[-.25, .35], [-.22, 1.2], [-.19, 1.95], [.1, 3.3], [.35, 4.3]],          // напролом между коробками
  B: [[-.25, .35], [-.95, 1.3], [-1.0, 2.4], [-.85, VAC_Z], [.1, 4.0], [.35, 4.3]],   // справа, через пылесос
  C: [[-.25, .35], [.45, 1.15], [.85, 2.2], [.85, 2.75], [.6, 3.5], [.35, 4.3]],      // слева, переждать пылесос
};
const HIT = { A: [-.19, 1.95], B: [-.85, VAC_Z] }, WAIT = [.85, 2.75];
function plen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
function along(P, k) { let L = plen(P) * clamp(k); for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (L <= d) { const u = L / d; return [lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u), Math.atan2(P[i][1] - P[i - 1][1], P[i][0] - P[i - 1][0])]; } L -= d; } const n = P.length - 1; return [P[n][0], P[n][1], 0]; }
// отрисовка карты в прямоугольник (ox, oy, w, h) произвольного контекста
function drawRoomMap(x, t, ox, oy, w, h, st) {
  const sc = Math.min(w / 3.2, h / 4.9), mx = wx => ox + w / 2 - (wx - .1) * sc, my = wz => oy + h - 30 - wz * sc;
  const P = ([wx, wz]) => [mx(wx), my(wz)];
  x.save();
  // стены и окно
  x.strokeStyle = `rgba(${CY},.75)`; x.lineWidth = 4; x.strokeRect(mx(1.5), my(4.6), mx(-1.3) - mx(1.5), my(-.1) - my(4.6));
  x.lineWidth = 10; x.strokeStyle = `rgba(${CY},1)`; glow(x, CY); x.beginPath(); x.moveTo(mx(1.05), my(4.6)); x.lineTo(mx(-.35), my(4.6)); x.stroke(); x.shadowBlur = 0;
  // батарея с волнами тепла
  const [rx, ry] = P([RADIATOR.x, RADIATOR.z]); x.fillStyle = `rgba(${OR},.9)`; glow(x, OR); x.fillRect(rx - 42, ry - 6, 84, 14); x.shadowBlur = 0;
  for (let i = 0; i < 3; i++) { x.strokeStyle = `rgba(${OR},${.5 + .3 * Math.sin(t * 4 + i)})`; x.lineWidth = 3; x.beginPath(); for (let k = 0; k <= 10; k++) { const px = rx - 24 + i * 24 + Math.sin(k * .9 + t * 5) * 4, py = ry + 14 + k * 3.2; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); }
  // диван
  x.strokeStyle = `rgba(${CY},.9)`; x.lineWidth = 4; x.beginPath(); x.roundRect(mx(.9), my(.38), mx(-.9) - mx(.9), my(-.3) - my(.38), 12); x.stroke();
  // коробки
  [[BOX_A, .46, .42], [BOX_B, .38, .36]].forEach(([b, bw, bd], i) => { x.save(); x.translate(mx(b.x), my(b.z)); x.rotate(i ? .35 : -.25); x.fillStyle = `rgba(${OR},.25)`; x.strokeStyle = `rgba(${OR},1)`; x.lineWidth = 4; x.fillRect(-bw * sc / 2, -bd * sc / 2, bw * sc, bd * sc); x.strokeRect(-bw * sc / 2, -bd * sc / 2, bw * sc, bd * sc); x.restore(); });
  // путь пылесоса и сам пылесос
  x.setLineDash([10, 10]); x.strokeStyle = `rgba(${CY},.35)`; x.lineWidth = 3; x.beginPath(); x.moveTo(mx(1.4), my(VAC_Z)); x.lineTo(mx(-1.2), my(VAC_Z)); x.stroke(); x.setLineDash([]);
  const vx = mx(st.vacX ?? 0), vy = my(VAC_Z); dot(x, vx, vy, .17 * sc, st.vacBeep ? RD : CY, .9); x.fillStyle = '#082030'; x.beginPath(); x.arc(vx, vy, .1 * sc, 0, 7); x.fill();
  // кот на диване и Нейро
  if (st.catOnSofa !== false) { const [cx0, cy0] = P([-.25, .1]); dot(x, cx0, cy0, 11, OR); x.fillStyle = `rgba(${OR},1)`; x.beginPath(); x.moveTo(cx0 - 10, cy0 - 5); x.lineTo(cx0 - 6, cy0 - 18); x.lineTo(cx0 - 1, cy0 - 8); x.moveTo(cx0 + 10, cy0 - 5); x.lineTo(cx0 + 6, cy0 - 18); x.lineTo(cx0 + 1, cy0 - 8); x.fill(); }
  // маршруты
  const RC = { A: RD, B: RD, C: GR };
  for (const key of ['A', 'B', 'C']) {
    const k = st.routes?.[key] || 0; if (k <= 0) continue;
    const pts = ROUTES[key].map(P), L = plen(ROUTES[key]);
    x.save(); glow(x, RC[key], 14); x.strokeStyle = `rgba(${RC[key]},${st.dim?.[key] ? .35 : 1})`; x.lineWidth = key === 'C' ? 8 : 6; x.setLineDash(key === 'C' ? [] : [16, 10]); x.lineCap = 'round';
    x.beginPath(); let acc = 0; x.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(ROUTES[key][i][0] - ROUTES[key][i - 1][0], ROUTES[key][i][1] - ROUTES[key][i - 1][1]); const lim = L * k; if (acc + d <= lim) x.lineTo(...pts[i]); else { const u = (lim - acc) / d; x.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)); break; } acc += d; }
    x.stroke(); x.restore();
    const mk = st.marks?.[key] || 0;
    if (mk > 0 && key !== 'C') { const [hx, hy] = P(HIT[key]); const s = back(clamp(mk)) * 1.0; x.save(); x.translate(hx, hy); x.scale(s, s); dot(x, 0, 0, 22, RD); x.strokeStyle = '#fff'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(-9, -9); x.lineTo(9, 9); x.moveTo(9, -9); x.lineTo(-9, 9); x.stroke(); x.restore(); }
    if (mk > 0 && key === 'C') {
      const [wx, wy] = P(WAIT); x.save(); x.translate(wx + 30, wy); x.scale(back(clamp(mk)), back(clamp(mk))); x.fillStyle = `rgba(${GR},1)`; glow(x, GR); x.fillRect(-9, -12, 6, 24); x.fillRect(3, -12, 6, 24); x.restore();   // «пауза»: переждать пылесос
      const [ex, ey] = P(ROUTES.C[ROUTES.C.length - 1]); x.save(); x.translate(ex + 34, ey + 22); const s = back(clamp(mk * 1.3 - .3)); x.scale(s, s); dot(x, 0, 0, 20, GR); x.strokeStyle = '#04201a'; x.lineWidth = 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(-8, 1); x.lineTo(-2, 8); x.lineTo(10, -7); x.stroke(); x.restore();
    }
  }
  // кот-разведчик идёт по маршруту C
  if (st.scout != null) { const [wx, wz] = along(ROUTES.C, st.scout); const [sx, sy] = P([wx, wz]); scoutCat(x, sx, sy, st.scoutSize || 1, t); }
  x.restore();
}
// мультяшный кот-разведчик: рыжая голова, чёрная маска, красный шарф
function scoutCat(x, px, py, s, t) {
  x.save(); x.translate(px, py - 6 + Math.abs(Math.sin(t * 9)) * -6 * s); x.scale(s, s); glow(x, OR, 16);
  x.fillStyle = 'rgb(255,160,70)'; x.beginPath(); x.ellipse(0, 18, 16, 12, 0, 0, 7); x.fill();
  x.beginPath(); x.arc(0, 0, 17, 0, 7); x.fill();
  x.beginPath(); x.moveTo(-15, -6); x.lineTo(-11, -24); x.lineTo(-3, -13); x.moveTo(15, -6); x.lineTo(11, -24); x.lineTo(3, -13); x.fill();
  x.shadowBlur = 0; x.fillStyle = '#111'; x.beginPath(); x.roundRect(-17, -6, 34, 10, 5); x.fill();
  x.fillStyle = '#fff'; x.beginPath(); x.arc(-7, -1, 3, 0, 7); x.arc(7, -1, 3, 0, 7); x.fill();
  x.strokeStyle = 'rgb(255,70,80)'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(-10, 12); x.lineTo(10, 12); x.moveTo(-8, 12); x.quadraticCurveTo(-22, 16 + Math.sin(t * 14) * 4, -30, 10 + Math.sin(t * 14 + 1) * 5); x.stroke();
  x.restore();
}
export function drawMap(t, st, a = 1) {
  const { x, cw, ch } = map; x.clearRect(0, 0, cw, ch); frameBox(x, cw, ch, a);
  x.save(); x.globalAlpha = a; label(x, 'ПУТЬ К БАТАРЕЕ', cw / 2, 44, 34, CY);
  if (st.frozen) { label(x, '✓ ГОТОВО', cw / 2, 92, 30, GR); }
  drawRoomMap(x, t, 30, 70, cw - 60, ch - 90, st); x.restore(); map.tex.needsUpdate = true;
}

// ——— 4. большая схема над диваном ———
export const big = panel(1100, 820, 1.02, .76);
export function drawBig(t, st, a = 1) {
  const { x, cw, ch } = big; x.clearRect(0, 0, cw, ch); frameBox(x, cw, ch, a, OR);
  x.save(); x.globalAlpha = a;
  label(x, 'ОПЕРАЦИЯ «БАТАРЕЯ»', cw / 2, 60, 54, OR);
  // слева: огромное дерево вариантов
  x.save(); x.translate(60, 130);
  const n = 42; for (let i = 0; i < n; i++) { const k = clamp(st.grow * n - i); if (k <= 0) break; const px = 20 + (i % 6) * 52 + Math.sin(i) * 8, py = Math.floor(i / 6) * 86 + 20; const j = i - 6 - (i % 2); if (j >= 0) { x.strokeStyle = `rgba(${CY},${.5 * k})`; x.lineWidth = 3; x.beginPath(); x.moveTo(px, py); x.lineTo(20 + (j % 6) * 52 + Math.sin(j) * 8, Math.floor(j / 6) * 86 + 20); x.stroke(); } dot(x, px, py, 8 * k, hash(i) < .2 ? RD : (hash(i) < .35 ? GR : CY), k); }
  x.restore();
  // справа: карта с котом-разведчиком
  drawRoomMap(x, t, 420, 100, 640, 700, { ...st, routes: { A: 1, B: 1, C: 1 }, marks: { A: 1, B: 1, C: 1 }, dim: { A: 1, B: 1 }, scoutSize: 2.4 });
  // шкала вычислений
  x.fillStyle = `rgba(${OR},.2)`; x.fillRect(60, ch - 70, 330, 26); glow(x, OR); x.fillStyle = `rgba(${OR},1)`; x.fillRect(60, ch - 70, 330 * clamp(st.grow), 26); x.shadowBlur = 0;
  label(x, 'ВЫЧИСЛЕНИЯ ' + Math.round(100 * clamp(st.grow)) + '%', 225, ch - 100, 30, OR, 1);
  x.restore(); big.tex.needsUpdate = true;
}

// ——— 5. время, ресурсы, проверка ———
export const cost = panel(640, 300, .34, .16);
export function drawCost(t, { clock = 0, res = 0, check = 0, a = 1 } = {}) {
  const { x, cw, ch } = cost; x.clearRect(0, 0, cw, ch); frameBox(x, cw, ch, a);
  x.save(); x.globalAlpha = a;
  const cols = [cw * .19, cw * .5, cw * .81];
  if (clock > 0) { x.save(); x.translate(cols[0], 118); const s = back(clamp(clock)); x.scale(s, s); glow(x, CY); x.strokeStyle = `rgba(${CY},1)`; x.lineWidth = 7; x.beginPath(); x.arc(0, 0, 44, 0, 7); x.stroke(); x.lineCap = 'round'; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -30); x.moveTo(0, 0); const a2 = t * 6; x.lineTo(Math.sin(a2) * 36, -Math.cos(a2) * 36); x.stroke(); x.restore(); label(x, 'ВРЕМЯ', cols[0], 222, 30, CY, clamp(clock * 2 - .6)); }
  if (res > 0) { x.save(); x.translate(cols[1], 118); const s = back(clamp(res)); x.scale(s, s); glow(x, OR); x.strokeStyle = `rgba(${OR},1)`; x.lineWidth = 6; x.strokeRect(-36, -36, 72, 72); for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(i * 13, -36); x.lineTo(i * 13, -50); x.moveTo(i * 13, 36); x.lineTo(i * 13, 50); x.moveTo(-36, i * 13); x.lineTo(-50, i * 13); x.moveTo(36, i * 13); x.lineTo(50, i * 13); x.stroke(); } const f = .3 + .7 * clamp(res) * (.8 + .2 * Math.sin(t * 7)); x.fillStyle = `rgba(${OR},1)`; x.fillRect(-24, 24 - 48 * f, 48, 48 * f); x.restore(); label(x, 'РЕСУРСЫ', cols[1], 222, 30, OR, clamp(res * 2 - .6)); }
  if (check > 0) { x.save(); x.translate(cols[2], 112); const s = back(clamp(check)); x.scale(s, s); glow(x, GR); x.strokeStyle = `rgba(${GR},1)`; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.arc(-6, -6, 32, 0, 7); x.stroke(); x.beginPath(); x.moveTo(17, 17); x.lineTo(40, 40); x.stroke(); x.beginPath(); x.moveTo(-20, -6); x.lineTo(-10, 5); x.lineTo(10, -18); x.stroke(); x.restore(); label(x, 'ПРОВЕРКА', cols[2], 222, 30, GR, clamp(check * 2 - .6)); }
  x.restore(); cost.tex.needsUpdate = true;
}
// разместить панель: позиция, поворот к камере (или фиксированный), масштаб появления
export function place(p, pos, k, cam, tilt = 0, alpha = 1) {
  p.m.visible = k > .001 && alpha > .001; if (!p.m.visible) return;
  p.back.material.opacity = .58 * clamp(alpha);
  p.m.position.copy(pos); if (cam) { p.m.lookAt(cam.position); p.m.rotateX(tilt); }
  const s = back(clamp(k)); p.m.scale.set(s, Math.max(.02, s), 1);
}
export const holos = [slider, icons, map, big, cost];
