# «Чернобыль: к реактору» («Зона», серия 1) in 3D. Two places a few kilometres apart, built side by side here:
#   the plant (around the origin): the New Safe Confinement — the steel arch over unit 4, 108 m high, 257 m across,
#     162 m long — the turbine hall beside it, the road to it with birches and grass, the exit checkpoint with its
#     radiation control frame, and the local dogs;
#   Pripyat (around x = 2000): the amusement park with the Ferris wheel and the bumper cars, birches grown through the
#     asphalt, moss in the cracks, a fenced patch with the radiation sign, sixteen-storey blocks behind.
# The hunter and Пурга go with a guide (olive jacket, cap, the yellow dosimeter). A grey spring morning, a light haze.
# usage: python blender/zone.py <shot A..H> <seconds> <out dir> [percent 66] [samples 16] [step 2] [first frame 0]
#   A road: the three walk to the arch                      B bumper cars: «ничего не трогай», the guide stops his hand
#   C moss: the dosimeter over the moss, close and low      D sign: past the radiation sign, quickly
#   E wheel: the Ferris wheel that never opened             F dogs: Пурга meets the local dogs
#   G frame: the radiation control frame at the exit        H end: the three at the road, the arch behind, the choice
import bpy, math, random, sys, os
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import mat, box, cyl, ico, empty, aim, key, person, M

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SHOT, DURS, OUT = args[0], float(args[1]), args[2]
PCT = int(args[3]) if len(args) > 3 else 66
SAMPLES = int(args[4]) if len(args) > 4 else 16
STEP = int(args[5]) if len(args) > 5 else 2
F0 = int(args[6]) if len(args) > 6 else 0
NF = int(round(DURS * kit.FPS))
E = NF
HERE = os.path.dirname(os.path.abspath(__file__))
random.seed(17)
sc = kit.reset()
kit.people_materials()
PX = 2000.0                                       # Pripyat is this far along x from the plant


# —— materials ——
def noisy(name, c1, c2, scale=6.0, rough=0.9, metal=0.0, detail=4.0, bump=0.0):
    """a colour that wanders between c1 and c2 with a noise texture in object space"""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    tc = N.new('ShaderNodeTexCoord'); nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*c1, 1); mx.inputs['B'].default_value = (*c2, 1)
    L.new(nz.outputs['Fac'], mx.inputs['Factor']); L.new(mx.outputs['Result'], b.inputs['Base Color'])
    if bump > 0:
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m


def asphalt_material():
    """old asphalt: grey with a noise, and dark cracks along the edges of a Voronoi pattern"""
    m = noisy('asphalt', (0.07, 0.07, 0.075), (0.16, 0.16, 0.16), scale=3.0, bump=0.2); nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; mx = [n for n in N if n.bl_idname == 'ShaderNodeMix'][0]
    tc = [n for n in N if n.bl_idname == 'ShaderNodeTexCoord'][0]
    vo = N.new('ShaderNodeTexVoronoi'); vo.feature = 'DISTANCE_TO_EDGE'; vo.inputs['Scale'].default_value = 0.45; L.new(tc.outputs['Object'], vo.inputs['Vector'])
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.02; L.new(vo.outputs['Distance'], lt.inputs[0])
    m2 = N.new('ShaderNodeMix'); m2.data_type = 'RGBA'; L.new(lt.outputs[0], m2.inputs['Factor']); L.new(mx.outputs['Result'], m2.inputs['A'])
    m2.inputs['B'].default_value = (0.015, 0.015, 0.015, 1); L.new(m2.outputs['Result'], b.inputs['Base Color'])
    return m


