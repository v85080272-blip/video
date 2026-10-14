"""Тайны истории №2: «Город, который не мог перестать танцевать» (Strasbourg, July-September 1518).

The street-dance kit from sfx/make_sfx_dance.py (126 bpm, 4-bar loops) drives both the mix and the camera:
plan() turns line and word times into music sections and their beat grids, so the picture punches and sways
on the same beats the drum plays.
"""
import numpy as np

DISPLAY = {
    'L1': 'В 1518{тысяча пятьсот восемнадцатом} ГОДУ СОТНИ ЛЮДЕЙ НАЧАЛИ ТАНЦЕВАТЬ — И НЕ МОГЛИ ОСТАНОВИТЬСЯ.',
    'L2': 'ГОВОРЯТ, НЕКОТОРЫЕ — ДО СМЕРТИ.',
    'L3': 'СТРАСБУРГ, ИЮЛЬ. ФРАУ ТРОФФЕА{Троффея} ВЫХОДИТ НА УЛИЦУ И НАЧИНАЕТ ТАНЦЕВАТЬ.',
    'L4': 'БЕЗ МУЗЫКИ. БЕЗ ПРИЧИНЫ. ДЕНЬ, ВТОРОЙ, ТРЕТИЙ — ПОКА НЕ ПАДАЕТ БЕЗ СИЛ.',
    'L5': 'А ОТДОХНУВ, ВСТАЁТ — И ТАНЦУЕТ СНОВА.',
    'L6': 'ЧЕРЕЗ НЕДЕЛЮ ТАНЦУЮТ УЖЕ ДЕСЯТКИ ЛЮДЕЙ. ЧЕРЕЗ МЕСЯЦ — СОТНИ.',
    'L7': 'ВРАЧИ СТАВЯТ ДИАГНОЗ: ПЕРЕГРЕЛАСЬ КРОВЬ. И НАЗНАЧАЮТ ЛЕЧЕНИЕ — ТАНЦЕВАТЬ ЕЩЁ БОЛЬШЕ.',
    'L8': 'ГОРОД СТРОИТ ДЛЯ ТАНЦУЮЩИХ СЦЕНУ — И НАНИМАЕТ МУЗЫКАНТОВ.',
    'L9': 'НО СТАНОВИТСЯ ТОЛЬКО ХУЖЕ. ЛЮДИ ПАДАЮТ БЕЗ СИЛ ПРЯМО НА УЛИЦАХ.',
    'L10': 'ТОГДА ТАНЦЫ ЗАПРЕЩАЮТ, А ТАНЦУЮЩИХ ВЕЗУТ В ЧАСОВНЮ СВЯТОГО ВИТА — И НАДЕВАЮТ ИМ КРАСНЫЕ БАШМАКИ С КРЕСТАМИ.',
    'L11': 'К СЕНТЯБРЮ — ВСЁ ПРЕКРАЩАЕТСЯ — ТАК ЖЕ ВНЕЗАПНО, КАК НАЧАЛОСЬ.',
    'L12': 'ОТРАВЛЕНИЕ СПОРЫНЬЁЙ? МАССОВАЯ ИСТЕРИЯ ОТ ГОЛОДА И СТРАХА? УЧЁНЫЕ СПОРЯТ ДО СИХ ПОР.',
    'L13': 'А ТЫ КАК ДУМАЕШЬ, ЧТО ЗАСТАВИЛО ИХ ТАНЦЕВАТЬ?',
}
HILITE = {'1518', 'СОТНИ', 'СМЕРТИ.', 'ТРЕТИЙ', 'КРОВЬ.', 'БОЛЬШЕ.', 'МУЗЫКАНТОВ.', 'ХУЖЕ.', 'КРАСНЫЕ', 'БАШМАКИ',
          'СПОРЫНЬЁЙ?', 'ИСТЕРИЯ', 'ВНЕЗАПНО,'}

# gap (s) after each line before the next one starts
GAPS = {'L1': 0.25, 'L2': 0.55, 'L3': 0.20, 'L4': 0.60, 'L5': 0.30, 'L6': 0.90, 'L7': 0.25, 'L8': 0.35,
        'L9': 0.40, 'L10': 0.40, 'L11': 0.50, 'L12': 0.45, 'L13': 0.0}
