// Тест Плюша: node render.mjs --page "test.html?mod=test-plush.js" --shot 0,1,2 --dir out/test-plush
import { THREE, renderer, scene, camera, V, M } from './core.js';
import './lights.js';
import { SEAT_Y } from './lights.js';
import './testenv.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const P = new URLSearchParams(location.search);
const { plush } = await import('./plush.js');
plush.group.position.set(-.25, SEAT_Y, .08); plush.group.rotation.y = .3;
// заглушка вместо робота (капсула ~0.62 м)
const robot = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .62 - .28, 8, 24), M(0xf2f0ec, { roughness: .4 }));
robot.position.set(.2, SEAT_Y + .31, .04); robot.castShadow = robot.receiveShadow = true; scene.add(robot);
if (P.has('norobot')) robot.visible = false;
if (P.has('nokit')) plush.group.visible = false;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(540, 960), .35, .5, .9));
composer.addPass(new OutputPass());

// камера в координатах котёнка → мир
const KL = (x, y, z) => plush.group.localToWorld(V(x, y, z));
plush.group.updateMatrixWorld(true);
const face = (dx = 0, dy = 0, dist = .5) => ({ pos: KL(dx, .235 + dy, .015 + dist), look: KL(0, .222, .015) });
const body3 = (x, y, z, ly = .16) => ({ pos: KL(x, y, z), look: KL(0, ly, .02) });
// цели ползунка и касания из фильма (локальные координаты котёнка, как их считает main.js)
const SL0 = [.007, .086, .274], SL05 = [.061, .086, .291], SL2 = [.222, .086, .34], TOUCH = [.237, .12, .035];
const marker = new THREE.Mesh(new THREE.SphereGeometry(.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x40e0ff })); plush.group.add(marker); marker.visible = false;
const shots = [
  /* 0 */ { name: 'two-shot', pos: V(-.03, .8, 1.95), look: V(-.03, .62, .05), k: { look: [.4, .1], smile: .3, tailSwish: .5 }, t: 1.0 },
  /* 1 */ { name: 'face neutral', ...face(.08), k: {}, t: 0.3 },
  /* 2 */ { name: 'face talk', ...face(.08), k: { talk: .9, look: [.3, .05] }, t: 1.3 },
  /* 3 */ { name: 'face wide happy', ...face(.08), k: { wide: 1, smile: 1, talk: .4, earPerk: 1, blush: .6 }, t: 2.1 },
  /* 4 */ { name: 'face squint', ...face(.08), k: { squint: 1, pout: .5, look: [.5, 0], headTilt: .1 }, t: 0.7 },
  /* 5 */ { name: 'face earDown', ...face(.08), k: { earDown: 1, lid: .3, look: [0, -.4], pout: .4 }, t: 1.7 },
  /* 6 */ { name: 'face happy ^^', ...face(.08), k: { happy: 1, smile: 1, blush: 1, headTilt: -.15 }, t: 2.5 },
  /* 7 */ { name: 'face sleepy closed', ...face(.08), k: { closed: 1, nod: .15, earDown: .3 }, t: 3.0 },
  /* 8 */ { name: 'tuck shiver', ...body3(.12, .2, .62), k: { tuck: 1, shiver: 1, earDown: .4, lid: .3 }, t: 0.5 },
  /* 9 */ { name: 'rub', ...body3(.12, .2, .62), k: { rub: 1, look: [0, -.3], smile: .3 }, t: 0.4 },
  /* 10 */ { name: 'coverEar front', pos: KL(0, .23, .75), look: KL(-.02, .2, .02), k: { coverEar: 1, squint: .6 }, t: 1.0 },
  /* 11 */ { name: 'reach test', pos: KL(.2, .26, .9), look: KL(.13, .15, .05), k: { reach: { k: 1, at: [.3, .12, .1] }, look: [.8, -.2], earPerk: .7, mouthO: .4 }, t: 1.0 },
  /* 12 */ { name: 'groom', ...body3(.1, .2, .62, .17), k: { groom: 1 }, t: 1.2 },
  /* 13 */ { name: 'flinch', ...body3(.1, .2, .65, .17), k: { flinch: 1, wide: .6, mouthO: .5 }, t: 1.0 },
  /* 14 */ { name: 'proud', ...body3(.1, .2, .62, .17), k: { proud: 1, smile: .3 }, t: 1.0 },
  /* 15 */ { name: 'lie', ...body3(.25, .3, .6, .06), k: { lie: 1, closed: 1, purr: 1 }, t: 1.0 },
  /* 16 */ { name: 'back 3/4', ...body3(-.45, .3, -.45, .14), k: { tailSwish: .5 }, t: 1.0 },
  /* 17 */ { name: 'perf close-up 60%', ...face(.08, -.03, .78), k: { talk: .5 }, t: 1.0 },
  /* 18 */ { name: 'face side', ...face(.42, .0, .38), k: { talk: .5 }, t: 1.0 },
  /* 19 */ { name: "film reach slider lv0", pos: KL(.42, .3, .78), look: KL(.02, .13, .14), k: { reach: { k: 1, at: SL0 }, look: [0, -.3] }, t: 1, mark: SL0 },
  /* 20 */ { name: "film reach slider lv2", pos: KL(.62, .34, .9), look: KL(.11, .13, .19), k: { reach: { k: 1, at: SL2 }, look: [.5, -.3] }, t: 1, mark: SL2 },
  /* 21 */ { name: "film touch Neuro", pos: KL(.2, .34, .82), look: KL(.12, .14, .03), k: { reach: { k: 1, at: TOUCH }, look: [.8, -.1], headTurn: .6, wide: .5 }, t: 1, mark: TOUCH },
  /* 22 */ { name: 'earBack only front', ...face(.0, .02, .6), k: { earBack: 1 }, t: .3 },
  /* 23 */ { name: 'film flinch', ...body3(.0, .22, .65, .17), k: { flinch: 1, earBack: 1, wide: 1 }, t: 1 },
  /* 24 */ { name: 'lid .85 talk (S11)', ...face(.08), k: { lid: .85, talk: .5 }, t: 1 },
  /* 25 */ { name: 'sly S4', ...face(.08), k: { squint: .35, smile: .6, headTilt: .15 }, t: 1 },
  /* 26 */ { name: 'blink .5', ...face(.08), k: { blink: .5 }, t: .3 },
  /* 27 */ { name: 'closed .5', ...face(.08), k: { closed: .5 }, t: .3 },
  /* 28 */ { name: 'closed .8', ...face(.08), k: { closed: .8 }, t: .3 },
  /* 29 */ { name: 'lookUp mouthO', ...face(.08), k: { lookUp: 1, mouthO: 1 }, t: 1 },
  /* 30 */ { name: 'film lap lie', pos: KL(.25, .45, .55), look: KL(0, .05, .05), k: { lie: 1, closed: 1, smile: .6, purr: 1, tailSwish: .2 }, t: 1 },
  /* 31 */ { name: 'groom closed .7 film', ...body3(.1, .2, .62, .17), k: { groom: 1, closed: .7 }, t: 1.2 },
  /* 32 */ { name: 'tailUp proud front', ...body3(0, .2, .7, .16), k: { tailUp: 1, proud: 1 }, t: 1 },
  /* 33 */ { name: 'top-down stripes', pos: KL(-.05, .75, -.12), look: KL(0, .1, -.02), k: { nod: .3 }, t: 1 },
  /* 34 */ { name: 'turn .9 look 3/4', ...body3(.15, .25, .6, .2), k: { headTurn: .9, nod: -.5, look: [1, .6] }, t: .3 },
  /* 35 */ { name: 'smile 1', ...face(.08), k: { smile: 1 }, t: 1 },
  /* 36 */ { name: 'happy .7 smile (S10)', ...face(.08), k: { happy: .7, smile: .8, blush: .5, earPerk: 1 }, t: 1 },
  /* 37 */ { name: "film reach .5 lv.5", pos: KL(.45, .3, .8), look: KL(.04, .13, .15), k: { reach: { k: .5, at: SL05 } }, t: 1, mark: SL05 },
  /* 38 */ { name: 'film 3/4 two-shot', pos: V(.25, .75, 1.1), look: V(-.15, .62, .05), k: { talk: .6, headTurn: .5, look: [.6, .2] }, t: 1 },
  /* 39 */ { name: 'side profile closed', ...face(.42, .0, .38), k: { closed: 1, smile: .4 }, t: 1.0 },
];
// 46–48: цели фильма сбоку/спереди, чтобы видеть позу всего тела
shots[46] = { name: 'film reach lv2 side', pos: KL(1.3, .3, .2), look: KL(.08, .14, .15), k: { reach: { k: 1, at: SL2 }, look: [.5, -.3] }, t: 1, mark: SL2, norobot: 1 };
shots[47] = { name: 'film touch 3/4', pos: KL(.3, .35, 1.1), look: KL(.12, .13, .05), k: { reach: { k: 1, at: TOUCH }, look: [.8, -.1], headTurn: .6, wide: .5 }, t: 1, mark: TOUCH, norobot: 1 };
shots[48] = { name: 'film reach lv0 side', pos: KL(1.1, .3, .15), look: KL(.02, .14, .12), k: { reach: { k: 1, at: SL0 }, look: [0, -.3] }, t: 1, mark: SL0, norobot: 1 };
shots[49] = { name: 'film reach lv0 camera', pos: V(.25, .75, 1.1), look: V(-.12, .58, .2), k: { reach: { k: 1, at: SL0 }, look: [0, -.3] }, t: 1, mark: SL0 };
// 53/54: ракурсы фильма (S6 умывание, S4 закрытое ухо) — камера main.js в координатах котёнка
shots[53] = { name: 'film S6 groom', pos: KL(-.12, .28, .93), look: KL(.013, .19, .025), k: { groom: 1, closed: .7 }, t: 1.2 };
shots[54] = { name: 'film S4 coverEar', pos: KL(-.07, .29, .9), look: KL(.013, .24, .025), k: { coverEar: 1, squint: .2, earDown: .1 }, t: 1.0 };
const out = document.getElementById('out'), cx = out.getContext('2d');
// замеры (тот же крупный план): 40 — без котёнка, 41 — котёнок без оболочек, 42/43/44 — 16/12/8 оболочек, 45 — авто
const perf = shots[17];
[{ nokit: 1 }, { shells: 0 }, { shells: 16 }, { shells: 12 }, { shells: 8 }, { shells: 'auto' }].forEach((o, i) => { shots[40 + i] = { ...perf, ...o, name: 'perf ' + JSON.stringify(o) }; });
// дальний план (двойной план фильма): без котёнка / 16 оболочек / авто
const far = shots[0];
[{ nokit: 1 }, { shells: 16 }, { shells: 'auto' }].forEach((o, i) => { shots[50 + i] = { ...far, ...o, name: 'far ' + JSON.stringify(o) }; });
const gl = renderer.getContext(), px = new Uint8Array(4);
const f3 = v => v.toArray().map(x => x.toFixed(3)).join(',');
function setup(s, t) {
  plush.group.visible = !s.nokit && !P.has('nokit');
  robot.visible = !s.norobot && !P.has('norobot');
  plush.rig.setShells(P.has('shells') ? +P.get('shells') : s.shells ?? 'auto');
  plush.pose(s.t ?? t, s.k || {});
  marker.visible = !!s.mark; if (s.mark) marker.position.set(...s.mark);
  camera.position.copy(s.pos); camera.lookAt(s.look);
}
window.frameJPEG = (t, q = .9) => {
  if (t >= 99) console.log('CHECKS', window.checks());   // --shot 99: проверки чистоты и промахов лапы
  const s = shots[Math.min(shots.length - 1, Math.floor(t))] || shots[0];
  setup(s, t);
  const t0 = performance.now();
  composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  console.log('render', s.name, Math.round(performance.now() - t0), 'ms', 'shells', plush.rig.FU.uShells.value);
  if (s.k?.reach) {
    const rp = plush.group.worldToLocal(plush.pawWorld('reach')), at = V(...s.k.reach.at);
    console.log('reach paw', f3(rp), 'target', f3(at), 'miss', rp.distanceTo(at).toFixed(3), 'R==reach', plush.pawWorld('R').distanceTo(plush.pawWorld('reach')) < 1e-6);
  }
  if (P.has('bench')) console.log('bench', s.name, window.bench(t, +P.get('bench') || 3), 'ms best, shells', plush.rig.FU.uShells.value);
  cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
// замер: минимальное время кадра (поза + рендер + синхронизация) из n повторов, без кодирования JPEG
window.bench = (t, n = 5) => {
  const s = shots[Math.floor(t)]; let best = 1e9;
  for (let i = 0; i < n; i++) {
    const t0 = performance.now();
    setup(s, t);
    composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    best = Math.min(best, performance.now() - t0);
  }
  return Math.round(best);
};
// проверка чистоты pose и промаха лапы по целям фильма
window.checks = () => {
  const snap = () => { const o = []; plush.group.updateMatrixWorld(true); plush.group.traverse(m => { o.push(...m.matrixWorld.elements, m.visible ? 1 : 0); if (m.morphTargetInfluences) o.push(...m.morphTargetInfluences); }); for (const k in plush.rig.FU) { const v = plush.rig.FU[k].value; if (typeof v === 'number') o.push(v); else if (v && v.isVector4) o.push(...v.toArray()); } return o; };
  const A = { talk: .4, look: [.3, .1], smile: .3, tailSwish: .5 };
  plush.pose(1.234, A); const s1 = snap();
  plush.pose(7.7, { lie: 1, reach: { k: 1, at: SL2 }, coverEar: 1, flinch: 1, groom: 1, happy: 1, talk: 1.2, closed: 1, mouthO: 1, pout: 1 }); plush.pose(.1, {});
  plush.pose(1.234, A); const s2 = snap();
  let md = 0; for (let i = 0; i < s1.length; i++) md = Math.max(md, Math.abs(s1[i] - s2[i]));
  const res = { purity: md, len: s1.length, reach: {} };
  for (const [n, at] of Object.entries({ SL0, SL05, SL2, TOUCH })) for (const kk of [.5, 1]) {
    plush.pose(1, { reach: { k: kk, at } }); const rp = plush.group.worldToLocal(plush.pawWorld('reach'));
    res.reach[n + '@' + kk] = +rp.distanceTo(V(...at)).toFixed(3);
  }
  // непрерывность по x цели около нуля (не должна меняться лапа)
  const xs = [-.01, -.002, .002, .01].map(x => { plush.pose(1, { reach: { k: 1, at: [x, .086, .274] } }); return f3(plush.group.worldToLocal(plush.pawWorld('R'))); });
  res.xsweep = xs;
  return JSON.stringify(res);
};
window.DUR = shots.length; window.ready = true;
