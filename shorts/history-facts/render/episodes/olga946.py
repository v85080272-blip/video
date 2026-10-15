"""Тайны истории №3: «Месть княгини Ольги» (945–946, «Повесть временных лет»).

The epic kit from sfx/make_sfx_olga.py (80 bpm, 4-bar loops): war drums under the hook and the burning town,
a gusli ostinato while the story is told, a low choir, fire, wings. The flock with glowing embers is drawn by
engine.Birds (fx 'birds'), so the birds really fly over the town in the hook and in the climax.
"""
import numpy as np

DISPLAY = {
    'L1': 'В 946{девятьсот сорок шестом} ГОДУ КНЯГИНЯ ОЛЬГА СОЖГЛА ЦЕЛЫЙ ГОРОД. ГОЛУБЯМИ И ВОРОБЬЯМИ.',
    'L2': 'ЭТО БЫЛА ЕЁ ЧЕТВЁРТАЯ МЕСТЬ.',
    'L3': 'ГОДОМ РАНЬШЕ ЛЕСНОЕ ПЛЕМЯ УБИЛО ЕЁ МУЖА, КНЯЗЯ ИГОРЯ.',
    'L4': 'И ПРИСЛАЛО ВДОВЕ 20{двадцать} СВАТОВ: ВЫХОДИ ЗА НАШЕГО КНЯЗЯ!',
    'L5': 'ОЛЬГА ОТВЕТИЛА ЛАСКОВО: ЗАВТРА ВАС С ПОЧЁТОМ ПОНЕСУТ КО МНЕ В ЛОДКЕ.',
    'L6': 'ЛОДКУ СО СВАТАМИ СБРОСИЛИ В ЯМУ. И ЗАКОПАЛИ ЖИВЫМИ.',
    'L7': 'ВТОРЫХ ПОСЛОВ ОНА ПОЗВАЛА В БАНЮ. ДВЕРИ ЗАКРЫЛИ — И ПОДОЖГЛИ.',
    'L8': 'ПОТОМ ПРИШЛА К НИМ НА ПОМИНКИ МУЖА. ОНИ НАПИЛИСЬ, И ЕЁ ВОИНЫ ПЕРЕБИЛИ 5000{пять тысяч}.',
    'L9': 'ИХ ГЛАВНЫЙ ГОРОД ДЕРЖАЛСЯ ВСЁ ЛЕТО.',
    'L10': 'ТОГДА ОЛЬГА ПОПРОСИЛА СКРОМНУЮ ДАНЬ: С КАЖДОГО ДВОРА ПО 3{три} ГОЛУБЯ И 3{три} ВОРОБЬЯ.',
    'L11': 'К КАЖДОЙ ПТИЦЕ ПРИВЯЗАЛИ ТЛЕЮЩИЙ ТРУТ — И ВЕЧЕРОМ ОТПУСТИЛИ.',
    'L12': 'ПТИЦЫ ПОЛЕТЕЛИ ДОМОЙ, ПОД КРЫШИ. И НЕ ОСТАЛОСЬ ДВОРА, ГДЕ БЫ НЕ ГОРЕЛО.',
    'L13': 'НО ТУ ЖЕ ХИТРОСТЬ САГИ ПРИПИСЫВАЮТ НОРВЕЖСКОМУ КОРОЛЮ. А ОН НЕСКОЛЬКО ЛЕТ ПРОЖИЛ В КИЕВЕ.',
    'L14': 'ТАК КТО У КОГО ВЗЯЛ ЭТУ ИСТОРИЮ: ЛЕТОПИСЕЦ У ВИКИНГОВ — ИЛИ НАОБОРОТ? КАК ДУМАЕШЬ?',
}
HILITE = {'946', 'ГОЛУБЯМИ', 'ВОРОБЬЯМИ.', 'ЧЕТВЁРТАЯ', 'УБИЛО', '20', 'ЛОДКЕ.', 'ЖИВЫМИ.', 'ПОДОЖГЛИ.', '5000.',
          'ЛЕТО.', 'ГОЛУБЯ', 'ВОРОБЬЯ.', 'ТРУТ', 'ГОРЕЛО.', 'КИЕВЕ.', 'НАОБОРОТ?'}

