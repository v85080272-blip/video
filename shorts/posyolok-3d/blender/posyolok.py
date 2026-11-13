# «Посёлок» — the 3D pilot for the 20–40 audience: a zombie outbreak, and she is stuck in a gated cottage settlement at night.
# Built and rendered by Blender (bpy, Cycles on the CPU). One scene holds the whole settlement: a straight asphalt street
# with corrugated-steel fences on brick pillars, two-storey cottages on both sides, sodium street lamps (one flickers),
# backyards with greenhouses, sheds, pines and birches behind chain-link dividers, the barrier and the guard booth at the
# entrance, her white crossover parked by the gate; the infected shuffling down the street; the heroine (a dark jacket,
# jeans, a long dark ponytail). No blood anywhere: the infected are pale, stooped, ragged — that is all.
# usage: python blender/posyolok.py <shot A|B|C|E|F|G> <seconds> <out dir> [percent 66] [samples 12] [step 3] [first frame 0]
#   A the hook: she crouches behind her open wicket; down the street the infected under the lamps
#   B upstairs in her house: she at the dark window, the hand at the switch — and away; one of them passes below
#   C high over the settlement: the street, six of them, her house, the gate and her car (the routes are drawn in 2D)
#   E the backyards: she slips along the chain-link past a greenhouse; between the houses, the lamps and them
#   F the last yard: she makes for the wicket — a window of the «empty» house lights up (EV[0])
#   G at the wicket, over her shoulder: the gate, her car under the lamp; she looks back at us
# TESTF=<frame>: render only that frame (the look test). FOG=<density> overrides the haze.
import bpy, bmesh, math, random, sys, os, json
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
from kit import mat, box, cyl, ico, empty, aim, key

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SHOT, DURS, OUT = args[0], float(args[1]), args[2]
PCT = int(args[3]) if len(args) > 3 else 66
SAMPLES = int(args[4]) if len(args) > 4 else 12
STEP = int(args[5]) if len(args) > 5 else 3
F0 = int(args[6]) if len(args) > 6 else 0
NF = int(round(DURS * kit.FPS))
E = NF
EVF = [float(x) for x in os.environ.get('EV', '').split(',') if x]
def ev(i, default):
    return EVF[i] if i < len(EVF) else default
random.seed(41)
sc = kit.reset()
C = kit.col


