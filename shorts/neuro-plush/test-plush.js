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
globalThis.PLUSH_FV = +(P.get('fv') || 0);
const { plush } = await import('./plush.js');
plush.group.position.set(-.25, SEAT_Y, .08); plush.group.rotation.y = .3;
// заглушка вместо робота (капсула ~0.62 м)
const robot = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .62 - .28, 8, 24), M(0xf2f0ec, { roughness: .4 }));
robot.position.set(.2, SEAT_Y + .31, .04); robot.castShadow = robot.receiveShadow = true; scene.add(robot);
if (P.has('norobot')) robot.visible = false;
if (P.has('shells')) plush.rig.setShells(+P.get('shells'));
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
const shots = [
  /* 0 */ { name: 'two-shot', pos: V(-.03, .8, 1.95), look: V(-.03, .62, .05), k: { look: [.4, .1], smile: .3 }, t: 1.0 },
  /* 1 */ { name: 'face neutral', ...face(.08), k: {}, t: 0.3 },
  /* 2 */ { name: 'face talk', ...face(.08), k: { talk: .9, look: [.3, .05] }, t: 1.3 },
  /* 3 */ { name: 'face wide happy', ...face(.08), k: { wide: 1, smile: 1, talk: .4, earPerk: 1, blush: .6 }, t: 2.1 },
  /* 4 */ { name: 'face squint', ...face(.08), k: { squint: 1, pout: .5, look: [.5, 0], headTilt: .1 }, t: 0.7 },
  /* 5 */ { name: 'face earDown', ...face(.08), k: { earDown: 1, lid: .3, look: [0, -.4], pout: .4 }, t: 1.7 },
  /* 6 */ { name: 'face happy ^^', ...face(.08), k: { happy: 1, smile: 1, blush: 1, headTilt: -.15 }, t: 2.5 },
  /* 7 */ { name: 'face sleepy closed', ...face(.08), k: { closed: 1, nod: .15, earDown: .3 }, t: 3.0 },
  /* 8 */ { name: 'tuck shiver', ...body3(.12, .2, .62), k: { tuck: 1, shiver: 1, earDown: .4, lid: .3 }, t: 0.5 },
  /* 9 */ { name: 'rub', ...body3(.12, .2, .62), k: { rub: 1, look: [0, -.3], smile: .3 }, t: 0.4 },
  /* 10 */ { name: 'coverEar', ...body3(.05, .22, .62, .19), k: { coverEar: 1, squint: .6 }, t: 1.0 },
  /* 11 */ { name: 'reach', ...body3(.3, .25, .75, .16), k: { reach: { k: 1, at: [.3, .12, .1] }, look: [.8, -.2], earPerk: .7, mouthO: .4 }, t: 1.0 },
  /* 12 */ { name: 'groom', ...body3(.1, .2, .62, .17), k: { groom: 1 }, t: 1.2 },
  /* 13 */ { name: 'flinch', ...body3(.1, .2, .65, .17), k: { flinch: 1, wide: .6, mouthO: .5 }, t: 1.0 },
  /* 14 */ { name: 'proud', ...body3(.1, .2, .62, .17), k: { proud: 1, smile: .3 }, t: 1.0 },
  /* 15 */ { name: 'lie', ...body3(.25, .3, .6, .06), k: { lie: 1, closed: 1, purr: 1 }, t: 1.0 },
  /* 16 */ { name: 'back 3/4', ...body3(-.45, .3, -.45, .14), k: { tailSwish: .5 }, t: 1.0 },
  /* 17 */ { name: 'perf close-up 60%', ...face(.08, -.03, .78), k: { talk: .5 }, t: 1.0 },
  /* 18 */ { name: 'face side', ...face(.42, .0, .38), k: { talk: .5 }, t: 1.0 },
];
const out = document.getElementById('out'), cx = out.getContext('2d');
// замеры: 30 — без котёнка, 31 — котёнок без оболочек, 32 — 16 оболочек, 33 — 12 оболочек (тот же крупный план)
const perf = shots[17];
[{ nokit: 1 }, { shells: 0 }, { shells: 16 }, { shells: 12 }, { shells: 8 }].forEach((o, i) => { shots[30 + i] = { ...perf, ...o, name: 'perf ' + JSON.stringify(o) }; });
const gl = renderer.getContext(), px = new Uint8Array(4);
window.frameJPEG = (t, q = .9) => {
  const s = shots[Math.min(shots.length - 1, Math.floor(t))];
  plush.group.visible = !s.nokit && !P.has('nokit');
  if (s.shells !== undefined) plush.rig.setShells(s.shells); else if (!P.has('shells')) plush.rig.setShells(16);
  plush.pose(s.t ?? t, s.k || {});
  camera.position.copy(s.pos); camera.lookAt(s.look);
  const t0 = performance.now();
  composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  console.log('render', s.name, Math.round(performance.now() - t0), 'ms');
  cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
window.DUR = shots.length; window.ready = true;
