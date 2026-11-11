# «Рыжий лес» («Зона», серия 2) in 3D. The hunter and Пурга alone (they fell behind the group) in the Red Forest west of
# the plant: young pines, ginger dead ones and bare snags on a rust-brown carpet of needles; the road through it; the
# river; the wolves' wood; the fork with the old signs, the Duga radar and Pripyat's towers far off. Shot B is 1986 in a
# grove of its own: the pines go ginger, the bulldozer pushes them into the trench, the sand, young pines on it.
# usage: python blender/forest.py <shot A..H> <seconds> <out dir> [percent 66] [samples 10] [step 2] [first frame 0]
#   A lost: alone in the forest, the bus going away on the road    B 1986: ginger, the bulldozer, the sand
#   C road: out of the trees onto the asphalt                       D gust: the scarf over the nose, the dust streaming past
#   E mushrooms: low over them, the dosimeter's red                 F river: the hand goes down to the water and stops
#   G wolves: dusk; they come out of the trees; arms up, backing off H fork: the signs, the Duga and Pripyat on the horizon
import bpy, math, random, sys, os
from mathutils import Vector
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
random.seed(17)
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


NEEDLES = noisy('needles', (0.22, 0.09, 0.03), (0.42, 0.2, 0.07), scale=1.2, bump=0.3)        # the rust-brown floor
GRASS = noisy('grass', (0.14, 0.17, 0.05), (0.3, 0.27, 0.1), scale=0.8, bump=0.2)
ASPH = noisy('asphalt', (0.06, 0.06, 0.065), (0.15, 0.15, 0.15), scale=3.0, bump=0.2)
BARK = noisy('bark', (0.12, 0.07, 0.04), (0.28, 0.16, 0.09), scale=8.0, bump=0.4)
SNAG = noisy('snag', (0.32, 0.29, 0.25), (0.5, 0.46, 0.4), scale=6.0, bump=0.3)              # dead grey trunks
YOUNG = noisy('young', (0.08, 0.2, 0.06), (0.18, 0.3, 0.08), scale=2.0)
GINGER = noisy('ginger', (0.45, 0.14, 0.03), (0.75, 0.32, 0.07), scale=2.0)
SAND = noisy('sand', (0.55, 0.45, 0.28), (0.72, 0.62, 0.42), scale=1.5, bump=0.2)
WATER = mat('water', (0.05, 0.11, 0.13), rough=0.06, metal=0.0)
REED = noisy('reed', (0.3, 0.32, 0.1), (0.5, 0.45, 0.18), scale=4.0)
CAP = noisy('cap', (0.35, 0.12, 0.04), (0.55, 0.25, 0.08), scale=8.0, rough=0.5); STEM = mat('stem', (0.85, 0.8, 0.7))
MOSS = noisy('moss', (0.1, 0.22, 0.03), (0.3, 0.45, 0.07), scale=30.0, bump=0.6, rough=1.0)
STEEL = mat('steel', (0.35, 0.37, 0.4), rough=0.45, metal=0.8); RUST = noisy('rust', (0.22, 0.09, 0.04), (0.42, 0.2, 0.08), scale=4.0, rough=0.75, metal=0.3)
YEL = mat('bus_yellow', (0.8, 0.55, 0.05), rough=0.5); DARK = mat('dark', (0.04, 0.04, 0.05)); GLASS = mat('glass', (0.1, 0.13, 0.15), rough=0.1, metal=0.3)
SIGNBOARD = mat('board', (0.85, 0.82, 0.72), rough=0.7); INK = mat('ink', (0.05, 0.05, 0.06)); POST = noisy('post', (0.25, 0.18, 0.12), (0.4, 0.3, 0.2), scale=10)
SILH = mat('far', (0.09, 0.09, 0.12), rough=1.0); CONC = noisy('concrete', (0.36, 0.36, 0.34), (0.55, 0.54, 0.5), scale=1.2, bump=0.15)