# —— materials ——
def nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    return m, nt.nodes, nt.links, nt.nodes['Principled BSDF']
def noisy(name, c1, c2, scale=6.0, rough=0.9, metal=0.0, detail=4.0, bump=0.0, coord='Object'):
    m, N, L, b = nodes(name); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    tc = N.new('ShaderNodeTexCoord'); nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = detail
    L.new(tc.outputs[coord], nz.inputs['Vector'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*c1, 1); mx.inputs['B'].default_value = (*c2, 1)
    L.new(nz.outputs['Fac'], mx.inputs['Factor']); L.new(mx.outputs['Result'], b.inputs['Base Color'])
    if bump > 0:
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; L.new(nz.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
def bands(name, c1, c2, axis='X', period=0.2, rough=0.5, metal=0.0, bump=0.5, dirt=0.25):
    """ribs or planks or siding: wave bands along one axis of the object's own (unscaled) space, with a little dirt"""
    m, N, L, b = nodes(name); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    tc = N.new('ShaderNodeTexCoord'); wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = axis
    wv.inputs['Scale'].default_value = 1.0 / period / 3.2; wv.inputs['Distortion'].default_value = 0.0
    L.new(tc.outputs['Object'], wv.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.5; nz.inputs['Detail'].default_value = 6; L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (*c1, 1); mx.inputs['B'].default_value = (*c2, 1)
    L.new(nz.outputs['Fac'], mx.inputs['Factor'])
    d = N.new('ShaderNodeMix'); d.data_type = 'RGBA'; d.blend_type = 'MULTIPLY'; d.inputs['Factor'].default_value = dirt
    L.new(mx.outputs['Result'], d.inputs['A']); L.new(wv.outputs['Color'], d.inputs['B']); L.new(d.outputs['Result'], b.inputs['Base Color'])
    if bump > 0:
        bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; L.new(wv.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
def brick(name, c1, c2, mortar=(0.32, 0.3, 0.28), scale=1.6):
    m, N, L, b = nodes(name); b.inputs['Roughness'].default_value = 0.85
    tc = N.new('ShaderNodeTexCoord'); br = N.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = scale
    br.inputs['Color1'].default_value = (*c1, 1); br.inputs['Color2'].default_value = (*c2, 1); br.inputs['Mortar'].default_value = (*mortar, 1)
    br.inputs['Mortar Size'].default_value = 0.015; L.new(tc.outputs['Object'], br.inputs['Vector'])
    L.new(br.outputs['Color'], b.inputs['Base Color'])
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.4; L.new(br.outputs['Fac'], bp.inputs['Height']); L.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
def glassy(name, color=(0.02, 0.025, 0.03), rough=0.06, alpha=1.0, transmission=0.0):
    m, N, L, b = nodes(name); b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = 0.8
    if transmission: b.inputs['Transmission Weight'].default_value = transmission
    if alpha < 1: b.inputs['Alpha'].default_value = alpha
    return m
def emit_mat(name, color, strength):
    m, N, L, b = nodes(name); b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = strength
    return m, b

ASPH = noisy('asphalt', (0.035, 0.036, 0.04), (0.1, 0.1, 0.105), scale=2.5, rough=0.45, bump=0.25)          # damp: it catches the lamps
GRAVEL = noisy('gravel', (0.16, 0.15, 0.14), (0.3, 0.28, 0.26), scale=14, bump=0.5)
GRASS = noisy('grass', (0.03, 0.05, 0.02), (0.09, 0.12, 0.04), scale=0.8, bump=0.3)
SOIL = noisy('soil', (0.05, 0.035, 0.025), (0.12, 0.09, 0.06), scale=3, bump=0.4)
PROF = [bands('prof_g', (0.05, 0.13, 0.08), (0.08, 0.17, 0.1), 'X', 0.2, 0.42, 0.55, 0.9),                    # корrugated steel: green,
        bands('prof_b', (0.16, 0.07, 0.04), (0.22, 0.1, 0.06), 'X', 0.2, 0.42, 0.55, 0.9),                    # chocolate brown,
        bands('prof_s', (0.32, 0.33, 0.34), (0.42, 0.43, 0.44), 'X', 0.2, 0.38, 0.7, 0.9)]                   # bare zinc grey
PROFY = [bands('profy_g', (0.05, 0.13, 0.08), (0.08, 0.17, 0.1), 'Y', 0.2, 0.42, 0.55, 0.9),
         bands('profy_b', (0.16, 0.07, 0.04), (0.22, 0.1, 0.06), 'Y', 0.2, 0.42, 0.55, 0.9),
         bands('profy_s', (0.32, 0.33, 0.34), (0.42, 0.43, 0.44), 'Y', 0.2, 0.38, 0.7, 0.9)]
BRICK = brick('brick', (0.32, 0.12, 0.07), (0.42, 0.18, 0.1))
BRICK_Y = brick('brick_y', (0.55, 0.45, 0.3), (0.62, 0.52, 0.36))
SIDING = [bands('siding_beige', (0.55, 0.5, 0.4), (0.62, 0.57, 0.46), 'Z', 0.18, 0.7, 0.0, 0.35),
          bands('siding_grey', (0.45, 0.47, 0.5), (0.5, 0.52, 0.55), 'Z', 0.18, 0.7, 0.0, 0.35),
          bands('timber', (0.22, 0.13, 0.07), (0.3, 0.18, 0.1), 'Z', 0.22, 0.75, 0.0, 0.6),
          bands('siding_green', (0.25, 0.32, 0.27), (0.3, 0.37, 0.31), 'Z', 0.18, 0.7, 0.0, 0.35)]
ROOF = [bands('roof_r', (0.18, 0.04, 0.03), (0.24, 0.06, 0.04), 'X', 0.5, 0.4, 0.5, 0.5),
        bands('roof_g', (0.08, 0.085, 0.09), (0.12, 0.125, 0.13), 'X', 0.5, 0.4, 0.5, 0.5),
        bands('roof_br', (0.13, 0.07, 0.04), (0.17, 0.09, 0.05), 'X', 0.5, 0.4, 0.5, 0.5)]
PLANK = bands('plank', (0.2, 0.13, 0.08), (0.28, 0.18, 0.1), 'Z', 0.15, 0.85, 0.0, 0.6)
GLASS = glassy('glass')
POLY = glassy('polycarb', (0.7, 0.75, 0.72), rough=0.35, alpha=0.35)
NET = glassy('chainlink', (0.4, 0.42, 0.44), rough=0.4, alpha=0.18)
FRAME_W = mat('frame_w', (0.75, 0.75, 0.72), rough=0.5)
DARK = mat('dark', (0.015, 0.015, 0.018))
METAL = mat('metal', (0.3, 0.31, 0.33), rough=0.4, metal=0.8)
CONC = noisy('conc', (0.3, 0.3, 0.29), (0.42, 0.41, 0.39), scale=2, bump=0.2)
BARK = noisy('bark', (0.08, 0.05, 0.03), (0.18, 0.11, 0.06), scale=8, bump=0.4)
BIRCH = noisy('birch', (0.62, 0.61, 0.58), (0.1, 0.1, 0.1), scale=12, bump=0.2)
NEEDLES = noisy('needles', (0.015, 0.04, 0.02), (0.04, 0.08, 0.04), scale=3)
LEAVES = noisy('leaves', (0.04, 0.07, 0.02), (0.1, 0.13, 0.04), scale=3)
LAMP_MAT, _ = emit_mat('sodium', (1.0, 0.55, 0.22), 40)
LAMP_FLICK, LAMP_FLICK_B = emit_mat('sodium_f', (1.0, 0.55, 0.22), 40)
LED_MAT, _ = emit_mat('led', (0.85, 0.92, 1.0), 25)
WARM_WIN, WARM_B = emit_mat('warm_window', (1.0, 0.62, 0.3), 0.0)
CAR_PAINT = mat('car_white', (0.75, 0.76, 0.78), rough=0.18, metal=0.3)
TYRE = mat('tyre', (0.02, 0.02, 0.02), rough=0.8)
TAIL = mat('tail', (0.35, 0.02, 0.02), rough=0.2)
STRIPE_R = mat('stripe_r', (0.6, 0.03, 0.03), rough=0.5); STRIPE_W = mat('stripe_w', (0.8, 0.8, 0.78), rough=0.5)


# —— the sky and the moon ——
w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.75; nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs['A'].default_value = (0.06, 0.075, 0.12, 1); mx.inputs['B'].default_value = (0.008, 0.012, 0.028, 1)
nt.links.new(mr.outputs['Result'], mx.inputs['Factor']); nt.links.new(mx.outputs['Result'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 0.6
bpy.ops.object.light_add(type='SUN', location=(0, 0, 50)); moon = bpy.context.object; moon.data.energy = 0.25; moon.data.color = (0.62, 0.72, 1.0)
moon.data.angle = math.radians(0.6); moon.rotation_euler = (math.radians(58), 0, math.radians(-35))


# —— instancing ——
_PROTO = {}
def proto(key_, make):
    if key_ not in _PROTO:
        o = make(); _PROTO[key_] = o.data; bpy.data.objects.remove(o)
    return _PROTO[key_]
def inst(me, loc, scale=(1, 1, 1), rot=(0, 0, 0), name='inst'):
    o = bpy.data.objects.new(name, me); C().objects.link(o); o.location = loc; o.scale = scale; o.rotation_euler = rot
    return o
def slab(c, size, m, name='slab'):
    """a box with real dimensions (so the bands keep their size): the mesh is built at size, not scaled"""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Diagonal((*size, 1)))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = bpy.data.objects.new(name, me); C().objects.link(o); o.location = c
    return o


# —— the ground: the street along y at x = 0, gravel shoulders, grass plots ——
STREET_Y0, STREET_Y1 = -40.0, 200.0
slab((0, 80, -0.05), (6.0, STREET_Y1 - STREET_Y0, 0.1), ASPH, 'street')
for s in (-1, 1): slab((s * 3.75, 80, -0.04), (1.5, STREET_Y1 - STREET_Y0, 0.1), GRAVEL, 'shoulder')
for s in (-1, 1): slab((s * 25, 80, -0.06), (41, STREET_Y1 - STREET_Y0, 0.1), GRASS, 'plots')
slab((0, -70, -0.07), (200, 60, 0.1), GRASS, 'outside')
FENCE_X = 4.5
PLOT = 22.0
NPLOT = 8                                          # plots k = 0…7 on each side: y from 22k to 22k + 22


# —— the street fences: corrugated sheets between brick pillars, a sliding gate and a wicket per plot ——
WICKETS = {}
def street_fence(side, k, color):
    x = side * FENCE_X; y0 = k * PLOT; y1 = y0 + PLOT
    gate0, gate1 = y0 + 3.0, y0 + 7.0              # the sliding gate (closed), then the wicket at y0 + 7.4 … 8.4
    wk0, wk1 = y0 + 7.4, y0 + 8.4
    m = PROFY[color]
    for a, b in ((y0 + 0.2, gate0), (wk1, y1 - 0.2)):
        slab((x, (a + b) / 2, 1.05), (0.04, b - a, 1.9), m, 'prof')
    slab((x, (gate0 + gate1) / 2, 1.0), (0.05, gate1 - gate0, 1.8), m, 'gate')
    slab((x, (gate0 + gate1) / 2, 1.92), (0.08, gate1 - gate0, 0.06), METAL, 'gate_top')
    for yy in list(range(int(y0), int(y1) + 1, 3)) + [gate0, gate1, wk0, wk1]:
        if gate0 < yy < gate1: continue
        slab((x, yy, 1.1), (0.38, 0.38, 2.2), BRICK, 'pillar'); slab((x, yy, 2.24), (0.46, 0.46, 0.08), CONC, 'cap')
    # the wicket on a hinge at wk1: its leaf turns into the plot (open angle keyed per shot)
    hinge = empty((x, wk0, 0), f'wicket_{side}_{k}')
    leaf = slab((0, (wk1 - wk0) / 2, 1.0), (0.04, wk1 - wk0 - 0.04, 1.8), m, 'wicket'); leaf.parent = hinge
    slab((side * -0.05, (wk1 - wk0) - 0.12, 1.0), (0.06, 0.03, 0.14), METAL, 'handle').parent = hinge
    WICKETS[(side, k)] = hinge
for k in range(NPLOT):
    for side in (-1, 1):
        street_fence(side, k, (k * 2 + (side > 0)) % 3)


# —— the cottages ——
def gable_roof(cx, cy, w, d, z, rise, m, overhang=0.5):
    """a gable along y over a house w (x) by d (y), eaves at z"""
    bm = bmesh.new()
    hw, hd = w / 2 + overhang, d / 2 + overhang
    v = [bm.verts.new(p) for p in [(-hw, -hd, 0), (hw, -hd, 0), (0, -hd, rise), (-hw, hd, 0), (hw, hd, 0), (0, hd, rise)]]
    bm.faces.new((v[0], v[1], v[2])); bm.faces.new((v[3], v[5], v[4])); bm.faces.new((v[0], v[2], v[5], v[3])); bm.faces.new((v[1], v[4], v[5], v[2]))
    bm.faces.new((v[0], v[3], v[4], v[1]))
    me = bpy.data.meshes.new('roof'); bm.to_mesh(me); bm.free(); me.materials.append(m)
    o = bpy.data.objects.new('roof', me); C().objects.link(o); o.location = (cx, cy, z)
    sol = o.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.12
    return o
HOUSES = {}
LEFT_ON = [emit_mat(f'left_on{i}', c, s_)[0] for i, (c, s_) in enumerate([((1.0, 0.7, 0.4), 1.6), ((1.0, 0.6, 0.3), 0.9), ((0.7, 0.8, 1.0), 0.7)])]
WIN_RND = random.Random(77)
NO_LIGHTS = False
def window(x, y, z, facing, w=1.3, h=1.5, m=None):
    """a window on a wall: facing 'x+'/'x-' (on a wall normal to x) or 'y+'/'y-'"""
    if m is None and not NO_LIGHTS and WIN_RND.random() < 0.14: m = WIN_RND.choice(LEFT_ON)
    m = m or GLASS
    if facing[0] == 'x':
        dx = 0.06 if facing[1] == '+' else -0.06
        slab((x + dx, y, z), (0.04, w, h), m, 'win'); slab((x + dx * 1.3, y, z), (0.03, w + 0.14, 0.07), FRAME_W, 'sill')
        slab((x + dx * 1.3, y, z + h / 2 + 0.05), (0.03, w + 0.14, 0.07), FRAME_W, 'lintel'); slab((x + dx * 1.3, y, z), (0.03, 0.06, h), FRAME_W, 'mullion')
    else:
        dy = 0.06 if facing[1] == '+' else -0.06
        slab((x, y + dy, z), (w, 0.04, h), m, 'win'); slab((x, y + dy * 1.3, z), (w + 0.14, 0.03, 0.07), FRAME_W, 'sill')
        slab((x, y + dy * 1.3, z + h / 2 + 0.05), (w + 0.14, 0.03, 0.07), FRAME_W, 'lintel'); slab((x, y + dy * 1.3, z), (0.06, 0.03, h), FRAME_W, 'mullion')
def cottage(side, k, style, hollow=False):
    cx = side * 14.5; cy = k * PLOT + 11; w, d = 9.0, 10.0
    wall = SIDING[style % len(SIDING)] if style % 5 != 4 else BRICK_Y
    h = 6.0
    if not hollow:
        slab((cx, cy, h / 2), (w, d, h), wall, 'house')
    else:                                           # her house: walls of their own, a floor upstairs, a window with a real hole
        t = 0.25; fx = cx - side * w / 2            # the street-side wall
        for (c, s) in [((cx + side * w / 2, cy, h / 2), (t, d, h)), ((cx, cy - d / 2, h / 2), (w, t, h)), ((cx, cy + d / 2, h / 2), (w, t, h))]:
            slab(c, s, wall, 'wall')
        wy0, wy1, wz0, wz1 = cy - 2.7, cy - 0.5, 3.55, 5.3           # the upstairs window in the street wall
        for (c, s) in [((fx, cy, 1.775), (t, d, 3.55)), ((fx, (cy - d / 2 + wy0) / 2, 4.425), (t, wy0 - (cy - d / 2), 1.75)),
                       ((fx, (wy1 + cy + d / 2) / 2, 4.425), (t, cy + d / 2 - wy1, 1.75)), ((fx, cy, 5.65), (t, d, 0.7))]:
            slab(c, s, wall, 'wall')
        slab((fx, (wy0 + wy1) / 2, wz0 - 0.03), (t + 0.1, wy1 - wy0 + 0.1, 0.06), FRAME_W, 'sill')
        slab((fx, (wy0 + wy1) / 2, (wz0 + wz1) / 2), (0.05, 0.06, wz1 - wz0), FRAME_W, 'mullion')
        slab((cx, cy, 3.0), (w - 0.2, d - 0.2, 0.2), PLANK, 'floor2')
        slab((cx, cy, 5.95), (w - 0.2, d - 0.2, 0.1), mat('ceiling', (0.5, 0.48, 0.45)), 'ceil')
        # inside upstairs: an armchair, a chest of drawers, the switch by the window
        slab((cx + side * 1.0, cy + 2.6, 3.5), (0.9, 0.9, 0.8), mat('chair', (0.14, 0.12, 0.11)), 'chair')
        slab((cx + side * 3.6, cy - 3.5, 3.55), (0.6, 1.4, 0.9), PLANK, 'drawers')
        slab((fx + side * 0.14, wy0 - 0.45, 4.3), (0.02, 0.09, 0.13), FRAME_W, 'switch')
        HOUSES['switch'] = Vector((fx + side * 0.16, wy0 - 0.45, 4.3)); HOUSES['win'] = Vector((fx, (wy0 + wy1) / 2, 4.4))
        CURT = mat('curtain', (0.22, 0.05, 0.06), rough=0.9)
        for yy in (wy0 - 0.25, wy1 + 0.25): slab((fx + side * 0.2, yy, 4.45), (0.05, 0.5, 2.0), CURT, 'curtain')
        slab((cx - side * 0.5, cy + 3.2, 3.35), (2.0, 2.2, 0.5), mat('bed', (0.42, 0.4, 0.38)), 'bed')
    gable_roof(cx, cy, w, d, h, 3.0, ROOF[(k + side) % len(ROOF)])
    # windows on the street side and the back, both floors; the yard side gets one more (the one that lights up in F)
    fx = cx - side * w / 2; bx = cx + side * w / 2
    for zz in (1.7, 4.5):
        for yy in (cy - 2.6, cy + 2.6):
            if not (hollow and zz > 4 and yy < cy): window(fx, yy, zz, 'x-' if side > 0 else 'x+')
            window(bx, yy, zz, 'x+' if side > 0 else 'x-')
    for zz in (1.7, 4.5): window(cx + side * 1.5, cy - d / 2, zz, 'y-', w=1.2)
    slab((fx - side * 0.9, cy + 1.2, 0.15), (1.8, 2.4, 0.3), CONC, 'porch'); slab((fx - side * 0.02, cy + 1.2, 1.1), (0.06, 1.0, 2.1), PLANK, 'door')
    slab((cx + side * 2.5, cy + 3.0, h + 2.4), (0.6, 0.6, 2.0), BRICK, 'chimney')
    return cx, cy
for k in range(NPLOT):
    for side in (-1, 1):
        if side > 0 and k == 4: continue
        NO_LIGHTS = side > 0 and k == 0
        cottage(side, k, k * 3 + (side > 0) * 2)
NO_LIGHTS = True
HCX, HCY = cottage(1, 4, 1, hollow=True)
# the lit window of F: the «empty» house on plot 0 (right side), its yard-facing window downstairs
LIT = slab((14.5 + 1.5, 0 * PLOT + 11 - 5.0 - 0.11, 1.7), (1.2, 0.04, 1.5), WARM_WIN, 'lit_window')
bpy.ops.object.light_add(type='AREA', location=(16.0, 5.7, 1.7)); LITL = bpy.context.object; LITL.data.size = 1.2; LITL.data.color = (1.0, 0.6, 0.3)
LITL.rotation_euler = (math.radians(90), 0, 0); LITL.data.energy = 0.0


# —— the backyards: chain-link dividers, greenhouses, sheds, a bathhouse, pines and birches ——
for k in range(NPLOT + 1):
    for side in (-1, 1):
        y = k * PLOT
        for a, b in ((FENCE_X + 0.2, 23.0), (24.6, 35.0)):           # a gap at x 23 … 24.6: the gardeners' way through
            xa, xb = side * a, side * b
            slab(((xa + xb) / 2, y, 0.75), (abs(xb - xa), 0.02, 1.5), NET, 'net')
            for xx in range(int(a), int(b) + 1, 3): slab((side * xx, y, 0.8), (0.05, 0.05, 1.6), METAL, 'netpost')
for side in (-1, 1): slab((side * 35, 80, 1.0), (0.05, STREET_Y1 - STREET_Y0, 2.0), PLANK, 'backfence')
def greenhouse(x, y, length=6.0):
    o = cyl((x, y, 0), 1.6, length, POLY, verts=16, rot=(math.radians(90), 0, 0), name='greenhouse'); o.scale = (1.0, 1.25, 1.0)
    for dy in (-length / 2, length / 2): slab((x, y + dy, 1.0), (3.2, 0.03, 2.0), POLY, 'gh_end')
    for i in range(5): slab((x, y - length / 2 + i * length / 4, 1.0), (3.2, 0.05, 0.05), METAL, 'gh_rib')
def shed(x, y, m=PLANK):
    slab((x, y, 1.1), (2.6, 2.2, 2.2), m, 'shed'); slab((x, y, 2.3), (3.0, 2.6, 0.12), ROOF[1], 'shed_roof')
def pine(x, y, h, seed):
    r = random.Random(seed)
    inst(proto('ptrunk', lambda: cyl((0, 0, 0), 1.0, 1.0, BARK, verts=7)), (x, y, h * 0.35), (0.16, 0.16, h * 0.7))
    cone = proto('pcone', lambda: cyl((0, 0, 0), 1.0, 1.0, NEEDLES, verts=9, r2=0.0))
    for i in range(5):
        z = h * (0.35 + i * 0.13); rr = h * (0.2 - i * 0.03)
        inst(cone, (x + r.uniform(-0.1, 0.1), y + r.uniform(-0.1, 0.1), z), (rr, rr, h * 0.22), (0, 0, r.uniform(0, 6)))
def birch(x, y, h, seed):
    r = random.Random(seed)
    inst(proto('btrunk', lambda: cyl((0, 0, 0), 1.0, 1.0, BIRCH, verts=7)), (x, y, h / 2), (0.11, 0.11, h), (r.uniform(-0.05, 0.05), r.uniform(-0.05, 0.05), 0))
    crown = proto('crown', lambda: ico((0, 0, 0), 1.0, LEAVES, sub=1))
    for _ in range(3): inst(crown, (x + r.uniform(-0.9, 0.9), y + r.uniform(-0.9, 0.9), h * r.uniform(0.62, 0.9)), (h * 0.17, h * 0.17, h * 0.22))
rnd = random.Random(5)
for k in range(NPLOT):
    for side in (-1, 1):
        y0 = k * PLOT
        greenhouse(side * 26.5, y0 + 6.5 + rnd.uniform(-1, 1))
        shed(side * 31.5, y0 + 16 + rnd.uniform(-1, 1), PLANK if rnd.random() < 0.6 else PROF[2])
        for j in range(3):
            (pine if rnd.random() < 0.5 else birch)(side * rnd.uniform(29, 34), y0 + rnd.uniform(2, 20), rnd.uniform(9, 15), k * 10 + j + (side > 0) * 100)
        slab((side * 22, y0 + 15, 0.12), (5.0, 3.0, 0.24), SOIL, 'bed')
# the forest round the settlement
for i in range(150):
    side = rnd.choice((-1, 1)); x = side * rnd.uniform(38, 80); y = rnd.uniform(-40, 200)
    pine(x, y, rnd.uniform(14, 22), 1000 + i)
for i in range(60):
    x = rnd.uniform(-60, 60); y = rnd.uniform(-75, -30)
    if abs(x) < 4: continue
    pine(x, y, rnd.uniform(14, 22), 3000 + i)


# —— the street lamps: on the left shoulder every 30 m, the arm over the road; one of them flickers ——
LAMPS = []
def lamp(y, flick=False):
    x = -3.7
    cyl((x, y, 3.6), 0.07, 7.2, METAL, verts=8, name='pole'); slab((x + 0.9, y, 7.1), (1.8, 0.08, 0.08), METAL, 'arm')
    slab((x + 1.75, y, 7.0), (0.5, 0.25, 0.12), METAL, 'head'); slab((x + 1.75, y, 6.93), (0.42, 0.18, 0.02), LAMP_FLICK if flick else LAMP_MAT, 'bulb')
    bpy.ops.object.light_add(type='SPOT', location=(x + 1.75, y, 6.85)); L = bpy.context.object
    L.data.energy = 2600; L.data.color = (1.0, 0.58, 0.26); L.data.spot_size = math.radians(130); L.data.spot_blend = 0.6; L.data.shadow_soft_size = 0.15
    LAMPS.append(L); return L
for y in (5, 35, 65, 95, 125, 155, 185):
    lamp(y, flick=(y == 65))
FL = LAMPS[2]
for f in range(0, 2400, 3):                       # the flicker: mostly on, now and then a stutter
    r = random.Random(f // 3 + 7).random()
    on = 0.08 if r < 0.08 else (0.55 if r < 0.14 else 1.0)
    FL.data.energy = 2600 * on; FL.data.keyframe_insert('energy', frame=f)
    LAMP_FLICK_B.inputs['Emission Strength'].default_value = 40 * on; LAMP_FLICK_B.inputs['Emission Strength'].keyframe_insert('default_value', frame=f)


# —— the entrance: the barrier, the guard booth with a cold LED, her car by the gate ——
slab((4.8, -10, 1.3), (2.2, 2.4, 2.6), SIDING[1], 'booth'); slab((4.8, -10, 2.7), (2.6, 2.8, 0.15), ROOF[1], 'booth_roof')
window(3.7, -10, 1.6, 'x-', w=1.6, h=1.0)
slab((3.2, -8, 0.55), (0.3, 0.3, 1.1), STRIPE_R, 'barrier_post')
for i in range(6): slab((3.0 - i * 0.55 - 0.27, -8, 1.0), (0.55, 0.08, 0.08), STRIPE_R if i % 2 else STRIPE_W, 'barrier')
for s in (-1, 1): slab((s * FENCE_X, -16, 1.05), (0.04, 16, 1.9), PROFY[2], 'gate_fence')
bpy.ops.object.light_add(type='SPOT', location=(3.6, -6, 5.5)); GL = bpy.context.object; GL.data.energy = 1800; GL.data.color = (0.82, 0.9, 1.0)
GL.data.spot_size = math.radians(110); GL.data.spot_blend = 0.5; GL.rotation_euler = (math.radians(20), math.radians(-25), 0)
cyl((4.2, -6, 2.8), 0.06, 5.6, METAL, verts=8, name='gate_pole'); slab((3.7, -6, 5.6), (1.0, 0.22, 0.1), METAL, 'gate_head'); slab((3.7, -6, 5.54), (0.8, 0.16, 0.02), LED_MAT, 'led')
def car(x, y, heading=0.0):
    root = empty((x, y, 0), 'car', rot=(0, 0, heading))
    body = slab((0, 0, 0.72), (1.85, 4.4, 0.8), CAR_PAINT, 'car_body'); body.parent = root
    bv = body.modifiers.new('bevel', 'BEVEL'); bv.width = 0.12; bv.segments = 3
    cab = slab((0, 0.35, 1.38), (1.7, 2.4, 0.62), CAR_PAINT, 'car_cabin'); cab.parent = root
    bv = cab.modifiers.new('bevel', 'BEVEL'); bv.width = 0.18; bv.segments = 3
    for c, s in [((0, 0.35, 1.4), (1.74, 2.0, 0.42)), ((0, -0.95, 1.36), (1.5, 0.1, 0.44)), ((0, 1.62, 1.38), (1.5, 0.1, 0.4))]:
        g_ = slab(c, s, GLASS, 'car_glass'); g_.parent = root
    for dx in (-0.82, 0.82):
        for dy in (-1.4, 1.45):
            t = cyl((dx, dy, 0.36), 0.36, 0.26, TYRE, verts=18, rot=(0, math.radians(90), 0), name='wheel'); t.parent = root
    for dx in (-0.65, 0.65):
        slab((dx, 2.21, 0.9), (0.35, 0.03, 0.12), TAIL, 'tail').parent = root
        slab((dx, -2.21, 0.88), (0.38, 0.03, 0.12), FRAME_W, 'headlamp').parent = root
    return root
CAR = car(-1.6, -1.0, math.radians(180))


# —— the people ——
kit.people_materials()
H = {'skin': mat('h_skin', (0.78, 0.55, 0.45), rough=0.5), 'hair': mat('h_hair', (0.05, 0.03, 0.02), rough=0.35),
     'jacket': mat('h_jacket', (0.025, 0.025, 0.028), rough=0.32), 'jeans': mat('h_jeans', (0.04, 0.06, 0.12), rough=0.7),
     'sneak': mat('h_sneak', (0.75, 0.75, 0.74), rough=0.6), 'top': mat('h_top', (0.45, 0.05, 0.07), rough=0.6),
     'eye': mat('h_eye', (0.02, 0.015, 0.012), rough=0.15), 'lips': mat('h_lips', (0.45, 0.12, 0.12), rough=0.4)}
Z = {'skin': mat('z_skin', (0.36, 0.39, 0.35), rough=0.75), 'shirt': mat('z_shirt', (0.13, 0.15, 0.17), rough=0.9),
     'coat': mat('z_coat', (0.09, 0.08, 0.07), rough=0.9), 'pants': mat('z_pants', (0.06, 0.06, 0.07), rough=0.9),
     'hair': mat('z_hair', (0.05, 0.05, 0.05), rough=0.9), 'dress': mat('z_dress', (0.2, 0.17, 0.2), rough=0.9),
     'eye': mat('z_eye', (0.8, 0.82, 0.72), emit=0.5)}
import rig
def skin_chain(pts, radii, m, parent=None, name='body', subd=2):
    """a smooth organic tube through the points (the Skin modifier, then subdivision): a ponytail, rags"""
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(p) for p in pts], [(i, i + 1) for i in range(len(pts) - 1)], [])
    o = bpy.data.objects.new(name, me); C().objects.link(o); me.materials.append(m)
    if parent: o.parent = parent
    sk = o.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    sv = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = r if isinstance(r, tuple) else (r, r)
    sv[0].use_root = True
    sd = o.modifiers.new('subd', 'SUBSURF'); sd.levels = subd; sd.render_levels = subd
    return o
def smooth_ball(loc, size, m, parent=None, name='ball'):
    o = ico(loc, 1.0, m, sub=3, parent=parent, name=name, scale=size)
    for p in o.data.polygons: p.use_smooth = True
    return o
def head_mount(arm, h):
    """an empty riding the head bone with the world's axes (at rest), its origin at the base of the skull"""
    e = empty((0, 0, 0), arm.name + '_headmount')
    e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = 'head'
    e.location = (0, -0.22 * h / 1.68, 0); e.rotation_euler = (math.radians(-90), 0, 0)
    return e
def rigged(name, mats, h, slim=1.0, hipw=1.0):
    arm, body, J = rig.build(name, mats, h=h, slim=slim, hipw=hipw)
    pb = arm.pose.bones
    P = dict(root=arm, body=body, pb=pb, hips=[pb['thigh.L'], pb['thigh.R']], knees=[pb['shin.L'], pb['shin.R']],
             arms=[pb['upperarm.L'], pb['upperarm.R']], elbows=[pb['forearm.L'], pb['forearm.R']], spine=pb['spine'], chest=pb['chest'], head=pb['head'])
    return P, head_mount(arm, h)
def heroine(x, y, rot=0.0):
    """she: 1.68 m, slim; a fitted black jacket, dark jeans, white sneakers; a long dark ponytail, bangs swept aside"""
    P, hm = rigged('heroine', {'top': H['jacket'], 'legs': H['jeans'], 'shoes': H['sneak'], 'skin': H['skin']}, 1.68, slim=0.95, hipw=1.06)
    smooth_ball((0, -0.012, 0.1), (0.082, 0.096, 0.112), H['skin'], parent=hm, name='h_skull')
    smooth_ball((0, 0.016, 0.125), (0.089, 0.097, 0.1), H['hair'], parent=hm, name='h_hair')              # the back and the top
    smooth_ball((0.02, -0.06, 0.185), (0.078, 0.06, 0.035), H['hair'], parent=hm, name='h_bangs')          # swept to one side
    for dx in (-0.031, 0.031):
        ico((dx, -0.086, 0.105), 0.0105, H['eye'], sub=2, parent=hm, name='h_eye')
        skin_chain([(dx - 0.017, -0.088, 0.128), (dx + 0.017, -0.089, 0.131)], [0.004, 0.003], H['hair'], parent=hm, name='h_brow', subd=1)
    smooth_ball((0, -0.1, 0.082), (0.011, 0.018, 0.022), H['skin'], parent=hm, name='h_nose')
    skin_chain([(-0.017, -0.095, 0.045), (0.017, -0.095, 0.045)], [0.0075, 0.0075], H['lips'], parent=hm, name='h_lips', subd=1)
    smooth_ball((0, -0.004, 0.235 - 0.25), (0.06, 0.05, 0.03), H['jacket'], parent=hm, name='h_collar')
    tl = empty((0, 0.09, 0.19), 'h_tail', parent=hm); P['tail'] = tl
    skin_chain([(0, 0, 0), (0, 0.045, -0.05), (0, 0.04, -0.18), (0, 0.03, -0.32), (0, 0.015, -0.46), (0, 0.0, -0.54)], [0.028, 0.036, 0.032, 0.024, 0.014, 0.004], H['hair'], parent=tl, name='h_ponytail')
    smooth_ball((0, 0.05, 0.075), (0.085, 0.06, 0.09), H['hair'], parent=hm, name='h_nape')
    P['root'].location = (x, y, 0); P['root'].rotation_euler = (0, 0, rot)
    return P
def infected(x, y, rot=0.0, kind=0, seed=0):
    """one of them: taller and gaunt, stooped, the head hanging to one side, the arms loose; ragged dark clothes, grey
    skin, pale eyes. No blood, no wounds"""
    r = random.Random(seed)
    cloth = Z['dress'] if kind == 2 else Z['coat'] if kind == 1 else Z['shirt']
    P, hm = rigged(f'inf{seed}', {'top': cloth, 'legs': Z['pants'] if kind != 2 else Z['skin'], 'shoes': Z['pants'], 'skin': Z['skin']},
                   r.uniform(1.74, 1.86), slim=0.9 if kind != 2 else 0.95, hipw=0.95 if kind != 2 else 1.05)
    P['seed'] = seed
    smooth_ball((0, -0.012, 0.1), (0.085, 0.1, 0.118), Z['skin'], parent=hm, name='z_skull')
    smooth_ball((0, 0.02, 0.135), (0.088, 0.096, 0.09 if kind != 2 else 0.13), Z['hair'], parent=hm, name='z_hair')
    for dx in (-0.033, 0.033): ico((dx, -0.09, 0.11), 0.012, Z['eye'], sub=2, parent=hm, name='z_eye')
    if kind == 2: skin_chain([(0, 0.06, 0.12), (0, 0.1, -0.05), (0, 0.1, -0.25)], [0.09, 0.085, 0.05], Z['hair'], parent=hm, name='z_longhair')
    for j in range(5):                                                       # rags off the hem and the sleeves
        a = r.uniform(0, 6.28); z0 = r.uniform(0.95, 1.05)
        skin_chain([(math.cos(a) * 0.12, math.sin(a) * 0.09, z0), (math.cos(a) * 0.14, math.sin(a) * 0.1, z0 - 0.14 - r.uniform(0, 0.1))], [0.03, 0.006], cloth, parent=P['root'], name='z_rag', subd=1)
    P['stoop'] = math.radians(14 + r.uniform(0, 12)); P['tilt'] = math.radians(r.uniform(-22, 22)); P['droop'] = math.radians(r.uniform(12, 30))
    P['spine'].rotation_euler = (P['stoop'], 0, 0); P['chest'].rotation_euler = (P['stoop'] * 0.5, 0, 0)
    P['head'].rotation_euler = (P['droop'], 0, P['tilt'])
    for i in range(2): P['arms'][i].rotation_euler = (math.radians(-r.uniform(5, 30)), 0, 0); P['elbows'][i].rotation_euler = (math.radians(-r.uniform(10, 40)), 0, 0)
    P['root'].location = (x, y, 0); P['root'].rotation_euler = (0, 0, rot)
    return P


def head_key(P, f, pitch=0.0, yaw=0.0, roll=0.0):
    key(P['head'], 'rotation_euler', f, (pitch, yaw, roll))
def shuffle(P, f0, f1, p0, p1, period=46, step=3):
    """their walk: slow, uneven (one leg drags), the body sways, the head twitches now and then"""
    r = random.Random(P['seed']); ph0 = r.uniform(0, 6)
    d = Vector(p1) - Vector(p0)
    yaw = math.atan2(d.x, -d.y) if d.length > 1e-3 else P['root'].rotation_euler.z
    P['root'].rotation_euler = (0, 0, yaw)
    moving = d.length > 0.3
    for f in range(f0, f1 + 1, step):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period + ph0
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.015 * abs(math.sin(ph)) * moving))
        P['root'].keyframe_insert('location', frame=f)
        a, b = (-0.32 * math.sin(ph), -0.14 * math.sin(ph + math.pi)) if moving else (0.03 * math.sin(ph), -0.03 * math.sin(ph))
        key(P['hips'][0], 'rotation_euler', f, (a, 0, 0)); key(P['hips'][1], 'rotation_euler', f, (b, 0, 0.05))
        key(P['knees'][0], 'rotation_euler', f, (max(0, 0.55 * math.sin(ph + 1.2)) * moving + 0.05, 0, 0)); key(P['knees'][1], 'rotation_euler', f, (0.12, 0, 0))
        key(P['spine'], 'rotation_euler', f, (P['stoop'] + 0.04 * math.sin(ph * 0.5), 0, 0.06 * math.sin(ph)))
        for i in range(2): key(P['arms'][i], 'rotation_euler', f, (P['arms'][i].rotation_euler.x + 0.0, 0, 0.05 * math.sin(ph + i)))
        tw = r.uniform(-0.7, 0.7) if r.random() < 0.07 else 0.0
        head_key(P, f, P['droop'] + 0.05 * math.sin(ph * 0.7), tw, P['tilt'] + tw * 0.3)
def walk(P, f0, f1, p0, p1, swing=0.4, period=30, step=2, crouch=0.0):
    d = Vector(p1) - Vector(p0); yaw = math.atan2(d.x, -d.y)
    for f in range(f0, f1 + 1, step):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, -0.16 * crouch + 0.015 * abs(math.sin(ph))))
        P['root'].keyframe_insert('location', frame=f); key(P['root'], 'rotation_euler', f, (0, 0, yaw))
        for i in range(2):
            s_ = math.sin(ph + math.pi * i)
            key(P['hips'][i], 'rotation_euler', f, (-swing * s_ - 0.5 * crouch, 0, 0))
            key(P['knees'][i], 'rotation_euler', f, (max(0, 0.85 * math.sin(ph + math.pi * i + 1.4)) + 0.75 * crouch, 0, 0))
            key(P['arms'][i], 'rotation_euler', f, (0.45 * swing * s_ - 0.2 * crouch, 0, (0.08 if i else -0.08)))
            key(P['elbows'][i], 'rotation_euler', f, (-0.35 - 0.3 * crouch, 0, 0))
        key(P['spine'], 'rotation_euler', f, (0.35 * crouch, 0.04 * math.sin(ph), 0))
        key(P['tail'], 'rotation_euler', f, (0.1 * math.sin(2 * ph), 0, 0.12 * math.sin(ph)))
