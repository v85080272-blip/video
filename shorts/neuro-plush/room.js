// Гостиная вечером: диван с пледом, торшер, гирлянда, полка, картины; напротив дивана окно с дождём и батарея;
// на пути к батарее две коробки Плюша и робот-пылесос. Свет из окна проецирует струйки дождя на диван и стену.
import { THREE, scene, M, V, rng, hash, canvasTex, sph, rod, setRod } from './core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SEAT_Y, lampPos } from './lights.js';

await document.fonts.load('900 60px Rubik', 'ПЛЮШ');
const RB = (w, h, d, r = .03, s = 3) => new RoundedBoxGeometry(w, h, d, s, r);
const mesh = (g, m, x = 0, y = 0, z = 0, sh = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = sh; o.receiveShadow = true; scene.add(o); return o; };

export const ROOM = { xL: -2.4, xR: 2.4, zB: -.75, zF: 4.6, hY: 2.75 };
export const WIN = { x: .35, y: 1.62, w: 1.4, h: 1.45, z: ROOM.zF };       // центр окна
export const RADIATOR = V(.35, 0, ROOM.zF - .12);
export const BOX_A = V(-.5, 0, 1.75), BOX_B = V(.12, 0, 2.05);             // коробки, между ними узкий проход
export const VAC_Z = 3.05;                                                  // линия, по которой ездит пылесос
scene.background = new THREE.Color(0x120c0a);

// ——— пол: паркет ———
const parquet = canvasTex(1024, 1024, (x, w, h) => {
  const r = rng(5), pw = w / 8;
  for (let i = 0; i < 8; i++) {
    let y = -r() * h;
    while (y < h) {
      const L = h * (.35 + r() * .4), base = 120 + r() * 40;
      x.fillStyle = `rgb(${base},${base * .66 | 0},${base * .42 | 0})`; x.fillRect(i * pw, y, pw, L);
      for (let k = 0; k < 26; k++) { x.strokeStyle = `rgba(60,30,15,${.06 + r() * .1})`; x.lineWidth = 1 + r() * 2; x.beginPath(); const gx = i * pw + r() * pw; x.moveTo(gx, y); x.bezierCurveTo(gx + (r() - .5) * 20, y + L * .3, gx + (r() - .5) * 20, y + L * .6, gx + (r() - .5) * 10, y + L); x.stroke(); }
      x.fillStyle = 'rgba(30,15,8,.7)'; x.fillRect(i * pw, y, pw, 3); y += L;
    }
    x.fillStyle = 'rgba(30,15,8,.6)'; x.fillRect(i * pw, 0, 3, h);
  }
}, [3, 3]);
const floor = mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ map: parquet, roughness: .45, metalness: 0 }), 0, 0, 1.9, false);
floor.rotation.x = -Math.PI / 2; floor.material.color.set(0xd8c0a8);
// ковёр
const rugTex = canvasTex(1024, 640, (x, w, h) => {
  x.fillStyle = '#b8574a'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#f2d6a8'; x.lineWidth = 14; x.strokeRect(40, 40, w - 80, h - 80); x.lineWidth = 5; x.strokeRect(70, 70, w - 140, h - 140);
  const r = rng(8); for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) { const cx = 150 + i * 90, cy = 150 + j * 85; x.fillStyle = (i + j) % 2 ? '#e8a05a' : '#7b2f2c'; x.beginPath(); x.moveTo(cx, cy - 26); x.lineTo(cx + 26, cy); x.lineTo(cx, cy + 26); x.lineTo(cx - 26, cy); x.fill(); }
  for (let i = 0; i < 30000; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,240,220' : '40,10,10'},${r() * .08})`; x.fillRect(r() * w, r() * h, 1, 2); }
});
const rug = mesh(new THREE.PlaneGeometry(2.6, 1.65), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }), -.05, .004, .95, false); rug.rotation.x = -Math.PI / 2;

