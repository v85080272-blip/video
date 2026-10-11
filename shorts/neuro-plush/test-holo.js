import { THREE, renderer, scene, camera, V, M, sph, W, H } from './core.js';
import './lights.js';
import { SEAT_Y } from './lights.js';
import { updateRoom, poseVacuum, VAC_Z } from './room.js';
import { slider, icons, map, big, cost, drawSlider, drawIcons, drawMap, drawBig, drawCost, place } from './holo.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const a = sph(.14, M(0xe8893a, { roughness: .8 })); a.position.set(-.25, SEAT_Y + .14, .08); scene.add(a);
const b = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .3, 6, 16), M(0xf2f0ec, { roughness: .3 })); b.position.set(.2, SEAT_Y + .31, .04); b.castShadow = true; scene.add(b);
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(540, 960), .35, .5, .9)); composer.addPass(new OutputPass());
const out = document.getElementById('out'), cx = out.getContext('2d');
window.frameJPEG = (t, q = .9) => {
  camera.fov = 35; camera.updateProjectionMatrix();
  const i = Math.floor(t);
  [slider, icons, map, big, cost].forEach(p => p.m.visible = false);
  if (i === 0) { camera.position.set(-.02, .8, 2.0); camera.lookAt(-.02, .7, 0); drawSlider(t, { lv: 1.6, dots: 1, title: 1 }); place(slider, V(-.03, .62, .32), 1, camera); drawIcons(t, { l: 1, r: 1 }); place(icons, V(-.02, 1.0, .25), 1, camera); }
  if (i === 1) { camera.position.set(.0, .95, 1.5); camera.lookAt(-.02, .75, 0); drawMap(t, { routes: { A: 1, B: 1, C: .8 }, marks: { A: 1, B: 1, C: 1 }, vacX: -.6 }); place(map, V(-.02, .82, .3), 1, camera); }
  if (i === 2) { camera.position.set(0, 1.0, 2.6); camera.lookAt(0, 1.05, 0); drawBig(t, { grow: .8, scout: .55, vacX: -.3 }); place(big, V(0, 1.42, -.05), 1, camera); drawCost(t, { clock: 1, res: 1, check: 1 }); place(cost, V(-.02, .68, .32), 1, camera); }
  updateRoom(t * 3 + 5); poseVacuum(t, -.4, VAC_Z, 0, 0);
  composer.render(); cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
window.DUR = 3; window.ready = true;