def crouch_pose(P, f, k=1.0, look_yaw=0.0):
    P['root'].location.z = -0.38 * k; P['root'].keyframe_insert('location', frame=f)
    key(P['hips'][0], 'rotation_euler', f, (-1.35 * k, 0, -0.08)); key(P['hips'][1], 'rotation_euler', f, (-0.75 * k, 0, 0.1))
    key(P['knees'][0], 'rotation_euler', f, (2.1 * k, 0, 0)); key(P['knees'][1], 'rotation_euler', f, (1.6 * k, 0, 0))
    key(P['spine'], 'rotation_euler', f, (0.32 * k, 0, 0)); head_key(P, f, -0.12 * k, look_yaw)
    key(P['arms'][0], 'rotation_euler', f, (-0.8 * k, 0, -0.1)); key(P['elbows'][0], 'rotation_euler', f, (-1.3 * k, 0, 0))
    key(P['arms'][1], 'rotation_euler', f, (-1.15 * k, 0, 0.15)); key(P['elbows'][1], 'rotation_euler', f, (-0.7 * k, 0, 0))
def stand_pose(P, f, hip=0.0):
    """standing, the weight on one leg, the arms relaxed"""
    key(P['hips'][0], 'rotation_euler', f, (-0.02, 0, -0.04)); key(P['hips'][1], 'rotation_euler', f, (0.06, 0, 0.07))
    key(P['knees'][0], 'rotation_euler', f, (0.02, 0, 0)); key(P['knees'][1], 'rotation_euler', f, (0.2, 0, 0))
    for i in range(2):
        key(P['arms'][i], 'rotation_euler', f, (0.02, 0, (0.06 if i else -0.06))); key(P['elbows'][i], 'rotation_euler', f, (-0.25, 0, 0))
    key(P['spine'], 'rotation_euler', f, (0.0, 0.0, hip))
