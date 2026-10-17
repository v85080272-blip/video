"""Тайны истории №6, часть 1: «Злой город» (Козельск, 1238, Ипатьевская летопись).

The first Short told in parts (vla 17.10, YouTube's advice: 30–45 s, the hook in the first seconds, a loop instead of
an ending, the call to subscribe on a plaque): the hook is the chronicle's own mystery, the part stops on the cliffhanger
before the sortie and the «Часть 2 · подпишись» card comes up over the last line; the clip then cuts straight back
to its first frame. The epic kit from sfx/make_sfx_olga.py (80 bpm, 4-bar loops) plus the siege kit from
sfx/make_sfx_kozelsk.py.
"""
import numpy as np

DISPLAY = {
    'L1': 'ЭТОТ ГОРОД МОНГОЛЫ НЕ СМЕЛИ ДАЖЕ НАЗЫВАТЬ ПО ИМЕНИ.',
    'L2': 'ИХ ВОЙСКО УЖЕ СОЖГЛО РЯЗАНЬ, МОСКВУ И ВЛАДИМИР.',
    'L3': 'А МАЛЕНЬКИЙ ДЕРЕВЯННЫЙ КОЗЕЛЬСК ДЕРЖАЛСЯ 7{семь} НЕДЕЛЬ.',
    'L4': 'КНЯЗЮ ТАМ БЫЛО ЛЕТ 12{двенадцать}.',
    'L5': 'ЖИТЕЛИ РЕШИЛИ: КНЯЗЬ НАШ РЕБЁНОК, НО МЫ ОТДАДИМ ЗА НЕГО ЖИЗНЬ.',
    'L6': 'МОНГОЛЫ РАЗБИЛИ СТЕНУ И ПОЛЕЗЛИ НА ВАЛ. ГОРОЖАНЕ БИЛИСЬ С НИМИ НОЖАМИ.',
    'L7': 'А ПОТОМ ЗАЩИТНИКИ СДЕЛАЛИ ТО, ЧЕГО ОТ НИХ НИКТО НЕ ЖДАЛ.',
}
HILITE = {'СМЕЛИ', 'ИМЕНИ.', 'СОЖГЛО', 'МАЛЕНЬКИЙ', 'ДЕРЕВЯННЫЙ', '7', 'НЕДЕЛЬ.', '12.', 'РЕБЁНОК,', 'ЖИЗНЬ.',
          'СТЕНУ', 'НОЖАМИ.', 'НИКТО', 'ЖДАЛ.'}

