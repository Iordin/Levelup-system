/* app.js — state, actions, rendering loop, boot. The only file that mutates state. */
(function (g) {
  'use strict';
  const V = g.VITO, C = V.Config, E = V.Engine, L = V.Library, T = V.Text, S = V.Store, AI = V.AI, Ach = V.Achievements, D = V.Dom, Views = V.Views;
  const { $, toast } = D;
  const fa = T.fa, num = T.num, now = () => Date.now();
  const App = (V.App = { state: null, d: null, tab: 'quests', ui: {}, installEvt: null, renderedTab: null });

  const getTask = (id) => L.get(id) || (App.state && App.state.customTasks.find((t) => t.id === id)) || null;
  const profNoun = () => { const p = App.state.profile, lp = p && L.profession(p.professionId); return lp ? lp.noun : (p && p.customName) || ''; };
  const title = () => E.rankTitle(profNoun(), App.d.rank);
  const ctx = () => ({ state: App.state, d: App.d, tab: App.tab, ui: App.ui, A: App.actions, getTask, title: App.state.profile ? title() : '', canInstall: !!App.installEvt, cur: ctx });
  const isSingle = (t) => (t.unit === 'session' || t.unit === 'count') && t.dose === 1;

  function applyTheme() {
    const st = App.state.settings, hr = new Date().getHours();
    document.documentElement.dataset.accent = st.theme === 'blue' || st.theme === 'purple' ? st.theme : hr >= 6 && hr < 18 ? 'blue' : 'purple';
    D.prefs.sound = !!st.sound; D.prefs.vibrate = !!st.vibrate;
  }
  function save() {
    if (!S.save(App.state) && !App.warnedSave) { App.warnedSave = true; toast('ذخیره‌سازی مرورگر کار نمی‌کنه؛ پیشرفتت با بستن برنامه پاک می‌شه. پشتیبان بگیر.', { kind: 'bad', ms: 7000 }); }
  }
  function recompute() {
    let d = E.derive(App.state, now());
    const cr = E.reconcileClear(App.state, d, getTask, now());
    if (cr.added || cr.removed) d = E.derive(App.state, now());
    const fresh = Ach.evaluate(App.state, d, now());
    App.d = d;
    return { d, clear: cr.added || null, fresh };
  }
  function commit() { const prev = App.d, res = recompute(); save(); render(prev); return res; }

  function render(prev) {
    const st = App.state, hud = $('#hud'), nav = $('#nav'), view = $('#view');
    applyTheme();
    if (!st.profile) { hud.hidden = true; nav.hidden = true; view.replaceChildren(Views.onboarding(ctx())); return; }
    hud.hidden = false; nav.hidden = false;
    const same = App.renderedTab === App.tab, y = window.scrollY;
    const start = prev && prev.level === App.d.level ? prev.pct : prev ? 0 : App.d.pct;
    hud.replaceChildren(Views.hud(ctx(), start));
    if (start !== App.d.pct) requestAnimationFrame(() => requestAnimationFrame(() => { const b = hud.querySelector('.bar'); if (b) { b.classList.add('gain'); b.style.setProperty('--p', App.d.pct); } }));
    nav.replaceChildren(Views.nav(ctx()));
    view.replaceChildren(Views[App.tab](ctx()));
    App.renderedTab = App.tab;
    window.scrollTo(0, same ? y : 0);
  }

  // overlays run one after another so a level-up and a rank-up never stack
  const fxq = []; let fxBusy = false;
  async function pump() { if (fxBusy) return; fxBusy = true; while (fxq.length) { try { await fxq.shift()(); } catch (e) { /* ignore */ } } fxBusy = false; }
  const queueFx = (fn) => { fxq.push(fn); pump(); };
  function celebrate(before, res) {
    const after = res.d;
    if (after.level > before.level) queueFx(() => D.fxLevel({ from: before.level, to: after.level }));
    if (E.rankIndex(after.rank) > E.rankIndex(before.rank)) queueFx(() => D.fxRank({ from: before.rank, to: after.rank, title: title() }));
    // system messages (top stack) wait until any takeover has been dismissed
    if (res.clear || res.fresh.length) queueFx(() => {
      if (res.clear) toast(`همه‌ی کوئست‌های امروز کامل شد! +${res.clear.xp} XP`, { kind: 'ok', pos: 'top', ms: 3600 });
      res.fresh.forEach((a) => toast('دستاورد جدید: ' + a.fa, { kind: 'gold', pos: 'top', ms: 3600 }));
      if (res.fresh.length) D.sfx('gold');
    });
  }

  const A = (App.actions = {
    go(tab) { App.tab = tab; render(App.d); },
    render() { render(App.d); },

    tap(q, el) {
      const t = getTask(q.taskId); if (!t) return;
      if (E.progressOf(App.d, q) >= q.target - 1e-9) { toast('این کوئست امروز کامل شده. برای ثبت بیشتر از منوی ⋯ استفاده کن.'); return; }
      if (isSingle(t)) A.log(q, 1, el); else A.openLog(q);
    },
    log(q, amount, anchor) {
      const t = getTask(q.taskId); if (!t) return false;
      const ts = now(), pv = E.previewLog(App.state, t, amount, ts);
      if (!pv.ok) { toast(pv.reason === 'daily_cap' ? 'سقف امروز این کوئست پر شده.' : 'مقدار معتبر نیست.', { kind: 'bad' }); D.sfx('error'); return false; }
      const ev = E.makeLogEvent(t, pv, ts), before = App.d;
      D.floatText('+' + ev.xp + ' XP', anchor); // before re-render, while the anchor still exists
      App.state.events.push(ev);
      const res = commit();
      D.sfx('done'); D.vibrate(18);
      const extra = pv.clipped ? `فقط ${fa(num(pv.amount))} ${t.unitLabel} حساب شد؛ سقف روزانه پر شد.` : pv.softCapped ? 'از سقف XP روزانه رد شدی؛ امتیاز کمتر حساب شد.' : '';
      toast(`${t.name}: +${ev.xp} XP${extra ? ' — ' + extra : ''}`, { kind: 'ok', key: 'log', action: { label: 'بازگردانی', fn: () => A.undo(ev.id, true) } });
      celebrate(before, res);
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      return true;
    },
    undo(id, say) {
      const i = App.state.events.findIndex((e) => e.id === id); if (i < 0) return;
      App.state.events.splice(i, 1); commit(); if (say) toast('بازگردانی شد.', { key: 'log' });
    },
    deleteLog(id) { A.undo(id, false); },
    openLog(q) { Views.logSheet(ctx(), q); },
    questMenu(q) { Views.questSheet(ctx(), q); },
    openAdd(tab) { Views.addSheet(ctx(), tab); },

    addQuest(task, opt) {
      if (App.state.quests.some((x) => x.taskId === task.id)) return false;
      App.state.quests.push({ id: T.uid(), taskId: task.id, target: (opt && opt.target) || task.dose, days: (opt && opt.days) || null, added: now() });
      commit(); toast(`«${task.name}» به کوئست‌هات اضافه شد.`, { kind: 'ok' }); return true;
    },
    removeQuest(q) { App.state.quests = App.state.quests.filter((x) => x !== q); commit(); },
    updateQuest(q, patch) { Object.assign(q, patch); commit(); },
    async judgeCustom(input) {
      const professionId = App.state.profile.professionId;
      let ai = null, aiError = null;
      if (AI.isReady(App.state.settings)) { try { ai = await AI.judgeTask(App.state.settings, input, { library: L, professionId }); } catch (e) { aiError = e.message; } }
      const res = E.judgeCustom(input, { library: L, professionId, ai });
      res.aiError = aiError ? `${aiError} (ارزیابی آفلاین انجام شد)` : null;
      return res;
    },
    addCustom(res) { res.task.verdict = res.verdict; App.state.customTasks.push(res.task); A.addQuest(res.task); },
    deleteCustom(id) { App.state.customTasks = App.state.customTasks.filter((t) => t.id !== id); App.state.quests = App.state.quests.filter((q) => q.taskId !== id); commit(); },

    finishOnboarding({ name, professionId, customName, starterIds }) {
      const st = App.state;
      st.profile = { name: (name || '').trim().slice(0, 24) || 'شکارچی', professionId: professionId || 'custom', customName: customName || '', created: now() };
      st.quests = [];
      starterIds.forEach((id) => { const t = L.get(id); if (t) st.quests.push({ id: T.uid(), taskId: t.id, target: t.dose, days: null, added: now() }); });
      App.ui.onb = null; App.tab = 'quests'; commit();
      D.sfx('level'); toast('سیستم فعال شد. اولین کوئستت رو انجام بده.', { kind: 'ok' });
    },
    setName(v) { const n = String(v).trim().slice(0, 24); if (n) { App.state.profile.name = n; commit(); } },
    setSetting(k, v) { App.state.settings[k] = v; commit(); },
    pickProfession() { Views.professionSheet(ctx(), (p) => A.setProfession(p)); },
    setProfession(p) { App.state.profile.professionId = p.id || 'custom'; App.state.profile.customName = p.custom || ''; commit(); toast('حرفه عوض شد.', { kind: 'ok' }); },
    async testAI() {
      App.ui.aiTest = { busy: true }; render(App.d);
      try { const r = await AI.test(App.state.settings); App.ui.aiTest = { ok: true, text: `متصل شد: ${r.model}` }; }
      catch (e) { App.ui.aiTest = { ok: false, text: e.message }; }
      render(App.d);
    },
    exportData() {
      const json = S.exportJson(App.state);
      if (C.PREVIEW) { Views.exportSheet(json); return; } // downloads are blocked inside the preview sandbox
      D.download('vito-backup-' + E.dayKey(now(), 0) + '.json', json); toast('پشتیبان ذخیره شد.', { kind: 'ok' });
    },
    async importData() {
      const text = await D.pickFile('.json,application/json'); if (text == null) return;
      const r = S.importJson(text); if (!r.ok) { toast(r.error, { kind: 'bad' }); return; }
      if (!(await D.confirmBox({ title: 'بازیابی پشتیبان', text: `${fa(r.state.events.length)} رکورد جایگزین داده‌های فعلی می‌شه.`, ok: 'بازیابی', danger: true }))) return;
      r.state.settings.apiKey = App.state.settings.apiKey; App.state = r.state; commit(); toast('پشتیبان بازیابی شد.', { kind: 'ok' });
    },
    async resetAll() {
      if (!(await D.confirmBox({ title: 'پاک‌کردن همه‌چیز', text: 'همه‌ی پیشرفت، کوئست‌ها و تنظیمات برای همیشه پاک می‌شه. اول پشتیبان بگیر.', ok: 'پاک کن', danger: true }))) return;
      S.reset(); App.state = S.defaults(); App.ui = {}; App.tab = 'quests'; commit();
    },
    async forceUpdate() {
      try {
        if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        if (g.caches) for (const k of await caches.keys()) await caches.delete(k);
      } catch (e) { /* reload anyway */ }
      location.reload();
    },
    install() { if (App.installEvt) { App.installEvt.prompt(); App.installEvt = null; } },
  });

  function tick() {
    if (!App.state.profile) return;
    applyTheme();
    if (App.d.today.key !== E.dayKey(now(), App.state.settings.dayStartHour)) commit();
  }
  function boot() {
    const r = S.load(); App.state = r.state;
    recompute(); render();
    if (r.status === 'recovered') toast('داده‌ها از نسخه‌ی پشتیبان خودکار بازیابی شد.', { kind: 'gold', ms: 6000 });
    setInterval(tick, 60000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else tick(); });
    addEventListener('pagehide', save);
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); App.installEvt = e; if (App.tab === 'settings') render(App.d); });
    let errAt = 0;
    const onErr = (e) => { console.error(e && (e.error || e.reason || e)); if (now() - errAt > 5000) { errAt = now(); toast('یه خطای غیرمنتظره رخ داد. اگه تکرار شد، پشتیبان بگیر و صفحه رو دوباره باز کن.', { kind: 'bad', ms: 6000 }); } };
    addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
    if (!C.PREVIEW && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})(typeof window !== 'undefined' ? window : globalThis);