def sign_material():
    m = bpy.data.materials.new('trefoil'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = 0.6
    tx = N.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(os.path.join(HERE, 'tex', 'trefoil.png'))
    L.new(tx.outputs['Color'], b.inputs['Base Color']); L.new(tx.outputs['Alpha'], b.inputs['Alpha'])
    return m


def sky(top, horizon, strength=1.0):
    w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.8; nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*horizon, 1); mx.inputs['B'].default_value = (*top, 1)
    nt.links.new(mr.outputs['Result'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength


def sun(energy, color, elev, azim, angle=4.0):
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 50)); s = bpy.context.object
    s.data.energy = energy; s.data.color = color; s.data.angle = math.radians(angle)
    s.rotation_euler = (math.radians(90 - elev), 0, math.radians(azim)); return s


# —— instancing: the trees are copies of a few meshes, made without bpy.ops ——
_PROTO = {}
def proto(key_, make):
    if key_ not in _PROTO:
        o = make(); _PROTO[key_] = o.data; bpy.data.objects.remove(o)
    return _PROTO[key_]
def inst(me, loc, scale=(1, 1, 1), rot=(0, 0, 0), name='inst'):
    o = bpy.data.objects.new(name, me); kit.col().objects.link(o); o.location = loc; o.scale = scale; o.rotation_euler = rot
    return o
def pine(x, y, h, kind, seed, z=0.0):
    """kind: 'young' green tiers, 'ginger' rusty tiers, 'snag' a bare grey trunk with stubs"""
    r = random.Random(seed)
    trunk = proto('trunk_' + ('snag' if kind == 'snag' else 'bark'), lambda: cyl((0, 0, 0), 1.0, 1.0, SNAG if kind == 'snag' else BARK, verts=7))
    rr = (0.06 + 0.04 * r.random()) * h / 8
    inst(trunk, (x, y, z + h / 2), (rr, rr, h), (r.uniform(-0.04, 0.04), r.uniform(-0.04, 0.04), 0), 'trunk')
    if kind == 'snag':
        stub = proto('stub', lambda: cyl((0, 0, 0), 1.0, 1.0, SNAG, verts=5))
        for k in range(4): inst(stub, (x, y, z + h * r.uniform(0.4, 0.9)), (0.03, 0.03, r.uniform(0.6, 1.4)), (r.uniform(1.0, 1.6), 0, r.uniform(0, 6.28)), 'stub')
        return
    tier = proto('tier_' + kind, lambda: cyl((0, 0, 0), 1.0, 1.0, YOUNG if kind == 'young' else GINGER, verts=9, r2=0.0))
    for k in range(3):
        w = h * (0.28 - 0.06 * k) * r.uniform(0.9, 1.1)
        inst(tier, (x, y, z + h * (0.42 + 0.19 * k)), (w, w, h * 0.32), (0, 0, r.uniform(0, 6.28)), 'tier')


# —— the ground and the road ——
box((0, 0, -0.05), (4000, 4000, 0.1), NEEDLES, name='floor')
RX = 11.0                                           # the road's middle, running along y
box((RX, -58.5, 0.02), (7, 783, 0.04), ASPH, name='road')            # up to the fork
for k in range(60): box((RX, -300 + k * 18, 0.045), (0.14, 3.0, 0.005), SIGNBOARD, name='dash')
# the forest on both sides of the road (left wide, right a strip), a mix of young, ginger and dead
rf = random.Random(7)
CLEAR = [((25, 64), (-10, 40)),                       # the river
         ((RX - 26, RX + 26), (300, 372)),             # the fork
         ((-3, RX - 3.5), (-9, 7)),                    # round him in shot A
         ((RX - 9, RX - 3.5), (8, 110)),               # the west verge north of him: the bus seen through
         ((-12, RX - 3.5), (113, 127)),                # the wolves' way out to the road
         ((RX + 3, RX + 14), (100, 118)),              # the camera's spot in shot G
         ((RX + 3, RX + 7), (17, 27))]                 # the mushrooms
for k in range(1150):
    side = -1 if k % 3 else 1
    x = RX + side * rf.uniform(4.5, 70 if side < 0 else 45); y = rf.uniform(-80, 420) if k % 4 else rf.uniform(-30, 140)
    if any(a <= x <= b and c <= y <= d for (a, b), (c, d) in CLEAR): continue
    kind = rf.choices(['young', 'ginger', 'snag'], [0.5, 0.3, 0.2])[0]
    pine(x, y, rf.uniform(5, 11) if kind == 'young' else rf.uniform(9, 15), kind, 100 + k)