def breathe(P, f0, f1, step=4):
    for f in range(f0, f1 + 1, step):
        key(P['tail'], 'rotation_euler', f, (0.05 * math.sin(f / 9), 0, 0.04 * math.sin(f / 13)))
        key(P['chest'], 'rotation_euler', f, (0.015 * math.sin(f / 20), 0, 0))


HER = heroine(0, 0)
INF = [infected(0, 0, kind=i % 3, seed=i) for i in range(7)]
def hide(*objs):
    for o in objs:
        for c in [o] + list(o.children_recursive): c.hide_render = True


# —— the camera ——
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); C().objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.05; cam_data.clip_end = 3000
look = empty((0, 0, 0), 'look'); aim(cam, look)
def camkeys(keys):
    for f, p, q in keys: key(cam, 'location', f, Vector(p)); key(look, 'location', f, Vector(q))
def dof(dist, fstop=2.8, target=None):
    cam_data.dof.use_dof = True; cam_data.dof.aperture_fstop = fstop; cam_data.dof.focus_distance = dist
    if target is not None:                         # a pose bone: focus on that bone of its armature
        cam_data.dof.focus_object = target.id_data; cam_data.dof.focus_subtarget = target.name
def wick(side, k, f, ang):
    key(WICKETS[(side, k)], 'rotation_euler', f, (0, 0, math.radians(ang)))