// ——— стены ———
const paper = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#d9a982'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(255,235,210,.18)'; x.fillRect(i * 64 + 6, 0, 20, h); }
  const r = rng(2); for (let k = 0; k < 40; k++) { const cx = (k % 8) * 64 + 48, cy = Math.floor(k / 8) * 110 + 30 + (k % 2) * 55; x.fillStyle = 'rgba(150,80,50,.22)'; x.beginPath(); x.ellipse(cx, cy, 5, 9, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx - 7, cy + 6, 4, 7, -.8, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx + 7, cy + 6, 4, 7, .8, 0, 7); x.fill(); }
  for (let i = 0; i < 20000; i++) { x.fillStyle = `rgba(80,40,20,${r() * .05})`; x.fillRect(r() * w, r() * h, 1, 1); }
}, [5, 3]);
const wallM = new THREE.MeshStandardMaterial({ map: paper, roughness: .92, color: 0xbba493 });
const back = mesh(new THREE.PlaneGeometry(4.8, ROOM.hY), wallM, 0, ROOM.hY / 2, ROOM.zB, false);
const left = mesh(new THREE.PlaneGeometry(5.4, ROOM.hY), wallM, ROOM.xL, ROOM.hY / 2, 1.95, false); left.rotation.y = Math.PI / 2;
const right = mesh(new THREE.PlaneGeometry(5.4, ROOM.hY), wallM, ROOM.xR, ROOM.hY / 2, 1.95, false); right.rotation.y = -Math.PI / 2;
const ceil = mesh(new THREE.PlaneGeometry(4.8, 5.4), M(0xe8d8c8, { roughness: 1 }), 0, ROOM.hY, 1.95, false); ceil.rotation.x = Math.PI / 2;
// передняя стена с проёмом под окно (после поворота на π локальный x = −мировой x)
{
  const s = new THREE.Shape(); s.moveTo(-2.4, 0); s.lineTo(2.4, 0); s.lineTo(2.4, ROOM.hY); s.lineTo(-2.4, ROOM.hY); s.lineTo(-2.4, 0);
  const { x, y, w, h } = WIN, hx = -x, hole = new THREE.Path();
  hole.moveTo(hx - w / 2, y - h / 2); hole.lineTo(hx + w / 2, y - h / 2); hole.lineTo(hx + w / 2, y + h / 2); hole.lineTo(hx - w / 2, y + h / 2); hole.lineTo(hx - w / 2, y - h / 2); s.holes.push(hole);
  const g = new THREE.ShapeGeometry(s); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4.8 + .5, uv.getY(i) / ROOM.hY);
  const front = mesh(g, wallM, 0, 0, ROOM.zF, true); front.rotation.y = Math.PI;   // тень: свет окна проходит только через проём
}
// плинтус
const baseM = M(0xf3e8dc, { roughness: .5 });
mesh(new THREE.BoxGeometry(4.8, .1, .02), baseM, 0, .05, ROOM.zB + .01);
mesh(new THREE.BoxGeometry(.02, .1, 5.4), baseM, ROOM.xL + .01, .05, 1.95); mesh(new THREE.BoxGeometry(.02, .1, 5.4), baseM, ROOM.xR - .01, .05, 1.95);

// ——— диван (бархат) ———
const velvet = new THREE.MeshPhysicalMaterial({ color: 0x3f6b78, roughness: .85, sheen: 1, sheenRoughness: .45, sheenColor: new THREE.Color(0x9fd0dc) });
const velvetD = velvet.clone(); velvetD.color.set(0x335a66);
mesh(RB(1.78, .26, .7, .06), velvetD, 0, .19, .0);                                          // основание
[-.42, .42].forEach(x => mesh(RB(.84, .15, .64, .07, 4), velvet, x, SEAT_Y - .075, .04));   // подушки сиденья
mesh(RB(1.78, .52, .22, .09), velvetD, 0, .6, -.3);                                          // спинка
[-.42, .42].forEach(x => { const c = mesh(RB(.82, .36, .16, .08, 4), velvet, x, .7, -.17); c.rotation.x = -.18; });   // подушки спинки
[-.97, .97].forEach(x => mesh(RB(.2, .38, .72, .09, 4), velvetD, x, .47, .0));                // подлокотники
[-.8, .8].forEach(x => [-.25, .28].forEach(z => mesh(new THREE.CylinderGeometry(.025, .018, .08, 10), M(0x3a2414, { roughness: .4 }), x, .04, z)));
// декоративные подушки: горчичная слева за Плюшем, терракотовая справа
{ const p1 = mesh(RB(.36, .34, .12, .1, 5), new THREE.MeshPhysicalMaterial({ color: 0xd9a234, roughness: .8, sheen: .8, sheenColor: new THREE.Color(0xffe0a0) }), -.7, .7, -.08); p1.rotation.set(-.25, .35, .12);
  const p2 = mesh(RB(.34, .32, .12, .1, 5), new THREE.MeshPhysicalMaterial({ color: 0xc8623e, roughness: .8, sheen: .8, sheenColor: new THREE.Color(0xffb090) }), .72, .69, -.1); p2.rotation.set(-.22, -.35, -.1); }