def arch_material():
    """the arch's skin: light stainless panels in long bands along its length, a little shine"""
    m = bpy.data.materials.new('arch'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Metallic'].default_value = 0.75; b.inputs['Roughness'].default_value = 0.38
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'; wv.inputs['Scale'].default_value = 0.0
    # bands of constant arc position: the panel seams every ~6 m around the arch
    ang = N.new('ShaderNodeMath'); ang.operation = 'ARCTAN2'; L.new(sep.outputs['X'], ang.inputs[0])
    zc = N.new('ShaderNodeMath'); zc.operation = 'ADD'; zc.inputs[1].default_value = 22.4; L.new(sep.outputs['Z'], zc.inputs[0]); L.new(zc.outputs[0], ang.inputs[1])
    sc_ = N.new('ShaderNodeMath'); sc_.operation = 'MULTIPLY'; sc_.inputs[1].default_value = 130.4 / 6.0; L.new(ang.outputs[0], sc_.inputs[0])
    fr = N.new('ShaderNodeMath'); fr.operation = 'FRACT'; L.new(sc_.outputs[0], fr.inputs[0])
    seam = N.new('ShaderNodeMath'); seam.operation = 'LESS_THAN'; seam.inputs[1].default_value = 0.06; L.new(fr.outputs[0], seam.inputs[0])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.05; L.new(tc.outputs['Object'], nz.inputs['Vector'])
    m1 = N.new('ShaderNodeMix'); m1.data_type = 'RGBA'; m1.inputs['A'].default_value = (0.62, 0.64, 0.66, 1); m1.inputs['B'].default_value = (0.74, 0.75, 0.76, 1)
    L.new(nz.outputs['Fac'], m1.inputs['Factor'])
    m2 = N.new('ShaderNodeMix'); m2.data_type = 'RGBA'; L.new(seam.outputs[0], m2.inputs['Factor']); L.new(m1.outputs['Result'], m2.inputs['A'])
    m2.inputs['B'].default_value = (0.3, 0.31, 0.32, 1); L.new(m2.outputs['Result'], b.inputs['Base Color'])
    return m


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


def sign_material():
    m = bpy.data.materials.new('trefoil'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = 0.6
    tx = N.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(os.path.join(HERE, 'tex', 'trefoil.png'))
    L.new(tx.outputs['Color'], b.inputs['Base Color']); L.new(tx.outputs['Alpha'], b.inputs['Alpha'])
    return m


GRASS = noisy('grass', (0.12, 0.16, 0.05), (0.32, 0.3, 0.12), scale=0.6, bump=0.3)
ASPH = asphalt_material(); CONC = noisy('concrete', (0.36, 0.36, 0.34), (0.55, 0.54, 0.5), scale=1.2, bump=0.15)
ARCH = arch_material(); FDAY = facade_day(); SIGN = sign_material()
RUST = noisy('rust', (0.22, 0.09, 0.04), (0.42, 0.2, 0.08), scale=4.0, rough=0.75, metal=0.3, bump=0.2)
YEL = noisy('yellow_paint', (0.85, 0.62, 0.06), (0.45, 0.22, 0.06), scale=2.5, rough=0.6)
WHITE_P = noisy('white_paint', (0.72, 0.72, 0.68), (0.4, 0.33, 0.26), scale=3.0, rough=0.6)
BIRCH = noisy('birch', (0.85, 0.84, 0.8), (0.08, 0.08, 0.07), scale=9.0, detail=2.0)
LEAF = noisy('leaves', (0.22, 0.32, 0.08), (0.55, 0.5, 0.12), scale=1.5, rough=0.8)
MOSS = noisy('moss', (0.12, 0.25, 0.03), (0.35, 0.5, 0.08), scale=30.0, bump=0.6, rough=1.0)
STEEL = mat('steel', (0.4, 0.42, 0.44), rough=0.4, metal=0.85); DARK = mat('dark', (0.05, 0.05, 0.06))
BLUE = mat('blue_car', (0.1, 0.25, 0.55), rough=0.5); RED = mat('red_car', (0.6, 0.08, 0.05), rough=0.5)
GREEN_ON = mat('lamp_green', (0.2, 1.0, 0.35), emit=0.0); GLASS = mat('glass', (0.2, 0.25, 0.28), rough=0.1, metal=0.2)
FENCE = mat('fence', (0.3, 0.3, 0.3), rough=0.6, metal=0.6)


# —— the sky: a grey spring morning (a warm low sun in shot A and H) ——
def sky(top, horizon, strength=1.0):
    w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.8; nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*horizon, 1); mx.inputs['B'].default_value = (*top, 1)
    nt.links.new(mr.outputs['Result'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], bg.inputs['Color']); bg.inputs['Strength'].default_value = strength


def sun(energy, color, elev, azim, angle=6.0):
    bpy.ops.object.light_add(type='SUN', location=(0, 0, 50)); s = bpy.context.object
    s.data.energy = energy; s.data.color = color; s.data.angle = math.radians(angle)
    s.rotation_euler = (math.radians(90 - elev), 0, math.radians(azim)); return s


# —— the ground ——
box((PX / 2, 0, -0.05), (PX + 3000, 3000, 0.1), GRASS, name='ground')


def birch(x, y, h, seed):
    r = random.Random(seed)
    cyl((x, y, h / 2), 0.09 + 0.03 * r.random(), h, BIRCH, verts=7, rot=(r.uniform(-0.06, 0.06), r.uniform(-0.06, 0.06), 0), name='birch')
    for k in range(4):
        ico((x + r.uniform(-1, 1), y + r.uniform(-1, 1), h * r.uniform(0.62, 0.95)), r.uniform(1.0, 1.7), LEAF, sub=2, name='crown',
            scale=(1, 1, r.uniform(0.9, 1.4)))


# —— the plant: the arch over unit 4, the turbine hall, the road ——
AY = 260.0                                        # the arch's middle along y
def arch(cy=AY, span=257.0, height=108.0, length=162.0, segs=56):
    import bmesh
    R = (span ** 2 / 4 + height ** 2) / (2 * height); zc = height - R; th = math.asin((span / 2) / R)
    me = bpy.data.meshes.new('nsc'); bm = bmesh.new(); rings = []
    for y in (cy - length / 2, cy + length / 2):
        ring = []
        for i in range(segs + 1):
            a = -th + 2 * th * i / segs
            ring.append(bm.verts.new((R * math.sin(a), y, zc + R * math.cos(a))))
        rings.append(ring)
    for i in range(segs): bm.faces.new((rings[0][i], rings[0][i + 1], rings[1][i + 1], rings[1][i]))
    for ring in rings: bm.faces.new(ring if ring is rings[1] else list(reversed(ring)))      # the end walls
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.normal_update(); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('nsc', me); kit.col().objects.link(o); me.materials.append(ARCH)
    for p in o.data.polygons: p.use_smooth = True
    # the end walls a shade darker: a thin slab just in front, and the lines of its frame
    for y in (cy - length / 2 - 0.5, cy + length / 2 + 0.5):
        for k in range(-5, 6):
            hgt = zc + math.sqrt(max(0, R * R - (k * 20.0) ** 2))
            if hgt > 1: box((k * 20.0, y, hgt / 2), (0.8, 0.6, hgt), STEEL, name='end_rib')
    return o
arch()
box((-215, AY + 20, 17), (150, 52, 34), FDAY, name='turbine_hall')      # the long hall of the four units beside it
box((-215, AY + 20, 34.5), (150, 52, 1.0), CONC, name='hall_roof')
box((0, 60, 0.02), (9, 260, 0.04), ASPH, name='road')                  # the road from the checkpoint to the arch
for k in range(26):
    yy = -60 + k * 9
    box((0, yy, 0.045), (0.15, 3.0, 0.005), WHITE_P, name='dash')
r = random.Random(3)
for k in range(70):
    side = -1 if k % 2 else 1
    x = side * r.uniform(8, 60); y = r.uniform(-80, 170)
    birch(x, y, r.uniform(9, 15), 100 + k)
for k in range(40):                                 # a line of concrete fence posts along the plant
    box((-30 + k * 4.0, 175, 1.25), (0.25, 0.25, 2.5), CONC, name='post')
box((48, 175, 1.25), (156, 0.06, 2.4), FENCE, name='mesh')

# —— the exit checkpoint: a white booth, the barrier and the radiation control frame ——
CK = Vector((3.5, -40, 0))
box(CK + Vector((7.5, 0, 1.4)), (4.0, 3.0, 2.8), WHITE_P, name='booth'); box(CK + Vector((7.5, 0, 2.9)), (4.4, 3.4, 0.2), DARK, name='booth_roof')
box(CK + Vector((5.45, 0, 1.6)), (0.05, 2.0, 1.0), GLASS, name='booth_glass')
for dx in (-0.55, 0.55): box(CK + Vector((dx, 0, 1.1)), (0.22, 0.6, 2.2), WHITE_P, name='frame_post')
box(CK + Vector((0, 0, 2.3)), (1.4, 0.6, 0.22), WHITE_P, name='frame_top')
LAMP = ico(CK + Vector((0, 0, 2.5)), 0.09, GREEN_ON, sub=2, name='frame_lamp')
for dx in (-0.44, 0.44): box(CK + Vector((dx, -0.31, 1.2)), (0.02, 0.02, 1.4), DARK, name='sensor')
cyl(CK + Vector((-4.0, 0, 0.5)), 0.12, 1.0, RED, verts=8, name='barrier_post')
box(CK + Vector((-4.0, 3.5, 1.0)), (0.12, 7.0, 0.12), WHITE_P, name='barrier')

# —— Pripyat: the amusement park ——
WX, WY = PX + 10, 40.0                            # the Ferris wheel
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
box((WX, WY, 0.03), (40, 40, 0.06), ASPH, name='park_asphalt')
# the bumper cars: a roof on steel columns over a steel floor, little cars left where they stopped
BC = Vector((PX - 14, 8, 0))
box(BC + Vector((0, 0, 0.1)), (18, 11, 0.2), STEEL, name='bc_floor')
box(BC + Vector((0, 0, 4.0)), (19, 12, 0.3), RUST, name='bc_roof')
for dx in (-9, -3, 3, 9):
    for dy in (-5.5, 5.5): cyl(BC + Vector((dx, dy, 2.0)), 0.12, 4.0, RUST, verts=8, name='bc_col')
CARS = []
rc = random.Random(9)
for k, (dx, dy) in enumerate([(-6, -2), (-2.5, 1.5), (1.5, -2.5), (5, 1), (-6.5, 3), (2.5, 3.5), (6.5, -3)]):
    car = empty(BC + Vector((dx, dy, 0.2)), f'car{k}', rot=(0, 0, rc.uniform(0, 6.28)))
    box((0, 0, 0.3), (1.0, 1.6, 0.45), (BLUE, RED, YEL)[k % 3], parent=car); cyl((0, 0, 0.12), 0.75, 0.18, DARK, verts=12, parent=car)
    box((0, 0.35, 0.65), (0.6, 0.35, 0.3), RUST, parent=car); cyl((0, 0.55, 1.3), 0.02, 1.4, STEEL, verts=4, parent=car)
    CARS.append(car)
# the fenced patch with the radiation sign; moss in the cracks of the asphalt
SG = Vector((PX + 3, -14, 0))
for k in range(7): cyl(SG + Vector((k * 1.6, 2.0, 0.6)), 0.04, 1.2, RUST, verts=5, name='fpost')
for z in (0.45, 0.95): box(SG + Vector((4.8, 2.0, z)), (9.6, 0.02, 0.02), RUST, name='wire')
cyl(SG + Vector((0.0, 1.9, 0.9)), 0.04, 1.8, STEEL, verts=6, name='sign_post')
bpy.ops.mesh.primitive_plane_add(size=0.7, location=tuple(SG + Vector((0.0, 1.86, 1.6))), rotation=(math.pi / 2, 0, 0)); sg = bpy.context.object; sg.data.materials.append(SIGN); sg.name = 'sign'
box(SG + Vector((4.8, 6, 0.6)), (9, 6, 1.2), GRASS, name='mound')
MS = Vector((PX + 1.0, -6.0, 0.06))                # the moss patch
rm = random.Random(21)
for k in range(140):
    p = MS + Vector((rm.gauss(0, 0.35), rm.gauss(0, 0.25), 0))
    ico(tuple(p), rm.uniform(0.03, 0.09), MOSS, sub=2, name='moss', scale=(1, 1, rm.uniform(0.35, 0.6)))
box((PX + 2, -8, 0.03), (40, 16, 0.06), ASPH, name='park_path')
# the blocks of Pripyat behind the park, birches everywhere between them
rb = random.Random(5)
for k in range(9):
    x = PX - 90 + k * 26 + rb.uniform(-4, 4); y = 140 + rb.uniform(-10, 30)
    box((x, y, 24), (18, 14, 48), FDAY, rot=(0, 0, rb.choice([0, 0.2, -0.15])), name='block')
for k in range(120):
    x = PX + rb.uniform(-80, 90); y = rb.uniform(-40, 130)
    if abs(x - WX) < 16 and abs(y - WY) < 10: continue
    if abs(x - BC.x) < 12 and abs(y - BC.y) < 8: continue
    if abs(y + 8) < 9 and abs(x - PX - 2) < 20: continue
    birch(x, y, rb.uniform(8, 16), 500 + k)

# —— the people ——
GUI = person(0.6, 0.0, 0, 'guide', rot=0.0)
HUN = person(-0.6, 0.0, 0, 'hunter', rot=0.0)
DOG = person(0.0, -0.8, 0, 'dog', rot=0.0)
ST1 = person(3.0, 30.0, 0, 'stray1', rot=0.0)
ST2 = person(4.0, 31.0, 0, 'stray2', rot=0.0)


def walk(P, f0, f1, p0, p1, swing=0.45, period=24):
    for f in range(f0, f1 + 1, 3):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.025 * abs(math.sin(ph))))
        P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (swing * math.sin(ph + math.pi * i), 0, 0))
        arms = P['arms'][:1] if P is GUI else P['arms']
        for i, sh in enumerate(arms): key(sh, 'rotation_euler', f, (-0.6 * swing * math.sin(ph + math.pi * i), 0, 0))


