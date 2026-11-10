# «Лес горит» («Зона», серия 5) in 3D. A bright April afternoon; the forest burns to the south and the wind drives the fire
# and the smoke north. The hunter, Пурга, the guide and the four who came with us (Богдан, Коля, Настя, Мэри) are in a
# clearing west of the road; they go east, across the wind, to the road; the smoke comes over; scarves up, keep low; the
# checkpoint on the road (booth, barrier, canopy, the officer with the probe); the arch over the reactor far off.
# usage: python blender/fire.py <shot A..H> <seconds> <out dir> [percent 66] [samples 10] [step 2] [first frame 0]
#   A burns: the clearing, the fire wall behind them, smoke over the sky     B across: they turn east and go across the wind
#   C dust: close on the hunter, glowing dust in the smoke, the dosimeter     D wall: the smoke wall rolls over the road ahead
#   E low: scarves up, crouched, they go along the road under the smoke      F check: the checkpoint, the probe over the hunter
#   G 2020: far off, the arch over the reactor, the forest burning before it H out: past the barrier, they wave back
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



FIRE = bpy.data.materials.new('fire'); FIRE.use_nodes = True
_nt = FIRE.node_tree; _N = _nt.nodes; _L = _nt.links
for n in list(_N): _N.remove(n)
_out = _N.new('ShaderNodeOutputMaterial'); _em = _N.new('ShaderNodeEmission'); _tc = _N.new('ShaderNodeTexCoord'); _nz = _N.new('ShaderNodeTexNoise')
_nz.noise_dimensions = '4D'; _nz.inputs['Scale'].default_value = 3.0; _nz.inputs['Detail'].default_value = 3.0
_drv = _nz.inputs['W'].driver_add('default_value'); _drv.driver.expression = 'frame/7'
_ramp = _N.new('ShaderNodeValToRGB'); _ramp.color_ramp.elements[0].color = (0.9, 0.12, 0.01, 1); _ramp.color_ramp.elements[1].color = (1.0, 0.5, 0.08, 1)
_L.new(_tc.outputs['Object'], _nz.inputs['Vector']); _L.new(_nz.outputs['Fac'], _ramp.inputs['Fac']); _L.new(_ramp.outputs['Color'], _em.inputs['Color'])
_mul = _N.new('ShaderNodeMath'); _mul.operation = 'MULTIPLY'; _mul.inputs[1].default_value = 3.2; _L.new(_nz.outputs['Fac'], _mul.inputs[0]); _L.new(_mul.outputs['Value'], _em.inputs['Strength'])
_L.new(_em.outputs['Emission'], _out.inputs['Surface'])
def smoke_mat(name, color, opacity):
    # a soft round cloud on a camera-facing plane: alpha = a spherical falloff × noise × opacity (cheap, unlike a volume)
    m = bpy.data.materials.new(name); m.use_nodes = True; N = m.node_tree.nodes; L = m.node_tree.links
    b = N['Principled BSDF']; b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = 1.0
    tc = N.new('ShaderNodeTexCoord'); gr = N.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.5; nz.inputs['Detail'].default_value = 4.0
    m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; m2 = N.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; m2.inputs[1].default_value = opacity
    pw = N.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 0.7
    L.new(tc.outputs['Object'], gr.inputs['Vector']); L.new(tc.outputs['Object'], nz.inputs['Vector'])
    L.new(gr.outputs['Fac'], pw.inputs[0]); L.new(pw.outputs['Value'], m1.inputs[0]); L.new(nz.outputs['Fac'], m1.inputs[1])
    L.new(m1.outputs['Value'], m2.inputs[0]); L.new(m2.outputs['Value'], b.inputs['Alpha'])
    return m
SMOKE = smoke_mat('smoke', (0.62, 0.6, 0.57), 1.6)
SMOKE_D = smoke_mat('smoke_dark', (0.24, 0.22, 0.21), 1.9)
CHAR = noisy('char', (0.03, 0.03, 0.03), (0.12, 0.1, 0.08), scale=3.0, bump=0.3)
DRYGRASS = noisy('drygrass', (0.32, 0.3, 0.14), (0.5, 0.45, 0.22), scale=0.9, bump=0.2)
EMBER = mat('ember', (1.0, 0.35, 0.05), emit=3.0)
STRIPE_R = mat('stripe_r', (0.75, 0.06, 0.05), rough=0.5); STRIPE_W = mat('stripe_w', (0.92, 0.92, 0.9), rough=0.5)
ARCH = noisy('arch', (0.62, 0.64, 0.66), (0.78, 0.8, 0.82), scale=0.4, rough=0.35, metal=0.6)
HAZE = 0.0012

