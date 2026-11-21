# the generated body → our scale (1.68 m, feet on the floor, centred, facing −y), loose bits dropped, decimated;
# front and side orthographic renders with a 10 cm grid to read the joints off
import bpy, bmesh, sys
from mathutils import Vector
glb, blend, png = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
o = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
for c in list(bpy.context.scene.objects):
    if c is not o and c.type != 'MESH': bpy.data.objects.remove(c)
o.parent = None
bpy.context.view_layer.objects.active = o; o.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# the loose bits: keep only islands with more than 1 % of the vertices
bm = bmesh.new(); bm.from_mesh(o.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.verts.ensure_lookup_table(); bm.verts.index_update()
print('verts after weld', len(bm.verts))
seen = set(); islands = []
for v in bm.verts:
    if v.index in seen: continue
    st = [v]; isl = []; seen.add(v.index)
    while st:
        a = st.pop(); isl.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen: seen.add(b.index); st.append(b)
    islands.append(isl)
n = len(bm.verts); drop = [v for isl in islands if len(isl) < 0.01 * n for v in isl]
print('islands', sorted(len(i) for i in islands)[-6:], 'dropped', len(drop))
bmesh.ops.delete(bm, geom=drop, context='VERTS'); bm.to_mesh(o.data); bm.free()
pts = [v.co for v in o.data.vertices]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
k = 1.68 / (mx.z - mn.z)
for v in o.data.vertices: v.co = (v.co - Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))) * k
dm = o.modifiers.new('dec', 'DECIMATE'); dm.ratio = 0.3; bpy.ops.object.modifier_apply(modifier='dec')
print('faces', len(o.data.polygons))
o.name = 'iskra_body'; bpy.ops.wm.save_as_mainfile(filepath=blend)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
sc.cycles.samples = 8
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 3.0
sc.render.resolution_x = sc.render.resolution_y = 1000
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.8
for tag, loc, rot in (('front', (0, -3, 0.9), (1.5708, 0, 0)), ('side', (3, 0, 0.9), (1.5708, 0, 1.5708))):
    cam.location = loc; cam.rotation_euler = rot; sc.render.filepath = f'{png}_{tag}.png'; bpy.ops.render.render(write_still=True)
