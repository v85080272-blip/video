# «По крышам» («Заражение», серия 4) in 3D: the roof of our 22-storey section and, attached to it, the next section five
# floors lower; a fire ladder down the wall between them; a city at night with a few lit windows, fires in the streets and,
# far off, a stadium under floodlights. The hunter, баба Валя, Пурга, and the two who blinked back — Красотка (a purple
# puffer, a white hood with bunny ears, the torch) and Соломия (a yellow raincoat, a braid, the radio).
# usage: python blender/rooftops.py <shot A..G> <seconds> <out dir> [percent 66] [samples 16] [step 2] [first frame 0]
#   A wide: the three on our roof, the torch blinking on the lower roof     B feet: walking, the torch on the ground
#   C edge: the glowing line two metres from the edge                       D ladder: down the fire ladder, three points
#   E meet: Красотка and Соломия on the lower roof                          F radio: the radio's screen, focus to the stadium
#   G five: the five of them at the far side, the city and the stadium
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
VOL = os.environ.get('VOL', '0') == '1'
NF = int(round(DURS * kit.FPS))                    # the shot's frames at 30 fps (rendered every STEP-th)
random.seed(17)
sc = kit.reset()
kit.people_materials()

# —— materials ——
def facade_material():
    """concrete panels with a grid of windows; at night only a few are lit, warm or cold, picked per building and cell"""
    m = bpy.data.materials.new('facade'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links
    b = N['Principled BSDF']; b.inputs['Roughness'].default_value = 0.9
    geo = N.new('ShaderNodeNewGeometry'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep.inputs[0])
    nrm = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Normal'], nrm.inputs[0])
    def op(o, a, bb=None, v=None):
        n = N.new('ShaderNodeMath'); n.operation = o
        (L.new(a, n.inputs[0]) if not isinstance(a, (int, float)) else n.inputs[0].__setattr__('default_value', a))
        if bb is not None: (L.new(bb, n.inputs[1]) if not isinstance(bb, (int, float)) else n.inputs[1].__setattr__('default_value', bb))
        return n.outputs[0]
    h = op('ADD', sep.outputs['X'], sep.outputs['Y'])
    hs, vs = op('DIVIDE', h, 1.4), op('DIVIDE', sep.outputs['Z'], 2.8)
    fh, fv = op('FRACT', hs), op('FRACT', vs)
    win = op('MULTIPLY', op('MULTIPLY', op('GREATER_THAN', fh, 0.22), op('LESS_THAN', fh, 0.74)), op('MULTIPLY', op('GREATER_THAN', fv, 0.32), op('LESS_THAN', fv, 0.8)))
    side = op('LESS_THAN', op('ABSOLUTE', nrm.outputs['Z']), 0.5)
    win = op('MULTIPLY', win, side)
    oi = N.new('ShaderNodeObjectInfo')
    cmb = N.new('ShaderNodeCombineXYZ'); L.new(op('FLOOR', hs), cmb.inputs[0]); L.new(op('FLOOR', vs), cmb.inputs[1]); L.new(op('MULTIPLY', oi.outputs['Random'], 977.0), cmb.inputs[2])
    wn = N.new('ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; L.new(cmb.outputs[0], wn.inputs['Vector'])
    lit = op('MULTIPLY', op('GREATER_THAN', wn.outputs['Value'], 0.93), win)
    mixc = N.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; L.new(win, mixc.inputs['Factor'])
    mixc.inputs['A'].default_value = (0.075, 0.075, 0.085, 1); mixc.inputs['B'].default_value = (0.012, 0.016, 0.026, 1)
    L.new(mixc.outputs['Result'], b.inputs['Base Color'])
    warm = N.new('ShaderNodeMix'); warm.data_type = 'RGBA'; L.new(wn.outputs['Color'], warm.inputs['Factor'])
    warm.inputs['A'].default_value = (1.0, 0.72, 0.42, 1); warm.inputs['B'].default_value = (0.75, 0.85, 1.0, 1)
    L.new(warm.outputs['Result'], b.inputs['Emission Color']); L.new(op('MULTIPLY', lit, 3.0), b.inputs['Emission Strength'])
    try: m.cycles.emission_sampling = 'NONE'
    except Exception: pass
    return m
FAC = facade_material()
BIT = mat('bitumen', (0.05, 0.05, 0.055), rough=0.95); PAR = mat('parapet', (0.22, 0.22, 0.23)); STEEL = mat('steel', (0.3, 0.32, 0.35), rough=0.4, metal=0.85)
RUST = mat('rust', (0.25, 0.12, 0.07), rough=0.7, metal=0.4); STREET = mat('street', (0.02, 0.02, 0.025)); FIRE = mat('fire', (1.0, 0.45, 0.12), emit=25)
FLOOD = mat('flood', (0.85, 0.92, 1.0), emit=80); STAND = mat('stand', (0.12, 0.13, 0.15)); PITCH = mat('pitch', (0.1, 0.32, 0.12), emit=0.6)
HUDY = mat('hud_yellow', (1.0, 0.78, 0.15), emit=6); HUDG = mat('hud_green', (0.3, 1.0, 0.5), emit=8)
for m_ in (FIRE, FLOOD, HUDY, HUDG, M['lens'], M['screen']):
    try: m_.cycles.emission_sampling = 'NONE'
    except Exception: pass

# —— the two sections of our building ——
H22, H17 = 0.0, -14.0
def section(x0, x1, top, name):
    box(((x0 + x1) / 2, 0, (top - 62) / 2), (x1 - x0, 12, top + 62), FAC, name=name)
    box(((x0 + x1) / 2, 0, top + 0.03), (x1 - x0 - 0.1, 11.9, 0.06), BIT, name=name + '_roof')
    for (cx, cy, sx, sy) in [((x0 + x1) / 2, -5.875, x1 - x0, 0.25), ((x0 + x1) / 2, 5.875, x1 - x0, 0.25), (x0 + 0.125, 0, 0.25, 12), (x1 - 0.125, 0, 0.25, 12)]:
        box((cx, cy, top + 0.25), (sx, sy, 0.5), PAR, name=name + '_parapet')
section(-9, 9, H22, 'S22'); section(9, 27, H17, 'S17')
# roof furniture: hatch boxes, vent stacks, an antenna mast with its bars, a satellite dish
def furniture(cx, top, seed):
    r = random.Random(seed)
    box((cx - 3, 0, top + 0.2), (1.0, 1.0, 0.4), STEEL, name='hatch')
    for k in range(3):
        x, y = cx + r.uniform(-6, 6), r.uniform(-4.5, 4.5)
        if abs(x - (cx - 3)) < 1.5 and abs(y) < 1.5: continue
        box((x, y, top + 0.45), (0.6, 0.6, 0.9), PAR, name='vent'); box((x, y, top + 0.95), (0.8, 0.8, 0.1), STEEL, name='ventcap')
    cyl((cx + 4, 3.5, top + 3), 0.05, 6, STEEL, verts=6, name='mast')
    for z, w in [(5.4, 1.6), (4.8, 1.2), (4.3, 0.8)]: box((cx + 4, 3.5, top + z), (w, 0.04, 0.04), STEEL, name='bar')
    cyl((cx - 6, -4, top + 0.9), 0.45, 0.06, STEEL, verts=16, rot=(math.radians(60), 0, 0), name='dish')
furniture(0, H22, 3); furniture(18, H17, 4)
# the fire ladder down the wall from our parapet to the lower roof, with the hoops over the top
LX, LY = 9.18, -3.0
for dy in (-0.25, 0.25): cyl((LX, LY + dy, (H17 + H22 + 1.0) / 2), 0.025, H22 + 1.0 - H17, RUST, verts=6, name='rail')
z = H17 + 0.3
while z < H22 + 0.9:
    cyl((LX, LY, z), 0.018, 0.5, RUST, verts=6, rot=(math.radians(90), 0, 0), name='rung'); z += 0.3
for dy in (-0.25, 0.25): cyl((LX - 0.25, LY + dy, H22 + 1.0), 0.025, 0.5, RUST, verts=6, rot=(0, math.radians(90), 0), name='hoop')

# —— the city: blocks with windows, the streets, a few fires; the stadium under floodlights, far off ——
rnd = random.Random(5)
for gx in range(-9, 10):
    for gy in range(-9, 10):
        x, y = gx * 45 + rnd.uniform(-8, 8), gy * 45 + rnd.uniform(-8, 8)
        if -40 < x < 70 and -35 < y < 35: continue
        if (x - 220) ** 2 + (y - 260) ** 2 < 95 ** 2: continue
        if rnd.random() < 0.25: continue
        w, d, h = rnd.uniform(14, 40), rnd.uniform(12, 18), rnd.choice([15, 25, 27, 42, 48, 62, 70])
        o = box((x, y, -62 + h / 2), (w, d, h), FAC, rot=(0, 0, rnd.choice([0, math.pi / 2])), name='block')
box((0, 0, -62.05), (1200, 1200, 0.1), STREET, name='ground')
for k in range(7):
    x, y = rnd.uniform(-300, 300), rnd.uniform(-300, 300)
    if -40 < x < 70 and -35 < y < 35: continue
    ico((x, y, -61), rnd.uniform(1.5, 3.0), FIRE, sub=1, name='fire')
    bpy.ops.object.light_add(type='POINT', location=(x, y, -58)); f = bpy.context.object; f.data.energy = 40000; f.data.color = (1, 0.45, 0.15); f.data.shadow_soft_size = 3
SX, SY = 220, 260
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=62, depth=16, location=(SX, SY, -54)); st = bpy.context.object; st.data.materials.append(STAND); st.scale = (1.0, 0.7, 1.0)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=50, depth=0.2, location=(SX, SY, -46)); pt = bpy.context.object; pt.data.materials.append(PITCH); pt.scale = (1.0, 0.66, 1.0)
for ax, ay in [(-58, -40), (58, -40), (-58, 40), (58, 40)]:
    cyl((SX + ax, SY + ay, -62 + 28), 0.6, 56, STEEL, verts=6, name='pylon'); box((SX + ax, SY + ay, -62 + 57), (8, 1.0, 4), FLOOD, name='flood')
    bpy.ops.object.light_add(type='SPOT', location=(SX + ax, SY + ay, -6)); s = bpy.context.object; s.data.energy = 6e6; s.data.spot_size = math.radians(60); s.data.color = (0.85, 0.92, 1.0)
    s.rotation_euler = (Vector((SX, SY, -46)) - s.location).to_track_quat('-Z', 'Y').to_euler()