# —— the ground: dry spring grass; the road along y; the river east of the road ——
box((0, 0, -0.05), (4000, 4000, 0.1), DRYGRASS, name='floor')
RX = 11.0
box((RX, 100, 0.02), (7, 800, 0.04), ASPH, name='road')
for k in range(50): box((RX, -150 + k * 18, 0.045), (0.14, 3.0, 0.005), SIGNBOARD, name='dash')
RIV = Vector((44, 40, 0))
box(tuple(RIV), (30, 300, 0.03), WATER, name='water')
for dx in (-15.6, 15.6): box(tuple(RIV + Vector((dx, 0, 0.03))), (1.4, 300, 0.08), GRASS, name='bank')
# —— the forest west of the road; the clearing where they stand; the burnt strip south of it ——
CL = Vector((RX - 24, 0, 0))                    # the clearing
FRONT = -15.0                                   # the fire front (y), just past the clearing's south edge
rf = random.Random(7)
BURN = []
for k in range(900):
    x = RX - rf.uniform(4.5, 90); y = rf.uniform(-140, 260)
    if (x - CL.x) ** 2 / 16 ** 2 + (y - CL.y) ** 2 / 12 ** 2 < 1: continue
    if abs(x - CL.x) < 12 and FRONT + 2 < y < CL.y: continue
    if x > RX - 6 and 150 < y < 230: continue
    kind = 'snag' if y < FRONT - 4 else rf.choices(['young', 'snag'], [0.85, 0.15])[0]
    h = rf.uniform(8, 15)
    pine(x, y, h, kind, 100 + k)
    if FRONT - 10 < y < FRONT + 8: BURN.append((x, y, h))
for k in range(400):                              # a strip east of the road too, thinner
    x = RX + rf.uniform(4.5, 13); y = rf.uniform(-100, 260)
    if 150 < y < 230: continue
    pine(x, y, rf.uniform(7, 12), 'young', 3000 + k)
box((RX - 47, FRONT - 60, 0.03), (90, 110, 0.04), CHAR, name='burnt')       # black ground behind the front

# —— the fire: flames along the front (and climbing the trees on it), embers, smoke columns leaning north ——
flame = proto('flame', lambda: cyl((0, 0, 0), 1.0, 1.0, FIRE, verts=7, r2=0.0))
for k in range(170):
    x = RX - rf.uniform(6, 92); y = FRONT + rf.uniform(-3, 3); s_ = rf.uniform(0.6, 1.4)
    inst(flame, (x, y, 1.4 * s_), (1.0 * s_, 0.7 * s_, 2.8 * s_), (rf.uniform(-0.15, 0.15), rf.uniform(0.0, 0.25), 0), 'flame')
for (x, y, h) in BURN[:70]:
    s_ = rf.uniform(0.8, 1.4); inst(flame, (x, y, h * 0.55), (1.2 * s_, 1.0 * s_, h * 0.45), (0, rf.uniform(0.0, 0.2), 0), 'treeflame')
for k in range(14):
    bpy.ops.object.light_add(type='POINT', location=(RX - 6 - k * 6.5, FRONT + 2, 2.5)); L_ = bpy.context.object
    L_.data.energy = 1800; L_.data.color = (1.0, 0.45, 0.12); L_.data.shadow_soft_size = 2.0
def _plane(m):
    bpy.ops.mesh.primitive_plane_add(size=2.0); o = bpy.context.object; o.data.materials.append(m); return o
puff = proto('puff', lambda: _plane(SMOKE))
puffd = proto('puffd', lambda: _plane(SMOKE_D))
COLS = []
for k in range(9):
    root = empty((RX - 12 - k * 9.5, FRONT - 14, 0), 'smoke_col'); COLS.append(root)
    for j in range(9):
        r_ = 2.5 + j * 1.5; o = inst(puffd if j < 3 else puff, (0, j * 3.6, 7 + j * 4.6), (r_, r_ * 0.9, r_ * 0.8), name='puff'); o.parent = root
