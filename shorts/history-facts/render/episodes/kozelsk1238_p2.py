"""Тайны истории №6, часть 2: «Злой город» (Козельск, 1238, Ипатьевская летопись, Рашид ад-Дин).

Opens with a one-line recap that works for viewers who missed part 1, then the sortie, the fall of the town, the boy
prince never found and the name «злой город»; the question for the comments carries the «Подпишись» card and the clip
loops back to its first frame (vla 17.10, YouTube's advice). Same kits as part 1.
"""
import numpy as np

DISPLAY = {
    'L1': '7{Семь} НЕДЕЛЬ ОГРОМНОЕ ВОЙСКО НЕ МОГЛО ВЗЯТЬ МАЛЕНЬКИЙ ДЕРЕВЯННЫЙ КОЗЕЛЬСК.',
    'L2': 'И ТОГДА ЕГО ЗАЩИТНИКИ САМИ ВЫШЛИ ИЗ ВОРОТ, ИЗРУБИЛИ ОСАДНЫЕ МАШИНЫ И УБИЛИ 4000{четыре тысячи} ВРАГОВ.',
    'L3': 'НО И САМИ ПОГИБЛИ.',
    'L4': 'ГОРОД ВЗЯЛИ, ТОЛЬКО КОГДА К МОНГОЛАМ ПОДОШЛО ПОДКРЕПЛЕНИЕ.',
    'L5': 'МОНГОЛЫ НЕ ПОЩАДИЛИ НИКОГО, ДАЖЕ МЛАДЕНЦЕВ.',
    'L6': 'МАЛЬЧИКА-КНЯЗЯ ТАК И НЕ НАШЛИ. ГОВОРИЛИ, ОН УТОНУЛ В КРОВИ.',
    'L7': 'А КОЗЕЛЬСК МОНГОЛЫ С ТЕХ ПОР НАЗЫВАЛИ ЗЛЫМ ГОРОДОМ.',
    'L8': 'КАК ДУМАЕШЬ, ТЫ БЫ ОТКРЫЛ ВОРОТА ВРАГУ ИЛИ СТОЯЛ ДО КОНЦА?',
}
HILITE = {'7', 'МАЛЕНЬКИЙ', 'ДЕРЕВЯННЫЙ', 'ВОРОТ,', 'ИЗРУБИЛИ', '4000', 'ПОГИБЛИ.', 'ПОДКРЕПЛЕНИЕ.', 'НИКОГО,',
          'МЛАДЕНЦЕВ.', 'НАШЛИ.', 'КРОВИ.', 'ЗЛЫМ', 'ГОРОДОМ.', 'КОНЦА?'}

