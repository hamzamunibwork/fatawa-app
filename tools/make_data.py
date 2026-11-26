#!/usr/bin/env python3
"""يحوّل ملف الفتاوى (JSON الذي تُخرجه أداة fatawa_water.py في مستودع fatawa-sources) إلى بيانات التطبيق.
الاستعمال: python3 tools/make_data.py <fatawa.json> [--email البريد]"""
import json, os, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'app', 'src', 'main', 'assets', 'www', 'data', 'fatawa.js')
src = sys.argv[1]
email = sys.argv[sys.argv.index('--email') + 1] if '--email' in sys.argv else ''
F = json.load(open(src, encoding='utf-8'))
def clean(x):
    if isinstance(x, dict): return {k: clean(v) for k, v in x.items() if k not in ('tail',) and v not in ('', None, [])}
    if isinstance(x, list): return [clean(v) for v in x]
    return x
D = {'title': 'الفتاوى الميسّرة', 'subtitle': 'في ضوء الكتاب والسنة', 'author': 'عبد الحسيب منيب الأفغاني', 'email': email, 'fatawa': clean(F)}
open(OUT, 'w', encoding='utf-8').write('window.FATAWA=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(F), 'فتوى ->', OUT, os.path.getsize(OUT) // 1024, 'KB')
