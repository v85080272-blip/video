# The 3D test of «Заражение», серия 3: a Soviet panel-block stairwell in low-poly, built and rendered by Blender (bpy)
# on the CPU with Cycles. Three shots for the voice: s1 — looking down the gap between the flights from the 15th floor,
# the railings zigzagging down into the fog, a light far below; s2 — the 1st floor, the lift standing open with its light
# flickering and someone inside; s3 — the hunter, баба Валя and Пурга on the 15th-floor landing, the torch beam going
# down the gap, the old woman crossing herself, the dog peering over the rail.
# usage: python blender/stairwell.py <shot s1|s2|s3> <first frame> <last frame> <out dir> [percent] [samples]
import bpy, math, random, sys, os, time
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
SHOT, F0, F1, OUT = args[0], int(args[1]), int(args[2]), args[3]
PCT = int(args[4]) if len(args) > 4 else 75
SAMPLES = int(args[5]) if len(args) > 5 else 16
STEP = int(args[6]) if len(args) > 6 else 1      # 2: every other frame (15 fps), the 2D pass interpolates
VOL = os.environ.get('VOL', '0') == '1'          # VOL=1: the haze in the air, the dust in the light, depth of field
FPS = 30
T_START = time.time()
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
col_main = sc.collection

# —— materials ——
def mat(name, color, emit=0.0, rough=0.85, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m
M = {
    'wall_lo': mat('wall_lo', (0.16, 0.3, 0.22)), 'wall_hi': mat('wall_hi', (0.62, 0.6, 0.54)), 'band': mat('band', (0.07, 0.12, 0.1)),
    'concrete': mat('concrete', (0.38, 0.36, 0.33)), 'step_edge': mat('step_edge', (0.18, 0.17, 0.16)), 'rail': mat('rail', (0.22, 0.12, 0.06), rough=0.5),
    'baluster': mat('baluster', (0.06, 0.07, 0.08), rough=0.6, metal=0.6), 'door': mat('door', (0.18, 0.12, 0.08)), 'door2': mat('door2', (0.28, 0.07, 0.06)),
    'steel': mat('steel', (0.35, 0.37, 0.4), rough=0.35, metal=0.9), 'cabin': mat('cabin', (0.55, 0.5, 0.42)), 'cabin_light': mat('cabin_light', (1.0, 0.95, 0.85), emit=6),
    'window': mat('window', (0.35, 0.5, 0.8), emit=1.2), 'bulb': mat('bulb', (1.0, 0.8, 0.5), emit=12), 'number': mat('number', (0.06, 0.07, 0.09)),
    'jacket': mat('jacket', (0.85, 0.3, 0.05)), 'pants': mat('pants', (0.1, 0.16, 0.08)), 'boots': mat('boots', (0.05, 0.04, 0.03)), 'skin': mat('skin', (0.8, 0.55, 0.42)),
    'beard': mat('beard', (0.22, 0.11, 0.05)), 'hat': mat('hat', (0.4, 0.26, 0.15)), 'fur': mat('fur', (0.72, 0.6, 0.45)), 'pack': mat('pack', (0.12, 0.25, 0.14)),
    'robe': mat('robe', (0.32, 0.14, 0.42)), 'scarf': mat('scarf', (0.75, 0.08, 0.06)), 'pan': mat('pan', (0.05, 0.05, 0.06), rough=0.3, metal=0.8), 'handle': mat('handle', (0.25, 0.14, 0.07)),
    'dog_w': mat('dog_w', (0.85, 0.84, 0.8)), 'dog_g': mat('dog_g', (0.32, 0.33, 0.35)), 'nose': mat('nose', (0.02, 0.02, 0.03)), 'collar': mat('collar', (0.7, 0.08, 0.06)),
    'z_skin': mat('z_skin', (0.07, 0.09, 0.06)), 'z_shirt': mat('z_shirt', (0.03, 0.025, 0.035)), 'torch': mat('torch', (0.1, 0.1, 0.12), metal=0.6), 'lens': mat('lens', (1.0, 0.92, 0.75), emit=30),
}

def box(loc, size, m, rot=(0, 0, 0), name='box', parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot); o = bpy.context.object; o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2); o.data.materials.append(m)
    if parent: o.parent = parent
    return o