# grass tufts along the verges
tuft = None
for k in range(200):
    x = RX + (-1 if k % 2 else 1) * rf.uniform(3.6, 6); y = rf.uniform(-60, 380)
    if 12 < y < 32: continue                          # not in front of the mushroom shot
    if tuft is None: tuft = proto('tuft', lambda: ico((0, 0, 0), 1.0, GRASS, sub=1))
    inst(tuft, (x, y, 0.05), (rf.uniform(0.2, 0.5), rf.uniform(0.2, 0.5), rf.uniform(0.08, 0.2)), name='tuft')

# —— the river, east of the road: dark water, banks, reeds ——
RIV = Vector((44, 15, 0))
box(tuple(RIV + Vector((0, 0, 0.0))), (34, 50, 0.03), WATER, name='water')       # just over the floor
for dx in (-17.6, 17.6): box(tuple(RIV + Vector((dx, 0, 0.03))), (1.4, 50, 0.08), GRASS, name='bank')
reed = proto('reed', lambda: cyl((0, 0, 0), 1.0, 1.0, REED, verts=4))
for k in range(90):
    p = RIV + Vector((rf.choice([-17.5, 17.5]) + rf.uniform(-0.8, 0.8), rf.uniform(-22, 22), 0))
    inst(reed, (p.x, p.y, 0.5), (0.015, 0.015, rf.uniform(0.8, 1.4)), (rf.uniform(-0.15, 0.15), rf.uniform(-0.15, 0.15), 0), 'reed')

# —— the mushrooms in moss on the verge ——
MU = Vector((RX + 4.4, 22.0, 0))
for k in range(60):
    p = MU + Vector((rf.gauss(0, 0.5), rf.gauss(0, 0.35), 0.02)); r_ = rf.uniform(0.04, 0.1)
    inst(proto('mossb', lambda: ico((0, 0, 0), 1.0, MOSS, sub=2)), tuple(p), (r_, r_, r_ * 0.5), name='moss')
for k, (dx, dy, s_) in enumerate([(0, 0, 1.0), (0.18, 0.1, 0.8), (-0.2, 0.15, 1.15), (0.1, -0.2, 0.7), (-0.05, 0.3, 0.9)]):
    p = MU + Vector((dx, dy, 0))
    cyl((p.x, p.y, 0.06 * s_), 0.025 * s_, 0.12 * s_, STEM, verts=8, name='stem')
    ico((p.x, p.y, 0.13 * s_), 0.07 * s_, CAP, sub=2, name='cap', scale=(1, 1, 0.55))

# —— the fork: the road splits, the signpost with two arrows, the radiation sign ——
FK = Vector((RX, 330, 0))
box(tuple(FK + Vector((-12.5, 21.6, 0.026))), (6.5, 50, 0.04), ASPH, rot=(0, 0, math.radians(30)), name='road_l')     # each a few mm higher: no coplanar faces
box(tuple(FK + Vector((12.5, 21.6, 0.032))), (6.5, 50, 0.04), ASPH, rot=(0, 0, math.radians(-30)), name='road_r')
box(tuple(FK + Vector((0, 1.5, 0.014))), (9, 6, 0.04), ASPH, name='road_y')                 # the junction
cyl(tuple(FK + Vector((0, 4, 1.4))), 0.07, 2.8, POST, verts=6, name='signpost')
FONT = kit.font()
for (dz, txt, d) in [(2.5, 'ДУГА', -1), (2.0, 'ПРИПЯТЬ', 1)]:
    b = box(tuple(FK + Vector((d * 0.75, 4.0, dz))), (1.5, 0.05, 0.36), SIGNBOARD, name='board')
    bpy.ops.object.text_add(location=tuple(FK + Vector((d * 0.75, 3.96, dz - 0.1))), rotation=(math.radians(90), 0, 0)); t_ = bpy.context.object
    t_.data.body = txt; t_.data.font = FONT; t_.data.size = 0.28; t_.data.align_x = 'CENTER'; t_.data.materials.append(INK)
    tip = FK + Vector((d * 1.6, 4.0, dz))
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.26, depth=0.05, location=tuple(tip), rotation=(math.radians(90), math.radians(90 * d), 0))
    bpy.context.object.data.materials.append(SIGNBOARD)
