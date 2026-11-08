# «Дуга» («Зона», серия 3) in 3D. The hunter, Пурга and Богдан (he wrote «возьми с собой») at the Duga radar of
# Chernobyl-2: a wall of rusty lattice masts 150 m high and half a kilometre long in a clearing in the forest. A storm comes:
# the thunder, they run from the radar across the meadow past a lone tree (not under it), spread apart, into the
# concrete block of the old military unit; inside, away from the windows and off the wall; the lightning hits the radar;
# they wait; out into the clearing evening, the signpost at the fork.
# usage: python blender/duga.py <shot A..L> <seconds> <out dir> [percent 66] [samples 10] [step 2] [first frame 0]
#   A hook: looking up the mast, down to the three of them; a far flash   B the three of them before the radar, Богдан waves
#   C along the antenna curtain, high up                                  D the ladder: Богдан's hand on a rung; the hunter stops him
#   E thunder: they turn; the dog cowers; a bolt over the forest          F they run from the radar
#   G the lone tree: they run past it and spread apart                    H the concrete block: in through the door
#   I inside: Богдан off the wall, away from the window                   J from the doorway: the bolt hits the radar
#   K they wait on the floor; the light comes back                         L out: the clear evening, the signpost, the radar beyond
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import mat, box, cyl, ico, empty, aim, key, person, M

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SHOT, DURS, OUT = args[0], float(args[1]), args[2]
PCT = int(args[3]) if len(args) > 3 else 66
SAMPLES = int(args[4]) if len(args) > 4 else 10
STEP = int(args[5]) if len(args) > 5 else 2
F0 = int(args[6]) if len(args) > 6 else 0
NF = int(round(DURS * kit.FPS))
E = NF
HERE = os.path.dirname(os.path.abspath(__file__))
EVF = [float(x) for x in os.environ.get('EV', '').split(',') if x]      # the flashes, as fractions of the shot (src/main.js EV)
def ev(i, default):
    return EVF[i] if i < len(EVF) else default
random.seed(23)
sc = kit.reset()
kit.people_materials()


# —— materials ——
def noisy(name, c1, c2, scale=6.0, rough=0.9, metal=0.0, detail=4.0, bump=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    tc = N.new('ShaderNodeTexCoord'); nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*c1, 1); mx.inputs['B'].default_value = (*c2, 1)
    L.new(nz.outputs['Fac'], mx.inputs['Factor']); L.new(mx.outputs['Result'], b.inputs['Base Color'])
    if bump > 0:
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


GRASS = noisy('grass', (0.1, 0.16, 0.05), (0.24, 0.3, 0.1), scale=0.6, bump=0.2)
ASPH = noisy('asphalt', (0.07, 0.07, 0.075), (0.16, 0.16, 0.16), scale=3.0, bump=0.2)
BARK = noisy('bark', (0.12, 0.07, 0.04), (0.28, 0.16, 0.09), scale=8.0, bump=0.4)
BIRCH = noisy('birch', (0.75, 0.74, 0.7), (0.15, 0.14, 0.13), scale=14.0, bump=0.2)
SNAG = noisy('snag', (0.32, 0.29, 0.25), (0.5, 0.46, 0.4), scale=6.0, bump=0.3)
YOUNG = noisy('young', (0.06, 0.17, 0.05), (0.15, 0.27, 0.07), scale=2.0)
LEAF = noisy('leaf', (0.1, 0.22, 0.06), (0.22, 0.36, 0.1), scale=3.0)
RUST = noisy('rust', (0.2, 0.08, 0.035), (0.45, 0.24, 0.1), scale=2.5, rough=0.75, metal=0.35, bump=0.2)
RUSTD = noisy('rust_d', (0.12, 0.06, 0.03), (0.3, 0.17, 0.08), scale=3.5, rough=0.8, metal=0.3)
CONC = noisy('concrete', (0.34, 0.34, 0.32), (0.55, 0.54, 0.5), scale=1.2, bump=0.15)
CONCD = noisy('concrete_d', (0.2, 0.2, 0.19), (0.36, 0.35, 0.33), scale=2.0, bump=0.2)
CLOUD = mat('cloud', (0.1, 0.105, 0.12), rough=1.0)
BOLT = mat('bolt', (0.82, 0.88, 1.0), emit=90)
SIGNBOARD = mat('board', (0.85, 0.82, 0.72), rough=0.7); INK = mat('ink', (0.05, 0.05, 0.06)); POST = noisy('post', (0.25, 0.18, 0.12), (0.4, 0.3, 0.2), scale=10)
DARK = mat('dark', (0.03, 0.03, 0.035))


def sky(top, horizon, strength=1.0):
    w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.8; nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*horizon, 1); mx.inputs['B'].default_value = (*top, 1)
    nt.links.new(mr.outputs['Result'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength
    return bg, mx


def sun(energy, color, elev, azim, angle=4.0, name='sun'):
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 50)); s = bpy.context.object; s.name = name
    s.data.energy = energy; s.data.color = color; s.data.angle = math.radians(angle)
    s.rotation_euler = (math.radians(90 - elev), 0, math.radians(azim)); return s


# —— meshes built from many boxes at once (bmesh), and instancing ——
def mesh_parts(name, parts, m):
    """parts: (kind, matrix) with kind 'cube' (unit cube) or ('cone', r1, r2, segs); one mesh"""
    bm = bmesh.new()
    for kind, mx in parts:
        if kind == 'cube': bmesh.ops.create_cube(bm, size=1.0, matrix=mx)
        else: bmesh.ops.create_cone(bm, cap_ends=True, segments=kind[3], radius1=kind[1], radius2=kind[2], depth=1.0, matrix=mx)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    return me
