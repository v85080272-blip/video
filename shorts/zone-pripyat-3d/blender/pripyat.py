# «Мёртвый город» («Зона», серия 4) in 3D. Pripyat, forty years empty: the hunter and Пурга, Богдан again, and the three who
# wrote «возьми с собой» — Коля (green spiky hair, a pink jacket), Настя (a ginger ponytail, a teal windbreaker), Мэри (a grey
# hoodie, a beanie with cat ears). The places are built side by side in one scene: the avenue with its blocks and birches,
# the entrance stele «ПРИПЯТЬ 1970», the column of buses (1986), the balcony block, the school room with the gas masks,
# the hospital «МСЧ-126» with its basement stairs, the basement, the exit checkpoint, the wheel, smoke far off.
# usage: python blender/pripyat.py <shot A..K> <seconds> <out dir> [percent 66] [samples 10] [step 2] [first frame 0]
#   A hook: high over the avenue, down to the six at the stele      B the six at the stele; each waves when named
#   C 1986: the column of buses (old film)                            D Коля goes for a doorway; the hunter stops him
#   E a balcony slab comes down; they jump back                       F the school room: Мэри picks up a gas mask, puts it down
#   G the hospital: Настя at the basement stairs, Богдан holds her    H the basement: a firefighter's helmet in the torch beam
#   I sunset: they walk fast down the avenue                          J the exit frame: one by one; Мэри's thumbs up
#   K dusk at the fork: smoke far off, the choice
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


def birch(x, y, h, seed):
    r = random.Random(seed)
    inst(proto('btrunk', lambda: cyl((0, 0, 0), 1.0, 1.0, BIRCH, verts=7)), (x, y, h / 2), (0.12, 0.12, h), (r.uniform(-0.05, 0.05), r.uniform(-0.05, 0.05), 0), 'btrunk')
    crown = proto('crown', lambda: ico((0, 0, 0), 1.0, LEAF, sub=1))
    for k in range(3): inst(crown, (x + r.uniform(-0.8, 0.8), y + r.uniform(-0.8, 0.8), h * r.uniform(0.6, 0.9)), (h * 0.18, h * 0.18, h * 0.24), name='crown')
rf = random.Random(9)
n = 0


def facade_day():
    """a Soviet sixteen-storey block by day: pale panels, rows of dark empty windows, some panes still catching the sky"""
    m = bpy.data.materials.new('facade_day'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = 0.9
    geo = N.new('ShaderNodeNewGeometry'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep.inputs[0])
    nrm = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], nrm.inputs[0])
    def op(o, a, bb=None):
        n = N.new('ShaderNodeMath'); n.operation = o
        (L.new(a, n.inputs[0]) if not isinstance(a, (int, float)) else n.inputs[0].__setattr__('default_value', a))
        if bb is not None: (L.new(bb, n.inputs[1]) if not isinstance(bb, (int, float)) else n.inputs[1].__setattr__('default_value', bb))
        return n.outputs[0]
    h = op('ADD', sep.outputs['X'], sep.outputs['Y'])
    hs, vs = op('DIVIDE', h, 3.0), op('DIVIDE', sep.outputs['Z'], 2.8)
    fh, fv = op('FRACT', hs), op('FRACT', vs)
    win = op('MULTIPLY', op('MULTIPLY', op('GREATER_THAN', fh, 0.2), op('LESS_THAN', fh, 0.62)), op('MULTIPLY', op('GREATER_THAN', fv, 0.3), op('LESS_THAN', fv, 0.78)))
    win = op('MULTIPLY', win, op('LESS_THAN', op('ABSOLUTE', nrm.outputs['Z']), 0.5))
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.3; L.new(geo.outputs['Position'], nz.inputs['Vector'])
    wall = N.new('ShaderNodeMix'); wall.data_type = 'RGBA'; L.new(nz.outputs['Fac'], wall.inputs['Factor'])
    wall.inputs['A'].default_value = (0.42, 0.42, 0.4, 1); wall.inputs['B'].default_value = (0.6, 0.59, 0.55, 1)
    c = N.new('ShaderNodeMix'); c.data_type = 'RGBA'; L.new(win, c.inputs['Factor']); L.new(wall.outputs['Result'], c.inputs['A'])
    c.inputs['B'].default_value = (0.03, 0.035, 0.04, 1); L.new(c.outputs['Result'], b.inputs['Base Color'])
    rg = N.new('ShaderNodeMath'); rg.operation = 'MULTIPLY_ADD'; L.new(win, rg.inputs[0]); rg.inputs[1].default_value = -0.75; rg.inputs[2].default_value = 0.92
    L.new(rg.outputs[0], b.inputs['Roughness'])
    return m