def cyl(loc, r, h, m, verts=8, rot=(0, 0, 0), name='cyl', r2=None, parent=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.data.materials.append(m)
    if parent: o.parent = parent
    return o
def ico(loc, r, m, sub=1, name='ico', scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc); o = bpy.context.object; o.name = name
    o.scale = scale; o.data.materials.append(m)
    if parent: o.parent = parent
    return o
def empty(loc, name, parent=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); col_main.objects.link(o); o.location = loc; o.rotation_euler = rot
    if parent: o.parent = parent
    return o

# —— the stairwell: per floor a landing, two flights with a 0.3 m gap between them, a half-landing with a window ——
FH, W0, W1, DEPTH = 2.8, -2.6, 2.6, 6.0
NFLOORS, TOP = 15, 15
STEPS, RUN, RISE = 9, 3.0 / 9, 1.4 / 9
GAP = 0.42                 # a wide gap between the flights, so you can look down it
def floor_module(k):
    z = (k - 1) * FH
    box((0, 0.7, z - 0.1), (W1 - W0, 1.4, 0.2), M['concrete'], name=f'land{k}')
    box((0, 5.2, z + 1.4 - 0.1), (W1 - W0, 1.6, 0.2), M['concrete'], name=f'mid{k}')
    if k == 1:                   # the ground floor is an open hall in front of the lift: its flights start from the half-landing
        box((0, 3.0, z - 0.1), (W1 - W0, 3.2, 0.2), M['concrete'], name='hall')
    for f, (xa, xb, y0, dirn, z0) in enumerate([(W0 + 0.1, -GAP, 1.4, 1, z), (GAP, W1 - 0.1, 4.4, -1, z + 1.4)]):
        if k == 1 and f == 0:
            continue
        cx, wx = (xa + xb) / 2, xb - xa
        for i in range(STEPS):
            y = y0 + dirn * (i + 0.5) * RUN
            box((cx, y, z0 + (i + 0.5) * RISE), (wx, RUN, RISE), M['concrete'], name='step')
            box((cx, y - dirn * RUN * 0.45, z0 + (i + 1) * RISE - 0.01), (wx, 0.03, 0.02), M['step_edge'], name='nose')
        # the slab under the flight
        ln = math.hypot(3.0, 1.4)
        ang = math.atan2(1.4, 3.0) * dirn
        box((cx, y0 + dirn * 1.5, z0 + 0.7 - 0.18), (wx, ln, 0.16), M['concrete'], rot=(ang, 0, 0), name='slab')
        # the railing along the gap: balusters and the wooden handrail
        rx = -GAP + 0.03 if f == 0 else GAP - 0.03
        for i in range(STEPS):
            y = y0 + dirn * (i + 0.5) * RUN
            box((rx, y, z0 + (i + 0.5) * RISE + 0.45), (0.025, 0.025, 0.9), M['baluster'], name='bal')
        box((rx, y0 + dirn * 1.5, z0 + 0.7 + 0.92), (0.06, ln, 0.05), M['rail'], rot=(ang, 0, 0), name='rail')
    # the railing round the end of the gap at the half-landing and at the floor landing
    box((0, 4.42, z + 1.4 + 0.9), (2 * GAP + 0.06, 0.06, 0.05), M['rail'], name='railend')
    if k > 1: box((0, 1.38, z + 0.9), (2 * GAP + 0.06, 0.06, 0.05), M['rail'], name='railend2')
    # the walls round it: green paint below, whitewash above, a dark band between; the stairwell window at the half-landing
    # the front wall in two pieces either side of the lift opening (x −1.1…−0.1), and a lintel over it
    LX0, LX1 = -1.1, -0.1
    for (x, y, sx, sy, zlo) in [(W0 - 0.1, DEPTH / 2, 0.2, DEPTH, 0), (W1 + 0.1, DEPTH / 2, 0.2, DEPTH, 0), (0, DEPTH + 0.1, W1 - W0 + 0.4, 0.2, 0),
                                ((W0 - 0.2 + LX0) / 2, -0.1, LX0 - W0 + 0.2, 0.2, 0), ((LX1 + W1 + 0.2) / 2, -0.1, W1 + 0.2 - LX1, 0.2, 0)]:
        box((x, y, z + 0.75), (sx, sy, 1.5), M['wall_lo'], name='wl')
        box((x, y, z + 0.75 + 1.5 / 2 + 0.03), (sx * 1.01, sy * 1.01, 0.06), M['band'], name='wb')
        box((x, y, z + 1.5 + (FH - 1.5) / 2), (sx, sy, FH - 1.5), M['wall_hi'], name='wh')
    box(((LX0 + LX1) / 2, -0.1, z + 2.1 + (FH - 2.1) / 2), (LX1 - LX0, 0.2, FH - 2.1), M['wall_hi'], name='lintel')
    box((0, DEPTH - 0.02, z + 1.4 + 1.3), (1.2, 0.05, 1.0), M['window'], name=f'win{k}')
    # the floor number stencilled on the wall beside the doors, a lamp cage on the wall (lit on a few floors)
    bpy.ops.object.text_add(location=(1.6, 0.02, z + 1.6), rotation=(math.pi / 2, 0, 0)); t = bpy.context.object; t.data.body = str(k)
    t.data.size = 0.55; t.data.extrude = 0.01; t.data.align_x = 'CENTER'; t.data.materials.append(M['number'])
    lit = k in (3, 8, 12)
    ico((0, DEPTH - 0.12, z + 1.4 + 2.15), 0.09, M['bulb'] if lit else M['steel'], name='bulb')
    if lit:
        bpy.ops.object.light_add(type='POINT', location=(0, DEPTH - 0.4, z + 1.4 + 2.1)); L = bpy.context.object; L.data.energy = 220; L.data.color = (1, 0.72, 0.42); L.data.shadow_soft_size = 0.1
    # flat doors on the landing (two flats each side), the lift doors in the middle
    for dx in (-2.0, 2.0):
        box((dx, 0.03, z + 1.0), (0.9, 0.06, 2.0), M['door'] if (k + int(dx)) % 3 else M['door2'], name='door')
    box((-0.6, 0.03, z + 1.05), (1.0, 0.07, 2.1), M['steel'], name='liftdoor')

for k in range(1, NFLOORS + 1):
    floor_module(k)
# the lift on the 1st floor stands open: the leaves slid aside, the cabin lit, flickering
bpy.data.objects.remove(bpy.data.objects[[o.name for o in bpy.data.objects if o.name.startswith('liftdoor')][0]])
box((-1.18, 0.0, 1.05), (0.25, 0.08, 2.1), M['steel'], name='leafL'); box((-0.02, 0.0, 1.05), (0.25, 0.08, 2.1), M['steel'], name='leafR')
box((-0.6, -0.75, -0.05), (1.1, 1.4, 0.1), M['cabin'], name='cabfloor'); box((-0.6, -1.45, 1.1), (1.1, 0.05, 2.3), M['cabin'], name='cabback')
box((-1.15, -0.75, 1.1), (0.05, 1.4, 2.3), M['cabin'], name='cabL'); box((-0.05, -0.75, 1.1), (0.05, 1.4, 2.3), M['cabin'], name='cabR')
box((-0.6, -0.75, 2.22), (1.1, 1.4, 0.05), M['cabin'], name='cabtop'); cl = box((-0.6, -0.75, 2.18), (0.5, 0.3, 0.02), M['cabin_light'], name='cablight')
bpy.ops.object.light_add(type='AREA', location=(-0.6, -1.35, 1.6), rotation=(math.radians(-90), 0, 0)); LIFT = bpy.context.object; LIFT.rotation_euler = (math.radians(90), 0, 0); LIFT.data.energy = 320; LIFT.data.size = 0.9; LIFT.data.color = (0.92, 0.96, 1.0)
# flicker: the cabin light dips and catches a few times over the shot
def flicker(obj_light, emit_mat, f0, f1):
    nodes = emit_mat.node_tree.nodes['Principled BSDF']
    for f in range(f0, f1 + 1, 2):
        on = 0.15 if random.random() < 0.18 else 1.0
        obj_light.data.energy = 260 * on; obj_light.data.keyframe_insert('energy', frame=f)
        nodes.inputs['Emission Strength'].default_value = 6 * on; nodes.inputs['Emission Strength'].keyframe_insert('default_value', frame=f)
flicker(LIFT, M['cabin_light'], 0, 400)

# —— the people: low-poly mannequins with our heroes' marks ——
def person(x, y, z, kind, rot=0.0):
    root = empty((x, y, z), kind, rot=(0, 0, rot))
    if kind == 'hunter':
        for dx in (-0.11, 0.11):
            cyl((dx, 0, 0.42), 0.085, 0.84, M['pants'], parent=root); cyl((dx, -0.04, 0.05), 0.09, 0.1, M['boots'], parent=root)
        cyl((0, 0, 1.17), 0.25, 0.72, M['jacket'], r2=0.21, parent=root, name='torso')
        box((0, 0.24, 1.2), (0.34, 0.2, 0.5), M['pack'], parent=root)
        head = empty((0, 0, 1.62), 'head', parent=root)
        ico((0, 0, 0.1), 0.17, M['skin'], parent=head); ico((0, -0.09, 0.01), 0.14, M['beard'], parent=head, scale=(1, 0.8, 1))
        cyl((0, 0, 0.27), 0.19, 0.16, M['hat'], verts=10, parent=head); cyl((0, 0, 0.2), 0.21, 0.07, M['fur'], verts=10, parent=head)
        arms = []
        for i, dx in enumerate((-0.3, 0.3)):
            sh = empty((dx, 0, 1.45), f'shoulder{i}', parent=root)
            cyl((0, 0, -0.28), 0.07, 0.56, M['jacket'], verts=6, parent=sh); ico((0, 0, -0.58), 0.06, M['skin'], parent=sh)
            arms.append(sh)
        return root, head, arms
    if kind == 'granny':
        cyl((0, 0, 0.55), 0.34, 1.1, M['robe'], r2=0.22, verts=10, parent=root)
        head = empty((0, 0, 1.28), 'ghead', parent=root)
        ico((0, 0, 0.0), 0.16, M['skin'], parent=head); ico((0, 0.02, 0.05), 0.18, M['scarf'], parent=head, scale=(1.05, 1.05, 0.9))
        ico((0, -0.13, -0.02), 0.03, M['nose'], parent=head)
        arms = []
        for i, dx in enumerate((-0.26, 0.26)):
            sh = empty((dx, 0, 1.08), f'gshoulder{i}', parent=root)
            cyl((0, 0, -0.24), 0.065, 0.48, M['robe'], verts=6, parent=sh); ico((0, 0, -0.5), 0.055, M['skin'], parent=sh)
            arms.append(sh)
        pan = empty((0, 0, -0.5), 'pan', parent=arms[1])
        cyl((0, 0, -0.18), 0.02, 0.3, M['handle'], verts=6, parent=pan); cyl((0, 0, -0.42), 0.14, 0.04, M['pan'], verts=14, rot=(math.pi / 2, 0, 0), parent=pan)
        return root, head, arms
    if kind == 'dog':
        ico((0, 0.02, 0.46), 0.2, M['dog_w'], sub=2, parent=root, scale=(0.75, 1.75, 0.85))
        ico((0, -0.24, 0.48), 0.16, M['dog_w'], sub=2, parent=root, scale=(0.8, 1.0, 1.1))
        ico((0, 0.05, 0.6), 0.16, M['dog_g'], sub=2, parent=root, scale=(0.7, 1.6, 0.4))
        for dx in (-0.08, 0.08):
            for dy in (-0.26, 0.24): cyl((dx, dy, 0.2), 0.04, 0.4, M['dog_w'], verts=6, parent=root)
        head = empty((0, -0.36, 0.7), 'dhead', parent=root)
        ico((0, 0, 0), 0.13, M['dog_w'], sub=2, parent=head, scale=(0.95, 1.0, 0.9)); ico((0, 0, 0.04), 0.12, M['dog_g'], sub=2, parent=head, scale=(0.9, 0.8, 0.55))
        ico((0, -0.15, -0.04), 0.07, M['dog_w'], sub=1, parent=head, scale=(0.8, 1.5, 0.75)); ico((0, -0.25, -0.03), 0.028, M['nose'], parent=head)
        for dx in (-0.07, 0.07): cyl((dx, 0.0, 0.15), 0.045, 0.14, M['dog_g'], verts=4, r2=0.0, parent=head)
        for dx in (-0.045, 0.045): ico((dx, -0.1, 0.03), 0.016, M['nose'], parent=head)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.035, location=(0, 0.3, 0.68), rotation=(0, math.pi / 2, 0)); tl = bpy.context.object
        tl.data.materials.append(M['dog_g']); tl.parent = root
        box((0, -0.3, 0.56), (0.24, 0.05, 0.06), M['collar'], parent=root)
        return root, head, []
    if kind == 'zombie':
        for dx in (-0.1, 0.1): cyl((dx, 0, 0.42), 0.08, 0.84, M['pants'], parent=root)
        t = cyl((0, -0.04, 1.12), 0.23, 0.68, M['z_shirt'], r2=0.2, verts=7, parent=root); t.rotation_euler = (0.25, 0, 0)
        head = empty((0, -0.2, 1.5), 'zhead', parent=root, rot=(0.5, 0, 0.2))
        ico((0, 0, 0), 0.16, M['z_skin'], parent=head)
        arms = []
        for i, dx in enumerate((-0.27, 0.27)):
            sh = empty((dx, -0.08, 1.38), f'zshoulder{i}', parent=root, rot=(0.1, 0, 0))
            cyl((0, 0, -0.3), 0.06, 0.6, M['z_skin'], verts=6, parent=sh); arms.append(sh)
        return root, head, arms