def bar(c, size):
    return ('cube', Matrix.Translation(Vector(c)) @ Matrix.Diagonal((*size, 1)))
def strut(a, b, t=0.12):
    a, b = Vector(a), Vector(b); d = b - a
    return ('cube', Matrix.Translation((a + b) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4() @ Matrix.Diagonal((t, t, d.length, 1)))
def obj(me, loc=(0, 0, 0), name='obj'):
    o = bpy.data.objects.new(name, me); kit.col().objects.link(o); o.location = loc; return o
_PROTO = {}
def proto(key_, make):
    if key_ not in _PROTO:
        o = make(); _PROTO[key_] = o.data; bpy.data.objects.remove(o)
    return _PROTO[key_]
def inst(me, loc, scale=(1, 1, 1), rot=(0, 0, 0), name='inst'):
    o = bpy.data.objects.new(name, me); kit.col().objects.link(o); o.location = loc; o.scale = scale; o.rotation_euler = rot
    return o


# —— the radar: 35 lattice masts 150 m high, 15 m apart, along x at y = 0; the antenna curtain in front (−y) ——
H = 150.0; NM = 35; X0 = -255.0; DX = 15.0; HW = 1.1
mp = [bar((sx * HW, sy * HW, H / 2), (0.28, 0.28, H)) for sx in (-1, 1) for sy in (-1, 1)]
for z in range(0, int(H), 6):
    for s_ in (-1, 1):
        mp += [strut((s_ * HW, -HW, z), (s_ * HW, HW, z + 6)), strut((s_ * HW, HW, z), (s_ * HW, -HW, z + 6)),
               strut((-HW, s_ * HW, z), (HW, s_ * HW, z + 6)), strut((HW, s_ * HW, z), (-HW, s_ * HW, z + 6))]
    mp += [bar((0, s_ * HW, z), (2 * HW, 0.14, 0.14)) for s_ in (-1, 1)] + [bar((s_ * HW, 0, z), (0.14, 2 * HW, 0.14)) for s_ in (-1, 1)]
MAST = mesh_parts('mast', mp, RUST)
for k in range(NM): obj(MAST, (X0 + k * DX, 0, 0), 'mast')
L_ = X0 + (NM - 1) * DX - X0; XC = 0.0
cp = []
for z in range(10, int(H) + 1, 10):
    for y in (-3.0, -HW, HW): cp.append(bar((XC, y, z), (L_ + 4, 0.22, 0.22)))
    for k in range(NM): cp.append(bar((X0 + k * DX, -(3.0 + HW) / 2, z), (0.14, 3.0 - HW, 0.14)))
for k in range(int(L_ / 5) + 1): cp.append(bar((X0 + k * 5, -3.0, H / 2), (0.12, 0.12, H)))
CURTAIN = obj(mesh_parts('curtain', cp, RUSTD), (0, 0, 0), 'curtain')
rp = []                                        # the radiators: biconical elements on the curtain's nodes
for k in range(int(L_ / 5)):
    for z in range(5, int(H), 10):
        x = X0 + 2.5 + k * 5
        for s_ in (-1, 1):
            rp.append((('cone', 0.55, 0.05, 6), Matrix.Translation(Vector((x + s_ * 0.85, -3.6, z))) @ Matrix.Rotation(math.radians(90 * s_), 4, 'Y') @ Matrix.Diagonal((1, 1, 1.6, 1))))
RAD = obj(mesh_parts('radiators', rp, RUSTD), (0, 0, 0), 'radiators')
# the ladder up the front of the mast at x = 0, with a few rungs gone
lp = [bar((s_ * 0.24, HW + 0.35, H / 2), (0.05, 0.05, H)) for s_ in (-1, 1)]       # on the back of the mast
rl = random.Random(4)
for k in range(int(H / 0.3)):
    if rl.random() < 0.04 and k > 12: continue
    lp.append(bar((0, HW + 0.35, 0.3 + k * 0.3), (0.48, 0.035, 0.035)))
for k in range(12): lp.append(bar((0, HW + 0.17, 2.5 + k * 12), (0.48, 0.36, 0.05)))      # stays to the mast
LADDER = obj(mesh_parts('ladder', lp, RUST), (0, 0, 0), 'ladder')
# the mast feet: concrete plinths
for k in range(NM): box((X0 + k * DX, 0, 0.3), (3.2, 3.2, 0.6), CONC, name='plinth')

# —— the ground: grass, the concrete road along the front, the track to the military block ——
box((0, 0, -0.05), (4000, 4000, 0.1), GRASS, name='floor')
box((0, -20, 0.03), (540, 6, 0.06), CONC, name='road')
BLD = Vector((60, -260, 0))
a_, b_ = Vector((4, -23, 0)), BLD + Vector((0, 8, 0)); d_ = b_ - a_
box(tuple((a_ + b_) / 2 + Vector((0, 0, 0.035))), (4, d_.length, 0.06), CONCD, rot=(0, 0, math.atan2(-d_.x, d_.y)), name='track')

# —— the forest round the clearing; birches among the pines ——
def pine(x, y, h, kind, seed, z=0.0):
    r = random.Random(seed)
    trunk = proto('trunk_' + ('snag' if kind == 'snag' else 'bark'), lambda: cyl((0, 0, 0), 1.0, 1.0, SNAG if kind == 'snag' else BARK, verts=7))
    rr = (0.06 + 0.04 * r.random()) * h / 8
    inst(trunk, (x, y, z + h / 2), (rr, rr, h), (r.uniform(-0.04, 0.04), r.uniform(-0.04, 0.04), 0), 'trunk')
    if kind == 'snag': return
    tier = proto('tier', lambda: cyl((0, 0, 0), 1.0, 1.0, YOUNG, verts=9, r2=0.0))
    for k in range(3):
        w = h * (0.28 - 0.06 * k) * r.uniform(0.9, 1.1)
        inst(tier, (x, y, z + h * (0.42 + 0.19 * k)), (w, w, h * 0.32), (0, 0, r.uniform(0, 6.28)), 'tier')
def birch(x, y, h, seed):
    r = random.Random(seed)
    inst(proto('btrunk', lambda: cyl((0, 0, 0), 1.0, 1.0, BIRCH, verts=7)), (x, y, h / 2), (0.12, 0.12, h), (r.uniform(-0.05, 0.05), r.uniform(-0.05, 0.05), 0), 'btrunk')
    crown = proto('crown', lambda: ico((0, 0, 0), 1.0, LEAF, sub=1))
    for k in range(3): inst(crown, (x + r.uniform(-0.8, 0.8), y + r.uniform(-0.8, 0.8), h * r.uniform(0.6, 0.9)), (h * 0.18, h * 0.18, h * 0.24), name='crown')
rf = random.Random(9)
n = 0
while n < 1300:
    x, y = rf.uniform(-700, 700), rf.uniform(-500, 500)
    inside = (-300 < x < 300 and -300 < y < 60)
    if inside: continue
    if abs(y) > 380 and rf.random() < 0.6: continue
    n += 1
    k = rf.random()
    if k < 0.62: pine(x, y, rf.uniform(9, 18), 'young', 100 + n)
    elif k < 0.9: birch(x, y, rf.uniform(9, 15), 100 + n)
    else: pine(x, y, rf.uniform(9, 14), 'snag', 100 + n)
# the bushes along the clearing's edge and round the block
bush = proto('bush', lambda: ico((0, 0, 0), 1.0, LEAF, sub=1))
for k in range(160):
    x, y = rf.uniform(-300, 300), rf.choice([rf.uniform(52, 62), rf.uniform(-312, -302)])
    inst(bush, (x, y, 0.6), (rf.uniform(1.2, 2.5), rf.uniform(1.2, 2.5), rf.uniform(0.8, 1.6)), name='bush')
# the lone tree in the meadow, between the radar and the block
TREE = Vector((34, -80, 0))
cyl(tuple(TREE + Vector((0, 0, 3.5))), 0.45, 7.0, BARK, verts=9, name='oak_trunk')
for (dx, dy, dz, r) in [(0, 0, 9, 4.6), (2.6, 1.0, 7.6, 3.4), (-2.6, -0.6, 7.8, 3.3), (0.5, -2.4, 8.2, 3.2), (-0.6, 2.4, 10.6, 3.0)]:
    ico(tuple(TREE + Vector((dx, dy, dz))), r, LEAF, sub=2, name='oak_crown', scale=(1, 1, 0.8))
for k in range(5):
    a = k * 1.26; cyl(tuple(TREE + Vector((1.6 * math.cos(a), 1.6 * math.sin(a), 6.2))), 0.18, 3.6, BARK, verts=6, rot=(0.9 * math.sin(a), -0.9 * math.cos(a), 0), name='bough')

# —— the concrete block of the military unit: two storeys, window holes, a door with a concrete canopy ——
BW, BD, BH, T = 30.0, 12.0, 7.0, 0.3
WIN = [-12, -8, -4, 4, 8, 12]                          # window centres along x (relative), 1.6 wide; the door at 0
def wall_x(y, holes, name):
    """a wall along x at y (relative to the block), with holes (cx, w, z0, z1) cut by building it from pieces"""
    xs = sorted(set([-BW / 2, BW / 2] + [h[0] - h[1] / 2 for h in holes] + [h[0] + h[1] / 2 for h in holes]))
    parts = []
    for a, b in zip(xs[:-1], xs[1:]):
        cx = (a + b) / 2; zs = [(0.0, BH)]
        for (hx, hw, z0, z1) in holes:
            if hx - hw / 2 <= cx <= hx + hw / 2:
                zs = [(lo, hi) for (lo, hi) in sum([[(lo, min(hi, z0)), (max(lo, z1), hi)] for (lo, hi) in zs], []) if hi - lo > 0.01]
        for lo, hi in zs: parts.append(bar((cx, y, (lo + hi) / 2), (b - a, T, hi - lo)))
    return obj(mesh_parts(name, parts, CONC), tuple(BLD), name)
NHOLES = [(0, 1.7, 0, 2.3)] + [(x, 1.6, 0.9, 2.3) for x in WIN] + [(x, 1.6, 4.4, 5.8) for x in WIN + [0]]
SHOLES = [(x, 1.6, 0.9, 2.3) for x in WIN + [0]] + [(x, 1.6, 4.4, 5.8) for x in WIN + [0]]
wall_x(BD / 2, NHOLES, 'wall_n'); wall_x(-BD / 2, SHOLES, 'wall_s')
for s_ in (-1, 1): box(tuple(BLD + Vector((s_ * BW / 2, 0, BH / 2))), (T, BD, BH), CONC, name='wall_e')
box(tuple(BLD + Vector((0, 0, 3.4))), (BW, BD, 0.25), CONCD, name='slab1'); box(tuple(BLD + Vector((0, 0, BH + 0.15))), (BW + 0.4, BD + 0.4, 0.3), CONCD, name='roof')
box(tuple(BLD + Vector((0, 0, 0.02))), (BW, BD, 0.04), CONCD, name='ground_floor')
box(tuple(BLD + Vector((0, BD / 2 + 1.0, 2.7))), (3.4, 2.0, 0.18), CONCD, name='canopy')
for k in (-6, 6): box(tuple(BLD + Vector((0, k * 0.7, 3.4 + 0.0))), (0.4, 0.4, 0.01), CONCD, name='x')
for cx in (-6, 6): cyl(tuple(BLD + Vector((cx, 0, 1.7))), 0.25, 3.4, CONCD, verts=8, name='column')
DEBRIS = []
rd = random.Random(5)
for k in range(30):
    p = BLD + Vector((rd.uniform(-13, 13), rd.uniform(-5, 5), 0.08))
    DEBRIS.append(box(tuple(p), (rd.uniform(0.2, 0.8), rd.uniform(0.2, 0.6), rd.uniform(0.06, 0.2)), CONCD, rot=(0, 0, rd.uniform(0, 3)), name='debris'))
bpy.ops.object.light_add(type='AREA', location=tuple(BLD + Vector((0, 0, 3.2)))); FILL = bpy.context.object
FILL.data.energy = 220; FILL.data.size = 10; FILL.data.color = (0.75, 0.8, 0.95)
# the signpost at the fork past the block (shot L): ПРИПЯТЬ to the right, ИЗУМРУДНЫЙ to the left
FK = BLD + Vector((-6, 22, 0))
cyl(tuple(FK + Vector((0, 0, 1.4))), 0.07, 2.8, POST, verts=6, name='signpost')
FONT = kit.font()
for (dz, txt, d) in [(2.5, 'ПРИПЯТЬ', 1), (2.0, 'ИЗУМРУДНЫЙ', -1)]:
    w = 0.2 * len(txt) + 0.4
    box(tuple(FK + Vector((d * (w / 2 + 0.05), -0.02, dz))), (w, 0.05, 0.36), SIGNBOARD, name='board')
    bpy.ops.object.text_add(location=tuple(FK + Vector((d * (w / 2 + 0.05), -0.06, dz - 0.1))), rotation=(math.radians(90), 0, 0)); t_ = bpy.context.object
    t_.data.body = txt; t_.data.font = FONT; t_.data.size = 0.26; t_.data.align_x = 'CENTER'; t_.data.materials.append(INK)
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.26, depth=0.05, location=tuple(FK + Vector((d * (w + 0.22), -0.02, dz))), rotation=(math.radians(90), math.radians(90 * d), 0))
    bpy.context.object.data.materials.append(SIGNBOARD)

