/* Dependency-free SVG charts and the follow-the-money diagram. All text from data is escaped. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace(/\.?0+$/, '') + 'B';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace(/\.0+$/, '') + 'M';
    if (a >= 1e4) return s + '$' + Math.round(a / 1e3) + 'K';
    return s + '$' + Math.round(a).toLocaleString('en-US');
  };
  const full = n => typeof n === 'number' && isFinite(n) ? '$' + n.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }) : '—';
  const nice = max => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };

  // one shared tooltip; values lead, labels follow
  let tip;
  const showTip = (ev, html) => {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip); }
    tip.innerHTML = esc(html).replace(/&lt;(\/?)b&gt;/g, '<$1b>'); tip.style.display = 'block';      // tip text comes from public records: only <b> is markup
    const r = ev.target.getBoundingClientRect ? ev.target.getBoundingClientRect() : null;
    const x = ev.clientX ?? (r ? r.left + r.width / 2 : 0), y = ev.clientY ?? (r ? r.top : 0);
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + 'px';
    tip.style.top = Math.max(8, y - h - 12) + 'px';
  };
  const hideTip = () => { if (tip) tip.style.display = 'none'; };
  const bindTips = root => root.querySelectorAll('[data-tip]').forEach(n => {
    const h = e => showTip(e, n.dataset.tip);
    n.addEventListener('pointermove', h); n.addEventListener('focus', h); n.addEventListener('pointerleave', hideTip); n.addEventListener('blur', hideTip);
  });
  const roundTop = (x, y, w, h, r) => { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

  /* Columns: one series over ordered periods. opts: points[{label,value,cls,note}], markers[{period,n,text}], ref{value,label}, fmt */
  function columns(el, opts) {
    const pts = opts.points || [], W = 760, m = { l: 58, r: 14, t: opts.markers && opts.markers.length ? 40 : 22, b: 30 }, H = opts.height || 250;
    const fmt = opts.fmt || money, ff = opts.fullFmt || full, max = nice(Math.max(1, ...pts.map(p => p.value), opts.ref ? opts.ref.value : 0) * 1.04);
    const iw = W - m.l - m.r, ih = H - m.t - m.b, band = iw / Math.max(1, pts.length), bw = Math.min(24, band * 0.62);
    const y = v => m.t + ih - (v / max) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">`;
    for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); s += `<line class="${i ? 'gl' : 'ax'}" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="t" x="${m.l - 8}" y="${yy + 4}" text-anchor="end">${esc(fmt(v))}</text>`; }
    const maxI = pts.reduce((b, p, i) => p.value > pts[b].value ? i : b, 0);
    pts.forEach((p, i) => {
      const cx = m.l + band * i + band / 2, h = Math.max(p.value > 0 ? 1.5 : 0, (p.value / max) * ih);
      s += `<path class="bar ${esc(p.cls || '')}" tabindex="0" d="${roundTop(cx - bw / 2, y(p.value), bw, h, 4)}" data-tip="<b>${esc(ff(p.value))}</b>${esc(p.label)}${p.note ? ' · ' + esc(p.note) : ''}"/>`;
      s += `<rect x="${cx - band / 2}" y="${m.t}" width="${band}" height="${ih}" fill="transparent" data-tip="<b>${esc(ff(p.value))}</b>${esc(p.label)}${p.note ? ' · ' + esc(p.note) : ''}"/>`;
      s += `<text x="${cx}" y="${H - 10}" text-anchor="middle">${esc(p.short || p.label)}</text>`;
      if (i === maxI || i === pts.length - 1) s += `<text class="val" x="${cx}" y="${y(p.value) - 6}" text-anchor="middle">${esc(fmt(p.value))}</text>`;
    });
    if (opts.ref) { const yy = y(opts.ref.value); s += `<line class="ref" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="ref" x="${W - m.r}" y="${yy - 6}" text-anchor="end">${esc(opts.ref.label)}</text>`; }
    const stack = {};
    (opts.markers || []).forEach(k => {
      const i = pts.findIndex(p => p.label === k.period); if (i < 0) return;
      const cx = m.l + band * i + band / 2, n = stack[i] = (stack[i] || 0) + 1, cy = 12, cx2 = cx + (n - 1) * 20 - 0;
      s += `<g tabindex="0" data-tip="<b>${esc(k.title || '')}</b>${esc(k.text || '')}"><line class="ax" x1="${cx2}" x2="${cx2}" y1="${cy + 9}" y2="${m.t + ih}"/><circle class="mk" cx="${cx2}" cy="${cy}" r="9"/><text class="mkt" x="${cx2}" y="${cy + 4}" text-anchor="middle">${esc(k.n)}</text></g>`;
    });
    el.innerHTML = s + '</svg>'; bindTips(el);
  }

  /* Step line: an amount after each dated action (contract ceilings). opts: points[{period,value,note}], ref{value,label} */
  function steps(el, opts) {
    const pts = opts.points || [], W = 760, H = 250, m = { l: 62, r: 70, t: 24, b: 34 };
    const max = nice(Math.max(...pts.map(p => p.value), opts.ref ? opts.ref.value : 0) * 1.08), iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = i => m.l + (pts.length === 1 ? iw / 2 : iw * i / (pts.length - 1)), y = v => m.t + ih - (v / max) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Amount after each action')}">`;
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line class="${i ? 'gl' : 'ax'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="t" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(money(v))}</text>`; }
    if (opts.ref) s += `<line class="ref" x1="${m.l}" x2="${W - m.r}" y1="${y(opts.ref.value)}" y2="${y(opts.ref.value)}"/><text class="ref" x="${W - m.r + 6}" y="${y(opts.ref.value) + 4}">${esc(opts.ref.label)}</text>`;
    let d = ''; pts.forEach((p, i) => { d += i ? `H${x(i)}V${y(p.value)}` : `M${x(0)},${y(p.value)}`; });
    s += `<path class="line" d="${d}"/>`;
    pts.forEach((p, i) => {
      s += `<circle class="dot" tabindex="0" cx="${x(i)}" cy="${y(p.value)}" r="5" style="fill-opacity:1;stroke-width:2" data-tip="<b>${esc(full(p.value))}</b>${esc(p.period)}${p.note ? ' · ' + esc(p.note) : ''}"/>`;
      s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="14" fill="transparent" data-tip="<b>${esc(full(p.value))}</b>${esc(p.period)}${p.note ? ' · ' + esc(p.note) : ''}"/>`;
      if (pts.length <= 7 || i === 0 || i === pts.length - 1) s += `<text x="${x(i)}" y="${H - 10}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${esc(String(p.period).slice(0, 10))}</text>`;
      if (i === 0 || i === pts.length - 1) s += `<text class="val" x="${x(i)}" y="${y(p.value) - 10}" text-anchor="${i === 0 ? 'start' : 'end'}">${esc(money(p.value))}</text>`;
    });
    el.innerHTML = s + '</svg>'; bindTips(el);
  }

  /* Histogram of contract sizes around a line. bins[{from,to,all}], line value */
  function histogram(el, opts) {
    const bins = opts.bins, W = 760, H = 270, m = { l: 46, r: 14, t: 30, b: 44 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = nice(Math.max(...bins.map(b => b.all)) * 1.05), band = iw / bins.length, bw = Math.min(24, band - 2), y = v => m.t + ih - (v / max) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}">`;
    for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line class="${i ? 'gl' : 'ax'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="t" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
    bins.forEach((b, i) => {
      const cx = m.l + band * i + band / 2, hot = b.to === opts.line, t = `<b>${b.all} contracts</b>${esc(money(b.from))} to ${esc(money(b.to))}${b.nonprofit != null ? ' · ' + b.nonprofit + ' with nonprofits' : ''}`;
      s += `<path class="bar ${hot ? 'hot' : 'de'}" tabindex="0" d="${roundTop(cx - bw / 2, y(b.all), bw, (b.all / max) * ih, 4)}" data-tip="${t}"/><rect x="${cx - band / 2}" y="${m.t}" width="${band}" height="${ih}" fill="transparent" data-tip="${t}"/>`;
      if (hot || b.from === opts.line) s += `<text class="val" x="${cx}" y="${y(b.all) - 6}" text-anchor="middle">${b.all}</text>`;
      if (i % 4 === 0) s += `<text class="t" x="${m.l + band * i}" y="${H - 24}" text-anchor="middle">${esc(money(b.from))}</text>`;
    });
    const li = bins.findIndex(b => b.from === opts.line), lx = m.l + band * li;
    if (li >= 0) s += `<line class="ref" x1="${lx}" x2="${lx}" y1="${m.t - 12}" y2="${m.t + ih}"/><text class="ref" x="${lx + 6}" y="${m.t - 4}">${esc(opts.lineLabel)}</text>`;
    s += `<text x="${m.l + iw / 2}" y="${H - 4}" text-anchor="middle">Contract amount (each column = ${esc(money(bins[0].to - bins[0].from))})</text>`;
    el.innerHTML = s + '</svg>'; bindTips(el);
  }

  /* Dot strip: every purchase order by date and amount, with the spending limit drawn as a step. orders[{d,v,vendor}] */
  function strip(el, opts) {
    const o = opts.orders || [], W = 760, H = 290, m = { l: 52, r: 16, t: 20, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
    if (!o.length) { el.innerHTML = '<p class="muted">No orders.</p>'; return; }
    const t = d => Date.parse(d), t0 = Math.min(...o.map(p => t(p.d))), t1 = Math.max(...o.map(p => t(p.d))), max = 25000;
    const x = d => m.l + (t1 === t0 ? .5 : (t(d) - t0) / (t1 - t0)) * iw, y = v => m.t + ih - (Math.min(v, max) / max) * ih;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}">`;
    for (let v = 0; v <= max; v += 5000) s += `<line class="${v ? 'gl' : 'ax'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="t" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(money(v))}</text>`;
    for (let yr = new Date(t0).getFullYear() + 1; yr <= new Date(t1).getFullYear(); yr++) { const xx = x(yr + '-01-01'); s += `<text class="t" x="${xx}" y="${H - 8}" text-anchor="middle">${yr}</text><line class="gl" x1="${xx}" x2="${xx}" y1="${m.t + ih}" y2="${m.t + ih + 4}"/>`; }
    const cut = '2024-07-01', xc = t(cut) > t0 && t(cut) < t1 ? x(cut) : null;
    if (xc) s += `<path class="step" d="M${m.l},${y(10000)}H${xc}V${y(20000)}H${W - m.r}"/><text class="ref" x="${m.l + 4}" y="${y(10000) - 6}">$10,000 limit</text><text class="ref" x="${W - m.r}" y="${y(20000) - 6}" text-anchor="end">$20,000 limit from July 2024</text>`;
    else { const lim = t1 < t(cut) ? 10000 : 20000; s += `<line class="ref" x1="${m.l}" x2="${W - m.r}" y1="${y(lim)}" y2="${y(lim)}"/><text class="ref" x="${m.l + 4}" y="${y(lim) - 6}">${esc(money(lim))} limit</text>`; }
    o.forEach(p => { const lim = p.d < cut ? 10000 : 20000, near = p.v >= lim * .9 && p.v <= lim; s += `<circle class="dot ${near ? '' : 'de'}" cx="${x(p.d).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.2"/>`; });
    s += `<rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    el.innerHTML = s + '</svg>';
    const svg = el.querySelector('svg'), hit = el.querySelector('.hit');
    hit.addEventListener('pointermove', ev => {
      const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * W, py = (ev.clientY - r.top) / r.height * H; let best = null, bd = 1e9;
      o.forEach(p => { const dx = x(p.d) - px, dy = y(p.v) - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } });
      if (best) showTip(ev, `<b>${esc(full(best.v))}</b>${esc(best.d)}${best.vendor ? ' · ' + esc(best.vendor) : ''}`);
    });
    hit.addEventListener('pointerleave', hideTip);
  }

  /* Ranked horizontal bars, one hue. rows[{label,value,sub,cls}] */
  function ranked(el, opts) {
    const rows = opts.rows, W = 760, rh = 30, m = { l: opts.labelW || 210, r: 86, t: 6, b: 6 }, H = m.t + m.b + rows.length * rh, iw = W - m.l - m.r, max = Math.max(...rows.map(r => r.value)) || 1, fmt = opts.fmt || money;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}">`;
    rows.forEach((r, i) => {
      const yy = m.t + i * rh, w = Math.max(2, r.value / max * iw), t = `<b>${esc(fmt(r.value))}</b>${esc(r.label)}${r.sub ? ' · ' + esc(r.sub) : ''}`;
      s += `<text x="${m.l - 10}" y="${yy + 19}" text-anchor="end" style="fill:var(--ink-2)">${esc(r.label)}</text><path class="bar ${esc(r.cls || '')}" tabindex="0" d="M${m.l},${yy + 7}h${w - 4}q4,0 4,4v8q0,4 -4,4h${-(w - 4)}z" data-tip="${t}"/><text class="val" x="${m.l + w + 8}" y="${yy + 19}">${esc(fmt(r.value))}</text>`;
    });
    el.innerHTML = s + '</svg>'; bindTips(el);
  }

  const spark = (vals) => { const max = Math.max(1, ...vals), w = 92 / vals.length; return `<svg class="spark" viewBox="0 0 92 26" aria-hidden="true">${vals.map((v, i) => `<rect class="${i === vals.length - 1 ? 'last' : ''}" x="${(i * w + 1).toFixed(1)}" y="${(26 - Math.max(v > 0 ? 1.5 : 0, v / max * 24)).toFixed(1)}" width="${(w - 2).toFixed(1)}" height="${Math.max(v > 0 ? 1.5 : 0, v / max * 24).toFixed(1)}" rx="1.5"/>`).join('')}</svg>`; };

  /* Follow-the-money diagram. Arrows carry only a badge (number = suspicious point, letter = other link);
     the words live in the list under the diagram, which stays in sync. c = case; onPick(linkIndex) */
  function flow(el, c, onPick) {
    const NW = 172, NH = 58, GX = 68, GY = 46, P = 18;
    const cols = [...new Set(c.actors.map(a => a.col))].sort((a, b) => a - b), rows = [...new Set(c.actors.map(a => a.row))].sort((a, b) => a - b);
    const pos = {}; c.actors.forEach(a => { pos[a.id] = { x: P + cols.indexOf(a.col) * (NW + GX), y: P + rows.indexOf(a.row) * (NH + GY), a }; });
    const W = P * 2 + cols.length * NW + (cols.length - 1) * GX, H = P * 2 + rows.length * NH + (rows.length - 1) * GY;
    const wrap = (t, n) => { const w = String(t).split(/\s+/), out = ['']; w.forEach(x => { if ((out[out.length - 1] + ' ' + x).trim().length > n && out[out.length - 1]) out.push(x); else out[out.length - 1] = (out[out.length - 1] + ' ' + x).trim(); }); if (out.length > 2) { out[1] = out.slice(1).join(' '); out.length = 2; } if (out[out.length - 1].length > n) out[out.length - 1] = out[out.length - 1].slice(0, n - 1) + '…'; return out; };
    const pairCount = {}, pairSeen = {};
    c.links.forEach(l => { const k = [l.from, l.to].sort().join('|'); pairCount[k] = (pairCount[k] || 0) + 1; });
    let edges = '', nodes = '', letter = 0;
    c.links.forEach((l, i) => {
      const A = pos[l.from], B = pos[l.to]; if (!A || !B) return;
      const k = [l.from, l.to].sort().join('|'), n = pairCount[k], j = pairSeen[k] = (pairSeen[k] || 0) + 1, off = (j - (n + 1) / 2) * (n > 3 ? 13 : 22);
      let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
      if (A.x < B.x) { x1 = A.x + NW; y1 = A.y + NH / 2 + off; x2 = B.x - 8; y2 = B.y + NH / 2 + off; const dx = Math.max(24, (x2 - x1) * .45); c1x = x1 + dx; c1y = y1; c2x = x2 - dx; c2y = y2; }
      else if (A.x > B.x) { x1 = A.x; y1 = A.y + NH / 2 + off; x2 = B.x + NW + 8; y2 = B.y + NH / 2 + off; const dx = Math.max(24, (x1 - x2) * .45); c1x = x1 - dx; c1y = y1; c2x = x2 + dx; c2y = y2; }
      else { const down = A.y < B.y; x1 = A.x + NW / 2 + off * 1.8; y1 = down ? A.y + NH : A.y; x2 = x1; y2 = down ? B.y - 8 : B.y + NH + 8; const dy = (y2 - y1) * .4; c1x = x1; c1y = y1 + dy; c2x = x2; c2y = y2 - dy; }
      // parallel arrows get their badges at different points along the curve so the numbers never stack
      const t = Math.max(.22, Math.min(.78, .5 + (j - (n + 1) / 2) * (n > 3 ? .14 : .2))), u = 1 - t;
      const mx = u * u * u * x1 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2, my = u * u * u * y1 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2, ang = Math.atan2(y2 - c2y, x2 - c2x), flag = l.flag != null;
      const soft = !['money', 'gift'].includes(l.kind), badge = flag ? String(l.flag) : String.fromCharCode(97 + (letter++ % 26));
      l._badge = badge;
      edges += `<g class="edge k-${esc(l.kind)} ${soft ? 'k-soft' : ''} ${flag ? 'flag bar-' + esc(l.tier) : ''}" data-link="${i}" tabindex="0" role="button" aria-label="${esc(badge)}: ${esc(pos[l.from].a.name)} to ${esc(pos[l.to].a.name)}, ${esc(l.label)}">
        <path class="ln" d="M${x1},${y1}C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}"/><path class="ah" d="M0,0L-10,-5L-10,5Z" transform="translate(${x2 + 8 * Math.cos(ang)},${y2 + 8 * Math.sin(ang)}) rotate(${ang * 180 / Math.PI})"/>
        <path class="hit" d="M${x1},${y1}C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}"/>
        <circle class="${flag ? 'pinc' : 'ltc'}" cx="${mx}" cy="${my}" r="${flag ? 12 : 10}"/><text class="${flag ? 'pint' : 'ltt'}" x="${mx}" y="${my + 4.5}" text-anchor="middle">${esc(badge)}</text></g>`;
    });
    Object.values(pos).forEach(p => {
      const nm = wrap(p.a.name, 22), rl = (p.a.role || '').length > 30 ? p.a.role.slice(0, 29) + '…' : (p.a.role || '');
      nodes += `<g class="node ${esc(p.a.type)}" tabindex="0" role="link" data-who="${esc(p.a.who || '')}" aria-label="${esc(p.a.name)}, ${esc(p.a.role || p.a.type)}"><rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="${p.a.type === 'person' ? 29 : 8}"/>
        ${nm.map((t, i) => `<text class="nm" x="${p.x + NW / 2}" y="${p.y + (nm.length === 1 ? 24 : 18) + i * 15}" text-anchor="middle">${esc(t)}</text>`).join('')}
        ${nm.length === 1 ? `<text class="rl" x="${p.x + NW / 2}" y="${p.y + NH - 12}" text-anchor="middle">${esc(rl)}</text>` : `<text class="rl" x="${p.x + NW / 2}" y="${p.y + NH - 7}" text-anchor="middle">${esc(rl)}</text>`}</g>`;
    });
    el.innerHTML = `<svg class="flow" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Diagram of who paid, gave or decided what">${edges}${nodes}</svg>`;
    el.querySelectorAll('.edge').forEach(g => { const go = () => onPick(+g.dataset.link); g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
    el.querySelectorAll('.node').forEach(g => { const go = () => { if (g.dataset.who) location.hash = '#who/' + g.dataset.who; }; g.addEventListener('click', go); g.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
  }

  /* Hotspot map: neighbourhood outlines + circles sized by a value. geo{w,h,hoods[{n,d}]}, pts[{x,y,v,t}] */
  function map(el, geo, pts, onPick) {
    const max = Math.max(1, ...pts.map(p => p.v));
    let s = `<svg viewBox="0 0 ${geo.w} ${geo.h}" role="img" aria-label="Map of San Francisco hotspots">` + geo.hoods.map(h => `<path class="hood" d="${h.d}"><title>${esc(h.n)}</title></path>`).join('');
    pts.slice().sort((a, b) => b.v - a.v).forEach((p, i) => { s += `<circle class="hot" data-i="${p.i}" tabindex="0" cx="${p.x}" cy="${p.y}" r="${(3 + 15 * Math.sqrt(p.v / max)).toFixed(1)}" data-tip="${p.t}"/>`; });
    el.innerHTML = s + '</svg>'; bindTips(el);
    el.querySelectorAll('.hot').forEach(n => { const go = () => { el.querySelectorAll('.hot.sel').forEach(x => x.classList.remove('sel')); n.classList.add('sel'); onPick(+n.dataset.i); }; n.addEventListener('click', go); n.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
  }

  window.FDC = { esc, money, full, columns, steps, histogram, strip, ranked, spark, flow, map, hideTip, bindTips };
})();