FOG = float(os.environ.get('FOG', '0.01'))
HER_K = 4                                           # her plot, right side
WK_Y = HER_K * PLOT + 7.9                            # her wicket's middle


# —— the shots ——
def phone_glow(P, at):
    """her phone in both hands at the chest: the screen lights her face cold from below (no signal: «связи нет»)"""
    ph = slab(at, (0.008, 0.075, 0.15), DARK, 'phone'); ph.rotation_euler = (0, math.radians(-25), 0)
    scr_m, _ = emit_mat('screen', (0.7, 0.85, 1.0), 6.0)
    sc_ = slab((at[0] + 0.006, at[1], at[2]), (0.002, 0.066, 0.135), scr_m, 'screen'); sc_.rotation_euler = (0, math.radians(-25), 0)
    bpy.ops.object.light_add(type='POINT', location=(at[0] + 0.12, at[1], at[2] + 0.06)); L = bpy.context.object
    L.data.energy = 4.0; L.data.color = (0.7, 0.85, 1.0); L.data.shadow_soft_size = 0.05
    key(P['arms'][1], 'rotation_euler', 0, (math.radians(-42), 0, 0)); key(P['elbows'][1], 'rotation_euler', 0, (math.radians(-105), 0, 0))
    key(P['arms'][0], 'rotation_euler', 0, (math.radians(-30), 0, 0)); key(P['elbows'][0], 'rotation_euler', 0, (math.radians(-100), 0, 0))
    return ph, L
