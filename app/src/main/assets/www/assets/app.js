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
  // البحث الذكي (بلا إنترنت): يفهم السؤال ولو بعبارة مختلفة — يحذف ألفاظ السؤال العامة، ويرد الكلمة إلى أصل قريب،
  // ويستعمل مرادفات شائعة، ثم يرتب الفتاوى بحسب موضع التطابق (العنوان أولًا ثم السؤال ثم الخلاصة ثم النص).
  const STOP = new Set('ما ماذا هل حكم الحكم يجوز يصح لا ولا في من الى على عن ان او ثم اذا لو كان كانت يكون هذا هذه ذلك تلك الذي التي الذين انا انت نحن هو هي هم انه انها لي له لها لهم عند مع بعد قبل كل بعض اي كيف متى اين لماذا عليه عليها شيء شي فيه فيها منه منها قد لقد وهل افيدونا افتونا جزاكم الله خيرا يا شيخ سؤال سوال اريد اسال ارجو بين او ام غير الا اما فما فهل حتى ايضا جدا يعني مثلا'.split(' '));
  const SYN = [['صلاه', 'صلي', 'يصلي', 'الصلوات', 'صلوات'], ['وضوء', 'توضا', 'يتوضا', 'الوضو', 'وضو'], ['صوم', 'صيام', 'صائم', 'يصوم', 'رمضان', 'الصائم'], ['زكاه', 'يزكي', 'زكي'], ['امراه', 'زوجه', 'المراه', 'النساء', 'زوجتي'], ['نقود', 'فلوس', 'مال', 'اموال', 'راتب', 'دولار'], ['جنب', 'جنابه', 'احتلام', 'احتلم'], ['حيض', 'حائض', 'الدوره', 'العاده', 'حاضت'], ['ميت', 'متوفي', 'جنازه', 'الموتي', 'وفاه', 'مات'], ['مسجد', 'المساجد', 'جامع'], ['قران', 'المصحف', 'مصحف'], ['سفر', 'مسافر', 'سافر'], ['مريض', 'مرض', 'المرض'], ['دم', 'نزيف', 'الدم'], ['امام', 'الامام', 'الماموم'], ['نجاسه', 'نجس', 'متنجس', 'وسخ'], ['خف', 'جورب', 'شراب', 'جوارب'], ['تيمم', 'تراب'], ['اذان', 'المؤذن', 'موذن', 'الاذان'], ['قبله', 'الكعبه'], ['فجر', 'الصبح'], ['عيد', 'العيدين'], ['وتر', 'الشفع']];
  const SMAP = new Map(); SYN.forEach((g, i) => g.forEach(x => SMAP.set(x, i)));
  const stem = w => { let x = w; for (const p of ['وبال', 'فبال', 'وال', 'فال', 'بال', 'كال', 'لل', 'ال']) if (x.startsWith(p) && x.length - p.length >= 3) { x = x.slice(p.length); break; }
    if (x.length > 4 && /^[وف]/.test(x)) x = x.slice(1);
    for (const s of ['هما', 'كما', 'ات', 'ون', 'ين', 'ها', 'هم', 'ني', 'ه', 'ي']) if (x.endsWith(s) && x.length - s.length >= 3) { x = x.slice(0, -s.length); break; }
    return x; };
  const toks = s => norm(s).replace(/[^ء-يa-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  const IDX = F.map(f => { const fields = [[f.title, 5], [(f.alts || []).join(' '), 4], [f.q, 3], [f.short, 2], [f.body.map(plain).join(' '), 1]];
    const m = new Map(); for (const [t, wt] of fields) for (const w of toks(t)) { const k = stem(w); m.set(k, Math.max(m.get(k) || 0, wt)); const g = SMAP.get(w); if (g != null) m.set('#' + g, Math.max(m.get('#' + g) || 0, wt)); }
    return { f, m, all: norm([f.title, f.q, f.short, (f.alts || []).join(' '), f.body.map(plain).join(' ')].join(' ')) }; });
  function search(q) {
    const ws = toks(q); if (!ws.length) return [];
    const exact = norm(q).trim();
    const R = IDX.map(x => { let s = 0, hit = 0;
      for (const w of ws) { const k = stem(w); let v = x.m.get(k) || 0; const g0 = SMAP.get(w), g = g0 != null ? g0 : SMAP.get(k); if (g != null) v = Math.max(v, (x.m.get('#' + g) || 0) * 0.8); if (!v && k.length >= 4) { for (const [kk, vv] of x.m) if (kk.length >= 4 && (kk.startsWith(k) || k.startsWith(kk))) { v = Math.max(v, vv * 0.6); } } if (v) { hit++; s += v; } }
      if (exact.length > 3 && x.all.includes(exact)) s += 6;
      return { f: x.f, s, hit }; });
    const need = Math.max(1, Math.ceil(ws.length * 0.5));
    return R.filter(r => r.hit >= need && r.s > 0).sort((a, b) => b.s - a.s || b.hit - a.hit || a.f.n - b.f.n).map(r => Object.assign(r.f, { _s: r.s }));
  }
  // الجواب المجمَّع: خلاصات أقرب الفتاوى إلى السؤال، من نصوص الكتاب نفسه
  function composed(r) {
    if (!r.length) return '';
    const top = r[0]._s, pick = r.filter(f => f._s >= top * 0.6).slice(0, 3);
    return `<div class="combo"><div class="ct">الجواب من فتاوى الكتاب</div>` + pick.map(f => `<div class="cp"><div class="cq" data-go="#f/${f.n}">الفتوى رقم ${AR(f.n)}: ${esc(f.title)}</div><div class="cs">${esc(f.short)}</div><span class="more" data-go="#f/${f.n}">اقرأ الفتوى كاملة بأدلتها</span></div>`).join('') +
      `<div class="cn">هذا الجواب مجموع من خلاصات الفتاوى الأقرب إلى سؤالك، فإن لم يطابق سؤالك فانظر النتائج التي تحته.</div></div>`;
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
  function intro() {
    setBar('منهج الكتاب وأدب الخلاف');
    V.innerHTML = `<div class="hero"><h1 style="font-size:26px">منهج الكتاب وأدب الخلاف</h1></div><div class="card intro">${(D.intro || []).map(p => `<p>${esc(p)}</p>`).join('')}<p class="by">جمعه وأعده: ${esc(D.author || '')}</p></div>`;
  }
  // ---------- البحث بالصوت (بتصميم مكتبة عبد الحسيب منيب) ----------
  const AB = window.AndroidBridge || null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canVoice = () => (AB && typeof AB.voiceSearch === 'function') || !!SR;
  const MIC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>';
  const CLR = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const clrBtn = (v) => `<button type="button" class="clr-btn" data-act="clr" aria-label="مسح كلمات البحث"${v ? '' : ' hidden'}>${CLR}</button>`;
  const micBtn = () => canVoice() ? `<button type="button" class="mic-btn" data-act="mic" aria-label="البحث بالصوت">${MIC}</button>` : '';
  let vbox = null, rec = null, heard = '';
  function voice() {
    vbox = document.createElement('div'); vbox.className = 'voice-modal';
    vbox.innerHTML = `<div class="voice-card"><div class="vt">البحث بالصوت</div><button class="voice-ring" data-v="again">${MIC}</button><div class="vh">تكلّم الآن… اسأل عن مسألتك بأي عبارة</div><div class="vq"></div><div class="vbtns"><button class="btn" data-v="go">ابحث</button> <button class="btn ghost" data-v="cancel">إلغاء</button></div></div>`;
    document.body.appendChild(vbox);
    vbox.addEventListener('click', e => { const v = e.target.closest('[data-v]'); if (v) { if (v.dataset.v === 'go') vfinish(heard); else if (v.dataset.v === 'again') { vstop(); vstart(); } else vclose(); } else if (e.target === vbox) vclose(); });
    vstart();
  }
  function vshow(t, fin) { heard = t; const q = vbox && vbox.querySelector('.vq'); if (q) q.textContent = t ? '«' + t + '»' : ''; if (fin && t) setTimeout(() => vfinish(t), 500); }
  function vstart() {
    heard = ''; vshow(''); vbox && vbox.classList.add('on');
    if (AB && typeof AB.voiceSearch === 'function') { AB.voiceSearch('ar-SA'); return; }
    try { rec = new SR(); rec.lang = 'ar-SA'; rec.interimResults = true; rec.maxAlternatives = 1;
      rec.onresult = e => { let t = '', fin = false; for (const r of e.results) { t += r[0].transcript; fin = r.isFinal; } vshow(t.trim(), fin); };
      rec.onerror = () => { vbox && vbox.classList.remove('on'); if (!heard) verr(); }; rec.onend = () => vbox && vbox.classList.remove('on'); rec.start(); } catch (e) { verr(); }
  }
  function vstop() { try { rec && rec.abort(); } catch (e) {} rec = null; }
  function verr(m) { vbox && vbox.classList.remove('on'); const q = vbox && vbox.querySelector('.vq'); if (q) q.textContent = m || 'لم أسمع شيئًا، حاول مرة أخرى'; }
  function vclose() { vstop(); vbox && vbox.remove(); vbox = null; }
  function vfinish(t) { t = (t || '').trim(); vclose(); if (t) location.hash = 's/' + encodeURIComponent(t); }
  window.__voice = t => vshow(String(t || ''), true);
  window.__voiceErr = m => verr(m === 'none' ? 'خدمة التعرف على الكلام غير موجودة في الجهاز' : '');

  function home() {
    setBar('الفتاوى الميسّرة');
    let h = `<div class="hero"><div class="ht"><h1>${esc(D.title || 'الفتاوى الميسّرة')}</h1><div class="hl"><div class="sub">${esc(D.subtitle || 'في ضوء الكتاب والسنة')}</div>
      <div class="by">جمعه وأعده: ${esc(D.author || 'عبد الحسيب منيب الأفغاني')}</div></div></div>
      <div class="introl" data-go="#intro">منهج الكتاب وأدب الخلاف</div>
      <form class="sbox" id="sf"><input id="sq" type="search" placeholder="ابحث عن مسألتك… مثل: ماء البحر، السواك للصائم" autocomplete="off">${clrBtn('')}${micBtn()}<button class="btn">بحث</button></form></div>`;
    const open = new Set(P.open || []);
    h += `<div class="tg"><span>الفهرس</span><span><button class="lnk" data-act="openAll">فتح الكل</button> · <button class="lnk" data-act="closeAll">طي الكل</button></span></div>`;
    for (const k of TREE) {
      const ns = k.babs.flatMap(b => b.items.map(f => f.n)), on = open.has(k.name);
      h += `<div class="kt kx${on ? ' on' : ''}" data-act="kt" data-k="${esc(k.name)}"><span class="ar">${on ? '▾' : '◂'}</span> كتاب ${esc(k.name)} <span class="rng">${rng(Math.min(...ns), Math.max(...ns))}</span></div><div class="kb"${on ? '' : ' hidden'}>`;
      for (const b of k.babs) h += `<div class="bb" data-go="#b/${encodeURIComponent(k.name + '|' + b.name)}"><span>باب ${esc(b.name)}</span><span class="rng">${rng(b.items[0].n, b.items[b.items.length - 1].n)}</span></div>`;
      h += `</div>`;
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
    V.innerHTML = `<form class="sbox" id="sf"><input id="sq" type="search" value="${esc(q)}" autocomplete="off">${clrBtn(q)}${micBtn()}<button class="btn">بحث</button></form>` +
      (r.length ? composed(r) + `<div class="crumb">${AR(r.length)} نتيجة</div>` + r.slice(0, 40).map(item).join('') : `<div class="empty">لم نجد فتوى تطابق بحثك.</div>`) + askBox(q);
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
    if (h === 'intro') intro(); else if (h.startsWith('f/')) fatwa(h.slice(2)); else if (h.startsWith('b/')) bab(location.hash.slice(3)); else if (h.startsWith('s/')) results(h.slice(2)); else home();
  }

  // ---------- الأحداث ----------
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { location.hash = g.dataset.go; return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'back') history.length > 1 ? history.back() : (location.hash = '');
    else if (act === 'search') { location.hash = 's/'; setTimeout(() => { const i = $('#sq'); i && i.focus(); }, 50); }
    else if (act === 'kt') { const o = new Set(P.open || []), k = a.dataset.k; o.has(k) ? o.delete(k) : o.add(k); P.open = [...o]; save(); const y = window.scrollY; home(); window.scrollTo(0, y); }
    else if (act === 'openAll') { P.open = TREE.map(k => k.name); save(); home(); }
    else if (act === 'closeAll') { P.open = []; save(); home(); }
    else if (act === 'mic') { voice(); }
    else if (act === 'clr') { const i = $('#sq'); if (i) { i.value = ''; a.hidden = true; i.focus(); } }
    else if (act === 'settings') { $('#sheet').hidden = false; }
    else if (act === 'closeSheet') { $('#sheet').hidden = true; }
    else if (act === 'fs') { P.fs = Math.max(15, Math.min(30, (P.fs || 19) + Number(a.dataset.v))); save(); applyPrefs(); }
    else if (act === 'theme') { P.theme = a.dataset.v; save(); applyPrefs(); }
    else if (act === 'ota') { toast('جارٍ التحقق…'); (window.OTA ? window.OTA.check() : Promise.resolve('none')).then(r => toast(r === 'got' ? 'وصل تحديث، يُطبَّق عند الفتح التالي' : r === 'same' ? 'التطبيق محدَّث' : 'لا يوجد تحديث الآن')); }
  });
  document.addEventListener('input', e => { if (e.target.id === 'sq') { const b = $('.clr-btn'); if (b) b.hidden = !e.target.value; } });
  document.addEventListener('submit', e => { if (e.target.id === 'sf') { e.preventDefault(); location.hash = 's/' + encodeURIComponent($('#sq').value.trim()); } });
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });
  function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.k); toast.k = setTimeout(() => el.hidden = true, 2600); }
  $('#about').innerHTML = `<b>${esc(D.title || 'الفتاوى الميسّرة')}</b> ${esc(D.subtitle || '')}<br>جمعه وأعده: ${esc(D.author || '')}<br>عدد الفتاوى: ${AR(F.length)} — إصدار البرنامج ${AR((window.BOOT && window.BOOT.shell) || '')}${window.BOOT && window.BOOT.ver ? ' (تحديث ' + AR(window.BOOT.ver) + ')' : ''}`;
  window.addEventListener('hashchange', route);
  route();
})();
