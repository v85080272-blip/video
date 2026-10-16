# Text check before synthesis: which words a voice may stress wrongly, and the script prepared for the engine.
import re

from check import script_words, stressed, vowel_positions
from lexicon import TRAP, known_errors

# what each engine does with stress marks (checked in this project; see qa/README.md)
ENGINES = {
    'qwen3': dict(plus=False, note='Qwen3-TTS читает «+» вслух, а знак U+0301 добавляет звуки: слова, где он ошибается, '
                                   'заменяем простыми, термин оставляем на плашке.'),
    'voxcpm2': dict(plus=False, note='VoxCPM2: пометки ударений не проверены, текст отдаём без них.'),
    'rhvoice': dict(plus=True, note='RHVoice понимает «+» перед ударной гласной.'),
    'silero': dict(plus=True, note='Silero TTS понимает «+» перед ударной гласной.'),
    'any': dict(plus=False, note=''),
}


def analyze_text(text, silero, engine='any', freq=None):
    """Returns {words, risky: [{word, at, stress, reasons, how}], tts_text}."""
    W = script_words(text, silero)
    known = known_errors()
    kn = {**known.get('any', {}), **known.get(engine, {})}
    risky = []
    for w in W:
        norm = w['norm']
        reasons = []
        nv = len(vowel_positions(norm)) if norm != '*' else 0
        key = norm.replace('ё', 'е')
        if norm == '*':
            if re.search(r'\d', w['text']):
                reasons.append('цифры: напишите словами, как читать')
            else:
                reasons.append('латиница: голос прочитает по-своему, лучше написать по-русски')
        elif len(w['text']) >= 2 and w['text'].isupper() and nv <= 2:
            reasons.append('аббревиатура: напишите, как её читать')
        if nv >= 2:
            if w['source'] == 'homograph':
                v = w.get('variants') or []
                pv = w.get('p')
                alt = ' или '.join(stressed(x.replace('+', ''), _vi(x)) for x in v)
                if pv is not None and max(pv) < 0.85:      # phrase rules and sure guesses are not worth a line
                    reasons.append(f'омограф ({alt}): по смыслу выбрано {stressed(norm, w["stress"])}, '
                                   f'уверенность {max(pv):.0%}, проверьте')
            elif w['source'] == 'trap':
                reasons.append('слово-ловушка, словарь Silero здесь ошибается')
            elif key in TRAP:
                reasons.append('trap')                     # common words: listed apart, as a second listen
            elif w['source'] == 'model' and w.get('p') is not None and w['p'] < 0.8:
                alts = ', '.join(f'{stressed(norm, i)} {p:.0%}' for i, p in (w.get('alt') or [])[:2])
                reasons.append(f'словарь не уверен ({alts})')
            elif w['stress'] is None:
                reasons.append('ударение неизвестно')
            if freq is not None and key not in freq and w['source'] in ('model', 'none'):
                reasons.append('редкое слово или имя: голос может не знать ударения')
        if key in kn or norm in kn:
            reasons.append('этот голос уже ошибался здесь: ' + (kn.get(key) or kn.get(norm)))
        if reasons:
            risky.append(dict(word=w['text'], at=w['start'], stress=w['stress'],
                              display=stressed(norm, w['stress']) if nv >= 2 else w['text'], reasons=reasons,
                              yo=w['source'] == 'ё'))
    traps = [r for r in risky if r['reasons'] == ['trap']]
    risky = [dict(r, reasons=[x for x in r['reasons'] if x != 'trap']) for r in risky if r['reasons'] != ['trap']]
    return dict(words=W, risky=risky, traps=traps, engine=engine, note=ENGINES.get(engine, ENGINES['any'])['note'],
                tts_text=tts_text(text, W, ENGINES.get(engine, ENGINES['any'])['plus']))


def _vi(variant):
    i = variant.index('+')
    return sum(c in 'аеёиоуыэюя' for c in variant[:i].lower())


def tts_text(text, W, plus):
    """The script with ё restored and, for engines that read them, '+' before every stressed vowel."""
    out, pos = [], 0
    for w in W:
        a = w['start']
        if a < pos or w['norm'] == '*':
            continue
        b, k = a, 0
        while b < len(text) and k < len(w['text']):        # the span may hold the writer's own '+'
            k += text[b] != '+'
            b += 1
        word = text[a:b]
        if '+' in word:
            out.append(text[pos:a])
            out.append(word)
            pos = b
            continue
        if w['norm'] != '*' and w['stress'] is not None:
            norm = w['norm']
            # keep the writer's case, take ё from the dictionary form
            word = ''.join(n.upper() if o.isupper() else n for o, n in zip(word, norm)) if len(norm) == len(word) else word
            vp = vowel_positions(word.lower())
            if plus and len(vp) >= 2 and w['stress'] < len(vp):
                i = vp[w['stress']]
                word = word[:i] + '+' + word[i:]
        out.append(text[pos:a])
        out.append(word)
        pos = b
    out.append(text[pos:])
    return ''.join(out)