if SHOT == 'A':                                   # the hook: from the street, up at her dark window: she lit by her phone; one of them passes close
    cam_data.lens = 60
    win = HOUSES['win']
    HER['root'].location = (win.x + 0.55, win.y + 0.2, 3.1); HER['root'].rotation_euler = (0, 0, math.radians(-90))
    stand_pose(HER, 0); breathe(HER, 0, E)
    phone_glow(HER, (win.x + 0.3, win.y + 0.2, 4.2))
    head_key(HER, 0, math.radians(12), math.radians(8)); head_key(HER, int(E * 0.55), math.radians(12), math.radians(8)); head_key(HER, int(E * 0.7), math.radians(-4), math.radians(-14)); head_key(HER, E, math.radians(-4), math.radians(-14))
    camkeys([(0, (1.4, win.y - 5.6, 1.3), (win.x, win.y + 0.1, 4.2)), (E, (1.7, win.y - 5.1, 1.32), (win.x, win.y + 0.15, 4.25))])
    dof(9.5, 2.0, target=HER['head'])
    spots = [((3.75, win.y - 2.2, 0), (3.85, win.y - 6.2)), ((-1.2, win.y - 14, 0), (-0.8, win.y - 11.5)), ((1.4, win.y - 22, 0), (1.0, win.y - 19)),
             ((-1.6, win.y + 9, 0), (-1.2, win.y + 6)), ((1.8, win.y - 30, 0), (1.3, win.y - 27))]
    for P, (p0, p1) in zip(INF, spots): shuffle(P, 0, E, p0, (*p1, 0), step=3)
    for P in INF[len(spots):]: hide(P['root'])
    bpy.ops.object.light_add(type='AREA', location=(win.x - 0.6, win.y, 4.7)); ML = bpy.context.object; ML.data.size = 1.6; ML.data.energy = 18
    ML.data.color = (0.55, 0.65, 1.0); ML.rotation_euler = (0, math.radians(90), 0)       # a little moon on the glass and on her
    FOG_BOX = ((-30, 40, 0), (9.5, 160, 12))
