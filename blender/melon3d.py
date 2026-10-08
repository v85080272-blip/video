"""«1 г … 1 т против арбуза» в 3D.

Один раунд за запуск: строит сцену в Blender (bpy), режет арбуз на куски
(ячейки Вороного через bmesh), считает удар и разлёт в pybullet, сок считает
сам, затем рендерит кадры Cycles и пишет meta.json для наложения подписей.

    python melon3d.py ROUND OUTDIR [--frames 0,20,40] [--res 720] [--samples 20]

ROUND: 0..4 (1 г, 1 кг, 10 кг, 100 кг, 1 т). Нужны пакеты bpy и pybullet.
"""
import argparse
import json
import math
import os
import random
import sys
import time

import bpy  # noqa: I001  (bpy first: it makes bmesh importable)
import bmesh
import numpy as np
import pybullet as pb
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector

ap = argparse.ArgumentParser()
ap.add_argument('round', type=int)
ap.add_argument('out')
ap.add_argument('--frames', default='all')
ap.add_argument('--res', type=int, default=720)
ap.add_argument('--samples', type=int, default=20)
ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--view', default='Standard')
ap.add_argument('--tweak', default='')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

VFPS = 30  # video frames per second
REC = 600  # physics samples per second we keep
SUB = 4  # physics steps per kept sample
G = 9.81

AX = Vector((0.17, 0.135, 0.13))  # melon semi-axes, metres (long axis = x)
FLAT = 0.012  # flattened bottom, so it sits still
MZ = AX.z - FLAT  # melon centre height
TOP = MZ + AX.z
YAW = math.radians(18)
GAP = 0.32  # how far above the melon each ball hangs

ROUNDS = [
    dict(label='1 г', kg=0.001, r=0.009, sim_kg=0.001, word='Цел!', cells=0, slow=0.5, hold=0.12, after=1.3, hang=1.0),
    dict(label='1 кг', kg=1, r=0.031, sim_kg=1, word='Треснул', cells=3, power=0.8, juice=16, slow=0.35, hold=0.12, after=1.7, hang=0.6),
    dict(label='10 кг', kg=10, r=0.067, sim_kg=10, word='Раскололся', cells=7, power=0.4, juice=60, slow=0.25, hold=0.22, after=1.7, hang=0.6),
    dict(label='100 кг', kg=100, r=0.145, sim_kg=30, word='Вдребезги', cells=34, power=2.6, juice=220, slow=0.2, hold=0.26, after=1.7, hang=0.6),
    dict(label='1 т', kg=1000, r=0.31, sim_kg=60, word='В пыль', cells=95, power=4.6, juice=520, slow=0.15, hold=0.26, after=3.3, hang=0.6),
]
R = ROUNDS[args.round]
rnd = random.Random(args.seed * 100 + args.round)

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = args.samples
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.03
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.cycles.max_bounces = 6
sc.cycles.diffuse_bounces = 2
sc.cycles.glossy_bounces = 3
sc.cycles.transmission_bounces = 2
sc.cycles.caustics_reflective = False
sc.cycles.caustics_refractive = False
sc.cycles.blur_glossy = 1.0
sc.render.use_persistent_data = True
sc.render.resolution_x = args.res
sc.render.resolution_y = args.res * 16 // 9
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.view_settings.view_transform = args.view
if args.view == 'AgX':
    sc.view_settings.look = 'AgX - Punchy'


