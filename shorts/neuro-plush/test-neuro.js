// Проверка Нейро: node render.mjs --page "test.html?mod=test-neuro.js" --shot 0,1,2 --dir out/test-neuro
// Расстановка как в фильме (main.js): Нейро (0.17, SEAT_Y, 0.04) rotY −0.2, Плюш (−0.2, SEAT_Y, 0.08) rotY 0.3;
// на коленях — настоящий plush.js в позе { lie, closed, purr, smile: .5 }, rotY 0.3 (как после S11).
import { THREE, renderer, scene, camera, V, sph, W, H, clamp } from './core.js';
import './lights.js';
import { SEAT_Y } from './lights.js';
import './testenv.js';
import { neuro } from './neuro.js';
import { plush } from './plush.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const NEU_POS = V(.17, SEAT_Y, .04), NEU_ROT = -.2, CAT_SEAT = V(-.2, SEAT_Y, .08), CAT_ROT = .3;
const SL_POS = V(0, .565, .33), MAP_POS = V(.08, .6, .5), ICON_POS = V(0, 1.12, .2);
neuro.group.position.copy(NEU_POS); neuro.group.rotation.y = NEU_ROT;

// взгляд как в main.js (neuAim)
function aim(g, pW, headY) { g.updateMatrixWorld(true); const d = g.worldToLocal(pW.clone()); return { yaw: Math.atan2(d.x, d.z), pitch: Math.atan2(d.y - headY, Math.hypot(d.x, d.z)) }; }
const neuAim = (pW, amt = 1) => { const a = aim(neuro.group, pW, .48); return { headTurn: clamp(a.yaw * .65 * amt, -.9, .9), nod: clamp(-a.pitch * .6 * amt, -.5, .5), look: [clamp(a.yaw * .9, -1, 1), clamp(a.pitch * 1.2, -1, 1)] }; };
const lapW = () => { neuro.group.updateMatrixWorld(true); return neuro.group.localToWorld(neuro.lapLocal.clone()); };
const catHead = () => plush.headWorld();

function placeCat(mode, t, extra = {}) {
  plush.group.visible = mode !== 'none';
  if (mode === 'lie') {
    plush.group.position.copy(lapW()); plush.group.rotation.set(0, CAT_ROT, 0);
    plush.pose(t, { lie: 1, closed: 1, purr: 1, smile: .5, earPerk: 0, tailSwish: .2, ...extra });
  } else {
    plush.group.position.copy(CAT_SEAT); plush.group.rotation.set(0, CAT_ROT, 0);
    plush.pose(t, { smile: .3, tailSwish: .5, headTurn: .25, look: [.5, .3], ...extra });
  }
  plush.group.updateMatrixWorld(true);
}
const marker = sph(.01, new THREE.MeshBasicMaterial({ color: 0x66ffcc })); marker.visible = false; scene.add(marker);

const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(540, 960), .35, .5, .9)); composer.addPass(new OutputPass());
const out = document.getElementById('out'), cx = out.getContext('2d');