elif SHOT == 'B':                                 # upstairs at the dark window, the hand at the switch — and away; one passes below
    cam_data.lens = 26
    win = HOUSES['win']; sw = HOUSES['switch']
    HER['root'].location = (win.x + 0.75, win.y + 0.15, 3.1); HER['root'].rotation_euler = (0, 0, math.radians(-90))
    breathe(HER, 0, E); stand_pose(HER, 0)
    PH, PHL = phone_glow(HER, (win.x + 0.3, win.y + 0.2, 4.2))
    key(HER['arms'][0], 'rotation_euler', int(E * 0.25), (math.radians(-30), 0, 0))
    reach, el = HER['arms'][1], HER['elbows'][1]
    for f, a, b, e_ in [(0, -42, 0, -105), (int(E * 0.18), -42, 0, -105), (int(E * 0.32), -55, -40, -70), (int(E * 0.55), -55, -40, -70), (int(E * 0.68), -42, 0, -105), (E, -42, 0, -105)]:
        key(reach, 'rotation_euler', f, (math.radians(a), 0, math.radians(b))); key(el, 'rotation_euler', f, (math.radians(e_), 0, 0))
    head_key(HER, 0, 0, math.radians(-10)); head_key(HER, int(E * 0.6), 0, math.radians(-10))
    head_key(HER, int(E * 0.75), math.radians(8), math.radians(18)); head_key(HER, E, math.radians(8), math.radians(18))
    cam_data.lens = 30
    camkeys([(0, (win.x + 2.6, win.y + 1.7, 4.65), (win.x - 1.5, win.y - 0.5, 4.15)), (E, (win.x + 2.2, win.y + 1.45, 4.6), (win.x - 1.5, win.y - 0.45, 4.1))])
    dof(3.0, 2.0, target=HER['head'])
    shuffle(INF[0], 0, E, (2.0, win.y + 9, 0), (1.2, win.y - 5, 0), step=3)
    shuffle(INF[1], 0, E, (-1.5, win.y - 14, 0), (-1.0, win.y - 11, 0), step=3)
    for P in INF[2:]: hide(P['root'])
    bpy.ops.object.light_add(type='AREA', location=(win.x - 0.4, win.y, 4.6)); ML = bpy.context.object; ML.data.size = 1.6; ML.data.energy = 25
    ML.data.color = (0.55, 0.65, 1.0); ML.rotation_euler = (0, math.radians(-90), 0)                  # moonlight through the window
    FOG_BOX = ((-12, 60, 0), (8.6, 140, 10))
elif SHOT == 'C':                                 # high over the settlement, the street toward the gate
    cam_data.lens = 24
    camkeys([(0, (9.0, 128.0, 46.0), (0.5, 30.0, 0.0)), (E, (7.0, 121.0, 43.0), (0.5, 30.0, 0.0))])
    HER['root'].location = (HCX - 3.0, HCY + 6.0, 3.1); hide(HER['root'])
    spots = [((1.0, 84, 0), (0.4, 78)), ((-0.8, 74, 0), (-0.3, 70)), ((0.3, 64, 0), (0.9, 60)), ((-1.3, 52, 0), (-1.0, 48)), ((1.6, 40, 0), (1.2, 37)), ((-0.2, 28, 0), (0.4, 25)), ((2.0, 96, 0), (2.0, 95))]
    for P, (p0, p1) in zip(INF, spots):
        shuffle(P, 0, E, p0, (*p1, 0), step=3)
        P['root'].scale = (1.6, 1.6, 1.6)            # a little bigger, to read from up here
    FOG_BOX = None
