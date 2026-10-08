"""«Какой мяч разобьёт куб?» в 3D.

Большой куб, заранее разрезанный на ~260 кусков (ячейки Вороного), стоит,
пока его не тронут. В него по очереди летят мячи всё тяжелее: каждый
отбивает куски вокруг места удара, а всё, что потеряло опору, падает.
Рендер Cycles, физика pybullet, подписи и звук накладывает comp.cjs.

    python cube3d.py OUTDIR [--frames 0,40] [--res 720] [--samples 5]
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
ap.add_argument('out')
ap.add_argument('--frames', default='all')
ap.add_argument('--res', type=int, default=720)
ap.add_argument('--samples', type=int, default=5)
ap.add_argument('--seed', type=int, default=3)
ap.add_argument('--cells', type=int, default=260)
ap.add_argument('--sim-only', action='store_true')
args = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])

VFPS = 30
REC = 300  # physics samples kept per second
SUB = 5  # physics steps per kept sample
G = 9.81
SIDE = 0.6
YAW = math.radians(52)
CUBE_MAT = Matrix.Translation((0, 0, SIDE / 2)) @ Matrix.Rotation(YAW, 4, 'Z')
HIT_N = (CUBE_MAT.to_3x3() @ Vector((-1, 0, 0))).normalized()  # the face the balls hit
HIT_T = (CUBE_MAT.to_3x3() @ Vector((0, 1, 0))).normalized()  # across that face

BALLS = [
    dict(label='1 кг', r=0.055, kg=1, sim_kg=1, color=(1.0, 0.62, 0.02), word='Отскочил', stamp='#ffd23f',
         reach=0.07, keep=None, speed=5.0, aim=(0.13, 0.46), burst=0.3, lift=0.12),
    dict(label='10 кг', r=0.085, kg=10, sim_kg=8, color=(0.05, 0.62, 0.2), word='Скол', stamp='#3ddc6f',
         reach=0.17, keep=0.3, speed=5.5, aim=(-0.1, 0.36), burst=0.35, lift=0.15),
    dict(label='100 кг', r=0.125, kg=100, sim_kg=25, color=(0.04, 0.22, 0.95), word='Пробил!', stamp='#5aa9ff',
         reach=0.3, keep=0.6, speed=6.0, aim=(0.06, 0.24), burst=0.45, lift=0.2),
    dict(label='1 т', r=0.19, kg=1000, sim_kg=60, color=(0.85, 0.02, 0.03), word='Вдребезги', stamp='#ff4d5e',
         reach=0.85, keep=0.85, speed=7.0, aim=(0.0, 0.3), burst=0.85, lift=0.4),
]
HOVER = 0.6  # seconds a ball floats in with its label before the throw
PAUSE = 1.25  # after a hit, before the next ball shows up
TAIL = 2.6  # after the last hit
rnd = random.Random(args.seed)

# ---------------------------------------------------------------- render setup
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
sc.cycles.caustics_reflective = False
sc.cycles.caustics_refractive = False
sc.cycles.blur_glossy = 1.0
sc.render.use_persistent_data = True
sc.render.resolution_x = args.res
sc.render.resolution_y = args.res * 16 // 9
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.view_settings.view_transform = 'Standard'


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


def material(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    return m, m.node_tree, b


def stone(name, color, rough, bump, scale):
    """matte stone; the grain sticks to each piece (stored rest position)"""
    m, nt, b = material(name, color, rough)
    at = node(nt, 'ShaderNodeAttribute', attribute_name='rest')
    nz = node(nt, 'ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 8
    nz.inputs['Roughness'].default_value = 0.65
    nt.links.new(at.outputs['Vector'], nz.inputs['Vector'])
    tint = node(nt, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    tint.inputs['Factor'].default_value = 0.18
    tint.inputs['A'].default_value = (*color, 1)
    nt.links.new(nz.outputs['Color'], tint.inputs['B'])
    nt.links.new(tint.outputs['Result'], b.inputs['Base Color'])
    bp = node(nt, 'ShaderNodeBump')
    bp.inputs['Strength'].default_value = bump
    bp.inputs['Distance'].default_value = 0.002
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


OUTER = stone('outer', (0.6, 0.61, 0.64), 0.42, 0.05, 40)
INNER = stone('inner', (0.46, 0.44, 0.46), 0.8, 0.5, 120)


def add_obj(name, me):
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- studio
def studio():
    """glossy black floor curving into a dark wall"""
    bm = bmesh.new()
    prof = [(-4.0, 0.0)] + [(1.9 + 1.0 * math.sin(i / 23 * math.pi / 2), 1.0 - 1.0 * math.cos(i / 23 * math.pi / 2)) for i in range(24)] + [(2.9, 5.0)]
    rows = [[bm.verts.new((x, y, z)) for y, z in prof] for x in (-5.0, 5.0)]
    for i in range(len(prof) - 1):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i])).smooth = True
    me = bpy.data.meshes.new('studio')
    bm.to_mesh(me)
    o = add_obj('studio', me)
    m, nt, b = material('studio', (0.006, 0.006, 0.012), 0.16)
    b.inputs['Specular IOR Level'].default_value = 0.6
    # a faint purple haze low on the wall
    tc = node(nt, 'ShaderNodeTexCoord')
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    # only the floor is a mirror; the wall is matte, so lights don't streak on it
    rg = node(nt, 'ShaderNodeMapRange')
    rg.inputs['From Min'].default_value = 0.02
    rg.inputs['From Max'].default_value = 0.4
    rg.inputs['To Min'].default_value = 0.14
    rg.inputs['To Max'].default_value = 0.9
    nt.links.new(sep.outputs['Z'], rg.inputs['Value'])
    nt.links.new(rg.outputs['Result'], b.inputs['Roughness'])
    cr = ramp(nt, [(0.0, (0.0, 0.0, 0.0)), (0.25, (0.05, 0.012, 0.09)), (0.6, (0.012, 0.004, 0.03)), (1.0, (0.0, 0.0, 0.0))])
    mp = node(nt, 'ShaderNodeMapRange')
    mp.inputs['From Min'].default_value = 0.6
    mp.inputs['From Max'].default_value = 4.0
    nt.links.new(sep.outputs['Z'], mp.inputs['Value'])
    nt.links.new(mp.outputs['Result'], cr.inputs['Fac'])
    nt.links.new(cr.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = 1.0
    me.materials.append(m)


studio()


def neon_ring():
    """a big glowing ring behind the cube; its colours run round it"""
    bm = bmesh.new()
    R, r, U, V = 0.95, 0.026, 160, 12
    vs = []
    for i in range(U):
        a = i / U * math.tau
        c = Vector((math.cos(a), math.sin(a), 0))
        vs.append([bm.verts.new(c * (R + r * math.cos(j / V * math.tau)) + Vector((0, 0, r * math.sin(j / V * math.tau)))) for j in range(V)])
    for i in range(U):
        for j in range(V):
            bm.faces.new((vs[i][j], vs[(i + 1) % U][j], vs[(i + 1) % U][(j + 1) % V], vs[i][(j + 1) % V])).smooth = True
    me = bpy.data.meshes.new('ring')
    bm.to_mesh(me)
    o = add_obj('ring', me)
    o.location = (-0.2, 1.75, 1.08)
    o.rotation_euler = (math.pi / 2, 0, 0)
    m = bpy.data.materials.new('neon')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    out = nt.nodes['Material Output']
    tc = node(nt, 'ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping')
    mp.name = 'spin'
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    gr = node(nt, 'ShaderNodeTexGradient', gradient_type='RADIAL')
    nt.links.new(mp.outputs['Vector'], gr.inputs['Vector'])
    cr = ramp(nt, [(0.0, (1.0, 0.08, 0.55)), (0.33, (0.45, 0.1, 1.0)), (0.66, (0.05, 0.75, 1.0)), (1.0, (1.0, 0.08, 0.55))])
    nt.links.new(gr.outputs['Fac'], cr.inputs['Fac'])
    em = node(nt, 'ShaderNodeEmission')
    em.inputs['Strength'].default_value = 3.5
    nt.links.new(cr.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    me.materials.append(m)
    return mp


RING = neon_ring()


def dust(n=40):
    """tiny glowing specks far behind, like stars over the floor"""
    bm = bmesh.new()
    pts = []
    dr = random.Random(99)
    for _ in range(n):
        p = Vector((dr.uniform(-1.6, 1.6), dr.uniform(0.6, 1.7), dr.uniform(0.15, 2.4)))
        pts.append((p, dr.uniform(0.004, 0.009), dr.random()))
    me = bpy.data.meshes.new('dust')
    bm.to_mesh(me)
    o = add_obj('dust', me)
    m, nt, b = material('dust', (0, 0, 0), 1.0)
    b.inputs['Emission Color'].default_value = (1.0, 0.75, 0.95, 1)
    b.inputs['Emission Strength'].default_value = 3
    me.materials.append(m)
    ico = bmesh.new()
    bmesh.ops.create_icosphere(ico, subdivisions=1, radius=1.0)
    base = np.array([v.co[:] for v in ico.verts])
    faces = [[v.index for v in f.verts] for f in ico.faces]
    ico.free()
    me.from_pydata(np.zeros((n * len(base), 3)).tolist(), [], [[i + k * len(base) for i in f] for k in range(n) for f in faces])
    return o, pts, base


DUST, DUST_PTS, DUST_BASE = dust()


def place_dust(t):
    out = []
    for p, r, ph in DUST_PTS:
        q = Vector((p.x + 0.05 * math.sin(t * 0.7 + ph * 9), p.y, (p.z + t * 0.06 + ph) % 2.4 + 0.1))
        out.append(np.array(q[:]) + DUST_BASE * r)
    DUST.data.vertices.foreach_set('co', np.concatenate(out).ravel())
    DUST.data.update()


w = bpy.data.worlds.new('w')
sc.world = w
w.use_nodes = True
env = w.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(os.path.join(bpy.utils.system_resource('DATAFILES', path='studiolights/world'), 'studio.exr'))
w.node_tree.links.new(env.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color'])
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.08


def light(name, loc, target, energy, size, color=(1, 1, 1), spot=None):
    d = bpy.data.lights.new(name, 'SPOT' if spot else 'AREA')
    d.energy = energy
    d.color = color
    if spot:
        d.spot_size = math.radians(spot)
        d.spot_blend = 0.6
        d.shadow_soft_size = size
    else:
        d.size = size
    o = bpy.data.objects.new(name, d)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    o.visible_camera = False
    return o


light('key', (-1.6, -1.8, 2.3), (0, 0, 0.3), 150, 1.4, (1.0, 0.96, 0.9))
light('fill', (1.8, -1.6, 0.9), (0, 0, 0.3), 35, 2.0, (0.75, 0.82, 1.0))
light('rimL', (-1.3, 1.3, 1.4), (0, 0, 0.3), 130, 0.2, (1.0, 0.25, 0.7), spot=40)
light('rimR', (1.4, 1.2, 1.5), (0, 0, 0.3), 130, 0.2, (0.2, 0.7, 1.0), spot=40)
light('top', (0, -0.2, 2.6), (0, 0, 0.3), 30, 0.8)

cam_d = bpy.data.cameras.new('cam')
cam_d.sensor_fit = 'VERTICAL'
cam_d.sensor_height = 24
cam_d.lens = 24
cam_d.dof.use_dof = True
cam_d.dof.aperture_fstop = 2.8
CAM = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(CAM)
sc.camera = CAM
CAM_POS = Vector((-0.15, -2.75, 0.95))
CAM_AIM = Vector((-0.18, 0.0, 0.62))
cam_d.dof.focus_distance = (CAM_POS - Vector((0, 0, SIDE / 2))).length - 0.1


def place_camera(push=0.0, shake=(0.0, 0.0)):
    pos = CAM_POS + (CAM_AIM - CAM_POS) * push
    q = (CAM_AIM - pos).to_track_quat('-Z', 'Y')
    CAM.location = pos + (q @ Vector((1, 0, 0))) * shake[0] + (q @ Vector((0, 1, 0))) * shake[1]
    CAM.rotation_euler = q.to_euler()


place_camera()

# ---------------------------------------------------------------- the cube
h = SIDE / 2


def cut(bm, co, no, nb, layer):
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=co, plane_no=no, clear_outer=True)
    edges = [e for e in bm.edges if len(e.link_faces) == 1]
    if not edges:
        return
    for f in bmesh.ops.holes_fill(bm, edges=edges, sides=0)['faces']:
        f.material_index = 1
        f[layer] = nb


def cell_points(n):
    pts = []
    while len(pts) < n:
        p = Vector((rnd.uniform(-h, h), rnd.uniform(-h, h), rnd.uniform(-h, h)))
        # denser near the face the balls hit, so the first hits chip small bits
        if rnd.random() > 0.45 + 0.55 * math.exp(-(p.x + h) / 0.18):
            continue
        pts.append(p)
    return pts


def mass_props(bm):
    tris = bm.calc_loop_triangles()
    a = np.array([[l.vert.co[:] for l in t] for t in tris])
    v = np.einsum('ij,ij->i', a[:, 0], np.cross(a[:, 1], a[:, 2])) / 6
    vol = v.sum()
    return abs(vol), Vector((v[:, None] * (a.sum(1) / 4)).sum(0) / vol)


t0 = time.time()
pts = cell_points(args.cells)
src = bmesh.new()
bmesh.ops.create_cube(src, size=SIDE)
nb_layer = src.faces.layers.int.new('nb')
for f in src.faces:
    f[nb_layer] = -1
    f.material_index = 0
pieces = []
for i, p in enumerate(pts):
    bm = src.copy()
    layer = bm.faces.layers.int['nb']
    for j in sorted((j for j in range(len(pts)) if j != i), key=lambda j: (pts[j] - p).length):
        q = pts[j]
        no = (q - p).normalized()
        co = (p + q) / 2
        if max((v.co - co).dot(no) for v in bm.verts) <= 1e-7:
            continue
        cut(bm, co, no, j, layer)
    vol, c = mass_props(bm)
    nbs = {f[layer] for f in bm.faces if f[layer] >= 0 and f.calc_area() > 4e-5}
    me = bpy.data.meshes.new(f'p{i}')
    bm.to_mesh(me)
    me.materials.append(OUTER)
    me.materials.append(INNER)
    co_ = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co_)
    me.attributes.new('rest', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', co_)
    local = co_.reshape(-1, 3) - np.array(c[:])
    me.vertices.foreach_set('co', local.ravel())
    me.update()
    o = add_obj(f'p{i}', me)
    o.matrix_world = CUBE_MAT @ Matrix.Translation(c)
    zmin = min((CUBE_MAT @ v.co).z for v in bm.verts)
    pieces.append(dict(obj=o, c=c, vol=vol, verts=local, nbs=nbs, ground=zmin < 0.003,
                       size=float(np.max(np.linalg.norm(local, axis=1)))))
    bm.free()
# keep neighbour links two-way
for i, p in enumerate(pieces):
    for j in list(p['nbs']):
        pieces[j]['nbs'].add(i)
NP = len(pieces)
print(f'fracture: {NP} pieces in {time.time() - t0:.1f}s', flush=True)

ball_objs = []
for k, B in enumerate(BALLS):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=B['r'])
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(f'ball{k}')
    bm.to_mesh(me)
    m, nt, b = material(f'ball{k}', B['color'], 0.25, 0.0, 1.0)
    b.inputs['Coat Roughness'].default_value = 0.04
    me.materials.append(m)
    ball_objs.append(add_obj(f'ball{k}', me))


def aim_point(B):
    t, z = B['aim']
    return Vector((0, 0, 0)) + HIT_N * (h + 0.02) + HIT_T * t + Vector((0, 0, z))


def hover_point(B):
    return aim_point(B) + HIT_N * 0.38 + Vector((0, 0, 0.28))


# ---------------------------------------------------------------- physics
def xyzw(q):
    return [q.x, q.y, q.z, q.w]


pb.connect(pb.DIRECT)
pb.setGravity(0, 0, -G)
pb.setPhysicsEngineParameter(fixedTimeStep=1 / (REC * SUB), numSolverIterations=50, numSubSteps=1)
plane = pb.createMultiBody(0, pb.createCollisionShape(pb.GEOM_PLANE))
pb.changeDynamics(plane, -1, lateralFriction=0.9, restitution=0.2)
pb.createMultiBody(0, pb.createCollisionShape(pb.GEOM_BOX, halfExtents=[5, 0.1, 2]), basePosition=[0, 2.0, 2])

rest = np.array([list(p['obj'].matrix_world.translation) + xyzw(p['obj'].matrix_world.to_quaternion()) for p in pieces])
shapes = [pb.createCollisionShape(pb.GEOM_MESH, vertices=(p['verts'] * 0.99).tolist()) for p in pieces]
body = [pb.createMultiBody(0, shapes[i], basePosition=rest[i, :3].tolist(), baseOrientation=rest[i, 3:].tolist()) for i in range(NP)]
for b in body:
    pb.changeDynamics(b, -1, lateralFriction=0.9, restitution=0.1)
density = 280.0
loose = np.full(NP, np.inf)  # when each piece broke off
owner = {b: i for i, b in enumerate(body)}


def wake(i, t, v, w):
    """turn a fixed piece into a loose one moving with v"""
    pb.removeBody(body[i])
    del owner[body[i]]
    nb = pb.createMultiBody(max(0.02, pieces[i]['vol'] * density), shapes[i], basePosition=rest[i, :3].tolist(), baseOrientation=rest[i, 3:].tolist())
    pb.changeDynamics(nb, -1, collisionMargin=0.0006, lateralFriction=0.85, restitution=0.12, rollingFriction=0.003, spinningFriction=0.003,
                      linearDamping=0.04, angularDamping=0.1)
    pb.resetBaseVelocity(nb, linearVelocity=list(v), angularVelocity=list(w))
    body[i] = nb
    owner[nb] = i
    loose[i] = t


def unsupported(t):
    """fixed pieces no longer joined to the floor through fixed pieces fall"""
    fixed = {i for i in range(NP) if loose[i] == np.inf}
    seen = {i for i in fixed if pieces[i]['ground']}
    todo = list(seen)
    while todo:
        i = todo.pop()
        for j in pieces[i]['nbs']:
            if j in fixed and j not in seen:
                seen.add(j)
                todo.append(j)
    for i in fixed - seen:
        wake(i, t, (0, 0, 0), (0, 0, 0))


def impact(k, t, at, v_in):
    B = BALLS[k]
    sp = np.linalg.norm(v_in)
    d_in = v_in / (sp + 1e-9)
    hit = np.array(at)
    n = 0
    for i in range(NP):
        if loose[i] != np.inf:
            continue
        c = rest[i, :3]
        d = np.linalg.norm(c - hit) - 0.4 * pieces[i]['size']
        if d > B['reach']:
            continue
        f = max(0.0, 1 - max(0.0, d) / B['reach']) ** 1.2
        out = c - hit
        out /= np.linalg.norm(out) + 1e-9
        v = (d_in * sp * (0.25 + 0.75 * f) * (0.6 + 0.6 * rnd.random()) + out * sp * B['burst'] * (0.3 + 0.7 * f)
             + np.array([0, 0, rnd.uniform(0.2, 1.0)]) * sp * B['lift'] * (0.3 + 0.7 * f))
        wv = np.array([rnd.uniform(-1, 1) for _ in range(3)]) * (3 + 14 * f)
        wake(i, t, v, wv)
        n += 1
    unsupported(t)
    return n


balls = [None] * len(BALLS)
launch = [HOVER + 0.15] + [None] * (len(BALLS) - 1)
hit_t = [None] * len(BALLS)
hit_pos = [None] * len(BALLS)
broke = [0] * len(BALLS)
t_end = None
n_max = int(30 * REC)
ball_tr = np.zeros((n_max, len(BALLS), 7))
ball_tr[..., 6] = 1
piece_tr = np.zeros((n_max, NP, 7), dtype=np.float32)
t_phys = time.time()
n_rec = 0
for i in range(n_max):
    t = i / REC
    for _ in range(SUB):
        for k, B in enumerate(BALLS):
            if balls[k] is None and launch[k] is not None and t >= launch[k]:
                P, H = aim_point(B), hover_point(B)
                T = (P - H).length / B['speed']
                v = (P - H) / T
                v.z += 0.5 * G * T
                balls[k] = pb.createMultiBody(B['sim_kg'], pb.createCollisionShape(pb.GEOM_SPHERE, radius=B['r']), basePosition=list(H))
                pb.changeDynamics(balls[k], -1, restitution=0.45, lateralFriction=0.6, rollingFriction=0.001, ccdSweptSphereRadius=B['r'] * 0.8)
                pb.resetBaseVelocity(balls[k], linearVelocity=list(v), angularVelocity=list(HIT_T * -20))
        pre = {k: np.array(pb.getBaseVelocity(b)[0]) for k, b in enumerate(balls) if b is not None and hit_t[k] is None}
        pb.stepSimulation()
        for k, vin in pre.items():
            touch = [c for c in pb.getContactPoints(bodyA=balls[k]) if c[2] in owner]
            missed = t > launch[k] + 0.8
            if not touch and not missed:
                continue
            if not touch:
                touch = [(0, 0, 0, 0, 0, 0, pb.getBasePositionAndOrientation(balls[k])[0])]
            hit_t[k] = t
            hit_pos[k] = touch[0][6]
            broke[k] = impact(k, t, touch[0][6], vin)
            if BALLS[k]['keep'] is not None:
                pb.resetBaseVelocity(balls[k], linearVelocity=list(vin * BALLS[k]['keep']))
            if k + 1 < len(BALLS):
                launch[k + 1] = t + PAUSE + HOVER
            else:
                t_end = t + TAIL
            print(f'hit {k} at {t:.3f}s: {broke[k]} pieces, loose {int(np.isfinite(loose).sum())}', flush=True)
    for k, b in enumerate(balls):
        if b is None:
            continue
        pos, q = pb.getBasePositionAndOrientation(b)
        ball_tr[i, k] = list(pos) + list(q)
    for j in range(NP):
        if loose[j] == np.inf:
            piece_tr[i, j] = rest[j]
        else:
            pos, q = pb.getBasePositionAndOrientation(body[j])
            piece_tr[i, j] = list(pos) + list(q)
    n_rec = i + 1
    if t_end is not None and t >= t_end:
        break
print(f'physics {time.time() - t_phys:.0f}s, sim {n_rec / REC:.2f}s, loose {int(np.isfinite(loose).sum())}/{NP}', flush=True)
ball_tr, piece_tr = ball_tr[:n_rec], piece_tr[:n_rec]
T_SIM = (n_rec - 1) / REC


# ---------------------------------------------------------------- timeline
def speed_at(ts):
    s = 1.0
    for th in hit_t:
        a, b, c, d = th - 0.05, th - 0.01, th + 0.2, th + 0.38
        if a <= ts <= d:
            lo = 0.2
            if ts < b:
                v = 1 + (lo - 1) * (ts - a) / (b - a)
            elif ts <= c:
                v = lo
            else:
                v = lo + (1 - lo) * (ts - c) / (d - c)
            s = min(s, v)
    return s


frames = []
ts = 0.0
while ts <= T_SIM:
    frames.append(ts)
    ts += speed_at(ts) / VFPS


def interp(tr, ts):
    x = min(ts * REC, len(tr) - 1.001)
    i = int(x)
    a = x - i
    p0, p1 = tr[i].astype(np.float64), tr[i + 1].astype(np.float64)
    pos = p0[..., :3] * (1 - a) + p1[..., :3] * a
    q0, q1 = p0[..., 3:], p1[..., 3:]
    q1 = np.where((q0 * q1).sum(-1, keepdims=True) < 0, -q1, q1)
    q = q0 * (1 - a) + q1 * a
    return pos, q / np.linalg.norm(q, axis=-1, keepdims=True)


def set_tr(obj, pos, q):
    obj.location = tuple(pos)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Quaternion((q[3], q[0], q[1], q[2]))


def screen(p):
    v = world_to_camera_view(sc, CAM, Vector(p))
    return 1080 * v.x, 1920 * (1 - v.y)


def ball_state(k, ts, bpos, bq):
    """where ball k is: hidden, floating in with its label, or thrown"""
    B = BALLS[k]
    if launch[k] is not None and ts >= launch[k]:
        return 'fly', bpos[k], bq[k]
    start = (launch[k] - HOVER) if launch[k] is not None else None
    if start is None or ts < start:
        return 'off', np.array([0, 0, -5.0]), np.array([0, 0, 0, 1.0])
    tau = ts - start
    H = hover_point(B)
    side = -HIT_T * 0.0 + HIT_N * 0.9
    k_ = math.exp(-tau * 8) * math.cos(tau * 11)
    p = H + side * k_
    return 'hover', np.array(p[:]), np.array(xyzw(Quaternion((0, 0, 1), -tau * 3)))


SHAKE = [0.0, 0.003, 0.008, 0.02]
want = None if args.frames == 'all' else {int(x) for x in args.frames.split(',')}
os.makedirs(args.out, exist_ok=True)
hud = []
events = []
for k, th in enumerate(hit_t):
    tv = next(f for f, s in enumerate(frames) if s >= th) / VFPS
    events.append(dict(t=tv, kind=['thud', 'smash', 'smash', 'smash'][k], vol=[0.9, 1.0, 1.5, 2.0][k]))
    if k == 3:
        events.append(dict(t=tv + 0.02, kind='thud', vol=1.5))
    for dt, vol in ((0.35, 0.25), (0.6, 0.18)):
        if broke[k] > 2:
            events.append(dict(t=tv + dt + 0.1 * k, kind='thud', vol=vol + 0.05 * k))
first_half = next((k for k in range(len(BALLS)) if (loose <= hit_t[k] + 1.0).sum() >= NP / 2), len(BALLS) - 1)
t_render = time.time()
for f, ts in enumerate(frames):
    tv = f / VFPS
    bpos, bq = interp(ball_tr, ts)
    ppos, pq = interp(piece_tr, ts)
    cur = None
    for k in range(len(BALLS)):
        st, p, q = ball_state(k, ts, bpos, bq)
        set_tr(ball_objs[k], p, q)
        if st in ('hover', 'fly') and (hit_t[k] is None or ts < hit_t[k]):
            cur = (k, p)
    for j, p in enumerate(pieces):
        set_tr(p['obj'], ppos[j], pq[j])
    place_dust(tv)
    last = max((k for k in range(len(BALLS)) if hit_t[k] is not None and hit_t[k] <= ts), default=None)
    since = (ts - hit_t[last]) if last is not None else -1
    vsince = (f - next(i for i, s in enumerate(frames) if s >= hit_t[last])) / VFPS if last is not None else -1
    amp = SHAKE[last] * math.exp(-vsince / 0.3) if last is not None else 0
    place_camera(push=0.05 * min(1, tv / 12), shake=(amp * math.sin(vsince * 57), amp * math.cos(vsince * 43)))
    RING.inputs['Rotation'].default_value = (0, 0, tv * 0.6)
    sc.frame_current = 1
    # captions for this frame
    gone = int((loose <= ts).sum())
    shown = last if last is not None else 0
    if cur is not None:
        shown = cur[0]
    fr = dict(tv=round(tv, 4), ts=round(ts, 5),
              pills=[f"Мяч: {BALLS[shown]['label']}", f'Разбито: {round(100 * gone / NP)}%'])
    if cur is not None:
        k, p = cur
        bx, by = screen(p)
        ex, _ = screen(np.array(p) + np.array(CAM.matrix_world.to_quaternion() @ Vector((BALLS[k]['r'], 0, 0))))
        fr['tag'] = dict(text=BALLS[k]['label'], x=round(bx, 1), y=round(by, 1), r=round(abs(ex - bx), 1))
    if last is not None and (cur is None or cur[0] == last) and vsince < 1.6 and not (last == len(BALLS) - 1 and vsince > 1.5):
        fr['stamp'] = dict(word=BALLS[last]['word'], color=BALLS[last]['stamp'], since=round(vsince, 4))
    if last == len(BALLS) - 1 and vsince > 1.5:
        B = BALLS[first_half]
        fr['banner'] = dict(lines=['Куб развалился', f"на мяче {B['label']}"], color=B['stamp'], alpha=round((vsince - 1.5) * 3, 3))
    hud.append(fr)
    if args.sim_only or (want is not None and f not in want):
        continue
    sc.render.filepath = os.path.join(args.out, f'f{f:04d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'frame {f}/{len(frames)} {time.time() - t_render:.0f}s', flush=True)

meta = dict(fps=VFPS, hook=['Какой мяч', 'разобьёт куб?'], stamp_y=760, banner_y=760, frames=hud, events=events,
            hits=[round(x, 4) for x in hit_t], broke=broke, pieces=NP)
with open(os.path.join(args.out, 'meta.json'), 'w') as fh:
    json.dump(meta, fh, ensure_ascii=False)
print('frames', len(frames), 'hits', [round(x, 3) for x in hit_t], 'render', round(time.time() - t_render), 's')