LEAD_IN = 0.25
TAIL = 1.9
COVER = dict(tag='ТАЙНЫ ИСТОРИИ · №2', year='1518', lines=['ТАНЦЕВАЛИ', 'ДО СМЕРТИ?'])
COVER_B = ['ЭПИДЕМИЯ', 'ТАНЦА']
SFX_DIRS = ['/home/user/work/sfx/dance', '/home/user/work/sfx']
DUCK = (-12.0, -10.0)

BPM = 126.0
BEAT = 60.0 / BPM
LOOP_S = 16 * BEAT


def _wt(words, lines, lid, prefix, nth=0, which='start'):
    k = 0
    for w, a, b in words[lid]:
        if w.startswith(prefix):
            if k == nth:
                return a if which == 'start' else b
            k += 1
    return lines[lid]['start']


def plan(lines, words):
    """Music sections (start, end) whose beat grid starts at their own start, plus sync points."""
    wt = lambda *a, **k: _wt(words, lines, *a, **k)
    p = {}
    p['smerti'] = wt('L2', 'СМЕРТИ')
    p['hook'] = (0.0, p['smerti'])                                   # full groove + pipes under the hook
    p['fall'] = wt('L4', 'ПАДАЕТ')
    p['solo1'] = (wt('L3', 'НАЧИНАЕТ'), p['fall'])                   # her feet alone, no music
    p['solo2'] = (wt('L5', 'ТАНЦУЕТ'), lines['L7']['start'] - 0.1)   # again, then the crowd joins
    p['crowd'] = (wt('L6', 'ДЕСЯТКИ') - 0.3, lines['L7']['start'] - 0.1)
    p['sotni'] = wt('L6', 'СОТНИ')
    p['krov'] = wt('L7', 'КРОВЬ')
    p['stop'] = wt('L9', 'НО') - 0.05
    p['band'] = (wt('L7', 'ТАНЦЕВАТЬ'), p['stop'])                   # "treatment: dance more" -> the hired band
    p['outro'] = (lines['L13']['start'] - 0.1, None)
    return p


def _beat(seg, end, **k):
    return dict(t0=seg[0], t1=end, grid=seg[0], period=BEAT, **k)