# gap (s) after each line before the next one starts (voice5/tools/gaps_used.py keeps the narrator's own pauses where
# they are longer); short ones: the part is meant to run fast
GAPS = {'L1': 0.45, 'L2': 0.30, 'L3': 0.30, 'L4': 0.30, 'L5': 0.35, 'L6': 0.40, 'L7': 0.0}
LEAD_IN = 0.15
TAIL = 0.5                         # the clip ends half a second after the last word and loops back to the start
LOOP = True
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №6', year='1238', lines=['ЗЛОЙ ГОРОД'], part='ЧАСТЬ 1')
COVER_B = ['7 НЕДЕЛЬ', 'ПРОТИВ ОРДЫ']
ENDCARD = dict(tag='ТАЙНЫ ИСТОРИИ · №6', big='ЧАСТЬ 2', lines=['ПОДПИШИСЬ, ЧТОБЫ', 'НЕ ПРОПУСТИТЬ'], over_last=1.0)
SFX_DIRS = ['/home/user/work/sfx/kozelsk', '/home/user/work/sfx/olga', '/home/user/work/sfx/dance',
            '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 80.0
BEAT = 60.0 / BPM
LOOP_S = 16 * BEAT                 # the drum, choir and gusli loops are 4 bars
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
    p['hook'] = (0.0, lines['L1']['end'] + 0.2)                      # drums + choir + horses under the hook
    p['dare'] = wt('L1', 'СМЕЛИ')
    p['burn'] = wt('L2', 'СОЖГЛО')
    p['weeks'] = wt('L3', '7')
    p['story'] = (lines['L4']['start'] - 0.2, lines['L6']['start'] - 0.05)   # gusli while the town decides
    p['wall'] = wt('L6', 'СТЕНУ')
    p['cliff'] = (lines['L7']['start'] - 0.1, None)                  # the cliffhanger rises into the loop
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    spring = dict(exposure=-0.02, contrast=1.08, sat=0.85, warm=0.15, teal=0.45, demagenta=0.5)
    night = dict(exposure=0.0, contrast=1.1, sat=1.05, warm=0.7, demagenta=0.6)
    dusk = dict(exposure=0.0, contrast=1.06, sat=1.0, warm=0.55, demagenta=0.5)
    glow = lambda x, y, k=1.0: dict(x=x, y=y, r=1.1, col=(0.5 * k, 0.22 * k, 0.04 * k), flicker=0.35, rate=8.0)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.03, sway=0.5)

    # L1 hook: the horde around the little wooden town (the cover stays on until «монголы»), then the uneasy look back
    ne = wt('L1', 'НЕ') - 0.06
    l2 = L('L2')['start'] - 0.08
    add('k01_fortress_army', 0.0, ne, cam=dict(zoom=(1.0, 1.06), dolly=(0.0, 0.05), parx=(-12, 12)),
        fx=dict(fog=0.15, dust=20, beat=[hook], grade=spring))
    add('k02_mongol_uneasy', ne, l2, into='zoom', cam=dict(zoom=(1.08, 1.2), dolly=(0.0, 0.08)),
        fx=dict(dust=15, punch=[(p['dare'], 0.08)], shake=[(p['dare'], 0.6, 12)], beat=[hook],
                grade=dict(dusk, exposure=-0.04)))
    # L2 their army has already burnt Ryazan, Moscow and Vladimir
    sz = p['burn'] - 0.06
    l3 = L('L3')['start'] - 0.08
    add('k03_horde_riders', l2, sz, into='flash', cam=dict(zoom=(1.04, 1.14), dolly=(0.0, 0.08), parx=(-16, 16)),
        fx=dict(dust=40, fog=0.12, grade=spring))
    add('k04_city_burns', sz, l3, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-14, 14)),
        fx=dict(embers=80, fire=1.0, bloom=0.85, snow=30, light=glow(0.5, 0.6),
                punch=[(wt('L2', 'МОСКВУ'), 0.04), (wt('L2', 'ВЛАДИМИР'), 0.05)], grade=night))
    # L3 but little wooden Kozelsk held out for seven weeks
    w7 = p['weeks'] - 0.06
    l4 = L('L4')['start'] - 0.08
    add('k05_kozelsk_hill', l3, w7, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), pany=(0.0, -0.02)),
        fx=dict(fog=0.25, dust=15, grade=spring))
    add('k06_wall_defenders', w7, l4, into='zoom', cam=dict(zoom=(1.06, 1.16), dolly=(0.0, 0.06), parx=(-10, 10)),
        fx=dict(dust=25, fog=0.1, punch=[(p['weeks'], 0.07)], shake=[(p['weeks'], 0.5, 10)], grade=spring))
    # L4 its prince was a boy of about twelve
    l5 = L('L5')['start'] - 0.08
    add('k07_boy_prince', l4, l5, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-8, 8)),
        fx=dict(dust=20, bloom=0.4, punch=[(wt('L4', '12'), 0.05)], grade=dict(spring, warm=0.3, sat=0.95)))
    # L5 the townspeople decide: «князь наш ребёнок, но мы отдадим за него жизнь»
    no = wt('L5', 'НО') - 0.06
    l6 = L('L6')['start'] - 0.08
    add('k08_town_council', l5, no, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-14, 14)),
        fx=dict(embers=20, light=glow(0.3, 0.45, 0.7), grade=dusk))
    add('k09_old_warrior', no, l6, cam=dict(zoom=(1.06, 1.18), dolly=(0.0, 0.08)),
        fx=dict(embers=15, light=glow(0.25, 0.4, 0.8), punch=[(wt('L5', 'ЖИЗНЬ'), 0.06)], grade=dusk))
    # L6 the trebuchets break the wall; they climb the rampart; the townsmen fight them with knives
    wall = p['wall'] - 0.06
    gr = wt('L6', 'ГОРОЖАНЕ') - 0.06
    l7 = L('L7')['start'] - 0.08
    add('k10_trebuchets', l6, wall, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-14, 14)),
        fx=dict(dust=40, fog=0.15, grade=spring))
    add('k11_wall_breach', wall, gr, into='flash', cam=dict(zoom=(1.04, 1.16), dolly=(0.0, 0.1), roll=(0.0, 1.2)),
        fx=dict(dust=60, fog=0.15, punch=[(p['wall'], 0.08)], shake=[(p['wall'], 0.9, 16)],
                flash=[(p['wall'], 0.3, 0.35)], grade=spring))
    add('k12_knife_fight', gr, l7, into='zoom', cam=dict(zoom=(1.08, 1.2), dolly=(0.0, 0.08), roll=(0.0, -1.5)),
        fx=dict(embers=40, dust=30, punch=[(wt('L6', 'НОЖАМИ'), 0.07)], shake=[(wt('L6', 'НОЖАМИ'), 0.5, 10)],
                grade=dict(spring, warm=0.35)))
    # L7 the cliffhanger: the warriors wait behind the gates at night (the «Часть 2» card comes up over it)
    add('k13_behind_gates', l7, total, into='fade', cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.1), parx=(-10, 10)),
        fx=dict(embers=40, fog=0.1, light=glow(0.5, 0.55, 0.8), punch=[(wt('L7', 'НИКТО'), 0.05)], grade=night))

    cards = [
        dict(text='7', sub='НЕДЕЛЬ', start=p['weeks'], end=l4 - 0.05, y=760, count=True),
    ]
    tags = [
        dict(text='РЯЗАНЬ · МОСКВА · ВЛАДИМИР', start=sz + 0.15, end=l3 - 0.1),
        dict(text='КОЗЕЛЬСК · ВЕСНА 1238', start=l3 + 0.15, end=w7 - 0.05),
        dict(text='КНЯЗЬ ВАСИЛИЙ · ОКОЛО 12 ЛЕТ', start=l4 + 0.15, end=l5 - 0.1),
    ]
    cover = dict(start=0.0, end=wt('L1', 'МОНГОЛЫ') - 0.1)
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

    # --- hook: the horde around the town, the war drums are on
    h0, h1 = p['hook']
    loop('beds', 'war_drums', h0, h1, -4.0, fin=0.0, fout=0.06)
    loop('beds', 'choir_low', h0, h1, -9.0, fin=0.2, fout=0.1)
    loop('beds', 'cavalry', h0, L['L2']['end'], -11.0, fin=0.0, fout=0.4)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'drum_big', p['dare'], -1.0)
    put_hit(m, 'sub_drop', p['dare'], -5.0)
    # cuts get a soft whoosh, except where the music or a hit already marks them
    loud = [p['dare'], p['burn'], p['weeks'], p['wall']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- the burning cities, then the town that held out seven weeks
    l2, l3, l4 = L['L2']['start'], L['L3']['start'], L['L4']['start']
    put_hit(m, 'horn_call', l2 + 0.05, -9.0)
    loop('beds', 'war_drums_lite', l2, l4 - 0.2, -8.0, fin=0.1, fout=0.3)
    put_hit(m, 'fire_ignite', p['burn'], -4.0)
    loop('beds', 'fire_big', p['burn'], l3 + 0.2, -8.0, fin=0.1, fout=0.3)
    put_hit(m, 'drum_big', p['weeks'], -2.0)
    put_hit(m, 'sub_drop', p['weeks'], -6.0)
    # --- the story: the gusli while the town decides to stand for its boy prince
    s0, s1 = p['story']
    loop('beds', 'gusli_tune', s0, s1, -6.0, fin=0.4, fout=0.3)
    loop('beds', 'choir_low', wt('L5', 'НО') - 0.2, s1, -12.0, fin=0.5, fout=0.3)
    put_hit(m, 'impact_soft', wt('L4', '12'), -9.0)
    put_hit(m, 'drum_big', wt('L5', 'ЖИЗНЬ'), -4.0)
    # --- the assault: trebuchets, the wall breaks, the rampart, knives
    l6, l7 = L['L6']['start'], L['L7']['start']
    loop('beds', 'war_drums_lite', l6 - 0.1, l7, -7.0, fin=0.1, fout=0.2)
    loop('beds', 'battle_din', wt('L6', 'И'), l7 + 0.2, -9.0, fin=0.3, fout=0.4)
    put_hit(m, 'trebuchet_throw', l6 + 0.3, -5.0)
    put_hit(m, 'wall_crash', p['wall'], -2.0)
    put_hit(m, 'drum_big', p['wall'], -3.0)
    put_hit(m, 'arrows_volley', wt('L6', 'ПОЛЕЗЛИ'), -8.0)
    put_hit(m, 'swords_draw', wt('L6', 'ГОРОЖАНЕ'), -6.0)
    put_hit(m, 'drum_big', wt('L6', 'НОЖАМИ'), -4.0)
    # --- the cliffhanger: tension rising into the loop (the first frame starts with the boom and the drums again)
    c0 = p['cliff'][0]
    loop('beds', 'drone_bed_tension', c0, total, -8.0, fin=0.3, fout=0.03)
    loop('beds', 'war_drums_lite', c0, total, -9.0, fin=0.2, fout=0.03)
    loop('beds', 'choir_low', c0, total, -12.0, fin=0.4, fout=0.03)
    put_hit(m, 'heartbeat', c0 + 0.15, -9.0)
    put_hit(m, 'riser_2s', total - 0.02, -9.0)
    ec = tl.get('endcard')
    if ec:
        put_hit(m, 'whoosh_short', ec['start'] - 0.12, -10.0)
        put_hit(m, 'impact_soft', ec['start'], -7.0)