mote = proto('ember', lambda: ico((0, 0, 0), 1.0, EMBER, sub=1))

# —— the smoke wall (shot D) and the low smoke layer (shot E) over the road north of the clearing ——
WALL = empty((RX, 70, 0), 'wall')
for k in range(26):
    r_ = rf.uniform(3, 6); o = inst(puff if k % 3 else puffd, (rf.uniform(-16, 16), rf.uniform(-2, 2), rf.uniform(1.5, 9)), (r_, r_ * 0.7, r_ * 0.8), name='wallpuff'); o.parent = WALL
LAYER = empty((RX, 110, 0), 'layer')
for k in range(40):
    r_ = rf.uniform(1.6, 2.4); o = inst(puff, (rf.uniform(-8, 8), rf.uniform(-16, 6), rf.uniform(3.4, 4.6)), (r_, r_, r_ * 0.35), name='layerpuff'); o.parent = LAYER

# —— the checkpoint on the road (y = CP): booth, barrier, canopy, the sign; behind it the road runs on clean ——
CP = Vector((RX, 190, 0))
for dx in (-4.0, 4.0):
    for dy in (-3.0, 3.0): cyl(tuple(CP + Vector((dx, dy, 2.2))), 0.12, 4.4, STEEL, verts=8, name='canopy_post')
box(tuple(CP + Vector((0, 0, 4.5))), (10, 8, 0.25), CONC, name='canopy')
box(tuple(CP + Vector((-6.0, 0, 1.3))), (2.6, 3.0, 2.6), STRIPE_W, name='booth'); box(tuple(CP + Vector((-6.0, 0, 2.7))), (2.9, 3.3, 0.2), CONC, name='booth_roof')
box(tuple(CP + Vector((-4.69, 0, 1.6))), (0.04, 2.0, 1.0), GLASS, name='booth_win')
BAR = empty(tuple(CP + Vector((-3.6, 4.2, 1.0))), 'barrier')
for k in range(8): box((0.45 + k * 0.9, 0, 0), (0.9, 0.12, 0.12), STRIPE_R if k % 2 else STRIPE_W, parent=BAR)
box(tuple(CP + Vector((-3.6, 4.2, 0.5))), (0.3, 0.3, 1.0), STRIPE_R, name='bar_post')
FONT = kit.font()
bpy.ops.object.text_add(location=tuple(CP + Vector((0, -4.05, 4.25))), rotation=(math.radians(90), 0, 0)); t_ = bpy.context.object
t_.data.body = 'КПП'; t_.data.font = FONT; t_.data.size = 0.7; t_.data.align_x = 'CENTER'; t_.data.materials.append(INK)
box(tuple(CP + Vector((0, -4.0, 4.0))), (3.0, 0.05, 1.0), SIGNBOARD, name='cp_sign')

# —— far off to the north-east: the arch over the reactor, the plant blocks ——
AR = Vector((520, 900, 0))
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=60, depth=160, location=tuple(AR + Vector((0, 0, 0))), rotation=(0, math.pi / 2, 0))
arch = bpy.context.object; arch.data.materials.append(ARCH); arch.scale = (1, 1, 1.8)
for k in range(5): box(tuple(AR + Vector((120 + k * 50, 30, 18))), (40, 60, 36), CONC, name='block')
cyl(tuple(AR + Vector((-130, 20, 75))), 6, 150, CONC, verts=12, name='stack')