// плед на правом подлокотнике: клетка, складка свисает
export const plaidTex = canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#e9dcc4'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(176,52,48,.55)'; x.fillRect(i * 64 + 8, 0, 22, h); x.fillRect(0, i * 64 + 8, w, 22); x.fillStyle = 'rgba(60,70,90,.35)'; x.fillRect(i * 64 + 40, 0, 6, h); x.fillRect(0, i * 64 + 40, w, 6); }
  const r = rng(11); for (let i = 0; i < 14000; i++) { x.fillStyle = `rgba(255,255,255,${r() * .12})`; x.fillRect(r() * w, r() * h, 1, 3); }
}, [2, 2]);
{
  const g = new THREE.PlaneGeometry(.55, 1.1, 24, 48), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {   // лежит на подлокотнике и свисает наружу
    const u = p.getX(i), v = p.getY(i) + .55;   // v: 0..1.1
    let y, z = u, xo;
    if (v < .42) { xo = -.1 + v * .5; y = .7 + Math.sin(v / .42 * Math.PI) * .04; }
    else { const k = v - .42; xo = .11 + Math.sin(Math.min(k, .3) / .3 * Math.PI / 2) * .06; y = .7 - k * .95; }
    const wob = Math.sin(u * 22 + v * 3) * .012 * Math.min(1, v * 2);
    p.setXYZ(i, xo + wob, y, z);
  }
  g.computeVertexNormals();
  const plaid = mesh(g, new THREE.MeshPhysicalMaterial({ map: plaidTex, roughness: .95, sheen: .6, sheenColor: new THREE.Color(0xfff0e0), side: THREE.DoubleSide }), .97, 0, .02);
  const fold = mesh(RB(.3, .07, .5, .03, 4), new THREE.MeshPhysicalMaterial({ map: plaidTex, roughness: .95, sheen: .6 }), .99, .7, .05); fold.rotation.z = -.05;
}

// ——— торшер слева ———
{
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a060, metalness: .8, roughness: .3 });
  mesh(new THREE.CylinderGeometry(.16, .18, .03, 32), brass, lampPos.x, .015, lampPos.z);
  mesh(new THREE.CylinderGeometry(.012, .012, lampPos.y - .05, 12), brass, lampPos.x, (lampPos.y - .05) / 2, lampPos.z);
  const shadeM = new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffb060, emissiveIntensity: 1.6, roughness: .9, side: THREE.DoubleSide, transparent: true, opacity: .96 });
  const shade = mesh(new THREE.CylinderGeometry(.15, .24, .3, 40, 1, true), shadeM, lampPos.x, lampPos.y + .06, lampPos.z, false);
  const bulb = mesh(new THREE.SphereGeometry(.04, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), lampPos.x, lampPos.y + .02, lampPos.z, false);
}
// столик справа с кружкой и книгой
{
  const wood = M(0x7a4a2a, { roughness: .45 });
  mesh(new THREE.CylinderGeometry(.24, .24, .03, 40), wood, 1.38, .58, .05);
  mesh(new THREE.CylinderGeometry(.025, .03, .57, 12), wood, 1.38, .29, .05);
  mesh(new THREE.CylinderGeometry(.16, .18, .02, 30), wood, 1.38, .01, .05);
  const mug = mesh(new THREE.CylinderGeometry(.045, .04, .1, 24), M(0xf4efe6, { roughness: .3 }), 1.32, .645, .1);
  const h = mesh(new THREE.TorusGeometry(.03, .008, 8, 16), M(0xf4efe6, { roughness: .3 }), 1.37, .65, .1); h.rotation.y = .3;
  mesh(new THREE.CylinderGeometry(.04, .04, .005, 20), M(0x5a3020, { roughness: .2 }), 1.32, .69, .1, false);
  const book = mesh(RB(.2, .035, .14, .005, 1), M(0x2f5f8f, { roughness: .7 }), 1.43, .612, -.02); book.rotation.y = .4;
}

