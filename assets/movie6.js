/* SF Money Trail — the shots of a written film (format 6), drawn by assets/movie.js.
   A written film (its script file, built by scripts/movies/build_movies.py) is a run of shots; each beat
   of narration names its shot and a visual cue. Every picture is drawn here from the cue and the case file, and every
   movement is a function of the film's clock, so pausing, seeking and stills always show the right frame.
   FD_FILM6.shot(beats, c, k) -> { el, update(st) }; st = { lt: seconds into the shot, dur, i: beat within the shot,
   bp: 0..1 through that beat, bt: seconds into that beat, t: film time }. */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const E = x => 1 - Math.pow(1 - clamp(x), 3);                                   // ease out
  const EIO = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const BACK = x => { x = clamp(x); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const P = (x, a, d) => clamp((x - a) / d);
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const parseMoney = s => { const m = String(s).match(/\$([\d,]+(?:\.\d+)?)\s*(million|billion)?/i); if (!m) return 0; const v = +m[1].replace(/,/g, ''); return v * (m[2] ? (m[2].toLowerCase() === 'billion' ? 1e9 : 1e6) : 1); };
  const likeMoney = (v, like) => { const m = String(like).match(/\$([\d,]+)(?:\.(\d+))?\s*(million|billion)?/i); if (!m) return '$' + Math.round(v).toLocaleString('en-US'); if (m[3]) { const u = m[3].toLowerCase() === 'billion' ? 1e9 : 1e6; return '$' + (v / u).toFixed((m[2] || '').length) + ' ' + m[3]; } return '$' + Math.round(v).toLocaleString('en-US'); };
  const short = v => (v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + Math.round(v));
  const words = (t, cls = 'w') => String(t).split(/\s+/).filter(Boolean).map(w => `<span class="${cls}">${esc(w)}</span>`).join(' ');
  const reveal = (els, x, step, dur = .5, from = 18) => els.forEach((el, i) => { const o = E((x - i * step) / dur); el.style.opacity = o; el.style.transform = `translateY(${(1 - o) * from}px)`; el.style.filter = o < 1 ? `blur(${(1 - o) * 6}px)` : ''; });
  const show = (el, o, dy = 16, sc = 0) => { if (!el) return; el.style.opacity = o; el.style.transform = `translateY(${(1 - o) * dy}px)` + (sc ? ` scale(${1 + (1 - o) * sc})` : ''); };
  const node = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
  const ICON = {
    loan: '<svg viewBox="0 0 64 64"><rect x="6" y="16" width="52" height="32" rx="5" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="32" r="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 22h6M46 42h6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    payroll: '<svg viewBox="0 0 64 64"><circle cx="32" cy="20" r="8" fill="currentColor"/><path d="M18 50c0-9 6-15 14-15s14 6 14 15z" fill="currentColor"/><circle cx="14" cy="26" r="6" fill="currentColor" opacity=".6"/><path d="M3 50c0-7 4-12 11-12 3 0 5 1 7 2-3 3-5 6-5 10z" fill="currentColor" opacity=".6"/><circle cx="50" cy="26" r="6" fill="currentColor" opacity=".6"/><path d="M61 50c0-7-4-12-11-12-3 0-5 1-7 2 3 3 5 6 5 10z" fill="currentColor" opacity=".6"/></svg>',
    stamp: '<svg viewBox="0 0 64 64"><path d="M24 8h16v18l8 8v8H16v-8l8-8z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M10 50h44v6H10z" fill="currentColor"/></svg>',
    doc: '<svg viewBox="0 0 64 64"><path d="M14 6h26l12 12v40H14z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M40 6v12h12M22 30h20M22 38h20M22 46h12" stroke="currentColor" stroke-width="3" fill="none"/></svg>',
    agency: '<svg viewBox="0 0 64 64"><path d="M8 24 32 10l24 14z" fill="currentColor"/><path d="M14 28v20M26 28v20M38 28v20M50 28v20" stroke="currentColor" stroke-width="5"/><path d="M8 52h48" stroke="currentColor" stroke-width="5"/></svg>',
    nonprofit: '<svg viewBox="0 0 64 64"><path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" fill="currentColor"/></svg>',
    account: '<svg viewBox="0 0 64 64"><circle cx="20" cy="22" r="7" fill="currentColor"/><circle cx="44" cy="22" r="7" fill="currentColor"/><path d="M8 48c0-8 5-13 12-13s12 5 12 13zM32 48c0-8 5-13 12-13s12 5 12 13z" fill="currentColor"/></svg>',
    lens: '<svg viewBox="0 0 64 64"><circle cx="26" cy="26" r="16" fill="rgba(79,157,240,.12)" stroke="currentColor" stroke-width="4"/><path d="M38 38l16 16" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>',
  };
  const ILLUS = '<div class="s6-illus">Illustration, not data</div>';

  // ---- one function per kind of shot
  const K = {};
  const tierTag = t => ({ REDFLAG: 'Lead', OFFICIAL: 'Official finding', PROVEN: 'Proven', CHARGED: 'Charged' })[t] || 'Case';      // the small brand tag names what the film is about
  K.hook = (bs, c) => {
    const v = bs[0].visual, r = rng(7), dots = Array.from({ length: 179 }, () => [r() * 1280, r() * 720, 1.5 + r() * 3, r()]);
    const el = node(`<div class="s6 s6-hook"><div class="cam"><svg class="field" viewBox="0 0 1280 720">${dots.map(d => `<circle cx="${d[0].toFixed(0)}" cy="${d[1].toFixed(0)}" r="${d[2].toFixed(1)}" style="opacity:${(.15 + d[3] * .5).toFixed(2)}"/>`).join('')}</svg>
      <div class="f-big ${(v.words || []).join(' ').length > 22 ? 'xl' : (v.words || []).join(' ').length > 14 ? 'l' : ''}">${(v.words || []).map(w => `<span class="w">${esc(w)}</span>`).join(' ')}</div><div class="f-sub">${esc(v.sub || '')}</div></div><div class="tag6"><b>SF Money Trail · ${tierTag(c.tier)}</b><span>${esc(c.title)}</span></div></div>`);
    const ws = [...el.querySelectorAll('.f-big .w')], sub = el.querySelector('.f-sub'), field = el.querySelector('.field'), tag = el.querySelector('.tag6');
    return { el, update: st => { ws.forEach((w, i) => { const o = E((st.lt - .05 - i * .35) / .5); w.style.opacity = o; w.style.transform = `translateY(${(1 - o) * 50}px) scale(${1.35 - .35 * o})`; w.style.filter = `blur(${(1 - o) * 14}px)`; });
      show(sub, E((st.lt - 1.1) / .6)); show(tag, E((st.lt - .2) / .5), 10); field.style.transform = `translate(${-st.lt * 4}px, ${-st.lt * 2}px) scale(${1 + st.lt * .006})`; } };
  };
  K.count = (bs, c) => {
    const v = bs[0].visual, val = valOf(v.value), m = String(v.value).match(/^(\$[\d.,]+)\s*(.*)$/);
    const el = node(`<div class="s6 s6-count"><div class="cam"><svg class="ring" viewBox="0 0 600 600"><circle cx="300" cy="300" r="270" class="r0"/><circle cx="300" cy="300" r="270" class="r1" pathLength="1"/>${Array.from({ length: 60 }, (_, i) => `<line x1="300" y1="14" x2="300" y2="${i % 5 ? 24 : 34}" transform="rotate(${i * 6} 300 300)" class="tk" data-i="${i}"/>`).join('')}</svg>
      <div class="f-num"><span class="v">$0</span><span class="u">${esc(m ? m[2] : '')}</span></div><div class="f-lab">${esc(v.label || '')}</div><div class="f-sub">${esc(v.sub || '')}</div></div></div>`);
    const vEl = el.querySelector('.v'), r1 = el.querySelector('.r1'), tks = [...el.querySelectorAll('.tk')], lab = el.querySelector('.f-lab'), sub = el.querySelector('.f-sub');
    return { el, update: st => { const q = E((st.lt - .1) / 1.8); vEl.textContent = likeAny(val * q, String(v.value)).replace(/\s*(million|billion)$/i, ''); r1.style.strokeDashoffset = 1 - q; tks.forEach((t, i) => t.classList.toggle('on', i / 60 < q));
      show(lab, E((st.lt - .9) / .5)); show(sub, E((st.lt - 1.5) / .5)); } };
  };
  K.caveat = bs => {
    const v = bs[0].visual;
    const el = node(`<div class="s6 s6-caveat"><div class="cam"><div class="f-bar"></div><div class="f-kick">Before we go on</div><h2>${words(v.line)}</h2><div class="tags">${(v.tags || []).map((t, i) => `<span><i>${i + 1}</i>${esc(t)}</span>`).join('')}</div></div></div>`);
    const bar = el.querySelector('.f-bar'), ws = [...el.querySelectorAll('h2 .w')], tags = [...el.querySelectorAll('.tags span')], kick = el.querySelector('.f-kick');
    return { el, update: st => { bar.style.transform = `scaleY(${E(st.lt / .6)})`; show(kick, E(st.lt / .4)); reveal(ws, st.lt * 3, .3, .4); tags.forEach((t, i) => show(t, E((st.bp - .55 - i * .1) / .12))); } };
  };
  K.title = (bs, c) => {
    const el = node(`<div class="s6 s6-title"><div class="cam"><div class="f-brand"><b>SF Money Trail</b><i></i><span>${esc(c.category || '')}</span></div><h1>${words(c.title)}</h1><div class="f-line"></div></div></div>`);
    const ws = [...el.querySelectorAll('h1 .w')], brand = el.querySelector('.f-brand'), line = el.querySelector('.f-line');
    return { el, update: st => { show(brand, E(st.lt / .7)); reveal(ws, st.lt - .5, .09, .55, 26); line.style.transform = `scaleX(${EIO((st.lt - 1) / 2)})`; } };
  };
  K.program = bs => {
    const v = bs[0].visual, ic = ['loan', 'payroll', 'stamp'];
    const el = node(`<div class="s6 s6-program"><div class="cam"><div class="f-kick">${esc(v.sub || '')}</div><svg class="f-links" viewBox="0 0 1280 720"><path d="M400 340 H560" pathLength="1"/><path d="M720 340 H880" pathLength="1"/><g class="coins">${[0, 1, 2, 3, 4, 5].map(() => '<circle r="7"/>').join('')}</g></svg>
      ${(v.steps || []).map((s, i) => `<div class="f-st f-st${i}" style="left:${320 + i * 320}px"><div class="f-ic">${ICON[ic[i]]}</div><b>${esc(s)}</b></div>`).join('')}<div class="stamp">${esc((v.steps || [])[2] || '')}</div></div></div>`);
    const sts = [...el.querySelectorAll('.f-st')], ls = [...el.querySelectorAll('.f-links path')], coins = [...el.querySelectorAll('.coins circle')], stamp = el.querySelector('.stamp');
    return { el, update: st => { const at = [.02, .3, .62]; sts.forEach((s, i) => show(s, BACK(P(st.bp, at[i], .1)), 30)); ls.forEach((l, i) => { l.style.strokeDashoffset = 1 - E(P(st.bp, at[i] + .08, .14)); });
      coins.forEach((cn, i) => { const seg = i % 2, f = ((st.lt * .45 + i / 6) % 1), on = st.bp > at[seg] + .2; cn.setAttribute('cx', (400 + seg * 320 + f * 160).toFixed(1)); cn.setAttribute('cy', 340); cn.style.opacity = on ? Math.sin(f * Math.PI) : 0; });
      const s = P(st.bp, .74, .08); stamp.style.opacity = s > 0 ? 1 : 0; stamp.style.transform = `translate(-50%,-50%) rotate(-12deg) scale(${2.4 - 1.4 * E(s)})`; el.classList.toggle('slam', s > .9); } };
  };
  function sourcesFor(beat, c) {
    const ids = [beat.visual?.source];
    for (const ref of Array.isArray(beat.ref) ? beat.ref : []) {
      const match = /^(sources|established|suspicious|timeline|links)\[(\d+)\]/.exec(ref);
      if (!match) { ids.push(ref); continue; }
      const record = c[match[1]]?.[Number(match[2])];
      if (record) ids.push(...(match[1] === 'sources' ? [record.id] : record.sourceIds || []));
    }
    return [...new Set(ids.filter(Boolean))]
      .map(id => c.sources?.find(source => source.id === id))
      .filter(source => /^https?:\/\//i.test(source?.url || ''));
  }

  const recordIcons = {
    file: '<path d="M8 3h12l6 6v20H8z M20 3v7h6 M12 15h10 M12 20h8"/>',
    lease: '<path d="M4 28h24 M7 27V11l9-7 9 7v16 M12 15h2m4 0h2m-8 5h2m4 0h2 M15 28v-4h3v4"/>',
    vote: '<path d="m9 8 8-5 6 9-8 5z M5 18h22l2 10H3z M12 18h9"/>',
    ticket: '<path d="M3 8h26v5a3 3 0 0 0 0 6v5H3v-5a3 3 0 0 0 0-6z M20 9v2m0 3v2m0 3v2"/>',
    transfer: '<path d="M4 10h21m-5-5 5 5-5 5 M28 22H7m5-5-5 5 5 5"/>',
    audit: '<path d="M5 3h17v11 M5 3v25h9 M9 9h9 M9 14h6"/><circle cx="21" cy="21" r="5"/><path d="m25 25 5 5"/>',
    travel: '<rect x="3" y="10" width="26" height="17" rx="3"/><path d="M11 10V7c0-2 1-3 3-3h4c2 0 3 1 3 3v3 M10 10v17m12-17v17"/>',
    calendar: '<rect x="4" y="7" width="24" height="22" rx="3"/><path d="M9 4v7m14-7v7M4 15h24 M10 21h4m4 0h4"/>',
    gap: '<path d="M8 3h12l6 6v7m0 8v5H8v-7m0-7V3 M20 3v7h6 M5 22l5-4 4 4 4-4 4 4 5-4"/>',
  };
  const recordIcon = name => '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' + (recordIcons[name] || pictogramPath(name)) + '</svg>';
  const docTypeIcon = (source, kicker) => {
    const description = (String(source?.title || '') + ' ' + String(kicker || '')).toLowerCase();
    if (/audit|inspector general|financial statement/.test(description)) return 'audit';
    if (/roll.call|board vote|passage/.test(description)) return 'vote';
    if (/lease|property|recorder/.test(description)) return 'lease';
    if (/payment|remit|disburse/.test(description)) return 'transfer';
    return 'file';
  };
  K.record = (bs, c) => {
    const v = bs[0].visual, rows = v.rows || [];
    const layout = ['amounts', 'flow', 'timeline', 'relationship'].includes(v.layout) ? v.layout : 'relationship';
    const max = layout === 'amounts' ? Math.max(0, ...rows.map(row => parseMoney(row.value))) : 0;
    const events = c.timeline || [];
    const lines = rows.map(row => {
      const date = row.event ? events.find(event => event.date === row.event)?.date : '';
      const calendar = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00Z') : null;
      const stamp = calendar && Number.isFinite(calendar.getTime()) ? calendar.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : date || row.value;
      const amount = layout === 'amounts' ? parseMoney(row.value) : 0;
      const measure = max && amount ? '<i class="record-track"><i style="width:' + (100 * amount / max).toFixed(2) + '%"></i></i>' : '';
      return '<li><span class="record-symbol">' + recordIcon(row.icon) + '</span><div class="record-detail"><strong>' + esc(row.label) + '</strong>' + measure + '</div><span class="record-value">' + esc(stamp || '') + '</span></li>';
    }).join('');
    const el = node('<div class="s6 s6-record record-' + layout + '"><div class="cam"><section><header><span>' + esc(v.context) + '</span><h2>' + esc(v.heading) + '</h2></header><ol>' + lines + '</ol></section></div></div>');
    const items = [...el.querySelectorAll('li')];
    return { el, update(st) {
      items.forEach((item, i) => {
        const p = E((st.lt - i * .12) / .36);
        item.style.opacity = String(.65 + .35 * p);
        const bar = item.querySelector('.record-track i');
        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      });
    } };
  };

  K.doc = (bs, c) => {
    const v = bs[0].visual, src = sourcesFor(bs[0], c)[0], txt = String(v.text || ''), mk = String(v.mark || ''), at = mk ? txt.indexOf(mk) : -1;
    const body = at >= 0 ? `${esc(txt.slice(0, at))}<mark>${esc(mk)}</mark>${esc(txt.slice(at + mk.length))}` : esc(txt);
    const el = node(`<div class="s6 s6-doc"><div class="cam"><div class="side"><div class="f-ic">${recordIcon(docTypeIcon(src, v.kicker))}</div><h2>${words(v.kicker || '')}</h2></div>
      <div class="paper"><div class="hd"><span>${esc(src ? src.publisher : 'From the case file')}</span><b>${esc(src ? src.title : '')}</b></div><div class="rule"></div><p>${body}</p>${src && src.date ? `<div class="doc-date">${esc(src.date)}</div>` : ''}</div></div></div>`);
    const paper = el.querySelector('.paper'), mark = el.querySelector('mark'), ws = [...el.querySelectorAll('.side .w')], ic = el.querySelector('.side .f-ic');
    return { el, update: st => { const o = E(st.lt / 1.1); paper.style.opacity = o; paper.style.transform = `translateX(${(1 - o) * 260}px) rotate(${(1 - o) * 6 + 1.2}deg)`; show(ic, E(st.lt / .6)); reveal(ws, st.lt - .3, .12, .5);
      if (mark) mark.style.backgroundSize = `${E(P(st.bp, .3, .45)) * 100}% 100%`; } };
  };
  K.drop = bs => {
    const v = bs[0].visual, pts = []; for (let i = 0; i <= 60; i++) { const x = 120 + i * 17, base = i < 30 ? 250 + Math.sin(i * .7) * 14 + Math.sin(i * 1.9) * 6 : i < 33 ? 250 + (i - 30) / 3 * 270 : 520 + Math.sin(i * 1.3) * 5; pts.push([x, base]); }
    const d = 'M' + pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' L');
    const el = node(`<div class="s6 s6-drop"><div class="cam"><div class="f-kick">${esc(v.sub || '')}</div><h2>${esc(v.label || '')}</h2><svg viewBox="0 0 1280 720"><line x1="120" y1="560" x2="1150" y2="560" class="f-ax"/><path d="${d} L1140,560 L120,560 Z" class="area"/><path d="${d}" class="ln" pathLength="1"/><circle cx="${pts[31][0]}" cy="${pts[31][1]}" r="10" class="f-hit"/><circle cx="${pts[31][0]}" cy="${pts[31][1]}" r="10" class="pulse"/><text x="${pts[31][0] + 22}" y="${pts[31][1] - 30}" class="f-ov">overnight</text></svg>${ILLUS}</div></div>`);
    const ln = el.querySelector('.ln'), area = el.querySelector('.area'), hit = el.querySelector('.f-hit'), pulse = el.querySelector('.pulse'), ov = el.querySelector('.f-ov'), h2 = el.querySelector('h2'), kick = el.querySelector('.f-kick');
    return { el, update: st => { const q = EIO(P(st.bp, .05, .75)); ln.style.strokeDashoffset = 1 - q; area.style.opacity = q * .9; show(h2, E(st.lt / .7)); show(kick, E((st.lt - .3) / .7)); const h = q > .5; hit.style.opacity = h ? 1 : 0; ov.style.opacity = E(P(q, .55, .2));
      const pp = (st.lt * .8) % 1; pulse.setAttribute('r', 10 + pp * 30); pulse.style.opacity = h ? (1 - pp) * .8 : 0; } };
  };
  K.flow = (bs, c) => {
    const v = bs[0].visual, A = c.actors || [], L = c.links || [], pos = v.nodes || {}, idx = v.links || [], names = v.names || {}, roles = v.roles || {};
    const box = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.min(dx ? 140 / Math.abs(dx) : 9, dy ? 56 / Math.abs(dy) : 9); return [p[0] + dx * t, p[1] + dy * t]; };
    const geo = idx.map(j => { const l = L[j], p = pos[l.from], q = pos[l.to]; if (!p || !q) return null; const a = box(p, q), z = box(q, p), mx = (a[0] + z[0]) / 2, my = (a[1] + z[1]) / 2 - (Math.abs(a[1] - z[1]) < 4 ? 0 : 0); return { j, l, a, z, cx: mx, cy: my + (a[1] === z[1] ? -40 : 0) }; }).filter(Boolean);
    const qb = (g, f) => [(1 - f) * (1 - f) * g.a[0] + 2 * (1 - f) * f * g.cx + f * f * g.z[0], (1 - f) * (1 - f) * g.a[1] + 2 * (1 - f) * f * g.cy + f * f * g.z[1]];
    const el = node(`<div class="s6 s6-flow"><div class="cam"><svg viewBox="0 0 1280 720"><defs><marker id="f6-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#4f9df0"/></marker></defs>
      ${geo.map((g, k) => `<g class="lk${v.focus === g.j ? ' focus' : ''}" data-k="${k}"><path d="M${g.a[0].toFixed(1)},${g.a[1].toFixed(1)} Q${g.cx.toFixed(1)},${g.cy.toFixed(1)} ${g.z[0].toFixed(1)},${g.z[1].toFixed(1)}" pathLength="1" marker-end="url(#f6-arr)"/>${Array.from({ length: 7 }, () => '<circle r="5"/>').join('')}</g>`).join('')}</svg>
      ${Object.keys(pos).map(id => { const a = A.find(x => x.id === id) || { name: id }; return `<div class="nd t-${esc(a.type)}" data-id="${esc(id)}" style="left:${pos[id][0]}px;top:${pos[id][1]}px"><div class="f-ic">${ICON[a.type] || ICON.account}</div><div><b>${esc(names[id] || a.name)}</b><span>${esc(roles[id] || a.role || '')}</span></div></div>`; }).join('')}
      ${v.labels ? geo.map((g, k) => { const m = qb(g, .5), up = v.focus === g.j ? 96 : 20; return `<div class="f-lab${v.focus === g.j ? ' focus' : ''}" data-k="${k}" style="left:${m[0].toFixed(0)}px;top:${(m[1] - up).toFixed(0)}px">${esc(g.l.label || '')}</div>`; }).join('') : ''}</div></div>`);
    const nds = [...el.querySelectorAll('.nd')], lks = [...el.querySelectorAll('.lk')], labs = [...el.querySelectorAll('.f-lab')];
    return { el, update: st => {
      nds.forEach((n, i) => show(n, BACK(P(st.lt, .15 + i * .25, .5)), 24));
      const n = geo.length;
      lks.forEach((g, k) => { const s0 = .08 + k * (.7 / Math.max(1, n)), q = E(P(st.bp, s0, .16)); const path = g.querySelector('path'); path.style.strokeDashoffset = 1 - q;
        const speed = .35 + (v.labels ? 0 : st.bp * .5), cs = [...g.querySelectorAll('circle')];
        cs.forEach((cn, i) => { const f = (st.lt * speed + i / cs.length) % 1, p = qb(geo[k], f); cn.setAttribute('cx', p[0].toFixed(1)); cn.setAttribute('cy', p[1].toFixed(1)); cn.style.opacity = q >= 1 ? Math.sin(f * Math.PI) * (v.labels ? 1 : .4 + st.bp * .6) : 0; });
        if (labs[k]) labs[k].style.opacity = E(P(st.bp, s0 + .1, .12)); });
      labs.forEach(l => { const o = +l.style.opacity || 0; l.style.transform = `translate(-50%,0) translateY(${(1 - o) * 10}px)` + (l.classList.contains('focus') && o > .9 ? ` scale(${1 + Math.sin(st.lt * 4) * .05})` : ''); }); } };
  };
  K.match = (bs, c) => {
    const v = bs[0].visual, N = ((c.trajectory || {}).ngoKeys || []).slice(0, 5), r = rng(3);
    const rows = side => `${N.map((n, i) => `<div class="f-row real" data-i="${i}">${esc(n)}</div>`).join('')}${[0, 1, 2].map(() => `<div class="f-row ghost"><i style="width:${40 + r() * 45}%"></i></div>`).join('')}`;
    const el = node(`<div class="s6 s6-match"><div class="cam"><div class="file l"><div class="hd">${ICON.doc}<b>${esc(v.left)}</b></div>${rows()}</div><div class="file r"><div class="hd">${ICON.doc}<b>${esc(v.right)}</b></div>${rows()}</div>
      <svg class="conn" viewBox="0 0 1280 720">${N.map((_, i) => `<path d="M520,${215 + i * 50} C640,${215 + i * 50} 640,${215 + i * 50} 760,${215 + i * 50}" pathLength="1"/>`).join('')}</svg><div class="rule">${esc(v.rule || '')}</div></div></div>`);
    const L = el.querySelector('.file.l'), R = el.querySelector('.file.r'), rl = [...L.querySelectorAll('.f-row')], rr = [...R.querySelectorAll('.f-row')], ps = [...el.querySelectorAll('svg.conn path')], rule = el.querySelector('.rule');
    return { el, update: st => { const ol = E(st.lt / .9), or = E((st.lt - .4) / .9); L.style.opacity = ol; L.style.transform = `translateX(${(ol - 1) * 120}px)`; R.style.opacity = or; R.style.transform = `translateX(${(1 - or) * 120}px)`;
      rl.forEach((x, i) => show(x, E((st.lt - .5 - i * .12) / .4), 8)); rr.forEach((x, i) => show(x, E((st.lt - .9 - i * .12) / .4), 8));
      ps.forEach((p, i) => { const q = E(P(st.bp, .55 + i * .06, .15)); p.style.strokeDashoffset = 1 - q; rl[i] && rl[i].classList.toggle('f-hit', q > .9); rr[i] && rr[i].classList.toggle('f-hit', q > .9); }); show(rule, BACK(P(st.bp, .78, .12)), 10, .3); } };
  };
  K.dots = (bs, c) => {
    const v0 = bs[0].visual, v1 = (bs.find(b => b.visual.stage === 'hi' || b.visual.startHi) || {}).visual || {}, n = +v0.n || 0, hiN = +v0.hi || 0, cols = 20, r = rng(11);
    const order = Array.from({ length: n }, (_, i) => i).sort(() => r() - .5), hiSet = new Set(order.slice(0, hiN)), hiRank = {}; order.slice(0, hiN).forEach((d, k) => { hiRank[d] = k; });
    const el = node(`<div class="s6 s6-dots"><div class="cam"><div class="left"><div class="f-num"><span class="a">0</span><span class="b">0</span></div><div class="f-lab a">${esc(v0.label || '')}</div><div class="f-lab b">${esc(v1.label2 || '')}</div>
      <div class="stats">${(v0.stat || []).map(s => `<span>${esc(s)}</span>`).join('')}</div></div><div class="f-grid">${Array.from({ length: n }, (_, i) => `<i style="left:${(i % cols) * 30}px;top:${Math.floor(i / cols) * 30}px"></i>`).join('')}</div></div></div>`);
    const ds = [...el.querySelectorAll('.f-grid i')], na = el.querySelector('.f-num .a'), nb = el.querySelector('.f-num .b'), la = el.querySelector('.f-lab.a'), lb = el.querySelector('.f-lab.b'), stats = [...el.querySelectorAll('.stats span')];
    const sh = !!v0.startHi;
    return { el, update: st => { st = sh ? { ...st, i: 1, bt: st.lt + .2 } : st; const q = st.i === 0 ? P(st.lt, .2, 2.4) : sh ? P(st.lt, 0, .6) : 1, h = st.i >= 1 ? P(st.bt, sh ? .7 : .5, 2.2) : 0;
      ds.forEach((d, i) => { const o = E((q * n - i) / 6); d.style.opacity = h > 0 && !hiSet.has(i) ? 1 - h * .65 : o; d.style.transform = `scale(${.2 + .8 * E((q * n - i) / 4)})`; d.classList.toggle('hi', hiSet.has(i) && h * hiN > hiRank[i]); });
      na.textContent = Math.round(n * E(q)); nb.textContent = Math.round(hiN * E(h)); el.classList.toggle('stage-hi', st.i >= 1);
      show(la, st.i >= 1 ? 1 - E(h * 3) : E((st.lt - .6) / .7)); show(lb, E(h * 3)); stats.forEach((s, k) => show(s, st.i >= 1 ? 1 - E(h * 3) : E(P(st.bp, .45 + k * .18, .12)))); } };
  };
  K.versus = bs => {
    const v = bs[0].visual;
    const el = node(`<div class="s6 s6-versus"><div class="cam"><div class="half a"><small>${esc((v.a || [])[0])}</small><b>${esc((v.a || [])[1])}</b>${v.arrows === false ? '' : '<svg viewBox="0 0 120 200"><path d="M60 10 V170 M20 130 L60 175 L100 130" pathLength="1"/></svg>'}</div><div class="mid"></div>${v.mid ? `<div class="midl">${esc(v.mid)}</div>` : ''}
      <div class="half b"><small>${esc((v.b || [])[0])}</small><b>${esc((v.b || [])[1])}</b>${v.arrows === false ? '' : '<svg viewBox="0 0 120 200"><path d="M60 190 V30 M20 70 L60 25 L100 70" pathLength="1"/></svg>'}</div></div></div>`);
    const a = el.querySelector('.half.a'), b = el.querySelector('.half.b'), mid = el.querySelector('.mid'), pa = a.querySelector('path'), pb = b.querySelector('path'), ml = el.querySelector('.midl');
    return { el, update: st => { mid.style.transform = `scaleY(${E(st.lt / 1)})`; const qa = E(P(st.bp, .2, .2)), qb = E(P(st.bp, .55, .2)); show(a, qa, 30); show(b, qb, 30); if (pa) pa.style.strokeDashoffset = 1 - E(P(st.bp, .28, .25)); if (pb) pb.style.strokeDashoffset = 1 - E(P(st.bp, .62, .25)); if (ml) show(ml, BACK(P(st.bp, .7, .15)), 10, .4); } };
  };
  K.bars = bs => {
    const O = bs[0].visual.orgs || [], two = O.length > 1;
    const panel = (o, k) => { const city = (o.city || []).map(x => [x[0], parseMoney(x[1]), x[1]]), loan = parseMoney(o.loan), max = Math.max(loan, ...city.map(x => x[1])) * 1.08, H = two ? 280 : 300, bw = two ? 70 : 96, gap = two ? 26 : 40;
      const bar = (cls, val, lab, axis, i) => `<div class="b ${cls}" style="--h:${(val / max * H).toFixed(1)}px;width:${bw}px" data-i="${i}"><span class="val" data-v="${val}" data-like="${esc(lab)}">${esc(lab)}</span><i></i><em>${esc(axis)}</em></div>`;
      return `<div class="pn" data-k="${k}"><h3>${esc(o.name)}</h3><div class="chips"><span>PPP approved ${esc(o.approved || '')}</span></div><div class="plot" style="height:${H + 40}px;gap:${gap}px">${city.map((x, i) => bar('city', x[1], x[2], x[0], i)).join('')}<div class="sep"></div>${bar('loan', loan, o.loan, 'PPP loan', 3)}
        <div class="forg">Forgiven<b>${esc(o.forgiven || '')}</b></div></div><div class="axl"><span>City payments, by fiscal year</span></div></div>`; };
    const el = node(`<div class="s6 s6-bars${two ? ' two' : ''}"><div class="cam">${O.map(panel).join('')}</div></div>`);
    const pns = [...el.querySelectorAll('.pn')];
    const nb = bs.length;
    return { el, update: st => { const all = (st.i + st.bp) / nb; pns.forEach((pn, k) => { const x = two ? clamp((all - k * .48) / .52) : all, base = two ? P(st.lt, k * .3, .6) : E(st.lt / .6);
      show(pn, E(two ? P(st.bp, k * .45, .08) + (k === 0 ? 1 : 0) : base), 20);
      const order = k === 0 && !two ? (nb > 1 ? [[3, .03], [0, .55], [1, .66], [2, .77]] : [[3, .04], [0, .42], [1, .56], [2, .7]]) : [[3, .05], [0, .35], [1, .5], [2, .65]];
      order.forEach(([i, s]) => { const b = pn.querySelector(`.b[data-i="${i}"]`); if (!b) return; const q = E(P(x, s, .16)); b.style.setProperty('--q', q); const val = b.querySelector('.val'); val.textContent = q > 0 ? likeMoney(+val.dataset.v * q, val.dataset.like) : ''; val.style.opacity = q > 0 ? 1 : 0; b.querySelector('em').style.opacity = E(q * 3); });
      const f = pn.querySelector('.forg'), fq = P(x, nb > 1 ? .25 : .2, .08); f.style.opacity = fq > 0 ? 1 : 0; f.style.transform = `rotate(-8deg) scale(${1.8 - .8 * E(fq)})`;
      pn.classList.toggle('rise', x > .88); }); } };
  };
  K.timeline = (bs, c) => {
    const v = bs[0].visual, ym = s => { const m = String(s).match(/(\d{4})-(\d{2})/); return m ? +m[1] * 12 + (+m[2] - 1) : null; }, dmy = s => { const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? +m[3] * 12 + (+m[1] - 1) + (+m[2] - 1) / 31 : null; };
    const a = ym(v.from), z = ym(v.to) + 1, X = m => 110 + (m - a) / (z - a) * 1060, Y0 = 430;
    const pins = (v.pins || []).map(p => ({ ...p, m: dmy(p.date) })).sort((p, q) => p.m - q.m), lv = [210, 255, 300, 345, 165, 120];
    const evs = (c.timeline || []).map(e => ({ e, m: /^\d{4}$/.test(e.date) ? +e.date * 12 : ym(e.date), whole: /^\d{4}$/.test(e.date) }));
    const el = node(`<div class="s6 s6-time"><div class="cam"><svg viewBox="0 0 1280 720"><line class="ax0" x1="110" x2="1170" y1="${Y0}" y2="${Y0}"/><line class="f-ax" x1="110" x2="1170" y1="${Y0}" y2="${Y0}"/>
      ${evs.filter(x => x.whole).map(x => `<rect class="band" x="${X(x.m)}" y="${Y0 - 6}" width="${X(x.m + 12) - X(x.m)}" height="12" rx="6"/>`).join('')}
      ${Array.from({ length: z - a }, (_, i) => `<line class="tk" x1="${X(a + i)}" x2="${X(a + i)}" y1="${Y0 - ((a + i) % 12 ? 5 : 12)}" y2="${Y0 + ((a + i) % 12 ? 5 : 12)}"/>${(a + i) % 12 === 0 ? `<text class="f-yr" x="${X(a + i) + 6}" y="${Y0 + 34}">${Math.floor((a + i) / 12)}</text>` : ''}`).join('')}
      ${pins.map((p, i) => `<g class="f-pin" data-i="${i}"><line x1="${X(p.m)}" x2="${X(p.m)}" y1="${Y0}" y2="${lv[i % lv.length] + 8}"/><circle cx="${X(p.m)}" cy="${Y0}" r="7"/></g>`).join('')}<circle class="cur" r="9" cy="${Y0}"/></svg>
      ${pins.map((p, i) => `<div class="pl" data-i="${i}" style="left:${X(p.m) + (X(p.m) > 900 ? -10 : 10)}px;top:${lv[i % lv.length] - 14}px;${X(p.m) > 900 ? 'transform:translateX(-100%)' : ''}"><b>${esc(p.name)}</b><span>${esc(p.date)}</span></div>`).join('')}
      ${evs.map((x, i) => `<div class="ev" data-i="${i}" style="left:${Math.min(X(x.m), 860)}px"><em>${esc(x.e.date)}</em>${esc(x.e.text)}</div>`).join('')}<div class="f-kick">The timing</div></div></div>`);
    const ax = el.querySelector('.f-ax'), cur = el.querySelector('.cur'), gp = [...el.querySelectorAll('.f-pin')], pl = [...el.querySelectorAll('.pl')], ev = [...el.querySelectorAll('.ev')], bands = [...el.querySelectorAll('.band')], kick = el.querySelector('.f-kick');
    return { el, update: st => { const q = EIO(P(st.bp, .03, .85)), mx = a + q * (z - a), cx = X(mx); ax.setAttribute('x2', cx.toFixed(1)); cur.setAttribute('cx', cx.toFixed(1)); cur.style.opacity = q < 1 ? 1 : 0; show(kick, E(st.lt / .6));
      pins.forEach((p, i) => { const o = E((mx - p.m) / .8); gp[i].style.opacity = o; gp[i].style.transform = `translateY(${(1 - o) * -20}px)`; show(pl[i], o, 10); });
      evs.forEach((x, i) => show(ev[i], E((mx - x.m) / 1.2), 14)); bands.forEach(b => { b.style.opacity = E((mx - evs.find(x => x.whole).m) / 3) * .8; }); } };
  };
  K.redact = bs => {
    const v = bs[0].visual, rows = v.rows || ['Salaries', 'Payroll period', 'Staff charged', 'Total'];
    const el = node(`<div class="s6 s6-redact"><div class="cam"><div class="f-q">?</div><div class="paper"><div class="hd"><b>${esc(v.title || '')}</b><span>${esc(v.sub ?? 'Fiscal 2021')}</span></div>${rows.map(r => `<div class="f-row"><span>${esc(r)}</span><i></i></div>`).join('')}<div class="stamp">${esc(v.stamp || '')}</div></div></div></div>`);
    const paper = el.querySelector('.paper'), bars = [...el.querySelectorAll('.f-row i')], stamp = el.querySelector('.stamp'), q = el.querySelector('.f-q');
    return { el, update: st => { const o = E(st.lt / 1); paper.style.opacity = o; paper.style.transform = `translateY(${(1 - o) * 60}px) rotate(${-2 + (1 - o) * -4}deg)`; show(q, E((st.lt - .2) / .7), 20, .4);
      bars.forEach((b, i) => { b.style.transform = `scaleX(${E(P(st.bp, .35 + i * .07, .1))})`; }); const s = P(st.bp, .78, .07); stamp.style.opacity = s > 0 ? 1 : 0; stamp.style.transform = `translate(-50%,-50%) rotate(-14deg) scale(${2.6 - 1.6 * E(s)})`; } };
  };
  K.quote = bs => {
    const v = bs[0].visual;
    const el = node(`<div class="s6 s6-quote"><div class="cam"><div class="f-mark">“</div><div class="f-lines"><i></i><i></i><i></i></div><p>${esc(v.line || '')}</p></div></div>`);
    const mark = el.querySelector('.f-mark'), ls = [...el.querySelectorAll('.f-lines i')], p = el.querySelector('p');
    return { el, update: st => { show(mark, E(st.lt / .9), 30, .2); ls.forEach((l, i) => { l.style.transform = `scaleX(${E(P(st.lt, .4 + i * .2, .6))})`; l.style.opacity = .5 + .3 * Math.sin(st.lt * 2 + i); }); show(p, E(P(st.bp, .3, .2))); } };
  };
  K.explain = bs => {
    const v = bs[0].visual, D = v.down || [];
    const el = node(`<div class="s6 s6-explain"><div class="cam"><div class="f-col up"><div class="f-bar"><i></i></div><svg viewBox="0 0 60 60"><path d="M30 52V10M12 26 30 8l18 18"/></svg><b>${esc(v.up || '')}</b></div>
      ${D.map((d, i) => `<div class="f-col dn" data-i="${i}"><div class="f-bar"><i></i></div><svg viewBox="0 0 60 60"><path d="M30 8v42M12 34l18 18 18-18"/></svg><b>${esc(d)}</b></div>`).join('')}${ILLUS}</div></div>`);
    const up = el.querySelector('.f-col.up'), dn = [...el.querySelectorAll('.f-col.dn')];
    return { el, update: st => { show(up, E(P(st.bp, .32, .1)), 20); up.style.setProperty('--h', 140 + 120 * E(P(st.bp, .36, .2))); dn.forEach((d, i) => { show(d, E(P(st.bp, .06 + i * .07, .1)), 20); d.style.setProperty('--h', 260 - 170 * E(P(st.bp, .1 + i * .07, .25))); }); } };
  };
  K.unknowns = bs => {
    const C = bs[0].visual.cards || [];
    const el = node(`<div class="s6 s6-unk"><div class="cam"><div class="f-kick">Not established</div><div class="f-cards">${C.map((t, i) => `<div class="f-card" data-i="${i}"><div class="in"><div class="back">${recordIcon('gap')}</div><div class="front"><span class="f-q">${recordIcon('gap')}</span><b>${esc(t)}</b><em>Not shown</em></div></div></div>`).join('')}</div></div></div>`);
    const cs = [...el.querySelectorAll('.f-card')], kick = el.querySelector('.f-kick');
    return { el, update: st => { show(kick, E(st.lt / .6)); cs.forEach((cd, i) => { show(cd, E((st.lt - .2 - i * .15) / .6), 30); const f = bs.length === 1 ? E(P(st.lt, .5 + i * .7, .8)) : i < st.i ? 1 : i === st.i ? E(P(st.bt, .3, .9)) : 0; const nowI = bs.length === 1 ? Math.min(C.length - 1, Math.floor(Math.max(0, st.lt - .5) / .7)) : st.i;
      cd.querySelector('.in').style.transform = `rotateY(${180 - 180 * f}deg)`; cd.classList.toggle('now', i === nowI); cd.classList.toggle('done', i < nowI); }); } };
  };
  K.settle = bs => {
    const C = bs[0].visual.cards || [];
    const el = node(`<div class="s6 s6-settle"><div class="cam"><div class="f-kick">What would settle it</div><div class="f-cards">${C.map((x, i) => `<div class="f-card" data-i="${i}"><span class="f-n">${i + 1}</span><b>${esc(x.who)}</b><p>${esc(x.what)}</p></div>`).join('')}</div><div class="lens">${ICON.lens}</div></div></div>`);
    const cs = [...el.querySelectorAll('.f-card')], lens = el.querySelector('.lens'), kick = el.querySelector('.f-kick');
    return { el, update: st => { show(kick, E(st.lt / .6)); cs.forEach((cd, i) => { show(cd, E((st.lt - .3 - i * .25) / .6), 26); cd.classList.toggle('now', i === (bs[0].visual.focus ?? st.i)); });
      const x = 330 + (bs[0].visual.focus ?? st.i) * 620 + Math.sin(st.lt * 1.3) * 110, y = 400 + Math.cos(st.lt * 1.7) * 50; lens.style.transform = `translate(${x}px, ${y}px)`; lens.style.opacity = E((st.lt - 1) / .6); } };
  };
  K.status = (bs, c) => {
    const S = c.sources || [];
    const el = node(`<div class="s6 s6-status"><div class="cam"><div class="f-kick">Where it stands</div><p class="f-st${(c.status || '').length > 190 ? ' xl' : (c.status || '').length > 130 ? ' l' : ''}">${words(c.status || '')}</p><div class="f-src"><h4>${S.length} sources, each linked in the case file</h4><ol>${S.slice(0, S.length > 4 ? 3 : 4).map(s => `<li><b>${esc(s.title || '')}</b><span>${esc([s.publisher, s.date].filter(Boolean).join(' · '))}</span></li>`).join('')}${S.length > 4 ? `<li class="more"><b>and ${S.length - 3} more</b></li>` : ''}</ol>${c.asOf ? `<div class="asof">Facts as of ${esc(c.asOf)}</div>` : ''}</div></div></div>`);
    const ws = [...el.querySelectorAll('.f-st .w')], src = el.querySelector('.f-src'), li = [...el.querySelectorAll('.f-src li')], kick = el.querySelector('.f-kick'), stp = el.querySelector('.f-st');
    const one = bs.length === 1;
    return { el, update: st => { if (one) st = { ...st, i: st.lt > .9 ? 1 : 0, bt: st.lt - .9 }; show(kick, E(st.lt / .6)); reveal(ws, one ? st.lt * 30 : st.i === 0 ? st.bp * ws.length * 1.25 * .09 : 99, .09, .4); stp.classList.toggle('shift', st.i >= 1);
      const o = st.i >= 1 ? E(st.bt / .9) : 0; src.style.opacity = o; src.style.transform = `translateX(${(1 - o) * 80}px)`; li.forEach((l, k) => show(l, st.i >= 1 ? E((st.bt - .4 - k * .3) / .5) : 0, 10)); } };
  };
  K.end = (bs, c) => {
    const el = node(`<div class="s6 s6-end"><div class="cam"><h1>${words(bs[0].text)}</h1><div class="f-brand">SF Money Trail</div><div class="c-btns"><button type="button" data-act="replay">Play again</button><button type="button" data-act="close">Read the case file</button></div></div></div>`);
    const ws = [...el.querySelectorAll('h1 .w')], brand = el.querySelector('.f-brand'), btn = el.querySelector('.c-btns');
    return { el, update: st => { reveal(ws, st.lt - .2, .16, .6, 30); show(brand, E((st.lt - 1.6) / .8)); show(btn, E((st.lt - 2.4) / .6)); } };
  };

  // ---- shots added for variety (batch 1): each takes its data from the cue and the case file, every movement from the clock
  const ser = (c, i) => (((c.trajectory || {}).series || [])[i]) || { points: [] };
  const isUsd = u => /^(usd|\$)$/i.test(u || '');
  const fmtV = (v, u) => (isUsd(u) ? (v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(v < 1e7 ? 1 : 0) + 'M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K' : '$' + Math.round(v)) : Math.round(v).toLocaleString('en-US'));
  const per = p => String(p).replace(/^FY/, '').replace(/^(\d{4})-(\d{2})$/, (m, y, mo) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1]);
  const parseNum = s => { const m = String(s).match(/-?[\d,]+(?:\.\d+)?/); return m ? +m[0].replace(/,/g, '') : 0; };
  const valOf = s => (/\$/.test(s) ? parseMoney(s) : parseNum(s));
  // format x like a sample string: money via likeMoney, otherwise keep the sample's words, sign and decimals (35.8%, 4,837 beds)
  const likeAny = (x, like) => (/\$/.test(like) ? likeMoney(x, like) : String(like).replace(/-?[\d,]+(?:\.\d+)?/, mm => { const d = (mm.split('.')[1] || '').length; return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }));
  const curV = (bs, st, key, dflt) => { for (let k = Math.min(st.i, bs.length - 1); k >= 0; k--) if (bs[k].visual[key] !== undefined) return bs[k].visual[key]; return dflt; };
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const longDate = d => { const m = String(d).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); return m ? (m[3] ? `${MON[+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${MON[+m[2] - 1]} ${m[1]}`) : String(d); };
  const dayN = d => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : 0; };

  // swarm: n tiles fly in on curved paths and settle into one address; with split, they sort into two groups
  K.swarm = bs => {
    const v = bs[0].visual, n = +v.n || 0, G = v.groups || [], g0 = G.length ? parseNum(G[0][0]) : n, r = rng(5), cols = 8, cell = 34;
    const tiles = Array.from({ length: n }, (_, i) => { const a = r() * Math.PI * 2, d = 900 + r() * 300; return { i, sx: 880 + Math.cos(a) * d, sy: 380 + Math.sin(a) * d, bend: (r() - .5) * 500, at: Math.pow(i / n, .8) * 2.3 + r() * .25, grp: i < g0 ? 0 : 1 }; });
    const home = i => [760 + (i % cols) * cell, 190 + Math.floor(i / cols) * cell];
    const homeSplit = t => { const k = t.grp ? t.i - g0 : t.i, c2 = t.grp ? 4 : 6; return [t.grp ? 1040 + (k % c2) * cell : 640 + (k % c2) * cell, 200 + Math.floor(k / c2) * cell]; };
    const el = node(`<div class="s6 s6-swarm${v.split ? ' split' : ''}"><div class="cam"><div class="lft"><div class="f-num"><span class="v">0</span></div><div class="f-lab">${esc(v.label || '')}</div></div>
      <div class="door"><div class="f-ic">${ICON.agency}</div><b>${esc(v.place || '')}</b><span>${esc(v.sub || '')}</span></div>
      <div class="tiles">${tiles.map(t => `<i class="g${t.grp}"></i>`).join('')}</div>${G.map((g, k) => `<div class="grp g${k}"><b>${esc(g[0])}</b><span>${esc(g[1])}</span></div>`).join('')}</div></div>`);
    const ts = [...el.querySelectorAll('.tiles i')], num = el.querySelector('.f-num .v'), lab = el.querySelector('.f-lab'), door = el.querySelector('.door'), grps = [...el.querySelectorAll('.grp')];
    return { el, update: st => {
      let arrived = 0;
      if (!v.split) ts.forEach((e, k) => { const t = tiles[k], f = E(clamp((st.lt - .1 - t.at) / .7)), h = home(k); if (f >= 1) arrived++;
        const x = (1 - f) * (1 - f) * t.sx + 2 * (1 - f) * f * ((t.sx + h[0]) / 2 + t.bend) + f * f * h[0], y = (1 - f) * (1 - f) * t.sy + 2 * (1 - f) * f * ((t.sy + h[1]) / 2 - Math.abs(t.bend) * .4) + f * f * h[1];
        e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${((1 - f) * 220).toFixed(0)}deg) scale(${.6 + .4 * f})`; e.style.opacity = f > 0 ? 1 : 0; });
      else ts.forEach((e, k) => { const t = tiles[k], f = EIO(clamp((st.lt - .2 - (t.grp ? .25 : 0) - (k % 8) * .03) / .9)), a = home(k), b = homeSplit(t); arrived = n;
        e.style.transform = `translate(${(a[0] + (b[0] - a[0]) * f).toFixed(1)}px, ${(a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * 60).toFixed(1)}px)`; e.style.opacity = 1; });
      num.textContent = v.split ? n : arrived; show(lab, E((st.lt - .4) / .6)); show(door, BACK(clamp((st.lt - .05) / .5)), 30);
      door.classList.toggle('full', arrived >= n); grps.forEach((g, k) => show(g, E((st.lt - 1 - k * .4) / .5), 16)); } };
  };

  // map: an illustrative street grid (not to scale) with pins, count badges and flight paths; the camera follows the beats
  K.map = bs => {
    const v = bs[0].visual, pins = v.pins || [], r = rng(21);
    const streets = []; for (let i = 0; i < 26; i++) streets.push(`<line x1="${-300 + i * 80}" y1="-300" x2="${-300 + i * 80 + 260}" y2="1100" class="${i % 6 === 2 ? 'maj' : ''}"/>`); for (let i = 0; i < 18; i++) streets.push(`<line x1="-300" y1="${-200 + i * 70}" x2="1600" y2="${-200 + i * 70 - 300}" class="${i % 5 === 3 ? 'maj' : ''}"/>`);
    const blocks = Array.from({ length: 40 }, () => `<rect x="${(r() * 1500 - 100).toFixed(0)}" y="${(r() * 900 - 100).toFixed(0)}" width="${(30 + r() * 60).toFixed(0)}" height="${(20 + r() * 50).toFixed(0)}" rx="4"/>`).join('');
    const arcs = (v.arcs || []).map(([a, b]) => { const p = pins[a], q = pins[b], mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - 120 - Math.abs(p.x - q.x) * .15; return { a, b, d: `M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`, p, q, mx, my }; });
    const el = node(`<div class="s6 s6-map"><div class="cam"><div class="world"><svg viewBox="0 0 1280 720"><path class="water" d="M-200,-200 L560,-200 C520,40 380,120 300,220 C220,330 120,360 -200,380 Z"/><g class="blk">${blocks}</g><g class="st">${streets.join('')}</g>
      ${arcs.map(a => `<path class="arc" d="${a.d}" pathLength="1"/><circle class="arcdot" r="6"/>`).join('')}${pins.map((p, i) => `<g class="pinr" data-i="${i}"><circle class="halo" cx="${p.x}" cy="${p.y}" r="16"/><circle class="dot" cx="${p.x}" cy="${p.y}" r="9"/></g>`).join('')}</svg>
      ${pins.map((p, i) => `<div class="pl" data-i="${i}" style="left:${p.x}px;top:${p.y}px"><span class="n">0</span><div><b>${esc(p.name)}</b><em>${esc(p.sub || '')}</em></div></div>`).join('')}</div>
      <div class="f-kick">${esc(v.kicker || '')}</div><div class="s6-illus">Illustrative map, not to scale</div></div></div>`);
    const world = el.querySelector('.world'), pr = [...el.querySelectorAll('.pinr')], pl = [...el.querySelectorAll('.pl')], ap = [...el.querySelectorAll('.arc')], ad = [...el.querySelectorAll('.arcdot')], kick = el.querySelector('.f-kick');
    const camAt = k => { const vv = bs[Math.min(k, bs.length - 1)].visual; return { z: vv.zoom ?? v.zoom ?? 1, f: vv.focus ?? v.focus ?? 0 }; };
    const pinBeat = p => p.beat || 0;
    return { el, update: st => {
      const A = camAt(Math.max(0, st.i - 1)), Bc = camAt(st.i), m = st.i === 0 ? 1 : EIO(st.bt / 1.1), z = A.z + (Bc.z - A.z) * m, fA = pins[A.f] || { x: 640, y: 360 }, fB = pins[Bc.f] || fA;
      const fx = fA.x + (fB.x - fA.x) * m, fy = fA.y + (fB.y - fA.y) * m, z0 = st.i === 0 ? z * (1.25 - .25 * E(st.lt / 1.6)) : z;
      world.style.transform = `translate(640px, 380px) scale(${z0.toFixed(3)}) translate(${-fx}px, ${-fy}px) rotate(${(-st.lt * .25).toFixed(2)}deg)`;
      pins.forEach((p, i) => { const on = st.i >= pinBeat(p), f = on ? BACK(clamp(((st.i > pinBeat(p) ? 9 : st.bt) - (p.delay || 0)) / .6)) : 0; pr[i].style.opacity = on ? 1 : 0; pr[i].style.transform = `translate(${p.x}px,${p.y}px) scale(${f}) translate(${-p.x}px,${-p.y}px)`;
        pl[i].style.opacity = on ? E(f) : 0; pl[i].style.transform = `translate(-50%, -100%) translateY(${-22 - (1 - E(f)) * 20}px) scale(${1 / Math.max(.6, z0)})`;
        pl[i].querySelector('.n').textContent = Math.round((+p.n || 0) * (on ? E(clamp(((st.i > pinBeat(p) ? 9 : st.bt) - .2) / 1.2)) : 0)); pr[i].querySelector('.halo').setAttribute('r', 16 + ((st.lt * .9 + i * .3) % 1) * 26); pr[i].querySelector('.halo').style.opacity = 1 - ((st.lt * .9 + i * .3) % 1); });
      arcs.forEach((a, k) => { const bq = pins[a.b], on = st.i >= pinBeat(bq), q = on ? E(clamp(((st.i > pinBeat(bq) ? 9 : st.bt) - .1) / .9)) : 0; ap[k].style.strokeDashoffset = 1 - q; const f = (st.lt * .6 + k * .37) % 1, x = (1 - f) * (1 - f) * a.p.x + 2 * (1 - f) * f * a.mx + f * f * a.q.x, y = (1 - f) * (1 - f) * a.p.y + 2 * (1 - f) * f * a.my + f * f * a.q.y; ad[k].setAttribute('cx', x.toFixed(1)); ad[k].setAttribute('cy', y.toFixed(1)); ad[k].style.opacity = q >= 1 ? Math.sin(f * Math.PI) : 0; });
      show(kick, E(st.lt / .6)); } };
  };

  // columns: a series from the case file, the columns rising in turn; the beat's highlighted periods glow and read out big
  K.columns = (bs, c) => {
    const v = bs[0].visual, S = ser(c, v.series || 0), P = S.points || [], u = S.unit, vals = P.map(p => +p.value), max = Math.max(...vals, 1), n = P.length, x0 = 130, x1 = 1150, step = (x1 - x0) / Math.max(1, n), bw = Math.min(96, step * .64), H = 250, base = 520;
    const el = node(`<div class="s6 s6-cols"><div class="cam"><div class="hd"><div class="f-num"><span class="v">0</span></div><div class="f-lab">${esc(v.label || S.label || '')}</div><div class="per"></div></div>
      <div class="plot">${P.map((p, i) => `<div class="cl" data-i="${i}" style="left:${(x0 + step * i + (step - bw) / 2).toFixed(1)}px;width:${bw.toFixed(1)}px;--h:${(vals[i] / max * H).toFixed(1)}px"><span class="val">${esc(fmtV(vals[i], u))}</span><i></i><em>${esc(per(p.period))}</em></div>`).join('')}</div><div class="base" style="top:${base}px"></div></div></div>`);
    const cls = [...el.querySelectorAll('.cl')], num = el.querySelector('.f-num .v'), lab = el.querySelector('.f-lab'), perEl = el.querySelector('.per'), grow = Math.min(2.4, Math.max(1.2, (bs[0].t1 - bs[0].t0) * .6));
    return { el, update: st => {
      const hi = curV(bs, st, 'hi', []), hiI = P.map((p, i) => (hi.includes(p.period) ? i : -1)).filter(i => i >= 0); let tot = 0, last = -1;
      cls.forEach((e, i) => { const q = BACK(clamp((st.lt - .15 - i * grow / n) / .55)); e.style.setProperty('--q', Math.max(0, q)); if (q > .02) { tot += vals[i] * clamp(q); last = i; }
        const h = hiI.includes(i); e.classList.toggle('hi', h); e.classList.toggle('dim', hiI.length > 0 && !h && st.bp > .15); e.querySelector('.val').style.opacity = h || (!hiI.length && i === last) ? 1 : clamp(q) * .55; });
      if (hiI.length) { const k = hiI[hiI.length - 1], f = E(clamp(st.bt / .7)); num.textContent = fmtV(vals[k] * f, u); perEl.textContent = longDate(P[k].period).replace(/^FY/, 'Fiscal '); }
      else { num.textContent = fmtV(v.total ? tot : last >= 0 ? vals[last] : 0, u); perEl.textContent = last >= 0 ? (v.total ? 'in all' : per(P[last].period)) : ''; }
      show(lab, E((st.lt - .3) / .6)); } };
  };

  // line: one or more series from the case file drawing themselves, a glowing head on each; a peak or a crossing marked
  K.line = (bs, c) => {
    const v = bs[0].visual, S = (v.series || [0]).map(i => ser(c, i)), P = (S[0].points || []), n = P.length, u = S[0].unit, max = Math.max(1, ...S.flatMap(s => s.points.map(p => +p.value)));
    const X = i => 150 + i * (1000 / Math.max(1, n - 1)), Y = val => 515 - val / max * 300, pts = S.map(s => s.points.map((p, i) => [X(i), Y(+p.value)]));
    const peakI = v.peak ? P.findIndex(p => p.period === v.peak) : -1;
    let cross = -1; if (v.cross && S.length > 1) for (let i = 1; i < n; i++) if (+S[1].points[i].value > +S[0].points[i].value && +S[1].points[i - 1].value <= +S[0].points[i - 1].value) { cross = i; break; }
    const el = node(`<div class="s6 s6-line"><div class="cam"><div class="f-kick">${esc(v.kicker || '')}</div><svg viewBox="0 0 1280 720"><defs><clipPath id="lc-${v.series}"><rect class="clip" x="0" y="0" width="0" height="720"/></clipPath></defs>
      ${[0, .25, .5, .75, 1].map(f => `<line class="gl" x1="150" x2="1150" y1="${515 - f * 300}" y2="${515 - f * 300}"/>`).join('')}<line class="f-ax" x1="150" x2="1150" y1="515" y2="515"/>
      <g clip-path="url(#lc-${v.series})">${pts.map((p, k) => `<path class="area a${k}" d="M${p[0][0]},515 L${p.map(q => q.join(',')).join(' L')} L${p[n - 1][0]},515 Z"/><path class="ln l${k}" d="M${p.map(q => q.join(',')).join(' L')}"/>`).join('')}</g>
      ${pts.map((p, k) => `<circle class="hd h${k}" r="9"/>`).join('')}${P.map((p, i) => (n <= 9 || i % 2 === 0 || i === n - 1 ? `<text class="f-yr" x="${X(i)}" y="548" text-anchor="middle">${esc(per(p.period))}</text>` : '')).join('')}
      ${peakI >= 0 ? `<circle class="pk" cx="${pts[0][peakI][0]}" cy="${pts[0][peakI][1]}" r="12"/>` : ''}${cross >= 0 ? `<circle class="pk x" cx="${pts[1][cross][0]}" cy="${pts[1][cross][1]}" r="12"/>` : ''}</svg>
      ${S.map((s, k) => `<div class="tag t${k}">${esc((v.labels || [])[k] || s.label)}<b></b></div>`).join('')}${v.from ? `<div class="end0">${esc(v.from)}</div>` : ''}${v.to ? `<div class="end1">${esc(v.to)}</div>` : ''}
      ${peakI >= 0 && v.peakLabel ? `<div class="pkl${pts[0][peakI][0] > 900 ? ' r' : ''}" style="left:${pts[0][peakI][0]}px;top:${pts[0][peakI][1] - 70}px">${esc(v.peakLabel)}</div>` : ''}${cross >= 0 && v.crossLabel ? `<div class="pkl x${pts[1][cross][0] > 900 ? ' r' : ''}" style="left:${pts[1][cross][0]}px;top:${pts[1][cross][1] - 74}px">${esc(v.crossLabel)}</div>` : ''}</div></div>`);
    const clip = el.querySelector('.clip'), hds = [...el.querySelectorAll('circle.hd')], tags = [...el.querySelectorAll('.tag')], pk = [...el.querySelectorAll('.pk')], pkl = [...el.querySelectorAll('.pkl')], e0 = el.querySelector('.end0'), e1 = el.querySelector('.end1'), kick = el.querySelector('.f-kick');
    const T = Math.min(3.2, Math.max(1.6, (bs[bs.length - 1].t1 - bs[0].t0) * .55));
    return { el, update: st => {
      const q = EIO(clamp((st.lt - .2) / T)), f = q * (n - 1), i0 = Math.floor(f), fr = f - i0, cx = X(f); clip.setAttribute('width', (cx + 4).toFixed(1));
      pts.forEach((p, k) => { const a = p[Math.min(i0, n - 1)], b = p[Math.min(i0 + 1, n - 1)], x = a[0] + (b[0] - a[0]) * fr, y = a[1] + (b[1] - a[1]) * fr; hds[k].setAttribute('cx', x.toFixed(1)); hds[k].setAttribute('cy', y.toFixed(1));
        tags[k].style.transform = x > 860 ? `translate(${(x - 18).toFixed(1)}px, ${(y - 18 - (k ? 0 : 30)).toFixed(1)}px) translateX(-100%)` : `translate(${(x + 18).toFixed(1)}px, ${(y - 18).toFixed(1)}px)`; tags[k].style.opacity = E(clamp((st.lt - .3) / .5)); tags[k].querySelector('b').textContent = fmtV(+S[k].points[Math.round(f)].value, u); });
      const hit = i => E(clamp((f - i + .2) / .6)); pk.forEach((e, k) => { const i = k === 0 && peakI >= 0 ? peakI : cross, o = hit(i); e.style.opacity = o; e.setAttribute('r', 12 + ((st.lt * 1.2) % 1) * 22 * (o >= 1 ? 1 : 0)); });
      pkl.forEach((e, k) => { const i = k === 0 && peakI >= 0 ? peakI : cross; show(e, BACK(clamp((f - i - .1) / .5)), 14); });
      if (e0) show(e0, E(st.lt / .6)); if (e1) show(e1, BACK(clamp((q - .92) / .08)), 14, .3); show(kick, E(st.lt / .6)); } };
  };

  // clock: a 24-hour dial filling to the hours paid each day
  K.clock = bs => {
    const v = bs[0].visual, h = +v.hours || 0;
    const el = node(`<div class="s6 s6-clock"><div class="cam"><svg class="dial" viewBox="0 0 600 600"><circle cx="300" cy="300" r="250" class="r0"/><circle cx="300" cy="300" r="250" class="r1" pathLength="1" transform="rotate(-90 300 300)"/>
      ${Array.from({ length: 24 }, (_, i) => `<line x1="300" y1="30" x2="300" y2="${i % 6 ? 46 : 62}" transform="rotate(${i * 15} 300 300)" class="tk" data-i="${i}"/>`).join('')}${[0, 6, 12, 18].map(k => `<text x="${300 + Math.sin(k / 24 * Math.PI * 2) * 196}" y="${308 - Math.cos(k / 24 * Math.PI * 2) * 196}" text-anchor="middle" class="hr">${k}</text>`).join('')}
      <line class="hand" x1="300" y1="300" x2="300" y2="80"/><circle cx="300" cy="300" r="10" class="hub"/></svg><div class="mid"><div class="f-num"><span class="v">0</span><small>h</small></div><div class="of">of 24</div></div>
      <div class="side"><h2>${words(v.label || '')}</h2><p>${esc(v.sub || '')}</p></div></div></div>`);
    const r1 = el.querySelector('.r1'), hand = el.querySelector('.hand'), num = el.querySelector('.f-num .v'), tks = [...el.querySelectorAll('.tk')], ws = [...el.querySelectorAll('.side .w')], p = el.querySelector('.side p'), dial = el.querySelector('.dial');
    return { el, update: st => { const q = EIO(clamp((st.lt - .1) / 2)), cur = h * q; r1.style.strokeDashoffset = 1 - cur / 24; hand.style.transform = `rotate(${cur / 24 * 360}deg)`; num.textContent = cur.toFixed(1);
      tks.forEach((t, i) => t.classList.toggle('on', i < cur)); reveal(ws, st.lt - .5, .12, .5); show(p, E((st.lt - 1.2) / .6)); dial.style.transform = `rotate(${Math.sin(st.lt * .8) * 2}deg) scale(${1 + (q >= 1 ? Math.sin(st.lt * 6) * .006 : 0)})`; } };
  };

  // slam: kinetic type, word groups slamming in
  K.slam = bs => {
    const v = bs[0].visual, W = v.words || [];
    const el = node(`<div class="s6 s6-slam"><div class="cam"><div class="echo">${esc(W.join(' '))}</div><div class="ln">${W.map((w, i) => `<span class="sw${i === W.length - 1 ? ' last' : ''}">${esc(w)}</span>`).join('')}</div><div class="f-sub">${esc(v.sub || '')}</div></div></div>`);
    const ws = [...el.querySelectorAll('.sw')], sub = el.querySelector('.f-sub'), echo = el.querySelector('.echo'), span = Math.max(.35, ((bs[0].t1 - bs[0].t0) * .6) / Math.max(1, W.length));
    return { el, update: st => { ws.forEach((w, i) => { const t = st.lt - .05 - i * span, o = clamp(t / .12), s = t < 0 ? 0 : 1 + 1.6 * Math.pow(1 - clamp(t / .28), 3), sh = t > 0 && t < .35 ? Math.sin(t * 90) * (1 - t / .35) * 8 : 0;
        w.style.opacity = o; w.style.transform = `translate(${sh.toFixed(1)}px, ${(sh * .5).toFixed(1)}px) scale(${s.toFixed(3)}) rotate(${i % 2 ? 2 : -2}deg)`; });
      show(sub, E((st.lt - span * W.length) / .5)); echo.style.transform = `translateX(${(-st.lt * 60).toFixed(0)}px)`; } };
  };

  // rank: horizontal bars racing to their values
  K.rank = bs => {
    const v = bs[0].visual, R = v.rows || [], vals = R.map(r => valOf(r[1])), max = Math.max(...vals, 1);
    const el = node(`<div class="s6 s6-rank"><div class="cam"><div class="f-kick">${esc(v.label || '')}</div><div class="rows">${R.map((r, i) => `<div class="rw" data-i="${i}"><b>${esc(r[0])}</b><div class="tr"><i style="--w:${(vals[i] / max * 100).toFixed(1)}%"></i></div><span class="val" data-like="${esc(r[1])}">${esc(r[1])}</span></div>`).join('')}</div></div></div>`);
    const rw = [...el.querySelectorAll('.rw')], kick = el.querySelector('.f-kick');
    return { el, update: st => { show(kick, E(st.lt / .5)); rw.forEach((e, i) => { const q = E(clamp((st.lt - .2 - i * .28) / .9)); show(e, E(clamp((st.lt - .1 - i * .28) / .3)), 0); e.style.transform = `translateX(${(1 - E(clamp((st.lt - .1 - i * .28) / .4))) * -60}px)`;
      e.querySelector('i').style.transform = `scaleX(${q})`; const val = e.querySelector('.val'), like = val.dataset.like; val.textContent = likeAny(vals[i] * q, like); e.classList.toggle('top', i === (v.focus ?? 0) && q > .9); }); } };
  };

  // headline: a dated item from the case file, set like a front page; the record's other dates run past on a ticker
  K.headline = (bs, c) => {
    const v = bs[0].visual, T = (c.timeline || []).map(e => `${e.date} · ${e.text}`);
    const el = node(`<div class="s6 s6-head"><div class="cam"><div class="tick"><b>On the record</b><div class="run"><span>${esc(T.join('   ◆   '))}</span><span>${esc(T.join('   ◆   '))}</span></div></div>
      <div class="date"><span class="d">${esc(longDate(v.date))}</span><i></i></div><div class="kick">${esc(v.kicker || '')}</div><h1 class="${(v.text || '').length > 70 ? 'xl' : (v.text || '').length > 48 ? 'l' : ''}">${words(v.text || '')}</h1><div class="rule"></div></div></div>`);
    const d = el.querySelector('.date'), ws = [...el.querySelectorAll('h1 .w')], kick = el.querySelector('.kick'), run = el.querySelector('.run'), rule = el.querySelector('.rule'), tick = el.querySelector('.tick');
    return { el, update: st => { const o = E(clamp(st.lt / .35)); d.style.opacity = o; d.style.transform = `translateX(${(1 - o) * -200}px) skewX(${(1 - o) * -20}deg)`; d.querySelector('i').style.transform = `scaleX(${E(clamp((st.lt - .2) / .5))})`;
      show(kick, E((st.lt - .25) / .4), 10); reveal(ws, st.lt - .4, .07, .35, 30); rule.style.transform = `scaleX(${EIO(clamp((st.lt - .6) / .8))})`; run.style.transform = `translateX(${-(st.lt * 90) % 4000}px)`; tick.style.opacity = E(clamp((st.lt - .3) / .5)); } };
  };

  // window: a stretch of time on a ruler: marks, a shaded window, a donation dropping in, the days counted between two dates
  K.window = bs => {
    const v = bs[0].visual, sc = !!v.schema, d0 = sc ? 0 : dayN(v.from) - (+v.pad || 0), d1 = sc ? 1 : dayN(v.to) + (+v.pad || 0), X = d => 120 + ((sc ? d : dayN(d)) - d0) / (d1 - d0) * 1040, Y = 420;
    const M = v.marks || [], band = v.band, D = [].concat(v.drop || []), C = [].concat(v.count || []);
    const side = (x, r = 1030, l = 250) => x > r ? ' r' : x < l ? ' l' : '';
    const el = node(`<div class="s6 s6-win"><div class="cam"><svg viewBox="0 0 1280 720"><line class="ax0" x1="120" x2="1160" y1="${Y}" y2="${Y}"/><line class="f-ax" x1="120" x2="120" y1="${Y}" y2="${Y}"/>
      ${band ? `<rect class="band" x="${X(band.from)}" y="${Y - 70}" width="0" height="140" rx="10"/>` : ''}${M.map((m, i) => `<g class="mk" data-i="${i}"><line x1="${X(m.at)}" x2="${X(m.at)}" y1="${Y - 90}" y2="${Y + 16}"/><circle cx="${X(m.at)}" cy="${Y}" r="9"/></g>`).join('')}
      ${C.map(cn => `<path class="brace" d="M${X(cn.from)},${Y + 40} Q${X(cn.from)},${Y + 70} ${(X(cn.from) + X(cn.to)) / 2},${Y + 70} Q${X(cn.to)},${Y + 70} ${X(cn.to)},${Y + 40}" pathLength="1"/>`).join('')}${D.map(dp => `<circle class="drop" cx="${X(dp.at)}" r="16"/>`).join('')}</svg>
      ${band ? `<div class="bl" style="left:${(X(band.from) + X(band.to)) / 2}px">${esc(band.label || '')}</div>` : ''}${M.map((m, i) => `<div class="ml${side(X(m.at))}" data-i="${i}" style="left:${X(m.at)}px"><b>${esc(m.label)}</b>${m.date ? `<span>${esc(longDate(m.date))}</span>` : ''}</div>`).join('')}
      ${D.map((dp, k) => `<div class="dl${side(X(dp.at), 980, 300)}" style="left:${X(dp.at)}px${k ? ';top:' + (140 - 0) + 'px' : ''}"><b>${esc(dp.label || '')}</b>${dp.date ? `<span>${esc(longDate(dp.date))}</span>` : ''}</div>`).join('')}${C.map(cn => `<div class="cn${side((X(cn.from) + X(cn.to)) / 2, 1060, 200)}" style="left:${(X(cn.from) + X(cn.to)) / 2}px"><span class="v">0</span> days</div>`).join('')}${sc ? ILLUS : ''}</div></div>`);
    const ax = el.querySelector('.f-ax'), mk = [...el.querySelectorAll('.mk')], ml = [...el.querySelectorAll('.ml')], bandEl = el.querySelector('.band'), bl = el.querySelector('.bl'), drops = [...el.querySelectorAll('.drop')], dls = [...el.querySelectorAll('.dl')], braces = [...el.querySelectorAll('.brace')], cns = [...el.querySelectorAll('.cn')];
    const at = (beat, st, delay = 0) => (st.i > (beat || 0) ? 9 : st.i === (beat || 0) ? st.bt - delay : -1);
    return { el, update: st => {
      ax.setAttribute('x2', (120 + 1040 * EIO(clamp(st.lt / 1.2))).toFixed(1));
      M.forEach((m, i) => { const t = at(m.beat, st, m.delay || 0), o = BACK(clamp(t / .5)); mk[i].style.opacity = t < 0 ? 0 : 1; mk[i].style.transform = `translateY(${(1 - o) * -40}px)`; show(ml[i], t < 0 ? 0 : E(clamp(t / .5)), 16); });
      if (band) { const t = at(band.beat, st, band.delay || 0), q = EIO(clamp(t / 1.2)); bandEl.setAttribute('width', Math.max(0, (X(band.to) - X(band.from)) * q).toFixed(1)); show(bl, t < 0 ? 0 : E(clamp((t - .6) / .5)), 12); }
      D.forEach((dp, k) => { const t = at(dp.beat, st, dp.delay || 0), f = clamp(t / .55), y = t < 0 ? -100 : f < 1 ? 60 + (Y - 60) * f * f : Y - Math.abs(Math.sin((t - .55) * 9)) * 30 * Math.exp(-(t - .55) * 5);
        drops[k].setAttribute('cy', y.toFixed(1)); drops[k].style.opacity = t < 0 ? 0 : 1; const later = D.some((o, m) => m > k && at(o.beat, st, o.delay || 0) >= .4); show(dls[k], t < 0 || later ? 0 : E(clamp((t - .5) / .4)), 12); });
      C.forEach((cn, k) => { const t = at(cn.beat, st, cn.delay || 0), q = E(clamp(t / .9)); braces[k].style.strokeDashoffset = 1 - q; cns[k].querySelector('.v').textContent = Math.round(Math.abs(dayN(cn.to) - dayN(cn.from)) * q); show(cns[k], t < 0 ? 0 : BACK(clamp(t / .5)), 14, .3); }); } };
  };

  // form: a filed return as paper, its lines filling in; the line the beat is about is circled
  K.form = bs => {
    const v = bs[0].visual, R = v.rows || [];
    const el = node(`<div class="s6 s6-form"><div class="cam"><div class="paper"><div class="hd"><b>${esc(v.title || '')}</b><span>${esc(v.sub || '')}</span></div>${R.map((r, i) => `<div class="fr" data-i="${i}"><span class="k">${esc(r[0])}</span><i class="lead"></i><span class="val">${esc(r[1])}</span><svg class="circ" viewBox="0 0 300 90" preserveAspectRatio="none"><path d="M150,8 C260,6 296,28 290,48 C282,76 180,86 120,82 C40,78 4,62 10,40 C16,18 80,6 170,10" pathLength="1"/></svg></div>`).join('')}
      <div class="f-ft"><i></i><i></i><i></i><i></i></div></div></div></div>`);
    const paper = el.querySelector('.paper'), fr = [...el.querySelectorAll('.fr')];
    return { el, update: st => { const o = E(st.lt / .8); paper.style.opacity = o; paper.style.transform = `translateY(${(1 - o) * 80}px) rotate(${-1.5 + (1 - o) * 5 + Math.sin(st.lt * .6) * .3}deg)`;
      R.forEach((r, i) => { const b = r[2] || 0, t = st.i > b ? 9 : st.i === b ? st.bt : -1, val = fr[i].querySelector('.val'), cir = fr[i].querySelector('.circ path'), on = st.i === b; show(fr[i], t < 0 ? .25 : 1, 0);
        val.style.opacity = t < 0 ? 0 : 1; val.style.transform = on ? `scale(${1 + .5 * Math.pow(1 - clamp((t - .3) / .5), 3) * (t > .3 ? 1 : 0)})` : ''; cir.style.strokeDashoffset = on ? 1 - E(clamp((t - .5) / .7)) : st.i > b ? 0 : 1; fr[i].classList.toggle('now', on); }); } };
  };

  // share: a ring filling to a percentage
  K.share = bs => {
    const v = bs[0].visual, pct = +v.pct || 0, r = rng(9), motes = Array.from({ length: 26 }, () => [r() * Math.PI * 2, 270 + r() * 60, .3 + r() * .7]);
    const el = node(`<div class="s6 s6-share"><div class="cam"><svg class="ring" viewBox="0 0 700 700"><circle cx="350" cy="350" r="230" class="r0"/><circle cx="350" cy="350" r="230" class="r1" pathLength="1" transform="rotate(-90 350 350)"/>${motes.map(() => '<circle class="mo" r="4"/>').join('')}</svg>
      <div class="f-num"><span class="v">0</span><small>%</small></div><div class="side"><h2>${words(v.label || '')}</h2></div></div></div>`);
    const r1 = el.querySelector('.r1'), num = el.querySelector('.f-num .v'), mos = [...el.querySelectorAll('.mo')], ws = [...el.querySelectorAll('.side .w')];
    return { el, update: st => { const q = EIO(clamp((st.lt - .15) / 1.8)); r1.style.strokeDashoffset = 1 - q * pct / 100; num.textContent = pct % 1 ? (pct * q).toFixed(1) : Math.round(pct * q); reveal(ws, st.lt - .6, .1, .5);
      mos.forEach((m, k) => { const [a0, rad, sp] = motes[k], a = a0 + st.lt * sp, rr = rad - ((st.lt * 40 * sp) % 60); m.setAttribute('cx', (350 + Math.cos(a) * rr).toFixed(1)); m.setAttribute('cy', (350 + Math.sin(a) * rr).toFixed(1)); m.style.opacity = .2 + .5 * Math.sin(st.lt * sp * 3 + k) ** 2; }); } };
  };

  // network: the case file's actors and links, links lit beat by beat (v.steps: the link numbers each beat adds), money moving along them
  K.network = (bs, c) => {
    const v = bs[0].visual, A = c.actors || [], L = c.links || [], steps = v.steps || [], names = v.names || {}, pos0 = v.pos || {};
    const cols = [...new Set(A.map(a => a.col || 0))].sort((x, y) => x - y), rows = [...new Set(A.map(a => a.row || 0))].sort((x, y) => x - y);
    const P = {}; A.forEach(a => { P[a.id] = pos0[a.id] || [cols.length < 2 ? 640 : 170 + 940 * cols.indexOf(a.col || 0) / (cols.length - 1), rows.length < 2 ? 360 : 190 + 300 * rows.indexOf(a.row || 0) / (rows.length - 1)]; });
    const used = [...new Set(steps.flat())], firstStep = j => steps.findIndex(s => s.includes(j));
    const nodesIn = {}; used.forEach(j => { const l = L[j]; if (!l) return; [l.from, l.to].forEach(id => { const k = firstStep(j); nodesIn[id] = Math.min(nodesIn[id] ?? 99, k); }); });
    const edge = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.min(dx ? 120 / Math.abs(dx) : 9, dy ? 42 / Math.abs(dy) : 9); return [p[0] + dx * t, p[1] + dy * t]; };
    const G = used.map(j => { const l = L[j], p = P[l.from], q = P[l.to]; if (!p || !q) return null; const a = edge(p, q), z = edge(q, p), back = used.some(k => L[k] && L[k].from === l.to && L[k].to === l.from), bend = back ? 46 : 0, dx = z[0] - a[0], dy = z[1] - a[1], len = Math.hypot(dx, dy) || 1;
      return { j, l, a, z, cx: (a[0] + z[0]) / 2 - dy / len * bend, cy: (a[1] + z[1]) / 2 + dx / len * bend, k: firstStep(j) }; }).filter(Boolean);
    const qb = (g, f) => [(1 - f) * (1 - f) * g.a[0] + 2 * (1 - f) * f * g.cx + f * f * g.z[0], (1 - f) * (1 - f) * g.a[1] + 2 * (1 - f) * f * g.cy + f * f * g.z[1]];
    const el = node(`<div class="s6 s6-net"><div class="cam"><svg viewBox="0 0 1280 720"><defs><marker id="n6-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="context-stroke"/></marker></defs>
      ${G.map(g => `<g class="lk k-${esc(g.l.kind)}"><path d="M${g.a[0].toFixed(1)},${g.a[1].toFixed(1)} Q${g.cx.toFixed(1)},${g.cy.toFixed(1)} ${g.z[0].toFixed(1)},${g.z[1].toFixed(1)}" pathLength="1" marker-end="url(#n6-arr)"/>${g.l.kind === 'money' ? Array.from({ length: 5 }, () => '<circle r="5"/>').join('') : ''}</g>`).join('')}</svg>
      ${Object.keys(nodesIn).map(id => { const a = A.find(x => x.id === id) || { name: id }; return `<div class="nd t-${esc(a.type)}" data-id="${esc(id)}" style="left:${P[id][0]}px;top:${P[id][1]}px"><div class="f-ic">${ICON[a.type] || ICON.account}</div><b>${esc(names[id] || a.name)}</b></div>`; }).join('')}
      ${G.map(g => { const m = qb(g, .5); return `<div class="f-lab" style="left:${m[0].toFixed(0)}px;top:${(m[1] - 34).toFixed(0)}px">${esc((v.labels || {})[g.j] ?? g.l.label ?? '')}</div>`; }).join('')}</div></div>`);
    const nds = [...el.querySelectorAll('.nd')], lks = [...el.querySelectorAll('.lk')], labs = [...el.querySelectorAll('.f-lab')];
    return { el, update: st => {
      nds.forEach(nd => { const k = nodesIn[nd.dataset.id], t = st.i > k ? 9 : st.i === k ? st.bt : -1, o = BACK(clamp(t / .5)); nd.style.opacity = t < 0 ? 0 : clamp(o * 1.2); nd.style.transform = `translate(-50%,-50%) scale(${t < 0 ? .4 : .4 + .6 * o})`;
        nd.classList.toggle('now', G.some(g => g.k === st.i && (g.l.from === nd.dataset.id || g.l.to === nd.dataset.id))); });
      G.forEach((g, n) => { const t = st.i > g.k ? 9 : st.i === g.k ? st.bt - .35 : -1, q = E(clamp(t / .8)), path = lks[n].querySelector('path'); path.style.strokeDashoffset = 1 - q; lks[n].classList.toggle('now', g.k === st.i); lks[n].classList.toggle('old', g.k < st.i);
        [...lks[n].querySelectorAll('circle')].forEach((cn, i) => { const f = (st.lt * .45 + i / 5) % 1, p = qb(g, f); cn.setAttribute('cx', p[0].toFixed(1)); cn.setAttribute('cy', p[1].toFixed(1)); cn.style.opacity = q >= 1 ? Math.sin(f * Math.PI) * (g.k === st.i ? 1 : .35) : 0; });
        labs[n].style.opacity = g.k === st.i ? E(clamp((t - .5) / .4)) : g.k < st.i ? .35 : 0; labs[n].style.transform = `translate(-50%, 0) scale(${g.k === st.i ? 1 : .85})`; }); } };
  };

  // log: a terminal readout of the case file's figures, typed line by line; the line the beat is about lights up
  K.log = bs => {
    const v = bs[0].visual, R = v.lines || [];
    const el = node(`<div class="s6 s6-log"><div class="cam"><div class="term"><div class="bar"><i></i><i></i><i></i><span>${esc(v.title || 'case file')}</span></div><div class="body${Math.max(0, ...R.map(r => (r.text || '').length)) > 58 ? ' xs' : Math.max(0, ...R.map(r => (r.text || '').length)) > 44 ? ' s' : ''}">${R.map((r, i) => `<div class="lr" data-i="${i}"><span class="pr">&gt;</span><span class="tx" data-t="${esc(r.text)}"></span><span class="cur"></span></div>`).join('')}</div></div></div></div>`);
    const lr = [...el.querySelectorAll('.lr')], term = el.querySelector('.term');
    return { el, update: st => { const o = E(st.lt / .5); term.style.opacity = o; term.style.transform = `scale(${.94 + .06 * o})`;
      let lastOn = -1; R.forEach((r, i) => { const b = r.beat || 0, t = st.i > b ? 9 : st.i === b ? st.bt - (r.delay || 0) : -1, tx = lr[i].querySelector('.tx'), full = tx.dataset.t, k = t < 0 ? 0 : Math.floor(clamp(t / .7) * full.length); if (tx.textContent.length !== k) tx.textContent = full.slice(0, k); lr[i].style.opacity = t < 0 ? 0 : 1; if (t >= 0) lastOn = i;
        lr[i].classList.toggle('hi', !!r.hi && k >= full.length); lr[i].classList.toggle('now', st.i === b && t >= 0); });
      lr.forEach((l, i) => { l.querySelector('.cur').style.opacity = i === lastOn && Math.floor(st.lt * 2.5) % 2 === 0 ? 1 : 0; }); } };
  };

  // ---- shots that show rather than tell (style sample: approved-after-the-fact; reusable by every film)
  // the moment a word is said in this beat: the beat's word times (ElevenLabs wt) mapped onto its displayed words, as the captions do
  const wordAt = (b, test, dflt = .2) => { if (!b) return dflt; const ws = String(b.text || '').split(/\s+/).filter(Boolean), d = Math.max(.2, (b.t1 || 0) - (b.t0 || 0)); const i = ws.findIndex(w => test(w.toLowerCase().replace(/[^a-z0-9$.,%]/g, '')));
    if (i < 0) return dflt; if (Array.isArray(b.wt) && b.wt.length) return b.wt[Math.min(b.wt.length - 1, Math.round(i * (b.wt.length - 1) / Math.max(1, ws.length - 1)))] || 0;
    const wl = ws.map(w => w.length + 2), tot = wl.reduce((x, y) => x + y, 0); return wl.slice(0, i).reduce((x, y) => x + y, 0) / tot * d; };
  const hasDigits = w => /\d/.test(w);
  const ART = {      // inline drawings (drawn here, no outside assets): strokes with class d draw on, fills with class f fade in
    cityhall: '<path class="f" d="M30 170h140v10H30z"/><path class="d" d="M40 170V110h120v60M50 110v60M70 110v60M90 110v60M110 110v60M130 110v60M150 110v60M34 110h132l-66-24z" pathLength="1"/><path class="d" d="M74 86c0-22 12-34 26-38 14 4 26 16 26 38M100 48V34M94 34h12" pathLength="1"/><circle class="d" cx="100" cy="30" r="4" pathLength="1"/>',
    housing: '<path class="d" d="M40 180V60h70v120M110 180V90h50v90M30 180h140" pathLength="1"/>' + [0, 1, 2, 3, 4].map(r => [0, 1, 2].map(k => `<rect class="f win" x="${50 + k * 20}" y="${72 + r * 20}" width="10" height="12"/>`).join('')).join('') + [0, 1, 2].map(r => `<rect class="f win" x="122" y="${102 + r * 22}" width="10" height="12"/><rect class="f win" x="140" y="${102 + r * 22}" width="10" height="12"/>`).join('') + '<path class="d" d="M68 180v-18h14v18" pathLength="1"/>',
    contract: '<path class="d" d="M50 20h75l25 25v135H50z" pathLength="1"/><path class="d" d="M125 20v25h25M65 60h70M65 76h70M65 92h70M65 108h50" pathLength="1"/><path class="d sig" d="M64 150c10-16 16 8 24-6s12 10 20-2 10 6 18 0" pathLength="1"/><circle class="d" cx="132" cy="146" r="12" pathLength="1"/>',
    fiber: [100, 120, 140].map(y => `<path class="d fb" d="M10 ${y}c40-40 80 40 120 0s50-30 60-20" pathLength="1"/>`).join('') + [0, 1, 2, 3, 4, 5].map(i => `<circle class="pulse6" r="4" data-i="${i}"/>`).join(''),
    van: '<path class="d" d="M20 140V90h100l30 22h30v28z" pathLength="1"/><circle class="d" cx="55" cy="146" r="13" pathLength="1"/><circle class="d" cx="150" cy="146" r="13" pathLength="1"/><path class="d" d="M126 96l18 14h-18z" pathLength="1"/><path class="f" d="M62 100h12v10h10v12H74v10H62v-10H52v-12h10z"/>',
    calendar: '<rect class="d" x="35" y="40" width="130" height="130" rx="8" pathLength="1"/><path class="d" d="M35 72h130M70 28v24M130 28v24" pathLength="1"/>' + Array.from({ length: 20 }, (_, i) => `<rect class="f day" x="${46 + (i % 5) * 23}" y="${82 + Math.floor(i / 5) * 21}" width="16" height="13" rx="2"/>`).join(''),
    money: [0, 1, 2, 3, 4].map(i => `<g class="bill" data-i="${i}"><rect class="d" x="40" y="${150 - i * 18}" width="120" height="30" rx="4" pathLength="1"/><circle class="d" cx="100" cy="${165 - i * 18}" r="8" pathLength="1"/></g>`).join(''),
    gavel: '<path class="d" d="M60 60l40-40 24 24-40 40zM92 52l60 60-12 12-60-60M30 180h90M40 168h70" pathLength="1"/>',
    magnifier: '<path class="d" d="M40 30h70l20 20v120H40z" pathLength="1"/><path class="d" d="M54 70h50M54 86h50M54 102h30" pathLength="1"/><circle class="d" cx="120" cy="120" r="30" pathLength="1"/><path class="d" d="M142 142l30 30" pathLength="1"/>',
    question: '<path class="d" d="M70 70c0-20 14-32 30-32s30 12 30 30c0 22-30 24-30 50" pathLength="1"/><circle class="f" cx="100" cy="150" r="7"/>',
  };
  const drawOn = (el, q, stagger = .12) => { const ds = el.__ds || (el.__ds = [...el.querySelectorAll('.d')]), fs = el.__fs || (el.__fs = [...el.querySelectorAll('.f')]); const n = ds.length;
    ds.forEach((d, i) => { d.style.strokeDashoffset = 1 - E(clamp((q - i * stagger / Math.max(1, n) * 4) / .5)); }); fs.forEach((f, i) => { f.style.opacity = E(clamp((q - .45 - i * .012) / .3)); }); };
  K.bignum = bs => {      // a key number alone: it ticks up as it is said, lands with a hit, then its unit and why it matters
    const v = bs[0].visual, b = bs[0], like = String(v.value), big = like.replace(/\s*(million|billion)$/i, ''), unit = (like.match(/(million|billion)$/i) || [''])[0], val = parseNum(big);
    const dec = ((big.match(/\.(\d+)/) || ['', ''])[1]).length, cur = /^\$/.test(big), fmt = x => (cur ? '$' : '') + x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });      // the figure as the case file writes it, counted up
    const el = node(`<div class="s6 s6-bignum"><div class="cam"><div class="ring6"></div><div class="f-num${big.length > 6 ? ' l' : ''}"><span class="v">${esc(fmt(0))}</span>${unit ? `<span class="u">${esc(unit)}</span>` : ''}</div><div class="f-lab">${esc(v.label || '')}</div>${v.sub ? `<div class="f-sub">${esc(v.sub)}</div>` : ''}</div></div>`);
    const vEl = el.querySelector('.v'), num = el.querySelector('.f-num'), ring = el.querySelector('.ring6'), lab = el.querySelector('.f-lab'), sub = el.querySelector('.f-sub');
    const at = wordAt(b, hasDigits, .15), dur = clamp((b.t1 - b.t0) - at - .25, .5, 1.3);
    return { el, update: st => { const q = st.i === 0 ? clamp((st.bt - at) / dur) : 1, e = 1 - Math.pow(1 - q, 4); vEl.textContent = q >= 1 ? big : fmt(val * e); show(num, E(clamp((st.bt - at + .25) / .3)), 0, .25);
      const h = st.i === 0 ? st.bt - (at + dur) : 9; const hit = h > 0 && h < .6 ? Math.exp(-h * 7) : 0; num.style.transform = `scale(${(1 + hit * .1).toFixed(3)})`; num.classList.toggle('landed', q >= 1);
      ring.style.opacity = h > 0 ? (hit * .9).toFixed(3) : 0; ring.style.transform = `translate(-50%,-50%) scale(${(.6 + (1 - hit) * .9).toFixed(3)})`; show(lab, E(clamp((h + .05) / .35)), 14); show(sub, st.i > 0 ? E(clamp(st.bt / .4)) : E(clamp((h - .4) / .4)), 12); } };
  };
  K.scene = bs => {      // one idea, drawn: a picture that matches the words (city hall, housing, a contract, fiber, a van, a calendar, money, a gavel)
    const v = bs[0].visual, b = bs[0], art = ART[v.art] || ART.contract;
    const el = node(`<div class="s6 s6-scene art-${esc(v.art || 'contract')}"><div class="cam"><svg class="art" viewBox="0 0 200 200">${art}</svg><div class="txt">${v.kicker ? `<div class="kk">${esc(v.kicker)}</div>` : ''}<h2>${words(v.label || '')}</h2>${v.sub ? `<p>${esc(v.sub)}</p>` : ''}${v.chip ? `<div class="chip">${esc(v.chip)}</div>` : ''}</div>${v.stamp ? `<div class="stamp6">${esc(v.stamp)}</div>` : ''}</div></div>`);
    const svg = el.querySelector('svg.art'), ws = [...el.querySelectorAll('h2 .w')], p = el.querySelector('.txt p'), kk = el.querySelector('.kk'), chip = el.querySelector('.chip'), stamp = el.querySelector('.stamp6'), pulses = [...el.querySelectorAll('.pulse6')], fibers = [...el.querySelectorAll('.fb')];
    const stAt = v.stampOn ? wordAt(b, w => w.startsWith(String(v.stampOn).toLowerCase()), (b.t1 - b.t0) * .6) : (b.t1 - b.t0) * .6;
    return { el, update: st => { drawOn(svg, st.lt / 1.4); show(kk, E(st.lt / .4), 10); reveal(ws, st.lt - .25, .1, .45, 20); show(p, E((st.lt - .7) / .5), 12); show(chip, BACK(clamp((st.lt - 1) / .4)), 10, .2);
      pulses.forEach((c, i) => { const path = fibers[i % 3]; if (!path || !path.getTotalLength) return; const f = (st.lt * .35 + i / pulses.length) % 1; let pt; try { const L = path.getTotalLength(); pt = path.getPointAtLength(f * L); } catch (e) { return; } c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); c.style.opacity = st.lt > 1.2 ? Math.sin(f * Math.PI) : 0; });
      if (stamp) { const s = st.i === 0 ? clamp((st.bt - stAt) / .18) : 1; stamp.style.opacity = s > 0 ? 1 : 0; stamp.style.transform = `translate(-50%,-50%) rotate(-10deg) scale(${(2.2 - 1.2 * E(s)).toFixed(3)})`; } } };
  };
  K.span = bs => {      // a stretch of time: two calendar pages, a line drawn between them, the days counted as the line runs
    const v = bs[0].visual, b = bs[0], d0 = dayN(v.from), d1 = dayN(v.to), days = v.days != null ? parseNum(v.days) : 0;
    const page = (d, lab, cls) => { const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/); return `<div class="pg ${cls}"><div class="rings"><i></i><i></i></div><div class="mo">${m ? MON[+m[2] - 1] : ''}</div><div class="dy">${m ? +m[3] : ''}</div><div class="yr">${m ? m[1] : esc(d)}</div><div class="lb">${esc(lab || '')}</div></div>`; };
    const el = node(`<div class="s6 s6-span"><div class="cam">${v.kicker ? `<div class="f-kick">${esc(v.kicker)}</div>` : ''}${page(v.from, v.fromLab, 'a')}${page(v.to, v.toLab, 'z')}<svg class="ln6" viewBox="0 0 1280 720"><path d="M430 380 H850" pathLength="1"/>${Array.from({ length: 13 }, (_, i) => `<line x1="${430 + i * 35}" y1="368" x2="${430 + i * 35}" y2="392" class="tk" data-i="${i}"/>`).join('')}</svg>${days ? `<div class="cnt"><b>0</b><span>${esc(v.unit || 'days')}</span></div>` : ''}</div></div>`);
    const A = el.querySelector('.pg.a'), Z = el.querySelector('.pg.z'), ln = el.querySelector('.ln6 path'), tks = [...el.querySelectorAll('.ln6 .tk')], cnt = el.querySelector('.cnt'), cb = cnt && cnt.querySelector('b'), kick = el.querySelector('.f-kick');
    const zAt = v.toOn ? wordAt(b, w => w.startsWith(String(v.toOn).toLowerCase()), (b.t1 - b.t0) * .45) : (b.t1 - b.t0) * .45;
    return { el, update: st => { const bt = st.i === 0 ? st.bt : 99; show(kick, E(st.lt / .4)); show(A, BACK(clamp(st.lt / .45)), 30); const q = EIO(clamp((bt - .4) / Math.max(.6, zAt - .2))); ln.style.strokeDashoffset = 1 - q; tks.forEach((t, i) => t.classList.toggle('on', i / 12 <= q));
      show(Z, BACK(clamp((bt - zAt) / .45)), 30); if (cnt) { show(cnt, E(clamp((bt - .4) / .3)), 10); cb.textContent = Math.round(days * q).toLocaleString('en-US'); cnt.classList.toggle('landed', q >= 1); } } };
  };
  K.chain = (bs, c) => {      // who does what, in order: boxes joined by arrows that draw on; a late step is marked
    const v = bs[0].visual, S = v.steps || [], n = S.length, x0 = 640 - (n - 1) * 190;
    const el = node(`<div class="s6 s6-chain"><div class="cam">${v.kicker ? `<div class="f-kick">${esc(v.kicker)}</div>` : ''}<svg class="ar" viewBox="0 0 1280 720"><defs><marker id="c6-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="currentColor"/></marker></defs>${S.slice(1).map((s, i) => `<path class="a${s.late ? ' late' : ''}" d="M${x0 + i * 380 + 120},360 H${x0 + (i + 1) * 380 - 120}" pathLength="1" marker-end="url(#c6-arr)"/>`).join('')}</svg>
      ${S.map((s, i) => `<div class="bx${s.late ? ' late' : ''}" style="left:${x0 + i * 380}px"><svg class="ic" viewBox="0 0 200 200">${ART[s.art] || ART.contract}</svg><b>${esc(s.name)}</b><span>${esc(s.sub || '')}</span>${s.late ? `<em>${esc(s.late)}</em>` : ''}</div>`).join('')}</div></div>`);
    const bx = [...el.querySelectorAll('.bx')], ar = [...el.querySelectorAll('svg.ar .a')], kick = el.querySelector('.f-kick'), span = Math.max(1.2, (bs[bs.length - 1].t1 - bs[0].t0) * .7);
    return { el, update: st => { show(kick, E(st.lt / .4)); bx.forEach((x, i) => { const a = i * span / n; show(x, BACK(clamp((st.lt - a) / .45)), 26); drawOn(x.querySelector('svg.ic'), (st.lt - a) / 1.1); const em = x.querySelector('em'); if (em) show(em, BACK(clamp((st.lt - a - .5) / .3)), 8, .4); });
      ar.forEach((p, i) => { p.style.strokeDashoffset = 1 - E(clamp((st.lt - (i + .6) * span / n) / .4)); }); } };
  };
  K.sfmap = bs => {      // San Francisco as it is (DataSF neighborhood boundaries), with real places (OpenStreetMap); the camera zooms to the place the words name
    const v = bs[0].visual, G = window.FD_SF_GEO || { nb: {}, places: {} }, cosL = Math.cos(37.76 * Math.PI / 180), skip = new Set(['Treasure Island']);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [k, ps] of Object.entries(G.nb)) if (!skip.has(k)) for (const p of ps) for (const [lo, la] of p) { const x = lo * cosL; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, la); y1 = Math.max(y1, la); }
    const k = Math.min(1100 / (x1 - x0), 620 / (y1 - y0)), ox = 640 - (x0 + x1) / 2 * k, oy = 370 + (y0 + y1) / 2 * k, X = lo => lo * cosL * k + ox, Y = la => oy - la * k;
    const path = ps => ps.map(p => 'M' + p.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join('L') + 'Z').join('');
    const hood = v.hood && G.nb[v.hood], pins = (v.pins || []).map(p => { const g = G.places[p.place] || p; return { ...p, x: X(g.lon), y: Y(g.lat) }; });
    let cx = 640, cy = 370; if (v.zoom === 'hood' && hood) { let sx = 0, sy = 0, m = 0; for (const p of hood) for (const [lo, la] of p) { sx += X(lo); sy += Y(la); m++; } cx = sx / m; cy = sy / m; } else if (pins[0]) { cx = pins[0].x; cy = pins[0].y; }
    const Z = +v.scale || 3.2;
    const el = node(`<div class="s6 s6-sfmap"><div class="cam"><div class="world"><svg viewBox="0 0 1280 720"><g class="nb">${Object.entries(G.nb).map(([nm, ps]) => `<path class="${nm === v.hood ? 'hood' : ''}" d="${path(ps)}"/>`).join('')}</g>
      ${pins.map((p, i) => `<g class="pin" data-i="${i}"><circle class="halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10"/><circle class="dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5"/></g>`).join('')}</svg>
      ${pins.map((p, i) => `<div class="pl" data-i="${i}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px"><b>${esc(p.name || '')}</b>${p.sub ? `<em>${esc(p.sub)}</em>` : ''}</div>`).join('')}${hood && v.hoodLabel ? `<div class="hl" style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px">${esc(v.hoodLabel)}</div>` : ''}</div>
      ${v.kicker ? `<div class="f-kick">${esc(v.kicker)}</div>` : ''}<div class="attr">Map: DataSF neighborhoods (public domain) · place: © OpenStreetMap contributors</div></div></div>`);
    const world = el.querySelector('.world'), nbs = [...el.querySelectorAll('.nb path')], hp = el.querySelector('.nb .hood'), pg = [...el.querySelectorAll('.pin')], pl = [...el.querySelectorAll('.pl')], hl = el.querySelector('.hl'), kick = el.querySelector('.f-kick'), b = bs[0];
    const zAt = v.zoomOn ? wordAt(b, w => w.startsWith(String(v.zoomOn).toLowerCase()), .8) : .8;
    return { el, update: st => { const bt = st.i === 0 ? st.bt : 99; nbs.forEach((p, i) => { p.style.opacity = E(clamp((st.lt - i * .012) / .5)); }); show(kick, E(st.lt / .4));
      const z = EIO(clamp((bt - zAt) / 1.1)), s = 1 + (Z - 1) * z; world.style.transform = `translate(${(640 - cx * s).toFixed(1)}px, ${(370 - cy * s).toFixed(1)}px) scale(${s.toFixed(4)})`; world.style.setProperty('--zs', (1 / s).toFixed(4));
      if (hp) hp.style.fillOpacity = (.15 + .55 * E(clamp((bt - zAt - .4) / .5))).toFixed(3); if (hl) hl.style.opacity = E(clamp((bt - zAt - .7) / .4));
      pg.forEach((g, i) => { const o = BACK(clamp((bt - zAt - .5 - i * .2) / .35)); g.style.opacity = clamp(o); const pp = (st.lt * .9) % 1; g.querySelector('.halo').setAttribute('r', (8 + pp * 22).toFixed(1)); g.querySelector('.halo').style.opacity = (1 - pp) * .8; });
      pl.forEach((x, i) => { x.style.opacity = E(clamp((bt - zAt - .7 - i * .2) / .4)); }); } };
  };

  // the backgrounds of the looks: each a layer moving with the film clock
  const BG = {
    dossier: () => { const r = rng(4), sheets = Array.from({ length: 5 }, () => [r() * 1280, r() * 720, -14 + r() * 28, .4 + r() * .6]);
      const el = node(`<div class="bg6 bg-dossier">${sheets.map(s => `<div class="sheet" style="left:${(s[0] - 200).toFixed(0)}px;top:${(s[1] - 150).toFixed(0)}px"><i></i><i></i><i></i><i></i><i></i></div>`).join('')}<div class="grain"></div></div>`);
      const sh = [...el.querySelectorAll('.sheet')]; return { el, update: t => sh.forEach((e, k) => { const s = sheets[k]; e.style.transform = `translate(${(Math.sin(t * .05 * s[3] + k) * 40).toFixed(1)}px, ${(Math.cos(t * .04 * s[3] + k) * 30).toFixed(1)}px) rotate(${(s[2] + Math.sin(t * .03 + k) * 2).toFixed(2)}deg)`; }) }; },
    terminal: () => { const el = node(`<div class="bg6 bg-terminal"><svg viewBox="0 0 1280 720" preserveAspectRatio="none"><g class="v">${Array.from({ length: 33 }, (_, i) => `<line x1="${640 + (i - 16) * 18}" y1="400" x2="${640 + (i - 16) * 160}" y2="760"/>`).join('')}</g><g class="h">${Array.from({ length: 12 }, () => '<line x1="-200" x2="1480"/>').join('')}</g></svg><div class="scan"></div></div>`);
      const hs = [...el.querySelectorAll('.h line')]; return { el, update: t => hs.forEach((l, k) => { const f = ((k / hs.length) + t * .08) % 1, y = 400 + Math.pow(f, 2.2) * 360; l.setAttribute('y1', y.toFixed(1)); l.setAttribute('y2', y.toFixed(1)); l.style.opacity = (f * .9).toFixed(2); }) }; },
    map: () => { const r = rng(8), rings = Array.from({ length: 9 }, (_, k) => { const cx = r() * 1280, cy = r() * 720, pts = []; for (let i = 0; i <= 36; i++) { const a = i / 36 * Math.PI * 2, rr = 80 + k * 18 + Math.sin(a * 3 + k) * 20 + Math.sin(a * 5) * 8; pts.push(`${(cx + Math.cos(a) * rr).toFixed(0)},${(cy + Math.sin(a) * rr).toFixed(0)}`); } return pts.join(' '); });
      const el = node(`<div class="bg6 bg-map"><svg viewBox="0 0 1280 720">${rings.map(p => `<polygon points="${p}"/>`).join('')}${Array.from({ length: 9 }, (_, i) => `<line class="ll" x1="0" x2="1280" y1="${i * 90}" y2="${i * 90}"/><line class="ll" y1="0" y2="720" x1="${i * 160}" x2="${i * 160}"/>`).join('')}</svg></div>`);
      const svg = el.querySelector('svg'); return { el, update: t => { svg.style.transform = `translate(${(-t * 6) % 160}px, ${(-t * 3) % 90}px) scale(1.15)`; } }; },
    newsroom: () => { const el = node(`<div class="bg6 bg-news"><i class="sw"></i><i class="sw b"></i><div class="dots"></div><div class="band"></div></div>`); const sw = [...el.querySelectorAll('.sw')];
      return { el, update: t => sw.forEach((e, k) => { e.style.transform = `translateX(${(((t * (60 + k * 25) + k * 700) % 2200) - 600).toFixed(0)}px) skewX(-24deg)`; }) }; },
    kinetic: () => { const el = node(`<div class="bg6 bg-kin">${Array.from({ length: 5 }, (_, k) => `<i class="bd b${k}"></i>`).join('')}</div>`); const bd = [...el.querySelectorAll('.bd')];
      return { el, update: t => bd.forEach((e, k) => { e.style.transform = `rotate(-18deg) translateX(${(((t * (40 + k * 22) * (k % 2 ? -1 : 1)) % 900) - 450).toFixed(0)}px)`; }) }; },
    flow: () => { const el = node(`<div class="bg6 bg-flow"><svg viewBox="0 0 1280 720">${Array.from({ length: 6 }, (_, k) => `<path d="M-50,${120 + k * 100} C300,${60 + k * 100} 900,${200 + k * 100} 1330,${110 + k * 100}" pathLength="1"/>`).join('')}${Array.from({ length: 36 }, () => '<circle r="2.5"/>').join('')}</svg></div>`);
      const cs = [...el.querySelectorAll('circle')]; return { el, update: t => cs.forEach((cn, i) => { const k = i % 6, f = ((t * .04 + i / 36 * 3) % 1), x = -50 + f * 1380, y = 120 + k * 100 + Math.sin(f * Math.PI * 2 + k) * 50; cn.setAttribute('cx', x.toFixed(1)); cn.setAttribute('cy', y.toFixed(1)); }) }; },
  };

  // A fixed safe area keeps labels, graphics and captions separate at any player size.
  const pictograms = {
    document:'<path d="M8 3h11l6 6v20H8z M19 3v7h6 M12 15h9 M12 20h9 M12 24h6"/>',
    vote:'<path d="M5 16h22l3 5v7H2v-7z M10 21h11 M10 9l6-6 7 7-6 6z"/>',
    lease:'<path d="M6 3h12l6 6v7 M17 3v7h7 M6 3v25h10 M9 14h9"/><circle cx="21" cy="21" r="4"/><path d="m24 24 5 5m-2-2 2-2"/>',
    ticket:'<path d="M3 9h26v5a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6z M21 10v3m0 3v3m0 3v2"/>',
    travel:'<path d="m3 17 10 1 10-13c2-2 5 0 3 3l-8 13 8 4-1 2-10-2-6 4-2-1 4-6-8-3z"/>',
    transit:'<rect x="6" y="4" width="20" height="21" rx="5"/><path d="M9 9h14v7H9z M10 29l3-4m9 4-3-4"/><circle cx="11" cy="21" r="1"/><circle cx="21" cy="21" r="1"/>',
    construction:'<path d="M4 19a12 12 0 0 1 8-11m8 0a12 12 0 0 1 8 11 M13 14V6h6v8 M4 20h24l2 4v2H2v-2z"/>',
    permit:'<path d="M6 3h13l6 6v7 M19 3v7h6 M6 3v25h10 M10 14h9m-9 5h5"/><circle cx="23" cy="22" r="5"/><path d="m20 26-1 4 4-2 4 2-1-4"/>',
    technology:'<rect x="3" y="5" width="26" height="18" rx="2"/><path d="M13 23v4m6-4v4 M9 28h14 M8 11l3 3-3 3m6 0h6"/>',
    water:'<path d="M16 3S7 13 7 19a9 9 0 0 0 18 0c0-6-9-16-9-16z M11 20a5 5 0 0 0 5 5"/>',
    housing:'<path d="M3 16 16 5l13 11 M7 14v14h18V14 M14 28V18h5v10"/>',
    health:'<rect x="4" y="8" width="24" height="19" rx="3"/><path d="M12 8V5h8v3 M16 12v11 M11 17.5h10"/>',
    cityhall:'<path d="m3 12 13-8 13 8z M6 27h20 M4 30h24 M8 15v9m6-9v9m6-9v9m5-9v9"/>',
    person:'<circle cx="16" cy="10" r="6"/><path d="M5 28c0-7 4-11 11-11s11 4 11 11"/>',
    education:'<path d="M2 12 16 5l14 7-14 7z M7 15v7c5 5 13 5 18 0v-7 M29 13v9"/>',
    money:'<path d="M3 8h26v16H3z M3 13c3 0 5-2 5-5 M24 24c0-3 2-5 5-5"/><circle cx="16" cy="16" r="4"/>',
    calendar:'<rect x="4" y="6" width="24" height="22" rx="3"/><path d="M4 13h24 M10 3v7m12-7v7 M9 18h4m5 0h5M9 23h4"/>',
    gavel:'<path d="m13 5 4-3 9 11-4 3z M8 9l4-3 9 11-4 3z M13 15 3 25l3 3 10-10 M18 27h10"/>',
    question:'<circle cx="16" cy="16" r="12"/><path d="M12 12a4 4 0 0 1 8 0c0 4-4 4-4 8 M16 24h.01"/>',
    gap:'<path d="M8 3h11l6 6v6 M25 24v5H8v-6 M8 16V3 M5 20h6m4 0h4m4 0h5"/>',
    magnifier:'<circle cx="13" cy="13" r="8.7"/><path d="m20 20 8 8 M9 13l3 3 5-6"/>',
    timeline:'<path d="M6 5v22 M11 7h16 M11 16h12 M11 25h15"/><circle cx="6" cy="7" r="2"/><circle cx="6" cy="16" r="2"/><circle cx="6" cy="25" r="2"/>',
    transfer:'<path d="M3 10h23m-7-6 7 6-7 6 M29 23H6m7-6-7 6 7 6"/>',
    network:'<circle cx="7" cy="16" r="4"/><circle cx="25" cy="7" r="4"/><circle cx="25" cy="25" r="4"/><path d="m11 14 10-5m-10 9 10 5"/>',
    chart:'<path d="M4 4v24h24 M8 22h4v-7H8z M15 22h4V9h-4z M22 22h4V5h-4z"/>',
    quote:'<path d="M5 21c0-7 2-11 8-14l2 3c-3 2-5 4-5 7h5v9H5z M19 21c0-7 2-11 8-14l2 3c-3 2-5 4-5 7h5v9H19z"/>',
    file:'<path d="M3 8h10l3 3h13v14H3z M3 15h26"/>',
    clock:'<circle cx="16" cy="16" r="12"/><path d="M16 8v9l6 4"/>',
    building:'<path d="M5 28h22M7 28V7l13-3v24 M20 12h5v16 M11 11h3m-3 5h3m-3 5h3"/>',
    receipt:'<path d="M7 3l3 2 3-2 3 2 3-2 3 2 3-2v26l-3-2-3 2-3-2-3 2-3-2-3 2z M11 10h10m-10 5h7m-7 5h10"/>',
    ledger:'<rect x="5" y="4" width="23" height="24" rx="2"/><path d="M10 4v24M14 10h10m-10 6h10m-10 6h10m-4-12v12"/>',
    shield:'<path d="m16 3 11 4v9c0 6-5 10-11 14C9 26 5 22 5 16V7z m-6 13 4 4 8-8"/>',
    map:'<path d="m3 7 8-3 10 3 8-3v21l-8 3-10-3-8 3z M11 4v21 M21 7v21"/>',
    port:'<circle cx="16" cy="7" r="3"/><path d="M16 10v17M10 14h12 M4 19c1 6 7 9 12 9s11-3 12-9 M3 22l1-4 4 2m16 0 4-2 1 4"/>',
    contract:'<path d="M6 3h13l6 6v11 M19 3v7h6M6 3v25h9 M10 14h9m-9 4h5 M16 26l2-5 8-8 3 3-8 8z"/>',
    fiber:'<path d="M3 8h8c4 0 5 16 10 16h8 M3 16h26 M3 24h8c4 0 5-16 10-16h8"/>'
  };
  const iconAliases = {audit:'magnifier',decision:'gavel',fund:'money',cost:'money',account:'money',agency:'cityhall',van:'transit',order:'document',remedy:'transfer',date:'calendar',closure:'gavel',program:'file',information:'document',search:'magnifier'};
  function pictogramPath(name) {
    return pictograms[iconAliases[name] || name] || pictograms.document;
  }
  function plateIcon(name) {
    const path = pictogramPath(name);
    return '<svg class="plate-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }
  function subjectIcon(v, c) {
    const actor = (c.actors || []).find(a => a.name?.toLowerCase() === String(v.label || '').toLowerCase());
    if (actor?.type === 'person') return 'person';
    if (v.art && !['contract','magnifier','question','building'].includes(v.art)) return v.art;
    const label = [v.label, v.kicker, c.category, c.title].filter(Boolean).join(' ');
    if (/\b(airport|sfo|aviation)\b/i.test(label)) return 'travel';
    if (/\b(caltrain|bart|transit|rail|muni|train|escalator|station)\b/i.test(label)) return 'transit';
    if (/\b(health|medical|hospital|medicare|hospice|patient|hiv)\b/i.test(label)) return 'health';
    if (/\b(school|college|education|sfusd|teacher)\b/i.test(label)) return 'education';
    if (/\b(housing|rent|landlord|tenants?|apartment|foreclosure)\b/i.test(label)) return 'housing';
    if (/\b(permits?|permitting|building inspection)\b/i.test(label)) return 'permit';
    if (/\b(computer|software|information technology|broadband|telecom)\b/i.test(label)) return 'technology';
    if (/\b(construction|builder|retrofitting)\b/i.test(label)) return 'construction';
    if (/\b(water|wastewater|sewer|reservoir)\b/i.test(label)) return 'water';
    return v.art || 'document';
  }
  function comparisonUnit(value) {
    const m = /^\s*(\$)?(-?[\d,]+(?:\.\d+)?)\s*(million|billion|thousand|[KMB]|%)?\s*$/i.exec(String(value));
    if (!m) return null;
    const multiplier = {k:1e3,thousand:1e3,m:1e6,million:1e6,b:1e9,billion:1e9};
    const unit = m[1] ? 'USD' : m[3] === '%' ? 'percent' : 'count';
    const amount = Number(m[2].replace(/,/g,'')) * (multiplier[(m[3] || '').toLowerCase()] || 1);
    return Number.isFinite(amount) && amount >= 0 ? {unit, amount} : null;
  }
  const plateTitle = text => text ? '<h2>' + esc(text) + '</h2>' : '';
  const plateNote = text => text ? '<p class="plate-note">' + esc(text) + '</p>' : '';
  const plateHeader = (icon, kicker) => kicker ? '<div class="plate-kicker">' + plateIcon(icon) + '<span>' + esc(kicker) + '</span></div>' : '';
  const row = (name, value, icon, detail) => ({name,value,icon,detail});
  function listPlate(title, rows, options = {}) {
    const values = rows.map(r => comparisonUnit(r.value));
    const drawBars = options.bars && rows.length > 1 && values.every(x => x && x.unit === values[0].unit);
    const max = drawBars ? Math.max(...values.map(v => v.amount)) : 0;
    const pages = []; let page = [], load = 0;
    for (const [i, r] of rows.entries()) {
      const weight = 1 + Math.floor((String(r.name || '').length + String(r.value || '').length + String(r.detail || '').length) / 86);
      if (page.length && (load + weight > 4 || page.length === 3)) { pages.push(page); page = []; load = 0; }
      const bar = max > 0 ? '<div class="plate-bar" aria-hidden="true"><svg viewBox="0 0 100 3" preserveAspectRatio="none"><rect width="' + (100 * values[i].amount / max).toFixed(3) + '" height="3" fill="#217168"/></svg></div>' : '';
      page.push('<li><div class="plate-row-body"><span class="plate-row-glyph">' + plateIcon(r.icon || options.icon || 'document') + '</span><div class="plate-row-main"><strong>' + esc(r.name) + '</strong>' + plateNote(r.detail) + '</div><b class="plate-row-value">' + esc(r.value ?? '') + '</b></div>' + bar + '</li>');
      load += weight;
    }
    if (page.length) pages.push(page);
    if (options.singlePage) return plateTitle(title) + '<ol class="plate-rows">' + pages.flat().join('') + '</ol>';
    return plateTitle(title) + '<div class="plate-pages">' + pages.map((items,i) => '<div class="plate-page"' + (i ? ' hidden' : '') + '><ol class="plate-rows">' + items.join('') + '</ol></div>').join('') + '</div>' + (pages.length > 1 ? '<span class="plate-pagenum"></span>' : '');
  }
  function feature(v, icon, title, detail, chip) {
    const accent = chip ? '<b class="plate-chip">' + esc(chip) + '</b>' : '';
    return '<div class="plate-feature"><div class="plate-emblem">' + plateIcon(icon) + '</div><div>' + plateTitle(title) + plateNote(detail) + accent + '</div></div>';
  }
  function trendPlate(v,c) {
    const series = (v.series || [0]).map(i => c.trajectory?.series?.[i]).filter(s=>s?.points?.length);
    if (!series.length) return plateTitle(v.kicker || c.title);
    const periods = [...new Set(series.flatMap(s=>s.points.map(p=>p.period)))].sort((a,b)=>String(a).localeCompare(String(b),'en',{numeric:true}));
    const values = series.flatMap(s=>s.points.map(p=>p.value).filter(Number.isFinite));
    const low = Math.min(0,...values), high = Math.max(0,...values), range = Math.max(1,high-low);
    const x = i => 22+478*i/Math.max(1,periods.length-1);
    const y = n => 195-165*(n-low)/range;
    const labels = (value,unit) => String(unit).toLowerCase().includes('percent') ? value+'%' : fmtV(value,unit);
    const legend = [];
    const names = series.map(s => String(s.label || '').split(/\s+/));
    // The chart heading supplies the common measure; the legend identifies the compared groups.
    if (names.length > 1) {
      while (names.every(n => n.length > 1 && n[n.length-1] === names[0][names[0].length-1])) names.forEach(n => n.pop());
    }
    const pens = ['#0d635e','#945321','#475a94'];
    const traces=series.map((s,idx)=>{
      const points=new Map(s.points.filter(p=>Number.isFinite(p.value)).map(p=>[p.period,p.value]));
      const dates=periods.filter(t=>points.has(t));
      if(!dates.length)return '';
      const color=pens[idx%pens.length],first=dates[0],last=dates[dates.length-1];
      legend.push('<div><i style="background:'+color+'"></i><strong title="'+esc(s.label)+'">'+esc(names[idx].join(' '))+'</strong><p>'+esc(labels(points.get(first),s.unit))+' → '+esc(labels(points.get(last),s.unit))+'</p></div>');
      let open=false, path='';
      periods.forEach((t,i)=>{if(!points.has(t)){open=false;return;}path+=(open?' L':'M')+x(i).toFixed(2)+' '+y(points.get(t)).toFixed(2);open=true;});
      const dot=dates.map(t=>'<circle cx="'+x(periods.indexOf(t)).toFixed(2)+'" cy="'+y(points.get(t)).toFixed(2)+'" r="3.6" fill="'+color+'"/>').join('');
      return '<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="4"/>'+dot;
    }).join('');
    const grid=[30,112.5,195].map(n=>'<path d="M22 '+n+' H500" stroke="#a7b9b0" stroke-width="1.5"/>').join('');
    return '<div class="plate-trend"><div><div class="plate-axis"><span>'+esc(labels(high,series[0].unit))+'</span></div><svg viewBox="0 0 522 220" aria-hidden="true">'+grid+traces+'</svg><div class="plate-axis"><span>'+esc(periods[0])+'</span><span>'+esc(periods[periods.length-1])+'</span></div></div><div class="plate-legend">'+legend.join('')+'</div></div>';
  }
  let savedBoundaryData, savedMap;
  function mapBase() {
    const g=window.FD_SF_GEO;
    if(!g?.nb) return null;
    if(savedBoundaryData===g) return savedMap;
    const areas=Object.entries(g.nb).filter(([name])=>name!=='Treasure Island');
    const coords=areas.flatMap(([,rings])=>rings.flat());
    if(!coords.length) return null;
    const lon=coords.map(p=>p[0]), lat=coords.map(p=>p[1]);
    const minX=Math.min(...lon),maxX=Math.max(...lon),minY=Math.min(...lat),maxY=Math.max(...lat);
    const cos=Math.cos(37.76*Math.PI/180),scale=Math.min(310/((maxX-minX)*cos),340/(maxY-minY));
    const project=(xy)=>[180+(xy[0]-(maxX+minX)/2)*cos*scale,182-(xy[1]-(maxY+minY)/2)*scale];
    savedMap={project,paths:areas.map(([name,rings])=>[name,rings.map(r=>r.map((p,i)=>(i?'L':'M')+project(p).map(n=>n.toFixed(1)).join(',')).join('')+'Z').join(' ')])};
    savedBoundaryData=g;
    return savedMap;
  }
  function placePlate(v,c,b) {
    const map=mapBase(), pins=v.pins || [], places=window.FD_SF_GEO?.places || {};
    const place=pins[0], name=place?.name || v.hoodLabel || v.hood;
    if(!map) return feature(v,'building',name || c.title,place?.sub || b.text);
    const land=map.paths.map(([label,path])=>'<path d="'+path+'" fill="'+(label===v.hood?'#e4b45c':'#aec7b9')+'" stroke="#345850" stroke-width="1.1"/>').join('');
    const points=pins.map(p=>{
      const loc=places[p.place] || p;
      if(!Number.isFinite(loc.lon)||!Number.isFinite(loc.lat))return '';
      const [x,y]=map.project([loc.lon,loc.lat]);return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="9" fill="#b4512d" stroke="#fff9e9" stroke-width="3"/>';
    }).join('');
    return '<div class="plate-place"><svg viewBox="0 0 360 365" aria-hidden="true">'+land+points+'</svg><div>'+plateTitle(name || c.title)+plateNote(place?.sub || (v.hood && v.hoodLabel && v.hood!==v.hoodLabel ? v.hood : ''))+'<small>DataSF neighborhoods · © OpenStreetMap contributors</small></div></div>';
  }
  function annualBars(v) {
    const groups=(v.orgs || []).map(o=>{
      const pay=(o.city || []).map(([period,amount])=>row(period,amount,'money'));
      return '<div class="plate-page" hidden>'+listPlate(o.name,pay,{bars:true,singlePage:true})+'<p class="plate-loan">'+esc(['PPP loan',o.loan,o.approved].filter(Boolean).join(' · '))+(o.forgiven?' · Forgiven '+esc(o.forgiven):'')+'</p></div>';
    });
    return '<div class="plate-pages">'+groups.join('')+'</div>'+(groups.length>1?'<span class="plate-pagenum"></span>':'');
  }

  function plateFor(b, c, opening) {
    const v = b.visual || {}, type = v.type || 'passage', src = sourcesFor(b, c)[0] || {};
    const note = b.text || '', cat = c.category || '', icon = subjectIcon(v,c);
    let heading = v.kicker || '', glyph = icon, style = 'feature', body = '';
    if (type === 'scene') {
      body = feature(v,icon,v.label || v.text || note,v.sub,[v.chip,v.stamp].filter(Boolean).join(' · ')); heading ||= cat;
    } else if (type === 'hook' || type === 'slam' || type === 'title') {
      heading = v.sub || cat; body = feature(v,icon,(v.words || []).join(' ') || c.title);
    } else if (type === 'bignum' || type === 'count') {
      style='metric'; glyph = String(v.value).includes('$') ? 'money' : 'chart'; heading ||= cat;
      body = '<div class="plate-metric"><span>' + plateIcon(glyph) + '</span><div><strong>' + esc(v.value) + '</strong>' + plateTitle(v.label || v.line) + plateNote(v.sub) + '</div></div>';
    } else if (type === 'doc' || type === 'headline') {
      style='document'; glyph=docTypeIcon(src,heading); heading = src.publisher || v.kicker || cat;
      const text=v.text || src.title || note, markAt = v.mark ? text.indexOf(v.mark) : -1;
      const marked=markAt<0 ? esc(text) : esc(text.slice(0,markAt))+'<mark>'+esc(v.mark)+'</mark>'+esc(text.slice(markAt+v.mark.length));
      body = '<article class="paper plate-paper"><div class="plate-document-meta">'+plateIcon(glyph)+'<span>'+esc(v.date || src.date || '')+'</span></div><h2>'+marked+'</h2>'+plateNote(src.title !== text ? src.title : '')+'</article>';
    } else if (type === 'record' || type === 'rank' || type === 'form' || type === 'compare') {
      style = 'table'; glyph = type==='rank' ? 'chart' : (v.layout==='flow'?'transfer':v.layout==='timeline'?'calendar':'document');
      heading=v.context || v.kicker || cat;
      const rows=(v.rows || []).map(r => Array.isArray(r) ? row(r[0],r[1],glyph) : row(r.label,r.value ?? r.event,r.icon || glyph));
      body = '<section>' + listPlate(v.heading || v.title || v.label,rows,{bars:type==='rank' || v.layout==='amounts'})+'</section>';
    } else if (type === 'chain' || type === 'span' || type === 'versus') {
      style='sequence'; glyph=type==='span'?'calendar':type==='chain'?'network':'transfer'; heading ||= cat;
      const stops = type==='span' ? [[v.from,v.fromLab,'calendar'],[v.to,v.toLab,'calendar']] : type==='chain' ? (v.steps || []).map(s=>[s.name,[s.sub,s.late].filter(Boolean).join(' · '),s.art]) : [v.a || [],v.b || []].map(s=>[s[0],s[1],glyph]);
      body = '<div class="plate-sequence" style="--stops:'+stops.length+'">'+stops.map((s,i)=>'<article>'+plateIcon(s[2] || glyph)+plateTitle(s[0])+plateNote(s[1])+(i<stops.length-1 && type!=='versus'?'<i aria-hidden="true">→</i>':'')+'</article>').join('')+'</div>'+plateNote(type==='span' && v.days ? [v.days,Number(v.days)===1 ? (v.unit || 'days').replace(/s$/,'') : v.unit || 'days'].join(' ') : v.mid);
    } else if (type === 'quote' || type === 'caveat' || type==='explain') {
      style='statement'; glyph=type==='caveat'?'magnifier':'document'; heading ||= type==='caveat'?tierTag(c.tier):cat;
      body='<div class="plate-statement">'+plateIcon(glyph)+plateTitle(v.line || note)+plateNote(v.sub)+'</div>';
    } else if (type === 'unknowns' || type === 'settle') {
      style='table'; glyph=type==='unknowns'?'gap':'magnifier'; heading=type==='unknowns'?'Not established':'Records to request';
      body=listPlate('',(v.cards || []).map(r => typeof r==='string'?row(r,'',glyph):row(r.what,r.who,glyph)));
    } else if (type==='status' || type==='end') {
      style='closing'; heading=tierTag(c.tier); glyph='file';
      body=type==='status' ? plateTitle(c.status || note) : plateTitle(c.title)+'<div class="plate-actions"><button type="button" data-act="replay">Play again</button><button type="button" data-act="close">Read the case file</button></div>';
    } else if (type==='line' || type==='sfmap' || type==='bars') {
      style = type==='line' ? 'trend' : type==='sfmap' ? 'place' : 'table';
      glyph = type==='sfmap' ? 'building' : 'chart';
      heading ||= type==='bars' ? 'City payments by fiscal year' : cat;
      if (type==='line') body = trendPlate(v,c);
      if (type==='sfmap') body = placePlate(v,c,b);
      if (type==='bars') body = annualBars(v);
    } else if (type==='clock' || type==='share') {
      style='metric'; glyph=type==='clock'?'clock':'chart'; heading ||= cat;
      const share=type==='clock'?Number(v.hours)/24:Number(v.pct)/100, main=type==='clock'?String(v.hours):String(v.pct)+'%';
      body='<div class="plate-metric"><div class="plate-dial" style="--share:'+Math.max(0,Math.min(1,share))*100+'%">'+plateIcon(glyph)+'</div><div><strong>'+esc(main)+'</strong>'+plateTitle(v.label)+plateNote(v.sub)+'</div></div>';
    } else {
      style='passage'; heading=cat; body=feature(v,icon,note || c.title);
    }
    if (opening && ['scene','bignum','count','quote','slam'].includes(type) && c.title !== v.label) heading = c.title;
    return {type,style,layout:v.layout,html:plateHeader(glyph,heading)+'<div class="plate-body">'+body+'</div>'};
  }
  const plateKinds = new Set(['scene','bignum','count','hook','slam','title','doc','headline','record','rank','form','compare','chain','span','versus','quote','caveat','explain','unknowns','settle','status','end','clock','share','sfmap','line','bars']);
  function editorialShot(bs,c,k) {
    const el = node('<div class="s6 fd-slide"><div class="plate-frame"></div></div>'), frame = el.firstChild;
    const keys = bs.map(b => JSON.stringify(b.visual || {}) + (b.visual?.type ? '' : b.text));
    const oneVisual = keys.every(key => key === keys[0]);
    let lastIndex = -1, pageIndex = -1, pages = [], pageLabel, lastKey = '';
    function paint(b) {
      const plate=plateFor(b,c,k===0);
      el.className = ['s6','fd-slide','plate-'+plate.style,plate.type==='doc'?'s6-doc':'',plate.type==='record'?'s6-record':'',el.classList.contains('in')?'in':''].filter(Boolean).join(' ');
      el.dataset.kind=plate.type; el.dataset.graphics='evidence';
      if (plate.layout) el.dataset.layout=plate.layout; else delete el.dataset.layout;
      frame.innerHTML=plate.html;
      pages=Array.from(frame.querySelectorAll('.plate-page')); pageLabel=frame.querySelector('.plate-pagenum'); pageIndex=-1;
    }
    function fit() {
      const body=frame.querySelector('.plate-body');
      // On a 390px display a 38px stage label reads at about 12px. Start considerably larger;
      // shrink dense records only when a real browser reports a collision with the subtitle area.
      if (!body?.clientHeight) return;
      let scale=1; frame.style.setProperty('--text-fit','1');
      while ((body.scrollHeight>body.clientHeight+2 || body.scrollWidth>body.clientWidth+2) && scale>.70) {
        scale-=.04; frame.style.setProperty('--text-fit',scale.toFixed(2));
      }
    }
    function update(st) {
      const i=Math.min(Math.max(0,st.i || 0),bs.length-1),b=bs[i];
      if(lastIndex!==i){
        const key=keys[i];
        if(key!==lastKey){paint(b);lastKey=key;}
        if(!pages.length) fit();
        lastIndex=i;
      }
      if(pages.length) {
        // Continued beats with identical visuals share page time. An authored change begins a new table.
        const phase=bs.length>1 && oneVisual ? st.lt/Math.max(.2,st.dur) : st.bp;
        const next=Math.min(pages.length-1,Math.floor(Math.max(0,phase || 0)*pages.length));
        if (next !== pageIndex) {
          pages.forEach((p,k) => { p.hidden = k !== next; p.classList.toggle('in', k === next); });
          if (pageLabel) pageLabel.textContent = (next + 1) + ' / ' + pages.length;
          pageIndex = next;
          fit();
        }
      }
    }
    paint(bs[0]); lastKey=keys[0]; return {el,update};
  }

  window.FD_FILM6 = {
    sourcesFor, kinds: Object.keys(K), looks: ['midnight', ...Object.keys(BG)],
    shot(bs, c, k) {
      const type = bs[0].visual?.type;
      if (plateKinds.has(type) || !K[type] || (type === 'sfmap' && !Object.keys(window.FD_SF_GEO?.nb || {}).length)) return editorialShot(bs,c,k);
      const shot = K[type](bs,c,k);
      shot.el.classList.add('fd-chart');
      shot.el.dataset.graphics = 'chart';
      shot.el.dataset.kind = type;
      return shot;
    },
    bg(look) { return BG[look] ? BG[look]() : null; },
    SFX: { record: 'tick', hook: 'whoosh', count: 'thud', title: 'whoosh', program: 'tick', doc: 'tick', drop: 'thud', flow: 'tick', match: 'tick', dots: 'tick', versus: 'thud', bars: 'thud', timeline: 'tick', redact: 'thud', quote: 'tick', explain: 'tick', unknowns: 'tick', settle: 'tick', status: 'tick', end: 'chime',
      swarm: 'tick', map: 'tick', columns: 'thud', line: 'tick', clock: 'thud', slam: 'thud', rank: 'tick', headline: 'thud', window: 'tick', form: 'tick', share: 'thud', network: 'tick', log: 'tick', bignum: 'thud', scene: 'tick', span: 'tick', chain: 'tick', sfmap: 'tick' },
  };
})();