# —— the people ——
HUN = person(0, 0, 0, 'hunter', rot=0.0)
DOG = person(0, -0.8, 0, 'dog', rot=0.0)
GUI = person(0, 0, 0, 'guide', rot=0.0)
BOG = person(0, 0, 0, 'bogdan', rot=0.0); KOL = person(0, 0, 0, 'kolya', rot=0.0); NAS = person(0, 0, 0, 'nastya', rot=0.0); MAR = person(0, 0, 0, 'mary', rot=0.0)
OFF = person(0, 0, 0, 'guide', rot=0.0)                  # the officer at the checkpoint
GROUP = [HUN, GUI, BOG, KOL, NAS, MAR]
box((0, -0.26, 1.28), (0.09, 0.03, 0.14), M['dosim'], parent=HUN['root']); box((0, -0.278, 1.31), (0.06, 0.004, 0.04), M['lcd'], parent=HUN['root'])
SCARVES = []
for P in GROUP:
    s_ = cyl((0, -0.02, 1.53 if P is HUN else 1.48), 0.2, 0.13, M['scarf_r'], verts=12, parent=P['root'], name='scarf'); SCARVES.append((P, s_))
PROBE = cyl((0, 0, 0), 0.03, 0.6, STEEL, verts=6, name='probe')

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




# —— the shots ——
EV = [float(x) for x in os.environ.get('EV', '').split(',') if x]
if SHOT not in ('F', 'H'): hide(OFF['root'], PROBE)
if SHOT not in ('D',): hide(WALL)
if SHOT not in ('E',): hide(LAYER)
DAY = ((0.38, 0.55, 0.78), (0.95, 0.82, 0.66))
OFFS = [(0, 0), (1.3, 0.8), (-1.2, 0.9), (0.6, 2.0), (-0.6, 2.1), (1.8, 2.2)]          # the group around the hunter (x, y)
def group_at(p, towards, spread=1.0):
    for (dx, dy), P in zip(OFFS, GROUP): place(P, Vector(p) + Vector((dx * spread, dy * spread, 0)), towards)
    place(DOG, Vector(p) + Vector((-0.8, -0.9, 0)), towards)
def group_walk(f0, f1, p0, p1, period=26):
    for (dx, dy), P in zip(OFFS, GROUP): walk(P, f0, f1, Vector(p0) + Vector((dx, dy, 0)), Vector(p1) + Vector((dx, dy, 0)), period=period)
    dog_trot(DOG, f0, f1, Vector(p0) + Vector((-0.8, -0.9, 0)), Vector(p1) + Vector((-0.8, -0.9, 0)))
def scarves_up(f):
    for P, s_ in SCARVES:
        z = s_.location.z; key(s_, 'location', f - 6, (0, -0.02, z)); key(s_, 'location', f, (0, -0.04, z + 0.15)); key(s_, 'scale', f - 6, (1, 1, 1)); key(s_, 'scale', f, (0.95, 1, 1.25))
def smoke_rise(e):
    for k, root in enumerate(COLS):
        key(root, 'location', 0, root.location.copy()); key(root, 'location', e, root.location + Vector((0, 6, 3)))
def embers(n, lo, hi, e, seed=5):
    rd = random.Random(seed)
    for k in range(n):
        p0 = Vector((rd.uniform(lo[0], hi[0]), rd.uniform(lo[1], hi[1]), rd.uniform(lo[2], hi[2])))
        o = inst(mote, tuple(p0), (0.015, 0.015, 0.015), name='mote'); t0 = rd.randint(0, max(1, e - 20))
        key(o, 'location', 0, p0); key(o, 'location', e, p0 + Vector((rd.uniform(-1, 1), rd.uniform(4, 9), rd.uniform(1, 3))))

if SHOT == 'A':     # the clearing, bright: the group looking south at the fire wall; smoke towers lean over them to the north
    sky(*DAY, 1.0); sun(3.2, (1.0, 0.86, 0.68), 34, 160)
    cam_data.lens = 24
    group_at(CL + Vector((0, 2, 0)), (CL.x, FRONT, 0))
    smoke_rise(E); embers(120, (CL.x - 20, FRONT, 0.5), (CL.x + 20, FRONT + 10, 6), E)
    camkeys([(0, tuple(CL + Vector((3, 9, 1.6))), tuple(CL + Vector((-1, -14, 3.4)))), (E, tuple(CL + Vector((2.6, 8.0, 1.6))), tuple(CL + Vector((-1, -14, 3.8))))])