SIGN = sign_material()
cyl(tuple(FK + Vector((4.5, 2, 0.9))), 0.04, 1.8, STEEL, verts=6, name='rad_post')
bpy.ops.mesh.primitive_plane_add(size=0.8, location=tuple(FK + Vector((4.5, 1.96, 1.7))), rotation=(math.pi / 2, 0, 0)); bpy.context.object.data.materials.append(SIGN)
# far off: the Duga — a long lattice of masts, ~150 m high — to the north-west; Pripyat's towers to the north-east
DG = FK + Vector((-420, 620, 0))
for k in range(26):
    hgt = 150 - 50 * abs(k - 12.5) / 12.5
    cyl(tuple(DG + Vector((k * 18, 0, hgt / 2))), 0.9, hgt, SILH, verts=4, name='duga_mast')
for j in range(7):
    box(tuple(DG + Vector((225, 0, 18 + j * 17))), (470, 0.6, 0.6), SILH, name='duga_bar')
PR = FK + Vector((380, 700, 0))
for k in range(8): box(tuple(PR + Vector((k * 40, 20 * (k % 3), 24))), (22, 14, 48 + 10 * (k % 2)), SILH, name='tower')

# —— 1986: a grove of its own, far west: tall pines that go ginger, the bulldozer, the trench and the sand ——
G0 = Vector((-600, 0, 0))
OLD = noisy('old_needles', (0.1, 0.22, 0.07), (0.2, 0.32, 0.1), scale=2.0)
old_mix = OLD.node_tree.nodes.new('ShaderNodeMix'); old_mix.data_type = 'RGBA'          # green → ginger, keyed in shot B
bsdf = OLD.node_tree.nodes['Principled BSDF']; prev = [l for l in OLD.node_tree.links if l.to_socket == bsdf.inputs['Base Color']][0].from_socket
OLD.node_tree.links.new(prev, old_mix.inputs['A']); old_mix.inputs['B'].default_value = (0.7, 0.28, 0.06, 1); OLD.node_tree.links.new(old_mix.outputs['Result'], bsdf.inputs['Base Color'])
GROVE = []
for i in range(7):
    for j in range(3):
        x, y = G0.x - 9 + i * 3.2 + rf.uniform(-0.5, 0.5), G0.y + 6 + j * 3.5 + rf.uniform(-0.5, 0.5)
        root = empty((x, y, 0), 'old_pine')
        h = rf.uniform(13, 17)
        cyl((0, 0, h / 2), 0.18, h, BARK, verts=7, parent=root)
        for k in range(3): cyl((0, 0, h * (0.45 + 0.18 * k)), h * (0.24 - 0.05 * k), h * 0.3, OLD, verts=9, r2=0.0, parent=root)
        GROVE.append((root, i))
DOZ = empty(tuple(G0 + Vector((16, 9, 0))), 'dozer')
box((0, 0, 0.9), (3.2, 2.2, 1.2), YEL, parent=DOZ); box((0.4, 0, 2.0), (1.4, 1.6, 1.1), YEL, parent=DOZ); box((0.4, 0, 2.0), (1.2, 1.62, 0.7), GLASS, parent=DOZ)
box((-2.0, 0, 0.8), (0.2, 3.0, 1.4), STEEL, parent=DOZ)
for dy in (-1.0, 1.0): box((0, dy, 0.35), (3.4, 0.5, 0.7), DARK, parent=DOZ)
MOUND = box(tuple(G0 + Vector((0, 9, -1.5))), (26, 14, 3.0), SAND, name='mound')
SAPLINGS = []
for i in range(9):
    sp_ = empty((G0.x - 10 + i * 2.5, G0.y + 9 + rf.uniform(-3, 3), 1.5), 'sapling')
    cyl((0, 0, 0.5), 0.03, 1.0, BARK, verts=5, parent=sp_); cyl((0, 0, 0.9), 0.35, 1.1, YOUNG, verts=8, r2=0.0, parent=sp_)
    SAPLINGS.append(sp_)

