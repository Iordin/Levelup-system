/* store.js — persistence. localStorage with an in-memory fallback, a rolling backup and safe import/export. */
(function (g) {
  'use strict';
  const V = g.VITO, C = V.Config;
  const KEY = C.STORAGE_KEY, BAK = KEY + '.bak';
  const mem = {};
  const ls = {
    get(k) { try { return g.localStorage.getItem(k); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { try { g.localStorage.setItem(k, v); delete mem[k]; return true; } catch (e) { mem[k] = v; return false; } },
    del(k) { try { g.localStorage.removeItem(k); } catch (e) { /* ignore */ } delete mem[k]; },
  };

  const defaults = () => ({
    v: 2, created: Date.now(), profile: null,
    settings: { theme: 'auto', apiKey: '', model: '', ai: true, sound: true, vibrate: true, dayStartHour: C.DAY_START_HOUR },
    quests: [], customTasks: [], events: [], unlocked: {},
  });
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const DAY = /^\d{4}-\d{2}-\d{2}$/;

  function cleanEvent(e) {
    if (!e || typeof e !== 'object' || !DAY.test(e.d) || !isNum(e.xp) || e.xp < 0 || !isNum(e.t)) return null;
    const s = V.Engine.emptyStats();
    for (const k in s) s[k] = isNum(e.s && e.s[k]) ? e.s[k] : 0;
    const out = { id: String(e.id || V.Text.uid()), t: e.t, d: e.d, xp: Math.round(e.xp), s };
    if (e.type === 'clear') { out.type = 'clear'; return out; }
    if (typeof e.task !== 'string' || !isNum(e.amt) || e.amt <= 0) return null;
    return Object.assign(out, { task: e.task, name: String(e.name || ''), unit: String(e.unit || ''), amt: e.amt });
  }
  /** Fill gaps, drop broken records. Returns null if `o` is not a state at all. */
  function migrate(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.events)) return null;
    const d = defaults();
    const st = Object.assign(d, o, { v: 2 });
    st.settings = Object.assign(d.settings, o.settings || {});
    st.settings.dayStartHour = Math.min(8, Math.max(0, Math.round(+st.settings.dayStartHour || 0)));
    st.events = o.events.map(cleanEvent).filter(Boolean);
    st.quests = (Array.isArray(o.quests) ? o.quests : []).filter((q) => q && typeof q.taskId === 'string' && isNum(q.target) && q.target > 0)
      .map((q) => ({ id: String(q.id || V.Text.uid()), taskId: q.taskId, target: q.target, days: Array.isArray(q.days) ? q.days.filter((x) => x >= 0 && x <= 6) : null, added: q.added || Date.now() }));
    st.customTasks = (Array.isArray(o.customTasks) ? o.customTasks : []).filter((t) => t && typeof t.id === 'string' && isNum(t.xp) && isNum(t.dose) && t.stats);
    st.unlocked = o.unlocked && typeof o.unlocked === 'object' ? o.unlocked : {};
    return st;
  }
  function parse(text) { try { return migrate(JSON.parse(text)); } catch (e) { return null; } }

  /** → {state, status}  status: 'new' | 'ok' | 'recovered' */
  function load() {
    const main = ls.get(KEY);
    if (main) { const s = parse(main); if (s) return { state: s, status: 'ok' }; }
    const bak = ls.get(BAK);
    if (bak) { const s = parse(bak); if (s) return { state: s, status: 'recovered' }; }
    return { state: defaults(), status: 'new' };
  }
  let backedUp = false;
  function save(state) {
    if (!backedUp) { const cur = ls.get(KEY); if (cur && parse(cur)) ls.set(BAK, cur); backedUp = true; }
    return ls.set(KEY, JSON.stringify(state));
  }
  function exportJson(state) {
    const copy = JSON.parse(JSON.stringify(state));
    copy.settings.apiKey = '';
    return JSON.stringify({ app: 'vito-system', version: C.VERSION, exportedAt: Date.now(), data: copy }, null, 1);
  }
  function importJson(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'فایل JSON معتبر نیست.' }; }
    const st = migrate(o && o.data ? o.data : o);
    return st ? { ok: true, state: st } : { ok: false, error: 'این فایل، پشتیبان سیستم ویتو نیست.' };
  }
  const reset = () => { ls.del(KEY); ls.del(BAK); backedUp = false; };

  V.Store = { KEY, defaults, load, save, migrate, exportJson, importJson, reset, _ls: ls };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Store;
})(typeof window !== 'undefined' ? window : globalThis);
