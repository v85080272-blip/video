# A seamless rigged human for the 3D episodes: a skeleton graph of points with radii → the Skin modifier → subdivision →
# applied to a real mesh, coloured by region (jacket, jeans, skin, shoes), bound to an armature by automatic weights.
# Returns the armature object and its pose bones in the shape the walk/pose helpers expect:
# P = dict(root, hips[L,R] (thighs), knees[L,R] (shins), arms[L,R] (upper arms), elbows[L,R] (forearms), spine, head, tail)
import bpy, bmesh, math
from mathutils import Vector

# the joints (x, y, z) facing −y, and the radii (rx, ry); a few in-between points keep the shape
def skeleton(h=1.68, slim=1.0, stoop=0.0, hipw=1.0):
    k = h / 1.68
    J = {
        'pelvis': ((0, 0, 0.93), (0.155 * hipw, 0.115)), 'waist': ((0, 0, 1.06), (0.118 * slim, 0.088)), 'chest': ((0, -0.006, 1.22), (0.148, 0.105)),
        'shoulders': ((0, 0.0, 1.36), (0.13, 0.085)), 'neck': ((0, 0.005, 1.45), (0.04, 0.038)), 'headbase': ((0, 0.005, 1.5), (0.037, 0.036)),
    }
    for s, x in (('L', -1), ('R', 1)):
        J.update({f'hip{s}': ((x * 0.088 * hipw, 0, 0.88), (0.088, 0.088)), f'thigh{s}': ((x * 0.086, 0, 0.68), (0.068, 0.07)), f'knee{s}': ((x * 0.082, 0, 0.48), (0.05, 0.052)),
                  f'calf{s}': ((x * 0.08, 0.008, 0.33), (0.05, 0.052)), f'ankle{s}': ((x * 0.077, 0, 0.08), (0.034, 0.036)), f'toe{s}': ((x * 0.077, -0.14, 0.035), (0.04, 0.03)),
                  f'heel{s}': ((x * 0.077, 0.03, 0.04), (0.038, 0.034)),
                  f'shoulder{s}': ((x * 0.175, 0, 1.37), (0.052, 0.05)), f'elbow{s}': ((x * 0.205, 0.01, 1.1), (0.04, 0.04)), f'wrist{s}': ((x * 0.215, 0, 0.86), (0.029, 0.026)),
                  f'hand{s}': ((x * 0.218, -0.008, 0.77), (0.03, 0.02))})
    J = {n: (Vector(p) * k, (r[0] * k, r[1] * k)) for n, (p, r) in J.items()}
    E = [('pelvis', 'waist'), ('waist', 'chest'), ('chest', 'shoulders'), ('shoulders', 'neck'), ('neck', 'headbase')]
    for s in 'LR':
        E += [('pelvis', f'hip{s}'), (f'hip{s}', f'thigh{s}'), (f'thigh{s}', f'knee{s}'), (f'knee{s}', f'calf{s}'), (f'calf{s}', f'ankle{s}'), (f'ankle{s}', f'toe{s}'), (f'ankle{s}', f'heel{s}'),
              ('shoulders', f'shoulder{s}'), (f'shoulder{s}', f'elbow{s}'), (f'elbow{s}', f'wrist{s}'), (f'wrist{s}', f'hand{s}')]
    return J, E

