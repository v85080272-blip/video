# The shared kit of the 3D episodes: Blender setup, low-poly helpers, materials, the people (with hip and shoulder pivots,
# so they can walk and climb), the torch, the haze and the dust, and the render settings. Cycles on the CPU.
import bpy, math, random, os, time
from mathutils import Vector

FPS = 30
T_START = time.time()


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS
    return sc


def col():
    return bpy.context.scene.collection


def mat(name, color, emit=0.0, rough=0.85, metal=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


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
    o = bpy.data.objects.new(name, None); col().objects.link(o); o.location = loc; o.rotation_euler = rot
    if parent: o.parent = parent
    return o


def aim(obj, target):
    c = obj.constraints.new('TRACK_TO'); c.target = target; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'


def key(obj, path, f, val):
    setattr(obj, path, val); obj.keyframe_insert(path, frame=f)


# —— the people's colours ——
M = {}
def people_materials():
    M.update({
        'jacket': mat('jacket', (0.85, 0.3, 0.05)), 'pants': mat('pants', (0.1, 0.16, 0.08)), 'boots': mat('boots', (0.05, 0.04, 0.03)),
        'skin': mat('skin', (0.8, 0.55, 0.42)), 'beard': mat('beard', (0.22, 0.11, 0.05)), 'hat': mat('hat', (0.4, 0.26, 0.15)),
        'fur': mat('fur', (0.72, 0.6, 0.45)), 'pack': mat('pack', (0.12, 0.25, 0.14)),
        'robe': mat('robe', (0.32, 0.14, 0.42)), 'scarf': mat('scarf', (0.75, 0.08, 0.06)), 'pan': mat('pan', (0.05, 0.05, 0.06), rough=0.3, metal=0.8),
        'handle': mat('handle', (0.25, 0.14, 0.07)), 'nose': mat('nose', (0.02, 0.02, 0.03)),
        'dog_w': mat('dog_w', (0.85, 0.84, 0.8)), 'dog_g': mat('dog_g', (0.32, 0.33, 0.35)), 'collar': mat('collar', (0.7, 0.08, 0.06)),
        'puffer': mat('puffer', (0.42, 0.2, 0.62), rough=0.5), 'hood_w': mat('hood_w', (0.92, 0.9, 0.95)), 'ear_in': mat('ear_in', (0.95, 0.6, 0.72)),
        'jeans': mat('jeans', (0.12, 0.16, 0.3)), 'sneak': mat('sneak', (0.9, 0.9, 0.92)),
        'rain': mat('rain', (0.95, 0.75, 0.08), rough=0.35), 'braid': mat('braid', (0.45, 0.25, 0.1)), 'boot_r': mat('boot_r', (0.15, 0.3, 0.6)),
        'torch': mat('torch', (0.1, 0.1, 0.12), metal=0.6), 'lens': mat('lens', (1.0, 0.92, 0.75), emit=30),
        'radio': mat('radio', (0.08, 0.09, 0.1), rough=0.5), 'screen': mat('screen', (0.45, 1.0, 0.6), emit=4),
        'olive': mat('olive', (0.2, 0.24, 0.12)), 'cap': mat('cap', (0.06, 0.07, 0.08)), 'grey': mat('grey', (0.18, 0.19, 0.2)),
        'dosim': mat('dosim', (0.95, 0.72, 0.05), rough=0.4), 'lcd': mat('lcd', (0.55, 0.75, 0.5), emit=1.5),
        'wolf_g': mat('wolf_g', (0.42, 0.41, 0.38)), 'wolf_d': mat('wolf_d', (0.16, 0.15, 0.14)), 'scarf_r': mat('scarf_r', (0.7, 0.08, 0.06), rough=0.9),
        'hoodie': mat('hoodie', (0.12, 0.3, 0.72)), 'jog': mat('jog', (0.55, 0.56, 0.58)), 'cap_r': mat('cap_r', (0.75, 0.1, 0.08), rough=0.6),
        'hair_d': mat('hair_d', (0.12, 0.08, 0.05)),
        'hair_g': mat('hair_g', (0.18, 0.62, 0.22), rough=0.6), 'jacket_p': mat('jacket_p', (0.9, 0.36, 0.55), rough=0.55),
        'cargo': mat('cargo', (0.2, 0.2, 0.17)), 'hair_o': mat('hair_o', (0.78, 0.33, 0.08), rough=0.6), 'teal': mat('teal', (0.05, 0.52, 0.55), rough=0.45),
        'jeans_l': mat('jeans_l', (0.32, 0.42, 0.6)), 'hood_g': mat('hood_g', (0.6, 0.6, 0.62)), 'beanie': mat('beanie', (0.22, 0.22, 0.25)),
        'legg': mat('legg', (0.35, 0.18, 0.45)), 'pack_p': mat('pack_p', (0.95, 0.55, 0.7)), 'hair_b': mat('hair_b', (0.35, 0.22, 0.12)),
        'mask': mat('mask', (0.11, 0.13, 0.1), rough=0.75), 'glass_m': mat('glass_m', (0.15, 0.2, 0.22), rough=0.15, metal=0.3),
        'tan': mat('tan', (0.55, 0.35, 0.17)), 'tan_d': mat('tan_d', (0.25, 0.15, 0.08)), 'blk': mat('blk', (0.04, 0.035, 0.03)), 'tan_l': mat('tan_l', (0.75, 0.55, 0.3)),
    })


def _legs(root, dx, h, mleg, mfoot, r=0.085):
    """two legs hanging from hip pivots, so they can swing (walk) and bend at the hip (climb)"""
    hips = []
    for i, x in enumerate((-dx, dx)):
        hp = empty((x, 0, h), f'hip{i}', parent=root)
        cyl((0, 0, -h / 2), r, h, mleg, parent=hp); cyl((0, -0.04, -h + 0.05), r + 0.005, 0.1, mfoot, parent=hp)
        hips.append(hp)
    return hips


def _arms(root, dx, z, length, msleeve, mhand, r=0.07, tag='sh'):
    arms = []
    for i, x in enumerate((-dx, dx)):
        sh = empty((x, 0, z), f'{tag}{i}', parent=root)
        cyl((0, 0, -length / 2), r, length, msleeve, verts=6, parent=sh); ico((0, 0, -length - 0.02), r * 0.85, mhand, parent=sh)
        arms.append(sh)
    return arms


def person(x, y, z, kind, rot=0.0):
    """returns dict(root, head, arms [left, right], hips [left, right], hand [right hand empty])"""
    root = empty((x, y, z), kind, rot=(0, 0, rot))
    P = dict(root=root, arms=[], hips=[])
    if kind == 'hunter':
        P['hips'] = _legs(root, 0.11, 0.84, M['pants'], M['boots'])
        cyl((0, 0, 1.17), 0.25, 0.72, M['jacket'], r2=0.21, parent=root, name='torso')
        box((0, 0.24, 1.2), (0.34, 0.2, 0.5), M['pack'], parent=root)
        head = empty((0, 0, 1.62), 'head', parent=root)
        ico((0, 0, 0.1), 0.17, M['skin'], parent=head); ico((0, -0.09, 0.01), 0.14, M['beard'], parent=head, scale=(1, 0.8, 1))
        ico((0, 0.05, 0.12), 0.165, M['beard'], parent=head, scale=(1.02, 0.95, 0.95))          # the hair at the back, so from behind he reads from behind
        cyl((0, 0, 0.27), 0.19, 0.16, M['hat'], verts=10, parent=head); cyl((0, 0, 0.2), 0.21, 0.07, M['fur'], verts=10, parent=head)
        P['arms'] = _arms(root, 0.3, 1.45, 0.56, M['jacket'], M['skin'])
    elif kind == 'granny':
        cyl((0, 0, 0.55), 0.34, 1.1, M['robe'], r2=0.22, verts=10, parent=root)
        head = empty((0, 0, 1.28), 'ghead', parent=root)
        ico((0, 0, 0.0), 0.16, M['skin'], parent=head); ico((0, 0.02, 0.05), 0.18, M['scarf'], parent=head, scale=(1.05, 1.05, 0.9))
        ico((0, -0.13, -0.02), 0.03, M['nose'], parent=head)
        P['arms'] = _arms(root, 0.26, 1.08, 0.48, M['robe'], M['skin'], r=0.065, tag='gsh')
        pan = empty((0, 0, -0.5), 'pan', parent=P['arms'][1])
        cyl((0, 0, -0.18), 0.02, 0.3, M['handle'], verts=6, parent=pan); cyl((0, 0, -0.42), 0.14, 0.04, M['pan'], verts=14, rot=(math.pi / 2, 0, 0), parent=pan)
    elif kind in ('dog', 'stray1', 'stray2', 'wolf'):      # Пурга (white and grey, a red collar); two local strays, brown and black-and-tan
        base, top = {'dog': ('dog_w', 'dog_g'), 'stray1': ('tan', 'tan_d'), 'stray2': ('tan_l', 'blk'), 'wolf': ('wolf_g', 'wolf_d')}[kind]
        mb, mt = M[base], M[top]
        ico((0, 0.02, 0.46), 0.2, mb, sub=2, parent=root, scale=(0.75, 1.75, 0.85))
        ico((0, -0.24, 0.48), 0.16, mb, sub=2, parent=root, scale=(0.8, 1.0, 1.1))
        ico((0, 0.05, 0.6), 0.16, mt, sub=2, parent=root, scale=(0.7, 1.6, 0.4))
        for i, dy in enumerate((-0.26, 0.24)):
            for j, dx in enumerate((-0.08, 0.08)):
                hp = empty((dx, dy, 0.4), f'dleg{i}{j}', parent=root); cyl((0, 0, -0.2), 0.04, 0.4, mb, verts=6, parent=hp); P['hips'].append(hp)
        head = empty((0, -0.36, 0.7), 'dhead', parent=root)
        ico((0, 0, 0), 0.13, mb, sub=2, parent=head, scale=(0.95, 1.0, 0.9)); ico((0, 0, 0.04), 0.12, mt, sub=2, parent=head, scale=(0.9, 0.8, 0.55))
        ico((0, -0.15, -0.04), 0.07, mb, sub=1, parent=head, scale=(0.8, 1.5, 0.75)); ico((0, -0.25, -0.03), 0.028, M['nose'], parent=head)
        for dx in (-0.07, 0.07): cyl((dx, 0.0, 0.15), 0.045, 0.14, mt, verts=4, r2=0.0, parent=head)
        for dx in (-0.045, 0.045): ico((dx, -0.1, 0.03), 0.016, M['nose'], parent=head)
        if kind == 'dog':
            bpy.ops.mesh.primitive_torus_add(major_radius=0.1, minor_radius=0.035, location=(0, 0.3, 0.68), rotation=(0, math.pi / 2, 0)); tl = bpy.context.object
            tl.data.materials.append(mt); tl.parent = root
            box((0, -0.3, 0.56), (0.24, 0.05, 0.06), M['collar'], parent=root)
        else:                                       # a straight tail, a little up; a yellow ear tag (they are counted and vaccinated)
            tail = empty((0, 0.32, 0.58), 'dtail', parent=root); cyl((0, 0.13, 0.05), 0.035, 0.3, mt, verts=6, rot=(math.radians(-70), 0, 0), parent=tail)
            P['tail'] = tail
            if kind != 'wolf': box((0.075, 0.0, 0.17), (0.01, 0.04, 0.03), M['dosim'], parent=head)
            else: root.scale = (1.25, 1.25, 1.25)                # a wolf: bigger, grey, no ear tag
    elif kind == 'guide':                          # the guide: an olive jacket, a dark cap with a peak, the yellow dosimeter in the right hand
        P['hips'] = _legs(root, 0.11, 0.84, M['grey'], M['boots'])
        cyl((0, 0, 1.17), 0.24, 0.72, M['olive'], r2=0.2, parent=root, name='torso')
        head = empty((0, 0, 1.6), 'uhead', parent=root)
        ico((0, 0, 0.1), 0.16, M['skin'], parent=head); cyl((0, 0, 0.22), 0.17, 0.1, M['cap'], verts=12, parent=head)
        ico((0, 0.05, 0.11), 0.155, M['hat'], parent=head, scale=(1.02, 0.95, 0.9))               # short hair at the back
        box((0, -0.18, 0.18), (0.26, 0.14, 0.025), M['cap'], parent=head)
        P['arms'] = _arms(root, 0.29, 1.45, 0.56, M['olive'], M['skin'], tag='ush')
        dz = empty((0, -0.05, -0.62), 'dosimeter', parent=P['arms'][1])
        box((0, 0, 0), (0.07, 0.035, 0.13), M['dosim'], parent=dz); box((0, -0.019, 0.025), (0.05, 0.004, 0.035), M['lcd'], parent=dz)
        P['dosimeter'] = dz
    elif kind == 'krasotka':                       # a purple puffer jacket, a white hood with bunny ears; she has the torch
        P['hips'] = _legs(root, 0.1, 0.8, M['jeans'], M['sneak'], r=0.075)
        cyl((0, 0, 1.1), 0.24, 0.62, M['puffer'], r2=0.2, verts=10, parent=root, name='torso')
        for k in range(3): cyl((0, 0, 0.9 + k * 0.2), 0.25 - 0.015 * k, 0.05, M['puffer'], verts=10, parent=root)
        head = empty((0, 0, 1.52), 'khead', parent=root)
        ico((0, -0.02, 0.06), 0.15, M['skin'], parent=head); ico((0, 0.03, 0.09), 0.18, M['hood_w'], parent=head, scale=(1.05, 1.0, 1.05))
        for dx in (-0.08, 0.08):
            e = ico((dx, 0.04, 0.38), 0.05, M['hood_w'], parent=head, scale=(0.9, 0.5, 3.0)); ico((dx, -0.0, 0.38), 0.035, M['ear_in'], parent=head, scale=(0.7, 0.3, 2.6))
        P['arms'] = _arms(root, 0.28, 1.36, 0.52, M['puffer'], M['skin'], r=0.075, tag='ksh')
    elif kind == 'solomia':                        # a yellow raincoat, a long braid, blue rubber boots; she has the radio
        P['hips'] = _legs(root, 0.1, 0.8, M['jeans'], M['boot_r'], r=0.075)
        cyl((0, 0, 0.95), 0.3, 0.95, M['rain'], r2=0.19, verts=10, parent=root, name='torso')
        head = empty((0, 0, 1.52), 'shead', parent=root)
        ico((0, 0, 0.06), 0.15, M['skin'], parent=head); ico((0, 0.04, 0.12), 0.16, M['braid'], parent=head, scale=(1.0, 1.0, 0.8))
        for k in range(5): ico((0, 0.16 + 0.02 * k, 0.02 - 0.11 * k), 0.05 - 0.004 * k, M['braid'], parent=head)
        P['arms'] = _arms(root, 0.27, 1.36, 0.52, M['rain'], M['skin'], r=0.075, tag='ssh')
    elif kind == 'bogdan':                         # Богдан (he wrote «возьми с собой»): a blue hoodie, grey joggers, white sneakers, a red cap
        P['hips'] = _legs(root, 0.1, 0.82, M['jog'], M['sneak'], r=0.078)
        cyl((0, 0, 1.12), 0.235, 0.66, M['hoodie'], r2=0.2, verts=10, parent=root, name='torso')
        cyl((0, 0.06, 1.44), 0.2, 0.1, M['hoodie'], verts=10, parent=root, name='hood')            # the hood, down, round the neck
        box((0, 0.22, 1.18), (0.3, 0.16, 0.42), M['scarf'], parent=root)                         # a red backpack
        head = empty((0, 0, 1.56), 'bhead', parent=root)
        ico((0, 0, 0.08), 0.155, M['skin'], parent=head); ico((0, 0.04, 0.13), 0.16, M['hair_d'], parent=head, scale=(1.02, 0.98, 0.85))
        cyl((0, 0, 0.21), 0.165, 0.08, M['cap_r'], verts=12, parent=head); box((0, -0.17, 0.18), (0.24, 0.14, 0.02), M['cap_r'], parent=head)
        P['arms'] = _arms(root, 0.28, 1.4, 0.54, M['hoodie'], M['skin'], r=0.072, tag='bsh')
    elif kind == 'kolya':                          # Коля (@KolyaKostenko): green spiky hair like his avatar, a pink jacket, dark cargo trousers
        P['hips'] = _legs(root, 0.1, 0.83, M['cargo'], M['boots'], r=0.08)
        cyl((0, 0, 1.13), 0.24, 0.66, M['jacket_p'], r2=0.2, verts=10, parent=root, name='torso')
        box((0, 0.22, 1.18), (0.3, 0.15, 0.4), M['pack'], parent=root)
        head = empty((0, 0, 1.57), 'kohead', parent=root)
        ico((0, 0, 0.08), 0.155, M['skin'], parent=head); ico((0, 0.03, 0.14), 0.16, M['hair_g'], parent=head, scale=(1.02, 1.0, 0.75))
        for k, (dx, dy) in enumerate([(-0.09, -0.05), (0.0, -0.08), (0.09, -0.05), (-0.06, 0.06), (0.06, 0.06), (0.0, 0.0)]):
            cyl((dx, dy, 0.27), 0.05, 0.16, M['hair_g'], verts=5, r2=0.0, rot=(dy * 2.5, -dx * 2.5, 0), parent=head)
        P['arms'] = _arms(root, 0.28, 1.4, 0.54, M['jacket_p'], M['skin'], r=0.072, tag='kosh')
    elif kind == 'nastya':                         # Настя (@НастяКарпенко-э9с): ginger hair in a ponytail, a teal windbreaker, light jeans
        P['hips'] = _legs(root, 0.095, 0.8, M['jeans_l'], M['sneak'], r=0.074)
        cyl((0, 0, 1.1), 0.225, 0.62, M['teal'], r2=0.19, verts=10, parent=root, name='torso')
        head = empty((0, 0, 1.51), 'nhead', parent=root)
        ico((0, 0, 0.07), 0.148, M['skin'], parent=head); ico((0, 0.035, 0.12), 0.158, M['hair_o'], parent=head, scale=(1.03, 1.0, 0.85))
        for k in range(4): ico((0, 0.17 + 0.025 * k, 0.12 - 0.09 * k), 0.06 - 0.007 * k, M['hair_o'], parent=head)
        P['arms'] = _arms(root, 0.265, 1.35, 0.51, M['teal'], M['skin'], r=0.07, tag='nsh')
    elif kind == 'mary':                           # Мэри (@MaryMama2308, a kitten on her avatar): a grey hoodie, a dark beanie with cat ears, a pink backpack
        P['hips'] = _legs(root, 0.095, 0.8, M['legg'], M['sneak'], r=0.072)
        cyl((0, 0, 1.1), 0.235, 0.62, M['hood_g'], r2=0.2, verts=10, parent=root, name='torso')
        box((0, 0.21, 1.15), (0.26, 0.13, 0.34), M['pack_p'], parent=root)
        head = empty((0, 0, 1.51), 'mhead', parent=root)
        ico((0, 0, 0.07), 0.148, M['skin'], parent=head); ico((0, 0.04, 0.06), 0.155, M['hair_b'], parent=head, scale=(1.05, 1.0, 1.0))
        ico((0, 0.0, 0.15), 0.16, M['beanie'], parent=head, scale=(1.05, 1.05, 0.72))
        for dx in (-0.1, 0.1): cyl((dx, 0.0, 0.27), 0.055, 0.1, M['beanie'], verts=3, r2=0.0, rot=(0, 0, math.pi / 2), parent=head)
        P['arms'] = _arms(root, 0.27, 1.35, 0.51, M['hood_g'], M['skin'], r=0.07, tag='msh')
    P['head'] = head
    return P


BEAM_DENSITY = float(os.environ.get('BEAM_DENSITY', '0.22'))


def torch_on(parent, energy=1400, beam_len=6.0, beam_r=1.2, name='torch'):
    """a hand torch on an empty: the body, the glowing lens, a spot light and a visible beam cone; returns the empty"""
    t = empty((0, 0, 0), name, parent=parent)
    for o in (cyl((0, 0, 0.09), 0.035, 0.18, M['torch'], verts=8, parent=t), cyl((0, 0, -0.005), 0.032, 0.01, M['lens'], verts=8, parent=t)):
        o.visible_shadow = False                     # the light sits at the lens: the torch itself must not block it
    bpy.ops.object.light_add(type='SPOT', location=(0, 0, -0.02)); L = bpy.context.object; L.parent = t
    L.data.energy = energy; L.data.spot_size = math.radians(26); L.data.spot_blend = 0.75; L.data.color = (1, 0.92, 0.75); L.data.shadow_soft_size = 0.02
    # the beam is air lit by the spot itself: a thin volume inside the cone, so it shows only where the light really is
    # (its rim soft where the spot blends out, nothing while the torch is off), and never a solid wedge
    bm = bpy.data.materials.new(name + '_beam'); bm.use_nodes = True; nt = bm.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); pv = nt.nodes.new('ShaderNodeVolumePrincipled')
    pv.inputs['Color'].default_value = (1, 0.95, 0.85, 1); pv.inputs['Anisotropy'].default_value = 0.35
    pv.inputs['Density'].default_value = BEAM_DENSITY
    nt.links.new(pv.outputs['Volume'], out.inputs['Volume'])
    beam = cyl((0, 0, -beam_len / 2), beam_r, beam_len, bm, verts=32, r2=0.03, parent=t, name=name + '_beamcone'); beam.visible_shadow = False
    t['light'] = L.name
    t['beam'] = beam.name
    return t, L


