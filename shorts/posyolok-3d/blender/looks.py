# The look of the people in «Посёлок»: textured materials (skin with subsurface light, a glossy grained leather jacket,
# denim with a twill and wear, sneakers with grey soles, hair with strands and a sheen; the infected's dirty cloth and
# mottled grey skin — no blood) and the small things that make her real: a collar and lapels, an asymmetric zip, cuffs,
# a belt with a buckle, back pockets with stitching, soles, fingers, eyes with whites and irises, lashes, brows, lips,
# strands of hair over the head, a ponytail of three twisted locks with a tie, two strands framing the face.
# The body mesh has no UVs: its textures read «Generated» coordinates (the undeformed mesh), scaled to metres, so they
# stay on the cloth when she moves.
import bpy, math, random
from mathutils import Vector, Matrix


def _nodes(name):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    return m, nt.nodes, nt.links, nt.nodes['Principled BSDF']


def _coords(N, L, mode='Generated', scale=(1, 1, 1), rot=(0, 0, 0)):
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.name = 'map'
    mp.inputs['Scale'].default_value = scale; mp.inputs['Rotation'].default_value = rot
    L.new(tc.outputs[mode], mp.inputs['Vector'])
    return mp.outputs['Vector']


def _noise(N, L, vec, scale, detail=6.0, rough=0.55):
    n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough; L.new(vec, n.inputs['Vector']); return n


def _mix(N, L, fac, a, b, blend='MIX'):
    m = N.new('ShaderNodeMix'); m.data_type = 'RGBA'; m.blend_type = blend
    if isinstance(fac, float): m.inputs['Factor'].default_value = fac
    else: L.new(fac, m.inputs['Factor'])
    for k, v in (('A', a), ('B', b)):
        if isinstance(v, tuple): m.inputs[k].default_value = (*v, 1)
        else: L.new(v, m.inputs[k])
    return m.outputs['Result']


def _ramp(N, L, src, lo, hi):
    mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = lo; mr.inputs['To Max'].default_value = hi
    L.new(src, mr.inputs['Value']); return mr.outputs['Result']


def _bump(N, L, b, h, strength, dist=0.002, normal=None):
    bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = dist
    L.new(h, bp.inputs['Height'])
    if normal is not None: L.new(normal, bp.inputs['Normal'])
    L.new(bp.outputs['Normal'], b.inputs['Normal']); return bp.outputs['Normal']


