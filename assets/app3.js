/* SF Money Trail — topics. One list (scripts/desks.py → FD_CORE.desks) places every page under a topic; this module draws
   the Topics page, each topic's landing page, the side menu that appears on every page inside a topic, and the generic
   screen pages (each group's screen output → FD_SCREENS). Loaded before app.js, which hands over its helpers. */
(() => {
  'use strict';
  let C, esc, money, full, tier, head, after, need, byId, slugOf, fmtDate, caseCard, S, rerender;
  const DEFAULT = { money: 'money/gifts', contracts: 'contracts/line', outcomes: 'outcomes/results', health: 'health/clusters', screens: 'screens/insider' };
  const where = {};                       // page hash -> [[desk, index], …]
  let last = '';                          // the topic the reader came through, so a page listed twice keeps the right menu
  const Y = window.FDY = {
    init(a) {
      ({ C, esc, money, full, tier, head, after, need, byId, slugOf, fmtDate, caseCard, S, rerender } = a);
      [...(C.desks || []), C.lookup].filter(Boolean).forEach(d => d.pages.forEach((p, i) => (where[p[0]] = where[p[0]] || []).push([d, i])));
    },
  };
  const num = v => Math.round(v).toLocaleString('en-US');
  const TIERS = ['PROVEN', 'CHARGED', 'OFFICIAL', 'REDFLAG'];
  const deskById = id => (C.desks || []).find(d => d.id === id);
  const deskOfCase = c => (C.desks || []).find(d => d.cases.includes(c.id));
  const canon = (r, a) => { const h = a ? `${r}/${a}` : r; return where[h] ? h : where[DEFAULT[r]] && !a ? DEFAULT[r] : where[r] && (r === 'trace' || r === 'orgs') ? r : h; };
  const dot = t => t ? `<i class="dn-dot ${esc(t)}" title="${t === 'OFFICIAL' ? 'Official finding' : 'Lead'}"></i>` : '';
  const TABBED = { outcomes: 1, money: 1, contracts: 1, health: 1, screens: 1 };
  const STATUS = { run: ['Tested', 'done'], partly: ['Partly tested', 'part'], 'not yet': ['Not yet tested', 'todo'] };

  /* ---------- the frame: breadcrumb, side menu and next-page link around any page that sits in a topic ---------- */
  Y.navOf = (r, a) => r === 'topics' || r === 'topic' || r === 's' ? 'topics' : ['orgs', 'org', 'trace', 'who', 'connections', 'search', 'officials', 'official'].includes(r) ? 'orgs' : ['case', 'patterns', 'pattern'].includes(r) ? 'cases' : (where[canon(r, a)] || []).some(([d]) => d.id !== 'lookup') ? 'topics' : null;
  Y.frame = (r, a, html) => {
    if (r === 'topic') last = a;
    if (r === 'case' && byId[a]) { const d = deskOfCase(byId[a]), w = byId[a].reel ? `<a class="crumb-watch" href="#watch/${encodeURIComponent(a)}">← Back to the films</a>` : '';
      if (d) html = html.replace('<p class="small"><a href="#cases">← All cases</a></p>', '');          // the crumb below already leads back to the list
      return (d || w ? `<nav class="crumb" aria-label="Breadcrumb">${w}${d ? `<a href="#cases">All cases</a><span>›</span><a href="#topic/${d.id}">${esc(d.title)}</a>` : ''}</nav>` : '') + html; }
    const hits = where[canon(r, a)]; if (!hits) return html;
    const [d, i] = hits.find(([x]) => x.id === last) || hits[0]; const look = d.id === 'lookup'; if (!look) last = d.id;
    if (TABBED[r] && !d.pages[i][2]) html = html.replace(/<div class="page-h"><div class="eyebrow">[\s\S]*?<\/h1>/, `<div class="page-h"><div class="eyebrow">${esc(d.title)}</div><h1>${esc(d.pages[i][1])}</h1>`);   // description not loaded: keep the page's own
    else if (TABBED[r]) html = html.replace(/<div class="page-h">[\s\S]*?<\/h1>(?:<p class="lede">[\s\S]*?<\/p>)?<\/div>/, head(d.title, esc(d.pages[i][1]), esc(d.pages[i][2])));
    const crumb = look ? '' : `<nav class="crumb" aria-label="Breadcrumb"><a href="#topics">Topics</a><span>›</span><a href="#topic/${d.id}">${esc(d.title)}</a></nav>`;
    const menu = `<aside class="desk-nav"><div class="dn-h">${look ? 'Look up' : `<a href="#topic/${d.id}">${esc(d.title)}</a>`}</div><ul>${d.pages.map((p, j) => `<li${p[4] ? ' class="sub"' : ''}><a href="#${p[0]}" ${j === i ? 'aria-current="page"' : ''}>${esc(p[1])}</a></li>`).join('')}</ul>${look ? '' : '<a class="dn-all" href="#topics">← All topics</a>'}</aside>`;
    const prev = d.pages[i - 1], next = d.pages[i + 1];
    const foot = look ? '' : `<nav class="desk-foot" aria-label="More in this topic">${prev ? `<a href="#${prev[0]}"><small>Previous</small>← ${esc(prev[1])}</a>` : '<span></span>'}${next ? `<a class="nx" href="#${next[0]}"><small>Next in ${esc(d.title)}</small>${esc(next[1])} →</a>` : `<a class="nx" href="#topic/${d.id}"><small>End of this topic</small>Back to ${esc(d.title)} ↑</a>`}</nav>`;
    after.push(() => { const cur = document.querySelector('.desk-nav [aria-current]'), ul = cur && cur.closest('ul'), box = cur && cur.closest('.desk-nav'); if (!cur) return; ul.scrollLeft = cur.offsetLeft - ul.clientWidth / 2 + cur.offsetWidth / 2; box.scrollTop = cur.offsetTop - box.clientHeight / 2; });
    return `<div class="desk">${menu}<div class="desk-main">${crumb}${html}${foot}</div></div>`;
  };

  /* ---------- Topics: the hub ---------- */
  const tierCounts = t => TIERS.filter(k => t[k]).map(k => `<span class="tc ${k}" title="${k === 'REDFLAG' ? 'Leads' : k === 'OFFICIAL' ? 'Official findings' : k === 'CHARGED' ? 'Charged' : 'Proven'}">${t[k]}</span>`).join('');
  const schemeOf = id => ((C.plan || {}).schemes || []).find(s => s.id === id);
  const deskCard = d => {
    const top = d.cases.map(id => byId[id]).filter(Boolean)[0], sc = d.schemes.map(schemeOf).filter(Boolean), found = sc.find(s => s.status === 'run');
    return `<a class="card desk-card" href="#topic/${d.id}"><h3>${esc(d.title)}</h3><p>${esc(d.blurb)}</p>
      ${top ? `<div class="dc-top">${tier(top.tier)}<span>${esc(top.title)}</span></div>` : found ? `<div class="dc-top"><span>${esc(found.found.split('. ')[0].replace(/\.$/, ''))}.</span></div>` : ''}
      <div class="dc-meta">${d.cases.length ? `<span class="tcs">${tierCounts(d.tiers)}</span><span>${d.cases.length} case file${d.cases.length === 1 ? '' : 's'}</span>` : ''}<span>${d.pages.length} page${d.pages.length === 1 ? '' : 's'} of records</span></div></a>`;
  };
  Y.topicsGrid = () => (C.deskSections || []).map(([k, t]) => { const ds = C.desks.filter(d => d.section === k); return ds.length ? `<section class="section"><h2>${esc(t)}</h2><div class="grid desks">${ds.map(deskCard).join('')}</div></section>` : ''; }).join('');
  Y.topics = () => `${head('Topics', 'Pick a thread', 'Every page on this site sits under one of these topics. Each card shows the strongest thing found there and how sure we are. Coloured counts are case files by level of proof.')}
    <div class="tier-key">${TIERS.map(t => tier(t, true)).join('')}</div>${Y.topicsGrid()}
    <section class="section"><h2>Or start from a name or a place</h2><div class="hero-cta"><a class="btn" href="#orgs">Look up an organization</a><a class="btn" href="#trace">Follow one name through every channel</a><a class="btn" href="#map">Open the map</a><a class="btn" href="#plan">See every test and its status</a></div></section>`;

  /* ---------- one topic ---------- */
  Y.topic = id => {
    const d = deskById(id); if (!d) return null;
    const cs = d.cases.map(i => byId[i]).filter(Boolean), sc = d.schemes.map(schemeOf).filter(Boolean);
    const link = l => `<a class="btn sm" href="${esc(l[0])}">${esc(l[1])}</a>`;
    return `<nav class="crumb" aria-label="Breadcrumb"><a href="#topics">Topics</a><span>›</span><span>${esc(d.title)}</span></nav>${head('Topic', esc(d.title), esc(d.blurb))}
      ${cs.length ? `<section class="section"><h2>Start with these</h2><p class="sub">The strongest case files in this topic. The numbered box on each card is the single record to look at first.</p><div class="grid cards">${cs.slice(0, 3).map(caseCard).join('')}</div></section>` : ''}
      ${sc.length ? `<section class="section"><h2>What was tested, and what turned up</h2><p class="sub">Each row is one way money goes wrong, the test run for it, and the result this edition.</p><div class="schemes">${sc.map(s => `<article class="card scheme-row"><div class="sr-h"><span class="st st-${STATUS[s.status][1]}">${STATUS[s.status][0]}</span><h3>${esc(s.name)}</h3></div><p class="muted">${esc(s.how)}</p><p><b>Found:</b> ${esc(s.found)}</p><div class="links-row">${s.links.slice(0, 4).map(link).join('')}</div></article>`).join('')}</div></section>` : ''}
      <section class="section"><h2>Every page of records in this topic</h2><ol class="page-list">${d.pages.map(p => `<li><a href="#${p[0]}"><b>${esc(p[1])}</b><span>${p[3] ? stier(p[3]) + ' ' : ''}${esc(p[2])}</span></a></li>`).join('')}</ol></section>
      ${cs.length > 3 ? `<section class="section"><h2>All ${cs.length} case files</h2><ul class="case-lines">${cs.map(c => `<li>${tier(c.tier)}<a href="#case/${esc(c.id)}">${esc(c.title)}</a></li>`).join('')}</ul></section>` : ''}`;
  };

  /* ---------- generic screens ---------- */
  const unitFmt = u => v => v == null || v === '' ? '—' : u === 'usd' ? money(v) : u === 'pct' ? (Math.abs(v) <= 1.5 ? (Math.abs(v) < .1 && v !== 0 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%' : Math.round(v) + '%') : u === 'times' ? (+v).toFixed(1) + '×' : u === 'days' ? num(v) + ' days' : typeof v === 'number' ? (Math.abs(v) < 10 && v % 1 ? v.toFixed(1) : num(v)) : String(v);
  const NUMERIC = { usd: 1, int: 1, pct: 1, times: 1, days: 1 };
  const cell = (c, r) => {
    const v = r[c.k]; if (v == null || v === '') return '<span class="muted">—</span>';
    if (c.type === 'org') return r[c.k + 'Key'] ? `<a href="#org/${esc(slugOf(r[c.k + 'Key']))}"><b>${esc(v)}</b></a>` : `<b>${esc(v)}</b>`;
    if (c.type === 'person') return `<b>${esc(v)}</b>`;
    if (c.type === 'link') return v && v.u ? (/^#/.test(v.u) ? `<a href="${esc(v.u)}">${esc(v.t || 'Open')}</a>` : /^https?:\/\//.test(v.u) ? `<a href="${esc(v.u)}" target="_blank" rel="noopener">${esc(v.t || 'Source')} ↗</a>` : esc(v.t || '')) : esc(typeof v === 'string' ? v : '');
    if (c.type === 'usd') return `<span title="${esc(full(v))}">${esc(money(v))}</span>`;
    if (c.type === 'date') return esc(fmtDate(v));
    if (NUMERIC[c.type]) return typeof v === 'number' ? esc(unitFmt(c.type)(v)) : esc(v);
    return esc(v);
  };
  const plain = (c, r) => { const v = r[c.k]; return v && typeof v === 'object' ? (v.t || '') : v == null ? '' : String(v); };
  const st = { key: '', sort: null, dir: -1, q: '' };
  function tableHtml(s) {
    let rows = s.rows; const q = st.q.trim().toLowerCase();
    if (q) rows = rows.filter(r => s.columns.some(c => plain(c, r).toLowerCase().includes(q)));
    if (st.sort) { const c = s.columns.find(x => x.k === st.sort); rows = [...rows].sort((a, b) => { const x = a[c.k], y = b[c.k]; return (NUMERIC[c.type] ? (x || 0) - (y || 0) : plain(c, a).localeCompare(plain(c, b))) * st.dir; }); }
    return `<div class="table-wrap"><table class="gen"><thead><tr>${s.columns.map(c => `<th class="${NUMERIC[c.type] ? 'num' : ''}" aria-sort="${st.sort === c.k ? (st.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${esc(c.k)}">${esc(c.t)}${st.sort === c.k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${s.columns.map(c => `<td class="${NUMERIC[c.type] ? 'num' : ''}">${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${rows.length ? '' : '<div class="empty">Nothing matches.</div>'}
      <p class="small muted">${q ? `${rows.length} of ${s.rows.length} rows match. ` : ''}${s.total > s.rows.length ? `Showing the strongest ${s.rows.length} of ${num(s.total)}.` : `${s.rows.length} row${s.rows.length === 1 ? '' : 's'}.`} Click a column heading to sort.</p>`;
  }
  function mountTable(s) {
    after.push(() => {
      const box = document.getElementById('gen-table'), inp = document.getElementById('gen-q'); if (!box) return;
      const draw = () => { box.innerHTML = tableHtml(s); box.querySelectorAll('[data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = NUMERIC[s.columns.find(c => c.k === k).type] ? -1 : 1; } draw(); }); };
      if (inp) inp.oninput = () => { st.q = inp.value; draw(); };
      draw();
    });
  }

  /* charts: one hue per series in a fixed order; text stays in ink; every mark has a tooltip */
  const SER = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
  const nice = max => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))), f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  function drawChart(el, ch) {
    const f = unitFmt(ch.unit), W = Math.max(320, el.clientWidth || 640), H = 250, scatter = ch.kind === 'scatter';
    const ser = ch.series.filter(s => s.points && s.points.length).slice(0, 4); if (!ser.length) return;
    const direct = !scatter && ser.length > 1 && W >= 600, m = { l: 54, r: direct ? Math.min(170, W * .2) : 16, t: 14, b: scatter ? 40 : 28 };
    const ys = ser.flatMap(s => s.points.map(p => +p.y)), ymax = nice(Math.max(...ys, 0) * 1.02), ymin = Math.min(0, ...ys);
    const Y0 = v => m.t + (H - m.t - m.b) * (1 - (v - ymin) / ((ymax - ymin) || 1));
    let X, xt = '';
    if (scatter) {
      const xs = ser.flatMap(s => s.points.map(p => +p.x)), x0 = Math.min(...xs), x1 = Math.max(...xs), pad = (x1 - x0) * .04 || 1;
      X = v => m.l + (W - m.l - m.r) * ((+v - (x0 - pad)) / ((x1 - x0) + 2 * pad));
      xt = [x0, (x0 + x1) / 2, x1].map(v => `<text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle" class="ax">${esc(unitFmt(ch.xUnit || (x1 <= 1.5 ? 'pct' : x1 > 5000 ? 'usd' : 'int'))(v))}</text>`).join('') + `<text x="${(m.l + W - m.r) / 2}" y="${H - 4}" text-anchor="middle" class="ax">${esc(ch.xLabel || '')}</text>`;
    } else {
      const xs = []; ser.forEach(s => s.points.forEach(p => { if (!xs.includes(String(p.x))) xs.push(String(p.x)); }));
      if (xs.every(v => /^\d{4}/.test(v))) xs.sort();
      const step = (W - m.l - m.r) / Math.max(1, xs.length - 1); X = v => xs.length === 1 ? (m.l + W - m.r) / 2 : m.l + step * xs.indexOf(String(v));
      const every = Math.ceil(xs.length / Math.max(2, Math.floor((W - m.l - m.r) / 54)));
      xt = xs.map((v, i) => i % every === 0 || i === xs.length - 1 ? `<text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle" class="ax">${esc(v.replace(/^FY20|^20(?=\d\d$)/, m0 => m0 === '20' ? "'" : 'FY'))}</text>` : '').join('');
    }
    const grid = [0, .25, .5, .75, 1].map(t => { const v = ymin + (ymax - ymin) * t; return `<line x1="${m.l}" x2="${W - m.r}" y1="${Y0(v)}" y2="${Y0(v)}" class="gr"/><text x="${m.l - 8}" y="${Y0(v) + 4}" text-anchor="end" class="ax">${esc(f(v))}</text>`; }).join('');
    const ends = [];
    const marks = ser.map((s, i) => {
      const pts = s.points.map(p => [X(p.x), Y0(+p.y), p]);
      const line = scatter ? '' : `<path d="M${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L')}" fill="none" stroke="${SER[i]}" stroke-width="2" stroke-linejoin="round"/>`;
      if (direct) ends.push([pts[pts.length - 1][1], s.label, i]);
      return line + pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${scatter ? 4.5 : 4}" fill="${SER[i]}" stroke="var(--surface)" stroke-width="2" ${scatter ? 'fill-opacity=".8"' : ''} tabindex="0" data-tip="${esc(`<b>${p[2].n || s.label}</b>${scatter ? `${ch.xLabel || 'x'}: ${unitFmt(ch.xUnit || 'int')(+p[2].x)} · ${ch.yLabel || 'y'}: ${f(+p[2].y)}` : `${p[2].x}: ${f(+p[2].y)}`}`)}"/>`).join('');
    }).join('');
    ends.sort((a, b) => a[0] - b[0]); for (let i = 1; i < ends.length; i++) if (ends[i][0] - ends[i - 1][0] < 14) ends[i][0] = ends[i - 1][0] + 14;
    const labels = ends.map(([y, l]) => `<text x="${W - m.r + 10}" y="${y + 4}" class="ax lb">${esc(l.length > 22 ? l.slice(0, 21) + '…' : l)}</text>`).join('');
    const ylab = scatter && ch.yLabel ? `<text x="${m.l}" y="10" class="ax">${esc(ch.yLabel)}</text>` : '';
    el.innerHTML = `${ser.length > 1 ? `<div class="lg">${ser.map((s, i) => `<span><i style="background:${SER[i]}"></i>${esc(s.label)}</span>`).join('')}</div>` : ''}<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(ch.title || '')}">${grid}${xt}${ylab}${marks}${labels}</svg>`;
    window.FDC.bindTips(el);
  }
  const chartHtml = (ch, id) => {
    if (!ch || !ch.series || !ch.series.some(s => s.points && s.points.length)) return '';
    const bars = ch.kind === 'bars', named = bars && ch.series.some(s => s.points.some(p => !/^(FY)?\d{2,4}([-/]\d{2})?$/.test(String(p.x)) && String(p.x).length > 7));
    if (named) { const f = unitFmt(ch.unit); return `<div class="card pad gen-chart"><div class="chart-h"><h3>${esc(ch.title || '')}</h3></div>${ch.series.map(s => { const mx = Math.max(1e-9, ...ch.series.flatMap(q => q.points.map(p => Math.abs(+p.y)))); return `${ch.series.length > 1 ? `<h4 class="hb-h">${esc(s.label)}</h4>` : ''}<div class="area-bars hb">${s.points.map(p => `<div class="ab"><span>${esc(p.x)}</span><div><i style="width:${100 * Math.abs(+p.y) / mx}%"></i></div><b>${esc(f(+p.y))}</b></div>`).join('')}</div>`; }).join('')}</div>`; }
    after.push(() => {
      if (bars) ch.series.forEach((s, i) => { const el = document.getElementById(`${id}-${i}`); if (el) window.FDC.columns(el, { label: s.label, points: s.points.map(p => ({ label: String(p.x), short: String(p.x).replace('FY20', 'FY').replace(/^20(\d\d)$/, "'$1"), value: +p.y })), fmt: unitFmt(ch.unit) }); });
      else { const el = document.getElementById(id); if (el) drawChart(el, ch); }
    });
    return `<div class="card pad gen-chart"><div class="chart-h"><h3>${esc(ch.title || '')}</h3></div>${bars ? `<div class="grid ${ch.series.length > 1 ? 'cols2' : ''}">${ch.series.map((s, i) => `<div>${ch.series.length > 1 ? `<p class="small muted">${esc(s.label)}</p>` : ''}<div class="chart" id="${id}-${i}"></div></div>`).join('')}</div>` : `<div class="chart linechart" id="${id}"></div>`}</div>`;
  };
  const sourcesHtml = list => list && list.length ? `<section class="section"><h2>Where this comes from</h2><ul class="src-list">${list.map(s => `<li>${s.u && /^https?:\/\//.test(s.u) ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t || s.u)} ↗</a>` : esc(s.t || '')}</li>`).join('')}</ul></section>` : '';
  const stier = (t, long) => tier(t || 'REDFLAG', long);
  const findingBox = s => `<div class="finding bar-${esc(s.tier || 'REDFLAG')}"><div>${stier(s.tier, true)}</div><p><b>What turned up.</b> ${esc(s.finding || '')}</p></div>`;

  Y.screen = async arg => {
    const [g, id] = String(arg || '').split('.'), G = (await need('screens'))[g]; if (!G) return null;
    if (!id) return groupPage(g, G);
    const s = G.screens.find(x => x.id === id); if (!s) return null;
    if (st.key !== arg) { st.key = arg; st.sort = null; st.q = ''; st.dir = -1; }
    mountTable(s);
    return `${head((C.screenGroups[g] || {}).title || 'Records', esc(s.title), esc(s.question || ''))}${findingBox(s)}${chartHtml(s.chart, 'gen-chart')}
      <div class="note how"><p><b>How this was worked out.</b> ${esc(s.how || '')}</p><p><b>What it cannot show.</b> ${esc(s.limits || '')}</p></div>
      ${s.rows && s.rows.length ? `<section class="section"><div class="filters">${s.rows.length > 10 ? `<label class="sr-only" for="gen-q">Filter the rows</label><input id="gen-q" type="search" placeholder="Filter these rows…" value="${esc(st.q)}">` : ''}</div><div id="gen-table"></div></section>` : ''}
      ${sourcesHtml(s.sources)}`;
  };
  function groupPage(g, G) {
    if ((G.clusters || []).length) after.push(() => document.querySelectorAll('.cl').forEach(n => window.FDC.bindTips(n)));
    const steps = G.steps || [], maxd = Math.max(1, ...steps.map(x => +x.medianDays || 0));
    const areas = (G.areas || []).filter(a => a.adjusted != null || a.nonApproval != null).sort((a, b) => (b.adjusted ?? b.nonApproval) - (a.adjusted ?? a.nonApproval)), amax = Math.max(.0001, ...areas.map(a => a.adjusted ?? a.nonApproval));
    return `${head('Records', esc(G.title || g), esc(G.lede || ''))}
      ${steps.length ? `<section class="section"><h2>The process, step by step</h2><p class="sub">A typical mid-size building job as the City's own records show it. The bar is the median number of days at that step; “needs first” lists what must already be in hand.</p><ol class="proc">${steps.map(x => `<li><span class="pin">${esc(x.n)}</span><div><h3>${esc(x.name)} <span class="tag">${esc(x.dept || '')}</span></h3><p>${esc(x.what || '')}</p>${(x.needsFirst || []).length ? `<p class="small muted">Needs first: ${x.needsFirst.map(n => `<span class="chip">${esc(n)}</span>`).join(' ')}</p>` : ''}</div><div class="pd">${x.medianDays != null ? `<b>${num(x.medianDays)}</b> days<i style="width:${Math.max(3, 100 * x.medianDays / maxd)}%"></i>` : ''}</div></li>`).join('')}</ol></section>` : ''}
      <section class="section"><h2>What the records show</h2><div class="grid find-grid">${G.screens.map(s => `<a class="card find-card bar-${esc(s.tier || 'REDFLAG')}" href="#s/${esc(g)}.${esc(s.id)}"><div class="row">${stier(s.tier)}</div><h3>${esc(s.title)}</h3><p>${esc(s.finding || s.question || '')}</p><span class="go">See the records →</span></a>`).join('')}</div></section>
      ${(G.clusters || []).length ? `<section class="section"><h2>The largest groups, drawn</h2><p class="sub">Each mark is a member: circles are organizations and firms, squares people, triangles addresses. Colour shows that member’s own standing: a party to a proven or charged case, the subject of an official finding, or a lead; grey means none. An organization that a case file only names keeps its own colour. A line is a recorded link, and being linked is not being involved. Hover or tab to a mark for its name and what is on record about it.</p><div class="grid cls">${G.clusters.slice(0, 12).map(clusterSvg).join('')}</div><div class="lg" style="margin-top:10px">${TIERS.map(t => `<span><i style="background:${TCOL[t]}"></i>${t === 'REDFLAG' ? 'Lead' : t === 'OFFICIAL' ? 'Official finding' : t === 'CHARGED' ? 'Charged' : 'Proven'}</span>`).join('')}<span><i style="background:var(--deemph)"></i>No sign</span></div></section>` : ''}
      ${areas.length ? `<section class="section"><h2>Neighbourhood by neighbourhood</h2><p class="sub">Share of proposals that did not end in approval, after adjusting for the mix of proposal types. Neighbourhoods with at least 50 cases. A difference between areas is not proof of bias: zoning, lot sizes and who applies all differ.</p><div class="area-bars">${areas.map(a => `<div class="ab"><span>${esc(a.name)}${a.district ? ` <small>D${esc(a.district)}</small>` : ''}</span><div><i style="width:${100 * (a.adjusted ?? a.nonApproval) / amax}%"></i></div><b>${unitFmt('pct')(a.adjusted ?? a.nonApproval)}</b><small>${num(a.n)} cases</small></div>`).join('')}</div></section>` : ''}
      ${(G.official || []).length ? `<section class="section"><h2>What official reviewers have already said</h2><ul class="off-list">${G.official.map(o => `<li>${tier('OFFICIAL')}<div><b>${esc(o.p || '')}${o.d ? ', ' + esc(fmtDate(o.d)) : ''}.</b> ${esc(o.said || '')} ${o.u && /^https?:\/\//.test(o.u) ? `<a href="${esc(o.u)}" target="_blank" rel="noopener">${esc(o.t || 'Source')} ↗</a>` : esc(o.t || '')}</div></li>`).join('')}</ul></section>` : ''}
      ${(G.toConfirm || []).length ? `<section class="section"><h2>Still to confirm</h2><p class="sub">What the data alone cannot settle, and which record would.</p><ul class="todo-list">${G.toConfirm.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
      ${sourcesHtml(G.sources)}`;
  }

  /* ---------- requested data: records we could not get, and how anyone can supply one ---------- */
  const wst = { q: '', p: 0 };
  const HOWS = [['browser', 'Open in a browser and save'], ['export', 'Export from a search page or dashboard'], ['account', 'Needs a free account'], ['request', 'Records request'], ['court', 'Court records'], ['not published', 'Not published']];
  const howKind = t => { const x = String(t || '').toLowerCase().split(':')[0]; return (HOWS.find(([k]) => x.includes(k)) || ['other'])[0]; };
  function wantedList(W) {
    const q = wst.q.trim().toLowerCase(); let shown = 0;
    const html = W.screens.map(s => {
      const rows = s.rows.filter(r => (!wst.p || r.priority === wst.p) && (!q || [r.what, r.why, r.how, (r.link || {}).t].join(' ').toLowerCase().includes(q))).sort((a, b) => (a.priority || 9) - (b.priority || 9));
      shown += rows.length; if (!rows.length) return '';
      return `<section class="section"><h2>${esc(s.title)}</h2><p class="sub">${esc(s.finding || '')}</p><ul class="want">${rows.map(r => `<li class="p${esc(r.priority || 3)}"><div class="w-h"><span class="w-p" title="Priority ${esc(r.priority || 3)}">${esc(r.priority || 3)}</span><b>${esc(String(r.what || '').split(': ')[0])}</b></div>
        ${String(r.what || '').includes(': ') ? `<p class="w-d">${esc(String(r.what).split(': ').slice(1).join(': '))}</p>` : ''}<p><b>Why:</b> ${esc(r.why || '')}</p><dl><dt>How to get it</dt><dd>${esc(r.how || '')}</dd><dt>Where</dt><dd>${r.link && r.link.u && /^https?:\/\//.test(r.link.u) ? `<a href="${esc(r.link.u)}" target="_blank" rel="noopener">${esc(r.link.t || r.link.u)} ↗</a>` : (howKind(r.how) === 'request' || howKind(r.how) === 'not published' ? 'Not online. Obtained only by a records request to the agency named under “How to get it”; for a San Francisco department the request can be filed at <a href="https://sanfrancisco.nextrequest.com/" target="_blank" rel="noopener">sanfrancisco.nextrequest.com</a> ↗' : 'No direct link: follow “How to get it” above.')}</dd></li>`).join('')}</ul></section>`;
    }).join('');
    return `<p class="small muted" id="want-n">${shown} record${shown === 1 ? '' : 's'} shown.</p>${html || '<div class="empty">Nothing matches.</div>'}`;
  }
  Y.wanted = async () => {
    const W = (await need('screens')).wanted; if (!W) return null;
    const all = W.screens.flatMap(s => s.rows), n = k => all.filter(r => howKind(r.how) === k).length, by = p => all.filter(r => r.priority === p).length;
    after.push(() => {
      const box = document.getElementById('want-list'), inp = document.getElementById('want-q'); if (!box) return;
      const draw = () => { box.innerHTML = wantedList(W); document.querySelectorAll('[data-wp]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.wp === wst.p))); };
      if (inp) inp.oninput = () => { wst.q = inp.value; draw(); };
      document.querySelectorAll('[data-wp]').forEach(b => b.onclick = () => { wst.p = +b.dataset.wp; draw(); });
      draw();
    });
    return `${head('Requested data', 'Records that would make this stronger', esc(W.lede || 'Public records this project asked for and could not collect, with where each one is and what it would settle.'))}
      <div class="grid g4 want-stats">${[[all.length, 'records wanted'], [by(1), 'would settle an open case or an untested scheme'], [n('browser') + n('export'), 'can be saved by anyone with a browser'], [n('request'), 'need a records request to the agency']].map(([v, l]) => `<div class="card stat"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('')}</div>
      <div class="note how"><p><b>How to get a record yourself.</b> This site does not host the raw data. Each record below says where it is published and how to get it. Most of these sites turn away automated collection but serve anyone using a browser: open the link and save the file. Where a record is not online, ask the agency named for it by a public records request (California Public Records Act; for San Francisco departments also the Sunshine Ordinance, through <a href="https://sanfrancisco.nextrequest.com/" target="_blank" rel="noopener">sanfrancisco.nextrequest.com</a>). Court records are on the court’s own docket or PACER.</p><p><b>What is not wanted.</b> Records about individual benefit recipients, patients or residents. Those are confidential and are not used here.</p></div>
      <div class="filters want-f"><label class="sr-only" for="want-q">Filter the list</label><input id="want-q" type="search" placeholder="Filter: pay, nursing, permit, court…" value="${esc(wst.q)}">
        ${[[0, 'All'], [1, 'Priority 1: settles a case or test'], [2, 'Priority 2: strengthens a finding'], [3, 'Priority 3']].map(([p, t]) => `<button class="chip" type="button" data-wp="${p}" aria-pressed="${p === wst.p}">${t}</button>`).join('')}</div>
      <div id="want-list"></div>
      <p class="small muted" style="margin-top:22px">A site that refuses automated collection has not refused the public; nothing here was obtained by getting around a block.</p>`;
  };

  /* ---------- officials: one page per elected official, from the officials screen's `profiles` ---------- */
  const staticTable = sec => `<div class="table-wrap"><table class="gen"><thead><tr>${sec.columns.map(c => `<th class="${NUMERIC[c.type] ? 'num' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${sec.rows.map(r => `<tr>${sec.columns.map(c => `<td class="${NUMERIC[c.type] ? 'num' : ''}">${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  Y.officials = async () => {
    const G = (await need('screens')).officials; if (!G || !(G.profiles || []).length) return null;
    return `${head('Look up', 'Officials', 'Each elected official since 2015 seen from their own side: what they sponsored and voted for, who benefited, and every recorded link back. Being connected is the normal state of city politics; the comparisons on each page say when a difference is more than chance.')}
      <div class="grid desks">${G.profiles.map(p => `<a class="card desk-card" href="#official/${esc(p.id)}"><h3>${esc(p.name)}</h3><p>${esc(p.role || '')}</p><div class="dc-meta">${(p.stats || []).slice(0, 3).map(x => `<span><b>${esc(x.v)}</b> ${esc(x.l)}</span>`).join('')}</div></a>`).join('')}</div>
      <p style="margin-top:18px"><a class="btn" href="#s/officials">The comparisons across all officials →</a></p>`;
  };
  Y.official = async id => {
    const G = (await need('screens')).officials, p = G && (G.profiles || []).find(x => x.id === id); if (!p) return null;
    return `<p class="small"><a href="#officials">← All officials</a></p>${head('Official', esc(p.name), esc(p.role || ''))}
      ${p.lede ? `<p class="lede" style="margin-bottom:16px">${esc(p.lede.replace(/^[^.]*as the files show\.\s*/, '') || p.lede)}</p>` : ''}
      ${(p.stats || []).length ? `<div class="grid g4" style="margin-bottom:8px">${p.stats.map(x => `<div class="card stat"><div class="v">${esc(x.v)}</div><div class="l">${esc(x.l)}</div></div>`).join('')}</div>` : ''}
      <div class="note how"><p><b>How to read this.</b> Donors give to officials who already agree with them, and a supervisor sponsors money for organizations in their own district as a matter of course. A link between a beneficiary and an official is a place to look, not a finding. Name matches are labelled.</p></div>
      ${(p.sections || []).filter(x => (x.rows || []).length).map(x => `<section class="section"><h2>${esc(x.title)}</h2>${x.finding ? `<p class="sub">${esc(x.finding)}</p>` : ''}${staticTable(x)}</section>`).join('')}`;
  };
  /* linked groups drawn as small networks: members on a ring, links as chords; shape by kind, fill by strength of evidence */
  const TCOL = { PROVEN: 'var(--proven)', CHARGED: 'var(--charged)', OFFICIAL: 'var(--official)', REDFLAG: 'var(--lead)' };
  function clusterSvg(c) {
    const n = c.members.length, R = 118, cx = 170, cy = 150, pos = c.members.map((m, i) => { const a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(1, n); return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
    const node = (m, i) => { const [x, y] = pos[i], f = TCOL[m.t] || 'var(--deemph)', tip = esc(`<b>${m.n}</b>${{ org: 'Organization', firm: 'Firm', person: 'Person', address: 'Address' }[m.k] || ''}${m.paid ? ' · ' + money(m.paid) + ' from the City' : ''}${m.inCase && m.inCase.text ? ' · ' + m.inCase.text.charAt(0).toUpperCase() + m.inCase.text.slice(1) : ''}${m.note ? ' · ' + m.note : ''}`);
      return m.k === 'person' ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" rx="2" fill="${f}" stroke="var(--surface)" stroke-width="2" tabindex="0" data-tip="${tip}"/>` : m.k === 'address' ? `<path d="M${x},${y - 6}L${x + 6},${y + 5}H${x - 6}Z" fill="${f}" stroke="var(--surface)" stroke-width="2" tabindex="0" data-tip="${tip}"/>` : `<circle cx="${x}" cy="${y}" r="${m.k === 'firm' ? 5 : 6.5}" fill="${f}" stroke="var(--surface)" stroke-width="2" tabindex="0" data-tip="${tip}"/>`; };
    return `<figure class="card pad cl"><figcaption><b>${esc(c.name)}</b><span class="muted small"> · ${n} members, ${c.links.length} links</span></figcaption><svg viewBox="0 0 340 300" role="img" aria-label="${esc(c.name)}: ${n} linked members">${c.links.map(([i, j]) => pos[i] && pos[j] ? `<line x1="${pos[i][0].toFixed(1)}" y1="${pos[i][1].toFixed(1)}" x2="${pos[j][0].toFixed(1)}" y2="${pos[j][1].toFixed(1)}" class="cle"/>` : '').join('')}${c.members.map(node).join('')}</svg></figure>`;
  }

  /* an organization's paper trail, for the profile page */
  Y.docs = o => o.docs && o.docs.length ? `<section class="section"><h2>In the official record</h2><p class="sub">Official documents on file that name this organization. Being named in a document is not being accused in it; open the document to see why.</p><ul class="off-list">${o.docs.map(d => `<li><span class="tag">${esc(d.k || 'document')}</span><div><b>${esc(d.p || '')}${d.d && !/^0000/.test(d.d) ? ', ' + esc(fmtDate(d.d)) : ''}.</b> ${d.u && /^https?:\/\//.test(d.u) ? `<a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(d.t || 'Document')} ↗</a>` : esc(d.t || '')}${d.s ? ` <span class="muted">“…${esc(d.s)}…”</span>` : ''}</div></li>`).join('')}</ul></section>` : '';
})();