elif SHOT == 'E':                                 # the backyards: she slips along the chain-link past a greenhouse
    cam_data.lens = 32
    p0, p1 = (22.8, 3 * PLOT + 18.0), (22.6, 3 * PLOT + 4.0)
    walk(HER, 0, E, (*p0, 0), (*p1, 0), swing=0.42, period=26, step=2, crouch=0.55)
    camkeys([(0, (21.0, 3 * PLOT + 23.0, 1.4), (23.4, 3 * PLOT + 12.0, 0.95)), (E, (21.2, 3 * PLOT + 10.0, 1.35), (23.6, 3 * PLOT - 2.0, 0.95))])
    dof(4.0, 2.4, target=HER['spine'])
    spots = [((30.5, 2 * PLOT + 17.5, 0), (30.4, 2 * PLOT + 17.3)), ((0.8, 3 * PLOT + 14, 0), (0.2, 3 * PLOT + 10))]
    for P, (pa, pb) in zip(INF, spots): shuffle(P, 0, E, pa, (*pb, 0), step=3)
    INF[0]['root'].rotation_euler = (0, 0, math.radians(160))
    for P in INF[2:]: hide(P['root'])
    FOG_BOX = ((-10, 20, 0), (36, 110, 10))
elif SHOT == 'F':                                 # the last yard: she makes for the wicket — the window lights up
    cam_data.lens = 28
    t_on = int(E * ev(0, 0.55))
    walk(HER, 0, t_on, (17.5, 4.2, 0), (11.0, 4.0, 0), swing=0.38, period=28, step=2, crouch=0.35)
    stand_pose(HER, t_on + 3)
    key(HER['root'], 'location', t_on + 2, Vector((11.0, 4.0, 0.0))); key(HER['spine'], 'rotation_euler', t_on + 2, (-0.08, 0, 0))
    head_key(HER, t_on, 0, 0); head_key(HER, t_on + 5, math.radians(-8), math.radians(-70)); head_key(HER, E, math.radians(-8), math.radians(-70))
    for f in (t_on + 2, E): key(HER['root'], 'rotation_euler', f, (0, 0, math.radians(-90)))
    WARM_B.inputs['Emission Strength'].default_value = 0.0; WARM_B.inputs['Emission Strength'].keyframe_insert('default_value', frame=t_on)
    WARM_B.inputs['Emission Strength'].default_value = 1.6; WARM_B.inputs['Emission Strength'].keyframe_insert('default_value', frame=t_on + 2)
    LITL.data.energy = 0; LITL.data.keyframe_insert('energy', frame=t_on); LITL.data.energy = 140; LITL.data.keyframe_insert('energy', frame=t_on + 2)
    LITL.rotation_euler = (math.radians(-90), 0, 0)
    camkeys([(0, (21.5, 2.5, 1.55), (9.0, 4.4, 1.2)), (t_on, (15.6, 2.7, 1.55), (9.5, 4.3, 1.2)), (min(E, t_on + 5), (19.0, 0.9, 1.6), (14.5, 4.6, 1.6)), (E, (18.8, 1.0, 1.6), (14.4, 4.7, 1.6))])
    key(cam_data, 'lens', t_on, 28.0); key(cam_data, 'lens', min(E, t_on + 5), 22.0)
    dof(5.0, 2.4, target=HER['head'])
    for P in INF[1:]: hide(P['root'])
    shuffle(INF[0], 0, E, (-1.0, 10.0, 0), (-0.6, 7.5, 0), step=3)
    FOG_BOX = ((-12, -20, 0), (34, 40, 10))
elif SHOT == 'G':                                 # by the open wicket she looks back at the lit house (at us); at the end, straight at us
    cam_data.lens = 40
    WARM_B.inputs['Emission Strength'].default_value = 1.6; LITL.data.energy = 140; LITL.rotation_euler = (math.radians(-90), 0, 0)
    wick(1, 0, 0, -95); wick(1, 0, E, -100)
    hx, hy = 5.45, 6.75
    HER['root'].location = (hx, hy, 0); HER['root'].rotation_euler = (0, 0, math.radians(100)); breathe(HER, 0, E); stand_pose(HER, 0, hip=0.05)
    t_look = int(E * 0.66)
    head_key(HER, 0, math.radians(-4), 0); head_key(HER, t_look, math.radians(-4), 0)
    head_key(HER, t_look + 12, math.radians(4), math.radians(34)); head_key(HER, E, math.radians(4), math.radians(34))
    key(HER['spine'], 'rotation_euler', t_look, (0, 0, 0)); key(HER['spine'], 'rotation_euler', t_look + 12, (0, math.radians(22), 0)); key(HER['spine'], 'rotation_euler', E, (0, math.radians(22), 0))
    camkeys([(0, (5.95, 9.5, 1.62), (5.4, 6.6, 1.5)), (E, (5.85, 9.15, 1.6), (5.4, 6.6, 1.5))])
    dof(2.8, 2.0, target=HER['head'])
    bpy.ops.object.light_add(type='AREA', location=(11.0, 5.2, 1.9)); WL = bpy.context.object; WL.data.size = 1.2; WL.data.energy = 45; WL.data.color = (1.0, 0.62, 0.32)
    kit.aim(WL, HER['root'])                                                                      # the lit window's warmth on her face
    spots = [((-1.2, 14, 0), (-0.8, 11)), ((1.0, 22, 0), (0.6, 19))]
    for P, (pa, pb) in zip(INF, spots): shuffle(P, 0, E, pa, (*pb, 0), step=3)
    for P in INF[2:]: hide(P['root'])
    FOG_BOX = ((-14, -30, 0), (14, 60, 10))
else:
    raise SystemExit(f'unknown shot {SHOT}')

if FOG_BOX and FOG > 0:
    kit.volume_box(FOG_BOX[0], FOG_BOX[1], FOG, color=(0.75, 0.8, 0.9), aniso=0.55)
kit.ease_all()

# the screen positions of the places the 2D layer marks (the aerial shot): camera view space 0…1, y down
if SHOT == 'C':
    from bpy_extras.object_utils import world_to_camera_view
    def proj(p): v = world_to_camera_view(sc, cam, Vector(p)); return [round(v.x, 4), round(1 - v.y, 4)]
    views = []
    for f in (0, E):                                # the first and the last frame: the 2D layer moves the marks between them
        sc.frame_set(f); bpy.context.view_layer.update()
        pts = {'her': (HCX, HCY, 7.0), 'car': (-1.6, -1.0, 1.6), 'gate': (2.0, -8.0, 1.0),
               'yard_path': [(23.8, y, 0.3) for y in (HCY - 4, 3 * PLOT + 11, 2 * PLOT + 11, PLOT + 11, 6, 3.5)] + [(6.0, 3.5, 0.3), (-0.8, 0.5, 0.3)],
               'street_path': [(1.0, HCY - 2, 0.3)] + [(0.3, y, 0.3) for y in (75, 50, 25, 4)] + [(-0.8, 1.0, 0.3)],
               'infected': [tuple(P['root'].matrix_world.translation + Vector((0, 0, 2.6))) for P in INF]}
        views.append({k: ([proj(p) for p in v] if isinstance(v, list) else proj(v)) for k, v in pts.items()})
    os.makedirs(OUT, exist_ok=True); json.dump(views, open(os.path.join(OUT, 'screen.json'), 'w'))

TESTF = os.environ.get('TESTF')
if TESTF is not None:
    f = int(TESTF); kit.render(sc, OUT, f, f, PCT, SAMPLES, 1, vol=True)
else:
    kit.render(sc, OUT, F0, E, PCT, SAMPLES, STEP, vol=True)
