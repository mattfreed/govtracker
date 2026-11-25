/* SF Money Trail — "Every record behind this case".
   Reads assets/evidence/<case id>.json (built by scripts/evidence/) and shows who is named and every row, with a filter,
   sorting, paging and a download. Nothing is computed here beyond counting what is shown. */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const usd = v => (v == null || v === '' ? '' : (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US'));
  const short = v => { const a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 1e9 ? '$' + (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (a / 1e6).toFixed(1) + 'M' : a >= 1e4 ? '$' + Math.round(a / 1e3) + 'K' : '$' + Math.round(a).toLocaleString('en-US')); };
  const plain = (v, c) => (v == null ? '' : c.type === 'link' ? (v.t || '') : c.type === 'pct' ? (v * 100).toFixed(1) + '%' : String(v));
  const cell = (v, c) => {
    if (v == null || v === '') return '<span class="muted">—</span>';
    if (c.type === 'usd') return esc(usd(v)); if (c.type === 'int') return esc(Math.round(v).toLocaleString('en-US')); if (c.type === 'num') return esc((+v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
    if (c.type === 'pct') return esc((v * 100).toFixed(1) + '%'); if (c.type === 'link') return `<a href="${esc(v.u)}" target="_blank" rel="noopener">${esc(v.t)} ↗</a>`;
    if (c.type === 'person' || c.type === 'org') return `<button type="button" class="ev-name" data-who="${esc(v)}" title="Show only the rows that name ${esc(v)}">${esc(v)}</button>`;
    return esc(v);
  };
  const csv = (t, rows) => [t.columns.map(c => c.t), ...rows.map(r => t.columns.map(c => (c.type === 'link' ? (r[c.k] || {}).u || '' : r[c.k] ?? '')))].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const PAGE = 50;

  function mount(el, caseId) {
    el.innerHTML = '<p class="muted">Opening the records…</p>';
    fetch(`assets/evidence/${encodeURIComponent(caseId)}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => {
      const st = { who: '', q: {}, sort: {}, page: {}, pq: '', pall: false }, loading = {};
      const load = t => t.rows || loading[t.id] || (loading[t.id] = fetch('assets/evidence/' + t.rowsFile).then(r => r.json()).then(rows => { t.rows = rows; draw(); }));
      const loadAll = () => Promise.all(d.tables.filter(t => !t.rows).map(load));
      const match = (t, r) => {
        if (st.who && !t.columns.some(c => (c.type === 'person' || c.type === 'org') && r[c.k] === st.who)) return false;
        const q = (st.q[t.id] || '').trim().toLowerCase(); if (!q) return true;
        return q.split(/\s+/).every(w => t.columns.some(c => plain(r[c.k], c).toLowerCase().includes(w)));
      };
      const rowsOf = t => { if (!t.rows) return null; let rows = t.rows.filter(r => match(t, r)); const s = st.sort[t.id]; if (s) { const c = t.columns.find(x => x.k === s.k), num = ['usd', 'int', 'num', 'pct', 'year'].includes(c.type); rows = [...rows].sort((a, b) => { const x = c.type === 'link' ? (a[s.k] || {}).t : a[s.k], y = c.type === 'link' ? (b[s.k] || {}).t : b[s.k]; if (x == null || x === '') return 1; if (y == null || y === '') return -1; return (num ? x - y : String(x).localeCompare(String(y))) * s.dir; }); } return rows; };
      const draw = () => {
        const c = d.counts, P = d.parties.filter(p => !st.pq || p.name.toLowerCase().includes(st.pq.toLowerCase())), shown = st.pall || st.pq ? P : P.slice(0, 24);
        el.innerHTML = `<p class="sub">${esc(c.rows.toLocaleString('en-US'))} records in ${c.lists} ${c.lists === 1 ? 'list' : 'lists'}, naming ${esc(c.people.toLocaleString('en-US'))} people and ${esc(c.organizations.toLocaleString('en-US'))} organizations. ${esc(d.note)}</p>
          <div class="card pad ev-who"><div class="ev-head"><h3>Who appears in these records</h3><input type="search" class="ev-pq" placeholder="Find a name…" value="${esc(st.pq)}" aria-label="Find a name"></div>
            <div class="table-wrap"><table class="ev-t"><thead><tr><th>Name</th><th>What they are in the record</th><th class="num">Records</th><th class="num">Money in those records</th></tr></thead><tbody>
            ${shown.map(p => `<tr class="${p.name === st.who ? 'sel' : ''}"><td><button type="button" class="ev-name" data-who="${esc(p.name)}">${esc(p.name)}</button><small>${p.kind === 'person' ? 'person' : 'organization'}</small></td><td>${esc(p.roles.join('; '))}</td><td class="num">${p.rows.toLocaleString('en-US')}</td><td class="num">${p.amount ? esc(short(p.amount)) : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>
            ${P.length > shown.length ? `<p class="small"><button type="button" class="btn ev-pall">Show all ${P.length.toLocaleString('en-US')} names</button></p>` : ''}
            ${st.who ? `<p class="ev-filter">Showing only rows that name <b>${esc(st.who)}</b>. <button type="button" class="btn ev-clear">Show everyone</button></p>` : ''}</div>
          ${d.tables.map(t => {
            if (!t.rows) return `<div class="card pad ev-list" data-list="${esc(t.id)}"><div class="ev-head"><div><h3>${t.point ? `<span class="pin">${esc(t.point)}</span> ` : ''}${esc(t.title)}</h3><p class="small muted">${esc(t.what)}</p></div></div>
              <p class="small ev-count"><b>${(t.total || 0).toLocaleString('en-US')}</b> records</p><p><button type="button" class="btn ev-load">${loading[t.id] ? 'Opening…' : `Show all ${(t.total || 0).toLocaleString('en-US')} records`}</button></p>
              <details class="small"><summary>How this list was made, and what it cannot show</summary><p><b>How.</b> ${esc(t.how)}</p><p><b>What it cannot show.</b> ${esc(t.limits)}</p><p><b>Sources.</b> ${t.sources.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a>`).join(' · ')}</p></details></div>`;
            const rows = rowsOf(t), pg = st.page[t.id] || 0, pages = Math.max(1, Math.ceil(rows.length / PAGE)), slice = st.page[t.id] === 'all' ? rows : rows.slice(pg * PAGE, pg * PAGE + PAGE), s = st.sort[t.id] || {};
            const money = t.columns.find(x => x.total), sum = money ? rows.reduce((a, r) => a + (+r[money.k] || 0), 0) : null;
            return `<div class="card pad ev-list" data-list="${esc(t.id)}"><div class="ev-head"><div><h3>${t.point ? `<span class="pin">${esc(t.point)}</span> ` : ''}${esc(t.title)}</h3><p class="small muted">${esc(t.what)}</p></div>
              <div class="ev-tools"><input type="search" class="ev-q" placeholder="Filter these rows…" value="${esc(st.q[t.id] || '')}" aria-label="Filter the rows of ${esc(t.title)}"><button type="button" class="btn ev-csv">Download</button></div></div>
              <p class="small ev-count"><b>${rows.length.toLocaleString('en-US')}</b>${rows.length !== t.rows.length ? ` of ${t.rows.length.toLocaleString('en-US')}` : ''} ${rows.length === 1 ? 'record' : 'records'}${sum != null ? ` · ${esc(money.t)}: <b>${esc(usd(sum))}</b>` : ''}${t.complete === false ? ` · <span class="warn">the public file is partial: ${esc(t.of || '')}</span>` : ''}</p>
              <div class="table-wrap"><table class="ev-t"><thead><tr>${t.columns.map(c => `<th class="${['usd', 'int', 'num', 'pct'].includes(c.type) ? 'num' : ''}"><button type="button" class="ev-sort" data-k="${esc(c.k)}">${esc(c.t)}${s.k === c.k ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
              <tbody>${slice.map(r => `<tr>${t.columns.map(c => `<td class="${['usd', 'int', 'num', 'pct'].includes(c.type) ? 'num' : ''}">${cell(r[c.k], c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${t.columns.length}" class="muted">No row matches.</td></tr>`}</tbody></table></div>
              ${rows.length > PAGE ? `<p class="small ev-pages">${st.page[t.id] === 'all' ? `<button type="button" class="btn ev-pg" data-p="0">Show ${PAGE} at a time</button>` : `<button type="button" class="btn ev-pg" data-p="${Math.max(0, pg - 1)}" ${pg ? '' : 'disabled'}>← Earlier</button> <span>rows ${(pg * PAGE + 1).toLocaleString('en-US')}–${Math.min(rows.length, pg * PAGE + PAGE).toLocaleString('en-US')}</span> <button type="button" class="btn ev-pg" data-p="${Math.min(pages - 1, pg + 1)}" ${pg < pages - 1 ? '' : 'disabled'}>Later →</button> <button type="button" class="btn ev-pg" data-p="all">Show all ${rows.length.toLocaleString('en-US')}</button>`}</p>` : ''}
              <details class="small"><summary>How this list was made, and what it cannot show</summary><p><b>How.</b> ${esc(t.how)}</p><p><b>What it cannot show.</b> ${esc(t.limits)}</p><p><b>Sources.</b> ${t.sources.map(x => `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.t)} ↗</a>`).join(' · ')}</p></details></div>`;
          }).join('')}`;
      };
      draw();
      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; const list = b.closest('[data-list]'), id = list && list.dataset.list, t = id && d.tables.find(x => x.id === id);
        if (b.classList.contains('ev-load')) { load(t); draw(); return; }
        if (b.classList.contains('ev-name')) { st.who = st.who === b.dataset.who ? '' : b.dataset.who; st.page = {}; if (st.who) loadAll(); draw(); const first = el.querySelector('.ev-list'); if (st.who && first && !b.closest('.ev-list')) first.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else if (b.classList.contains('ev-clear')) { st.who = ''; st.page = {}; draw(); } else if (b.classList.contains('ev-pall')) { st.pall = true; draw(); }
        else if (b.classList.contains('ev-sort')) { const s = st.sort[id]; st.sort[id] = s && s.k === b.dataset.k ? { k: s.k, dir: -s.dir } : { k: b.dataset.k, dir: ['usd', 'int', 'num', 'pct'].includes(t.columns.find(c => c.k === b.dataset.k).type) ? -1 : 1 }; st.page[id] = 0; draw(); }
        else if (b.classList.contains('ev-pg')) { st.page[id] = b.dataset.p === 'all' ? 'all' : +b.dataset.p; draw(); }
        else if (b.classList.contains('ev-csv')) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv(t, rowsOf(t))], { type: 'text/csv' })); a.download = `${caseId}_${id}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
      });
      let timer; el.addEventListener('input', e => {
        const i = e.target; if (!i.matches('.ev-q, .ev-pq')) return; clearTimeout(timer);
        timer = setTimeout(() => { const list = i.closest('[data-list]'), pos = i.selectionStart; if (i.classList.contains('ev-pq')) st.pq = i.value; else { st.q[list.dataset.list] = i.value; st.page[list.dataset.list] = 0; }
          draw(); const again = i.classList.contains('ev-pq') ? el.querySelector('.ev-pq') : el.querySelector(`[data-list="${list.dataset.list}"] .ev-q`); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (x) { /* not a text field */ } } }, 220);
      });
    }).catch(() => { el.innerHTML = '<p class="muted">The list of records for this case could not be opened.</p>'; });
  }
  window.FDEV = { mount };
})();