# —— the storm: low dark clouds; lightning bolts, each hidden but for its few frames ——
rc = random.Random(13)
CLOUDS = []
for k in range(140):
    c = ico((rc.uniform(-1800, 1800), rc.uniform(-900, 2200), rc.uniform(320, 560)), 1.0, CLOUD, sub=2, name='cloud', scale=(rc.uniform(120, 260), rc.uniform(100, 200), rc.uniform(30, 60)))
    c.visible_shadow = False; CLOUDS.append(c)
def bolt(top, bottom, seed, r=1.0, segs=16, branches=3):
    rb = random.Random(seed); root = empty(tuple(top), 'bolt'); pts = [Vector(top)]
    for i in range(1, segs):
        u = i / segs; p = Vector(top).lerp(Vector(bottom), u) + Vector((rb.uniform(-1, 1), rb.uniform(-1, 1), 0)) * (Vector(top) - Vector(bottom)).length * 0.04
        pts.append(p)
    pts.append(Vector(bottom)); parts = [strut(a - Vector(top), b - Vector(top), r) for a, b in zip(pts[:-1], pts[1:])]
    for j in range(branches):
        i = rb.randint(2, segs - 5); p = pts[i]; q = p
        for s_ in range(4):
            q2 = q + Vector((rb.uniform(-1, 1), rb.uniform(-1, 1), -1.2)) * (Vector(top) - Vector(bottom)).length * 0.05
            parts.append(strut(q - Vector(top), q2 - Vector(top), r * 0.55)); q = q2
    o = obj(mesh_parts('boltm', parts, BOLT), tuple(top), 'bolt'); o.visible_shadow = False
    o.hide_render = True; o.keyframe_insert('hide_render', frame=0)
    return o