const TWO = { pos: V(-.02, .84, 2.15), look: V(-.02, .74, .05), fov: 35 };   // общий двуплан фильма (P2)
const face = (d = 1.2, yaw = 0, dy = .02, fov = 30) => ({ face: { d, yaw, dy }, fov });
const med = (d = 1.55, yaw = 0, dy = .05, ly = -.18) => ({ face: { d, yaw, dy, ly }, fov: 35 });
const abs = (p, l, fov = 35) => ({ pos: p, look: l, fov });
const S1 = [-.19, .14, .29], S3 = [-.12, .13, .3];   // точки ползунка из main.js
const shots = [
  { ...TWO, cat: 'sit', k: () => ({ talk: .6, smile: .3, soft: .3, ...neuAim(catHead(), .7) }) },          // 0 двуплан как в фильме
  { ...face(), k: { talk: .7 } },                                                         // 1 нейтрально, говорит (замер: сравни с 22)
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
  { ...med(1.6, -.45), k: { handR: { k: 1, at: [-.25, .25, .25] }, look: [-.6, -.3], headTurn: -.35 }, marker: [-.25, .25, .25] }, // 14 ползунок (тест)
  { ...med(1.4, .15), cat: 'lie', k: () => ({ hold: .4, pet: 1, soft: 1, smile: .9, warm: .85, ...neuAim(lapW().add(V(0, .08, 0))) }) }, // 15 гладит (как в финале)
  { ...med(1.4, .1), cat: 'lie', k: { hold: .8, warm: 1, happy: 1, smile: 1, nod: .3 } },  // 16 обнимает, тёплая
  { ...med(1.6, .75), k: { talk: .4, smile: .5 } },                                       // 17 вид 3/4
  { ...med(1.5, 1.75, .25), k: {} },                                                      // 18 сбоку
  { ...face(1.1, .55), k: { smile: .6, look: [.3, 0] } },                                 // 19 лицо 3/4
  { ...med(1.4, .1), cat: 'none', k: { warm: 1, smile: .6 } },                            // 20 тёплая
  { ...med(1.4, .1), cat: 'none', k: { warm: 0, smile: .6 } },                            // 21 то же без тепла (сравнение)
  { ...face(), k: { talk: .7 }, hide: true },                                             // 22 крупный план без Нейро (замер: сравни с 1)
  { ...face(), k: { happy: .5, smile: .5, blink: .3 } },                                  // 23 промежуточные значения ключей
  { ...face(), k: { think: .5, look: [.2, .3] } },                                        // 24
  { ...face(), k: { glitch: .5, wide: .5 } },                                             // 25
  { ...face(), k: { squint: .5, puzzled: .5, talk: .3 } },                                // 26
  { ...med(), k: { explain: .5, present: .5, talk: .5 } },                                // 27
  { ...TWO, cat: 'sit', k: {}, hide: true },                                              // 28 общий без Нейро (замер: сравни с 0)
  // кадры фильма (камеры из main.js)
  { ...abs(V(.15, 1.0, 2.85), V(-.03, .74, .06)), cat: 'sit', k: () => ({ soft: .3, ...neuAim(catHead()), handR: { k: 1, at: S1 } }), marker: S1 },   // 29 конец S1 (t≈5.6)
  { cam: h => [h.clone().add(V(-.18, .02, 1.0)), h.clone().add(V(-.02, -.06, 0))], fov: 34, cat: 'sit', k: () => ({ smile: .3, soft: .4, ...neuAim(SL_POS, .8), handR: { k: 1, at: S3 } }), marker: S3 }, // 30 S3 крупно (t≈12.2)
  { ...abs(V(.03, .95, 1.46), V(.12, .74, .1), 34), cat: 'lie', k: () => ({ soft: 1, smile: .9, pet: 1, hold: .4, warm: .85, ...neuAim(lapW().add(V(0, .08, 0))) }) }, // 31 финал: гладит (t≈86.5)
  { ...abs(V(.02, .98, 1.95), V(.06, .8, .1)), cat: 'lie', k: () => ({ ...neuAim(lapW().add(V(0, .08, 0))), glitch: 1, wide: .8, puzzled: .4, hold: .6, warm: .85, smile: 0 }) }, // 32 «зависла» с котом (S11)
  { ...face(), k: { think: .4, look: [.2, .3], talk: .4 } },                              // 33 думает .4 и говорит
  { ...face(), k: { think: .8, look: [-.2, .4] } },                                       // 34 думает .8
  { ...abs(V(.04, 1.12, 2.35), V(.02, .78, .1), 36), cat: 'sit', k: () => ({ ...neuAim(MAP_POS), think: .5, explain: .4, talk: .5 }) }, // 35 S7: думает .5, общий
  { ...abs(V(.13, .77, 1.06), V(-.08, .63, .08), 34), cat: 'reach', k: () => ({ ...neuAim(MAP_POS), think: .7, warm: .85 }) }, // 36 S10: кот трогает бок
  { ...abs(V(.03, .95, 1.5), V(.12, .74, .1), 34), cat: 'lie', k: () => ({ ...neuAim(lapW().add(V(0, .08, 0))), puzzled: .7, hold: .7, warm: .85, soft: .3 }) }, // 37 S12 до поглаживания (t≈80.6)
  { ...abs(V(-.04, .8, 1.62), V(-.05, .64, .15), 34), cat: 'sit', k: () => ({ ...neuAim(catHead()), soft: .5, smile: .3, handR: { k: 1, at: S1 } }) }, // 38 S2: кот у ползунка
  { ...abs(V(-.02, 1.0, 2.75), V(-.02, .86, .06), 36), cat: 'sit', k: () => ({ explain: .8, talk: .6, smile: .3, ...neuAim(ICON_POS.clone().add(V(-.06, 0, 0)), .6), handR: { k: .3, at: S3 } }) }, // 39 S5 объясняет
  { ...abs(V(.03, .95, 1.46), V(.12, .74, .1), 34), cat: 'lie', tOff: .45, k: () => ({ soft: 1, smile: .9, pet: 1, hold: .4, warm: .85, ...neuAim(lapW().add(V(0, .08, 0))) }) }, // 40 финал, другая фаза поглаживания
  { ...face(), k: { think: .12, look: [.2, .3] } },                                       // 41 переход в «думает» (как при нарастании ключа)
  { ...face(), k: { think: .22, blink: .5, smile: .3 } },                                 // 42 переход + моргание
  { ...face(), k: { think: .7, glitch: .5 } },                                            // 43 думает + глюк
];
let cur = 0;
window.frameJPEG = (t, q = .9) => {
  const i = Math.min(shots.length - 1, Math.floor(t)), s = shots[i], tt = 2 + (t - i) * 3 + (s.tOff || 0);
  cur = i;
  const cm = s.cat || 'none';
  if (cm === 'reach') { neuro.pose(tt, {}); neuro.group.updateMatrixWorld(true); placeCat('sit', tt); placeCat('sit', tt, { reach: { k: 1, at: plush.group.worldToLocal(neuro.group.localToWorld(V(-.13, .12, .03))).toArray() }, wide: .5, smile: .5, blush: .5, earPerk: 1 }); }
  else placeCat(cm, tt);
  const k = typeof s.k === 'function' ? s.k() : (s.k || {});
  neuro.pose(tt, k); neuro.group.visible = !s.hide;
  if (cm === 'lie') placeCat('lie', tt);
  marker.visible = !!s.marker; if (s.marker) { marker.position.copy(neuro.group.localToWorld(V(...s.marker))); console.log('handR miss (m):', neuro.handWorld('R').distanceTo(marker.position).toFixed(4)); }
  camera.fov = s.fov; camera.updateProjectionMatrix();
  const hw = neuro.headWorld();
  if (s.cam) { const [p, l] = s.cam(hw); camera.position.copy(p); camera.lookAt(l); }
  else if (s.face) {
    const a = -.2 + s.face.yaw, tgt = hw.clone().add(V(0, s.face.ly || 0, 0));
    camera.position.copy(tgt).add(V(Math.sin(a) * s.face.d, s.face.dy, Math.cos(a) * s.face.d)); camera.lookAt(tgt);
  } else { camera.position.copy(s.pos); camera.lookAt(s.look); }
  composer.render(); cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
window.__T = { THREE, neuro, plush, scene, camera, composer, renderer, shots, V, lapW };
window.DUR = shots.length; window.ready = true;