elif SHOT == 'B':   # high: the wind north (smoke leans north), the fire front; they turn and go east, across the wind, to the road
    sky(*DAY, 1.0); sun(3.2, (1.0, 0.86, 0.68), 34, 160)
    cam_data.lens = 22
    for P in GROUP + [DOG]: P['root'].rotation_euler = (0, 0, math.radians(90))
    group_walk(int(E * 0.15), E, CL + Vector((0, 2, 0)), Vector((RX - 2, 2, 0)))
    smoke_rise(E)
    camkeys([(0, (RX + 26, -4, 30), tuple(CL + Vector((4, 4, 0)))), (E, (RX + 24, 0, 28), tuple(CL + Vector((10, 4, 0))))])
elif SHOT == 'C':   # close on the hunter: smoke drifting past, glowing dust in it, the dosimeter
    sky(*DAY, 0.9); sun(2.6, (1.0, 0.75, 0.5), 30, 160)
    cam_data.lens = 40
    group_at(Vector((RX - 2, 2, 0)), (RX - 2, 30, 0))
    hide(*[P['root'] for P in GROUP[1:]])
    embers(260, (RX - 6, -2, 0.6), (RX + 3, 6, 3.2), E, seed=9)
    for k in range(6):
        r_ = rf.uniform(1.6, 2.6); o = inst(puff, (RX - 7 + k * 1.6, -2.5 + rf.uniform(0, 1.5), rf.uniform(1.4, 3.0)), (r_, r_, r_ * 0.6), name='cpuff')
        key(o, 'location', 0, o.location.copy()); key(o, 'location', E, o.location + Vector((2, 3, 0.6)))
    camkeys([(0, (RX - 1.1, 4.6, 1.62), (RX - 2.0, 2.0, 1.35)), (E, (RX - 1.2, 4.3, 1.6), (RX - 2.0, 2.0, 1.35))])
    dof(2.6, 3.5)
elif SHOT == 'D':   # on the road: the smoke wall rolls towards them; they stop at its edge
    sky(*DAY, 0.85); sun(2.4, (1.0, 0.72, 0.48), 28, 160)
    cam_data.lens = 26
    group_at(Vector((RX, 52, 0)), (RX, 80, 0))
    key(WALL, 'location', 0, Vector((RX, 74, 0))); key(WALL, 'location', E, Vector((RX, 62, 0)))
    camkeys([(0, (RX + 4, 42, 1.6), (RX, 64, 3.0)), (E, (RX + 3.5, 43.5, 1.6), (RX, 64, 3.4))])
elif SHOT == 'E':   # scarves up, crouched: along the road under the smoke layer
    sky(*DAY, 0.8); sun(2.2, (1.0, 0.7, 0.45), 26, 160)
    cam_data.lens = 26
    for P in GROUP + [DOG]: P['root'].rotation_euler = (0, 0, 0)
    for P in GROUP: P['root'].scale = (1, 1, 0.72)                                   # crouched
    scarves_up(4)
    for P in GROUP: P['root'].rotation_euler = (0, 0, math.radians(180))
    group_walk(0, E, Vector((RX, 96, 0)), Vector((RX, 112, 0)), period=30)
    camkeys([(0, (RX + 2.8, 126, 0.9), (RX, 104, 1.2)), (E, (RX + 2.5, 127.5, 0.9), (RX, 110, 1.2))])
elif SHOT == 'F':   # the checkpoint: the officer passes the probe over the hunter; the others wait; the barrier down
    sky(*DAY, 1.0); sun(3.0, (1.0, 0.84, 0.66), 32, 160)
    cam_data.lens = 30
    group_at(CP + Vector((0.5, -1.0, 0)), CP + Vector((0, 10, 0)), spread=1.1)
    place(OFF, CP + Vector((0.6, 0.4, 0)), CP + Vector((0.5, -1.0, 0)))
    PROBE.parent = OFF['root']; PROBE.location = (0.3, -0.45, 1.0); PROBE.rotation_euler = (math.radians(70), 0, 0)
    for f, z in [(0, 1.5), (int(E * 0.3), 0.7), (int(E * 0.6), 1.3), (E, 0.9)]: key(PROBE, 'location', f, (0.3, -0.45, z))
    camkeys([(0, tuple(CP + Vector((5.5, -7.5, 1.9))), tuple(CP + Vector((0, 0, 1.3)))), (E, tuple(CP + Vector((5.0, -6.8, 1.9))), tuple(CP + Vector((0, 0, 1.3))))])
