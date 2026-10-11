// Проверка Нейро: node render.mjs --page "test.html?mod=test-neuro.js" --shot 0,1,2 --dir out/test-neuro
import { THREE, renderer, scene, camera, V, M, sph, W, H } from './core.js';
import './lights.js';
import { SEAT_Y } from './lights.js';
import './testenv.js';
import { neuro } from './neuro.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

neuro.group.position.set(.2, SEAT_Y, .04); neuro.group.rotation.y = -.2;

// заглушка котёнка ~0.3 м: сидит слева, либо лежит на коленях у Нейро
const kitM = M(0xe8893a, { roughness: .8 }), kitW = M(0xfff4ea, { roughness: .8 });
const kit = new THREE.Group(); scene.add(kit);
const kSit = new THREE.Group(); kit.add(kSit);
{ const b = sph(.105, kitM); b.scale.set(1, 1.05, .95); b.position.y = .105; kSit.add(b);
  const h = sph(.092, kitM); h.position.y = .25; kSit.add(h);
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.ConeGeometry(.032, .07, 12), kitM); e.position.set(s * .055, .325, 0); e.rotation.z = -s * .25; e.castShadow = true; kSit.add(e); });
  const m = sph(.05, kitW); m.scale.set(1, .7, .6); m.position.set(0, .225, .075); kSit.add(m); }
const kLie = new THREE.Group(); kit.add(kLie);
{ const b = sph(.1, kitM); b.scale.set(1.25, .72, .95); b.position.y = .068; kLie.add(b);
  const h = sph(.075, kitM); h.position.set(-.1, .085, .05); kLie.add(h);
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.ConeGeometry(.026, .055, 12), kitM); e.position.set(-.1 + s * .045, .155, .04); e.rotation.z = -s * .3; kLie.add(e); }); }
function kitMode(m) {
  kSit.visible = m === 'sit'; kLie.visible = m === 'lie';
  if (m === 'sit') { kit.position.set(-.25, SEAT_Y, .08); kit.rotation.set(0, .3, 0); }
  else { neuro.group.updateMatrixWorld(true); kit.position.copy(neuro.group.localToWorld(neuro.lapLocal.clone())); kit.rotation.set(0, -.2, 0); }
}
const marker = sph(.012, new THREE.MeshBasicMaterial({ color: 0x66ffcc })); marker.visible = false; scene.add(marker);

const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(540, 960), .35, .5, .9)); composer.addPass(new OutputPass());
const out = document.getElementById('out'), cx = out.getContext('2d');

