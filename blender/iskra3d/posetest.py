# pose test of the rigged generated Iskra: stand, step, crouch, reach, sit — rendered from ¾ front
import bpy, sys, math
from mathutils import Vector
src, out = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['iskra']; P = arm.pose.bones; R = math.radians
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16
sc.render.resolution_x, sc.render.resolution_y = 432, 768
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.48, 0.5, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.7
for name, loc, e in (('key', (-2, -3, 3), 900), ('fill', (3, -2, 2), 300), ('rim', (0, 3, 3), 500)):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = e; l.size = 2; o = bpy.data.objects.new(name, l); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (2.4, -3.4, 1.05); cam.data.lens = 45; cam.rotation_euler = (Vector((0, 0, 0.8)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
def reset():
    for pb in P: pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
POSES = {
 'step': {'thigh.L': (-28, 0, 0), 'shin.L': (12, 0, 0), 'thigh.R': (18, 0, 0), 'shin.R': (30, 0, 0), 'foot.R': (-10, 0, 0), 'upperarm.L': (20, 0, 0), 'upperarm.R': (-22, 0, 0), 'forearm.R': (-20, 0, 0)},
 'crouch': {'thigh.L': (-75, 0, 0), 'shin.L': (95, 0, 0), 'foot.L': (-20, 0, 0), 'thigh.R': (-40, 0, 0), 'shin.R': (110, 0, 0), 'foot.R': (-30, 0, 0), 'spine': (25, 0, 0), 'upperarm.L': (-30, 0, 0), 'forearm.L': (-40, 0, 0), 'upperarm.R': (-40, 0, 0), 'forearm.R': (-60, 0, 0), 'head': (-15, 0, 0)},
 'reach': {'upperarm.R': (-80, 0, 0), 'forearm.R': (-25, 0, 0), 'head': (0, -20, 0), 'chest': (0, -10, 0)},
 'sit': {'thigh.L': (-85, 0, 0), 'shin.L': (85, 0, 0), 'thigh.R': (-85, 0, 0), 'shin.R': (85, 0, 0), 'upperarm.L': (-35, 0, 0), 'forearm.L': (-50, 0, 0), 'upperarm.R': (-35, 0, 0), 'forearm.R': (-50, 0, 0)},
}
for tag, pose in POSES.items():
    reset()
    for bn, r in pose.items(): P[bn].rotation_euler = tuple(R(a) for a in r)
    arm.location = (0, 0, {'crouch': -0.38, 'sit': -0.42}.get(tag, 0))
    sc.render.filepath = f'{out}_{tag}.png'; bpy.ops.render.render(write_still=True)
