/* الفتاوى الميسّرة في ضوء الكتاب والسنة — واجهة التطبيق
   البيانات في data/fatawa.js (window.FATAWA)، وتُحدَّث من الخادم مع البرنامج. */
(function () {
  'use strict';
  const D = window.FATAWA || { fatawa: [] }, F = D.fatawa || [];
  const $ = s => document.querySelector(s), V = $('#view');
  const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = (() => { try { return JSON.parse(localStorage.getItem('fw.prefs') || '{}'); } catch (e) { return {}; } })();
  const save = () => { try { localStorage.setItem('fw.prefs', JSON.stringify(P)); } catch (e) {} };
  const applyPrefs = () => { document.documentElement.style.setProperty('--fs', (P.fs || 19) + 'px'); document.documentElement.dataset.theme = P.theme || 'light'; };
  applyPrefs();

  // ---------- تلوين ألفاظ التقسيم والقائل والترجيح ----------
  const DI = '[\\u064B-\\u0652\\u0670\\u0640]*';
  const w = lit => [...lit].map(ch => /\s/.test(ch) ? '\\s+' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + DI).join('');
  const byLen = a => a.slice().sort((x, y) => y.length - x.length);
  const ENUM = ['الطرف الأول', 'الطرف الثاني', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'الأولى', 'الثانية', 'الثالثة', 'أحدها', 'أحدهما', 'أحدهم'];
  const TARJ = ['والراجح', 'الراجح', 'والأظهر', 'الأظهر', 'وبالجملة', 'والصحيح', 'والحاصل', 'والحق', 'والأول أولى', 'وقول الجمهور أولى', 'كما هو المختار', 'والذي يظهر', 'الذي يظهر', 'المفتى به', 'وعليه الفتوى', 'وهو الأصح', 'والأحوط', 'الأحوط', 'فالراجح'];
  const SAY = ['وقال', 'قال', 'قلت', 'قلنا', 'وقالوا', 'ولنا'];
  const AL = '\\u0600-\\u06FF';
  const RX = new RegExp('(?<enum>(?<![\\w' + AL + '])(?:' + byLen(ENUM).map(w).join('|') + ')(?=\\s*[:،,—]))' +
    '|(?<tarj>(?<![' + AL + '])(?:' + byLen(TARJ).map(w).join('|') + ')(?![\\u0621-\\u064A]))' +
    '|(?<say>(?<![' + AL + '])(?:' + SAY.map(w).join('|') + ')(?:\\s[^:،.«»؛\\n]{1,40}?)?:)', 'g');
  function rich(t) {
    return String(t).split(/(«[^»]*»)/).map(part => {
      if (!part) return '';
      if (part[0] === '«') return '<span class="hd">' + esc(part) + '</span>';
      let out = '', i = 0; RX.lastIndex = 0; let m;
      while ((m = RX.exec(part))) {
        const k = m.groups.enum ? 'enum' : m.groups.tarj ? 'tarj' : 'say';
        out += esc(part.slice(i, m.index)) + '<span class="' + k + '">' + esc(m[0]) + '</span>'; i = m.index + m[0].length;
      }
      return out + esc(part.slice(i));
    }).join('');
  }

  // ---------- البحث ----------
  const norm = s => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').toLowerCase();
  const plain = x => x.t === 'tanbih' ? x.items.map(plain).join(' ') : (x.text || '') + ' ' + (x.label || '');
  const IDX = F.map(f => ({ f, head: norm(f.title + ' ' + (f.alts || []).join(' ')), all: norm([f.title, f.q, f.short, (f.alts || []).join(' '), f.body.map(plain).join(' ')].join(' ')) }));
  function search(q) {
    const ws = norm(q).split(/\s+/).filter(Boolean); if (!ws.length) return [];
    return IDX.filter(x => ws.every(w => x.all.includes(w))).map(x => ({ f: x.f, s: ws.filter(w => x.head.includes(w)).length })).sort((a, b) => b.s - a.s || a.f.n - b.f.n).map(x => x.f);
  }

  // ---------- الشجرة: الكتاب ← الباب ← الفتاوى ----------
  const TREE = [];
  for (const f of F) {
    let k = TREE.find(x => x.name === f.bab); if (!k) TREE.push(k = { name: f.bab, babs: [] });
    let b = k.babs.find(x => x.name === f.sub); if (!b) k.babs.push(b = { name: f.sub, items: [] });
    b.items.push(f);
  }
  const rng = (a, b) => '(' + AR(a) + (a !== b ? '–' + AR(b) : '') + ')';

  // ---------- الصفحات ----------
  function setBar(t) { $('#barTitle').textContent = t; $('#back').hidden = !location.hash || location.hash === '#'; }
  function item(f) { return `<div class="li" data-go="#f/${f.n}"><span class="n">${AR(f.n)}</span><span class="t">${esc(f.title)}<span class="q">${esc(f.q)}</span></span></div>`; }
  function home() {
    setBar('الفتاوى الميسّرة');
    let h = `<div class="hero"><h1>${esc(D.title || 'الفتاوى الميسّرة')}</h1><div class="sub">${esc(D.subtitle || 'في ضوء الكتاب والسنة')}</div>
      <div class="by">جمعه وأعده: ${esc(D.author || 'عبد الحسيب منيب الأفغاني')}</div>
      <form class="sbox" id="sf"><input id="sq" type="search" placeholder="ابحث عن مسألتك… مثل: ماء البحر، السواك للصائم" autocomplete="off"><button class="btn">بحث</button></form></div>`;
    for (const k of TREE) {
      const ns = k.babs.flatMap(b => b.items.map(f => f.n));
      h += `<div class="kt">كتاب ${esc(k.name)} <span class="rng">${rng(Math.min(...ns), Math.max(...ns))}</span></div>`;
      for (const b of k.babs) h += `<div class="bb" data-go="#b/${encodeURIComponent(k.name + '|' + b.name)}"><span>باب ${esc(b.name)}</span><span class="rng">${rng(b.items[0].n, b.items[b.items.length - 1].n)}</span></div>`;
    }
    V.innerHTML = h + askBox();
  }
  function bab(key) {
    const [kn, bn] = decodeURIComponent(key).split('|'); const k = TREE.find(x => x.name === kn), b = k && k.babs.find(x => x.name === bn);
    if (!b) return home();
    setBar('باب ' + b.name);
    V.innerHTML = `<div class="kt">كتاب ${esc(k.name)}</div><div class="bb"><span>باب ${esc(b.name)}</span><span class="rng">${rng(b.items[0].n, b.items[b.items.length - 1].n)}</span></div>` + b.items.map(item).join('');
  }
  function results(q) {
    setBar('البحث');
    const r = search(q);
    V.innerHTML = `<form class="sbox" id="sf"><input id="sq" type="search" value="${esc(q)}" autocomplete="off"><button class="btn">بحث</button></form>` +
      (r.length ? `<div class="crumb">${AR(r.length)} نتيجة</div>` + r.map(item).join('') : `<div class="empty">لم نجد فتوى تطابق بحثك.</div>`) + askBox(q);
  }
  function body(xs) {
    return xs.map(x => {
      switch (x.t) {
        case 'h': return `<div class="${x.k === 'r' ? 'rj' : 'sec'}">${esc(x.text)}</div>`;
        case 'p': return `<div class="p">${rich(x.text)}</div>`;
        case 'aya': return `<div class="aya">﴿${esc(x.text)}﴾ <span class="src">[${esc(x.ref)}]</span></div>`;
        case 'quote': return `<div class="p">${x.pre ? '<span class="say">' + rich(x.pre) + '</span> ' : ''}${rich(x.text)} <span class="src">(${esc((x.src + ' ' + (x.loc || '')).trim())})</span></div>`;
        case 'qawl': return `<div class="qawl"><span class="lbl">${esc(x.label)}:</span> ${esc(x.text)}</div>`;
        case 'taifa': return `<div class="taifa"><span class="lbl">${esc(x.label)}:</span> ${esc(x.text)}</div>`;
        case 'tanbih': return `<div class="tn"><div class="rj">تنبيه</div>${body(x.items)}</div>`;
        default: return '';
      }
    }).join('');
  }
  function fatwa(n) {
    const f = F.find(x => String(x.n) === String(n)); if (!f) return home();
    setBar('الفتوى رقم ' + AR(f.n));
    const rel = (f.related || []).map(t => { const g = F.find(x => x.title === t); return g ? `<span class="chip" data-go="#f/${g.n}">${esc(t)}</span>` : ''; }).join('');
    V.innerHTML = `<article class="fv"><div class="crumb">كتاب ${esc(f.bab)} › باب ${esc(f.sub)}</div>
      <h2><span class="no">الفتوى رقم ${AR(f.n)}:</span> ${esc(f.title)}</h2>
      <div class="p"><span class="lbl">السؤال:</span> ${esc(f.q)}</div>
      <div class="ans"><span class="lbl">الجواب المختصر:</span> ${esc(f.short)}</div>
      <div class="p">الحمد لله، والصلاة والسلام على رسول الله، أما بعد:</div>
      ${body(f.body)}
      <div class="end">والله أعلم.</div>
      <div class="refs"><b>المراجع:</b> ${esc((f.refs || []).join('، '))}</div>
      ${rel ? `<div class="refs"><b>مسائل ذات صلة:</b><div class="chips">${rel}</div></div>` : ''}
    </article>` + askBox();
    window.scrollTo(0, 0);
  }
  function askBox(q) {
    const mail = D.email;
    return `<div class="ask">لم تجد جواب مسألتك؟ ${mail ? `<a class="btn" href="mailto:${esc(mail)}?subject=${encodeURIComponent('سؤال — الفتاوى الميسّرة')}&body=${encodeURIComponent(q || '')}">أرسل سؤالك</a>` : 'سيُعلَن قريبًا بريدٌ لإرسال الأسئلة والملاحظات.'}</div>`;
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('f/')) fatwa(h.slice(2)); else if (h.startsWith('b/')) bab(location.hash.slice(3)); else if (h.startsWith('s/')) results(h.slice(2)); else home();
  }

  // ---------- الأحداث ----------
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { location.hash = g.dataset.go; return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') history.length > 1 ? history.back() : (location.hash = '');
    else if (act === 'search') { location.hash = 's/'; setTimeout(() => { const i = $('#sq'); i && i.focus(); }, 50); }
    else if (act === 'settings') { $('#sheet').hidden = false; }
    else if (act === 'closeSheet') { $('#sheet').hidden = true; }
    else if (act === 'fs') { P.fs = Math.max(15, Math.min(30, (P.fs || 19) + Number(a.dataset.v))); save(); applyPrefs(); }
    else if (act === 'theme') { P.theme = a.dataset.v; save(); applyPrefs(); }
    else if (act === 'ota') { toast('جارٍ التحقق…'); (window.OTA ? window.OTA.check() : Promise.resolve('none')).then(r => toast(r === 'got' ? 'وصل تحديث، يُطبَّق عند الفتح التالي' : r === 'same' ? 'التطبيق محدَّث' : 'لا يوجد تحديث الآن')); }
  });
  document.addEventListener('submit', e => { if (e.target.id === 'sf') { e.preventDefault(); location.hash = 's/' + encodeURIComponent($('#sq').value.trim()); } });
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });
  function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.k); toast.k = setTimeout(() => el.hidden = true, 2600); }
  $('#about').innerHTML = `<b>${esc(D.title || 'الفتاوى الميسّرة')}</b> ${esc(D.subtitle || '')}<br>جمعه وأعده: ${esc(D.author || '')}<br>عدد الفتاوى: ${AR(F.length)} — إصدار البرنامج ${AR((window.BOOT && window.BOOT.shell) || '')}${window.BOOT && window.BOOT.ver ? ' (تحديث ' + AR(window.BOOT.ver) + ')' : ''}`;
  window.addEventListener('hashchange', route);
  route();
})();