# —— the sky: deep blue, stars, a low cold moon ——
w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True; nt = w.node_tree; bg = nt.nodes['Background']
tc = nt.nodes.new('ShaderNodeTexCoord'); vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 420
nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.035; nt.links.new(vor.outputs['Distance'], lt.inputs[0])
sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Generated'], sep.inputs[0])
up = nt.nodes.new('ShaderNodeMath'); up.operation = 'GREATER_THAN'; up.inputs[1].default_value = 0.08; nt.links.new(sep.outputs['Z'], up.inputs[0])
stars = nt.nodes.new('ShaderNodeMath'); stars.operation = 'MULTIPLY'; nt.links.new(lt.outputs[0], stars.inputs[0]); nt.links.new(up.outputs[0], stars.inputs[1])
mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; nt.links.new(stars.outputs[0], mx.inputs['Factor'])
mx.inputs['A'].default_value = (0.006, 0.009, 0.022, 1); mx.inputs['B'].default_value = (2.5, 2.5, 2.4, 1)
nt.links.new(mx.outputs['Result'], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
bpy.ops.object.light_add(type='SUN', location=(0, 0, 50)); moon = bpy.context.object; moon.data.energy = 0.12; moon.data.color = (0.6, 0.72, 1.0)
moon.rotation_euler = (math.radians(58), 0, math.radians(-120)); moon.data.angle = math.radians(1.5)

# —— the people ——
HUN = person(6.3, -1.0, H22, 'hunter', rot=math.radians(90))
GRA = person(5.6, 0.4, H22, 'granny', rot=math.radians(90))
DOG = person(6.5, 0.9, H22, 'dog', rot=math.radians(90))
KRA = person(15.2, -1.4, H17, 'krasotka', rot=math.radians(-90))
SOL = person(15.9, -0.4, H17, 'solomia', rot=math.radians(-90))
# Красотка's torch in her right hand; the hunter's torch; Соломия's radio
KT, KL = kit.torch_on(KRA['arms'][1], energy=900, beam_len=5, beam_r=1.0, name='ktorch'); KT.location = (0, -0.05, -0.58); KT.rotation_euler = (math.radians(-80), 0, 0)
HT, HL = kit.torch_on(HUN['arms'][1], energy=1100, beam_len=4, beam_r=0.9, name='htorch'); HT.location = (0, -0.05, -0.58); HT.rotation_euler = (math.radians(-80), 0, 0)
RAD = empty((0, -0.06, -0.6), 'radio', parent=SOL['arms'][1])
box((0, 0, 0.0), (0.09, 0.05, 0.18), M['radio'], parent=RAD); cyl((0.03, 0, 0.17), 0.006, 0.16, M['radio'], verts=4, parent=RAD)
box((0, -0.027, 0.03), (0.07, 0.004, 0.05), M['screen'], parent=RAD)
bpy.ops.object.text_add(location=(0, -0.031, 0.03), rotation=(math.radians(90), 0, 0)); tx = bpy.context.object; tx.data.body = '07:00 СТАДИОН'
tx.data.font = kit.font(); tx.data.size = 0.009; tx.data.align_x = 'CENTER'; tx.data.align_y = 'CENTER'; tx.data.materials.append(HUDG); tx.parent = RAD
bpy.ops.object.light_add(type='POINT', location=(0, -0.08, 0.04)); rl = bpy.context.object; rl.data.energy = 3; rl.data.color = (0.4, 1.0, 0.55); rl.data.shadow_soft_size = 0.05; rl.parent = RAD

def walk(P, f0, f1, p0, p1, swing=0.45, period=24):
    """root from p0 to p1 between f0 and f1, legs and arms swinging, a little bob"""
    for f in range(f0, f1 + 1, 3):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.025 * abs(math.sin(ph))))
        P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (swing * math.sin(ph + math.pi * i), 0, 0))
        for i, sh in enumerate(P['arms'][:1] if P is HUN else P['arms']): key(sh, 'rotation_euler', f, (-0.6 * swing * math.sin(ph + math.pi * i), 0, 0))