GAPS = {'L1': 0.40, 'L2': 0.30, 'L3': 0.55, 'L4': 0.30, 'L5': 0.40, 'L6': 0.40, 'L7': 0.40, 'L8': 0.0}
LEAD_IN = 0.15
TAIL = 0.5                         # the clip ends half a second after the question and loops back to the start
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №6', year='1238', lines=['ЗЛОЙ ГОРОД'], part='ЧАСТЬ 2')
COVER_B = ['КНЯЗЯ ТАК', 'И НЕ НАШЛИ']
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №6', over_last=1.0)     # «Подпишись, чтобы не пропускать другие истории»
SFX_DIRS = ['/home/user/work/sfx/kozelsk', '/home/user/work/sfx/olga', '/home/user/work/sfx/dance',
            '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 80.0
BEAT = 60.0 / BPM
LOOP_S = 16 * BEAT
SR = 48000


def _wt(words, lines, lid, prefix, nth=0):
    k = 0
    for w, a, b in words[lid]:
        if w.startswith(prefix):
            if k == nth:
                return a
            k += 1
    return lines[lid]['start']


def plan(lines, words):
    """Music sections and sync points shared by the picture (camera beats) and the mix."""
    wt = lambda *a, **k: _wt(words, lines, *a, **k)
    p = {}
    p['hook'] = (0.0, lines['L1']['end'] + 0.1)
    p['horde'] = wt('L1', 'ВОЙСКО')
    p['sortie'] = (wt('L2', 'ВЫШЛИ') - 0.1, lines['L3']['start'] - 0.05)    # out of the gates: the climax
    p['chop'] = wt('L2', 'ИЗРУБИЛИ')
    p['4000'] = wt('L2', '4000')
    p['fell'] = lines['L3']['start'] - 0.05                          # everything stops: «но и сами погибли»
    p['evil'] = wt('L7', 'ЗЛЫМ')
    p['outro'] = (lines['L8']['start'] - 0.1, None)
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    spring = dict(exposure=-0.02, contrast=1.08, sat=0.85, warm=0.15, teal=0.45, demagenta=0.5)
    night = dict(exposure=0.0, contrast=1.1, sat=1.05, warm=0.7, demagenta=0.6)
    dusk = dict(exposure=0.0, contrast=1.06, sat=1.0, warm=0.55, demagenta=0.5)
    ash = dict(exposure=-0.04, contrast=1.08, sat=0.7, warm=0.25, teal=0.3, demagenta=0.5)
    glow = lambda x, y, k=1.0: dict(x=x, y=y, r=1.1, col=(0.5 * k, 0.22 * k, 0.04 * k), flicker=0.35, rate=8.0)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.03, sway=0.5)
    sortie = _beat(p['sortie'], p['sortie'][1], zoom=0.035, sway=0.6)
    ravens = lambda seed, n=14: [dict(n=n, seed=seed, dir=(1.0, -0.15), speed=120.0, size=(10.0, 46.0), dur=6.0,
                                      area=(0.0, 0.05, 1.0, 0.45))]

    # L1 recap hook: the horde around the town (the cover stays on until «огромное»), the riders, the little town
    hd = p['horde'] - 0.06
    ml = wt('L1', 'МАЛЕНЬКИЙ') - 0.06
    l2 = L('L2')['start'] - 0.08
    add('k01_fortress_army', 0.0, hd, cam=dict(zoom=(1.06, 1.0), dolly=(0.05, 0.0), parx=(12, -12)),
        fx=dict(fog=0.15, dust=20, beat=[hook], grade=spring))
    add('k03_horde_riders', hd, ml, into='flash', cam=dict(zoom=(1.04, 1.14), dolly=(0.0, 0.08), parx=(-16, 16)),
        fx=dict(dust=40, fog=0.12, beat=[hook], grade=spring))
    add('k05_kozelsk_hill', ml, l2, into='zoom', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), pany=(0.0, -0.02)),
        fx=dict(fog=0.25, dust=15, punch=[(wt('L1', 'КОЗЕЛЬСК'), 0.05)], beat=[hook], grade=spring))
    # L2 the sortie at night: out of the gates, the siege engines destroyed, four thousand enemies killed
    iz = p['chop'] - 0.06
    ub = wt('L2', 'УБИЛИ') - 0.06
    l3 = L('L3')['start'] - 0.08
    add('k14_gates_sortie', l2, iz, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.1), parx=(-12, 12)),
        fx=dict(embers=50, fog=0.1, light=glow(0.5, 0.55, 0.8), punch=[(wt('L2', 'ВЫШЛИ'), 0.05)], beat=[sortie],
                grade=night))
    add('k15_trebuchet_axes', iz, ub, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-14, 14)),
        fx=dict(embers=110, fire=1.0, bloom=0.9, light=glow(0.5, 0.5), flash=[(p['chop'], 0.5, 0.6)],
                shake=[(p['chop'], 0.8, 12)], beat=[sortie], grade=night))
    add('k16_night_battle', ub, l3, into='flash', cam=dict(zoom=(1.04, 1.16), dolly=(0.0, 0.1), roll=(0.0, 1.5)),
        fx=dict(embers=90, fire=0.8, bloom=0.8, light=glow(0.5, 0.6), punch=[(p['4000'], 0.08)],
                shake=[(p['4000'], 0.7, 14)], beat=[sortie], grade=night))
    # L3 «но и сами погибли»: silence, a broken shield at dawn
    l4 = L('L4')['start'] - 0.08
    add('k17_fallen_shield', l3, l4, into='fade', cam=dict(zoom=(1.1, 1.2), dolly=(0.0, 0.06)),
        fx=dict(fog=0.15, ash=25, punch=[(wt('L3', 'ПОГИБЛИ'), 0.04)], blackout=(L('L3')['end'] + 0.2, l4),
                grade=ash))
    # L4 the town fell only when the reinforcements came over the hill
    tk = wt('L4', 'ТОЛЬКО') - 0.06
    l5 = L('L5')['start'] - 0.08
    add('k11_wall_breach', l4, tk, into='fade', cam=dict(zoom=(1.18, 1.26), panx=(0.03, 0.02), dolly=(0.0, 0.05)),
        fx=dict(dust=40, fog=0.2, grade=dict(spring, exposure=-0.04)))
    add('k18_reinforcements', tk, l5, cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-14, 14)),
        fx=dict(dust=40, fog=0.2, bloom=0.5, punch=[(wt('L4', 'ПОДКРЕПЛЕНИЕ'), 0.05)], grade=dict(dusk, warm=0.45)))
    # L5 no one was spared, not even the babies
    dz = wt('L5', 'ДАЖЕ') - 0.06
    l6 = L('L6')['start'] - 0.08
    add('k19_town_burns', l5, dz, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(embers=100, fire=1.0, bloom=0.85, light=glow(0.5, 0.6), punch=[(wt('L5', 'НИКОГО'), 0.06)],
                grade=night))
    add('k20_empty_cradle', dz, l6, into='fade', cam=dict(zoom=(1.06, 1.16), dolly=(0.0, 0.06)),
        fx=dict(ash=40, embers=15, fog=0.1, grade=dict(ash, warm=0.4)))
    # L6 the boy prince was never found; «он утонул в крови» (part 1's portrait, darker and closer)
    gv = wt('L6', 'ГОВОРИЛИ') - 0.06
    l7 = L('L7')['start'] - 0.08
    add('k07_boy_prince', l6, gv, into='fade', cam=dict(zoom=(1.22, 1.32), pany=(-0.03, -0.04), dolly=(0.0, 0.04)),
        fx=dict(ash=25, fog=0.1, grade=dict(ash, exposure=-0.06, sat=0.55)))
    add('k21_cap_in_mud', gv, l7, cam=dict(zoom=(1.06, 1.18), dolly=(0.0, 0.08)),
        fx=dict(embers=20, ash=20, punch=[(wt('L6', 'КРОВИ'), 0.06)], grade=dict(ash, warm=0.45, sat=0.8)))
    # L7 the khan looks at the ruins; «злым городом»: ravens over the ashes
    ev = p['evil'] - 0.06
    l8 = L('L8')['start'] - 0.08
    add('k22_khan_ruins', l7, ev, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-10, 10)),
        fx=dict(ash=20, fog=0.15, bloom=0.5, grade=dict(dusk, sat=0.85), birds=ravens(41)))
    add('k23_ruins_wide', ev, l8, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(ash=40, fog=0.2, punch=[(p['evil'], 0.08)], shake=[(p['evil'], 0.6, 12)], grade=ash,
                birds=ravens(42, n=18)))
    # L8 would you open the gates to the enemy, or stand to the end? (the «Подпишись» card comes up over it)
    il = wt('L8', 'ИЛИ') - 0.06
    add('k24_gates_guard', l8, il, into='fade', cam=dict(zoom=(1.04, 1.14), dolly=(0.0, 0.08)),
        fx=dict(embers=30, fog=0.1, light=glow(0.5, 0.35, 0.7), grade=dusk))
    add('k25_boy_campfires', il, total, cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), pany=(0.0, -0.02)),
        fx=dict(embers=25, bloom=0.5, grade=dusk))

    cards = [
        dict(text='4000', sub='ВРАГОВ', start=p['4000'], end=l3 - 0.05, y=760, count=True, count_dur=0.6),
        dict(text='ЗЛОЙ', sub='ГОРОД', start=p['evil'], end=l8 - 0.05, y=760),
    ]
    tags = [
        dict(text='КАДАН И БУРИ · МАЙ 1238', start=tk + 0.15, end=l5 - 0.1),
        dict(text='ИПАТЬЕВСКАЯ ЛЕТОПИСЬ', start=gv + 0.15, end=l7 - 0.1),
    ]
    cover = dict(start=0.0, end=wt('L1', 'ОГРОМНОЕ') - 0.1)
    return dict(cards=cards, tags=tags, cover=cover)


