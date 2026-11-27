# Photo-real surfaces for the Zone scenes (16.11, the owner: «подтянуть графон»): free CC0 scans from Poly Haven
# (polyhaven.com) — the colour, the ARM map (ambient occlusion, roughness, metal) and the normal map, 1k — box-projected
# in world space (no UVs needed, no stretching on scaled boxes), and an overcast HDRI sky for the light. The textures live
# in /home/user/work/polyhaven/<key>/{diff,arm,nor}.jpg (see README: «Графика с Poly Haven»).
import bpy, os

ROOT = os.environ.get('PH_ROOT', '/home/user/work/polyhaven')


def _img(path, cs):
    im = bpy.data.images.load(path, check_existing=True); im.colorspace_settings.name = cs; return im


def _tex(N, L, key, name, cs, vec):
    t = N.new('ShaderNodeTexImage'); t.image = _img(os.path.join(ROOT, key, f'{name}.jpg'), cs)
    t.projection = 'BOX'; t.projection_blend = 0.3; L.new(vec, t.inputs['Vector']); return t


def _vec(N, L, scale):
    geo = N.new('ShaderNodeNewGeometry'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, scale, scale)
    L.new(geo.outputs['Position'], mp.inputs['Vector']); return mp.outputs['Vector']


def set_pbr(m, key, scale=0.5, tint=None, normal=1.0, rough=1.0):
    """rebuild material m in place (it stays on its objects) from the scan `key`; scale: repeats per metre"""
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled'); L.new(b.outputs[0], out.inputs[0])
    v = _vec(N, L, scale)
    d = _tex(N, L, key, 'diff', 'sRGB', v); arm = _tex(N, L, key, 'arm', 'Non-Color', v); nor = _tex(N, L, key, 'nor', 'Non-Color', v)
    sep = N.new('ShaderNodeSeparateColor'); L.new(arm.outputs['Color'], sep.inputs[0])
    col = d.outputs['Color']
    if tint is not None:
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        L.new(col, mx.inputs['A']); mx.inputs['B'].default_value = (*tint, 1); col = mx.outputs['Result']
    ao = N.new('ShaderNodeMix'); ao.data_type = 'RGBA'; ao.blend_type = 'MULTIPLY'; ao.inputs['Factor'].default_value = 0.8
    L.new(col, ao.inputs['A']); L.new(sep.outputs['Red'], ao.inputs['B'])
    L.new(ao.outputs['Result'], b.inputs['Base Color']); rg = N.new('ShaderNodeMath'); rg.operation = 'MULTIPLY'; rg.inputs[1].default_value = rough; L.new(sep.outputs['Green'], rg.inputs[0])   # rough < 1: wet
    L.new(rg.outputs[0], b.inputs['Roughness']); L.new(sep.outputs['Blue'], b.inputs['Metallic'])
    nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal; L.new(nor.outputs['Color'], nm.inputs['Color']); L.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


def facade(m, key='panel', scale=0.4):
    """the procedural block facade (windows from a mask): its wall colour becomes the scanned concrete, with its relief"""
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    wall = next(n for n in N if n.type == 'MIX' and n.inputs['Factor'].is_linked and n.inputs['Factor'].links[0].from_node.type == 'TEX_NOISE')
    v = _vec(N, L, scale)
    d = _tex(N, L, key, 'diff', 'sRGB', v); nor = _tex(N, L, key, 'nor', 'Non-Color', v)
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 0.85
    L.new(d.outputs['Color'], mx.inputs['A']); L.new(wall.outputs['Result'], mx.inputs['B'])
    for lk in list(wall.outputs['Result'].links):
        if lk.to_node is not mx: to = lk.to_socket; L.remove(lk); L.new(mx.outputs['Result'], to)
    nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8; L.new(nor.outputs['Color'], nm.inputs['Color']); L.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m


def hdri(sc, path=None, strength=1.0, rot=0.0):
    """an overcast sky from a real HDRI photo for the ambient light and the reflections"""
    path = path or os.path.join(ROOT, 'overcast_2k.hdr')
    w = bpy.data.worlds.new('hdri'); sc.world = w; w.use_nodes = True; nt = w.node_tree; N = nt.nodes; L = nt.links
    bg = N['Background']; env = N.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(path, check_existing=True)
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value[2] = rot
    L.new(tc.outputs['Generated'], mp.inputs['Vector']); L.new(mp.outputs['Vector'], env.inputs['Vector']); L.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return bg


def overlay(m, key, scale=0.5, amount=0.6, normal=0.6, ao=0.6):
    """keep the material's own design (its colours, its bands and bricks) and lay the scan over it: the grime of the scan
    (its brightness around the middle multiplies the colour), its ambient occlusion and its relief (normal map, chained
    under the material's own bump if it has one)"""
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    v = _vec(N, L, scale)
    d = _tex(N, L, key, 'diff', 'sRGB', v); arm = _tex(N, L, key, 'arm', 'Non-Color', v); nor = _tex(N, L, key, 'nor', 'Non-Color', v)
    bw = N.new('ShaderNodeRGBToBW'); L.new(d.outputs['Color'], bw.inputs[0])
    k = N.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 2.0; L.new(bw.outputs[0], k.inputs[0])   # ≈1 on average
    sep = N.new('ShaderNodeSeparateColor'); L.new(arm.outputs['Color'], sep.inputs[0])
    base = b.inputs['Base Color']
    src = base.links[0].from_socket if base.is_linked else None
    g1 = N.new('ShaderNodeMix'); g1.data_type = 'RGBA'; g1.blend_type = 'MULTIPLY'; g1.inputs['Factor'].default_value = amount
    if src: L.new(src, g1.inputs['A'])
    else: g1.inputs['A'].default_value = base.default_value
    L.new(k.outputs[0], g1.inputs['B'])
    g2 = N.new('ShaderNodeMix'); g2.data_type = 'RGBA'; g2.blend_type = 'MULTIPLY'; g2.inputs['Factor'].default_value = ao
    L.new(g1.outputs['Result'], g2.inputs['A']); L.new(sep.outputs['Red'], g2.inputs['B'])
    L.new(g2.outputs['Result'], base)
    if normal > 0:
        nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = normal; L.new(nor.outputs['Color'], nm.inputs['Color'])
        nin = b.inputs['Normal']
        if nin.is_linked and nin.links[0].from_node.type == 'BUMP': L.new(nm.outputs['Normal'], nin.links[0].from_node.inputs['Normal'])
        else: L.new(nm.outputs['Normal'], nin)
    return m
