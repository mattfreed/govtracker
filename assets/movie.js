/* SF Money Trail — the film player.
   One narrated film per lead case: assets/movies/<id>.json (the beats, with their times in the audio) and <id>.m4a (the voice).
   Every picture is drawn from the case file in window.FD_CORE, in time with the beats; the player states nothing that the
   case file does not state. Built by scripts/movies/build_movies.py. */
(() => {
  'use strict';
  const W = 1280, H = 720, BASE = 'assets/movies/';
  const tableKinds = new Set(['record', 'rank', 'form', 'compare', 'unknowns', 'settle', 'bars']);
  // The slides and recordings can change in an edition that keeps the same player.
  const editionScript = document.querySelector('script[src^="assets/data/core.js?"]') || document.currentScript;
  const editionQuery = editionScript?.src ? new URL(editionScript.src).search : '';
  const mediaUrl = (id, extension) => BASE + encodeURIComponent(id) + extension + editionQuery;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const money = v => { const a = Math.abs(v); return a >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? '$' + Math.round(v / 1e3) + 'K' : '$' + Math.round(v).toLocaleString('en-US'); };
  const figs = t => esc(t).replace(/(-?\$[\d,]+(?:\.\d+)?(?:\s?(?:million|billion|thousand)|[KMB]\b)?|\b\d[\d,]*(?:\.\d+)?%|\b\d{1,3}(?:,\d{3})+\b)/g, '<b class="fig">$1</b>');
  const txt = e => (e && typeof e === 'object' ? e.text : e) || '';
  const size = (t, a, b) => (t.length > b ? ' xlong' : t.length > a ? ' long' : '');
  const KIND = { money: 'Money', gift: 'Gift or benefit', decision: 'Official decision', control: 'Controls', family: 'Family tie', employment: 'Employs / paid by', ownership: 'Owns', information: 'Information passed' };
  const TYPE = { agency: 'Public body', nonprofit: 'Nonprofit', company: 'Company', person: 'Person', committee: 'Committee', program: 'Program', account: 'Account or fund' };
  const TKIND = { money: 'Money', filing: 'Filing', decision: 'Decision', event: 'Event', enforcement: 'Enforcement' };
  const CHAPTER = { open: 'The lead', number: 'The number', oneline: 'In one line', story: 'What happened', map: 'Who, and how they connect', points: 'The suspicious part', traj: 'Over time', time: 'The timeline', sure: 'How sure are we?', defense: 'What they say', next: 'What would settle it', close: 'Where it stands' };
  const VIEW = { open: 'open', number: 'number', oneline: 'oneline', story: 'story', cast: 'map', links: 'map', points: 'points', traj: 'traj', time: 'time', sure: 'sure', defense: 'defense', next: 'next', close: 'close' };
  const SUBS_KEY = 'fd.movie.subtitles';                                          // 'on' / 'off' once the viewer has chosen; written films start with them on
  const NARR_KEY = 'fd.movie.narration';                                          // 'off' when the viewer muted the narration; kept across films and visits
  const narrSaved = () => { try { return localStorage.getItem(NARR_KEY) !== 'off'; } catch (e) { return true; } };
  const SPEAKER = on => `<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${on ? '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' : '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
  const SFX = { card: 'whoosh', point: 'thud', value: 'thud', actor: 'tick', link: 'tick', entry: 'tick', step: 'tick', yes: 'tick', no: 'tick', said: 'tick', series: 'tick', end: 'chime' };

  // ---- the pictures: one function per view; `bs` are that view's beats, each with its place `i` in the whole film
  const at = (bs, kind, ref) => bs.find(b => b.kind === kind && (ref === undefined || b.ref === ref));
  const B = b => (b ? ` data-b="${b.i}"` : '');
  const draw = {
    open(c, bs) {
      const t = c.title;
      return `<div class="v-open"><div class="o-tier"${B(bs[0])}><span class="big">${esc(TIER_TAG[c.tier] || 'Case')}</span><span>${esc(c.category || '')}</span></div>
        <h1 class="${size(t, 70, 105).trim()}"${B(at(bs, 'title'))}>${esc(t)}</h1><p class="o-caveat"${B(at(bs, 'caveat'))}>${esc((at(bs, 'caveat') || {}).text || '')}</p></div>`;
    },
    number(c, bs) {
      const v = at(bs, 'value');
      return `<div class="v-num"><div class="k"${B(bs[0])}>The number</div><div class="n-v"${B(v)} data-count="${+c.amount.value}">${money(+c.amount.value)}</div><div class="n-l"${B(v)}>${esc(c.amount.label || '')}</div></div>`;
    },
    oneline(c, bs) { return `<div class="v-one"><div class="k"${B(bs[0])}>In one line</div><p class="${size(c.oneLine, 210, 330).trim()}"${B(bs[0])}>${figs(c.oneLine)}</p></div>`; },
    story(c, bs) {
      return `<div class="v-story"><div class="s-win"><div class="s-col" data-follow>${bs.filter(b => b.kind !== 'card').map(b => `<p class="${b.kind === 'more' ? 'more' : ''}"${B(b)}>${figs(b.text)}</p>`).join('')}</div></div>
        <aside class="s-cast"><div class="k">In this file</div>${(c.actors || []).slice(0, 9).map((a, j) => `<div class="a t-${esc(a.type)}" data-actor="${j}"><i></i><span>${esc(a.name)}</span></div>`).join('')}</aside></div>`;
    },
    map(c, bs) {
      const A = c.actors || [], cols = [...new Set(A.map(a => a.col || 0))].sort((x, y) => x - y), rows = [...new Set(A.map(a => a.row || 0))].sort((x, y) => x - y);
      const X = k => (cols.length === 1 ? W / 2 : 170 + (W - 340) * cols.indexOf(k) / (cols.length - 1)), dense = rows.length >= 4 || A.length > 8, Y = k => (rows.length === 1 ? 250 : 92 + (dense ? 330 : 300) * rows.indexOf(k) / (rows.length - 1));
      const pos = {}; A.forEach(a => { pos[a.id] = [X(a.col || 0), Y(a.row || 0)]; });
      const cast = bs.filter(b => b.kind === 'actor'), links = bs.filter(b => b.kind === 'link'), firstLink = bs.find(b => b.scene === 'links') || bs[bs.length - 1], lastCast = cast[cast.length - 1] || bs[0];
      const hh = dense ? 30 : 44, edge = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.min(dx ? 114 / Math.abs(dx) : 9, dy ? hh / Math.abs(dy) : 9); return [p[0] + dx * t, p[1] + dy * t]; };
      const seen = {};
      const paths = (c.links || []).map((l, j) => {
        const p = pos[l.from], q = pos[l.to]; if (!p || !q || l.from === l.to) return '';
        const key = [l.from, l.to].sort().join('|'), n = (seen[key] = (seen[key] || 0) + 1), a = edge(p, q), z = edge(q, p);
        const dx = z[0] - a[0], dy = z[1] - a[1], len = Math.hypot(dx, dy) || 1, bend = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 30 * (l.from < l.to ? 1 : -1) + (Math.abs(dy) < 4 ? -26 : 0);
        const mx = (a[0] + z[0]) / 2 - dy / len * bend, my = (a[1] + z[1]) / 2 + dx / len * bend, b = links.find(x => x.ref === j) || firstLink;
        const lab = (l.label || '').length > 34 ? l.label.slice(0, 32) + '…' : (l.label || '');
        return `<g class="m-link k-${esc(l.kind)}" data-b="${b.i}" data-link="${j}"><path d="M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${z[0].toFixed(1)},${z[1].toFixed(1)}" marker-end="url(#mv-arrow)"/><text x="${((a[0] + 2 * mx + z[0]) / 4).toFixed(1)}" y="${((a[1] + 2 * my + z[1]) / 4 - 6).toFixed(1)}">${esc(lab)}</text></g>`;
      }).join('');
      const kinds = [...new Set((c.links || []).map(l => l.kind))];
      return `<div class="v-map${dense ? ' dense' : ''}"><div class="m-leg">${kinds.map(k => `<span><svg viewBox="0 0 26 8" class="m-link on now k-${esc(k)}"><path d="M1,4 L25,4" style="opacity:1;stroke-width:2.6"/></svg>${esc(KIND[k] || k)}</span>`).join('')}</div>
        <svg class="m-svg" viewBox="0 0 ${W} ${H - 58}"><defs><marker id="mv-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" fill="context-stroke" stroke="none"/></marker></defs>${paths}</svg>
        ${A.map((a, j) => `<div class="m-node t-${esc(a.type)}" data-node="${esc(a.id)}" style="left:${pos[a.id][0].toFixed(0)}px;top:${pos[a.id][1].toFixed(0)}px" data-b="${(cast.find(x => x.ref === j) || lastCast).i}"><small><i></i>${esc(TYPE[a.type] || a.type || '')}</small><b>${esc(a.name)}</b>${a.role ? `<span>${esc(a.role)}</span>` : ''}</div>`).join('')}
        <div class="m-now"></div></div>`;
    },
    points(c, bs) {
      const P = c.suspicious || [];
      return `<div class="v-points"><ol class="p-list">${P.map((s, j) => `<li data-pt="${j}"${B(at(bs, 'point', j) || bs[0])}><span>${esc(s.n || j + 1)}</span>${esc(s.title)}</li>`).join('')}</ol>
        <div class="p-main">${P.map((s, j) => `<div class="p-card" data-pt="${j}"><h2>${esc(s.title)}</h2><div class="meta">${s.amount ? `<span class="amt">${esc(money(s.amount))}</span>` : ''}${s.date ? `<span>${esc(s.date)}</span>` : ''}</div>
          <div class="blk what${(s.what || '').length > 520 ? ' long' : ''}"><div class="k">What the record shows</div><p>${figs(s.what || '')}</p></div>${s.why ? `<div class="blk why"><div class="k">Why it stands out, and the caution</div><p>${esc(s.why)}</p></div>` : ''}
          ${s.where ? `<div class="blk where"><div class="k">How it was worked out</div><p>${esc(s.where)}</p></div>` : ''}</div>`).join('')}</div></div>`;
    },
    traj(c, bs) {
      const S = ((c.trajectory || {}).series || []).filter(s => (s.points || []).length >= 2).slice(0, 3), w = 1120, h = S.length > 2 ? 96 : S.length > 1 ? 140 : 250, last = bs[bs.length - 1];
      const usd = u => /^(usd|\$)$/i.test(u || ''), show = (v, u) => (usd(u) ? money(v) : Math.abs(v) <= 1 && /%|pct|share|percent/i.test(u || '') ? Math.round(v * 100) + '%' : (+v).toLocaleString('en-US', { maximumFractionDigits: 1 }) + (u && !usd(u) && u.length <= 3 ? ' ' + u : ''));
      return `<div class="v-traj">${S.map((s, j) => {
        const P = s.points, vals = P.map(p => +p.value), lo = Math.min(0, ...vals), hi = Math.max(...vals) || 1, x = i => 70 + (w - 150) * i / (P.length - 1), y = v => 16 + (h - 44) * (1 - (v - lo) / (hi - lo || 1));
        const b = at(bs, 'series', j) || last, every = Math.ceil(P.length / 9);
        return `<div class="tr" data-b="${b.i}"><h3>${esc(s.label || '')}</h3><svg viewBox="0 0 ${w} ${h}" height="${h}"><line class="gl" x1="70" x2="${w - 80}" y1="${y(lo)}" y2="${y(lo)}"/><line class="gl" x1="70" x2="${w - 80}" y1="${y(hi)}" y2="${y(hi)}"/>
          <path class="ln" pathLength="1" d="${P.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(+p.value).toFixed(1)}`).join(' ')}"/>${P.map((p, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(+p.value).toFixed(1)}" r="${i === 0 || i === P.length - 1 ? 5 : 3}"/>`).join('')}
          ${P.map((p, i) => (i % every === 0 || i === P.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${h - 4}" text-anchor="middle">${esc(p.period)}</text>` : '')).join('')}
          <text class="v" x="${x(0) - 10}" y="${y(vals[0]) + 5}" text-anchor="end">${esc(show(vals[0], s.unit))}</text><text class="v" x="${x(P.length - 1) + 10}" y="${y(vals[P.length - 1]) + 5}">${esc(show(vals[P.length - 1], s.unit))}</text></svg></div>`;
      }).join('')}${(c.trajectory || {}).note ? `<p class="tr-note"${B(bs[0])}>${esc(c.trajectory.note)}</p>` : ''}</div>`;
    },
    time(c, bs) {
      return `<div class="v-time"><ol class="t-list" data-follow>${(c.timeline || []).map((e, j) => `<li${B(at(bs, 'entry', j) || bs[0])}${at(bs, 'entry', j) ? '' : ' data-extra'}><span class="d">${esc(e.date || '')}</span><span class="tx"><small>${esc(TKIND[e.kind] || e.kind || '')}</small>${figs(txt(e))}</span></li>`).join('')}</ol></div>`;
    },
    sure(c, bs) {
      const E = c.established || [], U = c.notEstablished || [], c2 = at(bs, 'card2') || bs[0], dense = E.length + U.length > 9 ? ' dense' : '';
      return `<div class="v-cols"><div class="col yes${dense}"${B(bs[0])}><h3>Established <em>${E.length}</em></h3><ul>${E.slice(0, 7).map((e, j) => `<li${B(at(bs, 'yes', j) || bs[0])}><p>${figs(txt(e))}</p></li>`).join('')}</ul></div>
        <div class="col no${dense}"${B(c2)}><h3>Not established <em>${U.length}</em></h3><ul>${U.slice(0, 7).map((e, j) => `<li${B(at(bs, 'no', j) || c2)}><p>${figs(txt(e))}</p></li>`).join('')}</ul></div></div>`;
    },
    defense(c, bs) {
      const D = c.defense || [], dense = D.length > 6 ? ' dense' : '';
      return `<div class="v-cols"><div class="col say${dense}"${B(bs[0])}><h3>What those involved have said</h3><ul>${D.slice(0, 5).map((e, j) => `<li${B(at(bs, 'said', j) || bs[0])}><p>${esc(txt(e))}</p></li>`).join('')}</ul></div></div>`;
    },
    next(c, bs) { const N = c.next || []; return `<div class="v-next${N.length > 4 ? ' dense' : ''}"><div class="k"${B(bs[0])}>What would settle it</div><ol>${N.map((e, j) => `<li${B(at(bs, 'step', j) || bs[0])}>${esc(txt(e))}</li>`).join('')}</ol></div>`; },
    close(c, bs) {
      const S = c.sources || [];
      return `<div class="v-close"><div><div class="k"${B(bs[0])}>Where it stands</div><p class="c-status"${B(at(bs, 'status') || bs[0])}>${esc(c.status || '')}</p>
        <div class="c-tags"${B(at(bs, 'sources'))}>${[...(c.patterns || [])].map(p => `<span>${esc(String(p).replace(/-/g, ' '))}</span>`).join('')}${c.asOf ? `<span>facts as of ${esc(c.asOf)}</span>` : ''}</div>
        <p class="c-end"${B(at(bs, 'end'))}>A lead is a question, not an accusation.</p><div class="c-btns"${B(at(bs, 'end'))}><button type="button" data-act="replay">Play again</button><button type="button" data-act="close">Read the case file</button></div></div>
        <div class="c-src"${B(at(bs, 'sources'))}><h3>${S.length} sources, each linked in the case file</h3><div class="win"><div class="roll" data-roll><ol>${S.map(s => `<li>${esc(s.title || '')}<small>${esc([s.publisher, s.date].filter(Boolean).join(' · '))}</small></li>`).join('')}</ol></div></div></div></div>`;
    },
  };

  let cur = null;                                   // the film that is open
  // each film's beats, fetched once: the watch feed asks for the next film's while this one plays, so a swipe opens it at once
  const beatsOf = new Map(), getBeats = id => {
    if (!beatsOf.has(id)) beatsOf.set(id, fetch(mediaUrl(id, '.json')).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { beatsOf.delete(id); throw e; }));
    return beatsOf.get(id);
  };
  let warm = null;                                  // the next film's voice, its first bytes only (preload=metadata); one at a time
  function prefetch(c) {
    if (!c || !c.id) return; getBeats(c.id).catch(() => {});
    if (warm && warm.dataset.id === c.id) return; if (warm) { warm.removeAttribute('src'); warm.load(); }
    warm = new Audio(); warm.preload = 'metadata'; warm.dataset.id = c.id; warm.muted = true; warm.src = mediaUrl(c.id, '.m4a');
  }
  function close() {
    if (!cur) return;
    const s = cur; cur = null; cancelAnimationFrame(s.raf);
    try { s.voice.pause(); s.bed.pause(); } catch (e) { /* not started */ }
    if (s.blobUrl) URL.revokeObjectURL(s.blobUrl);
    window.removeEventListener('keydown', s.onKey, true); window.removeEventListener('resize', s.fit); if (s.onUp) window.removeEventListener('pointerup', s.onUp); if (s.ro) s.ro.disconnect();
    try { const fe = document.fullscreenElement || document.webkitFullscreenElement; if (fe && s.root.contains(fe)) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* not full screen */ }
    try { s.voice.removeAttribute('src'); s.voice.load(); } catch (e) { /* already gone */ }      // let go of the stream at once
    s.citation?.remove();
    s.otherSources?.remove();
    s.root.remove(); document.documentElement.style.overflow = s.overflow;
    if (s.opener && s.opener.focus) s.opener.focus();
  }

  const TIER_TAG = { REDFLAG: 'Lead', OFFICIAL: 'Official finding', PROVEN: 'Proven', CHARGED: 'Charged' };   // what the film is about, by the case's tier
  function open(c, opener, opts = {}) {
    close();
    const inline = !!opts.host;                                                     // inline: inside a page element (the watch feed), not a full-screen dialog
    const root = document.createElement('div'); root.className = 'mv' + (inline ? ' mv-inline' : ''); root.setAttribute('role', inline ? 'region' : 'dialog'); if (!inline) root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Film: ' + c.title);
    root.innerHTML = `<div class="mv-wrap"><div class="mv-stage"><div class="mv-top"><b>SF Money Trail</b><span class="pill">${esc(TIER_TAG[c.tier] || 'Case')}</span><span class="ch"></span><div class="mv-prog" aria-hidden="true"></div><button type="button" class="mv-x" data-act="close" aria-label="Close the film" title="Close (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="mv-view"></div><div class="mv-view6" aria-hidden="true"></div><div class="mv-cap" aria-live="off"></div><div class="mv-msg">Opening the film…</div></div><button type="button" class="mv-bigplay" data-act="toggle" aria-label="Play the film"><span aria-hidden="true"></span></button></div>
      <div class="mv-bar"><div class="mv-chap"></div><button type="button" data-act="back" title="Back 10 seconds (Left arrow)" aria-label="Back 10 seconds">−10s</button><button type="button" class="play" data-act="toggle">Play</button><button type="button" data-act="fwd" title="Forward 10 seconds (Right arrow)" aria-label="Forward 10 seconds">+10s</button><span class="time">0:00 / 0:00</span>
        <div class="mv-scrub"><div class="ticks"></div><input type="range" min="0" max="100" step="0.01" value="0" aria-label="Position in the film"></div>
        <a class="mv-citation" target="_blank" rel="noopener noreferrer" hidden></a><button type="button" data-act="speed" title="Playing speed">1×</button><button type="button" data-act="cap" aria-pressed="true" title="Show or hide the words (C)">Words</button><button type="button" data-act="music" aria-pressed="true" title="Music and sounds on or off (M)">Sound bed</button><button type="button" data-act="voice" class="narr" aria-pressed="true" title="Narration on or off (N); the pictures and words keep playing"></button>
        <button type="button" data-act="full" title="Full screen (F)">Full screen</button><button type="button" data-act="close" title="Close (Esc)">Close</button></div>`;
    (inline ? opts.host : document.body).appendChild(root);
    if (!inline) root.appendChild(root.querySelector('.mv-x'));                    // the close X sits on the player, not in the scaled film, so it stays a full-size target on a phone
    const fsOK = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); if (!fsOK) root.querySelector('[data-act=full]').hidden = true;      // iPhone: no full screen for a page element
    const $ = q => root.querySelector(q), stage = $('.mv-stage'), view = $('.mv-view'), cap = $('.mv-cap'), range = $('.mv-scrub input');
    const voice = new Audio(), bed = new Audio(BASE + 'sfx/bed.m4a'); voice.preload = opts.noplay ? 'metadata' : 'auto'; voice.src = mediaUrl(c.id, '.m4a'); bed.loop = true; bed.volume = 0.16;
    ['play', 'playing'].forEach(e => voice.addEventListener(e, () => root.classList.add('mv-on'))); ['pause', 'ended'].forEach(e => voice.addEventListener(e, () => root.classList.remove('mv-on')));   // the big play button shows whenever the film is not playing
    const s = cur = { root, voice, bed, opener, narr: narrSaved(), overflow: document.documentElement.style.overflow, beats: [], view: null, bi: -2, music: true, still: opts.t != null ? +opts.t : null, dur: 0, sfx: {} };
    if (!inline) document.documentElement.style.overflow = 'hidden';
    if (inline) {                                                                   // the feed drives the voice element directly; the music follows it
      voice.addEventListener('play', () => { if (s.music) { const q = bed.play(); if (q && q.catch) q.catch(() => {}); } });
      voice.addEventListener('pause', () => bed.pause());
      voice.addEventListener('volumechange', () => { bed.muted = voice.muted; });
    }
    // narration on or off: the voice is muted, not paused, because its clock drives the pictures; the sound bed is separate (M)
    const showNarr = () => { const b = $('[data-act=voice]'); voice.muted = !s.narr; b.setAttribute('aria-pressed', String(s.narr)); b.innerHTML = `${SPEAKER(s.narr)}<span>${s.narr ? 'Narration on' : 'Narration off'}</span>`; };
    showNarr();
    if (s.still != null) root.classList.add('still');                              // a still for checking the pictures: no fades
    s.fit = () => {
      if (s.prepared && s.fitWidth !== innerWidth) { s.prepared.el.remove(); s.prepared = null; }
      s.fitWidth = innerWidth;
      const r = $('.mv-wrap').getBoundingClientRect(), k = Math.min(r.width / W, r.height / H); stage.style.transform = `translate(-50%, -50%) scale(${Math.max(.2, k)})`; }; s.fit(); window.addEventListener('resize', s.fit);
    if (window.ResizeObserver) { s.ro = new ResizeObserver(() => s.fit()); s.ro.observe($('.mv-wrap')); }           // the bar grows once the chapters arrive: refit then too
    // the film clock: the audio's own time, smoothed between its updates (some browsers move currentTime in steps) and never more than .25 s ahead of it
    const clk = { ct: -1, pt: 0, shown: 0 };
    voice.addEventListener('seeking', () => { s.jump = true; clk.ct = -1; });
    const now = () => {
      if (s.still != null) return s.still; if (s.want != null) return s.want;
      const ct = voice.currentTime || 0, pt = performance.now();
      const reset = clk.ct < 0 || voice.seeking || voice.paused || voice.ended || voice.readyState < 3;
      if (reset || ct !== clk.ct) { clk.ct = ct; clk.pt = pt; }
      const estimate = ct + Math.min(.25, (pt - clk.pt) / 1000 * (voice.playbackRate || 1));
      clk.shown = reset ? ct : Math.max(clk.shown, estimate);
      return Math.min(clk.shown, s.dur || Infinity);
    };
    s.now = now;
    s.citation = $('.mv-citation');
    if (opts.citationHost) opts.citationHost.appendChild(s.citation);
    s.citation.addEventListener('click', () => pause());
    s.otherSources = document.createElement('details');
    s.otherSources.className = 'mv-other-sources';
    s.otherSources.hidden = true;
    s.otherSources.innerHTML = '<summary></summary><ul></ul>';
    s.otherSources.addEventListener('toggle', () => { if (s.otherSources.open) pause(); });
    s.citation.after(s.otherSources);
    // seeking: a target set before the audio can seek is kept and applied as soon as it can (see seekable() and the blob below)
    const seek = t => { clk.ct = -1; t = clamp(t, 0, Math.max(0, (s.dur || voice.duration || 0) - .05)); if (s.still != null) s.still = t; else { s.want = t; applySeek(); } s.jump = true; };
    const applySeek = () => { if (s.want == null || voice.readyState < 1) return; const t = s.want; try { voice.currentTime = t; } catch (e) { return; } if (Math.abs(voice.currentTime - t) < .5 || seekable()) s.want = null; };
    voice.addEventListener('loadedmetadata', applySeek); voice.addEventListener('canplay', applySeek);
    const playing = () => s.still == null && !voice.paused && !voice.ended;
    const play = () => { if (s.still != null) { const t0 = s.still; s.still = null; root.classList.remove('still'); s.want = t0; applySeek(); } if (voice.ended && s.want == null) voice.currentTime = 0; const p = voice.play(); if (p && p.catch) p.catch(() => {}); if (s.music) { const q = bed.play(); if (q && q.catch) q.catch(() => {}); } };
    const pause = () => { voice.pause(); bed.pause(); };
    const sound = name => { if (!s.music || !name || s.still != null) return; try { const a = (s.sfx[name] = s.sfx[name] || new Audio(BASE + 'sfx/' + name + '.m4a')).cloneNode(); a.volume = name === 'whoosh' ? .22 : name === 'thud' ? .4 : .2; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* no sound */ } };
    voice.addEventListener('ended', () => bed.pause());
    // A server that ignores Range requests (python3 -m http.server, which `npm start` used to run) sends the audio as one
    // unseekable stream, and the browser then puts any seek back to 0. So the film is also fetched whole into memory; if the
    // stream turns out not to be seekable, playback moves to that copy at the same moment, playing or paused as it was.
    const seekable = () => { try { const r = voice.seekable, d = voice.duration; return r.length > 0 && isFinite(d) && r.end(r.length - 1) >= d - 1 && r.start(0) <= .5; } catch (e) { return false; } };
    if (s.still == null && window.fetch && window.URL && URL.createObjectURL) voice.addEventListener('loadedmetadata', () => {      // only when the stream cannot seek: most servers (GitHub Pages too) can, and then nothing is fetched twice
      if (cur !== s || seekable() || s.blobTried) return; s.blobTried = true;
      fetch(voice.src).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(blob => {
        if (cur !== s) return; const go = () => {
          if (cur !== s || seekable()) return;
          const t = s.want != null ? s.want : voice.currentTime || 0, was = !voice.paused && !voice.ended;
          s.blobUrl = URL.createObjectURL(blob); s.want = t; voice.src = s.blobUrl; voice.playbackRate = voice.defaultPlaybackRate; voice.muted = !s.narr;
          if (was) { const p = voice.play(); if (p && p.catch) p.catch(() => {}); }
        };
        if (voice.readyState >= 1) go(); else voice.addEventListener('loadedmetadata', go, { once: true });
      }).catch(() => { s.want = null; /* opened from a file, or offline: keep the stream */ });
    }, { once: true });
    if (s.still == null && !opts.noplay) play();                                   // inside the click that opened the film, so the browser lets the sound start

    const act = { toggle: () => (playing() ? pause() : play()), close: inline ? () => { location.hash = '#case/' + c.id; } : close, replay: () => { seek(0); play(); }, back: () => seek(now() - 10), fwd: () => seek(now() + 10),
      speed: b => { const r = [1, 1.25, 1.5, 0.85], i = (r.indexOf(voice.playbackRate) + 1) % r.length; voice.playbackRate = voice.defaultPlaybackRate = r[i]; b.textContent = r[i] + '×'; },
      cap: b => { const on = root.classList.toggle('nocap'); b.setAttribute('aria-pressed', String(!on)); try { localStorage.setItem(SUBS_KEY, on ? 'off' : 'on'); } catch (e) { /* this film only */ } },
      voice: () => { s.narr = !s.narr; showNarr(); try { localStorage.setItem(NARR_KEY, s.narr ? 'on' : 'off'); } catch (e) { /* private mode: this film only */ } },
      music: b => { s.music = !s.music; b.setAttribute('aria-pressed', String(s.music)); if (!s.music) bed.pause(); else if (playing()) bed.play().catch(() => {}); },
      full: () => { const d = document, fe = d.fullscreenElement || d.webkitFullscreenElement; try { if (fe) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else { const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* not allowed here */ } } };
    root.addEventListener('click', e => { let b = e.target.closest('[data-act]'), ch = e.target.closest('[data-seek]'); if (b && !root.contains(b)) b = null; if (ch && !root.contains(ch)) ch = null; if (b && act[b.dataset.act]) act[b.dataset.act](b); else if (ch) { seek(+ch.dataset.seek); if (!playing() && s.still == null) play(); } else if (!inline && e.target.closest('.mv-stage') && !e.target.closest('button')) act.toggle(); });
    range.addEventListener('input', () => seek(+range.value / 100 * s.dur));
    range.addEventListener('pointerdown', () => { s.drag = true; }); window.addEventListener('pointerup', s.onUp = () => { if (s.drag) { s.drag = false; range.blur(); } });
    range.addEventListener('change', () => { s.drag = false; });
    voice.addEventListener('loadedmetadata', () => { if (isFinite(voice.duration) && voice.duration > 1 && Math.abs(voice.duration - s.dur) > .3 && s.beats.length) { s.dur = voice.duration; if (s.chapters && s.chapters.length) { s.chapters[s.chapters.length - 1].t1 = s.dur; $('.mv-scrub .ticks').innerHTML = s.chapters.slice(1).map(x => `<i style="left:${(x.t / s.dur * 100).toFixed(2)}%"></i>`).join(''); } } });      // chapter ticks follow the real length   // the recording's real length
    s.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key;
      if (k === 'Escape') close(); else if (k === ' ' && !e.target.closest('button, a, input, summary')) act.toggle(); else if (k === 'ArrowRight' && e.target !== range) act.fwd(); else if (k === 'ArrowLeft' && e.target !== range) act.back();
      else if (/^c$/i.test(k)) act.cap($('[data-act=cap]')); else if (/^m$/i.test(k)) act.music($('[data-act=music]')); else if (/^n$/i.test(k)) act.voice(); else if (/^f$/i.test(k)) act.full();
      else if (k === ']' || k === '[') { const st = s.chapters.map(x => x.t), t = now(), j = k === ']' ? st.findIndex(x => x > t + .2) : st.length - 1 - [...st].reverse().findIndex(x => x < t - 1.5); if (st[j] != null) seek(st[j]); }
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    if (!inline) { window.addEventListener('keydown', s.onKey, true); $('.play').focus(); }

    getBeats(c.id).then(m => {
      if (cur !== s) return;
      s.v6 = m.format === 6 && !!window.FD_FILM6;
      root.classList.toggle('mv-legacy', !s.v6);
      s.beats = m.beats.map((b, i) => ({ ...b, i, view: s.v6 ? b.scene : VIEW[b.scene] || b.scene })); s.dur = m.seconds; $('.mv-msg').remove();
      if (s.v6) {                                                                  // a written film: shots, drawn by assets/movie6.js
        root.classList.add('v6'); s.names6 = m.chapters || {}; s.shots = [];
        let previous, previousTable;
        for (const b of s.beats) {
          const kind = b.visual?.type;
          const table = tableKinds.has(kind) ? JSON.stringify(b.visual) : null;
          const sameShot = previous && previous.shot === b.shot && previous.visual?.type === kind;
          // Some narration continues an unchanged table under a different authored shot ID.
          // Keep its DOM and page clock until the displayed record actually changes.
          if (!sameShot && !(table && table === previousTable)) {
            s.shots.push({id:b.shot, kind, beats:[], k:s.shots.length});
          }
          const shot = s.shots[s.shots.length - 1];
          b.si = shot.k;
          b.step = shot.beats.length;
          shot.beats.push(b);
          previous = b;
          previousTable = table;
        }
        s.shots.forEach((sh, k) => { sh.t0 = k ? sh.beats[0].t0 : 0; }); s.shots.forEach((sh, k) => { sh.t1 = k + 1 < s.shots.length ? s.shots[k + 1].t0 : s.dur; });
        let subs = null; try { subs = localStorage.getItem(SUBS_KEY); } catch (e) { /* none saved */ }
        if (subs === 'off') { root.classList.add('nocap'); $('[data-act=cap]').setAttribute('aria-pressed', 'false'); }
        $('[data-act=cap]').textContent = 'Subtitles'; $('[data-act=cap]').title = 'Subtitles on or off (C)';
        s.look = m.look || 'midnight'; root.classList.add('look-' + s.look);
        s.beats.forEach(b => { const k = capsOf(b); (b.emph || []).forEach(e => { const tk = norm(e).split(' '), i = k.ws.findIndex((w, j) => tk.every((x, n) => norm(k.ws[j + n] || '') === x)); if (i < 0) return; tk.forEach((_, n) => k.em.add(i + n)); }); });
      }
      // chapters: where each view first starts
      s.chapters = []; s.beats.forEach(b => { if (!s.chapters.length || s.chapters[s.chapters.length - 1].view !== b.view) s.chapters.push({ view: b.view, t: Math.max(0, b.t0 - .15) }); });
      const chName = v => (s.v6 ? s.names6[v] : CHAPTER[v]) || v;
      s.chName = chName; s.chapters.forEach((x, k) => { x.t1 = k + 1 < s.chapters.length ? s.chapters[k + 1].t : s.dur; });
      $('.mv-chap').innerHTML = s.chapters.map(x => `<button type="button" data-seek="${x.t}" data-view="${x.view}">${esc(chName(x.view))}</button>`).join('');
      $('.mv-prog').innerHTML = s.chapters.map(x => `<i style="flex:${Math.max(1, x.t1 - x.t).toFixed(1)}"><b></b></i>`).join('');
      $('.mv-scrub .ticks').innerHTML = s.chapters.slice(1).map(x => `<i style="left:${(x.t / s.dur * 100).toFixed(2)}%"></i>`).join('');
      s.progressParts = Array.from(root.querySelectorAll('.mv-prog i'));
      // which people and bodies each story passage names (their whole name, or its first two words)
      const A = c.actors || [], keys = A.map(a => { const n = a.name.toLowerCase(), w = n.split(/\s+/); return [n, w.length > 2 && w[0].length > 3 && w[1].length > 3 ? w.slice(0, 2).join(' ') : null].filter(Boolean); });
      s.names = b => { const t = b.text.toLowerCase(); return keys.map((ks, j) => (ks.some(k => t.includes(k)) ? j : -1)).filter(j => j >= 0); };
      s.raf = requestAnimationFrame(frame);
    }).catch(() => { if (cur === s) $('.mv-msg').textContent = 'This film could not be opened. It may not have been built yet: run scripts/movies/build_movies.py.'; });

    // the chapter strip at the top, the subtitles, the bar: the same for both kinds of film
    const timeLabel = $('.time'), playButton = $('.play');
    function chrome(t, b, bi, p) {
      if (s.citationBeat !== bi) {
        s.citationBeat = bi;
        const cited = window.FD_FILM6?.sourcesFor(b, c) || [];
        const sources = cited.flatMap(row => {
          const downloads = (row.downloads || []).filter(file => /^https:\/\//.test(file.url));
          return row.downloadRole === 'alternate' ? [...downloads, row] : [row, ...downloads];
        });
        const unique = sources.filter((row, i) => sources.findIndex(other => other.url === row.url) === i);
        const source = unique[0];
        const extra = unique.slice(1);
        s.otherSources.open = false;
        s.otherSources.hidden = !extra.length;
        if (extra.length) {
          s.otherSources.querySelector('summary').textContent = 'More sources (' + extra.length + ')';
          s.otherSources.querySelector('ul').innerHTML = extra.map(row => '<li><a target="_blank" rel="noopener noreferrer" href="' + esc(row.url) + '">' + esc(row.title) + '</a></li>').join('');
        }
        const link = s.citation;
        link.hidden = !source;
        if (source) {
          link.href = source.url;
          link.textContent = 'Open source ↗';
          link.title = source.title;
          link.setAttribute('aria-label', 'Open source in a new tab: ' + source.title);
        }
      }
      const ci = s.chapters.findIndex(x => t >= x.t && t < x.t1);
      if (ci !== s.chapterIndex) {
        s.progressParts.forEach((el, k) => {
          el.firstChild.style.transform = k < ci || t >= s.dur ? 'scaleX(1)' : 'scaleX(0)';
          el.classList.toggle('cur', k === ci);
        });
        s.chapterIndex = ci;
      }
      if (ci >= 0) {
        const ch = s.chapters[ci];
        s.progressParts[ci].firstChild.style.transform = 'scaleX(' + clamp((t - ch.t) / Math.max(.1, ch.t1 - ch.t)) + ')';
      }
      if (!s.ready) { s.ready = true; opts.onReady?.(); }
      opts.onProgress?.(t, s.dur);
      if (s.v6) caps6(b, bi, p); else {
        const words = b.text.split(/\s+/), n = Math.max(1, Math.ceil(words.length / 15)), per = Math.ceil(words.length / n), j = Math.min(n - 1, Math.floor(p * n)), line = bi < 0 ? '' : words.slice(j * per, (j + 1) * per).join(' ');
        if (cap.textContent !== line) cap.textContent = line;
      }
      if (!s.drag) { const v = s.dur ? (t / s.dur * 100) : 0; if (Math.abs(+range.value - v) > .01) range.value = v; }
      const label = fmtT(t) + ' / ' + fmtT(s.dur);
      if (timeLabel.textContent !== label) timeLabel.textContent = label;
      const action = playing() ? 'Pause' : voice.ended ? 'Play again' : 'Play';
      if (playButton.textContent !== action) playButton.textContent = action;
    }
    // Keep a complete phrase on screen. Word timestamps select the next phrase
    // even when the browser skips display frames or playback jumps during a seek.
    function norm(w) { return String(w).toLowerCase().replace(/[^a-z0-9$.%']/g, '').replace(/[.']+$/, ''); }
    function capsOf(b) {
      if (!b.caps) { const ws = b.text.split(/\s+/).filter(Boolean), d = Math.max(.2, b.t1 - b.t0); let at;
        if (Array.isArray(b.wt) && b.wt.length) at = ws.map((_, i) => clamp((b.wt[Math.min(b.wt.length - 1, Math.round(i * (b.wt.length - 1) / Math.max(1, ws.length - 1)))] || 0) / d));
        else { const wt = ws.map(w => w.replace(/[^\w$]/g, '').length + 2 + (/[.,;:?!]$/.test(w) ? 3 : 0)), tot = wt.reduce((x, y) => x + y, 0); let acc = 0; at = wt.map(x => { const a = acc / tot; acc += x; return a; }); }
        const gs = [];
        let group = [], length = 0;
        for (let i = 0; i < ws.length; i++) {
          if (group.length && length + 1 + ws[i].length > 42) {
            gs.push(group); group = []; length = 0;
          }
          group.push(i);
          length += ws[i].length + (group.length > 1 ? 1 : 0);
          if (group.length >= 8 || (group.length >= 3 && /[.!?;:]$/.test(ws[i]))) {
            gs.push(group); group = []; length = 0;
          }
        }
        if (group.length) gs.push(group);
        b.caps = { ws, at, gs, em: new Set() };
      }
      return b.caps;
    }
    function caps6(b, bi, p) {
      if (bi < 0) { if (cap.firstChild) cap.replaceChildren(); s.captionGroup = null; return; }
      const { ws, at, gs, em } = capsOf(b);
      let wi = 0;
      while (wi + 1 < at.length && at[wi + 1] <= p) wi++;
      const group = gs.find(g => g.includes(wi));
      if (!group) return;
      if (group !== s.captionGroup) {
        cap.innerHTML = '<span class="cg">' + group.map(i => '<span' + (em.has(i) ? ' class="em"' : '') + '>' + esc(ws[i]) + '</span>').join(' ') + '</span>';
        s.captionGroup = group;
      }
    }

    const view6 = $('.mv-view6');
    const prep = document.createElement('div');
    prep.className = 'mv-prep6';
    prep.inert = true;
    prep.setAttribute('aria-hidden', 'true');
    view6.after(prep);
    function warmNext(t, sh) {
      const next = s.shots[sh.k + 1];
      if (!next || !playing() || voice.seeking || s.prepared?.k === next.k) return;
      const first = next.beats[0], remaining = first.t0 - t;
      if (remaining > .7 || remaining <= 0) return;
      const shot = window.FD_FILM6.shot(next.beats, c, next.k);
      prep.replaceChildren(shot.el);
      shot.update({t: first.t0, lt: first.t0 - next.t0, dur: Math.max(1, next.t1 - next.t0), i: 0, bp: 0, bt: 0});
      s.prepared = {k: next.k, ...shot};
    }
    function frame6(t, bi) {
      const b = s.beats[Math.max(0, bi)], sh = s.shots[b.si], p = bi < 0 ? 0 : clamp((t - b.t0) / Math.max(.2, b.t1 - b.t0));
      const changed = !s.cur6 || s.cur6.k !== sh.k;
      if (changed) {
        view6.setAttribute('aria-hidden', String(sh.kind !== 'end'));
        s.cur6 = s.prepared?.k === sh.k ? s.prepared : {k: sh.k, ...window.FD_FILM6.shot(sh.beats, c, sh.k)};
        s.prepared = null;
        s.cur6.el.classList.add('in');
        // Swap the entire prepared plate in one paint. A late frame can skip a
        // cue without ever displaying an empty or partially visible frame.
        view6.replaceChildren(s.cur6.el);
        prep.replaceChildren();
      }
      if (b.view !== s.view) {
        s.view = b.view;
        $('.mv-top .ch').textContent = s.chName(b.view);
        root.querySelectorAll('.mv-chap button').forEach(x => {
          const on = x.dataset.view === b.view;
          x.classList.toggle('cur', on);
          if (on && !inline && s.still == null && x.parentNode.scrollTo) x.parentNode.scrollTo({left: Math.max(0, x.offsetLeft - 40), behavior: 'instant'});
        });
      }
      const lt = Math.max(0, t - sh.t0), dur = Math.max(1, sh.t1 - sh.t0);
      try { s.cur6.update({t, lt, dur, i: b.step, bp: p, bt: Math.max(0, t - b.t0)}); }
      catch (e) { if (!s.err6) { s.err6 = 1; console.error(e); } }
      if (bi !== s.bi && bi === s.bi + 1 && !s.jump && playing() && b.step > 0) sound(window.FD_FILM6.SFX[b.kind]);
      s.bi = bi;
      s.jump = false;
      chrome(t, b, bi, p);
      warmNext(t, sh);
    }
    function frame() {
      if (cur !== s) return; s.raf = requestAnimationFrame(frame);
      const t = now(), beats = s.beats; let bi = -1;
      if (t === s.lastT && !playing() && !s.jump && voice.paused === s.lastPaused) return; s.lastPaused = voice.paused; s.lastT = t;      // paused and nothing moved: no work this frame
      for (let lo = 0, hi = beats.length - 1; lo <= hi;) { const mid = (lo + hi) >> 1; if (beats[mid].t0 <= t) { bi = mid; lo = mid + 1; } else hi = mid - 1; }
      if (s.v6) return frame6(t, bi);
      const b = beats[Math.max(0, bi)], p = bi < 0 ? 0 : clamp((t - b.t0) / Math.max(.2, b.t1 - b.t0));
      if (b.view !== s.view) {
        s.view = b.view; s.bi = -2; const render = draw[b.view];
        view.dataset.graphics = 'legacy';
        view.innerHTML = render ? render(c, beats.filter(x => x.view === b.view)) : '<div class="v-open"><h1>' + esc(b.text || c.title) + '</h1></div>';
        $('.mv-top .ch').textContent = CHAPTER[b.view] || ''; root.querySelectorAll('.mv-chap button').forEach(x => x.classList.toggle('cur', x.dataset.view === b.view));
        const r = view.querySelector('[data-roll]'); if (r) { s.roll = r; s.sourcePage = -1; }
      }
      if (bi !== s.bi) {
        const step = bi === s.bi + 1 && !s.jump; s.jump = false; view.classList.add('in');
        view.querySelectorAll('[data-b]').forEach(el => { const k = +el.dataset.b; el.classList.toggle('on', k <= bi); el.classList.toggle('now', k === bi && !el.hasAttribute('data-extra')); });
        // follow the passage being read (story, timeline)
        const f = view.querySelector('[data-follow]'), nowEl = f && f.querySelector('.now');
        if (f && nowEl) f.style.transform = `translateY(${Math.round((f.parentNode.clientHeight || 500) * .42 - nowEl.offsetTop - nowEl.offsetHeight / 2)}px)`;
        if (b.view === 'story') { const hit = b.kind === 'para' ? s.names(b) : []; view.querySelectorAll('[data-actor]').forEach(el => el.classList.toggle('hit', hit.includes(+el.dataset.actor))); }
        if (b.view === 'map') {
          const l = b.kind === 'link' ? (c.links || [])[b.ref] : null, box = view.querySelector('.m-now'), nm = id => ((c.actors || []).find(a => a.id === id) || {}).name || id;
          view.querySelectorAll('.m-node').forEach(el => el.classList.toggle('end', !!l && (el.dataset.node === l.from || el.dataset.node === l.to)));
          box.classList.toggle('show', !!l); if (l) box.innerHTML = `<span class="kd">${esc(KIND[l.kind] || l.kind)}</span><b>${esc(nm(l.from))} → ${esc(nm(l.to))}:</b> ${esc(l.label || '')}${l.detail ? ` <span class="dt">— ${esc(l.detail)}</span>` : ''}`;
        }
        if (b.view === 'points') {
          const ref = b.ref == null ? -1 : b.ref;
          view.querySelectorAll('.p-card').forEach(el => { const on = +el.dataset.pt === ref; el.classList.toggle('show', on); if (on) el.querySelectorAll('.blk').forEach(k => k.classList.toggle('lit', (b.kind === 'what' && k.classList.contains('what')) || (b.kind === 'why' && k.classList.contains('why')) || (b.kind === 'point' && k.classList.contains('what')))); });
          view.querySelectorAll('.p-list li').forEach(el => el.classList.toggle('cur', +el.dataset.pt === ref));
        }
        if (step && playing()) sound(SFX[b.kind]);
        s.bi = bi;
      }
      if (b.view === 'close' && s.roll) {
        const start = beats.find(x => x.view === 'close' && x.kind === 'sources');
        const height = s.roll.parentNode.clientHeight || 300;
        const extent = Math.max(0, s.roll.scrollHeight - height);
        const pages = Math.ceil(extent / height) + 1;
        const phase = start ? clamp((t - start.t0) / Math.max(1, s.dur - start.t0)) : 0;
        const page = Math.min(pages - 1, Math.floor(phase * pages));
        if (page !== s.sourcePage) {
          s.roll.style.transform = 'translateY(' + -Math.min(extent, page * height) + 'px)';
          s.sourcePage = page;
        }
      }
      chrome(t, b, bi, p);
    }
    return s;
  }

  window.FDMOVIE = { open, close, prefetch, has: c => !!(c && c.movie) };
  // a still of any moment, for checking the pictures: /?movie=<case id>&t=<seconds>
  window.addEventListener('load', () => { const q = new URLSearchParams(location.search), id = q.get('movie'); if (!id) return; const c = ((window.FD_CORE || {}).cases || []).find(x => x.id === id); if (c) setTimeout(() => open(c, null, { t: +(q.get('t') || 0) }), 60); });
})();
