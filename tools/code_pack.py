#!/usr/bin/env python3
"""نشر تحديث البرنامج (ملفات js وcss) على الخادم المركزي بلا إعادة تثبيت.

الاستعمال (من مجلد مستودع التطبيق):
    python3 tools/code_pack.py  <مسار مستودع munib-content>  --test   [--note "ما الجديد"]
    python3 tools/code_pack.py  <مسار مستودع munib-content>  --all    [--note "ما الجديد"]

  --test  تصل النسخة إلى أجهزة المؤلف وحدها (التي أُدخل فيها رمز المؤلف) للتجربة.
  --all   تصل إلى كل الأجهزة. (إن كانت نسخة التجربة هي نفسها، تُنشر كما هي بلا رقم جديد.)
  --data dict.js,reading.js   (اختياري) ملفات بيانات من www/data تُرسل مع البرنامج (لتصحيح القاموس والقراءة ونحوها).
  --shell 1.3.0   (اختياري) أقل إصدار مثبَّت يعمل معه هذا التحديث، إذا احتاج إلى إضافة جديدة في الجهاز.

يكتب في <munib-content>/apps/<التطبيق>/:
    code.json            فهرس نسخ البرنامج
    code/<رقم>.bin       ملفات البرنامج مشفّرة
ثم ارفع munib-content بـ GitHub Desktop.
الكتب والدروس تُنشر بأداة server_pack.py، والصور والخطوط لا تُرسل.
"""
import json, os, re, sys, gzip, hashlib, glob
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PA = [230, 179, 138, 146, 159, 43, 30, 175, 109, 0, 172, 38, 136, 43, 166, 107, 167, 124, 190, 163, 211, 221, 145, 232, 2, 39, 102, 27, 90, 180, 164, 74]
PM = [253, 45, 187, 227, 54, 34, 111, 177, 145, 192, 102, 104, 239, 64, 194, 76, 123, 125, 159, 168, 98, 236, 35, 215, 16, 36, 11, 130, 132, 111, 135, 239]
KEY = bytes(a ^ b for a, b in zip(PA, PM))
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WWW = os.path.join(HERE, 'www') if os.path.isdir(os.path.join(HERE, 'www')) else os.path.join(HERE, 'app', 'src', 'main', 'assets', 'www')


def main():
    args = sys.argv[1:]
    if not args or ('--test' not in args and '--all' not in args):
        print(__doc__); sys.exit(1)
    content = args[0]
    note = args[args.index('--note') + 1] if '--note' in args else ''
    html = open(os.path.join(WWW, 'index.html'), encoding='utf-8').read()
    cfg = json.loads(re.search(r'window\.BOOT_CFG = (\{.*?\});', html).group(1))
    shell = args[args.index('--shell') + 1] if '--shell' in args else cfg['shell']
    app = cfg['app']
    files = {}
    for f in sorted(glob.glob(os.path.join(WWW, '*.js')) + glob.glob(os.path.join(WWW, '*.css')) + glob.glob(os.path.join(WWW, 'assets', '*.js')) + glob.glob(os.path.join(WWW, 'assets', '*.css'))):
        n = os.path.relpath(f, WWW).replace(os.sep, '/')
        if os.path.basename(n) in ('boot.js', 'capacitor.js') or n == 'sw.js':
            continue   # المحمِّل نفسه لا يُحدَّث من الخادم
        files[n] = open(f, encoding='utf-8').read()
    # ملفات البيانات: ما طُلب الآن مع ما أُرسل في النسخ السابقة (حتى لا يرجع تصحيح قديم)
    _out0 = os.path.join(content, cfg['dir']) if 'dir' in cfg else os.path.join(content, 'apps', cfg['app'])
    _prev = json.load(open(os.path.join(_out0, 'code.json'), encoding='utf-8')) if os.path.exists(os.path.join(_out0, 'code.json')) else {}
    data_list = list(_prev.get('data', []))
    if '--data' in args:
        data_list += [n.strip() for n in args[args.index('--data') + 1].split(',') if n.strip()]
    data_list = sorted(set(data_list))
    for n in cfg.get('pack', []):   # ملفات محتوى صغيرة تُرسل دائمًا مع البرنامج (كما في تطبيق المسلم الجديد)
        files[n] = open(os.path.join(WWW, n), encoding='utf-8').read()
    for n in data_list:
        files['data/' + n] = open(os.path.join(WWW, 'data', n), encoding='utf-8').read()
    body = re.search(r'<body[^>]*>(.*?)<script>window\.BOOT_CFG', html, re.S)
    if body:
        files['__body'] = body.group(1)   # واجهة الصفحة (ما بين <body> والمحمِّل)
    order = cfg['order'] + [n for n in files if n not in cfg['order'] and n.endswith('.css')] + [n for n in files if n not in cfg['order'] and n.endswith('.js') and not n.startswith('data/') and n not in cfg.get('pack', [])]
    txt = json.dumps({'order': order, 'files': files}, ensure_ascii=False, separators=(',', ':'))
    sha = hashlib.sha256(txt.encode('utf-8')).hexdigest()

    out = os.path.join(content, cfg['dir']) if 'dir' in cfg else os.path.join(content, 'apps', app)
    os.makedirs(os.path.join(out, 'code'), exist_ok=True)
    cj = os.path.join(out, 'code.json')
    m = json.load(open(cj, encoding='utf-8')) if os.path.exists(cj) else {}
    man = os.path.join(out, 'manifest.json')
    if os.path.exists(man):
        owner = json.load(open(man, encoding='utf-8')).get('owner')
        if owner:
            m['owner'] = owner
    last = max(int(m.get('ver') or 0), int((m.get('test') or {}).get('ver') or 0))

    def write_bin(ver):
        iv = os.urandom(12)
        data = iv + AESGCM(KEY).encrypt(iv, gzip.compress(txt.encode('utf-8'), 9), None)
        open(os.path.join(out, 'code', f'{ver}.bin'), 'wb').write(data)
        return {'ver': str(ver), 'url': f'code/{ver}.bin', 'shell': shell, 'sha': sha, 'note': note}

    if '--test' in args:
        t = m.get('test')
        if t and t.get('sha') == sha:
            print('نسخة التجربة هي نفسها، لا تغيير.'); return
        m['test'] = write_bin(last + 1)
        print(f'نسخة تجربة رقم {last + 1} لأجهزة المؤلف.')
    else:
        t = m.get('test')
        if t and t.get('sha') == sha:
            ent = dict(t); ent['note'] = note or t.get('note', '')
        elif m.get('sha') == sha:
            print('هذه النسخة منشورة للجميع من قبل.'); return
        else:
            ent = write_bin(last + 1)
        for k in ('ver', 'url', 'shell', 'sha', 'note'):
            m[k] = ent[k]
        m.pop('test', None)
        print(f'نُشرت النسخة {m["ver"]} لكل الأجهزة.')
    m['data'] = data_list
    if not m.get('owner'):
        print('تنبيه: لم يُوجد رمز المؤلف في manifest.json؛ نسخ التجربة لن تصل إلى أي جهاز حتى يُنشر manifest بأداة server_pack.py.')
    json.dump(m, open(cj, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # حذف الملفات القديمة غير المستعملة
    keep = {m.get('url'), (m.get('test') or {}).get('url')}
    for f in glob.glob(os.path.join(out, 'code', '*.bin')):
        if 'code/' + os.path.basename(f) not in keep:
            os.remove(f)


if __name__ == '__main__':
    main()