def nodes_of(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    return nt, nt.nodes, nt.links


def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def ramp(nt, stops):
    n = nt.nodes.new('ShaderNodeValToRGB')
    el = n.color_ramp.elements
    while len(el) < len(stops):
        el.new(0.5)
    for e, (pos, col) in zip(el, stops):
        e.position = pos
        e.color = (*col, 1)
    return n


def math_node(nt, op, a=None, b=None):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def rest_coords(nt):
    """the melon's own coordinates, stored per vertex, divided by its axes"""
    at = node(nt, 'ShaderNodeAttribute', attribute_name='rest')
    vm = node(nt, 'ShaderNodeVectorMath', operation='DIVIDE')
    nt.links.new(at.outputs['Vector'], vm.inputs[0])
    vm.inputs[1].default_value = tuple(AX)
    return at.outputs['Vector'], vm.outputs['Vector']


def make_rind():
    m = bpy.data.materials.new('rind')
    nt, N, L = nodes_of(m)
    b = N['Principled BSDF']
    raw, unit = rest_coords(nt)
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    L.new(unit, sep.inputs[0])
    # stripes run from pole to pole along the long axis
    ang = math_node(nt, 'ARCTAN2', sep.outputs['Z'], sep.outputs['Y'])
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 9
    nz.inputs['Detail'].default_value = 6
    nz.inputs['Roughness'].default_value = 0.6
    L.new(raw, nz.inputs['Vector'])
    wob = math_node(nt, 'MULTIPLY', nz.outputs['Fac'], 2.4)
    a2 = math_node(nt, 'MULTIPLY_ADD', ang, 8)
    L.new(wob, a2.node.inputs[2])
    s = math_node(nt, 'SINE', a2)
    cr = ramp(nt, [(0.38, (0.012, 0.06, 0.012)), (0.55, (0.13, 0.36, 0.06))])
    s01 = math_node(nt, 'MULTIPLY_ADD', s, 0.5)
    s01.node.inputs[2].default_value = 0.5
    L.new(s01, cr.inputs['Fac'])
    # fine mottling
    nz2 = node(nt, 'ShaderNodeTexNoise')
    nz2.inputs['Scale'].default_value = 70
    nz2.inputs['Detail'].default_value = 3
    L.new(raw, nz2.inputs['Vector'])
    mx = node(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    mx.inputs['Factor'].default_value = 0.35
    L.new(cr.outputs['Color'], mx.inputs['A'])
    L.new(nz2.outputs['Color'], mx.inputs['B'])
    # pale field spot where it lay on the ground
    spot = math_node(nt, 'LESS_THAN', sep.outputs['Z'], -0.82)
    mx2 = node(nt, 'ShaderNodeMix', data_type='RGBA')
    L.new(spot, mx2.inputs['Factor'])
    L.new(mx.outputs['Result'], mx2.inputs['A'])
    mx2.inputs['B'].default_value = (0.55, 0.5, 0.18, 1)
    L.new(mx2.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.42
    b.inputs['Coat Weight'].default_value = 0.35
    b.inputs['Coat Roughness'].default_value = 0.25
    bump = node(nt, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.08
    bump.inputs['Distance'].default_value = 0.002
    L.new(nz2.outputs['Fac'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m


def make_flesh():
    m = bpy.data.materials.new('flesh')
    nt, N, L = nodes_of(m)
    b = N['Principled BSDF']
    raw, unit = rest_coords(nt)
    ln = node(nt, 'ShaderNodeVectorMath', operation='LENGTH')
    L.new(unit, ln.inputs[0])
    r = ln.outputs['Value']
    layers = ramp(nt, [
        (0.0, (0.62, 0.025, 0.05)),
        (0.62, (0.5, 0.012, 0.03)),
        (0.86, (0.6, 0.06, 0.06)),
        (0.9, (0.93, 0.9, 0.7)),
        (0.955, (0.75, 0.85, 0.5)),
        (0.975, (0.05, 0.22, 0.04)),
    ])
    nzr = node(nt, 'ShaderNodeTexNoise')
    nzr.inputs['Scale'].default_value = 25
    L.new(raw, nzr.inputs['Vector'])
    rj = math_node(nt, 'MULTIPLY_ADD', nzr.outputs['Fac'], 0.03)
    L.new(r, rj.node.inputs[2])
    L.new(rj, layers.inputs['Fac'])
    # seeds: dark drops on a ring halfway out
    vo = node(nt, 'ShaderNodeTexVoronoi')
    vo.inputs['Scale'].default_value = 34
    vo.inputs['Randomness'].default_value = 0.9
    L.new(raw, vo.inputs['Vector'])
    seed = math_node(nt, 'LESS_THAN', vo.outputs['Distance'], 0.16)
    band = math_node(nt, 'MULTIPLY', math_node(nt, 'GREATER_THAN', r, 0.42), math_node(nt, 'LESS_THAN', r, 0.74))
    seeds = math_node(nt, 'MULTIPLY', seed, band)
    mx = node(nt, 'ShaderNodeMix', data_type='RGBA')
    L.new(seeds, mx.inputs['Factor'])
    L.new(layers.outputs['Color'], mx.inputs['A'])
    mx.inputs['B'].default_value = (0.02, 0.012, 0.01, 1)
    L.new(mx.outputs['Result'], b.inputs['Base Color'])
    # wet, grainy flesh
    vg = node(nt, 'ShaderNodeTexVoronoi')
    vg.inputs['Scale'].default_value = 220
    L.new(raw, vg.inputs['Vector'])
    bump = node(nt, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.001
    L.new(vg.outputs['Distance'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Coat Weight'].default_value = 0.4
    b.inputs['Coat Roughness'].default_value = 0.08
    return m


def simple(name, color, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    nt, N, L = nodes_of(m)
    b = N['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    return m


RIND = make_rind()
FLESH = make_flesh()
STEEL = simple('steel', (0.82, 0.83, 0.86), 0.12, 1.0)
JUICE = simple('juice', (0.4, 0.004, 0.02), 0.06, 0.0, 1.0)


def add_obj(name, me):
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    return o


# floor and the curved studio wall behind, with a slowly moving glow
def studio():
    bm = bmesh.new()
    prof = [(-3.0, 0.0)] + [(1.3 + 0.9 * math.sin(i / 23 * math.pi / 2), 0.9 - 0.9 * math.cos(i / 23 * math.pi / 2)) for i in range(24)] + [(2.2, 4.0)]
    rows = []
    for x in (-4.0, 4.0):
        rows.append([bm.verts.new((x, y, z)) for y, z in prof])
    for i in range(len(prof) - 1):
        f = bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        f.smooth = True
    me = bpy.data.meshes.new('studio')
    bm.to_mesh(me)
    o = add_obj('studio', me)
    m = bpy.data.materials.new('studio')
    nt, N, L = nodes_of(m)
    b = N['Principled BSDF']
    tc = node(nt, 'ShaderNodeTexCoord')
    nz = node(nt, 'ShaderNodeTexNoise', noise_dimensions='4D')
    nz.name = 'aurora'
    nz.inputs['Scale'].default_value = 0.55
    nz.inputs['Detail'].default_value = 2
    nz.inputs['Distortion'].default_value = 1.2
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    cr = ramp(nt, [(0.3, (0.01, 0.006, 0.035)), (0.48, (0.09, 0.02, 0.2)), (0.6, (0.01, 0.1, 0.22)), (0.74, (0.28, 0.025, 0.18))])
    L.new(nz.outputs['Fac'], cr.inputs['Fac'])
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Object'], sep.inputs[0])
    # only the wall glows; the floor stays dark and glossy
    wall = math_node(nt, 'MINIMUM', 1.0, math_node(nt, 'MULTIPLY', math_node(nt, 'MAXIMUM', math_node(nt, 'SUBTRACT', sep.outputs['Z'], 0.05), 0.0), 0.9))
    em = math_node(nt, 'MULTIPLY', wall, 1.6)
    L.new(cr.outputs['Color'], b.inputs['Emission Color'])
    L.new(em, b.inputs['Emission Strength'])
    b.inputs['Base Color'].default_value = (0.012, 0.01, 0.03, 1)
    b.inputs['Roughness'].default_value = 0.38
    b.inputs['Specular IOR Level'].default_value = 0.25
    me.materials.append(m)
    return nz


AURORA = studio()

w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
env = w.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(bpy.utils.system_resource('DATAFILES', path='studiolights/world'), 'studio.exr'))
w.node_tree.links.new(env.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color'])
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.06


def light(name, loc, target, energy, size, color=(1, 1, 1), spot=None, spread=None):
    d = bpy.data.lights.new(name, 'SPOT' if spot else 'AREA')
    d.energy = energy
    d.color = color
    if spot:
        d.spot_size = math.radians(spot)
        d.spot_blend = 0.6
        d.shadow_soft_size = size
    else:
        d.size = size
        if spread:
            d.spread = math.radians(spread)
    o = bpy.data.objects.new(name, d)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    o.visible_camera = False
    return o


light('key', (-1.3, -1.5, 1.9), (0, 0, 0.2), 170, 1.0, (1.0, 0.95, 0.88))
light('rim', (1.2, 1.3, 1.3), (0, 0, 0.2), 70, 0.15, (0.45, 0.75, 1.0), spot=38)
light('rim2', (-1.3, 1.1, 1.0), (0, 0, 0.2), 45, 0.15, (1.0, 0.4, 0.8), spot=38)
light('fill', (1.4, -1.4, 0.6), (0, 0, 0.2), 22, 1.5, (0.8, 0.85, 1.0))
light('top', (0, -0.3, 2.4), (0, 0, 0.3), 45, 0.6)

cam_d = bpy.data.cameras.new('cam')
cam_d.sensor_fit = 'VERTICAL'
cam_d.sensor_height = 24
cam_d.lens = 43
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 3.2
CAM = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(CAM)
sc.camera = CAM
CAM_POS = Vector((0.0, -1.95, 0.78))
CAM_AIM = Vector((0.0, 0.0, 0.40))
cam_d.dof.focus_distance = (CAM_POS - Vector((0, 0, MZ))).length


def place_camera(push=0.0, shake=(0.0, 0.0)):
    pos = CAM_POS + (CAM_AIM - CAM_POS) * push
    q = (CAM_AIM - pos).to_track_quat('-Z', 'Y')
    right = q @ Vector((1, 0, 0))
    up = q @ Vector((0, 1, 0))
    CAM.location = pos + right * shake[0] + up * shake[1]
    CAM.rotation_euler = q.to_euler()


place_camera()

# ---------------------------------------------------------------- melon
MELON_MAT = Matrix.Translation((0, 0, MZ)) @ Matrix.Rotation(YAW, 4, 'Z')


def melon_bm():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=1.0)
    for v in bm.verts:
        p = v.co
        # a touch of unevenness, a real melon is never a perfect egg
        k = 1 + 0.012 * math.sin(p.x * 5.1 + p.y * 2.3) + 0.008 * math.sin(p.z * 4.7 - p.x * 3.1)
        v.co = Vector((p.x * AX.x * k, p.y * AX.y * k, p.z * AX.z * k))
    for f in bm.faces:
        f.smooth = True
        f.material_index = 0
    cut(bm, Vector((0, 0, -AX.z + FLAT)), Vector((0, 0, -1)), 0)
    return bm


def cut(bm, co, no, mat):
    """drop everything past the plane and close the hole with a flat face"""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=co, plane_no=no, clear_outer=True)
    edges = [e for e in bm.edges if len(e.link_faces) == 1]
    if not edges:
        return
    new = bmesh.ops.holes_fill(bm, edges=edges, sides=0)['faces']
    for f in new:
        f.smooth = False
        f.material_index = mat
        for e in f.edges:
            e.smooth = False


def fracture(bm_src, pts):
    pieces = []
    for i, p in enumerate(pts):
        bm = bm_src.copy()
        order = sorted((j for j in range(len(pts)) if j != i), key=lambda j: (pts[j] - p).length)
        for j in order:
            q = pts[j]
            no = (q - p).normalized()
            co = (p + q) / 2
            # skip planes that miss what is left of the piece
            if max((v.co - co).dot(no) for v in bm.verts) <= 0:
                continue
            cut(bm, co, no, 1)
            if len(bm.verts) < 4:
                break
        if len(bm.verts) >= 4 and bm.calc_volume() > 2e-7:
            pieces.append(bm)
        else:
            bm.free()
    return pieces


def mass_props(bm):
    """volume and centre of mass of a closed mesh"""
    tris = bm.calc_loop_triangles()
    a = np.array([[l.vert.co[:] for l in t] for t in tris])
    v = np.einsum('ij,ij->i', a[:, 0], np.cross(a[:, 1], a[:, 2])) / 6
    vol = v.sum()
    c = (v[:, None] * (a.sum(1) / 4)).sum(0) / vol
    return abs(vol), Vector(c)


def mesh_from(bm, name, centre):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    me.materials.append(RIND)
    me.materials.append(FLESH)
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    at = me.attributes.new('rest', 'FLOAT_VECTOR', 'POINT')
    at.data.foreach_set('vector', co)
    co = co.reshape(-1, 3) - np.array(centre[:])
    me.vertices.foreach_set('co', co.ravel())
    me.update()
    return me


def cell_points(n, hit_local):
    """more cells near the hit, so small bits fly and big chunks stay"""
    pts = []
    if n == 3:
        a0 = rnd.random() * math.tau
        for k in range(3):
            a = a0 + k * math.tau / 3 + rnd.uniform(-0.25, 0.25)
            pts.append(Vector((math.cos(a) * 0.05, math.sin(a) * 0.05, rnd.uniform(-0.02, 0.02))))
        return pts
    while len(pts) < n:
        p = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
        if p.length > 1:
            continue
        p = Vector((p.x * AX.x, p.y * AX.y, p.z * AX.z))
        d = (p - hit_local).length
        if n > 10 and rnd.random() > math.exp(-d / 0.11) + 0.12:
            continue
        pts.append(p)
    return pts


HIT_LOCAL = Vector((0.012, -0.01, AX.z))  # ball lands just off the top centre
t0 = time.time()
base = melon_bm()
whole_vol, whole_c = mass_props(base)
pieces = []  # dicts: obj, centre (local), vol, verts (local, centred)
if R['cells']:
    for k, bm in enumerate(fracture(base, cell_points(R['cells'], HIT_LOCAL))):
        vol, c = mass_props(bm)
        me = mesh_from(bm, f'piece{k}', c)
        o = add_obj(f'piece{k}', me)
        o.matrix_world = MELON_MAT @ Matrix.Translation(c)
        verts = np.array([v.co[:] for v in bm.verts]) - np.array(c[:])
        pieces.append(dict(obj=o, c=c, vol=vol, verts=verts))
        bm.free()
    print(f'fracture: {len(pieces)} pieces in {time.time() - t0:.1f}s', flush=True)
else:
    me = mesh_from(base, 'melon', whole_c)
    o = add_obj('melon', me)
    o.matrix_world = MELON_MAT @ Matrix.Translation(whole_c)
    pieces.append(dict(obj=o, c=whole_c, vol=whole_vol, verts=np.array([v.co[:] for v in base.verts]) - np.array(whole_c[:])))
hull_verts = np.array([v.co[:] for v in base.verts])

# the ball
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=R['r'])
for f in bm.faces:
    f.smooth = True
me = bpy.data.meshes.new('ball')
bm.to_mesh(me)
me.materials.append(STEEL)
BALL = add_obj('ball', me)
HANG = MELON_MAT @ Vector((HIT_LOCAL.x, HIT_LOCAL.y, AX.z))
HANG.z = TOP + GAP + R['r']

# ---------------------------------------------------------------- physics
pb.connect(pb.DIRECT)
pb.setGravity(0, 0, -G)
pb.setPhysicsEngineParameter(fixedTimeStep=1 / (REC * SUB), numSolverIterations=60, numSubSteps=1)
plane = pb.createMultiBody(0, pb.createCollisionShape(pb.GEOM_PLANE))
pb.changeDynamics(plane, -1, lateralFriction=0.9, restitution=0.25, rollingFriction=0.002)
wall = pb.createMultiBody(0, pb.createCollisionShape(pb.GEOM_BOX, halfExtents=[4, 0.1, 2]), basePosition=[0, 1.5, 2])


def xyzw(q):
    return [q.x, q.y, q.z, q.w]


MQ = MELON_MAT.to_quaternion()
melon_static = pb.createMultiBody(0, pb.createCollisionShape(pb.GEOM_MESH, vertices=hull_verts.tolist()), basePosition=[0, 0, MZ], baseOrientation=xyzw(MQ))
pb.changeDynamics(melon_static, -1, restitution=0.75 if args.round == 0 else 0.35, lateralFriction=0.6)
ball_id = pb.createMultiBody(R['sim_kg'], pb.createCollisionShape(pb.GEOM_SPHERE, radius=R['r']), basePosition=list(HANG))
pb.changeDynamics(ball_id, -1, restitution=0.9 if args.round == 0 else 0.4, lateralFriction=0.5, rollingFriction=0.0005,
                  ccdSweptSphereRadius=R['r'] * 0.8, linearDamping=0, angularDamping=0.02)

T_SIM = 1.0 + R['after'] + 0.6
n_rec = int(T_SIM * REC)
ball_tr = np.zeros((n_rec, 7))
piece_tr = np.zeros((n_rec, len(pieces), 7))
rest_tr = []
for p in pieces:
    m = p['obj'].matrix_world
    rest_tr.append(list(m.translation) + xyzw(m.to_quaternion()))
rest_tr = np.array(rest_tr)
piece_tr[:] = rest_tr
hit_t = None
bodies = []
ball_land_t = None


def blast(t):
    """swap the whole melon for loose pieces flying out from the hit"""
    pb.removeBody(melon_static)
    hit = np.array(MELON_MAT @ HIT_LOCAL)
    pw = R['power']
    density = 9.5 / whole_vol  # the melon weighs about 9.5 kg
    for p in pieces:
        shape = pb.createCollisionShape(pb.GEOM_MESH, vertices=(p['verts'] * 0.985).tolist())
        m = p['obj'].matrix_world
        body = pb.createMultiBody(max(0.01, p['vol'] * density), shape, basePosition=list(m.translation), baseOrientation=xyzw(m.to_quaternion()))
        pb.changeDynamics(body, -1, collisionMargin=0.0008, lateralFriction=0.9, restitution=0.12, rollingFriction=0.004, spinningFriction=0.004,
                          linearDamping=0.12, angularDamping=0.15)
        c = np.array(m.translation)
        d = c - hit
        dist = np.linalg.norm(d) + 1e-6
        dirn = d / dist
        dirn = np.array([dirn[0], dirn[1] * (0.6 if dirn[1] < 0 else 1.0), dirn[2] * 0.5 + 0.35])
        dirn /= np.linalg.norm(dirn)
        speed = pw * (0.55 + 0.9 * rnd.random()) / (1 + dist / 0.09)
        jitter = np.array([rnd.uniform(-1, 1) for _ in range(3)]) * pw * 0.12
        v = dirn * speed + jitter
        wv = np.array([rnd.uniform(-1, 1) for _ in range(3)]) * (4 + pw * 7)
        pb.resetBaseVelocity(body, linearVelocity=v.tolist(), angularVelocity=wv.tolist())
        bodies.append(body)


t_phys = time.time()
for i in range(n_rec):
    t = i / REC
    for _ in range(SUB):
        if hit_t is None:
            close = pb.getClosestPoints(ball_id, melon_static, distance=0.004)
            if close:
                hit_t = t
                if R['cells'] > 3:
                    blast(t)
        pb.stepSimulation()
    pos, q = pb.getBasePositionAndOrientation(ball_id)
    ball_tr[i] = list(pos) + list(q)
    for k, b in enumerate(bodies):
        pos, q = pb.getBasePositionAndOrientation(b)
        piece_tr[i, k] = list(pos) + list(q)
    if hit_t is not None and ball_land_t is None and ball_tr[i, 2] - R['r'] < 0.003 and t > hit_t + 0.02:
        ball_land_t = t
print(f'physics {time.time() - t_phys:.1f}s, hit at {hit_t:.3f}s, ball lands {ball_land_t}', flush=True)
# moments the ball bounces (its fall turns into a rise), for the sound track
vz = np.diff(ball_tr[:, 2]) * REC
bounces = [round(i / REC, 4) for i in range(1, len(vz)) if vz[i - 1] < -0.15 and vz[i] > -0.02]

# the «cracked» melon: three wedges lean apart a little, the ball bounces off
if R['cells'] == 3:
    piv = []
    for p in pieces:
        out = Vector((p['c'].x, p['c'].y, 0)).normalized()
        piv.append(out)

    def crack_open(i, t):
        if t <= hit_t:
            return rest_tr
        k = 1 - math.exp(-(t - hit_t) / 0.04)
        tr = rest_tr.copy()
        for n, p in enumerate(pieces):
            out = piv[n]
            ang = math.radians(12) * k
            axis_local = Vector((-out.y, out.x, 0))
            pivot_local = Vector((out.x * AX.x * 0.55, out.y * AX.y * 0.55, -AX.z + FLAT))
            rot = Matrix.Translation(pivot_local) @ Matrix.Rotation(-ang, 4, axis_local) @ Matrix.Translation(-pivot_local)
            m = MELON_MAT @ rot @ Matrix.Translation(p['c'])
            tr[n] = list(m.translation) + xyzw(m.to_quaternion())
        return tr

    for i in range(n_rec):
        piece_tr[i] = crack_open(i, i / REC)

# ---------------------------------------------------------------- juice
JN = R.get('juice', 0)
if JN:
    hit = np.array(MELON_MAT @ HIT_LOCAL)
    jr = np.random.default_rng(args.seed + args.round)
    ang = jr.uniform(0, math.tau, JN)
    up = jr.uniform(0.15, 1.3, JN)
    dirs = np.stack([np.cos(ang), np.sin(ang) * np.where(np.sin(ang) < 0, 0.6, 1.0), up], 1)
    dirs /= np.linalg.norm(dirs, axis=1)[:, None]
    jspeed = R['power'] * jr.uniform(0.35, 1.25, JN) * 1.15
    j_v = dirs * jspeed[:, None]
    spread = min(R['r'], 0.1)
    j_p = hit + np.stack([jr.uniform(-1, 1, JN) * spread, jr.uniform(-1, 1, JN) * spread * 0.7, -jr.uniform(0, 0.03, JN)], 1)
    j_p[:, 2] = np.minimum(j_p[:, 2], TOP - 0.005)
    j_r = jr.uniform(0.0015, 0.0055, JN) * (1 + 0.4 * (R['power'] > 3))
    j_t0 = hit_t + jr.uniform(0, 0.035, JN)
    # landing: z0 + vz t - g t^2 / 2 = radius
    a, b_, c_ = -G / 2, j_v[:, 2], j_p[:, 2] - j_r * 0.3
    j_land = (-b_ - np.sqrt(b_ * b_ - 4 * a * c_)) / (2 * a)
    ico = bmesh.new()
    bmesh.ops.create_icosphere(ico, subdivisions=2, radius=1.0)
    I_V = np.array([v.co[:] for v in ico.verts])
    I_F = [[v.index for v in f.verts] for f in ico.faces]
    ico.free()
    nv = len(I_V)
    jme = bpy.data.meshes.new('juice')
    verts = np.zeros((JN * nv, 3))
    faces = [[i + k * nv for i in f] for k in range(JN) for f in I_F]
    jme.from_pydata(verts.tolist(), [], faces)
    jme.polygons.foreach_set('use_smooth', [True] * len(jme.polygons))
    jme.materials.append(JUICE)
    JUICE_OBJ = add_obj('juice', jme)


def juice_at(t):
    out = np.zeros((JN, nv, 3))
    tau = t - j_t0
    alive = tau > 0
    flying = alive & (tau < j_land)
    landed = alive & ~flying
    # flying drops stretch along their speed
    tt = np.clip(tau, 0, j_land)
    p = j_p + j_v * tt[:, None]
    p[:, 2] -= G / 2 * tt * tt
    vel = j_v.copy()
    vel[:, 2] -= G * tt
    sp = np.linalg.norm(vel, axis=1) + 1e-6
    d = vel / sp[:, None]
    k = 1 + np.minimum(2.2, sp * 0.45)
    proj = np.einsum('nvj,nj->nv', np.broadcast_to(I_V, (JN, nv, 3)), d)
    shape = I_V[None] + d[:, None, :] * proj[:, :, None] * (k - 1)[:, None, None]
    out = p[:, None, :] + shape * j_r[:, None, None]
    # a landed drop becomes a flat splat on the floor
    grow = np.clip((tau - j_land) / 0.06, 0, 1)
    spl = I_V[None] * np.array([1, 1, 0])[None, None] * (j_r * (1.4 + 1.6 * grow))[:, None, None]
    spl[:, :, 2] = I_V[None, :, 2] * (j_r * 0.22)[:, None]
    land_p = j_p + j_v * j_land[:, None]
    land_p[:, 2] = 0.0006
    out = np.where(landed[:, None, None], land_p[:, None, :] + spl, out)
    out[~alive] = np.array(MELON_MAT @ HIT_LOCAL) - np.array([0, 0, 0.05])
    return out


# ---------------------------------------------------------------- timeline
def speed_at(ts):
    """slow motion around the hit"""
    lo, hold = R['slow'], R['hold']
    a, b = hit_t - 0.045, hit_t - 0.008
    c, d = hit_t + hold, hit_t + hold + 0.18
    if ts < a or ts > d:
        return 1.0
    if ts < b:
        return 1 + (lo - 1) * (ts - a) / (b - a)
    if ts <= c:
        return lo
    return lo + (1 - lo) * (ts - c) / (d - c)


frames = []
hang_n = round(R['hang'] * VFPS)
for f in range(hang_n):
    frames.append(dict(kind='hang', tv=f / VFPS, ts=0.0))
ts = 0.0
impact_frame = None
post = 0
while True:
    frames.append(dict(kind='sim', tv=len(frames) / VFPS, ts=ts))
    if impact_frame is None and ts >= hit_t:
        impact_frame = len(frames) - 1
    if impact_frame is not None:
        post += 1
        if post > R['after'] * VFPS:
            break
    ts += speed_at(ts) / VFPS
    if ts >= T_SIM - 0.01:
        break


def interp(tr, ts):
    x = ts * REC
    i = min(int(x), len(tr) - 2)
    a = min(1.0, x - i)
    p0, p1 = tr[i], tr[i + 1]
    pos = p0[..., :3] * (1 - a) + p1[..., :3] * a
    q0, q1 = p0[..., 3:], p1[..., 3:]
    dot = (q0 * q1).sum(-1, keepdims=True)
    q1 = np.where(dot < 0, -q1, q1)
    q = q0 * (1 - a) + q1 * a
    q /= np.linalg.norm(q, axis=-1, keepdims=True)
    return pos, q


def set_tr(obj, pos, q):
    obj.location = tuple(pos)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Quaternion((q[3], q[0], q[1], q[2]))


def screen(p):
    v = world_to_camera_view(sc, CAM, Vector(p))
    return 1080 * v.x, 1920 * (1 - v.y)


SHAKE = {0: 0, 1: 0.002, 2: 0.004, 3: 0.009, 4: 0.016}[args.round]
want = None if args.frames == 'all' else {int(x) for x in args.frames.split(',')}
os.makedirs(args.out, exist_ok=True)
meta = dict(round=args.round, label=R['label'], kg=R['kg'], word=R['word'], fps=VFPS, impact=impact_frame,
            hit_t=hit_t, ball_land=ball_land_t, bounces=bounces, frames=[])
if args.tweak:
    exec(args.tweak)
t_render = time.time()
for f, fr in enumerate(frames):
    tv, ts = fr['tv'], fr['ts']
    if fr['kind'] == 'hang':
        # the ball swings in from above and settles, as if on a spring
        k = tv / max(0.01, R['hang'])
        z = HANG.z + 0.55 * math.exp(-tv * 7) * math.cos(tv * 13)
        bpos = np.array([HANG.x, HANG.y, z])
        bq = np.array(xyzw(Quaternion((0, 0, 1), tv * 1.2)))
    else:
        bpos, bq = interp(ball_tr, ts)
    if fr['kind'] == 'sim':
        ppos, pq = interp(piece_tr, ts)
    else:
        ppos, pq = rest_tr[:, :3], rest_tr[:, 3:]
    set_tr(BALL, bpos, bq)
    for k, p in enumerate(pieces):
        set_tr(p['obj'], ppos[k], pq[k])
    if JN:
        v = juice_at(ts if fr['kind'] == 'sim' else -1)
        JUICE_OBJ.data.vertices.foreach_set('co', v.ravel())
        JUICE_OBJ.data.update()
    since = (f - impact_frame) / VFPS if impact_frame is not None and f >= impact_frame else -1
    amp = SHAKE * math.exp(-since / 0.25) if since >= 0 else 0
    place_camera(push=0.04 * min(1, tv / 3), shake=(amp * math.sin(since * 61), amp * math.cos(since * 47)))
    AURORA.inputs['W'].default_value = (args.round * 3.1 + tv) * 0.12
    sc.frame_current = 1
    bx, by = screen(bpos)
    edge_x, _ = screen(np.array(bpos) + np.array(CAM.matrix_world.to_quaternion() @ Vector((R['r'], 0, 0))))
    meta['frames'].append(dict(kind=fr['kind'], tv=round(tv, 4), ts=round(ts, 5), ball=[round(bx, 1), round(by, 1), round(abs(edge_x - bx), 1)]))
    if want is not None and f not in want:
        continue
    sc.render.filepath = os.path.join(args.out, f'f{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'frame {f}/{len(frames)} {time.time() - t_render:.0f}s', flush=True)

with open(os.path.join(args.out, 'meta.json'), 'w') as fh:
    json.dump(meta, fh)
print('frames', len(frames), 'impact', impact_frame, 'render', round(time.time() - t_render), 's')