# —— Pripyat's own materials ——
WHITE_P = noisy('white_p', (0.62, 0.62, 0.6), (0.82, 0.81, 0.78), scale=3.0, rough=0.7)
STEEL = mat('steel', (0.35, 0.36, 0.38), rough=0.45, metal=0.7)
YEL = noisy('yel', (0.75, 0.55, 0.08), (0.45, 0.3, 0.08), scale=4.0, rough=0.6)
BUSY = noisy('bus_y', (0.82, 0.6, 0.12), (0.6, 0.4, 0.1), scale=3.0, rough=0.5)
BUSB = noisy('bus_b', (0.2, 0.35, 0.6), (0.14, 0.24, 0.42), scale=3.0, rough=0.5)
GLASS = mat('glass', (0.12, 0.16, 0.2), rough=0.08, metal=0.2)
STELE = noisy('stele', (0.7, 0.7, 0.68), (0.5, 0.5, 0.48), scale=2.0, rough=0.8, bump=0.1)
LETTER = mat('letter', (0.86, 0.85, 0.82), rough=0.6)
FLOOR = noisy('floor', (0.5, 0.36, 0.22), (0.32, 0.22, 0.13), scale=2.5, rough=0.85)
WALLI = noisy('wall_in', (0.55, 0.6, 0.55), (0.38, 0.42, 0.38), scale=1.5, rough=0.9, bump=0.1)
DESK = noisy('desk', (0.45, 0.32, 0.18), (0.3, 0.2, 0.1), scale=6.0)
HELM = mat('helmet', (0.55, 0.42, 0.18), rough=0.35, metal=0.6)
COAT = noisy('coat', (0.12, 0.12, 0.1), (0.2, 0.19, 0.16), scale=5.0)
SMOKE = mat('smoke', (0.12, 0.11, 0.1), rough=1.0)
EMBER = mat('ember', (1.0, 0.35, 0.08), emit=12)
GREEN_ON = mat('green_on', (0.2, 1.0, 0.3), emit=25)
RED = mat('red_p', (0.7, 0.08, 0.06))
FDAY = facade_day()
FONT = kit.font()


def label3d(txt, loc, size, m, rot=(math.radians(90), 0, 0), extrude=0.0, align='CENTER'):
    bpy.ops.object.text_add(location=tuple(loc), rotation=rot); t = bpy.context.object
    t.data.body = txt; t.data.font = FONT; t.data.size = size; t.data.align_x = align; t.data.extrude = extrude; t.data.materials.append(m)
    return t


# —— the ground: the avenue along y at x = 0, sidewalks, grass between the blocks ——
box((260, 60, -0.05), (820, 900, 0.1), GRASS, name='ground')                  # x −150 … 670; the hospital's ground is built round its pit (below)
box((0, 60, 0.02), (14, 520, 0.04), ASPH, name='avenue')
for sx in (-1, 1): box((sx * 10.5, 60, 0.06), (7, 520, 0.12), CONC, name='sidewalk')

# —— the blocks: nine- and sixteen-storey panel houses down both sides; birches grown up everywhere ——
rs = random.Random(31)
for k in range(12):
    for side in (-1, 1):
        y = -100 + k * 34 + rs.uniform(-3, 3)
        if side == 1 and abs(y + 60) < 20: continue          # the balcony block stands there (below)
        hgt = rs.choice([27.0, 27.0, 45.0])
        box((side * (22 + rs.uniform(0, 3)), y, hgt / 2), (14, 26, hgt), FDAY, name='sblock')
for k in range(150):
    x = rs.uniform(-17, 17); y = rs.uniform(-120, 300)
    if abs(x) < 8.5: continue
    birch(x, y, rs.uniform(7, 15), 900 + k)
for k in range(30):                                          # a few right in the asphalt: forty years
    x = rs.uniform(-6, 6); y = rs.uniform(-20, 300)
    if abs(x) < 2.0: continue
    birch(x, y, rs.uniform(4, 9), 1900 + k)

# —— the balcony block (D, E): a nine-storey house, its face to the avenue at x = 15, a dark open doorway, balconies ——
BB = Vector((22, -60, 0))
box(BB + Vector((0, 0, 13.5)), (14, 30, 27), FDAY, name='bblock')
DOORW = BB + Vector((-7.05, 0, 0))
box(DOORW + Vector((0, 0, 1.25)), (0.12, 1.8, 2.5), DARK, name='doorway')
box(DOORW + Vector((-0.8, 0, 2.7)), (1.6, 2.6, 0.15), CONCD, name='door_canopy')
SLABS = {}
for fl in range(1, 9):
    for dy in (-8, 8):
        z_ = fl * 2.8
        sl = box(BB + Vector((-7.6, dy, z_)), (1.2, 3.4, 0.16), CONCD, name='balcony'); SLABS[(fl, dy)] = sl
        box(BB + Vector((-8.15, dy, z_ + 0.5)), (0.06, 3.4, 0.9), RUSTD, name='rail')
FALL = box(BB + Vector((-7.6, 0, 8.4)), (1.2, 3.0, 0.16), CONCD, name='balcony_fall')          # right over the door: it comes down in E
box(BB + Vector((-7.6, 0, 11.2)), (1.2, 3.0, 0.16), CONCD, name='balcony')

# —— the entrance stele: «ПРИПЯТЬ» and «1970» on a long concrete base ——
ST = Vector((0, -150, 0))
box(ST + Vector((-1.0, 0, 1.0)), (15, 1.0, 2.0), STELE, name='stele_base')
label3d('ПРИПЯТЬ', ST + Vector((-1.0, 0.0, 2.0)), 1.9, LETTER, rot=(math.radians(90), 0, math.radians(180)), extrude=0.18)
label3d('1970', ST + Vector((4.6, 0.52, 0.6)), 0.8, LETTER, rot=(math.radians(90), 0, math.radians(180)), extrude=0.04)

