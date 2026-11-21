/* text.js — Persian-aware text helpers (normalisation, fuzzy match, digits). No DOM. */
(function (g) {
  'use strict';
  const V = (g.VITO = g.VITO || {});
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const STOP = new Set(['و', 'از', 'با', 'در', 'به', 'را', 'که', 'این', 'آن', 'برای', 'کردن', 'زدن', 'انجام', 'روز', 'روزانه', 'هر', 'یک', 'می', 'ام']);

  /** Lower-case, unify Arabic/Persian letters+digits, ZWNJ → space, strip punctuation. */
  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d))
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ۀ/g, 'ه').replace(/ة/g, 'ه')
      .replace(/[‌‍‎‏]/g, ' ')
      .replace(/[ً-ٰٟـ]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function tokens(n) { return n.split(' ').filter((t) => t.length >= 2 && !STOP.has(t)); }

  function trigrams(s) {
    const t = s.replace(/ /g, '');
    const m = new Map();
    if (t.length < 3) { if (t) m.set(t, 1); return m; }
    for (let i = 0; i <= t.length - 3; i++) { const k = t.substr(i, 3); m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }
  function dice(a, b) {
    let inter = 0, na = 0, nb = 0;
    for (const [k, v] of a) { na += v; const w = b.get(k); if (w) inter += Math.min(v, w); }
    for (const v of b.values()) nb += v;
    return na + nb ? (2 * inter) / (na + nb) : 0;
  }
  /** Similarity 0..1 of two *normalised* strings (trigram dice + containment boost). */
  function sim(a, b) {
    if (!a || !b) return 0;
    const ta = a.replace(/ /g, ''), tb = b.replace(/ /g, '');
    let s = dice(trigrams(a), trigrams(b));
    const [sh, lo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    if (sh.length >= 3 && lo.includes(sh)) s = Math.max(s, 0.55 + (0.4 * sh.length) / lo.length);
    return Math.min(1, s);
  }

  const fa = (n) => String(n).replace(/\d/g, (d) => FA_DIGITS[d]).replace('.', '٫');
  const num = (n, dp = 1) => { const f = Math.pow(10, dp); return String(Math.round(n * f) / f); };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  V.Text = { norm, tokens, sim, fa, num, clamp, uid, FA_DIGITS };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Text;
})(typeof window !== 'undefined' ? window : globalThis);