def strike(o, f, n=3):
    """the bolt shows for n frames from f (with a flicker), and lights the scene through the flash sun"""
    f -= f % STEP                                  # on a rendered frame
    for k, on in enumerate([True, True, False, True][:n + 1]):
        o.hide_render = not on; o.keyframe_insert('hide_render', frame=f + k)
    o.hide_render = True; o.keyframe_insert('hide_render', frame=f + n + 1)
FLASH = sun(0.0, (0.8, 0.86, 1.0), 55, 160, angle=8, name='flash')
def flash(f, peak=14.0, decay=5):
    f -= f % STEP
    for df, e in [(-1, 0.0), (0, peak), (1, peak * 0.4), (2, peak * 0.9), (decay, 0.0)]:
        FLASH.data.energy = e; FLASH.data.keyframe_insert('energy', frame=f + df)

# —— the people ——
HUN = person(0, -14, 0, 'hunter'); BOG = person(1.3, -14.3, 0, 'bogdan'); DOG = person(-1.0, -13.6, 0, 'dog')
box((0, -0.26, 1.28), (0.09, 0.03, 0.14), M['dosim'], parent=HUN['root']); box((0, -0.278, 1.31), (0.06, 0.004, 0.04), M['lcd'], parent=HUN['root'])


def walk(P, f0, f1, p0, p1, swing=0.45, period=24, step=3):
    for f in range(f0, f1 + 1, step):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.03 * abs(math.sin(ph))))
        P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (swing * math.sin(ph + math.pi * i), 0, 0))
        for i, sh in enumerate(P['arms']): key(sh, 'rotation_euler', f, (-0.6 * swing * math.sin(ph + math.pi * i), 0, 0))