// ——— стена за диваном: гирлянда, картины, полка ———
export const bulbs = [];
{
  const wireM = M(0x2a2a2a, { roughness: .6 }), N = 18;
  const pts = []; for (let i = 0; i <= 40; i++) { const u = i / 40, x = -1.35 + u * 2.7; pts.push(V(x, 1.78 - Math.sin(u * Math.PI) * .22 + Math.sin(u * Math.PI * 3) * .02, ROOM.zB + .04)); }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, .004, 5), wireM); scene.add(wire);
  const cols = [0xffc46b, 0xffe3a3, 0xff9e6b, 0xffd27f];
  for (let i = 0; i < N; i++) {
    const u = (i + .5) / N, x = -1.35 + u * 2.7, y = 1.78 - Math.sin(u * Math.PI) * .22 + Math.sin(u * Math.PI * 3) * .02;
    const m = new THREE.MeshStandardMaterial({ color: cols[i % 4], emissive: cols[i % 4], emissiveIntensity: 3.2, roughness: .3 });
    const b = mesh(new THREE.SphereGeometry(.018, 12, 10), m, x, y - .03, ROOM.zB + .05, false); b.scale.y = 1.35; bulbs.push(b);
  }
}
const frameTex = (draw) => canvasTex(256, 320, (x, w, h) => { draw(x, w, h); });
function picture(x, y, w, h, tex, col = 0x3a2416) {
  mesh(RB(w + .06, h + .06, .03, .008, 2), M(col, { roughness: .4 }), x, y, ROOM.zB + .02);
  mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: .7 }), x, y, ROOM.zB + .037, false);
}
picture(-.62, 1.3, .32, .4, frameTex((x, w, h) => {   // котик-рисунок
  x.fillStyle = '#f4ead8'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8893a';
  x.beginPath(); x.ellipse(128, 200, 70, 60, 0, 0, 7); x.fill(); x.beginPath(); x.arc(128, 125, 52, 0, 7); x.fill();
  x.beginPath(); x.moveTo(84, 100); x.lineTo(92, 50); x.lineTo(120, 82); x.fill(); x.beginPath(); x.moveTo(172, 100); x.lineTo(164, 50); x.lineTo(136, 82); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.arc(108, 122, 7, 0, 7); x.arc(148, 122, 7, 0, 7); x.fill();
  x.strokeStyle = '#e8893a'; x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); x.moveTo(190, 230); x.quadraticCurveTo(250, 200, 220, 140); x.stroke();
}));
picture(-.2, 1.42, .26, .2, frameTex((x, w, h) => {   // горы
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f7c58f'); g.addColorStop(1, '#f39a7a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#7b5b8f'; x.beginPath(); x.moveTo(0, h); x.lineTo(80, 120); x.lineTo(150, 220); x.lineTo(200, 150); x.lineTo(w, h); x.fill();
  x.fillStyle = '#fff3d6'; x.beginPath(); x.arc(190, 80, 30, 0, 7); x.fill();
}), 0xc9a060);
// полка справа: книги, растение, свеча
{
  const wood = M(0x6b4226, { roughness: .5 });
  mesh(RB(.75, .03, .2, .006, 1), wood, .62, 1.36, ROOM.zB + .1);
  const r = rng(21), bc = [0x9b3b3b, 0x2f5f8f, 0xd9a234, 0x3f7a5a, 0xe8d8c0, 0x6a4a8a, 0xc8623e];
  let x = .3; for (let i = 0; i < 9; i++) { const w = .025 + r() * .02, h = .14 + r() * .08; const b = mesh(RB(w, h, .14, .004, 1), M(bc[i % 7], { roughness: .7 }), x + w / 2, 1.375 + h / 2, ROOM.zB + .1); if (i === 8) { b.rotation.z = .35; b.position.x += .03; b.position.y -= .01; } x += w + .004; }
  const pot = mesh(new THREE.CylinderGeometry(.06, .045, .09, 20), M(0xd8c8b8, { roughness: .6 }), .86, 1.42, ROOM.zB + .1);
  const leafM = M(0x3f8a4a, { roughness: .6 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, l = sph(.05, leafM, 12, 8); l.scale.set(.5, .22, 1.3); l.position.set(.86 + Math.cos(a) * .06, 1.5 + hash(i) * .05, ROOM.zB + .1 + Math.sin(a) * .06); l.rotation.set(.4 * Math.sin(a), -a, .6 * Math.cos(a)); scene.add(l); }
  const candle = mesh(new THREE.CylinderGeometry(.025, .025, .07, 16), M(0xfff4e0, { roughness: .5 }), .98, 1.41, ROOM.zB + .1);
  mesh(new THREE.SphereGeometry(.009, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd38a }), .98, 1.455, ROOM.zB + .1, false).scale.y = 1.8;
}
// большое растение в углу у окна и книжный шкаф слева
{
  const pot = mesh(new THREE.CylinderGeometry(.2, .15, .38, 28), M(0xc87850, { roughness: .7 }), 1.75, .19, 3.7);
  const leafM = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: .55, side: THREE.DoubleSide });
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.bezierCurveTo(.12, .08, .14, .3, 0, .42); leaf.bezierCurveTo(-.14, .3, -.12, .08, 0, 0);
  const lg = new THREE.ShapeGeometry(leaf, 10);
  const r = rng(31);
  for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, h = .5 + r() * .8; const st = rod(M(0x3f6a2a)); setRod(st, V(1.75, .36, 3.7), V(1.75 + Math.cos(a) * .25, .36 + h, 3.7 + Math.sin(a) * .25), .008); scene.add(st); const l = mesh(lg, leafM, 1.75 + Math.cos(a) * .25, .36 + h, 3.7 + Math.sin(a) * .25); l.rotation.set(-.9 + r() * .4, -a + Math.PI / 2, r() - .5); l.scale.setScalar(.8 + r() * .5); }
  const shelfM = M(0x5a3a22, { roughness: .6 });
  mesh(RB(.36, 1.9, 1.0, .02, 2), shelfM, ROOM.xL + .18, .95, 1.3);
  const bc = [0x9b3b3b, 0x2f5f8f, 0xd9a234, 0x3f7a5a, 0xe8d8c0, 0x6a4a8a];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 12; i++) { const h = .2 + hash(s * 20 + i) * .1; mesh(RB(.2, h, .05, .004, 1), M(bc[(s + i) % 6], { roughness: .7 }), ROOM.xL + .3, .15 + s * .45 + h / 2, .9 + i * .065); }
}