def layout(c):
    L, add, wt, wb, total = c.L, c.add, c.word_t, c.word_before, c.total
    p = plan(c.lines, c.words)
    beat = lambda seg, **k: _beat(seg, seg[1] if seg[1] is not None else total, **k)
    torch = lambda x, y, k=1.0: dict(x=x, y=y, r=1.1, col=(0.5 * k, 0.22 * k, 0.04 * k), flicker=0.35, rate=9.0)
    night = dict(exposure=0.0, contrast=1.1, sat=1.05, warm=0.7, demagenta=0.6)

    # L1 hook: a night street full of dancers, the camera dances (cover on top until "сотни")
    c1 = wt('L1', 'НАЧАЛИ') - 0.06
    c2 = wt('L1', 'И') - 0.06
    l2 = L('L2')['start'] - 0.1
    hook = beat(p['hook'], zoom=0.028, sway=1.1)
    add('d01_crowd_night_s101', 0.0, c1, cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-12, 12)),
        fx=dict(embers=60, bloom=0.8, fire=0.6, light=torch(0.2, 0.35), beat=[hook], grade=night))
    add('d01_crowd_night_s201', c1, c2, into='zoom', cam=dict(zoom=(1.06, 1.14), parx=(14, -14), pany=(0.01, -0.01)),
        fx=dict(embers=60, bloom=0.8, fire=0.6, light=torch(0.8, 0.3), beat=[hook], grade=night))
    add('d01_crowd_night_s101', c2, l2, cam=dict(zoom=(1.36, 1.46), panx=(-0.04, -0.05), pany=(0.04, 0.03), parx=(-8, 8)),
        fx=dict(embers=60, bloom=0.8, fire=0.6, light=torch(0.2, 0.35), beat=[hook], grade=night))
    # L2 "говорят, некоторые -- до смерти": the music dies on "смерти"
    sm = p['smerti']
    l3 = L('L3')['start'] - 0.1
    add('d02_silhouettes', l2, l3, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(-14, 14)),
        fx=dict(dust=40, bloom=0.7, punch=[(sm, 0.09)], shake=[(sm, 0.9, 22)], flash=[(sm, 0.35, 0.5)],
                blackout=(L('L2')['end'] + 0.12, l3),
                grade=dict(exposure=-0.05, contrast=1.12, sat=1.1, warm=0.6, demagenta=0.5)))
    # L3 Strasbourg in July, Frau Troffea starts to dance
    c3 = wt('L3', 'ФРАУ') - 0.06
    l4 = L('L4')['start'] - 0.06
    solo1 = beat(p['solo1'], bob=7.0, zoom=0.01, sway=0.6)
    add('d03_strasbourg_street', l3, c3, into='fade', cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-18, 18)),
        fx=dict(dust=35, bloom=0.5, grade=dict(exposure=0.05, contrast=1.03, sat=1.0, warm=0.5, demagenta=0.7)))
    c3b = p['solo1'][0] - 0.06                                    # "и начинает танцевать" -> closer on her
    add('d04_troffea_s104', c3, c3b, cam=dict(zoom=(1.0, 1.06), dolly=(0.0, 0.06), pany=(0.0, -0.01)),
        fx=dict(dust=30, grade=dict(exposure=0.05, contrast=1.05, sat=1.0, warm=0.5)))
    add('d04_troffea_s104', c3b, l4, cam=dict(zoom=(1.32, 1.42), pany=(-0.03, -0.04), parx=(-8, 8)),
        fx=dict(dust=30, beat=[solo1], grade=dict(exposure=0.05, contrast=1.05, sat=1.0, warm=0.5)))
    # L4 no music, no reason; days 1-2-3 on her feet; she collapses
    c4 = wt('L4', 'ДЕНЬ') - 0.06
    c4b = wt('L4', 'ПОКА') - 0.06
    l4end = L('L4')['end']
    add('d04_troffea_s204', l4, c4, cam=dict(zoom=(1.04, 1.14), parx=(12, -12), dolly=(0.0, 0.06)),
        fx=dict(dust=30, beat=[solo1], grade=dict(exposure=0.0, contrast=1.06, sat=0.95, warm=0.5)))
    add('d06_feet', c4, c4b, into='zoom', cam=dict(zoom=(1.0, 1.1), panx=(0.02, -0.02)),
        fx=dict(dust=45, beat=[dict(solo1, bob=14.0, zoom=0.02)], grade=dict(exposure=0.0, contrast=1.08, sat=1.0, warm=0.6)))
    fall = p['fall']
    add('d05_exhausted_face', c4b, l4end + GAPS['L4'] - 0.06, cam=dict(zoom=(1.18, 1.26), dolly=(0.0, 0.05)),
        fx=dict(dust=20, drop=[(fall, 0.38, -110.0, 4.0)], shake=[(fall + 0.38, 0.5, 18)], punch=[(fall + 0.38, 0.06)],
                blackout=(l4end + 0.08, l4end + GAPS['L4'] - 0.06),
                grade=dict(exposure=-0.02, contrast=1.06, sat=0.9, warm=0.55)))
    # L5 she rests, gets up and dances again
    c5 = wt('L5', 'ВСТАЁТ') - 0.06
    l6 = L('L6')['start'] - 0.08
    solo2 = beat(p['solo2'], bob=7.0, zoom=0.012, sway=0.7)
    add('d05_exhausted_face', l4end + GAPS['L4'] - 0.06, c5, into='fade', cam=dict(zoom=(1.22, 1.14), pany=(0.02, 0.0)),
        fx=dict(dust=15, grade=dict(exposure=-0.04, contrast=1.04, sat=0.85, warm=0.5)))
    add('d04_troffea_s104', c5, l6, into='zoom', cam=dict(zoom=(1.3, 1.4), panx=(0.0, 0.01), pany=(-0.03, -0.04), parx=(-8, 8)),
        fx=dict(dust=30, beat=[solo2], grade=dict(exposure=0.05, contrast=1.05, sat=1.0, warm=0.5)))
    # L6 a week: dozens; a month: hundreds
    c6 = wt('L6', 'ЧЕРЕЗ', nth=1) - 0.06
    l7 = L('L7')['start'] - 0.08
    sq = dict(exposure=0.03, contrast=1.07, sat=1.0, warm=0.5)
    add('d07_square_crowd', l6, c6, cam=dict(zoom=(1.0, 1.08), pany=(0.01, -0.01), parx=(-16, 16)),
        fx=dict(dust=50, beat=[dict(solo2, zoom=0.015, bob=4.0, sway=0.5)], grade=sq))
    add('d07_square_crowd', c6, l7, into='zoom', cam=dict(zoom=(1.3, 1.42), panx=(0.03, 0.04), pany=(0.05, 0.05), parx=(-10, 10)),
        fx=dict(dust=60, beat=[dict(solo2, zoom=0.02, bob=5.0, sway=0.7)], punch=[(p['sotni'], 0.07)], grade=sq))
    # L7 physicians: "overheated blood"; the cure is more dancing -> the band kicks in on "танцевать"
    band = beat(p['band'], zoom=0.03, sway=1.3)
    bt = p['band'][0]
    c7 = wt('L7', 'НАЗНАЧАЮТ') - 0.06
    doc = dict(dust=20, light=dict(x=0.82, y=0.68, r=0.7, col=(0.4, 0.2, 0.04), flicker=0.25, rate=6.0),
               punch=[(p['krov'], 0.05)], grade=dict(exposure=-0.05, contrast=1.08, sat=0.9, warm=0.6))
    add('d08_physicians', l7, c7, into='fade', cam=dict(zoom=(1.0, 1.08), dolly=(0.0, 0.06), parx=(-10, 10)), fx=doc)
    add('d08_physicians', c7, bt - 0.04, cam=dict(zoom=(1.34, 1.44), panx=(0.03, 0.04), pany=(-0.04, -0.05), parx=(-8, 8)), fx=doc)
    l8 = L('L8')['start'] - 0.08
    add('d18_frenzy', bt - 0.04, l8, into='flash', cam=dict(zoom=(1.04, 1.14), parx=(12, -12)),
        fx=dict(embers=50, bloom=0.8, fire=0.5, light=torch(0.6, 0.22), beat=[band], grade=night))
    # L8 a stage and hired musicians
    l9 = L('L9')['start'] - 0.06
    c8 = wt('L8', 'НАНИМАЕТ') - 0.06                             # "и нанимает музыкантов" -> closer on the band
    stage = dict(dust=40, bloom=0.6, beat=[band], grade=dict(exposure=0.03, contrast=1.06, sat=1.05, warm=0.6))
    dusk = dict(stage, grade=dict(exposure=0.05, contrast=1.06, sat=1.0, warm=0.5, demagenta=0.5))
    add('d09_stage_s509', l8, c8, cam=dict(zoom=(1.0, 1.08), panx=(-0.02, 0.02), parx=(-14, 14)), fx=dusk)
    add('d09_stage_s409', c8, l9, cam=dict(zoom=(1.08, 1.16), panx=(0.0, 0.02), pany=(0.0, -0.02), parx=(-8, 8)), fx=stage)
    # L9 it only gets worse: the music grinds to a halt, people collapse
    c9 = wt('L9', 'ЛЮДИ') - 0.06
    l10 = L('L10')['start'] - 0.08
    dark = dict(exposure=-0.1, contrast=1.1, sat=0.85, warm=0.4, teal=0.4, demagenta=0.6)
    add('d10_collapse', l9, c9, into='zoom', cam=dict(zoom=(1.12, 1.04), dolly=(0.08, 0.0), roll=(1.5, 0.0)),
        fx=dict(embers=40, fog=0.15, fire=0.8, light=torch(0.1, 0.62, 0.9), grade=dark))
    add('d10_collapse', c9, l10, cam=dict(zoom=(1.36, 1.46), panx=(-0.04, -0.03), pany=(0.06, 0.07), parx=(-8, 8)),
        fx=dict(embers=40, fog=0.15, fire=0.8, light=torch(0.1, 0.62, 0.9), punch=[(wt('L9', 'ПАДАЮТ'), 0.05)], grade=dark))
    # L10 dancing is banned; the dancers are taken to the chapel of St. Vitus and given red shoes
    c10 = wt('L10', 'А') - 0.06
    c10b = wt('L10', 'И') - 0.06
    l11 = L('L11')['start'] - 0.08
    add('d17_decree', l10, c10, into='flash', cam=dict(zoom=(1.0, 1.08), parx=(-12, 12)),
        fx=dict(dust=25, punch=[(wt('L10', 'ЗАПРЕЩАЮТ'), 0.06)], grade=dict(exposure=0.0, contrast=1.08, sat=0.9, warm=0.4)))
    add('d11_pilgrims', c10, c10b, into='fade', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), pany=(0.0, 0.04)),
        fx=dict(fog=0.3, dust=25, bloom=0.5, grade=dict(exposure=0.02, contrast=1.04, sat=0.9, warm=0.35, teal=0.3)))
    add('d12_red_shoes', c10b, l11, into='zoom', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.1), parx=(10, -10)),
        fx=dict(dust=20, bloom=0.8, light=dict(x=0.3, y=0.2, r=1.0, col=(0.4, 0.2, 0.05), flicker=0.15, rate=4.0),
                punch=[(wt('L10', 'КРАСНЫЕ'), 0.05)], grade=dict(exposure=0.0, contrast=1.08, sat=1.05, warm=0.6)))
    # L11 by September it all stops
    l12 = L('L12')['start'] - 0.08
    c11 = wt('L11', 'ТАК') - 0.06                                 # "так же внезапно" -> closer, the dropped tambourine
    empty = dict(fog=0.35, dust=15, grade=dict(exposure=-0.04, contrast=1.04, sat=0.8, teal=0.7, demagenta=0.6))
    add('d13_empty_square', l11, c11, into='fade', cam=dict(zoom=(1.0, 1.08), pany=(0.0, -0.01), parx=(-16, 16)), fx=empty)
    add('d13_empty_square', c11, l12, cam=dict(zoom=(1.38, 1.46), panx=(0.11, 0.12), pany=(0.11, 0.12), parx=(-8, 8)), fx=empty)
    # L12 the theories
    c12 = wt('L12', 'МАССОВАЯ') - 0.06
    c12b = wt('L12', 'УЧЁНЫЕ') - 0.06
    l13 = L('L13')['start'] - 0.1
    add('d14_ergot', l12, c12, into='zoom', cam=dict(zoom=(1.0, 1.14), dolly=(0.0, 0.12)),
        fx=dict(dust=15, bloom=0.5, grade=dict(exposure=0.0, contrast=1.1, sat=1.0, warm=0.3)))
    add('d15_fear_crowd', c12, c12b, cam=dict(zoom=(1.0, 1.1), parx=(-14, 14), dolly=(0.0, 0.06)),
        fx=dict(fog=0.2, ash=25, grade=dict(exposure=-0.06, contrast=1.08, sat=0.85, teal=0.5, demagenta=0.6)))
    add('d02_silhouettes', c12b, l13, into='fade', cam=dict(zoom=(1.3, 1.4), panx=(0.05, 0.06), pany=(0.0, -0.01), parx=(-10, 10)),
        fx=dict(dust=30, bloom=0.6, grade=dict(exposure=-0.08, contrast=1.1, sat=1.0, warm=0.5, demagenta=0.5)))
    # L13 the question, the dance goes on at sunset
    outro = beat(p['outro'], zoom=0.015, sway=0.8)
    add('d16_sunset_dance', l13, total, into='flash', cam=dict(zoom=(1.0, 1.12), dolly=(0.0, 0.08), parx=(10, -10)),
        fx=dict(dust=30, bloom=0.9, beat=[outro], grade=dict(exposure=0.0, contrast=1.08, sat=1.05, warm=0.7)))

    cards = [
        dict(text='ДЕНЬ 3', sub='БЕЗ ОСТАНОВКИ', start=wt('L4', 'ДЕНЬ'), end=fall - 0.05, y=760,
             steps=[(wt('L4', 'ДЕНЬ'), 1), (wt('L4', 'ВТОРОЙ'), 2), (wt('L4', 'ТРЕТИЙ'), 3)]),
        dict(text='ДО 400', sub='ТАНЦУЮЩИХ', start=p['sotni'], end=l7 - 0.04, y=760, count=True),
    ]
    tags = [
        dict(text='СТРАСБУРГ · ИЮЛЬ 1518', start=l3 + 0.15, end=c3 + 0.9),
        dict(text='ЧАСОВНЯ СВЯТОГО ВИТА · САВЕРН', start=c10 + 0.2, end=c10b - 0.1),
        dict(text='СЕНТЯБРЬ 1518', start=l11 + 0.2, end=l12 - 0.15),
        dict(text='ВЕРСИЯ №1', start=l12 + 0.15, end=c12 - 0.1),
        dict(text='ВЕРСИЯ №2', start=c12 + 0.15, end=c12b - 0.1),
    ]
    cover = dict(start=0.0, end=wt('L1', 'СОТНИ') - 0.1)
    return dict(cards=cards, tags=tags, cover=cover)


