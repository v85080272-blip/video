// Заглушка Плюша для отладки таймлайна, пока нет настоящего plush.js.
import { THREE, scene, V, M, sph } from './core.js';
const group = new THREE.Group(); scene.add(group);
const body = sph(.13, M(0xe8893a, { roughness: .8 })); body.position.y = .12; body.scale.set(1, 1, .9); group.add(body);
const head = new THREE.Group(); head.position.set(0, .23, .02); group.add(head);
const hm = sph(.11, M(0xe8893a, { roughness: .8 })); head.add(hm);
[-1, 1].forEach(s => { const e = sph(.03, M(0xffffff)); e.position.set(s * .045, .01, .095); head.add(e); const ear = new THREE.Mesh(new THREE.ConeGeometry(.04, .07, 12), M(0xe8893a)); ear.position.set(s * .07, .1, 0); head.add(ear); });
const paw = sph(.03, M(0xffffff)); group.add(paw);
function pose(t, k = {}) {
  head.rotation.set(k.nod || 0, k.headTurn || 0, k.headTilt || 0);
  const lie = k.lie || 0; body.scale.set(1 + lie * .3, 1 - lie * .4, .9 + lie * .2); head.position.y = .23 - lie * .1;
  const r = k.reach; const at = r ? V(...r.at) : V(.06, .05, .12); paw.position.copy(V(.06, .05, .12).lerp(at, r ? r.k : 0));
  if (k.coverEar) paw.position.lerp(V(-.07, .32, .02), k.coverEar);
  group.position.y += (k.scoot || 0) * .03;
}
export const plush = { group, pose, headWorld: () => head.localToWorld(V(0, 0, 0)), pawWorld: () => paw.getWorldPosition(V(0, 0, 0)) };