for k in range(46):
    birch(random.uniform(-40, 40), random.uniform(-200, -158), random.uniform(9, 16), 4100 + k)

# —— 1986 (C): the column of buses down the avenue ——
BUSES = []
for k in range(14):
    b = Vector((3.4, 30 + k * 13, 0)); m_ = BUSY if k % 3 else BUSB
    o1 = box(b + Vector((0, 0, 1.75)), (2.5, 11.0, 2.6), m_, name='bus'); o2 = box(b + Vector((0, 0, 2.3)), (2.52, 10.0, 0.8), GLASS, name='bus_win')
    ws = [cyl(b + Vector((dx, dy, 0.48)), 0.48, 0.3, DARK, verts=12, rot=(0, math.pi / 2, 0), name='bus_wheel') for dy in (-3.8, 3.6) for dx in (-1.15, 1.15)]
    BUSES += [o1, o2] + ws

# —— the Ferris wheel, seen far up the avenue (I, K) ——
WX, WY = -40.0, 360.0
HUB = 14.8; RIM = 12.5
def wheel():
    for side in (-1.0, 1.0):
        bpy.ops.mesh.primitive_torus_add(major_radius=RIM, minor_radius=0.12, major_segments=64, minor_segments=6,
                                         location=(WX, WY + side * 0.9, HUB), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; t.data.materials.append(WHITE_P); t.name = 'rim'
        bpy.ops.mesh.primitive_torus_add(major_radius=RIM * 0.82, minor_radius=0.07, major_segments=64, minor_segments=6,
                                         location=(WX, WY + side * 0.9, HUB), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; t.data.materials.append(WHITE_P); t.name = 'rim2'
        for k in range(16):
            a = 2 * math.pi * k / 16
            cyl((WX + RIM / 2 * math.cos(a), WY + side * 0.9, HUB + RIM / 2 * math.sin(a)), 0.05, RIM, WHITE_P, verts=5,
                rot=(0, math.pi / 2 - a, 0), name='spoke')
        for dx in (-1, 1):                          # the A-frame legs
            top = Vector((WX, WY + side * 1.3, HUB)); foot = Vector((WX + dx * 6.5, WY + side * 2.6, 0))
            mid = (top + foot) / 2; d = top - foot
            o = cyl(tuple(mid), 0.22, d.length, RUST, verts=8, name='leg'); o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    cyl((WX, WY, HUB), 0.5, 2.6, RUST, verts=12, rot=(math.pi / 2, 0, 0), name='hub')
    for k in range(16):                             # the cabins: yellow, rusted, hanging from the rim, one a little tilted
        a = 2 * math.pi * k / 16 + 0.1
        cx, cz = WX + RIM * math.cos(a), HUB + RIM * math.sin(a)
        cyl((cx, WY, cz - 0.15), 0.04, 0.5, STEEL, verts=4, name='hanger')
        tilt = math.radians(8 if k == 5 else random.uniform(-2, 2))
        box((cx, WY, cz - 1.05), (1.3, 1.25, 1.1), YEL, rot=(0, tilt, 0), name='cabin')
        cyl((cx, WY, cz - 0.42), 0.75, 0.18, YEL, verts=10, r2=0.35, rot=(0, tilt, 0), name='cabin_roof')
        box((cx, WY - 0.64, cz - 0.95), (1.0, 0.02, 0.45), DARK, rot=(0, tilt, 0), name='cabin_window')

wheel()

# —— the school room (F): gas masks all over the floor, overturned desks, light through the windows ——
SR_ = Vector((300, 0, 0))
box(SR_ + Vector((0, 0, 0.0)), (12, 9, 0.1), FLOOR, name='room_floor')
box(SR_ + Vector((0, 0, 3.3)), (12, 9, 0.2), WALLI, name='room_ceiling')
box(SR_ + Vector((0, 4.6, 1.6)), (12, 0.2, 3.4), WALLI, name='room_back')
box(SR_ + Vector((-6.1, 0, 1.6)), (0.2, 9, 3.4), WALLI, name='room_left')
for k, x in enumerate((-4.2, -1.4, 1.4, 4.2)):                 # the window wall at x = +6 … no: windows in the right wall
    pass
for y0, y1 in ((-4.5, -3.2), (-2.0, -0.6), (0.6, 2.0), (3.2, 4.5)):
    box(SR_ + Vector((6.1, (y0 + y1) / 2, 1.6)), (0.2, y1 - y0, 3.4), WALLI, name='room_pier')
box(SR_ + Vector((6.1, 0, 0.45)), (0.2, 9, 0.9), WALLI, name='room_sill'); box(SR_ + Vector((6.1, 0, 3.0)), (0.2, 9, 0.6), WALLI, name='room_lintel')
rd = random.Random(44)
for k in range(7):
    p = SR_ + Vector((rd.uniform(-4.5, 4.5), rd.uniform(-3, 3.5), 0.4))
    box(p, (1.2, 0.6, 0.05), DESK, rot=(rd.choice([0, 1.4, -1.2]), 0, rd.uniform(0, 3)), name='desk')
def gasmask():
    parts = []
    def add(o): parts.append(o)
    add(ico((0, 0, 0), 0.15, M['mask'], sub=2, scale=(1.0, 0.75, 1.25)))
    for dx in (-0.06, 0.06): add(cyl((dx, -0.1, 0.045), 0.048, 0.035, STEEL, verts=14, rot=(math.pi / 2, 0, 0))); add(cyl((dx, -0.118, 0.045), 0.038, 0.01, M['glass_m'], verts=14, rot=(math.pi / 2, 0, 0)))
    add(cyl((0, -0.12, -0.09), 0.035, 0.07, M['mask'], verts=8, rot=(math.pi / 2, 0, 0)))
    add(cyl((0, -0.18, -0.16), 0.055, 0.12, STEEL, verts=10, rot=(math.pi / 2.6, 0, 0)))
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); return bpy.context.object
GM = proto('gasmask', gasmask)
for k in range(170):
    p = SR_ + Vector((rd.uniform(-5.6, 5.6), rd.uniform(-4.1, 4.1), 0.06))
    inst(GM, tuple(p + Vector((0, 0, 0.03))), (1, 1, 1), (rd.uniform(-1.85, -1.3), rd.uniform(-0.35, 0.35), rd.uniform(0, 6.28)), name='gm')     # face up: the eyepieces to the ceiling
MASK = inst(GM, (0, 0, 0), name='mary_mask')                    # the one Мэри picks up (parented to her hand in F)
bpy.ops.object.light_add(type='AREA', location=tuple(SR_ + Vector((0, 0, 3.0)))); RFILL = bpy.context.object; RFILL.data.energy = 650; RFILL.data.size = 9; RFILL.data.color = (0.85, 0.9, 1.0)

# —— the hospital (G): a five-storey block, «МСЧ-126» over the porch, the stairs down to the basement door ——
HO = Vector((-300, 0, 0))
box(HO + Vector((0, 10, 8)), (40, 16, 16), FDAY, name='hospital')
box(HO + Vector((0, 1.6, 3.2)), (8, 1.4, 0.3), CONCD, name='porch_roof')
label3d('МСЧ-126', HO + Vector((0, 1.85, 4.1)), 0.9, LETTER, rot=(math.radians(90), 0, math.radians(180)), extrude=0.05)
box(HO + Vector((0, 2.0, 1.2)), (2.0, 0.1, 2.4), DARK, name='porch_door')
BS = HO + Vector((10, 0, 0))                                     # the basement stairs: a pit along the wall going down to −2.6
hx0, hx1, hy0, hy1 = BS.x - 1.75, BS.x + 1.95, BS.y - 2.0, BS.y + 0.0      # the pit's opening
box(((-450 + hx0) / 2, 0, -0.05), (hx0 + 450, 600, 0.1), GRASS, name='hground')
box(((hx1 - 150) / 2, 0, -0.05), (-150 - hx1, 600, 0.1), GRASS, name='hground')
box(((hx0 + hx1) / 2, (hy1 + 300) / 2, -0.05), (hx1 - hx0, 300 - hy1, 0.1), GRASS, name='hground')
box(((hx0 + hx1) / 2, (hy0 - 300) / 2, -0.05), (hx1 - hx0, hy0 + 300, 0.1), GRASS, name='hground')
box(BS + Vector((0, -1.0, -2.75)), (3.6, 2.2, 0.1), CONCD, name='pit_floor')
box(BS + Vector((0, -0.05, -1.3)), (3.6, 0.15, 2.6), CONCD, name='pit_wall_b')
for k in range(9):
    box(BS + Vector((-1.6 + k * 0.38, -1.0, -0.15 - k * 0.29)), (0.4, 1.4, 0.12), CONC, name='step')
for sx in (-1.75, 1.75): pass
box(BS + Vector((0, -1.75, -1.2)), (3.6, 0.15, 2.6), CONCD, name='pit_wall')
box(BS + Vector((1.95, -1.0, -1.3)), (0.15, 2.0, 2.6), CONCD, name='pit_end')
box(BS + Vector((-1.8, -1.0, -1.3)), (0.15, 2.0, 2.6), CONCD, name='pit_head')
box(BS + Vector((1.82, -1.0, -1.7)), (0.04, 1.0, 1.8), DARK, name='basement_door')
for k in range(6): cyl(BS + Vector((-1.7 + k * 0.7, -1.82, 0.5)), 0.03, 1.0, RUSTD, verts=5, name='rail_post')
box(BS + Vector((0.05, -1.82, 1.0)), (3.6, 0.04, 0.04), RUSTD, name='rail')

# —— the basement (H): darkness, a firefighter's helmet and a boot on the floor, a coat thrown down ——
BA = Vector((-300, -60, -3))
box(BA + Vector((0, 0, -0.05)), (10, 10, 0.1), CONCD, name='bas_floor'); box(BA + Vector((0, 0, 2.6)), (10, 10, 0.1), CONCD, name='bas_ceiling')
box(BA + Vector((0, 4, 1.3)), (10, 0.2, 2.6), CONCD, name='bas_wall')
HELMET = empty(BA + Vector((0.2, 1.0, 0.0)), 'helmet')
ico((0, 0, 0.12), 0.17, HELM, sub=2, scale=(1.0, 1.15, 0.85), parent=HELMET); cyl((0, 0, 0.03), 0.24, 0.03, HELM, verts=20, parent=HELMET)
box((0, 0, 0.27), (0.03, 0.3, 0.06), HELM, parent=HELMET)
HELMET.rotation_euler = (0.25, 0.1, 0.6)
box(BA + Vector((-0.7, 1.3, 0.12)), (0.7, 0.9, 0.18), COAT, rot=(0, 0.1, 0.4), name='coat')
cyl(BA + Vector((0.9, 0.7, 0.15)), 0.09, 0.3, DARK, verts=8, name='boot'); box(BA + Vector((0.9, 0.58, 0.05)), (0.14, 0.3, 0.1), DARK, name='boot_toe')
for k in range(12):
    box(BA + Vector((random.uniform(-3, 3), random.uniform(-1, 3.5), 0.03)), (random.uniform(0.2, 0.6), random.uniform(0.2, 0.6), 0.02), COAT, rot=(0, 0, random.uniform(0, 3)), name='rag')

# —— the exit checkpoint (J): a white booth, the barrier and the radiation control frame ——
CK = Vector((600, 0, 0))
box(CK + Vector((0, 0, 0.02)), (10, 60, 0.04), ASPH, name='ck_road')
box(CK + Vector((7.5, 0, 1.4)), (4.0, 3.0, 2.8), WHITE_P, name='booth'); box(CK + Vector((7.5, 0, 2.9)), (4.4, 3.4, 0.2), DARK, name='booth_roof')
box(CK + Vector((5.45, 0, 1.6)), (0.05, 2.0, 1.0), GLASS, name='booth_glass')
for dx in (-0.55, 0.55): box(CK + Vector((dx, 0, 1.1)), (0.22, 0.6, 2.2), WHITE_P, name='frame_post')
box(CK + Vector((0, 0, 2.3)), (1.4, 0.6, 0.22), WHITE_P, name='frame_top')
LAMP = ico(CK + Vector((0, 0, 2.5)), 0.09, GREEN_ON, sub=2, name='frame_lamp')
cyl(CK + Vector((-4.0, 0, 0.5)), 0.12, 1.0, RED, verts=8, name='barrier_post'); box(CK + Vector((-4.0, 3.5, 1.0)), (0.12, 7.0, 0.12), WHITE_P, name='barrier')
for k in range(40):
    x = CK.x + random.choice([-1, 1]) * random.uniform(7, 40); y = random.uniform(-40, 60)
    birch(x, y, random.uniform(6, 14), 3000 + k)

# —— far smoke on the horizon (K): a column of grey puffs, a glow at its foot ——
SMK = Vector((-140, 760, 0))
for k in range(26):
    o = ico(SMK + Vector((random.uniform(-15, 15) + k * 2.5, random.uniform(-10, 10), 8 + k * 9)), 1.0, SMOKE, sub=2, scale=(18 + k, 18 + k, 12 + k * 0.6)); o.visible_shadow = False
for k in range(6): ico(SMK + Vector((random.uniform(-30, 30), random.uniform(-10, 10), 2)), 3 + random.uniform(0, 3), EMBER, sub=1)

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


# —— the people: the hunter and Пурга, Богдан again, and the three who wrote «возьми с собой» ——
HUN = person(0, 0, 0, 'hunter'); DOG = person(0, 0, 0, 'dog'); BOG = person(0, 0, 0, 'bogdan')
KOL = person(0, 0, 0, 'kolya'); NAS = person(0, 0, 0, 'nastya'); MAR = person(0, 0, 0, 'mary')
box((0, -0.26, 1.28), (0.09, 0.03, 0.14), M['dosim'], parent=HUN['root']); box((0, -0.278, 1.31), (0.06, 0.004, 0.04), M['lcd'], parent=HUN['root'])
ALL = [HUN, DOG, KOL, NAS, MAR, BOG]


def wave(P, f0, f1, side=1, up=-160):
    sh = P['arms'][side]
    for f, a, b in [(f0, 0, 0), (f0 + 5, up, 20), (f0 + 10, up, -10), (f0 + 15, up, 20), (min(f1, f0 + 22), 0, 0)]:
        key(sh, 'rotation_euler', f, (math.radians(a), 0, math.radians(b)))
def arm_to(P, f, ang, side=1, ang_z=0):
    key(P['arms'][side], 'rotation_euler', f, (math.radians(ang), 0, math.radians(ang_z)))
def group_at(base, towards, spacing=0.8):
    """the six in a loose row across `base`, all facing `towards`"""
    offs = [(-2.9, 0.2), (-1.9, -0.3), (-0.6, 0.1), (0.6, -0.15), (1.8, 0.15), (3.0, -0.1)]
    order = [KOL, HUN, DOG, NAS, MAR, BOG]
    d = (Vector(towards) - Vector(base)); d.z = 0; d.normalize(); side = Vector((d.y, -d.x, 0))
    for P, (a, b) in zip(order, offs): place(P, Vector(base) + side * a * spacing + d * b, Vector(towards) + side * a * spacing)


HAZE, HCOL = 0.0004, (0.75, 0.78, 0.82)
if SHOT != 'C': hide(*BUSES)
if SHOT in 'ABCDEFG':
    sky((0.16, 0.22, 0.32), (0.42, 0.45, 0.48), 0.85); sun(2.4, (1.0, 0.95, 0.86), 38, 130)
if SHOT == 'A':     # hook: high over the avenue, the blocks and the trees, down to the six at the stele
    cam_data.lens = 22
    group_at(ST + Vector((0, 4.0, 0)), ST + Vector((0, 60, 0)))
    camkeys([(0, (0, 140, 75), (0, -40, 0)), (int(E * 0.45), (0, 10, 42), (0, -120, 0)), (int(E * 0.8), (1.5, -128, 6), (0, -146, 1.5)), (E, (1.8, -133, 2.4), (0, -146, 1.5))])
elif SHOT == 'B':   # the six at the stele, facing us; each waves when named
    cam_data.lens = 30
    group_at(ST + Vector((0, 4.0, 0)), ST + Vector((0, 60, 0)))
    evs = [int(E * ev(i, d)) for i, d in enumerate((0.3, 0.38, 0.48, 0.9))]
    for P, f in zip((KOL, NAS, MAR, BOG), evs): wave(P, f, E, side=1)
    cam_data.lens = 32
    cam_data.lens = 30
    camkeys([(0, (0.4, -137.0, 1.5), (-0.2, -146, 1.9)), (E, (0.6, -137.6, 1.45), (-0.2, -146, 1.95))])
    dof(9.0, 5.6)
elif SHOT == 'C':   # 1986: the column of buses down the avenue (graded like old film in tools/bg.py)
    cam_data.lens = 26
    hide(*[P['root'] for P in ALL])
    camkeys([(0, (-2.5, 10, 1.7), (3.4, 120, 2.0)), (E, (-2.2, 34, 1.75), (3.4, 150, 2.0))])
elif SHOT == 'D':   # Коля goes for the dark doorway; the hunter catches his shoulder
    cam_data.lens = 26
    k0 = DOORW + Vector((-7.5, -3.5, 0)); k1 = DOORW + Vector((-1.6, -0.4, 0))
    KOL['root'].rotation_euler = heading(k0, k1); walk(KOL, 0, int(E * ev(0, 0.6)), tuple(k0), tuple(k1))
    h0 = DOORW + Vector((-9.5, -4.5, 0)); h1 = DOORW + Vector((-2.6, -1.2, 0))
    HUN['root'].rotation_euler = heading(h0, h1); walk(HUN, 0, int(E * ev(0, 0.6)) + 6, tuple(h0), tuple(h1), period=18)
    fp = int(E * ev(0, 0.6)); arm_to(HUN, fp, 0); arm_to(HUN, fp + 6, -80, ang_z=-20)
    key(KOL['head'], 'rotation_euler', fp + 4, (0, 0, 0)); key(KOL['head'], 'rotation_euler', fp + 10, (0, 0, math.radians(-70)))
    for P, p in ((NAS, DOORW + Vector((-8.5, -6.0, 0))), (MAR, DOORW + Vector((-9.2, -5.0, 0))), (BOG, DOORW + Vector((-9.8, -6.6, 0))), (DOG, DOORW + Vector((-8.0, -4.4, 0)))): place(P, p, DOORW)
    camkeys([(0, tuple(DOORW + Vector((-6.5, -11.5, 1.7))), tuple(DOORW + Vector((-1.5, 0, 2.2)))), (E, tuple(DOORW + Vector((-5.5, -9.5, 1.6))), tuple(DOORW + Vector((-1.2, 0, 2.6))))])
elif SHOT == 'E':   # the balcony slab comes down in front of the door; they jump back
    cam_data.lens = 22
    fs = int(E * ev(0, 0.25))
    place(KOL, DOORW + Vector((-2.2, -0.6, 0)), DOORW + Vector((-0.5, 0, 0))); place(HUN, DOORW + Vector((-3.0, -1.3, 0)), DOORW)
    walk(KOL, fs + 4, fs + 16, tuple(DOORW + Vector((-2.2, -0.6, 0))), tuple(DOORW + Vector((-4.2, -1.8, 0))), swing=0.6, period=10, step=2)
    for P, p in ((NAS, DOORW + Vector((-6.0, 4.6, 0))), (MAR, DOORW + Vector((-6.8, 5.6, 0))), (BOG, DOORW + Vector((-5.4, 6.2, 0))), (DOG, DOORW + Vector((-5.0, 3.8, 0)))): place(P, p, DOORW)
    for P in (NAS, MAR, BOG): arm_to(P, fs + 4, 0, 0); arm_to(P, fs + 9, -60, 0); arm_to(P, fs + 9, -60, 1)
    p0 = FALL.location.copy(); land = Vector((p0.x - 1.6, p0.y + 0.0, 0.1))
    key(FALL, 'location', fs, p0); key(FALL, 'rotation_euler', fs, (0, 0, 0))
    for i in range(1, 7):
        u = i / 6; key(FALL, 'location', fs + i, Vector((p0.x + (land.x - p0.x) * u, p0.y, p0.z + (land.z - p0.z) * u * u)))
    key(FALL, 'rotation_euler', fs + 6, (0.25, 0.5, 0.1))
    DUST = []
    for k in range(10):
        d = ico(land + Vector((random.uniform(-1.5, 1.5), random.uniform(-1.5, 1.5), 0.3)), 0.4, CONC, sub=2); d.visible_shadow = False
        key(d, 'scale', 0, (0.001, 0.001, 0.001)); key(d, 'scale', fs + 6, (0.001, 0.001, 0.001)); key(d, 'scale', fs + 14, (2.2, 2.2, 1.4)); key(d, 'scale', E, (3.0, 3.0, 1.8))
    for k in range(14):
        ch = box(land + Vector((0, 0, 0.2)), (0.25, 0.2, 0.12), CONCD); v = Vector((random.uniform(-3, 3), random.uniform(-2, 2), 0))
        key(ch, 'location', 0, land + Vector((0, 0, -1))); key(ch, 'location', fs + 6, land + Vector((0, 0, 0.2))); key(ch, 'location', fs + 12, land + v + Vector((0, 0, 0.1)))
    camkeys([(0, tuple(DOORW + Vector((-11.0, -5.0, 1.2))), tuple(DOORW + Vector((-0.5, 1.5, 4.5)))), (E, tuple(DOORW + Vector((-11.5, -5.4, 1.25))), tuple(DOORW + Vector((-0.8, 1.5, 3.2))))])
    HAZE = 0.002
elif SHOT == 'F':   # the school room: Мэри picks up a gas mask… and puts it down
    cam_data.lens = 24
    sun(3.5, (1.0, 0.95, 0.86), 25, 95, name='sun_room')
    fp, fd = int(E * ev(0, 0.25)), int(E * ev(1, 0.62))
    place(MAR, SR_ + Vector((1.2, 0.4, 0)), SR_ + Vector((-2, -3, 0)))
    for P, p in ((NAS, SR_ + Vector((3.2, 2.2, 0))), (BOG, SR_ + Vector((4.0, 0.6, 0))), (HUN, SR_ + Vector((3.5, -1.6, 0))), (KOL, SR_ + Vector((2.6, 3.3, 0))), (DOG, SR_ + Vector((2.6, -0.4, 0)))): place(P, p, MAR['root'].location)
    hold = empty((0, 0, -0.6), 'mask_hold', parent=MAR['arms'][1]); MASK.parent = hold; MASK.location = (0, -0.05, -0.1); MASK.rotation_euler = (math.radians(-20), 0, math.radians(180))
    key(MASK, 'scale', 0, (0.001, 0.001, 0.001)); key(MASK, 'scale', fp + 3, (0.001, 0.001, 0.001)); key(MASK, 'scale', fp + 4, (1, 1, 1)); key(MASK, 'scale', fd + 3, (1, 1, 1)); key(MASK, 'scale', fd + 4, (0.001, 0.001, 0.001))
    arm_to(MAR, 0, 0); arm_to(MAR, fp, 30); arm_to(MAR, fp + 6, -95); arm_to(MAR, fd, -95); arm_to(MAR, fd + 6, 25); arm_to(MAR, fd + 12, 0)
    r0 = MAR['root'].rotation_euler.copy(); rb = r0.copy(); rb.x = math.radians(-22)
    key(MAR['root'], 'rotation_euler', max(0, fp - 6), r0); key(MAR['root'], 'rotation_euler', fp, rb); key(MAR['root'], 'rotation_euler', fp + 9, r0)
    key(HUN['head'], 'rotation_euler', fd - 8, (0, 0, 0)); arm_to(HUN, fd - 8, 0); arm_to(HUN, fd - 2, -70, ang_z=20)
    camkeys([(0, tuple(SR_ + Vector((-1.0, -1.7, 1.05))), tuple(SR_ + Vector((1.2, 0.5, 0.75)))), (E, tuple(SR_ + Vector((-0.7, -1.4, 1.05))), tuple(SR_ + Vector((1.2, 0.5, 0.9))))])
    dof(3.0, 4.0)
    HAZE = 0.0
elif SHOT == 'G':   # the hospital: Настя at the top of the basement stairs; Богдан holds her back — seen from the dark below
    cam_data.lens = 22
    top = BS + Vector((-2.2, -1.0, 0))
    place(NAS, top + Vector((0.2, 0.05, 0)), BS + Vector((1.8, -1.0, -2.6)))
    walk(NAS, 0, int(E * ev(0, 0.45)), tuple(top + Vector((-1.2, 0.2, 0))), tuple(top + Vector((0.4, 0.05, -0.12))), period=26)
    place(BOG, top + Vector((-1.4, 0.6, 0)), top); fb = int(E * ev(0, 0.45))
    arm_to(BOG, fb, 0); arm_to(BOG, fb + 6, -75, ang_z=-15)
    key(NAS['head'], 'rotation_euler', fb + 4, (math.radians(25), 0, 0)); key(NAS['head'], 'rotation_euler', fb + 10, (0, 0, math.radians(-60)))
    for P, p in ((HUN, top + Vector((-2.6, 1.6, 0))), (DOG, top + Vector((-1.8, 1.0, 0))), (MAR, top + Vector((-3.4, 2.2, 0))), (KOL, top + Vector((-3.0, 3.0, 0)))): place(P, p, top)
    camkeys([(0, tuple(BS + Vector((1.55, -1.0, -2.2))), tuple(top + Vector((0, 0, 1.4)))), (E, tuple(BS + Vector((1.45, -1.0, -2.1))), tuple(top + Vector((0, 0, 1.5))))])
    HAZE = 0.004
elif SHOT == 'H':   # the basement: a torch beam finds a firefighter's helmet, a boot, a coat
    sky((0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 0.0)
    cam_data.lens = 26
    hide(*[P['root'] for P in ALL])
    tor = empty(BA + Vector((-1.6, -3.0, 1.5)), 'torch_holder'); kit.torch_on(tor, energy=900, beam_len=5.0, beam_r=1.0)
    d = (BA + Vector((0.2, 1.0, 0.1))) - tor.location; tor.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    camkeys([(0, tuple(BA + Vector((-1.2, -3.4, 1.45))), tuple(BA + Vector((0.1, 1.0, 0.2)))), (E, tuple(BA + Vector((-0.6, -1.6, 1.0))), tuple(BA + Vector((0.2, 1.0, 0.15))))])
    HAZE = 0.012; HCOL = (0.9, 0.9, 0.85)
if SHOT in 'IJK':   # the end of the day: a low warm sun, long shadows
    sky((0.25, 0.3, 0.45), (0.95, 0.62, 0.38), 0.9); sun(3.0, (1.0, 0.62, 0.35), 7, 200)
if SHOT == 'I':     # sunset: they walk fast down the avenue towards us; the wheel far behind
    cam_data.lens = 30
    for P, dx, f0 in ((HUN, -1.0, 0), (DOG, -1.8, 0), (KOL, 1.2, 2), (NAS, 0.2, 4), (MAR, 2.2, 1), (BOG, -2.6, 3)):
        a0 = Vector((dx, 150 + 1.2 * f0, 0)); a1 = Vector((dx, 128, 0)); P['root'].rotation_euler = heading(a0, a1)
        (dog_trot if P is DOG else walk)(P, 0, E, tuple(a0), tuple(a1))
    camkeys([(0, (0.5, 118, 1.6), (0, 160, 4.5)), (E, (0.5, 116, 1.6), (0, 160, 5.5))])
    dof(22.0, 5.6)
elif SHOT == 'J':   # the frame at the exit: they pass one by one, the lamp green; Мэри last, a thumbs up
    cam_data.lens = 28
    order = [HUN, DOG, KOL, NAS, BOG, MAR]
    for i, P in enumerate(order):
        f0 = int(E * 0.05 * i); f1 = f0 + int(E * 0.42)
        a0 = CK + Vector((0, -4.0 - 1.4 * i, 0)); a1 = CK + Vector((0, 3.0 + 0.0 * i, 0)) + Vector((0.6 * ((i % 2) * 2 - 1), 1.2 * (5 - i), 0))
        P['root'].rotation_euler = heading(a0, a1); P['root'].location = a0
        if P is MAR:
            fm = int(E * ev(0, 0.55)); a1 = CK + Vector((0.2, 2.4, 0))
            (walk)(P, 0, fm, tuple(a0), tuple(a1)); key(P['root'], 'rotation_euler', fm, P['root'].rotation_euler.copy())
            r = P['root'].rotation_euler.copy(); r.z += math.pi; key(P['root'], 'rotation_euler', fm + 8, r)
            arm_to(P, fm + 6, 0); arm_to(P, fm + 12, -150, ang_z=10)
        else:
            (dog_trot if P is DOG else walk)(P, f0, f1, tuple(a0), tuple(a1))
    camkeys([(0, tuple(CK + Vector((3.2, 7.5, 1.6))), tuple(CK + Vector((0, 0, 1.4)))), (E, tuple(CK + Vector((2.6, 6.5, 1.55))), tuple(CK + Vector((0, 0, 1.3))))])
elif SHOT == 'K':   # dusk at the fork: the six from behind; far off, smoke over the forest; the camera rises
    cam_data.lens = 24
    base = Vector((0, 270, 0)); group_at(base, base + Vector((-40, 300, 0)))
    for P, f in zip(ALL, (8, 10, 14, 18, 22, 26)): key(P['head'], 'rotation_euler', f, (0, 0, 0)); key(P['head'], 'rotation_euler', f + 12, (math.radians(-8), 0, math.radians(15)))
    camkeys([(0, tuple(base + Vector((2, -9, 1.5))), tuple(base + Vector((-10, 60, 6)))), (E, tuple(base + Vector((3, -14, 7.5))), tuple(base + Vector((-25, 120, 20))))])
    HAZE, HCOL = 0.0006, (0.95, 0.75, 0.6)
if HAZE > 0: kit.volume_box((-900, -600, -6), (900, 1400, 200), HAZE, color=HCOL, aniso=0.5)
kit.ease_all()
kit.render(sc, OUT, F0, NF, PCT, SAMPLES, STEP)