# —— the people ——
HUN = person(0, 0, 0, 'hunter', rot=0.0)
DOG = person(0, -0.8, 0, 'dog', rot=0.0)
W1 = person(-6, 120, 0, 'wolf', rot=0.0)
W2 = person(-7, 122, 0, 'wolf', rot=0.0)
# the dosimeter on his chest (yellow, a lit screen) and the scarf: round the neck, pulled up over the mouth in shot D on
box((0, -0.26, 1.28), (0.09, 0.03, 0.14), M['dosim'], parent=HUN['root']); box((0, -0.278, 1.31), (0.06, 0.004, 0.04), M['lcd'], parent=HUN['root'])
SCARF = cyl((0, -0.02, 1.53), 0.21, 0.13, M['scarf_r'], verts=12, parent=HUN['root'], name='scarf')
SCARF.location = (0, -0.02, 1.53)
# the bus (shot A): yellow, far up the road, going away
BUS = empty((RX - 1.6, 60, 0), 'bus')
box((0, 0, 1.6), (2.5, 10.5, 2.4), YEL, parent=BUS); box((0, 0, 2.1), (2.52, 9.6, 0.8), GLASS, parent=BUS)
for dy in (-3.6, 3.4):
    for dx in (-1.15, 1.15): cyl((dx, dy, 0.48), 0.48, 0.3, DARK, verts=12, rot=(0, math.pi / 2, 0), parent=BUS)


def walk(P, f0, f1, p0, p1, swing=0.45, period=24):
    for f in range(f0, f1 + 1, 3):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.025 * abs(math.sin(ph))))
        P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (swing * math.sin(ph + math.pi * i), 0, 0))
        for i, sh in enumerate(P['arms']): key(sh, 'rotation_euler', f, (-0.6 * swing * math.sin(ph + math.pi * i), 0, 0))
