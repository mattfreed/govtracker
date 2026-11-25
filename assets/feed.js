/* SF Money Trail — the watch feed: every case's film, one per screen, like a reel. Scroll, swipe or press ↓ for the next; a
   film that ends moves on to the next by itself. Each film plays live in the case pages' player (assets/movie.js) from its
   narration and timings, so new audio shows at once with no video to re-render; only the film on screen is open. Tap the title or "Open the full case" for the case file. */
(() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const TIER = { PROVEN: 'Proven', CHARGED: 'Charged', OFFICIAL: 'Official finding', REDFLAG: 'Lead' };
  const CHIPS = [['', 'All'], ['REDFLAG', 'Leads'], ['OFFICIAL', 'Official findings'], ['CHARGED', 'Charged'], ['PROVEN', 'Proven']];
  const PHASE = { convicted: 'Convicted', 'in-court': 'In court', active: 'Active', past: 'Closed' };
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } } };
  const ICON = {
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14 21 3M21 3h-6M21 3v6"/><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  };
  let cur = null;                                                     // the feed on screen: { root, list, i, obs, onKey }

  /* the order (owner, 24 Nov 2026): ranked by the watch-rank screen (engaging story + likelihood of fraud, waste or abuse).
     The first three rounds show one of each kind (proven, charged, official finding, lead), strongest first; after that the next film is the
     highest-ranked case whose kind differs from the one before. When one kind is all that is left, neighbours differ in topic where they can. */
  function ordered(cases, tier) {
    const has = cases.filter(c => c.reel && (!tier || c.tier === tier));
    const sc = c => (c.reel && c.reel.score != null ? c.reel.score : -1), amt = c => (c.amount && c.amount.kind !== 'none' && +c.amount.value) || 0;
    has.sort((a, b) => sc(b) - sc(a) || amt(b) - amt(a));
    if (tier) return has;
    const left = has.slice(), out = [], take = c => { left.splice(left.indexOf(c), 1); out.push(c); };
    const KINDS = ['PROVEN', 'CHARGED', 'OFFICIAL', 'REDFLAG'];
    for (let round = 0; round < 3; round++) {
      const picks = KINDS.map(t => left.find(c => c.tier === t)).filter(Boolean).sort((a, b) => sc(b) - sc(a));
      if (out.length && picks.length > 1 && picks[0].tier === out[out.length - 1].tier) picks.push(picks.shift());   // no repeat across rounds
      picks.forEach(take);
    }
    while (left.length) {
      const prev = out[out.length - 1];
      const c = left.find(x => x.tier !== prev.tier) || left.find(x => x.category !== prev.category) || left[0];
      take(c);
    }
    return out;
  }

  function reel(c, i, list) {
    const r = c.reel, nx = list && list[i + 1];
    return `<section class="reel" data-i="${i}" data-id="${esc(c.id)}" aria-label="${esc(c.title)}">
      <div class="reel-bg" data-bg="assets/films/${esc(r.poster)}"></div>
      <div class="reel-stage">
        <div class="reel-frame" data-act="toggle"><div class="reel-live" aria-label="Film: ${esc(c.title)}"></div>
          <img src="assets/films/${esc(r.poster)}" alt="" loading="${i < 2 ? 'eager' : 'lazy'}"><div class="reel-big"><span></span></div>
          <button type="button" class="reel-sound" data-act="unmute">${ICON.sound} Tap for sound</button><button type="button" class="reel-pp" data-act="toggle" aria-label="Play or pause"><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg></button>${nx ? `<button type="button" class="reel-next" data-act="next"><span>Up next</span><b>${esc(nx.title)}</b> ${ICON.down}</button>` : ''}<div class="reel-prog" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="${Math.round(r.s)}" aria-valuenow="0"><i></i><b></b><span class="reel-time">0:00 / ${mmss(r.s)}</span></div></div>
        <div class="reel-info">
          <div class="reel-tags"><span class="rt-tier t-${esc(c.tier)}">${esc(TIER[c.tier] || c.tier)}</span>${c.phase && PHASE[c.phase] ? `<span>${esc(PHASE[c.phase])}</span>` : ''}<span class="rt-sep">${esc(c.category || '')}</span><span class="rt-sep">${mmss(r.s)} film</span></div>
          <h2><a href="#case/${esc(c.id)}">${esc(c.title)}</a></h2>
          <p class="reel-line">${esc(c.oneLine || '')}</p>
          <a class="reel-open" href="#case/${esc(c.id)}">Open the full case →</a>
        </div>
      </div>
      <nav class="reel-rail" aria-label="Film controls">
        <button type="button" data-act="mute" data-tip="Sound on or off (M)"></button>
        <a href="#case/${esc(c.id)}" data-tip="Case file, sources and every record">${ICON.file}</a>
        <button type="button" data-act="share" data-tip="Copy a link to this film">${ICON.share}</button>
        <button type="button" data-act="prev" data-tip="Previous (↑)">${ICON.up}</button>
        <button type="button" data-act="next" data-tip="Next (↓)">${ICON.down}</button>
      </nav>
    </section>`;
  }

  // What each label means: the same four steps the case pages use, strongest first. Kept in one place so the strip
  // above the feed and the end-of-feed note say the same thing.
  const MEANS = [
    ['PROVEN', 'Proven', 'A court conviction, a guilty plea, or conduct the person or company formally admitted.', 'Convicted, pleaded guilty or admitted.'],
    ['CHARGED', 'Charged', 'Prosecutors or the City Attorney have filed charges or a lawsuit. A court has not decided it; a charge is not proof.', 'Charged or sued; no court decision yet.'],
    ['OFFICIAL', 'Official finding', 'An auditor, the Controller, the Ethics Commission, a regulator or a grand jury put it in writing. Not a criminal finding.', 'Found in writing by an auditor or regulator.'],
    ['REDFLAG', 'Lead', 'A pattern in the public records that no authority has ruled on. A question, not an accusation; each case says what is established and what is not.', 'Unexplained in the records; a question, not an accusation.'],
  ];
  function legend() {
    return `<section class="feed-legend" aria-label="What the labels mean"><span class="fg-h">What the labels mean</span><ul>${MEANS.map(([k, t, d, sh]) =>
      `<li><span class="rt-tier t-${k}">${esc(t)}</span><span class="fg-d">${esc(d)}</span><span class="fg-s">${esc(sh)}</span></li>`).join('')}</ul></section>`;
  }

  function render(C, startId, tier) {
    const list = ordered(C.cases, tier), counts = {}, first = Math.max(0, list.findIndex(c => c.id === startId));
    C.cases.forEach(c => { if (c.reel) { counts[c.tier] = (counts[c.tier] || 0) + 1; counts[''] = (counts[''] || 0) + 1; } });
    return `<h1 class="sr-only">Watch the cases</h1>${legend()}<div class="feed${store.get('fd.sound') === 'on' ? '' : ' muted'}" id="feed" data-tier="${esc(tier || '')}" data-start="${esc(startId || '')}">
      <div class="feed-bar">${CHIPS.map(([k, t]) => `<button type="button" class="feed-chip" data-tier="${k}" aria-pressed="${(tier || '') === k}">${t}<b>${counts[k] || 0}</b></button>`).join('')}
        <span class="feed-count" aria-live="polite">1 / ${list.length}</span><a class="feed-all" href="#cases">All cases as a list</a></div>
      <aside class="feed-list" aria-label="All films"><div class="fl-head">${list.length} films · scroll for the next</div><ol>${list.map((c, i) => `<li><button type="button" data-go="${i}"${i === first ? ' class="on" aria-current="true"' : ''}><span class="fl-n">${i + 1}</span><img src="assets/films/${esc(c.reel.poster)}" alt="" loading="lazy"><span class="fl-t"><span class="fl-title">${esc(c.title)}</span><span class="fl-meta"><i class="t-${esc(c.tier)}"></i>${esc(TIER[c.tier] || c.tier)} · ${mmss(c.reel.s)}</span></span></button></li>`).join('')}</ol></aside>
      <div class="feed-scroll" id="feed-scroll" tabindex="-1">${list.map((c, i) => reel(c, i, list)).join('')}
        <section class="reel"><div class="reel-end"><h2>That’s every film.</h2><p>${list.length} cases, each from the public record. A lead is a question, not an accusation; every case file says what is established and what is not.</p>
          <div class="row"><a class="primary" href="#cases">Browse all cases</a><a href="#briefing">Read the briefing</a><a href="#" data-act="top">Start again</a></div></div></section>
      </div><div class="feed-hint">Swipe up for the next film<span class="k"> · or scroll, or press ↓</span></div></div>`;
  }

  function mount(C) {
    leave();
    const root = document.getElementById('feed'); if (!root) return;
    const hdr = document.querySelector('header.top'); document.documentElement.style.setProperty('--fd-hdr', (hdr ? hdr.offsetHeight : 58) + 'px');
    const lg = document.querySelector('.feed-legend'), fitLegend = () => document.documentElement.style.setProperty('--fd-leg', (lg ? lg.offsetHeight : 0) + 'px');
    fitLegend(); window.removeEventListener('resize', mount.fit || (() => {})); mount.fit = fitLegend; window.addEventListener('resize', fitLegend);
    const scroller = root.querySelector('#feed-scroll'), reels = [...root.querySelectorAll('.reel[data-id]')], counter = root.querySelector('.feed-count'), items = [...root.querySelectorAll('.feed-list [data-go]')];
    const s = cur = { root, reels, i: -1, sound: store.get('fd.sound') === 'on', byId: Object.fromEntries((C.cases || []).map(c => [c.id, c])), media: null, mi: -1 };
    /* each film plays live in the same player as the case pages (assets/movie.js), built from its narration and timings, so a
       new recording shows at once with nothing to re-render. Only the film on screen is open; its voice track is the clock. */
    const vid = i => (s.mi === i ? s.media : null);
    const openLive = i => {
      if (s.mi === i && s.media) return s.media;
      if (window.FDMOVIE) window.FDMOVIE.close(); s.media = null; s.mi = -1;
      const c = s.byId[reels[i].dataset.id], host = reels[i].querySelector('.reel-live'); if (!c || !host || !window.FDMOVIE) return null;
      const h = window.FDMOVIE.open(c, null, { host, noplay: true }); if (!h) return null;
      s.media = h.voice; s.mi = i; wire(i, h.voice); return h.voice;
    };
    const muteIcon = () => root.querySelectorAll('[data-act=mute]').forEach(b => { b.innerHTML = s.sound ? ICON.sound : ICON.mute; });
    const setSound = on => { s.sound = on; store.set('fd.sound', on ? 'on' : 'off'); root.classList.toggle('muted', !on); reels.forEach((_, k) => { const v = vid(k); if (v) v.muted = !on; }); muteIcon(); };
    const play = i => { s.watching = true; const v = vid(i) || openLive(i); if (!v) return; v.muted = !s.sound; const p = v.play(); if (p && p.catch) p.catch(() => { if (!v.muted) { v.muted = true; root.classList.add('muted'); v.play().catch(() => {}); } }); };
    const activate = i => {
      if (i === s.i || !reels[i]) return; s.i = i;
      for (let k = Math.max(0, i - 2); k <= Math.min(reels.length - 1, i + 3); k++) { const bg = reels[k].querySelector('.reel-bg[data-bg]'); if (bg) { bg.style.backgroundImage = `url('${bg.dataset.bg}')`; bg.removeAttribute('data-bg'); } }   // covers load only near the film on screen
      reels.forEach(r => r.classList.remove('playing', 'started'));
      openLive(i); if (s.watching) play(i);                                     // nothing plays until the viewer taps play (owner, 24 Nov 2026); after that, the next film carries on
      counter.textContent = `${i + 1} / ${reels.length}`; items.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }); if (items[i]) { const ol = items[i].closest('.feed-list'), bt = items[i]; if (ol && (bt.offsetTop < ol.scrollTop + 40 || bt.offsetTop + bt.offsetHeight > ol.scrollTop + ol.clientHeight - 20)) ol.scrollTo({ top: bt.offsetTop - ol.clientHeight / 3, behavior: 'smooth' }); } if (i > 0) root.classList.add('moved');
      try { history.replaceState(null, '', '#watch/' + reels[i].dataset.id + (root.dataset.tier ? '?tier=' + root.dataset.tier : '')); } catch (e) { /* file: */ }
      document.title = reels[i].getAttribute('aria-label') + ' — SF Money Trail';
    };
    const go = i => { const target = i < reels.length ? reels[i] : scroller.lastElementChild; if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const shows = [];
    function wire(k, v) {                                                             // the open film's voice track drives this reel's play state, bar and auto-advance
      const r = reels[k];
      v.addEventListener('playing', () => { r.classList.add('playing', 'started'); const nx = reels[k + 1]; if (nx && window.FDMOVIE && window.FDMOVIE.prefetch) window.FDMOVIE.prefetch(s.byId[nx.dataset.id]); });      // the next film's beats and first audio bytes, so a swipe opens it at once
      v.addEventListener('pause', () => r.classList.remove('playing'));
      v.addEventListener('timeupdate', shows[k]); v.addEventListener('seeked', shows[k]);
      v.addEventListener('ended', () => { r.classList.remove('playing'); if (s.i === k) go(k + 1); });
    }
    reels.forEach((r, k) => {
      const bar = r.querySelector('.reel-prog i');
      const prog = r.querySelector('.reel-prog'), tl = r.querySelector('.reel-time'), knob = prog.querySelector('b');
      const show = shows[k] = () => { const v = vid(k); if (!v || !v.duration || !isFinite(v.duration)) return; const f = v.currentTime / v.duration; r.classList.toggle('ending', v.duration - v.currentTime < 12); bar.style.width = (f * 100).toFixed(2) + '%'; knob.style.left = (f * 100).toFixed(2) + '%'; tl.textContent = mmss(v.currentTime) + ' / ' + mmss(v.duration); prog.setAttribute('aria-valuenow', Math.round(v.currentTime)); };
      /* scrubbing: press or drag on the bar to move through the film */
      const seekTo = x => { const v = vid(k) || openLive(k); if (!v) return; const b = prog.getBoundingClientRect(), f = Math.max(0, Math.min(1, (x - b.left) / b.width)); const go2 = () => { v.currentTime = f * v.duration; show(); }; if (v.duration && isFinite(v.duration)) go2(); else v.addEventListener('loadedmetadata', go2, { once: true }); bar.style.width = knob.style.left = (f * 100).toFixed(2) + '%'; };
      prog.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (k !== s.i) { go(k); return; } const v = vid(k) || openLive(k); if (!v) return; prog.setPointerCapture(e.pointerId); prog.classList.add('drag'); s.wasPaused = v.paused; v.pause(); seekTo(e.clientX); });
      prog.addEventListener('pointermove', e => { if (prog.classList.contains('drag')) seekTo(e.clientX); });
      const up = e => { if (!prog.classList.contains('drag')) return; prog.classList.remove('drag'); seekTo(e.clientX); if (!s.wasPaused || !r.classList.contains('started')) play(k); };
      prog.addEventListener('pointerup', up); prog.addEventListener('pointercancel', up);
      prog.addEventListener('click', e => e.stopPropagation());
      prog.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); const v = vid(k); if (v && v.duration) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + (e.key === 'ArrowLeft' ? -5 : 5))); } });
    });
    s.obs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.intersectionRatio >= .6) activate(+e.target.dataset.i); }), { root: scroller, threshold: [.6] });
    reels.forEach(r => s.obs.observe(r));
    /* touch: the film follows the finger; a flick up (or a drag past a fifth of the screen) is the next film, down the one before.
       Native snapping is switched off for the drag and back on once the move to the chosen film has settled. */
    const all = [...scroller.children], at = () => Math.round(scroller.scrollTop / Math.max(1, scroller.clientHeight));
    let tch = null;
    scroller.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || e.target.closest('.reel-prog, .feed-list')) { tch = null; return; }
      tch = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: performance.now(), top: scroller.scrollTop, from: at(), dir: 0 };
    }, { passive: true });
    scroller.addEventListener('touchmove', e => {
      if (!tch) return; const dy = tch.y - e.touches[0].clientY, dx = tch.x - e.touches[0].clientX;
      if (!tch.dir) { if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return; tch.dir = Math.abs(dy) >= Math.abs(dx) ? 'v' : 'h'; }
      if (tch.dir !== 'v') return;
      e.preventDefault(); scroller.style.scrollSnapType = 'none'; scroller.style.scrollBehavior = 'auto';
      const max = (all.length - 1) * scroller.clientHeight;
      scroller.scrollTop = Math.max(0, Math.min(max, tch.top + dy * (tch.from === 0 && dy < 0 || tch.from === all.length - 1 && dy > 0 ? .3 : 1)));
    }, { passive: false });
    const settle = () => { clearTimeout(s.snapT); s.snapT = setTimeout(() => { scroller.style.scrollSnapType = ''; scroller.style.scrollBehavior = ''; }, 650); };
    scroller.addEventListener('touchend', e => {
      if (!tch || tch.dir !== 'v') { tch = null; return; }
      const dy = tch.y - e.changedTouches[0].clientY, ms = performance.now() - tch.t, h = scroller.clientHeight;
      const step = (Math.abs(dy) > h * .2 || (Math.abs(dy) > 30 && Math.abs(dy) / ms > .35)) ? Math.sign(dy) : 0;
      const to = Math.max(0, Math.min(all.length - 1, tch.from + step)); tch = null;
      scroller.scrollTo({ top: to * h, behavior: 'smooth' }); settle();
    }, { passive: true });
    scroller.addEventListener('touchcancel', () => { if (tch) { scroller.scrollTo({ top: tch.from * scroller.clientHeight, behavior: 'smooth' }); settle(); } tch = null; }, { passive: true });
    root.addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g) { go(+g.dataset.go); return; }
      const b = e.target.closest('[data-act], [data-tier]'); if (!b || !root.contains(b)) return;
      if (b.classList.contains('feed-chip')) { location.hash = b.dataset.tier ? '#watch?tier=' + b.dataset.tier : '#watch'; return; }
      const a = b.dataset.act, r = b.closest('.reel'), k = r && r.dataset.i != null ? +r.dataset.i : s.i;
      if (a === 'toggle') { e.preventDefault(); if (k !== s.i) { go(k); return; } if (!s.watching) setSound(true); const v = vid(k); if (!v || v.paused) play(k); else v.pause(); }
      else if (a === 'unmute') { e.stopPropagation(); setSound(true); play(s.i); }
      else if (a === 'mute') setSound(!s.sound);
      else if (a === 'next') go(k + 1); else if (a === 'prev') go(Math.max(0, k - 1));
      else if (a === 'top') { e.preventDefault(); go(0); }
      else if (a === 'share') { const u = location.href.split('#')[0] + '#watch/' + r.dataset.id; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => { b.dataset.tip = 'Link copied'; setTimeout(() => { b.dataset.tip = 'Copy a link to this film'; }, 1600); }).catch(() => prompt('Link to this film', u)); }
    });
    s.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'j') go(s.i + 1);
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k') go(Math.max(0, s.i - 1));
      else if (k === ' ') { const v = vid(s.i); if (v) v.paused ? play(s.i) : v.pause(); }
      else if (k === 'm') setSound(!s.sound);
      else if (k === 'ArrowLeft' || k === 'ArrowRight') { const v = vid(s.i); if (v && v.duration) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + (k === 'ArrowLeft' ? -5 : 5))); }
      else if (k === 'Enter' || k === 'o') { if (reels[s.i]) location.hash = '#case/' + reels[s.i].dataset.id; }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', s.onKey);
    muteIcon();
    const start = Math.max(0, reels.findIndex(r => r.dataset.id === root.dataset.start));
    if (start > 0) reels[start].scrollIntoView({ block: 'start' });
    items.forEach((b, k) => b.classList.toggle('on', k === start)); if (items[start]) items[start].closest('ol').scrollTop = Math.max(0, items[start].offsetTop - 120);
    requestAnimationFrame(() => activate(start));
    scroller.focus({ preventScroll: true });
  }

  function leave() {
    if (!cur) return; const s = cur; cur = null;
    if (window.FDMOVIE) window.FDMOVIE.close();
    if (s.obs) s.obs.disconnect(); window.removeEventListener('keydown', s.onKey);
  }

  window.FDR = { render, mount, leave, has: C => (C.cases || []).some(c => c.reel) };
})();