# gap (s) after each line before the next one starts (with a continuous read: voice5/tools/gaps_used.py keeps the
# narrator's own pauses and these long dramatic ones)
GAPS = {'L1': 0.30, 'L2': 0.60, 'L3': 0.30, 'L4': 0.30, 'L5': 0.30, 'L6': 0.70, 'L7': 0.55, 'L8': 0.60,
        'L9': 0.30, 'L10': 0.30, 'L11': 0.30, 'L12': 0.70, 'L13': 0.35, 'L14': 0.0}
LEAD_IN = 0.25
TAIL = 2.0
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №3', year='946', lines=['СОЖГЛА ГОРОД', 'ПТИЦАМИ?'])
COVER_B = ['МЕСТЬ', 'КНЯГИНИ ОЛЬГИ']
SFX_DIRS = ['/home/user/work/sfx/olga', '/home/user/work/sfx/dance', '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 80.0
BEAT = 60.0 / BPM
LOOP_S = 16 * BEAT                 # the drum and gusli loops are 4 bars
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
    p['hook'] = (0.0, lines['L2']['end'] + 0.05)                     # drums + choir + fire under the hook
    p['fourth'] = wt('L2', 'ЧЕТВЁРТАЯ')
    p['story'] = (lines['L4']['start'] - 0.2, wt('L6', 'СБРОСИЛИ'))  # gusli while the matchmakers come
    p['drop'] = wt('L6', 'СБРОСИЛИ')
    p['fire'] = wt('L12', 'И') - 0.06                                # the whole town catches fire
    p['climax'] = (p['fire'], lines['L12']['end'] + 0.9)
    p['outro'] = (lines['L13']['start'] - 0.1, None)
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=2 * BEAT, **k)