def dog_trot(P, f0, f1, p0, p1, period=14):
    for f in range(f0, f1 + 1, 2):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.02 * abs(math.sin(ph)))); P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (0.5 * math.sin(ph + math.pi * ((i // 2 + i % 2) % 2)), 0, 0))


def wag(P, f0, f1, period=8, amp=0.5):
    for f in range(f0, f1 + 1, 2):
        key(P['tail'], 'rotation_euler', f, (0, 0, amp * math.sin(2 * math.pi * (f - f0) / period)))


def face(P, target):
    """turn a person (who faces −Y) towards a point on the ground"""
    d = Vector(target) - P['root'].location; P['root'].rotation_euler = (0, 0, math.atan2(d.x, -d.y))


def place(P, p, towards):
    P['root'].location = Vector(p); face(P, towards)


cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); kit.col().objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.02; cam_data.clip_end = 4000
look = empty((0, 0, 0), 'look'); aim(cam, look)
def camkeys(keys):
    for f, p, q in keys: key(cam, 'location', f, Vector(p)); key(look, 'location', f, Vector(q))
def dof(dist, fstop=2.8):
    cam_data.dof.use_dof = True; cam_data.dof.focus_distance = dist; cam_data.dof.aperture_fstop = fstop


ARCHV = Vector((0, AY, 40))
HAZE = 0.0035
if SHOT == 'A':     # behind and low: the three walk up the road to the arch, which fills the morning haze ahead
    sky((0.42, 0.5, 0.62), (0.95, 0.78, 0.6), 1.1); sun(3.0, (1.0, 0.8, 0.6), 9, 200)
    cam_data.lens = 26
    walk(GUI, 0, E, (1.0, 2.0, 0), (1.0, 6.5, 0)); walk(HUN, 0, E, (-0.7, 1.6, 0), (-0.7, 6.1, 0)); dog_trot(DOG, 0, E, (-0.1, 1.2, 0), (-0.1, 5.7, 0))
    for P in (GUI, HUN, DOG): P['root'].rotation_euler = (0, 0, math.pi)          # facing +y, to the arch
    GUI['arms'][1].rotation_euler = (math.radians(-55), 0, 0)                     # the dosimeter held out in front
    camkeys([(0, (0.4, -4.0, 1.05), (0.2, 60, 14)), (E, (0.4, 0.5, 1.15), (0.2, 60, 15))])
    HAZE = 0.0045
elif SHOT == 'B':   # the bumper cars: he reaches for a rusty car, the guide's hand comes up, his hand goes back
    sky((0.5, 0.56, 0.62), (0.78, 0.78, 0.76), 1.0); sun(2.2, (1.0, 0.92, 0.82), 25, 150)
    cam_data.lens = 32
    car = CARS[1].location
    place(HUN, car + Vector((1.6, -1.6, -0.2)), car); place(GUI, car + Vector((2.6, -2.4, -0.2)), HUN['root'].location)
    place(DOG, car + Vector((2.0, -2.9, -0.2)), car)
    sh = HUN['arms'][1]; key(sh, 'rotation_euler', 0, (0, 0, 0)); key(sh, 'rotation_euler', int(E * 0.3), (math.radians(-70), 0, 0))
    key(sh, 'rotation_euler', int(E * 0.48), (math.radians(-72), 0, 0)); key(sh, 'rotation_euler', int(E * 0.75), (math.radians(-10), 0, 0))
    gs = GUI['arms'][0]; key(gs, 'rotation_euler', int(E * 0.25), (0, 0, 0)); key(gs, 'rotation_euler', int(E * 0.42), (math.radians(-80), 0, math.radians(-25)))
    key(gs, 'rotation_euler', int(E * 0.8), (math.radians(-80), 0, math.radians(-25)))
    mid = (HUN['root'].location + car) / 2
    camkeys([(0, tuple(mid + Vector((3.2, -4.2, 1.5))), tuple(mid + Vector((0, 0, 0.9)))), (E, tuple(mid + Vector((2.6, -3.6, 1.4))), tuple(mid + Vector((0, 0, 0.9))))])
    dof((Vector((3.2, -4.2, 0.6))).length, 4.0)
elif SHOT == 'C':   # low over the moss: the guide's hand brings the dosimeter down into the frame, the focus on it; boots and Пурга behind
    sky((0.5, 0.56, 0.62), (0.78, 0.78, 0.76), 1.0); sun(2.2, (1.0, 0.92, 0.82), 25, 150)
    cam_data.lens = 40
    place(GUI, (PX + 60, 60, 0), (PX, 0, 0))                     # the guide himself stays out of the frame: only his arm comes in
    place(HUN, MS + Vector((-0.9, 1.5, -0.06)), MS); place(DOG, MS + Vector((0.7, 1.2, -0.06)), MS)
    pr = empty(tuple(MS + Vector((0.05, 0.15, 1.1))), 'probe')
    cyl((0, 0.35, 0.25), 0.075, 0.7, M['olive'], verts=8, rot=(math.radians(-55), 0, 0), parent=pr); ico((0, 0.03, 0.03), 0.065, M['skin'], parent=pr)
    box((0, 0, -0.04), (0.07, 0.035, 0.13), M['dosim'], parent=pr); box((0, -0.019, -0.015), (0.05, 0.004, 0.035), M['lcd'], parent=pr)
    key(pr, 'location', 0, MS + Vector((0.05, 0.15, 0.95))); key(pr, 'location', int(E * 0.45), MS + Vector((0.02, 0.05, 0.22)))
    key(pr, 'location', E, MS + Vector((0.0, 0.04, 0.2)))
    camkeys([(0, tuple(MS + Vector((0.12, -1.1, 0.28))), tuple(MS + Vector((0, 0.2, 0.25)))), (E, tuple(MS + Vector((0.08, -0.95, 0.26))), tuple(MS + Vector((0, 0.15, 0.22))))])
    dof(1.05, 2.0)
elif SHOT == 'D':   # past the fenced patch and its sign, quickly: a short, fast walk, the camera pans with them
    sky((0.5, 0.56, 0.62), (0.78, 0.78, 0.76), 1.0); sun(2.2, (1.0, 0.92, 0.82), 25, 150)
    cam_data.lens = 26
    y0 = SG.y - 2.0
    for P, dy, dx in [(GUI, 0.0, 0.0), (HUN, -0.7, -0.9), (DOG, -1.2, -0.3)]:
        P['root'].rotation_euler = (0, 0, math.radians(90))
        (dog_trot(P, 0, E, (SG.x - 3.5 + dx, y0 + dy, 0), (SG.x + 7 + dx, y0 + dy, 0), period=10) if P is DOG else
         walk(P, 0, E, (SG.x - 3.5 + dx, y0 + dy, 0), (SG.x + 7 + dx, y0 + dy, 0), swing=0.55, period=16))
    camkeys([(0, (SG.x - 2.5, y0 - 6.0, 1.4), (SG.x - 0.5, y0 + 1.5, 1.2)), (E, (SG.x + 3.5, y0 - 6.0, 1.4), (SG.x + 4.5, y0 + 1.5, 1.2))])
elif SHOT == 'E':   # the Ferris wheel that never opened: wide from below, the three small at its foot; a slow push and tilt up
    sky((0.48, 0.55, 0.64), (0.8, 0.8, 0.78), 1.0); sun(2.4, (1.0, 0.9, 0.78), 22, 140)
    cam_data.lens = 22
    place(GUI, (WX - 2.0, WY - 7.0, 0), (WX, WY, 0)); place(HUN, (WX - 3.0, WY - 7.6, 0), (WX, WY, 5)); place(DOG, (WX - 2.4, WY - 8.4, 0), (WX, WY, 0))
    key(HUN['head'], 'rotation_euler', 0, (0, 0, 0)); key(HUN['head'], 'rotation_euler', int(E * 0.5), (math.radians(-22), 0, 0))
    camkeys([(0, (WX - 7.0, WY - 22.0, 1.3), (WX - 0.5, WY, 9.0)), (E, (WX - 6.0, WY - 19.0, 1.2), (WX - 0.5, WY, 11.0))])
elif SHOT == 'F':   # by the road near the plant: Пурга and two local dogs sniff, tails go; the guide's hand says no; the arch soft behind
    sky((0.48, 0.55, 0.64), (0.85, 0.8, 0.74), 1.05); sun(2.6, (1.0, 0.86, 0.7), 16, 190)
    cam_data.lens = 45
    c = Vector((2.5, 120.0, 0))
    place(DOG, c + Vector((-0.55, 0, 0)), c + Vector((1, 0, 0))); place(ST1, c + Vector((0.5, 0.15, 0)), c + Vector((-1, 0, 0)))
    place(ST2, c + Vector((0.9, 0.95, 0)), c + Vector((-1, -0.3, 0)))
    place(HUN, c + Vector((-1.6, -0.6, 0)), c); place(GUI, c + Vector((-1.4, 0.8, 0)), c)
    wag(ST1, 0, E, 7, 0.6); wag(ST2, 0, E, 9, 0.4)
    for f, a in [(0, 0), (int(E * 0.3), 0.25), (int(E * 0.55), -0.1), (E, 0.15)]: key(DOG['head'], 'rotation_euler', f, (a, 0, 0))
    gs = GUI['arms'][1]; key(gs, 'rotation_euler', int(E * 0.35), (0, 0, 0)); key(gs, 'rotation_euler', int(E * 0.5), (math.radians(-75), 0, math.radians(20)))
    key(gs, 'rotation_euler', E, (math.radians(-75), 0, math.radians(20)))
    camkeys([(0, tuple(c + Vector((0.3, -3.4, 0.55))), tuple(c + Vector((0.1, 0.4, 0.45)))), (E, tuple(c + Vector((0.1, -3.0, 0.55))), tuple(c + Vector((0.1, 0.4, 0.45))))])
    dof(3.4, 2.4)
elif SHOT == 'G':   # the exit: the hunter steps through the control frame; its lamp goes green
    sky((0.48, 0.55, 0.64), (0.9, 0.78, 0.64), 1.05); sun(2.6, (1.0, 0.8, 0.6), 12, 210)
    cam_data.lens = 30
    HUN['root'].rotation_euler = (0, 0, 0)                   # facing −y: out, towards us
    walk(HUN, 0, int(E * 0.55), CK + Vector((0, 2.2, 0)), CK + Vector((0, -0.2, 0)), period=26)
    place(GUI, CK + Vector((2.0, -1.6, 0)), CK); place(DOG, CK + Vector((1.2, -1.9, 0)), CK)
    g = GREEN_ON.node_tree.nodes['Principled BSDF']; g.inputs['Emission Color'].default_value = (0.2, 1.0, 0.35, 1)
    s_ = g.inputs['Emission Strength']; s_.default_value = 0.0; s_.keyframe_insert('default_value', frame=int(E * 0.5))
    s_.default_value = 40.0; s_.keyframe_insert('default_value', frame=int(E * 0.55))
    bpy.ops.object.light_add(type='POINT', location=tuple(CK + Vector((0, -0.3, 2.5)))); gl = bpy.context.object; gl.data.color = (0.3, 1.0, 0.45); gl.data.shadow_soft_size = 0.1
    gl.data.energy = 0; gl.data.keyframe_insert('energy', frame=int(E * 0.5)); gl.data.energy = 60; gl.data.keyframe_insert('energy', frame=int(E * 0.55))
    camkeys([(0, tuple(CK + Vector((0.8, -5.5, 1.5))), tuple(CK + Vector((0, 0.5, 1.4)))), (E, tuple(CK + Vector((0.6, -4.8, 1.45))), tuple(CK + Vector((0, 0.2, 1.4))))])
else:               # H: the end: the three by the road at sunset, the arch behind them; the camera rises
    sky((0.36, 0.42, 0.6), (1.0, 0.62, 0.38), 1.1); sun(3.5, (1.0, 0.62, 0.35), 5, 250)
    cam_data.lens = 26
    c = Vector((0.5, 30.0, 0))
    place(GUI, c + Vector((0.8, 0, 0)), c + Vector((0, 50, 0))); place(HUN, c + Vector((-0.5, 0.1, 0)), c + Vector((0, 50, 0)))
    place(DOG, c + Vector((0.15, -0.4, 0)), c + Vector((0, 50, 0)))
    key(HUN['head'], 'rotation_euler', int(E * 0.3), (0, 0, 0)); key(HUN['head'], 'rotation_euler', int(E * 0.45), (0, 0, math.radians(-30)))
    key(HUN['head'], 'rotation_euler', int(E * 0.7), (0, 0, math.radians(-30))); key(HUN['head'], 'rotation_euler', int(E * 0.85), (0, 0, 0))
    camkeys([(0, tuple(c + Vector((1.2, -4.5, 1.0))), tuple(c + Vector((0, 40, 9)))), (E, tuple(c + Vector((1.6, -6.0, 2.6))), tuple(c + Vector((0, 60, 18))))])
    HAZE = 0.004
# a light haze over the whole place: far things go pale and blue, the low sun shows in the air
kit.volume_box((-700, -400, -1), (PX + 600, 900, 160), HAZE, color=(0.9, 0.92, 0.95), aniso=0.6)
kit.ease_all()
kit.render(sc, OUT, F0, NF, PCT, SAMPLES, STEP)