elif SHOT == 'G':   # far: the arch over the reactor on the horizon; the burning forest and the smoke before it
    sky((0.42, 0.52, 0.66), (0.98, 0.72, 0.5), 1.0); sun(2.6, (1.0, 0.7, 0.45), 14, 190)
    cam_data.lens = 35
    hide(*[P['root'] for P in GROUP], DOG['root'])
    FAR = FIRE.copy(); FAR.node_tree.nodes['Math'].inputs[1].default_value = 4.0
    _r = FAR.node_tree.nodes['Color Ramp'].color_ramp; _r.elements[0].color = (0.8, 0.06, 0.0, 1); _r.elements[1].color = (1.0, 0.3, 0.0, 1)
    farflame = proto('farflame', lambda: cyl((0, 0, 0), 1.0, 1.0, FAR, verts=7, r2=0.0))
    C = AR + Vector((-150, -560, 0)); fw = Vector((150, 560, 0)).normalized(); rt = Vector((fw.y, -fw.x, 0))
    for k, root in enumerate(COLS[:4]): root.location = C + fw * (300 - 12 * k) + rt * (-95 + 38 * k); root.scale = (3, 3, 3)
    for root in COLS[4:]: hide(root)
    cam_data.lens = 35
    camkeys([(0, tuple(C + Vector((0, 0, 30))), tuple(AR + Vector((0, 0, 42)))), (E, tuple(C + Vector((4, 10, 31))), tuple(AR + Vector((0, 0, 42))))])
    for k in range(90):
        d = rf.uniform(110, 430); l = rf.uniform(-0.3, 0.3) * d
        q = C + fw * d + rt * l
        pine(q.x, q.y, rf.uniform(10, 16), 'snag' if k % 3 == 1 else 'young', 7000 + k)
        if k % 2 == 0:
            for j in range(3):
                inst(farflame, (q.x + rf.uniform(-3, 3), q.y + rf.uniform(-3, 3), 0), (rf.uniform(1.8, 2.6),) * 2 + (rf.uniform(5, 9),), (0, 0, 0), 'farflame')
    HAZE = 0.0003
else:               # H: past the barrier, the road clean; they walk on, turn and wave back
    sky(*DAY, 1.0); sun(3.2, (1.0, 0.86, 0.68), 34, 160)
    cam_data.lens = 26
    place(OFF, CP + Vector((-2.2, 0.5, 0)), CP + Vector((0, 10, 0)))
    for P in GROUP + [DOG]: P['root'].rotation_euler = (0, 0, math.radians(180))
    group_walk(0, int(E * 0.7), CP + Vector((0, 6, 0)), CP + Vector((0, 14, 0)), period=28)
    w = int(E * 0.72)
    for P in GROUP:
        key(P['root'], 'rotation_euler', w, (0, 0, math.radians(180))); key(P['root'], 'rotation_euler', w + 8, (0, 0, 0))
        sh = P['arms'][1]; key(sh, 'rotation_euler', w + 6, (0, 0, 0)); key(sh, 'rotation_euler', w + 12, (math.radians(-160), 0, 0))
        for f in range(w + 12, E, 8): key(sh, 'rotation_euler', f, (math.radians(-160), 0, math.radians(20 if (f // 8) % 2 else -20)))
    camkeys([(0, tuple(CP + Vector((1.5, -6, 1.8))), tuple(CP + Vector((0, 12, 1.4)))), (E, tuple(CP + Vector((1.2, -5, 1.8))), tuple(CP + Vector((0, 14, 1.4))))])
# every smoke plane turns to the camera
for o in list(bpy.data.objects):
    if o.name.split('.')[0] in ('puff', 'wallpuff', 'layerpuff', 'cpuff'):
        c = o.constraints.new('TRACK_TO'); c.target = cam; c.track_axis = 'TRACK_Z'; c.up_axis = 'UP_Y'
kit.volume_box((-900, -300, -1), (900, 1700, 220), HAZE, color=(0.95, 0.82, 0.7), aniso=0.6)
kit.ease_all()
kit.render(sc, OUT, F0, NF, PCT, SAMPLES, STEP)
