// Образец тестовой страницы: node render.mjs --page "test.html?mod=test-sample.js" --shot 0,1 --dir out/test-sample
import { THREE, renderer, scene, camera, V, M, sph } from './core.js';
import './lights.js';
import { SEAT_Y } from './lights.js';
import './testenv.js';
const a = sph(.15, M(0xff9a4a)); a.position.set(-.3, SEAT_Y + .15, .05); scene.add(a);
const b = sph(.2, M(0xf2f0ec)); b.position.set(.3, SEAT_Y + .2, .05); scene.add(b);
const out = document.getElementById('out'), cx = out.getContext('2d');
const shots = [   // t → камера
  { pos: V(0, .95, 2.4), look: V(0, .65, 0) },
  { pos: V(-.3, .7, 1.0), look: V(-.3, .6, 0) },
];
window.frameJPEG = (t, q = .9) => {
  const s = shots[Math.min(shots.length - 1, Math.floor(t))];
  camera.position.copy(s.pos); camera.lookAt(s.look);
  renderer.render(scene, camera); cx.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/jpeg', q);
};
window.DUR = shots.length; window.ready = true;