ZT = (TOP - 1) * FH        # the 15th floor level
H_root, H_head, H_arms = person(-1.25, 0.75, ZT, 'hunter', rot=math.radians(-150))
G_root, G_head, G_arms = person(-0.55, 0.42, ZT, 'granny', rot=math.radians(-160))
D_root, D_head, _ = person(0.0, 0.95, ZT, 'dog', rot=math.radians(180))     # at the end of the gap, where no balusters are: she looks down under the handrail
H_arms[1].rotation_euler = (math.radians(-55), 0, math.radians(-15))
Z_root, Z_head, Z_arms = person(-0.6, -0.85, 0.0, 'zombie', rot=math.radians(180))
Z_arms[0].rotation_euler = (-0.45, 0, 0.12); Z_arms[1].rotation_euler = (0.05, 0, -0.08)   # one arm half-raised, as if reaching
# the torch: a spot by the hunter's hand aimed down the gap (a track-to constraint on an empty), and its visible beam
def aim(obj, target):
    c = obj.constraints.new('TRACK_TO'); c.target = target; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
TORCH_AT = Vector((-0.95, 1.05, ZT + 1.12))
torch_target = empty((0.0, 2.6, ZT - 6.0), 'torch_target')
torch = empty(tuple(TORCH_AT), 'torch'); aim(torch, torch_target)
cyl((0, 0, 0.09), 0.04, 0.18, M['torch'], verts=8, parent=torch); cyl((0, 0, -0.005), 0.036, 0.01, M['lens'], verts=8, parent=torch)
bpy.ops.object.light_add(type='SPOT', location=(0, 0, 0)); TL = bpy.context.object; TL.parent = torch
TL.data.energy = 1600; TL.data.spot_size = math.radians(24); TL.data.spot_blend = 0.5; TL.data.color = (1, 0.92, 0.75); TL.data.shadow_soft_size = 0.02
bm = bpy.data.materials.new('beam'); bm.use_nodes = True; nt = bm.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial'); mix = nt.nodes.new('ShaderNodeMixShader'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); em = nt.nodes.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (1, 0.88, 0.65, 1); em.inputs['Strength'].default_value = 0.8
lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.9, 0.9, 0.9, 1); ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
nt.links.new(lw.outputs['Facing'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
nt.links.new(em.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs['Surface'])
BEAM_L = 7.0
beam = cyl((0, 0, -BEAM_L / 2), 1.5, BEAM_L, bm, verts=20, r2=0.035, parent=torch, name='beam'); beam.visible_shadow = False

# a dim cold fill on the 15th-floor landing, so the three read in the dark
bpy.ops.object.light_add(type='AREA', location=(0.2, 0.7, ZT + 2.6)); fl = bpy.context.object; fl.data.energy = 70; fl.data.size = 2.0; fl.data.color = (0.6, 0.7, 1.0)
# —— the light outside: a cold dawn through the stairwell windows; the world dark ——
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.026, 0.045, 1)
for k in (5, 10, 14):
    bpy.ops.object.light_add(type='AREA', location=(0, DEPTH + 0.3, (k - 1) * FH + 2.7), rotation=(math.radians(-90), 0, 0)); a = bpy.context.object
    a.data.energy = 260; a.data.size = 1.4; a.data.color = (0.55, 0.68, 1.0)

# —— the air: a thin homogeneous haze that shows the light (the lift's glow, the torch beam, the depth of the shaft),
# and dust motes drifting in it ——
def volume_box(lo, hi, density, color=(0.85, 0.9, 1.0), aniso=0.45):
    vm = bpy.data.materials.new('haze'); vm.use_nodes = True; nt = vm.node_tree; nt.nodes.clear()
    pv = nt.nodes.new('ShaderNodeVolumePrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    pv.inputs['Density'].default_value = density; pv.inputs['Anisotropy'].default_value = aniso; pv.inputs['Color'].default_value = (*color, 1)
    nt.links.new(pv.outputs['Volume'], out.inputs['Volume'])
    c = [(a + b) / 2 for a, b in zip(lo, hi)]; sz = [b - a for a, b in zip(lo, hi)]
    o = box(tuple(c), tuple(sz), vm, name='haze'); o.visible_shadow = False
    return o
def dust(n, lo, hi, frames, seed=11):
    rnd = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0); proto = bpy.context.object; me = proto.data
    # dust glows when the light is behind it: mostly translucent, a little diffuse
    dm = bpy.data.materials.new('dust'); dm.use_nodes = True; nt = dm.node_tree; nt.nodes.clear()
    tr = nt.nodes.new('ShaderNodeBsdfTranslucent'); df = nt.nodes.new('ShaderNodeBsdfDiffuse'); mx = nt.nodes.new('ShaderNodeMixShader'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr.inputs['Color'].default_value = (0.8, 0.77, 0.72, 1); df.inputs['Color'].default_value = (0.9, 0.88, 0.84, 1); mx.inputs['Fac'].default_value = 0.25
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(df.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs['Surface'])
    me.materials.append(dm); bpy.data.objects.remove(proto)
    for i in range(n):
        o = bpy.data.objects.new('mote', me); col_main.objects.link(o)
        r = rnd.uniform(0.003, 0.009); o.scale = (r, r, r); o.visible_shadow = False
        p = Vector([rnd.uniform(a, b) for a, b in zip(lo, hi)])
        v = Vector((rnd.gauss(0, 0.02), rnd.gauss(0, 0.02), rnd.gauss(-0.006, 0.01)))     # metres per second
        w = Vector((rnd.gauss(0, 0.015), rnd.gauss(0, 0.015), rnd.gauss(0, 0.01)))
        for f in (0, frames // 2, frames):
            u = f / 30
            o.location = p + v * u + (w if f == frames // 2 else Vector())
            o.keyframe_insert('location', frame=f)
if VOL:
    if SHOT == 's2':
        volume_box((-1.9, -1.45, -0.05), (0.9, 3.6, 2.6), 0.08)          # only where the lift light reaches: no noisy haze in the dark
        dust(380, (-1.3, -1.35, 0.05), (0.3, 2.6, 2.2), 110)
    else:
        volume_box((W0, 0.0, -0.2), (W1, DEPTH, ZT + FH), 0.018 if SHOT == 's1' else 0.03)
        if SHOT == 's1': dust(500, (-1.0, 0.9, ZT - 1.5), (1.0, 2.6, ZT + 2.0), 110, seed=12)
        else: dust(600, (-1.4, 0.3, ZT + 0.1), (0.9, 2.4, ZT + 2.4), 150, seed=13)

# —— the cameras and the actors' motion, frame by frame (30 fps) ——
cam_data = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_data); col_main.objects.link(cam); sc.camera = cam
cam_data.clip_start = 0.05; cam_data.clip_end = 120
def key(obj, path, f, val):
    setattr(obj, path, val); obj.keyframe_insert(path, frame=f)
if SHOT == 's1':                 # down the gap from the 15th floor: a slow push down, a little roll
    cam_data.lens = 18
    cam_data.dof.use_dof = VOL; cam_data.dof.focus_distance = 7.0; cam_data.dof.aperture_fstop = 4.0
    key(cam, 'location', 0, Vector((0.0, 1.6, ZT + 2.2))); key(cam, 'rotation_euler', 0, (math.radians(14), 0, math.radians(0)))
    key(cam, 'location', 100, Vector((0.02, 1.7, ZT + 1.6))); key(cam, 'rotation_euler', 100, (math.radians(9), 0, math.radians(6)))
elif SHOT == 's2':               # the 1st floor: the open lift from the landing, a slow dolly in; someone inside
    cam_data.lens = 28
    cam_data.dof.use_dof = VOL; cam_data.dof.focus_object = Z_head; cam_data.dof.aperture_fstop = 2.4
    key(cam, 'location', 0, Vector((0.1, 4.0, 1.4))); key(cam, 'rotation_euler', 0, (math.radians(88), 0, math.radians(171)))   # in the gap, clear of flight B (x ≥ 0.42)
    key(cam, 'location', 100, Vector((0.15, 3.0, 1.35))); key(cam, 'rotation_euler', 100, (math.radians(88), 0, math.radians(168)))
    key(Z_head, 'rotation_euler', 0, (0.35, 0, 0)); key(Z_head, 'rotation_euler', 55, (0.35, 0, 0)); key(Z_head, 'rotation_euler', 62, (0.45, 0, math.radians(-35))); key(Z_head, 'rotation_euler', 110, (0.45, 0, math.radians(-38)))
    for f in range(0, 111, 20): key(Z_root, 'rotation_euler', f, (0.03 * math.sin(f / 9), 0, math.radians(180 + 3 * math.sin(f / 13))))
else:                            # s3: the three on the landing, the beam down the gap, she crosses herself, the dog peers down
    cam_data.lens = 22
    cam_data.dof.use_dof = VOL; cam_data.dof.focus_object = G_head; cam_data.dof.aperture_fstop = 2.8
    look = empty((-0.55, 1.25, ZT + 0.85), 'look'); aim(cam, look)
    key(cam, 'location', 0, Vector((2.45, 0.15, ZT + 2.05))); key(cam, 'location', 140, Vector((2.3, 0.3, ZT + 1.95)))
    # the sign of the cross: forehead, chest, right shoulder, left shoulder
    a = G_arms[0]
    for f, r in [(0, (0, 0, 0)), (12, (0, 0, 0)), (28, (math.radians(-150), 0, math.radians(30))), (40, (math.radians(-60), 0, math.radians(30))), (51, (math.radians(-110), 0, math.radians(-20))), (62, (math.radians(-110), 0, math.radians(60))), (78, (0, 0, 0))]:
        key(a, 'rotation_euler', f, r)
    key(D_head, 'rotation_euler', 0, (0, 0, 0)); key(D_head, 'rotation_euler', 82, (0, 0, 0)); key(D_head, 'rotation_euler', 100, (math.radians(-35), 0, math.radians(15))); key(D_head, 'rotation_euler', 160, (math.radians(-38), 0, math.radians(18)))
    key(H_head, 'rotation_euler', 0, (0, 0, 0)); key(H_head, 'rotation_euler', 100, (math.radians(-25), 0, math.radians(-20)))
    for f in range(0, 161, 16): key(torch_target, 'location', f, Vector((0.05 * math.sin(f / 9), 2.6 + 0.1 * math.cos(f / 11), ZT - 6.0)))
# ease every animation curve
for o in bpy.data.objects:
    ad = o.animation_data
    if ad and ad.action:
        try:
            for fc in ad.action.fcurves:
                for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
        except AttributeError:
            pass

for mname in ('window', 'bulb', 'lens', 'cabin_light'):
    try: M[mname].cycles.emission_sampling = 'NONE'
    except Exception as e: print('emission sampling', e)
try: bm.cycles.emission_sampling = 'NONE'
except Exception as e: print('beam emission sampling', e)
# —— render: Cycles on the CPU, denoised; the mist pass for the fog; glare and a vignette in the compositor ——
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.04
sc.cycles.use_denoising = True; sc.cycles.max_bounces = 3; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1; sc.cycles.transparent_max_bounces = 8
sc.render.use_persistent_data = True
sc.cycles.volume_bounces = 0; sc.cycles.volume_step_rate = 4.0      # single scattering; the haze is homogeneous
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920; sc.render.resolution_percentage = PCT
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.view_settings.exposure = 1.0
# (fog, glow and the grade are added in the 2D pass over these frames)
print('scene built', round(time.time() - T_START, 1), 's'); os.makedirs(OUT, exist_ok=True)
sc.frame_start, sc.frame_end = F0, F1
sc.frame_step = STEP
sc.render.filepath = os.path.join(OUT, '')
sc.render.image_settings.file_format = 'PNG'
sc.render.use_overwrite = False                  # a restarted run skips the frames already on disk
t0 = time.time(); bpy.ops.render.render(animation=True)
print(f'{SHOT}: {(F1 - F0) // STEP + 1} frames in {time.time() - t0:.0f} s')
