# Russian letters -> phones for one word with the stress put on a chosen vowel.
# The phones follow espeak-ng's Russian conventions (the ones Piper's Russian voices were trained on), so the same
# word can be synthesised with the right and with a wrong stress, and the same phone list drives the forced alignment.
VOWELS = 'аеёиоуыэюя'
IOTATED = 'еёюя'
PAIRED = {'б': 'b', 'в': 'v', 'г': 'ɡ', 'д': 'd', 'з': 'z', 'к': 'k', 'л': 'ɭ', 'м': 'm', 'н': 'n', 'п': 'p',
          'р': 'r', 'с': 's', 'т': 't', 'ф': 'f', 'х': 'x'}
FIXED = {'ж': 'ʒ', 'ш': 'ʃ', 'ц': 'ts', 'ч': 'tʃʲ', 'щ': 'ɕ', 'й': 'j'}
DEVOICE = {'b': 'p', 'v': 'f', 'ɡ': 'k', 'd': 't', 'z': 's', 'ʒ': 'ʃ', 'ʑ': 'ɕ'}
VOICE = {'p': 'b', 'f': 'v', 'k': 'ɡ', 't': 'd', 's': 'z', 'ʃ': 'ʒ', 'ɕ': 'ʑ'}
VOICED_OBS = {'b', 'ɡ', 'd', 'z', 'ʒ', 'ʑ'}            # в does not voice the consonant before it
VOICELESS_OBS = {'p', 'f', 'k', 't', 's', 'ʃ', 'x', 'ts', 'tʃ', 'ɕ'}
SOFT_LIKE = ('ʲ', 'ɕ', 'ʑ', 'j')
KEEP_OGO = {'много', 'немного', 'строго', 'убого', 'полого', 'отлого', 'дорого', 'недорого', 'итого'}
CHN_SH = {'конечно', 'скучно', 'нарочно', 'скворечник', 'яичница', 'прачечная', 'пустячный', 'скучный', 'скучная',
          'скучное', 'скучные'}


def vowel_positions(word):
    return [i for i, c in enumerate(word) if c in VOWELS]


def _rewrite(w):
    """Spelling-to-sound rewrites espeak-ng applies before its letter rules: silent letters, -ого/-его, что."""
    if w in ('что', 'чтобы', 'ничто', 'кое-что', 'что-то', 'что-нибудь', 'что-либо'):
        w = w.replace('что', 'што')
    for a, b in (('здравств', 'здраств'), ('чувств', 'чуств'), ('лнц', 'нц'), ('рдц', 'рц'), ('стн', 'сн'),
                 ('здн', 'зн'), ('стл', 'сл'), ('вств', 'ств'), ('сч', 'щ'), ('зч', 'щ'), ('жч', 'щ'),
                 ('гк', 'хк'), ('гч', 'хч'), ('сегодн', 'севодн'), ('зж', 'жж'), ('сж', 'жж'), ('сш', 'шш'),
                 ('зш', 'шш'), ('чш', 'тш')):
        w = w.replace(a, b)
    if w in CHN_SH:
        w = w.replace('чн', 'шн')
    if ((w.endswith('ого') or w.endswith('его')) and len(w) > 3 and w not in KEEP_OGO) or w in ('его', 'него'):
        w = w[:-2] + 'во'
    return w


def phones(word, stress):
    """word: lower-case Cyrillic (ё allowed); stress: index of the stressed vowel among the word's vowels
    (0-based), or None. Returns a list of dicts {ph, kind ('C'|'V'), vi (vowel index or None), stressed}."""
    w = _rewrite(word.lower().replace('-', ''))
    tsja = w.endswith('ться') or w.endswith('тся')
    if tsja:
        w = w[:-4 if w.endswith('ться') else -3] + 'ца'
    vpos = vowel_positions(w)
    nv = len(vpos)
    if stress is None:
        stress = next((k for k, i in enumerate(vpos) if w[i] == 'ё'), 0 if nv == 1 else None)
    out = []
    vi = -1
    for i, c in enumerate(w):
        nxt = w[i + 1] if i + 1 < len(w) else '#'
        prev = w[i - 1] if i > 0 else '#'
        if c in VOWELS:
            vi += 1
            st = stress is not None and vi == stress
            pos = 'S' if st else ('P1' if stress is not None and vi == stress - 1 else
                                  ('P' if stress is not None and vi < stress else 'T'))
            final = i == len(w) - 1
            iot = c in IOTATED and (i == 0 or prev in VOWELS or prev in 'ьъ')
            if (iot and prev in 'ьъ' and c in 'яю') or (c == 'и' and prev == 'ь'):
                out.append(dict(ph='j', kind='C', vi=None, stressed=False, sign_j=True))   # ь + я -> "jˈja"
            elif iot and prev in 'ьъ':
                iot = False                                   # ь + е, ё -> one j: "семьёй" sʲimʲjˈɵj
                out.append(dict(ph='j', kind='C', vi=None, stressed=False, iot=True, after_sign=True))
            last = out[-1]['ph'] if out and out[-1]['kind'] == 'C' else ''
            if last == 'j' and c == 'а':
                iot = True if not out[-1].get('iot') else iot
            soft = last.endswith(SOFT_LIKE)
            hard_sib = last in ('ʒ', 'ʃ', 'ts')
            v = _vowel(c, pos, final, soft, hard_sib, iot, i == 0, tsja and final)
            if iot and not (last == 'j' and c == 'а'):
                out.append(dict(ph='j', kind='C', vi=None, stressed=False, iot=True))
            out.append(dict(ph=v, kind='V', vi=vi, stressed=st, letter=c))
            continue
        if c in 'ьъ':
            continue
        if c in FIXED:
            ph = FIXED[c]
        elif c in PAIRED:
            ph = PAIRED[c]
            if nxt in 'еёиюяь' and c != 'х':
                ph += 'ʲ'
            if ph == 'zʲ':
                ph = 'ʑ'
        else:                   # latin letters, digits: nothing to say
            continue
        out.append(dict(ph=ph, kind='C', vi=None, stressed=False, sign=nxt in 'ьъ'))
    _clusters(out)
    _voicing(out)
    return out