// ——— окно: рама, стекло с дождём (капли и струйки преломляют ночной город), шторы, подоконник ———
const cityTex = canvasTex(1024, 1024, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0c1630'); g.addColorStop(.55, '#1d2c52'); g.addColorStop(1, '#2a2440'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let i = 0; i < 14; i++) { const bw = 60 + r() * 140, bh = 250 + r() * 450, bx = r() * w - 40, by = h - bh; x.fillStyle = `rgb(${14 + r() * 10},${18 + r() * 12},${34 + r() * 16})`; x.fillRect(bx, by, bw, bh);
    for (let wy = by + 20; wy < h - 20; wy += 28) for (let wx = bx + 10; wx < bx + bw - 14; wx += 22) if (r() < .32) { x.fillStyle = r() < .7 ? `rgba(255,${190 + r() * 50},${110 + r() * 60},${.6 + r() * .4})` : 'rgba(170,200,255,.6)'; x.fillRect(wx, wy, 11, 15); } }
  for (let i = 0; i < 26; i++) { const bx = r() * w, by = h * (.55 + r() * .45), br = 14 + r() * 40, c = r() < .6 ? '255,180,90' : (r() < .5 ? '255,90,80' : '120,180,255'); const gr = x.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, `rgba(${c},.75)`); gr.addColorStop(.6, `rgba(${c},.25)`); gr.addColorStop(1, `rgba(${c},0)`); x.fillStyle = gr; x.fillRect(bx - br, by - br, br * 2, br * 2); }
});
cityTex.generateMipmaps = true; cityTex.minFilter = THREE.LinearMipmapLinearFilter; cityTex.wrapS = cityTex.wrapT = THREE.ClampToEdgeWrapping;
export const rainGlass = new THREE.ShaderMaterial({
  uniforms: { bg: { value: cityTex }, time: { value: 0 }, light: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D bg; uniform float time; uniform float light; varying vec2 vUv;
    #define S(a,b,t) smoothstep(a,b,t)
    vec3 N13(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787)); p3 += dot(p3, p3.yzx + 19.19); return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x)); }
    float N(float t){ return fract(sin(t*12345.564)*7658.76); }
    float Saw(float b, float t){ return S(0., b, t)*S(1., b, t); }
    vec2 DropLayer(vec2 uv, float t){
      vec2 UV = uv; uv.y += t*.75; vec2 a = vec2(6., 1.); vec2 grid = a*2.; vec2 id = floor(uv*grid);
      float colShift = N(id.x); uv.y += colShift; id = floor(uv*grid);
      vec3 n = N13(id.x*35.2 + id.y*2376.1); vec2 st = fract(uv*grid) - vec2(.5, 0.);
      float x = n.x - .5; float y = UV.y*20.; float wiggle = sin(y + sin(y)); x += wiggle*(.5 - abs(x))*(n.z - .5); x *= .7;
      float ti = fract(t + n.z); y = (Saw(.85, ti) - .5)*.9 + .5; vec2 p = vec2(x, y);
      float d = length((st - p)*a.yx); float mainDrop = S(.4, 0., d);
      float r = sqrt(S(1., y, st.y)); float cd = abs(st.x - x); float trail = S(.23*r, .15*r*r, cd);
      float trailFront = S(-.02, .02, st.y - y); trail *= trailFront*r*r;
      y = UV.y; y = fract(y*10.) + (st.y - .5); float dd = length(st - vec2(x, y)); float droplets = S(.3, 0., dd);
      float m = mainDrop + droplets*r*trailFront; return vec2(m, trail); }
    float StaticDrops(vec2 uv, float t){ uv *= 40.; vec2 id = floor(uv); uv = fract(uv) - .5; vec3 n = N13(id.x*107.45 + id.y*3543.654);
      vec2 p = (n.xy - .5)*.7; float d = length(uv - p); float fade = Saw(.025, fract(t + n.z)); return S(.3, 0., d)*fract(n.z*10.)*fade; }
    vec2 Drops(vec2 uv, float t){ float s = StaticDrops(uv, t); vec2 m1 = DropLayer(uv, t); vec2 m2 = DropLayer(uv*1.85, t); float c = s + m1.x + m2.x; c = S(.3, 1., c); return vec2(c, max(m1.y, m2.y)); }
    void main(){
      vec2 uv = vUv*vec2(1.0, 1.04) * 1.1; float t = time*.18;
      vec2 c = Drops(uv, t); vec2 e = vec2(.0015, 0.);
      float cx = Drops(uv + e, t).x, cy = Drops(uv + e.yx, t).x; vec2 n = vec2(cx - c.x, cy - c.x);
      float focus = mix(5.5 - c.y*2., 1.5, S(.1, .2, c.x));
      vec3 col = textureLod(bg, vUv + n*1.4, focus).rgb;
      col += vec3(.55,.65,.85) * S(.2, .9, c.x) * .12;   // блик на каплях от комнаты
      gl_FragColor = vec4(col * light, 1.); }`,
});
{
  const { x, y, w, h, z } = WIN;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), rainGlass); glass.position.set(x, y, z + .02); glass.rotation.y = Math.PI; scene.add(glass);
  const frameM = M(0xf2ece4, { roughness: .45 });
  mesh(new THREE.BoxGeometry(w + .1, .06, .1), frameM, x, y + h / 2 + .02, z - .02); mesh(new THREE.BoxGeometry(w + .1, .06, .1), frameM, x, y - h / 2 - .02, z - .02);
  mesh(new THREE.BoxGeometry(.06, h + .1, .1), frameM, x - w / 2 - .02, y, z - .02); mesh(new THREE.BoxGeometry(.06, h + .1, .1), frameM, x + w / 2 + .02, y, z - .02);
  mesh(new THREE.BoxGeometry(.04, h, .06), frameM, x, y, z - .01); mesh(new THREE.BoxGeometry(w, .04, .06), frameM, x, y + .15, z - .01);
  mesh(RB(w + .3, .04, .26, .01, 2), frameM, x, y - h / 2 - .06, z - .13);   // подоконник
  // шторы
  const curtM = new THREE.MeshPhysicalMaterial({ color: 0xe8d2b0, roughness: .95, sheen: .7, sheenColor: new THREE.Color(0xfff2dd), side: THREE.DoubleSide });
  [-1, 1].forEach(s => {
    const g = new THREE.PlaneGeometry(.45, 2.45, 40, 20), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i); p.setZ(i, Math.sin(u * 42) * .035 + Math.sin(u * 17 + v) * .01); p.setX(i, u * (1 - (v < -.4 ? (-.4 - v) * .25 : 0))); }
    g.computeVertexNormals(); const c = mesh(g, curtM, x + s * (w / 2 + .2), 1.38, z - .12); c.rotation.y = Math.PI;
  });
  mesh(new THREE.CylinderGeometry(.015, .015, w + 1.1, 10), M(0xc9a060, { metalness: .8, roughness: .3 }), x, 2.62, z - .12).rotation.z = Math.PI / 2;
}

// ——— батарея под окном ———
export const radiatorGlow = new THREE.PointLight(0xff8a40, 0, 1.6, 2);
{
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ec, roughness: .35, clearcoat: .6, clearcoatRoughness: .3 });
  const N = 12, fw = .07;
  for (let i = 0; i < N; i++) mesh(RB(fw - .01, .58, .16, .025, 3), paint, RADIATOR.x + (i - (N - 1) / 2) * fw, .46, RADIATOR.z);
  [.2, .72].forEach(y => mesh(new THREE.BoxGeometry(N * fw, .05, .1), paint, RADIATOR.x, y, RADIATOR.z));
  const pipeM = M(0xd8d2c8, { roughness: .4, metalness: .2 });
  [-1, 1].forEach(s => { mesh(new THREE.CylinderGeometry(.015, .015, .2, 10), pipeM, RADIATOR.x + s * (N * fw / 2 + .04), .1, RADIATOR.z); });
  mesh(new THREE.CylinderGeometry(.03, .03, .05, 16), M(0xffffff, { roughness: .3 }), RADIATOR.x + N * fw / 2 + .05, .25, RADIATOR.z).rotation.z = Math.PI / 2;
  radiatorGlow.position.set(RADIATOR.x, .5, RADIATOR.z - .25); scene.add(radiatorGlow);
}

// ——— коробки Плюша ———
const cardboard = (label) => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#c4935e'; x.fillRect(0, 0, w, h);
  const r = rng(label ? 3 : 4); for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(120,80,40,${r() * .12})`; x.fillRect(0, r() * h, w, 2 + r() * 3); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < .5 ? '90,60,30' : '230,200,150'},${r() * .12})`; x.fillRect(r() * w, r() * h, 2, 1); }
  x.fillStyle = 'rgba(210,190,150,.8)'; x.fillRect(w * .44, 0, w * .12, h * .18);
  if (label) { x.save(); x.translate(w / 2, h * .55); x.rotate(-.08); x.font = '900 110px Rubik'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(30,25,35,.85)'; x.fillText(label, 0, 0);
    x.strokeStyle = 'rgba(200,40,60,.85)'; x.lineWidth = 9; x.beginPath(); const hx = 150, hy = -95; x.moveTo(hx, hy + 18); x.bezierCurveTo(hx - 40, hy - 15, hx - 18, hy - 42, hx, hy - 20); x.bezierCurveTo(hx + 18, hy - 42, hx + 40, hy - 15, hx, hy + 18); x.stroke(); x.restore(); }
  x.strokeStyle = 'rgba(90,60,30,.5)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
});
export const boxes = [];
function cardBox(at, w, h, d, label, rotY) {
  const g = new THREE.Group(); g.position.copy(at); g.rotation.y = rotY; scene.add(g);
  const mats = [cardboard(''), cardboard(''), cardboard(''), cardboard(''), cardboard(label), cardboard('')].map(t => new THREE.MeshStandardMaterial({ map: t, roughness: .85 }));
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); body.position.y = h / 2; body.castShadow = body.receiveShadow = true; g.add(body);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(w * .96, d * .96), M(0x5a3c20, { roughness: 1 })); inner.rotation.x = -Math.PI / 2; inner.position.y = h - .005; g.add(inner);
  const flapM = new THREE.MeshStandardMaterial({ map: cardboard(''), roughness: .85, side: THREE.DoubleSide });
  // клапаны: стоят вертикально от верхнего края, раскрыты наружу на угол от вертикали
  [[0, 1, w, d * .48, 1.05], [0, -1, w, d * .48, .8], [1, 0, d, w * .45, .45], [-1, 0, d, w * .45, .35]].forEach(([sx, sz, fw, fh, ang]) => {
    const fg = new THREE.PlaneGeometry(fw, fh); fg.translate(0, fh / 2, 0); if (sx) fg.rotateY(Math.PI / 2);
    const f = new THREE.Mesh(fg, flapM); f.castShadow = true; const piv = new THREE.Group();
    piv.position.set(sx * w / 2, h, sz * d / 2); g.add(piv); piv.add(f);
    if (sz) piv.rotation.x = sz * ang; else piv.rotation.z = -sx * ang;
  });
  boxes.push(g); return g;
}
cardBox(BOX_A, .46, .36, .42, 'ПЛЮШ', .25);
cardBox(BOX_B, .38, .3, .36, '', -.35);

// ——— робот-пылесос ———
export const vacuum = new THREE.Group(); scene.add(vacuum);
export const vacLed = new THREE.MeshStandardMaterial({ color: 0x38c8ff, emissive: 0x38c8ff, emissiveIntensity: 2.5 });
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .075, 48), new THREE.MeshPhysicalMaterial({ color: 0x2c2f36, roughness: .35, clearcoat: .8 })); body.position.y = .045; body.castShadow = true; vacuum.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.15, .16, .012, 48), new THREE.MeshPhysicalMaterial({ color: 0x15171c, roughness: .15, clearcoat: 1 })); top.position.y = .088; vacuum.add(top);
  const bump = new THREE.Mesh(new THREE.TorusGeometry(.17, .012, 8, 48, Math.PI * .9), M(0x9aa0aa, { roughness: .4 })); bump.rotation.x = Math.PI / 2; bump.rotation.z = Math.PI * .05; bump.position.y = .04; vacuum.add(bump);
  const led = new THREE.Mesh(new THREE.TorusGeometry(.05, .006, 8, 32), vacLed); led.rotation.x = Math.PI / 2; led.position.y = .095; vacuum.add(led);
  const eye = new THREE.Mesh(new RoundedBoxGeometry(.05, .016, .01, 2, .005), vacLed); eye.position.set(0, .07, .168); vacuum.add(eye);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .025, 24), M(0x40444c, { roughness: .3 })); lidar.position.set(0, .105, -.06); vacuum.add(lidar);
  vacuum.userData.brushes = [-1, 1].map(s => { const b = new THREE.Group(); b.position.set(s * .11, .012, .11); vacuum.add(b); for (let i = 0; i < 3; i++) { const br = rod(M(0x777777)); setRod(br, V(0, 0, 0), V(Math.cos(i * 2.1) * .06, 0, Math.sin(i * 2.1) * .06), .003); b.add(br); } return b; });
}
// x, направление (рад, 0 = +X), beep 0..1
export function poseVacuum(t, x, z, heading, beep = 0) {
  vacuum.position.set(x, 0, z); vacuum.rotation.y = -heading + Math.PI / 2;
  vacuum.userData.brushes.forEach((b, i) => b.rotation.y = t * 20 * (i ? 1 : -1));
  const on = beep > 0 && Math.floor(t * 12) % 2 === 0;
  vacLed.color.set(on ? 0xff4060 : 0x38c8ff); vacLed.emissive.set(on ? 0xff4060 : 0x38c8ff);
}

// ——— свет из окна: проецирует раму и струйки дождя (SpotLight.map) ———
const rainCan = document.createElement('canvas'); rainCan.width = rainCan.height = 256;
const rcx = rainCan.getContext('2d');
export const rainMap = new THREE.CanvasTexture(rainCan); rainMap.colorSpace = THREE.SRGBColorSpace;
export const winLight = new THREE.SpotLight(0x9cb8ff, 18, 0, .36, .35, 1.2);
winLight.position.set(WIN.x + .25, WIN.y + .55, ROOM.zF + 1.2); winLight.target.position.set(-.05, .75, -.6);
winLight.map = rainMap; winLight.castShadow = true; winLight.shadow.mapSize.set(1024, 1024); winLight.shadow.bias = -.0004; winLight.shadow.camera.near = .5; winLight.shadow.camera.far = 9;
scene.add(winLight, winLight.target);
const drops = Array.from({ length: 70 }, (_, i) => ({ x: hash(i * 3.1), sp: .25 + hash(i * 7.7) * .5, ph: hash(i * 1.3), r: 2 + hash(i * 5.3) * 4 }));
export function updateRoom(t) {
  rainGlass.uniforms.time.value = t;
  // карта света окна: рама (тёмные полосы) и капли, стекающие вниз
  const g = rcx; g.fillStyle = '#c8d4f0'; g.fillRect(0, 0, 256, 256);
  for (const d of drops) { const y = ((d.ph + t * d.sp * .5) % 1) * 300 - 20, x = d.x * 256 + Math.sin(y * .05 + d.ph * 9) * 3;
    g.fillStyle = 'rgba(40,50,80,.55)'; g.beginPath(); g.ellipse(x, y, d.r * .8, d.r, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,50,80,.22)'; g.fillRect(x - d.r * .3, y - 60, d.r * .6, 60); }
  g.fillStyle = '#05070c'; g.fillRect(122, 0, 12, 256); g.fillRect(0, 96, 256, 10);
  const vg = g.createRadialGradient(128, 128, 60, 128, 128, 180); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = vg; g.fillRect(0, 0, 256, 256);
  rainMap.needsUpdate = true;
  bulbs.forEach((b, i) => b.material.emissiveIntensity = 2.6 + .8 * Math.sin(t * 1.3 + i * 1.7));
}