def dog_trot(P, f0, f1, p0, p1, period=14):
    for f in range(f0, f1 + 1, 2):
        u = (f - f0) / max(1, f1 - f0); ph = 2 * math.pi * (f - f0) / period
        P['root'].location = Vector(p0).lerp(Vector(p1), u) + Vector((0, 0, 0.02 * abs(math.sin(ph)))); P['root'].keyframe_insert('location', frame=f)
        for i, hp in enumerate(P['hips']): key(hp, 'rotation_euler', f, (0.5 * math.sin(ph + math.pi * ((i // 2 + i % 2) % 2)), 0, 0))
def beam_of(torch): return bpy.data.objects[torch['beam']]
def blink(L, frames, on_energy, beam=None):
    """switch a light on and off on the given (on, off) frame pairs"""
    L.data.energy = 0; L.data.keyframe_insert('energy', frame=0)
    for a, b in frames:
        L.data.energy = 0; L.data.keyframe_insert('energy', frame=a - 1); L.data.energy = on_energy; L.data.keyframe_insert('energy', frame=a)
        L.data.keyframe_insert('energy', frame=b); L.data.energy = 0; L.data.keyframe_insert('energy', frame=b + 1)
        if beam is not None:
            beam.hide_render = True; beam.keyframe_insert('hide_render', frame=a - 1); beam.hide_render = False; beam.keyframe_insert('hide_render', frame=a)
            beam.keyframe_insert('hide_render', frame=b); beam.hide_render = True; beam.keyframe_insert('hide_render', frame=b + 1)
    if beam is not None:
        beam.hide_render = True; beam.keyframe_insert('hide_render', frame=0)
    for fc in (L.data.animation_data.action.fcurves if hasattr(L.data.animation_data.action, 'fcurves') else []):
        for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'

cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); kit.col().objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.03; cam_data.clip_end = 2000
look = empty((0, 0, 0), 'look'); aim(cam, look)
def camkeys(keys):
    for f, p, q in keys: key(cam, 'location', f, Vector(p)); key(look, 'location', f, Vector(q))
fill = []
def fill_light(p, energy, color=(0.6, 0.7, 1.0), size=2.0):
    bpy.ops.object.light_add(type='AREA', location=p); a = bpy.context.object; a.data.energy = energy; a.data.size = size; a.data.color = color
    a.rotation_euler = (Vector((0, 0, -1))).to_track_quat('-Z', 'Y').to_euler(); fill.append(a); return a

E = NF
HL.data.energy = 0                              # the hunter's torch stays off unless a shot says so
beam_of(HT).hide_render = SHOT != 'B'
if SHOT == 'A':     # behind the three on our roof; on the lower roof a torch blinks three times; a slow push
    cam_data.lens = 24
    camkeys([(0, (3.6, -3.9, 2.6), (15.5, -0.8, -4.6)), (E, (4.4, -3.4, 2.4), (15.5, -0.8, -5.0))])
    KT.rotation_euler = (math.radians(-130), 0, 0)       # up at us
    s = int(E * 0.35); blink(KL, [(s, s + 6), (s + 12, s + 18), (s + 24, s + 30), (s + 44, E + 5)], 1600, beam_of(KT))
    key(HUN['head'], 'rotation_euler', 0, (0, 0, 0)); key(HUN['head'], 'rotation_euler', int(E * 0.5), (math.radians(-18), 0, 0))
    fill_light((4, -3, 4), 60)
elif SHOT == 'B':   # low, ahead of him: he walks towards us at a slow pace, the torch pool just ahead of his boots; the dog beside
    cam_data.lens = 28
    HUN['root'].rotation_euler = (0, 0, math.radians(90)); DOG['root'].rotation_euler = (0, 0, math.radians(90))
    walk(HUN, 0, E, (-1.2, -1.5, H22), (1.6, -1.5, H22)); dog_trot(DOG, 0, E, (-1.6, -0.75, H22), (1.2, -0.75, H22))
    HUN['arms'][1].rotation_euler = (math.radians(-35), 0, 0); HL.data.energy = 1100; HT.rotation_euler = (math.radians(-35), 0, 0)
    camkeys([(0, (4.0, -2.5, 0.45), (0.0, -1.4, 0.65)), (E, (3.7, -2.4, 0.42), (1.4, -1.4, 0.6))])
    GRA['root'].location = (-3, 0.5, H22)
    fill_light((2.5, -3, 3), 40)
elif SHOT == 'C':   # over the corner of the parapet: the edge, the drop to the lower roof, a glowing line two metres in from the edge
    cam_data.lens = 20
    for yy in range(-11, 12, 2): box((6.65, yy * 0.5, H22 + 0.07), (0.07, 0.55, 0.02), HUDY, name='line')
    bpy.ops.object.text_add(location=(7.7, -4.2, H22 + 0.08)); t2 = bpy.context.object; t2.data.body = '2 м'; t2.data.font = kit.font(); t2.data.size = 0.45; t2.data.materials.append(HUDY)
    t2.rotation_euler = (0, 0, math.radians(90))
    for P, y0, x in [(HUN, -4.5, 5.4), (GRA, -5.4, 4.6)]:
        P['root'].rotation_euler = (0, 0, math.radians(180)); walk(P, 0, E, (x, y0, H22), (x, y0 + 3.0, H22))
    DOG['root'].rotation_euler = (0, 0, math.radians(180)); dog_trot(DOG, 0, E, (6.0, -5.0, H22), (6.0, -1.7, H22))
    camkeys([(0, (10.6, -7.6, 3.2), (6.2, -1.0, -0.6)), (E, (10.3, -7.0, 3.0), (6.0, 0.0, -0.8))])
    fill_light((7, -3, 4), 50)
elif SHOT == 'D':   # from the lower roof, looking up the wall: he climbs down facing the ladder; two hands and a foot glow where they hold
    cam_data.lens = 26
    HUN['root'].rotation_euler = (0, 0, math.radians(-90))
    z0, z1 = -5.0, -8.6
    marks = [ico((0, 0, 0), 0.06, HUDG, sub=2, name=f'grip{i}') for i in range(3)]
    for f in range(0, E + 1, 2):
        u = f / max(1, E); step = int(u * 12); ph = (u * 12) % 1
        zz = z0 + (z1 - z0) * (step + ph * ph * (3 - 2 * ph)) / 12          # rung by rung
        HUN['root'].location = Vector((LX + 0.32, LY, zz)); HUN['root'].keyframe_insert('location', frame=f)
        a = step % 2
        key(HUN['arms'][0], 'rotation_euler', f, (math.radians(-150 + 20 * a), 0, 0)); key(HUN['arms'][1], 'rotation_euler', f, (math.radians(-130 - 20 * a), 0, 0))
        key(HUN['hips'][0], 'rotation_euler', f, (math.radians(-40 + 35 * a), 0, 0)); key(HUN['hips'][1], 'rotation_euler', f, (math.radians(-5 - 35 * a), 0, 0))
        hands = [Vector((LX, LY - 0.22, zz + 1.95 + 0.15 * a)), Vector((LX, LY + 0.22, zz + 1.85 - 0.15 * a))]
        foot = Vector((LX, LY + (0.12 if a else -0.12), zz + 0.12))
        for mk, p in zip(marks, hands + [foot]): key(mk, 'location', f, p)
    cam_data.lens = 28
    camkeys([(0, (11.2, -4.8, H17 + 1.2), (LX, LY, -6.4)), (E, (11.0, -4.6, H17 + 1.15), (LX, LY, -7.8))])
    KRA['root'].location = (12.2, -1.2, H17); SOL['root'].location = (12.9, -0.4, H17)
    KT.rotation_euler = (math.radians(-130), 0, math.radians(20)); KL.data.energy = 900
    fill_light((11, -4, H17 + 4), 120)
elif SHOT == 'E':   # the lower roof: the two of them, lit by the torch pointed down and the radio's glow; they turn to us
    cam_data.lens = 30
    KRA['root'].location = (16.4, -0.9, H17); SOL['root'].location = (15.4, 0.3, H17)
    KT.rotation_euler = (math.radians(-60), 0, 0); KL.data.energy = 700
    key(KRA['head'], 'rotation_euler', 0, (0, 0, math.radians(30))); key(KRA['head'], 'rotation_euler', int(E * 0.3), (0, 0, 0))
    key(SOL['head'], 'rotation_euler', int(E * 0.4), (0, 0, math.radians(25))); key(SOL['head'], 'rotation_euler', int(E * 0.7), (0, 0, 0))
    SOL['arms'][1].rotation_euler = (math.radians(-70), 0, 0)
    HUN['root'].rotation_euler = (0, 0, math.radians(90)); walk(HUN, 0, int(E * 0.6), (11.5, -1.8, H17), (13.6, -1.6, H17))
    camkeys([(0, (13.5, -3.7, H17 + 1.5), (15.9, -0.3, H17 + 1.25)), (E, (13.9, -3.3, H17 + 1.45), (15.9, -0.3, H17 + 1.25))])
    fill_light((14.5, -2.5, H17 + 3.2), 70, color=(0.75, 0.8, 1.0))
elif SHOT == 'F':   # close on the radio in Соломия's hand: its screen; then the focus goes to the stadium far behind
    cam_data.lens = 50
    KRA['root'].location = (17.6, -2.6, H17); SOL['root'].location = (16.7, -0.2, H17)
    SOL['arms'][1].rotation_euler = (math.radians(-80), 0, math.radians(10)); KL.data.energy = 500; KT.rotation_euler = (math.radians(-70), 0, 0)
    bpy.context.view_layer.update()
    rp = RAD.matrix_world.translation.copy()
    d = (Vector((SX, SY, -50)) - rp).normalized()
    side = Vector((-d.y, d.x, 0)).normalized() * 0.25
    camkeys([(0, tuple(rp - d * 1.0 + side + Vector((0, 0, 0.06))), tuple(rp)), (E, tuple(rp - d * 0.92 + side + Vector((0, 0, 0.07))), tuple(rp + d * 3))])
    cam_data.dof.use_dof = True; cam_data.dof.aperture_fstop = 2.2
    cam_data.dof.focus_distance = 1.0; cam_data.dof.keyframe_insert('focus_distance', frame=int(E * 0.45))
    cam_data.dof.focus_distance = 300; cam_data.dof.keyframe_insert('focus_distance', frame=int(E * 0.8))
    fill_light(tuple(rp + Vector((-0.6, -0.8, 0.8))), 8, size=0.8)
else:               # G: the five at the far side of the lower roof, a safe way from the edge, the city and the stadium before them
    cam_data.lens = 24
    for P, p in [(HUN, (21.5, 1.0)), (GRA, (20.8, 0.2)), (DOG, (21.9, 1.8)), (KRA, (22.3, -0.4)), (SOL, (21.0, 2.4))]:
        P['root'].location = (*p, H17); P['root'].rotation_euler = (0, 0, math.radians(135))
    KT.rotation_euler = (math.radians(-60), 0, 0); KL.data.energy = 500
    camkeys([(0, (18.8, -2.0, H17 + 1.7), (60, 60, -36)), (E, (18.0, -2.9, H17 + 2.3), (60, 60, -38))])
    fill_light((19.5, -1.5, H17 + 3.5), 50)
if VOL:
    kit.volume_box((-12, -9, -16), (30, 9, 6), 0.012)
kit.ease_all()
kit.render(sc, OUT, F0, NF, PCT, SAMPLES, STEP)