def _vowel(c, pos, final, soft, hard_sib, iot, initial, tsja_end):
    if c == 'ё':
        return 'o' if hard_sib or not (soft or iot) else 'ɵ'
    if c == 'ы':
        return 'y'
    if c in 'ую':
        return 'u'
    if c == 'э':
        return 'ɛ'
    if c == 'и':
        if hard_sib:
            return 'y'
        if final or initial:
            return 'ɪ'
        if pos == 'S':
            return 'i'
        return 'ɪ' if initial else 'i'
    if c == 'о':
        return 'o' if pos == 'S' else 'ʌ'
    if c in 'ая':
        if pos == 'S':
            return 'a' if iot else 'ɑ'
        if tsja_end:
            return 'ʌ'
        if iot:
            return 'a'
        if final:
            return 'ʌ' if soft else 'a'
        if pos == 'P1' or initial:
            return 'a'
        return 'ʌ'
    if c == 'е':
        if pos == 'S':
            return 'ɛ' if hard_sib else 'e'
        if hard_sib:
            return 'y'
        if iot:
            return 'ɪ' if initial or final else 'i'
        return 'i'
    return c


def _clusters(out):
    """espeak-ng softness quirks inside consonant clusters."""
    for k in range(len(out) - 1):
        a, b = out[k], out[k + 1]
        if a['kind'] != 'C' or b['kind'] != 'C':
            continue
        # нь / ль before a consonant lose softness ("деньги" dʲˈenɡʲɪ, "большой" bʌɭʃˈoj)
        if a['ph'] in ('nʲ', 'ɭʲ') and b['ph'] != 'j':
            a['ph'] = a['ph'][:-1]
        # dentals soften before a dental made soft by its vowel ("стена" sʲtʲ, "снег" sʲnʲ, "отдел" dʲdʲ),
        # and a doubled consonant before a soft one ("миссия" sʲsʲ)
        if not b.get('sign') and ((a['ph'] in ('s', 'z') and b['ph'] in ('tʲ', 'dʲ', 'nʲ', 'sʲ', 'ʑ')) or
                                  (a['ph'] in ('t', 'd') and b['ph'] in ('tʲ', 'dʲ'))):
            a['ph'] = {'s': 'sʲ', 'z': 'ʑ', 't': 'tʲ', 'd': 'dʲ'}[a['ph']]
    if out and out[-1]['kind'] == 'C' and out[-1]['ph'] in ('ɭʲ', 'nʲ', 'vʲ', 'fʲ'):
        out[-1]['ph'] = out[-1]['ph'][:-1]


def _base(p):
    return p[:-1] if p.endswith('ʲ') and p != 'tʃʲ' else p


def _voicing(out):
    """Word-final devoicing and regressive voicing assimilation in obstruent clusters."""
    k = len(out) - 1
    while k >= 0 and out[k]['kind'] == 'C' and _base(out[k]['ph']) not in ('m', 'n', 'r', 'ɭ', 'j'):
        b = _base(out[k]['ph'])
        if b in DEVOICE:
            soft = out[k]['ph'].endswith('ʲ') and DEVOICE[b] != 'ɕ'
            out[k]['ph'] = DEVOICE[b] + ('ʲ' if soft else '')
        k -= 1
    for k in range(len(out) - 2, -1, -1):
        a, b = out[k], out[k + 1]
        if a['kind'] != 'C' or b['kind'] != 'C' or a.get('sign'):
            continue
        ab, bb = _base(a['ph']), _base(b['ph'])
        soft = 'ʲ' if a['ph'].endswith('ʲ') and a['ph'] != 'tʃʲ' else ''
        if ab in DEVOICE and (bb in VOICELESS_OBS or b['ph'] == 'tʃʲ'):
            a['ph'] = DEVOICE[ab] + ('' if DEVOICE[ab] == 'ɕ' else soft)
        elif ab in VOICE and bb in VOICED_OBS:
            a['ph'] = VOICE[ab] + ('' if VOICE[ab] == 'ʑ' else soft)
            if a['ph'] == 'zʲ':
                a['ph'] = 'ʑ'


def ipa(word, stress, mark='ˈ'):
    """espeak-style IPA string with the stress mark before the stressed vowel (before its j when iotated)."""
    ph = phones(word, stress)
    s = ''
    for k, p in enumerate(ph):
        nx = ph[k + 1] if k + 1 < len(ph) else None
        # espeak marks stressed я/ю before their j ("ˈjasnʌ", "daˈju"), е/ё after it ("jˈedʲit", "nʲijˈɵ")
        before_j = lambda q: q.get('iot') and not q.get('after_sign') and nx is not None and nx['stressed'] \
            and nx.get('letter') in 'яю' and (k == 0 or ph[k - 1]['kind'] == 'V' or ph[k - 1].get('sign_j'))
        if mark and before_j(p):
            s += mark + p['ph']
            continue
        if mark and p['kind'] == 'V' and p['stressed'] and not (k > 0 and ph[k - 1].get('iot') and not ph[k - 1].get(
                'after_sign') and p.get('letter') in 'яю' and (k == 1 or ph[k - 2]['kind'] == 'V' or ph[k - 2].get('sign_j'))):
            s += mark
        s += p['ph']
    return s