def font(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fonts', 'DejaVuSansMono-Bold.ttf')):
    """a font with Cyrillic letters for the text in the scene"""
    try: return bpy.data.fonts.load(path, check_existing=True)
    except Exception as e: print('font', e); return None


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
    dm = bpy.data.materials.new('dust'); dm.use_nodes = True; nt = dm.node_tree; nt.nodes.clear()
    tr = nt.nodes.new('ShaderNodeBsdfTranslucent'); df = nt.nodes.new('ShaderNodeBsdfDiffuse'); mx = nt.nodes.new('ShaderNodeMixShader'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    tr.inputs['Color'].default_value = (0.8, 0.77, 0.72, 1); df.inputs['Color'].default_value = (0.9, 0.88, 0.84, 1); mx.inputs['Fac'].default_value = 0.25
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(df.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs['Surface'])
    me.materials.append(dm); bpy.data.objects.remove(proto)
    for i in range(n):
        o = bpy.data.objects.new('mote', me); col().objects.link(o)
        r = rnd.uniform(0.003, 0.009); o.scale = (r, r, r); o.visible_shadow = False
        p = Vector([rnd.uniform(a, b) for a, b in zip(lo, hi)])
        v = Vector((rnd.gauss(0, 0.03), rnd.gauss(0, 0.03), rnd.gauss(-0.01, 0.015)))
        for f in (0, frames):
            o.location = p + v * (f / 30); o.keyframe_insert('location', frame=f)


def ease_all():
    for o in bpy.data.objects:
        ad = o.animation_data
        if ad and ad.action:
            try:
                for fc in ad.action.fcurves:
                    for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
            except AttributeError:
                pass


def render(sc, out, f0, f1, pct=66, samples=16, step=2, vol=False):
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.04
    sc.cycles.use_denoising = True; sc.cycles.max_bounces = 3; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 1; sc.cycles.transparent_max_bounces = 8
    sc.cycles.volume_bounces = 0; sc.cycles.volume_step_rate = 4.0
    sc.render.use_persistent_data = True
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1920; sc.render.resolution_percentage = pct
    sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'; sc.view_settings.exposure = float(os.environ.get('EXPOSURE', '1.0'))
    os.makedirs(out, exist_ok=True)
    sc.frame_start, sc.frame_end, sc.frame_step = f0, f1, step
    sc.render.filepath = os.path.join(out, ''); sc.render.image_settings.file_format = 'PNG'
    sc.render.use_overwrite = False                   # a restarted run skips the frames already on disk
    print('scene built', round(time.time() - T_START, 1), 's')
    t0 = time.time(); bpy.ops.render.render(animation=True)
    print(f'{os.path.basename(out.rstrip("/"))}: {(f1 - f0) // step + 1} frames in {time.time() - t0:.0f} s')