const TWO = { pos: V(-.02, .82, 2.1), look: V(-.02, .72, 0), fov: 35 };
const face = (d = 1.2, yaw = 0, dy = .02, fov = 30) => ({ face: { d, yaw, dy }, fov });
const med = (d = 1.55, yaw = 0, dy = .05, ly = -.18) => ({ face: { d, yaw, dy, ly }, fov: 35 });
const shots = [
  { ...TWO, k: { talk: .6, smile: .3, look: [-.4, 0], headTurn: -.15 } },               // 0 два персонажа как в фильме
  { ...face(), k: { talk: .7 } },                                                         // 1 нейтрально, говорит
  { ...face(), k: { smile: 1 } },                                                         // 2 улыбка
  { ...face(), k: { happy: 1, smile: 1 } },                                               // 3 ^^
  { ...face(), k: { wide: 1 } },                                                          // 4 широко
  { ...face(), k: { squint: 1 } },                                                        // 5 прищур
  { ...face(), k: { soft: 1, smile: .5 } },                                               // 6 нежно
  { ...face(), k: { puzzled: 1 } },                                                       // 7 недоумение
  { ...face(), k: { think: 1, look: [.3, .4] } },                                         // 8 думает
  { ...face(), k: { glitch: 1 } },                                                        // 9 глюк
  { ...face(), k: { blush: 1, smile: .7, soft: .4 } },                                    // 10 румянец
  { ...med(), k: { explain: 1, talk: .6 } },                                              // 11 объясняет
  { ...med(1.7, .55), k: { point: 1, headTurn: -.3, look: [-.5, .1] } },                  // 12 указывает
  { ...med(), k: { present: 1, happy: 1, smile: 1 } },                                    // 13 «вот, готово!»
  { ...med(1.6, -.45), k: { handR: { k: 1, at: [-.25, .25, .25] }, look: [-.6, -.3], headTurn: -.35 }, marker: [-.25, .25, .25] }, // 14 ползунок
  { ...med(1.4, .15), kit: 'lie', k: { hold: 1, pet: 1, soft: 1, smile: .6, nod: .35 } }, // 15 обнимает и гладит
  { ...med(1.4, .1), kit: 'lie', k: { hold: 1, warm: 1, happy: 1, smile: 1, nod: .3 } },  // 16 тёплая
  { ...med(1.6, .75), k: { talk: .4, smile: .5 } },                                       // 17 вид 3/4
  { ...med(1.5, 1.75, .25), k: {} },                                                            // 18 со спины-сбоку
  { ...face(1.1, .55), k: { smile: .6, look: [.3, 0] } },                                 // 19 лицо 3/4
  { ...med(1.4, .1), kit: 'sit', k: { warm: 1, smile: .6 } },                             // 20 тёплая без кота
  { ...med(1.4, .1), kit: 'sit', k: { warm: 0, smile: .6 } },                             // 21 то же без тепла (сравнение)
  { ...face(), k: { talk: .7 }, hide: true, timing: 1 },                                           // 22 крупный план без Нейро (замер времени)
  { ...face(), k: { happy: .5, smile: .5, blink: .3 } },                                  // 23 промежуточные значения
  { ...face(), k: { think: .5, look: [.2, .3] } },                                        // 24
  { ...face(), k: { glitch: .5, wide: .5 } },                                             // 25
  { ...face(), k: { squint: .5, puzzled: .5, talk: .3 } },                                // 26
  { ...med(), k: { explain: .5, present: .5, talk: .5 } },                                // 27
  { ...TWO, k: { talk: .6, smile: .3, look: [-.4, 0], headTurn: -.15 }, hide: true },     // 28 общий без Нейро (замер)
  { ...face(), k: { talk: .7 }, perf: { iridescence: 0 } },                               // 29 замер без иридесценции
  { ...face(), k: { talk: .7 }, perf: { iridescence: 0, sheen: 0 } },                     // 30 замер без иридесценции и sheen
  { ...face(), k: { talk: .7 }, perf: { iridescence: 0, sheen: 0, clearcoat: 0 } },       // 31 замер без всего
  { ...face(), k: { talk: .7 }, perf: { light: false } },                                 // 32 замер без тёплого прожектора
  { ...face(), k: { talk: .7 }, perf: { std: true } },                                    // 33 замер: все материалы Standard
  { ...face(), k: { talk: .7 }, perf: { hideVisor: true } },                              // 34 замер: без стекла
];
// замер: переключение свойств материалов на лету (perf: {iridescence:0, ...})
const physMats = new Set(); neuro.group.traverse(o => { if (o.material && o.material.isMeshPhysicalMaterial) physMats.add(o.material); });
const orig = new Map([...physMats].map(m => [m, { iridescence: m.iridescence, sheen: m.sheen, clearcoat: m.clearcoat }]));
let spot = null; neuro.group.traverse(o => { if (o.isSpotLight) spot = o; });
const stdM = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: .3 }), origMat = new Map(); neuro.group.traverse(o => { if (o.isMesh) origMat.set(o, o.material); });
function applyPerf(p) { spot.visible = !(p && p.light === false); for (const [o, m] of origMat) o.material = p && p.std ? stdM : m; neuro.group.traverse(o => { if (o.isMesh && p && p.hideVisor && origMat.get(o) && origMat.get(o).emissiveMap) o.visible = false; else if (o.isMesh) o.visible = true; }); for (const m of physMats) { const o = orig.get(m); for (const key of ['iridescence', 'sheen', 'clearcoat']) m[key] = p && key in p ? p[key] * (o[key] > 0 ? 1 : 0) : o[key]; } }
window.frameJPEG = (t, q = .9) => {
  const i = Math.min(shots.length - 1, Math.floor(t)), s = shots[i], tt = 2 + (t - i) * 3;
  const tp0 = performance.now(); neuro.pose(tt, s.k || {}); neuro.group.visible = !s.hide; if (s.timing) console.log("pose ms", (performance.now() - tp0).toFixed(1));
  kitMode(s.kit || 'sit'); applyPerf(s.perf);
  marker.visible = !!s.marker; if (s.marker) { marker.position.copy(neuro.group.localToWorld(V(...s.marker))); console.log('handR miss (m):', neuro.handWorld('R').distanceTo(marker.position).toFixed(4)); }
  camera.fov = s.fov; camera.updateProjectionMatrix();
  if (s.face) {
    const hw = neuro.headWorld(), a = -.2 + s.face.yaw, tgt = hw.clone().add(V(0, s.face.ly || 0, 0));
    camera.position.copy(tgt).add(V(Math.sin(a) * s.face.d, s.face.dy, Math.cos(a) * s.face.d)); camera.lookAt(tgt);
  } else { camera.position.copy(s.pos); camera.lookAt(s.look); }
  composer.render(); cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
window.DUR = shots.length; window.ready = true;
