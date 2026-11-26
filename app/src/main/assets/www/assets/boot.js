/* مُحمِّل التطبيق — تحديث البرنامج من الخادم المركزي بلا إعادة تثبيت
   ١) عند الفتح: إن كانت في الجهاز نسخة من ملفات البرنامج (js/css) نزلت من الخادم وسليمة، يعمل بها؛ وإلا فبالملفات المثبَّتة.
   ٢) بعد الفتح: يتحقق من apps/<التطبيق>/code.json؛ فإن وجد نسخة أحدث نزّلها (مشفّرة) وحفظها لتعمل من الفتح التالي.
   ٣) نسخة «للتجربة» تصل إلى أجهزة المؤلف وحدها (رمز المؤلف)، ونسخة «للجميع» تصل إلى كل الأجهزة.
   ٤) إن تعطّل التطبيق مع نسخة جديدة رجع تلقائيًّا إلى ما قبلها، ولا يعيد تنزيلها.
   الإعداد في BOOT_CFG داخل index.html: { app, shell, order:[الملفات بترتيبها] }. */
(function () {
  'use strict';
  const C = window.BOOT_CFG, LS = localStorage, K = 'ota.' + C.app + '.';
  const BASE = (() => { try { return LS.getItem('rc.base') || ''; } catch (e) { return ''; } })() || C.base || ('https://raw.githubusercontent.com/hamzamunibwork/munib-content/main/apps/' + C.app + '/');
  const CODE_URL = BASE.replace(/\/?$/, '/') + 'code.json';
  const PA = [230, 179, 138, 146, 159, 43, 30, 175, 109, 0, 172, 38, 136, 43, 166, 107, 167, 124, 190, 163, 211, 221, 145, 232, 2, 39, 102, 27, 90, 180, 164, 74], PM = [253, 45, 187, 227, 54, 34, 111, 177, 145, 192, 102, 104, 239, 64, 194, 76, 123, 125, 159, 168, 98, 236, 35, 215, 16, 36, 11, 130, 132, 111, 135, 239];
  const get = k => { try { return LS.getItem(K + k); } catch (e) { return null; } };
  const set = (k, v) => { try { v == null ? LS.removeItem(K + k) : LS.setItem(K + k, v); } catch (e) {} };
  const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

  // التخزين: IndexedDB
  let dbP = null;
  const db = () => dbP || (dbP = new Promise((res) => { try { const r = indexedDB.open('munib-ota', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
  const dget = k => db().then(d => d ? new Promise(r => { const q = d.transaction('kv').objectStore('kv').get(C.app + ':' + k); q.onsuccess = () => r(q.result || null); q.onerror = () => r(null); }) : null);
  const dput = (k, v) => db().then(d => d && new Promise(r => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, C.app + ':' + k); t.oncomplete = r; t.onerror = r; }));
  const ddel = k => db().then(d => d && new Promise(r => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(C.app + ':' + k); t.oncomplete = r; t.onerror = r; }));

  // الإقلاع
  let bootErr = false; const onErr = () => { bootErr = true; };
  window.addEventListener('error', onErr);
  function loadLocal(f) { return new Promise(res => { if (/\.css$/.test(f) && document.querySelector('link[href="' + f + '"]')) return res(); if (/\.css$/.test(f)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = f; l.onload = l.onerror = res; document.head.appendChild(l); } else { const s = document.createElement('script'); s.src = f; s.async = false; s.onload = s.onerror = res; document.body.appendChild(s); } }); }
  function loadText(f, txt) { if (/\.css$/.test(f)) { const st = document.createElement('style'); st.dataset.f = f; st.textContent = txt; document.head.appendChild(st); } else { const s = document.createElement('script'); s.dataset.f = f; s.textContent = txt + '\n//# sourceURL=ota/' + f; document.body.appendChild(s); } }
  async function start() {
    let pack = null; const want = get('ver'), bad = (get('bad') || '').split(',');
    if (want && !bad.includes(want)) { try { pack = await dget('pack:' + want); } catch (e) {} if (pack && String(pack.ver) !== want) pack = null; }
    if (pack && pack.shell && cmpVer(C.shell, pack.shell) < 0) pack = null;   // تحتاج تثبيتًا أحدث
    const order = (pack && pack.order) || C.order;
    if (pack) set('trying', pack.ver);
    window.BOOT = { ver: pack ? pack.ver : 0, shell: C.shell, app: C.app };
    if (pack && pack.files && pack.files.__body != null) {   // واجهة الصفحة نفسها (الأزرار والقوائم) من الخادم
      document.body.innerHTML = pack.files.__body;
    }
    for (const f of order) { if (pack && pack.files && pack.files[f] != null) loadText(f, pack.files[f]); else await loadLocal(f); }
    if (pack) {   // هل فتح التطبيق سليمًا؟ يُفحص كل نصف ثانية حتى ١٥ ثانية
      let n = 0; const iv = setInterval(() => {
        const main = document.querySelector(C.ok || '#main'), ok = !bootErr && main && main.children.length > 0; n++;
        if (ok) { clearInterval(iv); set('trying', null); const og = get('good'); set('good', pack.ver); if (og && og !== String(pack.ver)) ddel('pack:' + og); window.removeEventListener('error', onErr); return; }
        if (bootErr || n >= 30) { clearInterval(iv); set('bad', [...bad.filter(Boolean), pack.ver].join(',')); set('ver', get('good') && get('good') !== String(pack.ver) ? get('good') : null); set('trying', null); location.reload(); }
      }, 500);
    } else window.removeEventListener('error', onErr);
    setTimeout(check, 4000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - (check.t || 0) > 600000) check(); });
  }
  // تعطّل في الإقلاع السابق قبل أن يُعلَم سليمًا ← تُعلَّم النسخة معطوبة
  { const tr = get('trying'); if (tr) { const bad = (get('bad') || '').split(',').filter(Boolean); if (!bad.includes(tr)) bad.push(tr); set('bad', bad.join(',')); set('ver', get('good') && get('good') !== tr ? get('good') : null); set('trying', null); } }

  // التحقق من الخادم
  async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  async function check(manual) {
    check.t = Date.now();
    try {
      if (!window.fetch || !window.crypto || !crypto.subtle || !window.DecompressionStream) return manual && 'nosup';
      const r = await fetch(CODE_URL + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return manual && 'none';
      const m = await r.json(); if (!m || !m.ver) return manual && 'none';
      const owner = m.owner && LS.getItem('rc.owner') === m.owner;
      const ch = (owner && m.test && m.test.ver) ? m.test : m;   // أجهزة المؤلف تأخذ نسخة التجربة إن وُجدت
      if (!ch.ver || !ch.url) return manual && 'none';
      const bad = (get('bad') || '').split(',');
      if (String(ch.ver) === String(window.BOOT.ver) || String(ch.ver) === get('ver') || bad.includes(String(ch.ver))) return manual && 'same';
      if (ch.shell && cmpVer(C.shell, ch.shell) < 0) return manual && 'shell';
      const bin = await (await fetch(BASE.replace(/\/?$/, '/') + ch.url + '?v=' + ch.ver, { cache: 'no-store' })).arrayBuffer();
      const u = new Uint8Array(bin), key = await crypto.subtle.importKey('raw', new Uint8Array(PA.map((x, i) => x ^ PM[i])), 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12));
      const txt = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      const pack = JSON.parse(txt); pack.ver = String(ch.ver); pack.shell = ch.shell || pack.shell || '';
      if (ch.sha && (await sha256(txt)) !== ch.sha) return manual && 'bad';
      const pv = get('ver'); await dput('pack:' + pack.ver, pack); set('ver', pack.ver); if (pv && pv !== get('good') && pv !== pack.ver) ddel('pack:' + pv);
      notify(ch.note || '');
      return 'got';
    } catch (e) { return manual && 'err'; }
  }
  const TX = {
    ar: ['وصل تحديث جديد للتطبيق', 'يُطبَّق عند الفتح التالي.', 'أعد الفتح الآن', 'لاحقًا'],
    ps: ['د اپ نوی تازه معلومات راغلل', 'په راتلونکي ځل پرانیستلو کې پلي کېږي.', 'اوس بیا پرانیزه', 'وروسته'],
    fa: ['به‌روزرسانی تازهٔ برنامه رسید', 'در باز کردن بعدی اعمال می‌شود.', 'اکنون دوباره باز کن', 'بعداً'],
    en: ['A new app update has arrived', 'It applies the next time you open the app.', 'Reopen now', 'Later'],
  };
  function notify(note) {
    let L = 'ar'; try { const s = JSON.parse(LS.getItem(C.prefix + (C.skey || 'settings')) || '{}'); L = TX[s.lang] ? s.lang : (C.app === 'arabic' ? 'ps' : (TX[document.documentElement.lang] ? document.documentElement.lang : 'ar')); } catch (e) {}
    const t = TX[L], d = document.createElement('div'); d.className = 'ota-bar';
    if (!getComputedStyle(d).position || getComputedStyle(document.body).getPropertyValue('--g1') === '') d.style.cssText = 'position:fixed;z-index:9999;left:50%;transform:translateX(-50%);bottom:calc(86px + env(safe-area-inset-bottom));width:min(560px,calc(100vw - 20px));display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#164A3D;color:#F4F1E6;border-radius:16px;padding:12px 14px;box-shadow:0 14px 34px -12px rgba(0,0,0,.5);font-family:system-ui,sans-serif;direction:' + (L === 'en' ? 'ltr' : 'rtl');
    d.innerHTML = `<div><b>${t[0]}</b><span>${note ? note.replace(/[<>&]/g, '') + ' — ' : ''}${t[1]}</span></div><button class="btn" data-a="go">${t[2]}</button><button class="btn ghost" data-a="x">${t[3]}</button>`;
    d.querySelectorAll('button').forEach(b => { if (!b.style.cssText) b.style.cssText = 'border:0;border-radius:10px;padding:8px 14px;font:inherit;cursor:pointer;' + (b.dataset.a === 'go' ? 'background:#E2C98A;color:#13392F' : 'background:transparent;color:#F4F1E6;border:1px solid rgba(244,241,230,.4)'); });
    d.querySelector('[data-a=go]').onclick = () => location.reload(); d.querySelector('[data-a=x]').onclick = () => d.remove();
    document.body.appendChild(d);
  }
  window.OTA = { check: () => check(true), reset() { set('ver', null); set('bad', null); set('good', null); location.reload(); } };
  start();
})();