def dog_trot(P, f0, f1, p0, p1, period=14):
    for f in range(f0, f1 + 1, 2):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.02 * abs(math.sin(ph)))); P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (0.5 * math.sin(ph + math.pi * ((i // 2 + i % 2) % 2)), 0, 0))
def face(P, target):
    d = Vector(target) - P['root'].location; P['root'].rotation_euler = (0, 0, math.atan2(d.x, -d.y))
def place(P, p, towards):
    P['root'].location = Vector(p); face(P, towards)
def hide(*objs):
    for o in objs:
        for c in [o] + list(o.children_recursive): c.hide_render = True


cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); kit.col().objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.02; cam_data.clip_end = 6000
look = empty((0, 0, 0), 'look'); aim(cam, look)
def camkeys(keys):
    for f, p, q in keys: key(cam, 'location', f, Vector(p)); key(look, 'location', f, Vector(q))
def dof(dist, fstop=2.8):
    cam_data.dof.use_dof = True; cam_data.dof.focus_distance = dist; cam_data.dof.aperture_fstop = fstop


HAZE = 0.003
AFTERNOON = ((0.45, 0.5, 0.58), (0.92, 0.72, 0.5))
if SHOT != 'A': hide(BUS)
if SHOT not in ('G',): hide(W1['root'], W2['root'])
if SHOT == 'A':     # alone among the trees, a few metres west of the road; the bus far up the road, going away
    sky(*AFTERNOON, 1.0); sun(3.0, (1.0, 0.78, 0.55), 16, 215)
    cam_data.lens = 28
    place(HUN, (4.0, 0, 0), (RX, 40, 0)); place(DOG, (3.2, -0.9, 0), (RX, 30, 0))
    for f, a in [(0, -40), (int(E * 0.25), 30), (int(E * 0.5), 0)]: key(HUN['head'], 'rotation_euler', f, (0, 0, math.radians(a)))
    key(BUS, 'location', 0, Vector((RX - 1.6, 45, 0))); key(BUS, 'location', E, Vector((RX - 1.6, 90, 0)))
    camkeys([(0, (1.0, -4.5, 1.5), (6.0, 6.0, 1.3)), (E, (1.6, -3.8, 1.45), (7.5, 14.0, 1.4))])
elif SHOT == 'B':   # 1986: the grove goes ginger; the bulldozer pushes the pines over into the trench; the sand; young pines
    sky((0.5, 0.38, 0.28), (0.95, 0.66, 0.38), 1.0); sun(3.2, (1.0, 0.7, 0.42), 22, 200)
    cam_data.lens = 24
    hide(HUN['root'], DOG['root'])
    red, fall, sandk = int(E * 0.38), int(E * 0.68), int(E * 0.86)
    old_mix.inputs['Factor'].default_value = 0.0; old_mix.inputs['Factor'].keyframe_insert('default_value', frame=int(E * 0.08))
    old_mix.inputs['Factor'].default_value = 1.0; old_mix.inputs['Factor'].keyframe_insert('default_value', frame=red)
    key(DOZ, 'location', red, G0 + Vector((16, 9, 0))); key(DOZ, 'location', fall, G0 + Vector((-14, 9, 0)))
    for root, i in GROVE:
        fi = int(lerp_ := red + (fall - red) * (6 - i) / 7)
        key(root, 'rotation_euler', fi, (0, 0, 0)); key(root, 'rotation_euler', fi + 12, (0, math.radians(-84), 0))
        root.hide_render = False; root.keyframe_insert('hide_render', frame=sandk)
        root.hide_render = True; root.keyframe_insert('hide_render', frame=sandk + 1)
        for c in root.children:
            c.hide_render = False; c.keyframe_insert('hide_render', frame=sandk); c.hide_render = True; c.keyframe_insert('hide_render', frame=sandk + 1)
    key(MOUND, 'location', sandk - 6, G0 + Vector((0, 9, -1.6))); key(MOUND, 'location', E, G0 + Vector((0, 9, -0.6)))
    for k, sp_ in enumerate(SAPLINGS):
        key(sp_, 'scale', sandk + k, (0.001, 0.001, 0.001)); key(sp_, 'scale', sandk + k + 8, (1, 1, 1)); key(sp_, 'scale', 0, (0.001, 0.001, 0.001))
    camkeys([(0, tuple(G0 + Vector((2, -26, 3.5))), tuple(G0 + Vector((0, 8, 7)))), (red, tuple(G0 + Vector((1, -24, 3.2))), tuple(G0 + Vector((0, 8, 6)))),
             (E, tuple(G0 + Vector((0, -30, 6.0))), tuple(G0 + Vector((0, 8, 1.0))))])
elif SHOT == 'C':   # out of the trees and onto the asphalt: he walks east, the dog behind; the camera on the road
    sky(*AFTERNOON, 1.0); sun(3.0, (1.0, 0.8, 0.58), 18, 215)
    cam_data.lens = 28
    HUN['root'].rotation_euler = (0, 0, math.radians(90)); DOG['root'].rotation_euler = (0, 0, math.radians(90))
    walk(HUN, 0, int(E * 0.6), (4.0, 0, 0), (9.6, 0, 0)); dog_trot(DOG, 0, int(E * 0.62), (2.8, -0.6, 0), (8.6, -0.6, 0))
    camkeys([(0, (12.5, -6.0, 1.3), (6.0, 0.0, 1.0)), (E, (13.0, -5.0, 1.3), (9.0, 0.0, 1.0))])
elif SHOT == 'D':   # the gust: close, from the front; the scarf comes up over his mouth; dust streams past from the right
    sky(*AFTERNOON, 0.95); sun(2.8, (1.0, 0.8, 0.6), 18, 215)
    cam_data.lens = 45
    place(HUN, (RX - 1.0, 0, 0), (RX - 1.0, -10, 0)); place(DOG, (RX - 1.8, -0.4, 0), (RX - 1.8, -10, 0))
    key(SCARF, 'location', int(E * 0.08), (0, -0.02, 1.53)); key(SCARF, 'location', int(E * 0.22), (0, -0.04, 1.68))
    key(SCARF, 'scale', int(E * 0.08), (1, 1, 1)); key(SCARF, 'scale', int(E * 0.22), (0.95, 1.0, 1.25))
    sh = HUN['arms'][1]; key(sh, 'rotation_euler', int(E * 0.04), (0, 0, 0)); key(sh, 'rotation_euler', int(E * 0.14), (math.radians(-150), 0, 0))
    key(sh, 'rotation_euler', int(E * 0.26), (0, 0, 0))
    key(DOG['head'], 'rotation_euler', int(E * 0.4), (0, 0, 0)); key(DOG['head'], 'rotation_euler', int(E * 0.5), (math.radians(20), 0, math.radians(-25)))
    rd = random.Random(31); g0 = int(E * 0.42)
    mote = proto('mote', lambda: ico((0, 0, 0), 1.0, SAND, sub=1))
    for k in range(520):           # the dust: grains blown from +x to −x across the frame, after the gust starts
        y = rd.uniform(-2.6, 1.5); z = rd.uniform(0.1, 2.4); r_ = rd.uniform(0.012, 0.035); v = rd.uniform(7, 12)
        o = inst(mote, (RX + 6, y, z), (r_, r_, r_), name='mote')
        t0 = g0 + rd.randint(0, int(E * 0.4)); dur = int(12 / v * kit.FPS)
        key(o, 'location', t0, Vector((RX + 6, y, z))); key(o, 'location', t0 + dur, Vector((RX - 6, y + rd.uniform(-0.5, 0.5), z - 0.3)))
        o.hide_render = True; o.keyframe_insert('hide_render', frame=t0 - 1); o.hide_render = False; o.keyframe_insert('hide_render', frame=t0)
        o.keyframe_insert('hide_render', frame=t0 + dur); o.hide_render = True; o.keyframe_insert('hide_render', frame=t0 + dur + 1)
        o.hide_render = True; o.keyframe_insert('hide_render', frame=0)
    camkeys([(0, (RX - 1.1, -3.4, 1.55), (RX - 1.0, 0, 1.45)), (E, (RX - 1.1, -3.0, 1.55), (RX - 1.0, 0, 1.5))])
    HAZE = 0.006
elif SHOT == 'E':   # low over the mushrooms in the moss on the verge; his boots and Пурга behind, soft
    sky(*AFTERNOON, 1.0); sun(2.8, (1.0, 0.82, 0.62), 20, 215)
    cam_data.lens = 50
    place(HUN, MU + Vector((-1.0, -0.4, 0)), MU); place(DOG, MU + Vector((-0.8, 1.7, 0)), MU)
    key(DOG['head'], 'rotation_euler', 0, (math.radians(30), 0, 0)); key(DOG['head'], 'rotation_euler', int(E * 0.5), (math.radians(40), 0, math.radians(10)))
    camkeys([(0, tuple(MU + Vector((0.8, -1.1, 0.35))), tuple(MU + Vector((0, 0.1, 0.12)))), (E, tuple(MU + Vector((0.65, -0.95, 0.32))), tuple(MU + Vector((0, 0.1, 0.12))))])
    dof(1.3, 2.2)
elif SHOT == 'F':   # the river: he kneels to the water — the hand goes down, and stops, and comes back
    sky(*AFTERNOON, 1.0); sun(2.6, (1.0, 0.78, 0.56), 14, 225)
    cam_data.lens = 32
    bank = RIV + Vector((-17.5, 2, 0))
    place(HUN, bank + Vector((-0.6, 0, 0)), bank + Vector((3, 0, -0.3))); place(DOG, bank + Vector((-1.4, 0.9, 0)), bank + Vector((3, 0, 0)))
    sh = HUN['arms'][1]
    for f, a in [(0, -10), (int(E * 0.2), -10), (int(E * 0.42), -95), (int(E * 0.62), -95), (int(E * 0.82), -15)]: key(sh, 'rotation_euler', f, (math.radians(a), 0, 0))
    key(HUN['head'], 'rotation_euler', 0, (math.radians(25), 0, 0))
    camkeys([(0, tuple(bank + Vector((-3.8, -2.8, 1.9))), tuple(bank + Vector((1.4, 0.5, 0.3)))), (E, tuple(bank + Vector((-3.5, -2.5, 1.85))), tuple(bank + Vector((1.4, 0.5, 0.3))))])
elif SHOT == 'G':   # dusk: Пурга growls at the trees; two wolves come out; his arms go up, he backs off along the road
    sky((0.16, 0.14, 0.26), (0.72, 0.36, 0.3), 0.8); sun(1.6, (1.0, 0.5, 0.35), 4, 235)
    cam_data.lens = 26
    hp = Vector((RX - 1.5, 120, 0))
    place(HUN, hp, hp + Vector((-10, 0, 0))); place(DOG, hp + Vector((-1.2, -0.6, 0)), hp + Vector((-10, 0, 0)))
    for P, a, b, f0, f1 in [(W1, (-6.0, 121.5, 0), (5.6, 121.0, 0), int(E * 0.12), int(E * 0.42)), (W2, (-7.5, 118.0, 0), (4.6, 118.4, 0), int(E * 0.16), int(E * 0.46))]:
        P['root'].rotation_euler = (0, 0, math.radians(90))                 # out of the trees towards the road (+x)
        dog_trot(P, f0, f1, a, b, period=18)
        key(P['root'], 'location', 0, Vector(a)); key(P['root'], 'location', f0, Vector(a))
        # they go back into the trees at the end
        key(P['root'], 'rotation_euler', int(E * 0.82), (0, 0, math.radians(90))); key(P['root'], 'rotation_euler', int(E * 0.86), (0, 0, math.radians(-90)))
        dog_trot(P, int(E * 0.86), E, b, (b[0] - 7, b[1], 0), period=14)
    big = int(E * 0.5)
    for sh, s_ in [(HUN['arms'][0], 1), (HUN['arms'][1], 1)]:
        key(sh, 'rotation_euler', big - 6, (0, 0, 0)); key(sh, 'rotation_euler', big + 6, (math.radians(-160), 0, math.radians(15 * s_)))
        key(sh, 'rotation_euler', int(E * 0.84), (math.radians(-160), 0, math.radians(15 * s_))); key(sh, 'rotation_euler', int(E * 0.92), (0, 0, 0))
    key(HUN['root'], 'location', big, hp); key(HUN['root'], 'location', int(E * 0.84), hp + Vector((1.6, 0, 0)))
    key(DOG['root'], 'location', big, hp + Vector((-1.2, -0.6, 0))); key(DOG['root'], 'location', int(E * 0.84), hp + Vector((0.4, -0.6, 0)))
    for f, a in [(0, 0), (int(E * 0.1), 0.25), (int(E * 0.5), 0.2)]: key(DOG['head'], 'rotation_euler', f, (a, 0, 0))
    camkeys([(0, tuple(hp + Vector((5.0, -7.5, 1.5))), tuple(hp + Vector((-4.5, 1.0, 0.9)))), (E, tuple(hp + Vector((5.6, -8.5, 1.7))), tuple(hp + Vector((-3.5, 1.0, 0.9))))])
    HAZE = 0.004
else:               # H: the fork at dusk: he stands before the signs; the camera rises behind him, the Duga and Pripyat beyond
    sky((0.22, 0.2, 0.34), (0.88, 0.52, 0.36), 1.0); sun(2.2, (1.0, 0.58, 0.4), 10, 200)
    cam_data.lens = 28
    place(HUN, FK + Vector((0.4, -3.2, 0)), FK + Vector((0, 10, 0))); place(DOG, FK + Vector((-0.5, -3.6, 0)), FK + Vector((0, 10, 0)))
    for f, a in [(int(E * 0.15), 0), (int(E * 0.28), 30), (int(E * 0.45), 30), (int(E * 0.55), -30), (int(E * 0.72), -30), (int(E * 0.82), 0)]:
        key(HUN['head'], 'rotation_euler', f, (0, 0, math.radians(a)))
    camkeys([(0, tuple(FK + Vector((1.2, -8.0, 1.5))), tuple(FK + Vector((0, 6, 2.0)))), (E, tuple(FK + Vector((1.6, -10.5, 3.6))), tuple(FK + Vector((0, 60, 18))))])
    HAZE = 0.0012
kit.volume_box((-900, -300, -1), (900, 1700, 220), HAZE, color=(0.95, 0.85, 0.75), aniso=0.6)
kit.ease_all()
kit.render(sc, OUT, F0, NF, PCT, SAMPLES, STEP)
