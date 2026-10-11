// Проверка гостиной: node render.mjs --page "test.html?mod=test-room.js" --shot 0,1,2,3 --dir out/test-room
import { THREE, renderer, scene, camera, V, M, sph, W, H } from './core.js';
import './lights.js';
import { SEAT_Y } from './lights.js';
import { updateRoom, poseVacuum, VAC_Z, WIN, RADIATOR } from './room.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const a = sph(.14, M(0xe8893a, { roughness: .8 })); a.position.set(-.25, SEAT_Y + .14, .08); scene.add(a);
const b = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .3, 6, 16), M(0xf2f0ec, { roughness: .3 })); b.position.set(.2, SEAT_Y + .31, .04); b.castShadow = true; scene.add(b);
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera)); composer.addPass(new UnrealBloomPass(new THREE.Vector2(540, 960), .35, .5, .9)); composer.addPass(new OutputPass());
const out = document.getElementById('out'), cx = out.getContext('2d');
const shots = [
  { pos: V(-.02, .82, 2.1), look: V(-.02, .72, 0), fov: 35 },        // два персонажа спереди
  { pos: V(.9, 1.55, 4.1), look: V(-.1, .55, .2), fov: 40 },          // общий план от окна
  { pos: V(-.15, .78, .45), look: V(.25, .45, 4.0), fov: 42 },        // путь к батарее с дивана
  { pos: V(.3, 1.3, 3.3), look: V(.35, 1.3, 4.6), fov: 38 },          // стекло с дождём
];
window.frameJPEG = (t, q = .9) => {
  const s = shots[Math.min(shots.length - 1, Math.floor(t))];
  camera.fov = s.fov; camera.updateProjectionMatrix(); camera.position.copy(s.pos); camera.lookAt(s.look);
  updateRoom(t * 3 + 5); poseVacuum(t, -.4 + t * .3, VAC_Z, 0, 0);
  composer.render(); cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
window.DUR = shots.length; window.ready = true;