def skin(name='skin', base=(0.74, 0.52, 0.42), sss=0.15):
    m, N, L, b = _nodes(name)
    v = _coords(N, L, 'Object', (1, 1, 1))
    n = _noise(N, L, v, 60.0, 4.0)
    L.new(_mix(N, L, n.outputs['Fac'], tuple(c * 0.92 for c in base), tuple(min(1, c * 1.06) for c in base)), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.48
    b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = (1.0, 0.45, 0.28); b.inputs['Subsurface Scale'].default_value = 0.012
    _bump(N, L, b, _noise(N, L, v, 400.0, 2.0).outputs['Fac'], 0.06, 0.0005)
    return m


def leather(name='leather', base=(0.022, 0.021, 0.024)):
    """black leather: a fine grain, soft wrinkles, the shine varies (worn where it bends), a thin clear coat"""
    m, N, L, b = _nodes(name)
    v = _coords(N, L)
    grain = N.new('ShaderNodeTexVoronoi'); grain.inputs['Scale'].default_value = 420.0; L.new(v, grain.inputs['Vector'])
    wr = _noise(N, L, v, 9.0, 8.0, 0.6)
    L.new(_mix(N, L, wr.outputs['Fac'], base, tuple(c * 2.6 for c in base)), b.inputs['Base Color'])
    L.new(_ramp(N, L, wr.outputs['Fac'], 0.22, 0.5), b.inputs['Roughness'])
    b.inputs['Coat Weight'].default_value = 0.35; b.inputs['Coat Roughness'].default_value = 0.25
    h = _mix(N, L, 0.5, grain.outputs['Distance'], wr.outputs['Fac'])
    _bump(N, L, b, h, 0.35, 0.0015)
    return m


def denim(name='denim', base=(0.035, 0.06, 0.13)):
    """dark indigo: a diagonal twill, lighter wear on the thighs and the knees"""
    m, N, L, b = _nodes(name)
    v = _coords(N, L)
    rot = N.new('ShaderNodeVectorRotate'); rot.rotation_type = 'Z_AXIS'; rot.inputs['Angle'].default_value = math.radians(45)
    rx = N.new('ShaderNodeVectorRotate'); rx.rotation_type = 'X_AXIS'; rx.inputs['Angle'].default_value = math.radians(35)
    L.new(v, rx.inputs['Vector']); L.new(rx.outputs['Vector'], rot.inputs['Vector'])
    tw = N.new('ShaderNodeTexWave'); tw.wave_type = 'BANDS'; tw.inputs['Scale'].default_value = 260.0; tw.inputs['Distortion'].default_value = 0.6
    L.new(rot.outputs['Vector'], tw.inputs['Vector'])
    wear = _noise(N, L, v, 3.0, 4.0)
    c = _mix(N, L, _ramp(N, L, wear.outputs['Fac'], 0.0, 0.55), base, (0.11, 0.17, 0.3))
    c = _mix(N, L, tw.outputs['Fac'], c, (0.015, 0.025, 0.06), 'MULTIPLY')
    c2 = N.new('ShaderNodeMix'); c2.data_type = 'RGBA'; c2.inputs['Factor'].default_value = 0.35; L.new(c, c2.inputs['A']); L.new(c, c2.inputs['B'])
    L.new(_mix(N, L, 0.25, c, (0.02, 0.03, 0.07), 'MULTIPLY'), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.82
    _bump(N, L, b, tw.outputs['Fac'], 0.25, 0.0006)
    return m


def plain(name, color, rough=0.6, metal=0.0, coat=0.0, bump_scale=0.0, bump=0.0, emit=0.0):
    m, N, L, b = _nodes(name)
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat
    if emit: b.inputs['Emission Color'].default_value = (*color, 1); b.inputs['Emission Strength'].default_value = emit
    if bump:
        v = _coords(N, L, 'Object'); _bump(N, L, b, _noise(N, L, v, bump_scale, 3.0).outputs['Fac'], bump, 0.0008)
    return m


def canvas(name, base, scale=180.0):
    """sneakers: white canvas with a weave and a little grime"""
    m, N, L, b = _nodes(name)
    v = _coords(N, L)
    ch = N.new('ShaderNodeTexChecker'); ch.inputs['Scale'].default_value = scale; L.new(v, ch.inputs['Vector'])
    dirt = _noise(N, L, v, 6.0, 5.0)
    L.new(_mix(N, L, _ramp(N, L, dirt.outputs['Fac'], 0.0, 0.25), base, (0.45, 0.43, 0.4)), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.7
    _bump(N, L, b, ch.outputs['Fac'], 0.15, 0.0005)
    return m


def hair(name='hair', base=(0.03, 0.019, 0.012), shine=(0.085, 0.052, 0.032)):
    """dark brown hair: strands along the lock (fine bands), a sheen where they bunch"""
    m, N, L, b = _nodes(name)
    v = _coords(N, L, 'Object')
    st = N.new('ShaderNodeTexWave'); st.wave_type = 'BANDS'; st.bands_direction = 'X'; st.inputs['Scale'].default_value = 140.0
    st.inputs['Distortion'].default_value = 3.0; st.inputs['Detail'].default_value = 4.0; L.new(v, st.inputs['Vector'])
    big = _noise(N, L, v, 12.0, 3.0)
    L.new(_mix(N, L, st.outputs['Fac'], base, shine), b.inputs['Base Color'])
    L.new(_ramp(N, L, big.outputs['Fac'], 0.25, 0.45), b.inputs['Roughness'])
    b.inputs['Coat Weight'].default_value = 0.25; b.inputs['Coat Roughness'].default_value = 0.3
    _bump(N, L, b, st.outputs['Fac'], 0.4, 0.0012)
    return m


def cloth(name, base, dirt=(0.05, 0.045, 0.035), scale=160.0):
    """the infected's clothes: a coarse weave, stains, faded patches (no blood)"""
    m, N, L, b = _nodes(name)
    v = _coords(N, L, 'Generated', (0.5, 0.35, 1.8))
    ch = N.new('ShaderNodeTexChecker'); ch.inputs['Scale'].default_value = scale; L.new(v, ch.inputs['Vector'])
    st = _noise(N, L, v, 5.0, 6.0, 0.65)
    c = _mix(N, L, _ramp(N, L, st.outputs['Fac'], -0.3, 0.9), base, dirt)
    L.new(_mix(N, L, 0.2, c, ch.outputs['Color'], 'MULTIPLY'), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.92
    _bump(N, L, b, _mix(N, L, 0.5, ch.outputs['Fac'], st.outputs['Fac']), 0.3, 0.001)
    return m


def grey_skin(name='z_skin2'):
    """their skin: grey-green, mottled, darker round the eyes and the veins showing — dull, never wet, no wounds"""
    m, N, L, b = _nodes(name)
    v = _coords(N, L, 'Object')
    n = _noise(N, L, v, 30.0, 6.0, 0.6)
    vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 24.0; L.new(v, vor.inputs['Vector'])
    c = _mix(N, L, n.outputs['Fac'], (0.3, 0.33, 0.29), (0.42, 0.44, 0.38))
    veins = _ramp(N, L, vor.outputs['Distance'], 1.0, 0.0)
    L.new(_mix(N, L, veins, c, (0.18, 0.2, 0.22), 'MIX'), b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.8
    b.inputs['Subsurface Weight'].default_value = 0.05
    _bump(N, L, b, n.outputs['Fac'], 0.2, 0.001)
    return m


def fit_generated(mats, body):
    """scale the Generated coordinates of these materials to the body's size in metres"""
    d = body.dimensions
    for m in mats:
        mp = m.node_tree.nodes.get('map')
        if mp and m.node_tree.nodes.get('Texture Coordinate') and any(l.from_socket.name == 'Generated' for l in m.node_tree.links if l.to_node == mp):
            mp.inputs['Scale'].default_value = (d.x, d.y, d.z)


def mount(arm, bone, col):
    """an empty riding a bone whose local coordinates are the armature's rest-pose coordinates"""
    e = bpy.data.objects.new(f'{arm.name}_{bone}_mount', None); col.objects.link(e)
    b = arm.data.bones[bone]
    e.parent = arm; e.parent_type = 'BONE'; e.parent_bone = bone
    e.matrix_parent_inverse = (b.matrix_local @ Matrix.Translation((0, b.length, 0))).inverted()
    return e


def dress_heroine(P, hm, H, kit, skin_chain, smooth_ball, col):
    """the details on her (rest pose, metres from her feet; she faces −y). hm: the head mount (origin at the skull base)"""
    arm = P['root']; ico = kit.ico; empty = kit.empty
    sp = mount(arm, 'spine', col); ch = mount(arm, 'chest', col); hp = mount(arm, 'hips', col)
    # the bust, under the jacket: two soft rounds, no more than the cut of the jacket shows
    # a stand-up collar round the neck, open at the front where the red top shows
    skin_chain([(0, 0.006, 1.395), (0, 0.008, 1.465)], [(0.072, 0.064), (0.058, 0.052)], H['jacket'], parent=ch, name='h_collar')

    # the asymmetric zip, a little to her left, on the surface of the jacket
    skin_chain([(0.04, -0.094, 1.0), (0.045, -0.096, 1.1), (0.05, -0.128, 1.22), (0.035, -0.112, 1.32), (0.01, -0.093, 1.39)],
               [0.0045] * 5, H['metal'], parent=sp, name='h_zip', subd=1)
    # the buckle on the belt (the belt itself is a band of the body), the back pockets with stitching
    o = kit.box((0, -0.118, 0.962), (0.046, 0.01, 0.03), H['metal'], name='h_buckle'); o.parent = hp
    for x in (-0.075, 0.075):
        o = kit.box((x, 0.118, 0.87), (0.11, 0.008, 0.12), H['pocket'], name='h_pocket'); o.parent = hp; o.rotation_euler = (math.radians(12), 0, math.radians(-8 if x < 0 else 8))
        for dz in (-0.052, 0.052):
            s_ = kit.box((x, 0.123, 0.87 + dz), (0.105, 0.003, 0.003), H['stitch'], name='h_stitch'); s_.parent = hp; s_.rotation_euler = o.rotation_euler
    # the cuffs, the fingers, the soles
    for side, s in (('L', -1), ('R', 1)):
        fa = mount(arm, f'forearm.{side}', col); hd = mount(arm, f'hand.{side}', col); ft = mount(arm, f'foot.{side}', col)
        x = s * 0.219
        for k, dy in enumerate((-0.017, -0.006, 0.005, 0.015)):
            L_ = 0.05 + 0.012 * (k in (1, 2))
            skin_chain([(x, dy, 0.785), (x + s * 0.004, dy, 0.785 - L_ * 0.6), (x + s * 0.002, dy - 0.004, 0.785 - L_)], [0.0072, 0.0065, 0.0052], H['skin'], parent=hd, name='h_finger', subd=1)
        skin_chain([(x - s * 0.006, -0.02, 0.82), (x - s * 0.004, -0.034, 0.795), (x - s * 0.002, -0.04, 0.775)], [0.008, 0.007, 0.0055], H['skin'], parent=hd, name='h_thumb', subd=1)
        o = kit.box((s * 0.077, -0.05, 0.011), (0.088, 0.27, 0.022), H['sole'], name='h_sole'); o.parent = ft
        o = kit.box((s * 0.077, -0.05, 0.03), (0.082, 0.2, 0.004), H['lace'], name='h_stripe'); o.parent = ft
    # the face: eyes (whites, irises, a glint), lashes, brows, lips
    for x in (-0.031, 0.031):
        smooth_ball((x, -0.092, 0.105), (0.012, 0.007, 0.0085), H['sclera'], parent=hm, name='h_white')
        ico((x, -0.0985, 0.105), 0.0062, H['iris'], sub=2, parent=hm, name='h_iris')
        ico((x + 0.0025, -0.104, 0.108), 0.0014, H['glint'], sub=1, parent=hm, name='h_glint')
        skin_chain([(x - 0.014, -0.094, 0.108), (x, -0.1, 0.1145), (x + 0.015, -0.095, 0.11)], [0.0024, 0.0028, 0.002], H['lash'], parent=hm, name='h_lash', subd=1)
        skin_chain([(x - 0.016, -0.094, 0.127), (x + 0.002, -0.099, 0.131), (x + 0.017, -0.095, 0.128)], [0.0032, 0.0034, 0.002], H['brow'], parent=hm, name='h_brow2', subd=1)
    smooth_ball((0, -0.0985, 0.051), (0.016, 0.0065, 0.0052), H['lips'], parent=hm, name='h_lip_up')
    smooth_ball((0, -0.0975, 0.0425), (0.0145, 0.0075, 0.0062), H['lips'], parent=hm, name='h_lip_lo')
    # the hair: locks from the hairline over the head to the crown, two strands framing the face, the ponytail of three
    # twisted locks with a dark red tie
    for k in range(7):
        x0 = -0.06 + 0.02 * k
        skin_chain([(x0, -0.074, 0.17 - 0.01 * abs(x0) * 10), (x0 * 0.92, -0.02, 0.212), (x0 * 0.55, 0.045, 0.214), (x0 * 0.15, 0.085, 0.192)],
                   [0.017, 0.02, 0.019, 0.014], H['hair'], parent=hm, name='h_lock')
    for k in range(4):                                  # the fringe swept to her right: thin locks from the parting
        z0 = 0.205 - 0.008 * k
        skin_chain([(-0.03 + 0.012 * k, -0.06, z0), (0.02 + 0.01 * k, -0.088, z0 - 0.03), (0.07 + 0.004 * k, -0.075, z0 - 0.07)], [0.009, 0.011, 0.006], H['hair'], parent=hm, name='h_fringe')
    for s in (-1, 1):
        skin_chain([(s * 0.083, -0.04, 0.1), (s * 0.088, 0.005, 0.15), (s * 0.06, 0.065, 0.19), (s * 0.015, 0.088, 0.192)], [0.016, 0.019, 0.017, 0.013], H['hair'], parent=hm, name='h_lock_side')
        skin_chain([(s * 0.07, -0.07, 0.15), (s * 0.084, -0.068, 0.08), (s * 0.08, -0.058, 0.0), (s * 0.072, -0.045, -0.05)], [0.007, 0.008, 0.006, 0.002], H['hair'], parent=hm, name='h_frame')
    tl = P['tail']
    bpy.ops.mesh.primitive_torus_add(major_radius=0.02, minor_radius=0.007, location=(0, 0.008, -0.004), rotation=(math.radians(70), 0, 0))
    c = bpy.context.object; c.name = 'h_tie'; c.data.materials.append(H['tie']); c.parent = tl
    for j in range(3):
        a0 = j * 2 * math.pi / 3; pts = []; rad = []
        for i in range(7):
            u = i / 6; a = a0 + u * 2.4
            pts.append((0.012 * math.cos(a) * (1 - u * 0.5), 0.045 * math.sin(math.pi * min(1, u * 1.6)) * 1.0 + 0.012 * math.sin(a) + 0.01, -0.56 * u))
            rad.append(0.017 * (1 - u) + 0.003)
        skin_chain(pts, rad, H['hair'], parent=tl, name='h_lock_tail')


def heroine_mats(kit_mat):
    H = {'skin': skin('h_skin2'), 'jacket': leather('h_leather'), 'jeans': denim('h_denim'), 'sneak': canvas('h_canvas', (0.82, 0.82, 0.8)),
         'hair': hair('h_hair2'), 'top': plain('h_top2', (0.42, 0.04, 0.06), 0.55, bump_scale=200, bump=0.1),
         'metal': plain('h_metal', (0.7, 0.68, 0.62), 0.25, 1.0), 'belt': plain('h_belt', (0.06, 0.035, 0.022), 0.4, coat=0.2, bump_scale=300, bump=0.15),
         'pocket': denim('h_denim_pocket', (0.03, 0.05, 0.11)), 'stitch': plain('h_stitch', (0.6, 0.45, 0.2), 0.7),
         'sole': plain('h_sole', (0.32, 0.32, 0.33), 0.8, bump_scale=120, bump=0.3), 'lace': plain('h_lace', (0.55, 0.55, 0.56), 0.7),
         'sclera': plain('h_sclera', (0.82, 0.8, 0.77), 0.25), 'iris': plain('h_iris', (0.09, 0.05, 0.025), 0.15, coat=0.6),
         'glint': plain('h_glint', (1.0, 1.0, 1.0), 0.1, emit=4.0), 'lash': plain('h_lash', (0.01, 0.008, 0.008), 0.5),
         'brow': plain('h_brow', (0.05, 0.03, 0.02), 0.7), 'lips': plain('h_lips2', (0.56, 0.16, 0.18), 0.3, coat=0.4), 'tie': plain('h_tie', (0.3, 0.03, 0.04), 0.5)}
    return H