BONES = [  # name, head joint, tail joint, parent
    ('hips', 'pelvis', 'waist', None), ('spine', 'waist', 'chest', 'hips'), ('chest', 'chest', 'neck', 'spine'), ('neck', 'neck', 'headbase', 'chest'),
    ('head', 'headbase', None, 'neck'),
    ('thigh.L', 'hipL', 'kneeL', 'hips'), ('shin.L', 'kneeL', 'ankleL', 'thigh.L'), ('foot.L', 'ankleL', 'toeL', 'shin.L'),
    ('thigh.R', 'hipR', 'kneeR', 'hips'), ('shin.R', 'kneeR', 'ankleR', 'thigh.R'), ('foot.R', 'ankleR', 'toeR', 'shin.R'),
    ('upperarm.L', 'shoulderL', 'elbowL', 'chest'), ('forearm.L', 'elbowL', 'wristL', 'upperarm.L'), ('hand.L', 'wristL', 'handL', 'forearm.L'),
    ('upperarm.R', 'shoulderR', 'elbowR', 'chest'), ('forearm.R', 'elbowR', 'wristR', 'upperarm.R'), ('hand.R', 'wristR', 'handR', 'forearm.R'),
]
# which material a point of the body gets: by the nearest bone
REGION = {'hips': 'legs', 'thigh.L': 'legs', 'shin.L': 'legs', 'thigh.R': 'legs', 'shin.R': 'legs', 'foot.L': 'shoes', 'foot.R': 'shoes',
          'spine': 'top', 'chest': 'top', 'upperarm.L': 'top', 'forearm.L': 'top', 'upperarm.R': 'top', 'forearm.R': 'top',
          'hand.L': 'skin', 'hand.R': 'skin', 'neck': 'skin', 'head': 'skin'}


def build(name, mats, h=1.68, slim=1.0, hipw=1.0, subd=2):
    """mats: dict legs/shoes/top/skin → material. Returns (armature object, body mesh object, joints)"""
    J, E = skeleton(h, slim, hipw=hipw)
    names = list(J)
    me = bpy.data.meshes.new(name + '_body')
    me.from_pydata([tuple(J[n][0]) for n in names], [(names.index(a), names.index(b)) for a, b in E], [])
    body = bpy.data.objects.new(name + '_body', me); bpy.context.scene.collection.objects.link(body)
    sk = body.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True; sk.branch_smoothing = 0.6
    sv = me.skin_vertices[0].data
    for i, n in enumerate(names):
        sv[i].radius = J[n][1]
    sv[names.index('pelvis')].use_root = True
    sd = body.modifiers.new('subd', 'SUBSURF'); sd.levels = subd; sd.render_levels = subd
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); nm = bpy.data.meshes.new_from_object(ev)
    body.modifiers.clear(); body.data = nm; bpy.data.meshes.remove(me)
    for p in body.data.polygons: p.use_smooth = True
    # the armature
    ad = bpy.data.armatures.new(name + '_rig'); arm = bpy.data.objects.new(name, ad); bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for bn, a, b, par in BONES:
        e = ad.edit_bones.new(bn); e.head = J[a][0]
        e.tail = J[b][0] if b else J[a][0] + Vector((0, 0, 0.22 * h / 1.68))
        e.roll = 0.0
        if par: e.parent = eb[par]; e.use_connect = False
        eb[bn] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    # materials by region, then the binding by heat
    order = ['top', 'legs', 'shoes', 'skin'] + (['belt'] if 'belt' in mats else [])
    for k in order: body.data.materials.append(mats[k])
    segs = [(bn, J[a][0], (J[b][0] if b else J[a][0] + Vector((0, 0, 0.2)))) for bn, a, b, _ in BONES]
    def nearest(p):
        best, bd = None, 1e9
        for bn, a, b in segs:
            ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared))); d = (a + ab * t - p).length
            if d < bd: best, bd = bn, d
        return best
    for poly in body.data.polygons:
        c = poly.center; bn = nearest(c)
        reg = REGION[bn]
        if bn in ('hips',) and c.z > 0.98 * h / 1.68: reg = 'top'                         # the jacket comes down over the hips
        elif 'belt' in mats and reg == 'legs' and 0.945 * h / 1.68 < c.z <= 0.98 * h / 1.68: reg = 'belt'   # a belt below the jacket
        poly.material_index = order.index(reg)
    bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for pb in arm.pose.bones: pb.rotation_mode = 'XYZ'
    return arm, body, J


def bone_child(arm, bone, obj, loc=(0, 0, 0)):
    """parent an object to a bone (its tail), keeping `loc` as the offset from the bone's tail in the bone's space"""
    obj.parent = arm; obj.parent_type = 'BONE'; obj.parent_bone = bone; obj.location = loc
    return obj
