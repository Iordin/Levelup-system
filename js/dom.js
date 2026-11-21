/* dom.js — tiny DOM toolkit: element builders (no innerHTML for user text), icons, sheets, toasts, overlays, sound. */
(function (g) {
  'use strict';
  const V = (g.VITO = g.VITO || {});
  const SVGNS = 'http://www.w3.org/2000/svg';

  function apply(el, props, svg) {
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') svg ? el.setAttribute('class', v) : (el.className = v);
      else if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else for (const p in v) (p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]));
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' && !svg) el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
  }
  const h = (tag, props, ...kids) => { const el = document.createElement(tag); apply(el, props, false); append(el, kids); return el; };
  const s = (tag, props, ...kids) => { const el = document.createElementNS(SVGNS, tag); apply(el, props, true); append(el, kids); return el; };
  const $ = (sel, root) => (root || document).querySelector(sel);
  /** Replace all children of `el`. Unlike el.replaceChildren(), null / false / nested arrays are fine. */
  const fill = (el, ...kids) => { el.replaceChildren(); append(el, kids); return el; };

  const ICONS = {
    status: '<path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z"/><path d="M12 8l4 2.3v4.6L12 17.2 8 14.9v-4.6z"/>',
    quests: '<rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 4V3h6v1M9 11.5l2 2 4-4M9 17.5h6"/>',
    trophy: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    more: '<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>',
    flame: '<path d="M12 2.5c.6 3 4 4.8 4 9.2a4 4 0 0 1-8 0c0-1.5.6-2.6 1.4-3.5.3 1.1.9 1.7 1.7 2C10.7 7.7 10.7 5 12 2.5z"/>',
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="1.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    download: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>', upload: '<path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9M5 19.5h14"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>', refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15"/>',
    minus: '<path d="M5 12h14"/>',
  };
  function icon(name, size) {
    const el = s('svg', { viewBox: '0 0 24 24', width: size || 22, height: size || 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    el.innerHTML = ICONS[name] || '';
    return el;
  }
  const HEX = '50,4 93,27 93,73 50,96 7,73 7,27', HEX_IN = '50,15 83,33 83,67 50,85 17,67 17,33';
  function emblem(rank, size, glow) {
    return h('div', { class: 'emb' + (glow ? ' glow' : ''), style: { '--s': (size || 44) + 'px', '--rank': rank.color } },
      s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        s('polygon', { points: HEX, fill: 'rgba(5,8,19,.82)', stroke: 'currentColor', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
        s('polygon', { points: HEX_IN, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.2, opacity: 0.45 })),
      h('b', null, rank.id));
  }
  const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');

  // ───────── feedback: sound, haptics ─────────
  const prefs = { sound: true, vibrate: true };
  let ac = null;
  function tone(freq, at, dur, type, vol) {
    try {
      ac = ac || new (g.AudioContext || g.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime + at;
      o.type = type || 'triangle'; o.frequency.value = freq;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.015); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }
  const SFX = {
    done: () => { tone(660, 0, 0.09); tone(990, 0.08, 0.16); },
    level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.24, 'triangle', 0.07)),
    rank: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.07)); tone(262, 0, 1.2, 'sine', 0.05); },
    error: () => tone(180, 0, 0.18, 'sawtooth', 0.04),
    gold: () => { tone(880, 0, 0.1); tone(1175, 0.09, 0.22); },
  };
  const sfx = (name) => { if (prefs.sound && SFX[name]) SFX[name](); };
  const vibrate = (p) => { if (prefs.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } };

  // ───────── layers ─────────
  const layer = () => $('#layer');
  let openSheets = 0;
  function sheet({ title, body, full, onClose }) {
    const holder = h('div', { class: 'sheet-body' }, body);
    const scrim = h('div', { class: 'scrim' });
    let closed = false;
    const el = h('div', { class: 'sheet' + (full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'پنجره' },
      h('div', { class: 'sheet-head' }, h('h2', null, title || ''), h('button', { class: 'icon-btn', 'aria-label': 'بستن', onclick: () => close() }, icon('x'))), holder);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() {
      if (closed) return; closed = true;
      scrim.remove(); el.remove(); document.removeEventListener('keydown', onKey);
      if (--openSheets <= 0) { openSheets = 0; document.documentElement.classList.remove('lock'); }
      if (onClose) onClose();
    }
    scrim.addEventListener('click', () => close());
    document.addEventListener('keydown', onKey);
    openSheets++; document.documentElement.classList.add('lock');
    document.querySelectorAll('.toasts.bottom .toast').forEach((t) => t.remove());
    layer().append(scrim, el);
    return { el, close, setBody(n) { fill(holder, n); } };
  }
  function confirmBox({ title, text, ok, cancel, danger }) {
    return new Promise((res) => {
      let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
      const sh = sheet({
        title, onClose: () => fin(false),
        body: h('div', { class: 'stack' }, text ? h('p', { class: 'mute', style: { margin: 0 } }, text) : null,
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost grow', onclick: () => { fin(false); sh.close(); } }, cancel || 'انصراف'),
            h('button', { class: 'btn grow ' + (danger ? 'danger' : 'primary'), onclick: () => { fin(true); sh.close(); } }, ok || 'تأیید'))),
      });
    });
  }
  /** Bottom stack: feedback for what you just did (undoable). Top stack (pos:'top'): system messages such as achievements.
   *  `key` replaces an earlier toast with the same key, and each stack keeps at most two. */
  function toast(text, opt) {
    opt = opt || {};
    const pos = opt.pos === 'top' ? 'top' : 'bottom';
    let box = $('.toasts.' + pos);
    if (!box) { box = h('div', { class: 'toasts ' + pos, 'aria-live': 'polite' }); layer().append(box); }
    if (pos === 'top') { const hud = $('#hud'); box.style.top = ((hud && !hud.hidden ? hud.getBoundingClientRect().bottom : 0) + 8) + 'px'; }
    if (opt.key) [...box.children].forEach((c) => { if (c.dataset.key === opt.key) c.remove(); });
    while (box.children.length >= 2) box.firstChild.remove();
    const el = h('div', { class: 'toast ' + (opt.kind || ''), role: 'status', 'data-key': opt.key || null, onclick: () => el.remove() }, h('span', null, text));
    if (opt.action) el.append(h('button', { onclick: (e) => { e.stopPropagation(); opt.action.fn(); el.remove(); } }, opt.action.label));
    box.append(el);
    setTimeout(() => el.remove(), opt.ms || (opt.action ? 6000 : 3000));
    return el;
  }
  function floatText(text, anchor) {
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const el = h('div', { class: 'float', style: { left: (r ? r.left + r.width / 2 : innerWidth / 2) + 'px', top: (r ? r.top : innerHeight * 0.6) + 'px' } }, text);
    layer().append(el); setTimeout(() => el.remove(), 1200);
  }
  function countTo(el, from, to, ms) {
    const t0 = performance.now(), dur = ms || 800;
    (function step(t) { const k = Math.min(1, (t - t0) / dur); el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  /** Full-screen takeover. Resolves when the player taps (or after 7 s). */
  function takeover(content, rgb) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const el = h('div', { class: 'fx', role: 'alertdialog', style: rgb ? { '--rc': rgb } : null }, h('div', { class: 'rays' }), content, h('div', { class: 'tap', style: { position: 'absolute', bottom: '8vh' } }, 'برای ادامه لمس کن'));
      const close = () => { if (Date.now() - t0 < 700) return; el.remove(); resolve(); };
      el.addEventListener('click', close); layer().append(el); setTimeout(close, 7000);
    });
  }
  function fxLevel({ from, to }) {
    const n = h('span', null, String(from));
    sfx('level'); vibrate([30, 50, 30]);
    const p = takeover(h('div', { class: 'in' }, h('h2', null, 'سطح جدید!'), h('div', { class: 'big' }, h('small', null, 'LV'), n), h('p', null, 'قوی‌تر شدی؛ ادامه بده.')));
    setTimeout(() => countTo(n, from, to, 700), 350);
    return p;
  }
  function fxRank({ from, to, title }) {
    sfx('rank'); vibrate([40, 60, 40, 60, 80]);
    return takeover(h('div', { class: 'in', style: { '--rank': to.color } },
      h('h2', { style: { color: to.color } }, 'ارتقای رتبه!'),
      h('div', { class: 'ranks' }, emblem(from, 64), h('span', { class: 'arrow' }, '>'), emblem(to, 112, true)),
      h('div', { style: { fontWeight: 800, fontSize: '20px', color: to.color } }, title), h('p', null, `حالا رتبه‌ی ${to.id} هستی.`)), hexRgb(to.color));
  }

  function download(name, text, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
    const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
      inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsText(f); });
      inp.addEventListener('cancel', () => { inp.remove(); resolve(null); });
      document.body.append(inp); inp.click();
    });
  }

  V.Dom = { h, s, $, fill, icon, emblem, HEX, prefs, sfx, vibrate, sheet, confirmBox, toast, floatText, countTo, fxLevel, fxRank, download, pickFile, hexRgb };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Dom;
})(typeof window !== 'undefined' ? window : globalThis);