def run(P, f0, f1, p0, p1):
    walk(P, f0, f1, p0, p1, swing=0.8, period=14, step=2)
def dog_trot(P, f0, f1, p0, p1, period=12):
    for f in range(f0, f1 + 1, 2):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.03 * abs(math.sin(ph)))); P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (0.6 * math.sin(ph + math.pi * ((i // 2 + i % 2) % 2)), 0, 0))
def heading(p0, p1):
    d = Vector(p1) - Vector(p0); return (0, 0, math.atan2(d.x, -d.y))
def face(P, target):
    d = Vector(target) - P['root'].location; P['root'].rotation_euler = (0, 0, math.atan2(d.x, -d.y))
def place(P, p, towards):
    P['root'].location = Vector(p); face(P, towards)
def hide(*objs):
    for o in objs:
        for c in [o] + list(o.children_recursive): c.hide_render = True
def sit(P, f, z=-0.66):
    key(P['root'], 'location', f, P['root'].location.copy())
    for hp in P['hips']: key(hp, 'rotation_euler', f, (math.radians(-88), 0, 0))
    P['root'].location.z = z; P['root'].keyframe_insert('location', frame=f)


cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); kit.col().objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.02; cam_data.clip_end = 8000
look = empty((0, 0, 0), 'look'); aim(cam, look)
def camkeys(keys):
    for f, p, q in keys: key(cam, 'location', f, Vector(p)); key(look, 'location', f, Vector(q))
def dof(dist, fstop=2.8):
    cam_data.dof.use_dof = True; cam_data.dof.focus_distance = dist; cam_data.dof.aperture_fstop = fstop


STORM = ((0.1, 0.11, 0.14), (0.36, 0.37, 0.4))
HAZE, HCOL = 0.0035, (0.75, 0.8, 0.9)
P0 = Vector((0, -14, 0))                              # where they stand before the radar
DOOR = BLD + Vector((0, BD / 2, 0))                   # the door, on the side facing the radar
if SHOT in 'ABCDE':
    sky(*STORM, 0.9); sun(1.3, (0.82, 0.86, 1.0), 32, 150)
if SHOT == 'A':     # looking straight up the mast into the cloud, then down to the three of them at its foot; a far flash on «гроза»
    cam_data.lens = 18
    place(HUN, P0, P0 + Vector((0, 10, 0))); place(BOG, P0 + Vector((1.3, -0.3, 0)), P0 + Vector((0, 10, 0))); place(DOG, P0 + Vector((-1.0, 0.4, 0)), P0 + Vector((0, 10, 0)))
    for P in (HUN, BOG): key(P['head'], 'rotation_euler', 0, (math.radians(-35), 0, 0))
    camkeys([(0, (2.5, -4.5, 1.2), (0.5, -1.5, 140)), (int(E * 0.35), (2.5, -6.0, 2.0), (0.5, -2.0, 90)), (E, (-5.5, -27.0, 2.2), (0.0, -6.0, 22))])
    far = bolt((-380, 900, 520), (-300, 900, 0), 3, r=4.0); strike(far, int(E * ev(0, 0.78))); flash(int(E * ev(0, 0.78)), 6.0)
elif SHOT == 'B':   # the three of them before the radar; Богдан waves
    cam_data.lens = 32
    place(HUN, P0, P0 + Vector((0, -10, 0))); place(BOG, P0 + Vector((1.3, -0.3, 0)), P0 + Vector((0.5, -10, 0))); place(DOG, P0 + Vector((-1.0, 0.4, 0)), P0 + Vector((-1, -10, 0)))
    sh = BOG['arms'][1]
    for f, a, b in [(0, 0, 0), (int(E * 0.08), -165, 20), (int(E * 0.18), -165, -10), (int(E * 0.28), -165, 20), (int(E * 0.38), -165, -10), (int(E * 0.5), 0, 0)]:
        key(sh, 'rotation_euler', f, (math.radians(a), 0, math.radians(b)))
    key(HUN['head'], 'rotation_euler', int(E * 0.3), (0, 0, 0)); key(HUN['head'], 'rotation_euler', int(E * 0.45), (0, 0, math.radians(-30)))
    camkeys([(0, (1.2, -21.0, 1.6), (0.4, -14.0, 1.6)), (E, (1.0, -19.5, 1.55), (0.4, -14.0, 1.7))])
    dof(6.5, 4.0)
elif SHOT == 'C':   # high along the antenna curtain: the radiators slide past; the cloud behind
    cam_data.lens = 30
    hide(HUN['root'], BOG['root'], DOG['root'])
    camkeys([(0, (-62, -16, 34), (-48, -3, 38)), (E, (-28, -16, 38), (-14, -3, 42))])
elif SHOT == 'D':   # the ladder: Богдан's hand on a rung, looking up; the hunter comes and stops him
    cam_data.lens = 20
    lad = Vector((0, HW + 0.35, 0))              # behind the radar, at the foot of the ladder
    place(BOG, lad + Vector((0.1, 0.75, 0)), lad + Vector((0.1, -5, 0))); place(DOG, lad + Vector((-1.6, 1.6, 0)), lad + Vector((0, 0, 0)))
    key(BOG['head'], 'rotation_euler', 0, (math.radians(-40), 0, 0))
    sh = BOG['arms'][1]
    for f, a in [(0, 0), (int(E * 0.12), -150), (int(E * 0.6), -150), (int(E * 0.75), -10)]: key(sh, 'rotation_euler', f, (math.radians(a), 0, 0))
    HUN['root'].rotation_euler = heading((-3, 5, 0), lad + Vector((-0.5, 1.0, 0)))
    walk(HUN, int(E * 0.25), int(E * 0.55), (-3.0, 5.2, 0), tuple(lad + Vector((-0.55, 1.15, 0))))
    hs = HUN['arms'][1]; key(hs, 'rotation_euler', int(E * 0.55), (0, 0, 0)); key(hs, 'rotation_euler', int(E * 0.66), (math.radians(-80), 0, math.radians(-25)))
    key(BOG['head'], 'rotation_euler', int(E * 0.62), (math.radians(-40), 0, 0)); key(BOG['head'], 'rotation_euler', int(E * 0.78), (0, 0, math.radians(-50)))
    camkeys([(0, tuple(lad + Vector((0.9, 3.4, 0.5))), tuple(lad + Vector((0, -0.4, 45)))), (int(E * 0.45), tuple(lad + Vector((0.9, 3.6, 0.6))), tuple(lad + Vector((0, -0.4, 30)))),
             (E, tuple(lad + Vector((1.2, 4.6, 1.0))), tuple(lad + Vector((-0.2, 0.0, 8))))])
elif SHOT == 'E':   # thunder: they turn to it; the dog cowers; a bolt over the forest
    cam_data.lens = 24
    tgt = Vector((260, 520, 0))
    place(HUN, P0, P0 + Vector((0, -10, 0))); place(BOG, P0 + Vector((1.3, -0.3, 0)), P0 + Vector((0, -10, 0))); place(DOG, P0 + Vector((-1.0, 0.4, 0)), P0 + Vector((0, -10, 0)))
    t1 = int(E * 0.22)
    for P, p in ((HUN, P0), (BOG, P0 + Vector((1.3, -0.3, 0)))):
        key(P['root'], 'rotation_euler', t1, P['root'].rotation_euler.copy()); face(P, tgt); P['root'].keyframe_insert('rotation_euler', frame=t1 + 8)
        key(P['head'], 'rotation_euler', t1 + 8, (0, 0, 0)); key(P['head'], 'rotation_euler', t1 + 16, (math.radians(-18), 0, 0))
    key(DOG['root'], 'location', t1, DOG['root'].location.copy()); key(DOG['root'], 'location', t1 + 6, DOG['root'].location + Vector((0, 0, -0.16)))
    key(DOG['head'], 'rotation_euler', t1, (0, 0, 0)); key(DOG['head'], 'rotation_euler', t1 + 6, (math.radians(25), 0, 0))
    flash(int(E * ev(0, 0.04)), 5.0)
    b2 = bolt((240, 560, 470), (300, 600, 0), 7, r=3.5); strike(b2, int(E * ev(1, 0.6))); flash(int(E * ev(1, 0.6)), 10.0)
    camkeys([(0, tuple(P0 + Vector((-2.0, -6.5, 1.5))), tuple(P0 + Vector((14, 30, 22)))), (E, tuple(P0 + Vector((-2.4, -7.6, 1.6))), tuple(P0 + Vector((18, 30, 26))))])
elif SHOT == 'F':   # they run from the radar towards the meadow; the radar behind them
    sky(*STORM, 0.85); sun(1.1, (0.82, 0.86, 1.0), 32, 150)
    cam_data.lens = 26
    a0, a1 = Vector((2, -18, 0)), Vector((12, -42, 0)); dv = (a1 - a0).normalized(); pv = Vector((dv.y, -dv.x, 0))
    for P, off, f0 in ((HUN, 0.0, 0), (BOG, 1.4, 3), (DOG, -1.3, 0)):
        P['root'].rotation_euler = heading(a0, a1)
        (dog_trot if P is DOG else run)(P, f0, E, tuple(a0 + pv * off), tuple(a1 + pv * off))
    mid = (a0 + a1) / 2
    camkeys([(0, tuple(a0 + Vector((0, 0, 0)) - pv * 9 + Vector((0, -4, 1.4))), tuple(a0 + dv * 3 + Vector((0, 0, 2.5)))),
             (E, tuple(a1 - pv * 9 + Vector((0, 2, 1.6))), tuple(a1 + Vector((0, 0, 3.5))))])
    flash(int(E * ev(0, 0.5)), 5.0)
elif SHOT == 'G':   # the lone tree in the meadow: they run past it, not under it, and spread apart
    sky(*STORM, 0.85); sun(1.0, (0.82, 0.86, 1.0), 32, 150)
    cam_data.lens = 24
    a0, a1 = TREE + Vector((-24, 16, 0)), TREE + Vector((0, -28, 0)); dv = (a1 - a0).normalized(); pv = Vector((dv.y, -dv.x, 0))   # 13 m clear of the trunk
    for P, off in ((HUN, 0.0), (BOG, 1.0), (DOG, -0.8)):
        P['root'].rotation_euler = heading(a0, a1)
        fs = list(range(0, E + 1, 2)); first = True
        for f in fs:
            u = f / E; spread = 1.0 + 5.0 * max(0.0, min(1.0, (u - 0.25) / 0.4))
            p = a0.lerp(a1, u) + pv * off * spread + Vector((0, 0, 0)); ph = 2 * math.pi * f / (12 if P is DOG else 14)
            P['root'].location = p + Vector((0, 0, 0.03 * abs(math.sin(ph)))); P['root'].keyframe_insert('location', frame=f)
            for i, hp in enumerate(P['hips']):
                key(hp, 'rotation_euler', f, ((0.6 if P is DOG else 0.8) * math.sin(ph + math.pi * (((i // 2 + i % 2) % 2) if P is DOG else i)), 0, 0))
            for i, sh in enumerate(P['arms']): key(sh, 'rotation_euler', f, (-0.5 * math.sin(ph + math.pi * i), 0, 0))
    camkeys([(0, tuple(TREE + Vector((-30, -10, 2.2))), tuple(TREE + Vector((-6, 6, 4.0)))), (E, tuple(TREE + Vector((-28, -18, 2.4))), tuple(TREE + Vector((-2, -14, 3.2))))])
    flash(int(E * ev(0, 0.3)), 4.0)
elif SHOT == 'H':   # the concrete block: they run in through the door
    sky((0.08, 0.09, 0.11), (0.3, 0.31, 0.34), 0.8); sun(0.9, (0.82, 0.86, 1.0), 32, 150)
    cam_data.lens = 24
    d0 = DOOR + Vector((0, 0.0, 0))
    for P, st, f0, f1 in ((DOG, Vector((-4, 13, 0)), 0, int(E * 0.55)), (HUN, Vector((-5.5, 12, 0)), 0, int(E * 0.7)), (BOG, Vector((-3.0, 14, 0)), 2, int(E * 0.8))):
        p0 = d0 + st; p1 = d0 + Vector((0, -2.2, 0)); P['root'].rotation_euler = heading(p0, d0)
        (dog_trot if P is DOG else run)(P, f0, f1, tuple(p0), tuple(p1))
        key(P['root'], 'location', 0, p0) if f0 > 0 else None
    camkeys([(0, tuple(d0 + Vector((-10, 19, 1.8))), tuple(d0 + Vector((-2, 2, 2.6)))), (E, tuple(d0 + Vector((-7, 12, 1.7))), tuple(d0 + Vector((0, 0, 2.8))))])
    flash(int(E * ev(0, 0.35)), 3.0)
    HAZE = 0.006
elif SHOT == 'I':   # inside: Богдан leans on the wall by a window; the hunter pulls him into the middle of the room
    sky((0.08, 0.09, 0.11), (0.3, 0.31, 0.34), 0.9); sun(0.8, (0.82, 0.86, 1.0), 32, 150)
    cam_data.lens = 22
    wall = BLD + Vector((-6.0, BD / 2 - 0.55, 0))
    place(BOG, wall, wall + Vector((0, -5, 0))); BOG['root'].rotation_euler.x = math.radians(-6)        # his back on the wall
    place(HUN, BLD + Vector((-3.0, 1.0, 0)), wall); place(DOG, BLD + Vector((-1.5, 0.0, 0)), wall)
    t1, t2 = int(E * 0.3), int(E * 0.6)
    hs = HUN['arms'][1]; key(hs, 'rotation_euler', t1 - 4, (0, 0, 0)); key(hs, 'rotation_euler', t1 + 4, (math.radians(-80), 0, 0)); key(hs, 'rotation_euler', t2 + 4, (0, 0, 0))
    walk(HUN, t1, t2, tuple(BLD + Vector((-3.0, 1.0, 0))), tuple(BLD + Vector((-4.6, 2.6, 0))))
    key(BOG['root'], 'rotation_euler', t1 + 6, BOG['root'].rotation_euler.copy())
    BOG['root'].rotation_euler.x = 0; BOG['root'].keyframe_insert('rotation_euler', frame=t1 + 12)
    walk(BOG, t1 + 10, int(E * 0.8), tuple(wall), tuple(BLD + Vector((-5.4, 0.8, 0))))
    camkeys([(0, tuple(BLD + Vector((-1.0, -3.6, 1.6))), tuple(wall + Vector((-0.4, 0, 1.2)))), (E, tuple(BLD + Vector((-1.4, -3.2, 1.55))), tuple(BLD + Vector((-5.2, 1.6, 1.1))))])
    for f in (int(E * ev(0, 0.15)), int(E * ev(1, 0.7))): flash(f, 8.0)
    HAZE = 0.0
elif SHOT == 'J':   # from the doorway, low: the bolt comes down on the radar
    sky((0.07, 0.08, 0.1), (0.28, 0.29, 0.32), 0.8); sun(0.8, (0.82, 0.86, 1.0), 32, 150)
    cam_data.lens = 18
    MX = X0 + 21 * DX                               # the mast straight ahead of the door (x = 60)
    place(HUN, DOOR + Vector((-0.75, -1.0, 0)), Vector((MX, 0, 0))); place(BOG, DOOR + Vector((0.8, -1.2, 0)), Vector((MX, 0, 0))); place(DOG, DOOR + Vector((0.25, -1.5, 0)), Vector((MX, 0, 0)))
    hit = int(E * ev(0, 0.12))
    b3 = bolt((MX + 70, 160, 560), (MX, -0.5, H + 1), 11, r=2.2, branches=4); strike(b3, hit, n=3); flash(hit, 24.0, decay=7)
    for d_ in (6, 12): b3.hide_render = False; b3.keyframe_insert('hide_render', frame=hit + d_); b3.hide_render = True; b3.keyframe_insert('hide_render', frame=hit + d_ + 1)
    glow = ico((MX, -0.5, H + 1), 3.0, mat('glow', (1.0, 0.9, 0.8), emit=60), sub=2, name='glow'); glow.hide_render = True; glow.keyframe_insert('hide_render', frame=0)
    hit -= hit % STEP
    for d_, on in [(0, True), (STEP + 2, False)]: glow.hide_render = not on; glow.keyframe_insert('hide_render', frame=hit + d_)
    camkeys([(0, tuple(DOOR + Vector((0.1, -2.4, 0.55))), (MX, 0, 105)), (E, tuple(DOOR + Vector((0.1, -2.2, 0.6))), (MX, 0, 110))])   # the radar's top just under the lintel
    HAZE = 0.0025
elif SHOT == 'K':   # they sit on the floor in the middle of the room; the light outside comes back
    bg, mx = sky((0.08, 0.09, 0.11), (0.3, 0.31, 0.34), 0.8); s_ = sun(0.6, (1.0, 0.86, 0.65), 18, 220)
    bg.inputs['Strength'].keyframe_insert('default_value', frame=int(E * 0.2)); bg.inputs['Strength'].default_value = 1.4; bg.inputs['Strength'].keyframe_insert('default_value', frame=int(E * 0.85))
    s_.data.keyframe_insert('energy', frame=int(E * 0.3)); s_.data.energy = 3.0; s_.data.keyframe_insert('energy', frame=int(E * 0.85))
    cam_data.lens = 26
    c0 = BLD + Vector((-3.5, 0.4, 0))
    place(HUN, c0 + Vector((-0.6, 0, 0)), c0 + Vector((2, 2.5, 0))); place(BOG, c0 + Vector((0.6, 0.2, 0)), c0 + Vector((-1, 3, 0))); place(DOG, c0 + Vector((0.0, -0.9, 0)), c0 + Vector((3, 0, 0)))
    sit(HUN, 0); sit(BOG, 0); DOG['root'].location.z = -0.24
    stand = int(E * 0.8)
    for P in (HUN,):
        key(P['root'], 'location', stand, P['root'].location.copy())
        for hp in P['hips']: key(hp, 'rotation_euler', stand, (math.radians(-88), 0, 0))
        P['root'].location.z = 0; P['root'].keyframe_insert('location', frame=stand + 10)
        for hp in P['hips']: key(hp, 'rotation_euler', stand + 10, (0, 0, 0))
    for f, a in [(int(E * 0.3), 0), (int(E * 0.45), 25), (int(E * 0.7), 25)]: key(BOG['head'], 'rotation_euler', f, (0, 0, math.radians(a)))
    camkeys([(0, tuple(c0 + Vector((2.8, -3.2, 1.2))), tuple(c0 + Vector((-0.3, 0.3, 0.6)))), (E, tuple(c0 + Vector((2.6, -2.8, 1.25))), tuple(c0 + Vector((-0.3, 0.3, 0.8))))])
    HAZE = 0.0
else:               # L: out into the clear evening: the signpost at the fork, the radar beyond, the camera rising behind them
    sky((0.3, 0.38, 0.55), (0.98, 0.7, 0.45), 1.0); sun(3.0, (1.0, 0.72, 0.48), 9, 205)
    hide(*CLOUDS[::2])
    cam_data.lens = 26
    fk = FK
    for P, off in ((HUN, Vector((-0.6, -2.6, 0))), (BOG, Vector((0.7, -2.8, 0))), (DOG, Vector((0.0, -2.1, 0)))):
        p1 = fk + off; p0 = DOOR + Vector((off.x, 0.6, 0)); P['root'].rotation_euler = heading(p0, p1)
        (dog_trot if P is DOG else walk)(P, 0, int(E * 0.5), tuple(p0), tuple(p1))
        key(P['root'], 'rotation_euler', int(E * 0.5), P['root'].rotation_euler.copy()); P['root'].rotation_euler.z = heading(p1, fk + Vector((0, 30, 0)))[2]
        P['root'].keyframe_insert('rotation_euler', frame=int(E * 0.56))
    for f, a in [(int(E * 0.45), 0), (int(E * 0.55), 35), (int(E * 0.7), 35), (int(E * 0.78), -35), (int(E * 0.9), -35)]: key(HUN['head'], 'rotation_euler', f, (0, 0, math.radians(a)))
    camkeys([(0, tuple(fk + Vector((0.6, -8.5, 1.6))), tuple(fk + Vector((0, 4, 2.0)))), (E, tuple(fk + Vector((1.2, -11.0, 4.5))), tuple(fk + Vector((-4, 60, 40))))])
    HAZE, HCOL = 0.0015, (0.95, 0.85, 0.75)
if HAZE > 0: kit.volume_box((-900, -500, -1), (900, 1200, 260), HAZE, color=HCOL, aniso=0.5)
kit.ease_all()
kit.render(sc, OUT, F0, NF, PCT, SAMPLES, STEP)