SR = 48000


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
    m.music = np.zeros_like(m.beds)        # hook + band (the band gets the tape stop)
    m.music2 = np.zeros_like(m.beds)       # outro

    def loop(bus, name, t0, t1, gain, grid=None, fin=0.03, fout=0.08):
        x = sfx(name)
        if x is None or t1 <= t0:
            return
        g = t0 if grid is None else grid
        i0 = int(round(((t0 - g) % LOOP_S) * SR)) % len(x)
        need = int(round((t1 - t0) * SR))
        reps = (i0 + need) // len(x) + 2
        m.put(bus, np.concatenate([x] * reps)[i0:i0 + need], t0, gain, fade_in=fin, fade_out=fout)

    # --- hook: the dance is already on when the video starts
    h0, h1 = p['hook']
    loop('music', 'groove_full', h0, h1, -3.5, fin=0.0, fout=0.04)
    loop('music', 'drone_pipes', h0, h1, -9.0, fin=0.0, fout=0.04)
    loop('music', 'chanter_tune', h0, h1, -10.0, fin=0.0, fout=0.04)
    put_hit(m, 'boom_hook', 0.02, -9.0)
    # "до смерти": everything stops on one heavy hit
    sm = p['smerti']
    put_hit(m, 'drum_dum', sm, -1.0)
    put_hit(m, 'stomp_big', sm, -4.0)
    put_hit(m, 'sub_drop', sm, -6.0)
    put_hit(m, 'heartbeat', L['L2']['end'] + 0.18, -7.0)
    # cuts get a soft whoosh, except where the music or a hit already marks them
    loud = [sm, p['band'][0], p['stop'], p['fall']]
    for sh in tl['shots'][1:]:
        c = sh['start']
        if c < h1 or (p['band'][0] - 0.3 <= c <= p['stop'] + 0.3) or any(abs(c - x) < 0.4 for x in loud):
            continue
        put_hit(m, 'whoosh_short', c - 0.02, -13.0)
    # --- Strasbourg, a July morning; one woman's feet on the cobblestones
    m.put('beds', sfx('ambience_morning_taiga'), L['L3']['start'] - 0.4, -6.0, fade_in=0.5, fade_out=0.8,
          length=L['L4']['start'] + 0.6 - (L['L3']['start'] - 0.4))
    s0, s1 = p['solo1']
    loop('beds', 'stomps_solo', s0, s1 + 0.05, -3.0, fin=0.01, fout=0.05)
    for cd in tl['cards']:
        for (ts, _v) in cd.get('steps', []):
            put_hit(m, 'impact_soft', ts, -7.0)
    put_hit(m, 'body_fall', p['fall'] + 0.38, -2.0)
    put_hit(m, 'heartbeat', L['L4']['end'] + 0.1, -9.0)
    # --- she dances again, dozens join, then hundreds
    s0, s1 = p['solo2']
    loop('beds', 'stomps_solo', s0, s1, -3.0, fin=0.01, fout=0.3)
    c0, c1 = p['crowd']
    loop('beds', 'crowd_stomps', c0, c1, -4.0, grid=s0, fin=1.2, fout=0.3)
    loop('beds', 'groove_lite', wt('L6', 'ЧЕРЕЗ', nth=1) - 0.2, c1, -9.0, grid=s0, fin=0.6, fout=0.3)
    put_hit(m, 'stomp_big', p['sotni'], -3.0)
    put_hit(m, 'impact_soft', p['sotni'], -5.0)
    # --- the physicians; the cure is more dancing, the band kicks in
    b0, b1 = p['band']
    m.put('beds', sfx('drone_bed'), L['L7']['start'] - 0.1, -10.0, fade_in=0.4, fade_out=0.3,
          length=b0 - (L['L7']['start'] - 0.1))
    put_hit(m, 'heartbeat', p['krov'] + 0.05, -8.0)
    put_hit(m, 'drum_dum', b0, -2.0)
    loop('music', 'groove_full', b0, b1 + 1.2, -3.0, fin=0.0, fout=0.02)
    loop('music', 'drone_pipes', b0, b1 + 1.2, -10.0, fin=0.05, fout=0.02)
    loop('music', 'chanter_tune', b0, b1 + 1.2, -8.5, fin=0.0, fout=0.02)
    m.music = _tape_stop(m.music, p['stop'], 0.95)
    # --- it gets worse: heartbeat, bodies falling, a rising tension bed
    put_hit(m, 'sub_drop', p['stop'] + 0.35, -8.0)
    put_hit(m, 'heartbeat', p['stop'] + 1.0, -6.0)
    fl = wt('L9', 'ПАДАЮТ')
    put_hit(m, 'body_fall', fl + 0.1, -4.0)
    put_hit(m, 'body_fall', fl + 0.62, -8.0)
    ch = wt('L10', 'ЧАСОВНЮ')
    m.put('beds', sfx('drone_bed_tension'), p['stop'] + 0.6, -7.0, fade_in=1.0, fade_out=1.0,
          length=ch - (p['stop'] + 0.6))
    # --- the ban, the chapel of St. Vitus, the red shoes
    put_hit(m, 'drum_dum', wt('L10', 'ЗАПРЕЩАЮТ'), -5.0)
    put_hit(m, 'impact_soft', wt('L10', 'ЗАПРЕЩАЮТ'), -8.0)
    put_hit(m, 'bell_toll', ch - 0.05, -8.0)
    put_hit(m, 'bell_toll', ch + 2.35, -12.0)
    m.put('beds', sfx('choir_pad'), wt('L10', 'ВЕЗУТ') - 0.2, -3.0, fade_in=1.0, fade_out=1.4,
          length=L['L11']['start'] + 0.8 - (wt('L10', 'ВЕЗУТ') - 0.2))
    put_hit(m, 'impact_soft', wt('L10', 'КРАСНЫЕ'), -8.0)
    # --- September: an empty square, wind
    m.put('beds', sfx('ambience_wind_dead_forest'), L['L11']['start'] - 0.3, -5.0, fade_in=0.8, fade_out=1.0,
          length=L['L12']['start'] + 0.4 - (L['L11']['start'] - 0.3))
    # --- theories
    m.put('beds', sfx('drone_bed_tension'), L['L12']['start'] - 0.1, -6.0, fade_in=0.8, fade_out=0.6,
          length=L['L13']['start'] - (L['L12']['start'] - 0.1))
    m.put('beds', sfx('drone_bed'), L['L9']['start'], -12.0, fade_in=1.5, fade_out=1.0,
          length=L['L13']['start'] - L['L9']['start'])
    # --- the question; the dance goes on quietly
    o0 = p['outro'][0]
    loop('music2', 'groove_lite', o0, total, -6.0, fin=0.4, fout=1.4)
    loop('music2', 'drone_pipes', o0, total, -15.0, fin=0.8, fout=1.4)
    put_hit(m, 'sting_end', L['L13']['end'] + 0.1, -5.0)
    m.beds += m.music + m.music2
