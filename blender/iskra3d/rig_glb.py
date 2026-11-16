# the generated Iskra (iskra_body.blend: 1.68 m, feet on the floor, facing −y) → an armature with the bones and the
# conventions of blender/rig.py (L on −x, roll 0), joints read off the front and side views; bound by bone heat
import bpy, sys
from mathutils import Vector
src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.open_mainfile(filepath=src)
body = bpy.data.objects['iskra_body']
J = {'pelvis': (0, -0.01, 0.95), 'waist': (0, -0.01, 1.07), 'chest': (0, -0.01, 1.22), 'neck': (0, 0.0, 1.37), 'headbase': (0, 0.0, 1.42)}
for s, x in (('L', -1), ('R', 1)):
    J.update({f'hip{s}': (x * 0.09, -0.01, 0.9), f'knee{s}': (x * 0.105, -0.03, 0.555), f'ankle{s}': (x * 0.12, 0.0, 0.13), f'toe{s}': (x * 0.12, -0.15, 0.03),
              f'shoulder{s}': (x * 0.155, -0.005, 1.28), f'elbow{s}': (x * 0.232, 0.01, 1.04), f'wrist{s}': (x * 0.278, 0.0, 0.86), f'hand{s}': (x * 0.315, -0.01, 0.72)})
J = {k: Vector(v) for k, v in J.items()}
BONES = [('hips', 'pelvis', 'waist', None), ('spine', 'waist', 'chest', 'hips'), ('chest', 'chest', 'neck', 'spine'), ('neck', 'neck', 'headbase', 'chest'),
         ('head', 'headbase', None, 'neck')]
for s in 'LR':
    BONES += [(f'thigh.{s}', f'hip{s}', f'knee{s}', 'hips'), (f'shin.{s}', f'knee{s}', f'ankle{s}', f'thigh.{s}'), (f'foot.{s}', f'ankle{s}', f'toe{s}', f'shin.{s}'),
              (f'upperarm.{s}', f'shoulder{s}', f'elbow{s}', 'chest'), (f'forearm.{s}', f'elbow{s}', f'wrist{s}', f'upperarm.{s}'), (f'hand.{s}', f'wrist{s}', f'hand{s}', f'forearm.{s}')]
ad = bpy.data.armatures.new('iskra_rig'); arm = bpy.data.objects.new('iskra', ad); bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for bn, a, b, par in BONES:
    e = ad.edit_bones.new(bn); e.head = J[a]; e.tail = J[b] if b else J[a] + Vector((0, 0, 0.24)); e.roll = 0.0
    if par: e.parent = eb[par]; e.use_connect = False
    eb[bn] = e
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
vg = {g.index: g.name for g in body.vertex_groups}
cnt = {}
for v in body.data.vertices:
    if v.groups:
        g = max(v.groups, key=lambda g: g.weight); cnt[vg[g.group]] = cnt.get(vg[g.group], 0) + 1
    else: cnt['NONE'] = cnt.get('NONE', 0) + 1
print('weights', sorted(cnt.items(), key=lambda kv: -kv[1]))
for pb in arm.pose.bones: pb.rotation_mode = 'XYZ'
bpy.ops.wm.save_as_mainfile(filepath=dst)