def layout(c):
    L, add, wt, total = c.L, c.add, c.word_t, c.total
    p = plan(c.lines, c.words)
    night = dict(exposure=0.0, contrast=1.1, sat=1.05, warm=0.7, demagenta=0.6)
    dusk = dict(exposure=0.0, contrast=1.06, sat=1.0, warm=0.6, demagenta=0.5)
    forest = dict(exposure=-0.06, contrast=1.06, sat=0.85, teal=0.6, demagenta=0.5)
    glow = lambda x, y, k=1.0: dict(x=x, y=y, r=1.1, col=(0.5 * k, 0.22 * k, 0.04 * k), flicker=0.35, rate=8.0)
    hook = _beat(p['hook'], p['hook'][1], zoom=0.03, sway=0.5)
    climax = _beat(p['climax'], p['climax'][1], zoom=0.035, sway=0.6)

    # L1 hook: the town burns under a flock carrying embers (the cover stays on until «княгиня»)
    k1 = wt('L1', 'КНЯГИНЯ') - 0.06
    s1 = wt('L1', 'СОЖГЛА') - 0.06
    g1 = wt('L1', 'ГОЛУБЯМИ') - 0.06
    l2 = L('L2')['start'] - 0.08
    add('o01_city_birds_s101', 0.0, k1, cam=dict(zoom=(1.0, 1.06), dolly=(0.0, 0.05), parx=(-12, 12)),
        fx=dict(embers=70, fire=0.9, bloom=0.85, light=glow(0.5, 0.75), beat=[hook], grade=night,
                birds=[dict(n=30, seed=11, dir=(1.0, -0.3), speed=220.0, ember=1.0, dur=4.0, area=(0.0, 0.05, 1.0, 0.55),
                            t0=0.0)]))
    add('o02_olga_s102', k1, s1, into='flash', cam=dict(zoom=(1.04, 1.12), dolly=(0.0, 0.06)),
        fx=dict(embers=40, bloom=0.6, light=glow(0.3, 0.6, 0.8), beat=[hook], grade=night))
    add('o18b_street_fire_s318', s1, g1, into='zoom', cam=dict(zoom=(1.0, 1.1), pany=(0.0, -0.02), parx=(-14, 14)),
        fx=dict(embers=90, fire=1.0, bloom=0.9, punch=[(wt('L1', 'ГОРОД'), 0.06)], beat=[hook], grade=night))
    add('o16_release_s116', g1, l2, cam=dict(zoom=(1.06, 1.16), dolly=(0.0, 0.06), pany=(0.01, -0.02)),
        fx=dict(embers=50, bloom=0.8, beat=[hook], grade=night,
                birds=[dict(n=40, seed=12, dir=(0.4, -1.0), speed=300.0, ember=1.2, dur=3.0, area=(0.0, 0.1, 1.0, 0.9))]))
    # L2 «это была её четвёртая месть»: her face, a heavy hit on «четвёртая», then dark
    ch = p['fourth']
    l3 = L('L3')['start'] - 0.1
    add('o02_olga_s202', l2, l3, into='zoom', cam=dict(zoom=(1.12, 1.24), dolly=(0.0, 0.08)),
        fx=dict(embers=30, bloom=0.5, punch=[(ch, 0.08)], shake=[(ch, 0.6, 12)], light=glow(0.7, 0.5, 0.7),
                blackout=(L('L2')['end'] + 0.15, l3), grade=dict(night, exposure=-0.02)))
    # L3 a year earlier: Igor rides into the forest; the forest tribe on «убило»
    ub = wt('L3', 'УБИЛО')
    l4 = L('L4')['start'] - 0.08
    add('o03_igor_ride', l3, ub - 0.06, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.08), parx=(-16, 16)),
        fx=dict(fog=0.3, dust=20, grade=forest))
    add('o04_forest_tribe', ub - 0.06, l4, cam=dict(zoom=(1.04, 1.16), dolly=(0.0, 0.1), parx=(10, -10)),
        fx=dict(fog=0.25, punch=[(ub, 0.07)], shake=[(ub, 0.5, 10)], grade=forest))
    # L4 twenty matchmakers come by boat: «выходи за нашего князя!»
    vy = wt('L4', 'ВЫХОДИ') - 0.06
    l5 = L('L5')['start'] - 0.08
    river = dict(exposure=0.02, contrast=1.04, sat=0.95, warm=0.3, teal=0.3, demagenta=0.4)
    add('o05b_envoys_river_s405', l4, vy, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-14, 14)),
        fx=dict(fog=0.2, dust=15, grade=river))
    add('o05b_envoys_river_s405', vy, l5, cam=dict(zoom=(1.35, 1.45), panx=(0.05, 0.05), pany=(0.12, 0.11), parx=(-8, 8)),
        fx=dict(fog=0.15, grade=river))         # in on the matchmakers' faces
    # L5 Olga answers kindly; the boat is carried
    pn = wt('L5', 'ПОНЕСУТ') - 0.06
    l6 = L('L6')['start'] - 0.08
    hall = dict(exposure=-0.02, contrast=1.08, sat=1.0, warm=0.65, demagenta=0.5)
    yard = dict(exposure=0.0, contrast=1.05, sat=0.9, warm=0.3, demagenta=0.4)
    add('o06_olga_hall', l5, pn, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(dust=25, light=glow(0.15, 0.35, 0.8), grade=hall))
    add('o07_carry_boat_s107', pn, l6, cam=dict(zoom=(1.0, 1.1), panx=(-0.02, 0.02), parx=(-12, 12)),
        fx=dict(dust=30, grade=yard))
    # L6 thrown into the pit, buried alive (revenge №1)
    sb = p['drop']
    zh = wt('L6', 'ЖИВЫМИ')
    l6e = L('L6')['end']
    l7 = L('L7')['start'] - 0.08
    pit = dict(exposure=-0.06, contrast=1.1, sat=0.8, teal=0.4, demagenta=0.4)
    # «лодку со сватами»: the matchmakers' boat once more (Lightning can't draw a boat carried on shoulders or tipped
    # into a pit: the boat goes straight from the river into the pit)
    add('o05b_envoys_river_s305', l6, sb - 0.04, cam=dict(zoom=(1.12, 1.22), pany=(0.04, 0.07), parx=(-8, 8)),
        fx=dict(fog=0.15, grade=dict(river, exposure=-0.04, sat=0.85)))
    add('o08_pit', sb - 0.04, l7, into='zoom', cam=dict(zoom=(1.0, 1.16), dolly=(0.0, 0.1)),
        fx=dict(dust=30, punch=[(sb, 0.08), (zh, 0.05)], shake=[(sb, 0.6, 14)], blackout=(l6e + 0.15, l7), grade=pit))
    # L7 the second embassy: the bathhouse, the door barred, set on fire (revenge №2)
    dv = wt('L7', 'ДВЕРИ') - 0.06
    zr = wt('L7', 'ЗАКРЫЛИ')
    pd = wt('L7', 'ПОДОЖГЛИ')
    l8 = L('L8')['start'] - 0.08
    add('o06_olga_hall', l7, dv, into='fade', cam=dict(zoom=(1.3, 1.4), panx=(-0.02, -0.03), pany=(-0.04, -0.05),
                                                       parx=(-8, 8)), fx=dict(dust=20, light=glow(0.15, 0.35, 0.8), grade=hall))
    add('o09_bathhouse_s209', dv, pd - 0.04, cam=dict(zoom=(1.28, 1.36), parx=(-6, 6)),
        fx=dict(punch=[(zr, 0.05)], grade=dict(exposure=-0.3, contrast=1.1, sat=0.7, teal=0.5)))
    add('o09_bathhouse_s109', pd - 0.04, l8, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(embers=80, fire=1.0, bloom=0.85, light=glow(0.5, 0.6), flash=[(pd, 0.5, 0.6)], shake=[(pd, 0.8, 12)],
                grade=night))
    # L8 the funeral feast; drunk; her warriors kill five thousand (revenge №3)
    nap = wt('L8', 'ОНИ') - 0.06
    vo = wt('L8', 'ЕЁ') - 0.06
    pe = wt('L8', 'ПЕРЕБИЛИ')
    pt = wt('L8', '5000')
    l9 = L('L9')['start'] - 0.08
    feast = dict(exposure=0.0, contrast=1.06, sat=1.0, warm=0.65, demagenta=0.5)
    add('o10_feast', l8, nap, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-14, 14)),
        fx=dict(embers=30, light=glow(0.2, 0.55, 0.8), grade=feast))
    add('o10_feast', nap, vo, cam=dict(zoom=(1.3, 1.4), panx=(0.03, 0.04), pany=(0.03, 0.03), parx=(-8, 8)),
        fx=dict(embers=30, light=glow(0.2, 0.55, 0.8), grade=feast))
    add('o11_swords', vo, l9, into='flash', cam=dict(zoom=(1.04, 1.16), dolly=(0.0, 0.1), roll=(0.0, -1.5)),
        fx=dict(embers=40, punch=[(pe, 0.07), (pt, 0.06)], shake=[(pe, 0.7, 14)],
                blackout=(L('L8')['end'] + 0.15, l9), grade=night))
    # L9 the siege of Iskorosten
    l10 = L('L10')['start'] - 0.08
    add('o12_siege', l9, l10, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.06), parx=(-16, 16)),
        fx=dict(dust=20, fog=0.15, light=glow(0.5, 0.7, 0.5), grade=dusk))
    # L10 «a modest tribute»: three pigeons and three sparrows from every yard
    kd = c.word_before('L10', 'КАЖДОГО') - 0.06
    l11 = L('L11')['start'] - 0.08
    add('o13_olga_camp', l10, kd, into='zoom', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(dust=20, grade=dusk))
    v3 = wt('L10', '3', nth=1) - 0.06               # the second «три»: in close on the cages
    add('o14_bird_cages', kd, v3, cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-12, 12)), fx=dict(dust=25, grade=dusk))
    add('o14_bird_cages', v3, l11, cam=dict(zoom=(1.32, 1.42), panx=(0.02, 0.03), pany=(0.03, 0.02), parx=(-8, 8)),
        fx=dict(dust=20, grade=dusk))
    # L11 tinder tied to every bird; released at dusk
    ve = wt('L11', 'ВЕЧЕРОМ') - 0.06
    ot = wt('L11', 'ОТПУСТИЛИ')
    l12 = L('L12')['start'] - 0.08
    dusk_dark = dict(dusk, exposure=-0.06, contrast=1.1)
    add('o15_tie_tinder', l11, ve, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.1)),
        fx=dict(embers=20, bloom=0.6, light=glow(0.5, 0.55, 0.7), grade=dusk))
    add('o16b_release_field_s316', ve, l12, cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), pany=(0.0, -0.02)),
        fx=dict(embers=40, bloom=0.8, grade=dusk_dark,
                birds=[dict(n=50, seed=21, dir=(0.25, -1.0), speed=320.0, ember=1.2, dur=2.5, area=(0.0, 0.05, 1.0, 0.95),
                            t0=ot - 0.3)]))
    # L12 the birds fly home under the roofs; the whole town burns (revenge №4)
    fi = p['fire']
    gr = wt('L12', 'ГОРЕЛО')
    l13 = L('L13')['start'] - 0.08
    add('o17_roofs', l12, fi, cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(embers=40, fire=0.6, bloom=0.7, grade=dusk_dark,
                birds=[dict(n=30, seed=31, dir=(0.6, 0.8), speed=230.0, ember=1.0, dur=3.0, area=(0.0, 0.0, 1.0, 0.6))]))
    add('o18b_street_fire_s418', fi, l13, into='flash', cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.1), parx=(-14, 14)),
        fx=dict(embers=110, fire=1.0, bloom=0.9, flash=[(fi + 0.06, 0.6, 0.7)], shake=[(fi + 0.06, 1.2, 16)],
                punch=[(gr, 0.07)], light=glow(0.5, 0.7), beat=[climax], grade=night))
    # L13 the same trick in the sagas: Harald, who lived in Kiev
    a13 = wt('L13', 'А') - 0.06
    l14 = L('L14')['start'] - 0.08
    add('o19_viking_king', l13, a13, into='flash', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-12, 12)),
        fx=dict(dust=20, bloom=0.5, grade=dict(exposure=0.02, contrast=1.06, sat=1.0, warm=0.5)))
    add('o20_kiev', a13, l14, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-14, 14)),
        fx=dict(dust=20, grade=dict(exposure=0.03, contrast=1.04, sat=1.0, warm=0.4)))
    # L14 the question, cut back and forth: the chronicler, «у викингов» the king, «или наоборот?» the chronicler again;
    # then the ashes
    kak = wt('L14', 'КАК') - 0.06
    uv = wt('L14', 'ВИКИНГОВ') - 0.3                 # on «у викингов»
    il = wt('L14', 'ИЛИ') - 0.06
    scribe = dict(exposure=-0.02, contrast=1.08, sat=0.95, warm=0.6)
    add('o21_chronicle', l14, uv, into='fade', cam=dict(zoom=(1.0, 1.1), dolly=(0.0, 0.08), parx=(-10, 10)),
        fx=dict(dust=25, light=glow(0.6, 0.45, 0.6), grade=scribe))
    add('o19_viking_king', uv, il, cam=dict(zoom=(1.3, 1.38), pany=(-0.04, -0.05), parx=(-6, 6)),
        fx=dict(dust=15, grade=dict(exposure=0.02, contrast=1.06, sat=1.0, warm=0.5)))
    add('o21_chronicle', il, kak, cam=dict(zoom=(1.32, 1.42), panx=(0.0, 0.01), pany=(0.03, 0.04), parx=(-6, 6)),
        fx=dict(dust=20, light=glow(0.6, 0.45, 0.6), grade=scribe))
    add('o22_ashes', kak, total, into='fade', cam=dict(zoom=(1.4, 1.48), panx=(-0.13, -0.13), pany=(0.115, 0.115),
                                                   dolly=(0.0, 0.04)),     # in on the pigeon, the tower with a cross stays out
        fx=dict(ash=40, fog=0.2, embers=15, grade=dict(exposure=0.03, contrast=1.06, sat=0.9, warm=0.35, teal=0.25)))

    cards = [
        dict(text='№4', sub='МЕСТЬ', start=ch, end=L('L2')['end'] + 0.1, y=270),     # above her eyes
        dict(text='20', sub='СВАТОВ', start=wt('L4', '20'), end=vy + 0.4, y=760, count=True),
        dict(text='5000', sub='ДРЕВЛЯН', start=pt, end=l9 - 0.05, y=760, count=True, count_dur=0.6),
    ]
    tags = [
        dict(text='ДРЕВЛЯНЕ · 945', start=ub + 0.1, end=l4 - 0.1),
        dict(text='МЕСТЬ №1 · ЯМА', start=sb + 0.1, end=l6e + 0.1),
        dict(text='МЕСТЬ №2 · БАНЯ', start=dv + 0.1, end=L('L7')['end'] + 0.3),
        dict(text='МЕСТЬ №3 · ТРИЗНА', start=L('L8')['start'] + 0.3, end=vo - 0.05),
        dict(text='ИСКОРОСТЕНЬ · 946', start=l9 + 0.15, end=l10 - 0.1),
        dict(text='МЕСТЬ №4 · ПТИЦЫ', start=fi + 0.25, end=L('L12')['end'] + 0.3),
        dict(text='ХАРАЛЬД СУРОВЫЙ · САГИ', start=l13 + 0.15, end=a13 - 0.1),
        dict(text='ЗЯТЬ ЯРОСЛАВА МУДРОГО', start=a13 + 0.15, end=l14 - 0.1),
    ]
    cover = dict(start=0.0, end=wt('L1', 'КНЯГИНЯ') - 0.1)
    return dict(cards=cards, tags=tags, cover=cover)