def mix_cues(m, tl, a):
    L = tl['lines']
    put_hit, sfx, wt = a.put_hit, a.sfx, a.wt
    p = plan(L, tl['words'])
    total = tl['total']

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % (len(x) / SR)) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # --- hook: the horde, the war drums are on
    h0, h1 = p['hook']
    loop('beds', 'war_drums', h0, h1, -4.0, fin=0.0, fout=0.06)
    loop('beds', 'choir_low', h0, h1, -9.0, fin=0.2, fout=0.1)
    loop('beds', 'cavalry', h0, h1 + 0.3, -11.0, fin=0.0, fout=0.4)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'drum_big', p['horde'], -3.0)
    put_hit(m, 'impact_soft', wt('L1', 'КОЗЕЛЬСК'), -8.0)
    # cuts get a soft whoosh, except where the music or a hit already marks them
    loud = [p['horde'], p['chop'], p['4000'], p['evil'], wt('L2', 'ВЫШЛИ')]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud) or abs(c - p['fell']) < 0.4:
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the sortie: the gate creaks open, the war drums and choir at full, the siege engines destroyed
    r0, r1 = p['sortie']
    put_hit(m, 'gate_creak', r0 - 0.15, -4.0)
    loop('beds', 'war_drums_lite', L['L2']['start'] - 0.1, r0, -8.0, fin=0.1, fout=0.05)
    loop('beds', 'war_drums', r0, r1, -3.0, fin=0.05, fout=0.05)
    loop('beds', 'choir_low', r0, r1, -7.0, fin=0.3, fout=0.05)
    loop('beds', 'battle_din', r0, r1, -8.0, fin=0.2, fout=0.05)
    put_hit(m, 'drum_big', r0 + 0.1, -2.0)
    put_hit(m, 'fire_ignite', p['chop'], -2.0)
    put_hit(m, 'stone_hit', p['chop'] + 0.05, -6.0)
    loop('beds', 'fire_big', p['chop'], r1, -6.0, fin=0.1, fout=0.05)
    put_hit(m, 'drum_big', p['4000'], -1.0)
    put_hit(m, 'sub_drop', p['4000'], -5.0)
    # --- «но и сами погибли»: the music is cut, only wind and a heartbeat
    l3 = L['L3']
    loop('beds', 'ambience_wind_dead_forest', p['fell'], L['L4']['start'] + 0.3, -6.0, fin=0.05, fout=0.6)
    loop('beds', 'choir_low', p['fell'] + 0.1, L['L4']['start'], -15.0, fin=0.5, fout=0.4)
    put_hit(m, 'impact_soft', wt('L3', 'ПОГИБЛИ'), -7.0)
    put_hit(m, 'heartbeat', l3['end'] + 0.25, -7.0)
    # --- the reinforcements: a horn over the hill, the horses, the slow drums
    l4, l5 = L['L4']['start'], L['L5']['start']
    tk = wt('L4', 'ТОЛЬКО')
    loop('beds', 'drone_bed_tension', l4, l5, -10.0, fin=0.3, fout=0.3)
    put_hit(m, 'horn_call', tk, -6.0)
    loop('beds', 'cavalry', tk - 0.1, l5 + 0.2, -7.0, fin=0.3, fout=0.4)
    loop('beds', 'war_drums_lite', tk, l5, -8.0, fin=0.2, fout=0.2)
    # --- no one spared: fire, then only the choir over the cradle
    dz = wt('L5', 'ДАЖЕ')
    loop('beds', 'fire_big', l5, L['L6']['start'] + 0.3, -7.0, fin=0.1, fout=0.8)
    loop('beds', 'war_drums_lite', l5, dz, -8.0, fin=0.05, fout=0.15)
    put_hit(m, 'drum_big', wt('L5', 'НИКОГО'), -4.0)
    loop('beds', 'choir_low', dz - 0.1, L['L7']['start'], -10.0, fin=0.4, fout=0.5)
    put_hit(m, 'heartbeat', L['L5']['end'] + 0.25, -8.0)
    # --- the boy was never found
    l6, l7 = L['L6']['start'], L['L7']['start']
    loop('beds', 'drone_bed_tension', l6, l7, -10.0, fin=0.4, fout=0.4)
    loop('beds', 'ambience_wind_dead_forest', l6, l7 + 0.3, -9.0, fin=0.4, fout=0.6)
    put_hit(m, 'impact_soft', wt('L6', 'КРОВИ'), -7.0)
    put_hit(m, 'sub_drop', wt('L6', 'КРОВИ'), -7.0)
    # --- «злым городом»: ravens, the war drums and the choir once more
    ev = p['evil']
    put_hit(m, 'ravens', l7 + 0.15, -7.0)
    loop('beds', 'ambience_wind_dead_forest', l7, ev, -8.0, fin=0.3, fout=0.2)
    loop('beds', 'war_drums', ev, L['L8']['start'] + 0.2, -4.0, fin=0.0, fout=0.5)
    loop('beds', 'choir_low', ev, L['L8']['start'] + 0.2, -7.0, fin=0.2, fout=0.5)
    put_hit(m, 'drum_big', ev, -1.0)
    put_hit(m, 'sub_drop', ev, -5.0)
    put_hit(m, 'ravens', ev + 0.4, -9.0)
    # --- the question: the gusli comes back and rises into the loop
    o0 = p['outro'][0]
    loop('beds', 'gusli_tune', o0, total, -7.0, fin=0.5, fout=0.03)
    loop('beds', 'choir_low', L['L8']['start'], total, -13.0, fin=0.8, fout=0.03)
    put_hit(m, 'horn_call', wt('L8', 'ИЛИ'), -12.0)
    put_hit(m, 'riser_2s', total - 0.02, -10.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
        put_hit(m, 'impact_soft', ec['start'], -7.0)