def _tape_stop(x, ts, dur):
    """Slow the bus down to a halt from ts over dur (like a stopping turntable); silence after it."""
    i0, n = int(ts * SR), int(dur * SR)
    if i0 >= len(x):
        return x
    u = np.arange(n) / n
    pos = i0 + np.cumsum((1 - u) ** 1.7)
    seg = np.stack([np.interp(pos, np.arange(len(x)), x[:, ch]) for ch in range(x.shape[1])], axis=1)
    seg *= (1 - u ** 3)[:, None]
    y = x.copy()
    e = min(len(x), i0 + n)
    y[i0:e] = seg[:e - i0]
    y[e:] = 0.0
    return y


def mix_cues(m, tl, a):
    L = tl['lines']
    put_hit, sfx, wt = a.put_hit, a.sfx, a.wt
    p = plan(L, tl['words'])
    total = tl['total']
    m.story = np.zeros_like(m.beds)        # the gusli under the matchmakers (stops like a tape when they fall)

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % (len(x) / SR)) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # --- hook: the town is already burning, the war drums are on
    h0, h1 = p['hook']
    loop('beds', 'war_drums', h0, h1, -4.0, fin=0.0, fout=0.06)
    loop('beds', 'choir_low', h0, h1, -9.0, fin=0.3, fout=0.1)
    loop('beds', 'fire_big', h0, h1, -9.0, fin=0.0, fout=0.3)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    put_hit(m, 'drum_big', wt('L1', 'СОЖГЛА'), -4.0)
    put_hit(m, 'wings_flock', wt('L1', 'ГОЛУБЯМИ') - 0.1, -5.0)
    put_hit(m, 'drum_big', p['fourth'], -1.0)
    put_hit(m, 'sub_drop', p['fourth'], -5.0)
    put_hit(m, 'heartbeat', L['L2']['end'] + 0.2, -7.0)
    # cuts get a soft whoosh, except where the music or a hit already marks them
    loud = [p['fourth'], p['drop'], p['fire'], wt('L7', 'ПОДОЖГЛИ'), wt('L8', 'ЕЁ'), wt('L11', 'ОТПУСТИЛИ')]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -14.0)
    # --- a year earlier, in the forest
    m.put('beds', sfx('ambience_wind_dead_forest'), L['L3']['start'] - 0.3, -6.0, fade_in=0.6, fade_out=0.8,
          length=L['L4']['start'] + 0.3 - (L['L3']['start'] - 0.3))
    m.put('beds', sfx('drone_bed_tension'), L['L3']['start'], -9.0, fade_in=0.6, fade_out=0.5,
          length=L['L4']['start'] - L['L3']['start'])
    put_hit(m, 'drum_big', wt('L3', 'УБИЛО'), -6.0)
    put_hit(m, 'impact_soft', wt('L3', 'УБИЛО'), -8.0)
    # --- the matchmakers: the gusli tells the story, then stops dead as they fall into the pit
    s0, s1 = p['story']
    loop('story', 'gusli_tune', s0, s1 + 1.0, -6.0, fin=0.5, fout=0.02)
    loop('story', 'choir_low', s0, s1 + 1.0, -16.0, fin=1.0, fout=0.02)
    m.story = _tape_stop(m.story, s1 - 0.05, 0.7)
    put_hit(m, 'drum_big', p['drop'], -2.0)
    put_hit(m, 'body_fall', p['drop'] + 0.25, -5.0)
    put_hit(m, 'dirt_throw', wt('L6', 'ЗАКОПАЛИ'), -3.0)
    put_hit(m, 'sub_drop', wt('L6', 'ЖИВЫМИ'), -6.0)
    put_hit(m, 'heartbeat', L['L6']['end'] + 0.2, -8.0)
    # --- the bathhouse
    pd = wt('L7', 'ПОДОЖГЛИ')
    m.put('beds', sfx('drone_bed_tension'), L['L7']['start'], -9.0, fade_in=0.4, fade_out=0.2,
          length=pd - L['L7']['start'])
    put_hit(m, 'door_bar', wt('L7', 'ЗАКРЫЛИ'), -2.0)
    put_hit(m, 'fire_ignite', pd, -2.0)
    loop('beds', 'fire_big', pd, L['L8']['start'] + 0.4, -6.0, fin=0.2, fout=0.6)
    # --- the funeral feast, then the swords
    vo = wt('L8', 'ЕЁ')
    loop('beds', 'crowd_feast', L['L8']['start'] - 0.2, vo + 0.1, -3.0, fin=0.4, fout=0.15)
    loop('beds', 'gusli_tune', L['L8']['start'] - 0.2, vo + 0.05, -14.0, fin=0.4, fout=0.05)
    put_hit(m, 'swords_draw', vo + 0.02, -3.0)
    put_hit(m, 'drum_big', wt('L8', 'ПЕРЕБИЛИ'), -2.0)
    put_hit(m, 'impact_soft', wt('L8', '5000'), -6.0)
    put_hit(m, 'sub_drop', wt('L8', '5000'), -6.0)
    put_hit(m, 'heartbeat', L['L8']['end'] + 0.2, -8.0)
    # --- the siege: a horn, the slow drum pulse until the birds are released
    put_hit(m, 'horn_call', L['L9']['start'] + 0.1, -7.0)
    loop('beds', 'war_drums_lite', L['L9']['start'], wt('L11', 'ОТПУСТИЛИ'), -8.0, fin=0.2, fout=0.3)
    loop('beds', 'choir_low', L['L10']['start'], L['L12']['start'], -13.0, fin=1.0, fout=0.5)
    # --- tinder tied to the birds; released
    ot = wt('L11', 'ОТПУСТИЛИ')
    loop('beds', 'fire_crackle', L['L11']['start'], ot + 0.3, -10.0, fin=0.3, fout=0.3)
    put_hit(m, 'wings_pigeon', wt('L11', 'ПРИВЯЗАЛИ'), -7.0)
    put_hit(m, 'riser_2s', ot, -9.0)
    put_hit(m, 'wings_flock', ot - 0.05, -2.0)
    put_hit(m, 'wings_flock', L['L12']['start'], -9.0)
    # --- the whole town burns
    f0, f1 = p['climax']
    put_hit(m, 'fire_ignite', f0, -2.0)
    put_hit(m, 'drum_big', f0, -1.0)
    loop('beds', 'war_drums', f0, f1, -3.0, fin=0.0, fout=0.6)
    loop('beds', 'choir_low', f0, f1, -7.0, fin=0.3, fout=0.6)
    loop('beds', 'fire_big', f0, L['L13']['start'] + 0.6, -5.0, fin=0.1, fout=0.8)
    put_hit(m, 'drum_big', wt('L12', 'ГОРЕЛО'), -2.0)
    put_hit(m, 'sub_drop', wt('L12', 'ГОРЕЛО'), -6.0)
    # --- the sagas, the question: the gusli comes back, a distant horn
    o0 = p['outro'][0]
    put_hit(m, 'horn_call', L['L13']['start'] + 0.15, -11.0)
    loop('beds', 'gusli_tune', o0, total, -7.0, fin=0.6, fout=1.6)
    loop('beds', 'choir_low', L['L14']['start'], total, -14.0, fin=1.0, fout=1.6)
    put_hit(m, 'sting_end', L['L14']['end'] + 0.1, -5.0)
    m.beds += m.story
