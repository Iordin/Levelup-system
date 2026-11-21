/* engine.js — pure game logic. No DOM, no storage, no network. Everything here is unit-tested. */
(function (g) {
  'use strict';
  const V = g.VITO, C = V.Config, T = V.Text;
  const pad = (n) => String(n).padStart(2, '0');
  const { clamp } = T;

  // ───────── time (the game day starts at settings.dayStartHour) ─────────
  function dayKey(ts, startHour) {
    const d = new Date(ts - (startHour || 0) * 3600e3);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return { y, m, d }; };
  function shiftKey(k, delta) {
    const { y, m, d } = parseKey(k);
    const t = new Date(Date.UTC(y, m - 1, d + delta));
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }
  const weekday = (k) => { const { y, m, d } = parseKey(k); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }; // 0 = Sunday

  // ───────── levels, ranks, stats ─────────
  const xpToNext = (level) => Math.round(C.LEVEL.a + C.LEVEL.b * level + C.LEVEL.c * level * level);
  function levelFromXp(total) {
    let level = 1, rest = Math.max(0, Math.floor(total));
    for (;;) {
      const need = xpToNext(level);
      if (rest < need || level >= 999) return { level, into: rest, need, pct: Math.min(1, rest / need) };
      rest -= need; level++;
    }
  }
  const xpAtLevel = (level) => { let s = 0; for (let l = 1; l < level; l++) s += xpToNext(l); return s; };
  function rankOf(level) { let r = C.RANKS[0]; for (const x of C.RANKS) if (level >= x.minLevel) r = x; return r; }
  const nextRank = (level) => C.RANKS.find((r) => r.minLevel > level) || null;
  const rankIndex = (r) => C.RANKS.findIndex((x) => x.id === r.id);
  const statLevel = (pts) => Math.floor(Math.pow(Math.max(0, pts) / 25, 0.55)) + 1;
  const statThreshold = (lv) => (lv <= 1 ? 0 : 25 * Math.pow(lv - 1, 1 / 0.55));
  function statProgress(pts) {
    const level = statLevel(pts), lo = statThreshold(level), hi = statThreshold(level + 1);
    return { level, points: pts, into: Math.max(0, pts - lo), need: hi - lo, pct: clamp((pts - lo) / (hi - lo), 0, 1) };
  }
  const emptyStats = () => ({ str: 0, vit: 0, int: 0, will: 0, cha: 0, fin: 0 });
  const rankTitle = (profNoun, rank) => (profNoun ? profNoun + ' ' : '') + rank.adj;

  // ───────── xp ─────────
  const niceRound = (x) => V.Library ? V.Library.niceRound(x) : Math.round(x);
  const fairXp = (minutes, intensity) => Math.max(1, minutes * C.K * intensity);
  const xpPerUnit = (task) => task.xp / task.dose;

  function dayTotals(events) {
    const m = new Map();
    for (const e of events) m.set(e.d, (m.get(e.d) || 0) + e.xp);
    return m;
  }
  function streakBefore(byDay, day) {
    let n = 0, k = shiftKey(day, -1);
    while ((byDay.get(k) || 0) >= C.STREAK.minXP) { n++; k = shiftKey(k, -1); }
    return n;
  }

  /** What would logging `amount` of `task` right now give? Pure — does not touch state. */
  function previewLog(state, task, amount, ts) {
    const day = dayKey(ts, state.settings.dayStartHour);
    let todayXp = 0, used = 0;
    for (const e of state.events) {
      if (e.d !== day) continue;
      todayXp += e.xp;
      if (e.task === task.id) used += e.amt;
    }
    const room = Math.max(0, task.maxDaily - used);
    const amt = Math.min(+amount || 0, room);
    if (amt <= 0) return { ok: false, reason: room <= 0 ? 'daily_cap' : 'empty', room };
    const base = amt * xpPerUnit(task);
    const full = Math.max(0, C.SOFT_CAP - todayXp);
    const raw = Math.min(base, full) + Math.max(0, base - full) * C.SOFT_RATE;
    const streak = streakBefore(dayTotals(state.events), day);
    const mult = 1 + Math.min(C.STREAK.max, streak * C.STREAK.perDay);
    return {
      ok: true, amount: amt, requested: +amount, xp: Math.max(1, Math.round(raw * mult)), base: Math.round(base),
      mult, streak, softCapped: base > full, clipped: amt < amount, room: room - amt, day,
    };
  }
  /** Turn a preview into an event record (caller pushes it into state.events). */
  function makeLogEvent(task, pv, ts) {
    const s = emptyStats();
    for (const k in s) s[k] = Math.round(pv.xp * (task.stats[k] || 0) * 10) / 10;
    return { id: T.uid(), t: ts, d: pv.day, task: task.id, name: task.name, unit: task.unitLabel, amt: pv.amount, xp: pv.xp, s };
  }

  // ───────── derived state ─────────
  function derive(state, now) {
    now = now || Date.now();
    const sh = state.settings.dayStartHour;
    const today = dayKey(now, sh);
    const pts = emptyStats(), byDay = new Map(), todayUnits = new Map();
    let total = 0, logs = 0, clears = 0, todayXp = 0;
    const todayEvents = [];
    for (const e of state.events) {
      total += e.xp;
      byDay.set(e.d, (byDay.get(e.d) || 0) + e.xp);
      if (e.type === 'clear') clears++;
      else { logs++; for (const k in pts) pts[k] += (e.s && e.s[k]) || 0; }
      if (e.d === today) { todayXp += e.xp; todayEvents.push(e); if (e.task) todayUnits.set(e.task, (todayUnits.get(e.task) || 0) + e.amt); }
    }
    const ok = (k) => (byDay.get(k) || 0) >= C.STREAK.minXP;
    const good = [...byDay.keys()].filter(ok).sort();
    let best = 0, run = 0, prev = null;
    for (const k of good) { run = prev && shiftKey(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    let streak = 0, k = ok(today) ? today : shiftKey(today, -1);
    while (ok(k)) { streak++; k = shiftKey(k, -1); }
    const week = [];
    for (let i = 6; i >= 0; i--) { const key = shiftKey(today, -i); week.push({ key, xp: byDay.get(key) || 0, wd: weekday(key) }); }
    const lv = levelFromXp(total), rank = rankOf(lv.level);
    const stats = {};
    for (const s of C.STATS) stats[s.id] = statProgress(pts[s.id]);
    return {
      total, level: lv.level, into: lv.into, need: lv.need, pct: lv.pct, rank, nextRank: nextRank(lv.level),
      stats, logs, clears, streak, best, streakAlive: ok(today) || ok(shiftKey(today, -1)), week, byDay,
      today: { key: today, xp: todayXp, units: todayUnits, events: todayEvents, weekday: weekday(today) },
    };
  }

  // ───────── quests of the day ─────────
  const questsToday = (state, d) => state.quests.filter((q) => !q.days || !q.days.length || q.days.includes(d.today.weekday));
  function progressOf(d, quest) { return d.today.units.get(quest.taskId) || 0; }
  function clearStatus(state, d, getTask) {
    const qs = questsToday(state, d).filter((q) => getTask(q.taskId));
    const done = qs.filter((q) => progressOf(d, q) >= q.target - 1e-9).length;
    return { total: qs.length, done, clear: qs.length > 0 && done === qs.length };
  }
  /** Adds/removes today's «all quests done» bonus so it always matches reality. Returns what changed. */
  function reconcileClear(state, d, getTask, ts) {
    const st = clearStatus(state, d, getTask);
    const idx = state.events.findIndex((e) => e.type === 'clear' && e.d === d.today.key);
    if (st.clear && idx < 0) {
      const dayXp = d.today.events.filter((e) => e.type !== 'clear').reduce((a, e) => a + e.xp, 0);
      const ev = { id: T.uid(), t: ts, d: d.today.key, type: 'clear', xp: Math.max(C.CLEAR.min, Math.round(dayXp * C.CLEAR.rate)), s: emptyStats() };
      state.events.push(ev);
      return { added: ev };
    }
    if (!st.clear && idx >= 0) return { removed: state.events.splice(idx, 1)[0] };
    return {};
  }

  // ───────── matching (custom tasks, profession detection) ─────────
  function matchScore(qn, task) {
    const nn = task._nn || (task._nn = T.norm(task.name));
    let best = T.sim(qn, nn);
    for (const k of task.kw) best = Math.max(best, T.sim(qn, k) * 0.95);
    const qt = T.tokens(qn);
    if (qt.length) {
      const pool = new Set(T.tokens(nn).concat(task.kw));
      const hits = qt.filter((t) => pool.has(t)).length;
      if (hits) best = Math.max(best, (0.8 * hits) / qt.length);
    }
    return best;
  }
  function findSimilar(query, tasks, opt) {
    opt = opt || {};
    const qn = T.norm(query);
    if (!qn) return [];
    return tasks
      .map((t) => ({ task: t, score: matchScore(qn, t) + (t.prof === opt.prefer || t.prof === 'common' ? 0.04 : 0) }))
      .filter((x) => x.score > 0.15)
      .sort((a, b) => b.score - a.score)
      .slice(0, opt.limit || 5);
  }

  const STAT_HINTS = {
    str: 'ورزش باشگاه وزنه شنا دویدن بدنسازی بوکس کشتی دوچرخه تمرین بدنی',
    vit: 'خواب آب غذا پیاده رژیم کشش سلامت استراحت یوگا',
    int: 'مطالعه کتاب یاد زبان درس کد برنامه تحقیق دوره آموزش مقاله',
    will: 'مدیتیشن تمرکز ترک صبح انضباط برنامه عادت',
    cha: 'دوست تماس صحبت سخنرانی ارتباط مهمان کمک خانواده',
    fin: 'پول هزینه بودجه پس انداز سرمایه درآمد فروش معامله بازار',
  };
  const HINT_TOKENS = Object.fromEntries(Object.entries(STAT_HINTS).map(([k, v]) => [k, v.split(' ').map(T.norm)]));
  function guessStats(name) {
    const n = T.norm(name), score = {};
    for (const k in HINT_TOKENS) score[k] = HINT_TOKENS[k].filter((w) => n.includes(w)).length;
    const top = Object.entries(score).sort((a, b) => b[1] - a[1]);
    const out = emptyStats();
    if (!top[0][1]) { out.will = 0.5; out.int = 0.5; return out; }
    if (top[1][1]) { out[top[0][0]] = 0.7; out[top[1][0]] = 0.3; } else out[top[0][0]] = 1;
    return out;
  }
  function normStats(o) {
    if (!o || typeof o !== 'object') return null;
    const out = emptyStats();
    let sum = 0;
    for (const k in out) { const v = Number(o[k]); if (v > 0) { out[k] = v; sum += v; } }
    if (!sum) return null;
    for (const k in out) out[k] = Math.round((out[k] / sum) * 1000) / 1000;
    return out;
  }

  // ───────── custom task judge ─────────
  /**
   * input: {name, unit, dose, minutes?, xp?}   (what the player typed)
   * ctx:   {library, professionId, ai?}         (ai = sanitised model answer or null)
   * The model only *proposes*. XP is always recomputed here and clamped to the profession's own scale.
   */
  function judgeCustom(input, ctx) {
    const lib = ctx.library, ai = ctx.ai || null, flags = [];
    const unit = C.UNITS[input.unit] ? input.unit : 'count', U = C.UNITS[unit];
    const dose = Math.max(U.min, +input.dose || 1);
    const cands = findSimilar(input.name, lib.all(), { prefer: ctx.professionId, limit: 3 });
    const local = cands[0] && cands[0].score >= C.MATCH_MIN ? cands[0] : null;
    const aiRef = ai && ai.match_id ? lib.get(ai.match_id) : null;
    let ref = null, refScore = 0;
    if (local && local.score >= 0.6) { ref = local.task; refScore = local.score; }
    else if (aiRef) { ref = aiRef; refScore = ai ? 0.5 : 0; }
    else if (local) { ref = local.task; refScore = local.score; }
    const same = ref && ref.unit === unit;

    let minutes = +input.minutes > 0 ? +input.minutes : ai && ai.minutes > 0 ? ai.minutes : 0;
    if (!minutes) { minutes = same ? (ref.mpd * dose) / ref.dose : U.mpu * dose; flags.push('minutes_estimated'); }
    minutes = clamp(minutes, 0.5, 600);
    if (same) {
      const rm = (ref.mpd * dose) / ref.dose;
      const m2 = clamp(minutes, rm * 0.5, rm * 2);
      if (m2 !== minutes) { minutes = m2; flags.push('minutes_adjusted'); }
    }
    let intensity = ai && ai.intensity ? ai.intensity : ref ? ref.intensity : 1.5;
    intensity = clamp(intensity, C.INTENSITY[0], C.INTENSITY[1]);
    if (ref) intensity = clamp(intensity, ref.intensity - 0.5, ref.intensity + 0.5);

    let fair = fairXp(minutes, intensity);
    if (same) {
      const refXp = (ref.xp / ref.dose) * dose, lo = refXp * C.REF_BAND[0], hi = refXp * C.REF_BAND[1];
      if (fair < lo || fair > hi) { fair = clamp(fair, lo, hi); flags.push('anchored'); }
    }
    let xp = niceRound(fair);
    const req = +input.xp;
    if (req > 0) {
      const lo = fair * C.CUSTOM_BAND[0], hi = fair * C.CUSTOM_BAND[1];
      xp = Math.max(1, Math.round(clamp(req, lo, hi)));
      flags.push(req > hi ? 'xp_lowered' : req < lo ? 'xp_raised' : 'xp_ok');
    }
    const stats = normStats(ai && ai.stats) || (ref && ref.stats) || guessStats(input.name);
    let maxDaily = Math.floor((C.MAX_MINUTES_PER_TASK_DAY * dose) / minutes);
    if (same) maxDaily = Math.min(maxDaily, ref.maxDaily);
    if (ai && ai.max_per_day > 0) maxDaily = Math.min(maxDaily, Math.max(dose, ai.max_per_day));
    maxDaily = Math.max(dose, maxDaily);

    const name = ((ai && ai.name) || input.name || '').trim().slice(0, 48) || 'کوئست دلخواه';
    const task = {
      id: 'x_' + T.uid(), name, unit, unitLabel: input.unitLabel || U.fa, dose, mpd: Math.round(minutes * 10) / 10,
      intensity: Math.round(intensity * 10) / 10, xp, stats, maxDaily, kw: [], prof: 'custom', source: 'custom', refId: ref ? ref.id : null,
    };
    const verdict = {
      by: ai ? 'ai' : 'local', approved: !(ai && ai.approved === false), flags, refId: ref ? ref.id : null,
      refName: ref ? ref.name : null, refXp: ref ? ref.xp : null, refUnit: ref ? ref.unitLabel : null, requested: req > 0 ? req : null,
      reason: (ai && ai.reason) || localReason(flags, ref, xp, req),
    };
    return { task, verdict };
  }
  function localReason(flags, ref, xp, req) {
    const r = ref ? `«${ref.name}»` : null;
    if (flags.includes('xp_lowered')) return `XP درخواستی (${req}) از مقیاس سیستم بالاتر بود؛ ${r ? 'بر اساس ' + r : 'بر اساس زمان و سختی'} روی ${xp} تنظیم شد.`;
    if (flags.includes('xp_raised')) return `XP درخواستی (${req}) کمتر از ارزش واقعی بود؛ روی ${xp} تنظیم شد.`;
    if (flags.includes('xp_ok')) return `XP درخواستی با مقیاس سیستم می‌خونه${r ? ' (مرجع: ' + r + ')' : ''}.`;
    return r ? `ارزش این کوئست با ${r} سنجیده شد: ${xp} XP.` : `بر اساس زمان و سختی تخمینی، ${xp} XP.`;
  }

  // ───────── profession detection from free text ─────────
  function kwScore(nl, toks, kwList) {
    let best = 0;
    for (const p of kwList) {
      if (p.length >= 3 && nl.includes(p)) return 1;
      if (!p.includes(' ')) for (const t of toks) if (t.length >= 3 && T.sim(t, p) >= 0.85) best = Math.max(best, 0.9);
    }
    return best;
  }
  function detectProfession(input, professions) {
    const raw = Array.isArray(input) ? input : String(input).split(/[\n،,;؛]+/);
    const lines = raw.map(T.norm).filter(Boolean).slice(0, 12);
    if (!lines.length) return [];
    const rows = professions.map((p) => ({
      id: p.id,
      per: lines.map((l) => {
        const toks = T.tokens(l);
        let ts = 0;
        for (const t of p.tasks) ts = Math.max(ts, matchScore(l, t));
        return Math.max(kwScore(l, toks, p.kw), ts * 0.9);
      }),
    }));
    const used = lines.filter((_, i) => Math.max(...rows.map((r) => r.per[i])) >= 0.3).length;
    if (!used) return [];
    return rows
      .map((r) => ({ id: r.id, hits: r.per.filter((b) => b >= 0.3).length, score: r.per.reduce((a, b) => a + (b >= 0.3 ? b : 0), 0) / used }))
      .filter((r) => r.hits > 0)
      .sort((a, b) => b.score - a.score || b.hits - a.hits);
  }

  V.Engine = {
    dayKey, shiftKey, weekday, xpToNext, levelFromXp, xpAtLevel, rankOf, nextRank, rankIndex, statLevel, statThreshold, statProgress,
    emptyStats, rankTitle, niceRound, fairXp, xpPerUnit, streakBefore, previewLog, makeLogEvent, derive, questsToday, progressOf,
    clearStatus, reconcileClear, matchScore, findSimilar, guessStats, normStats, judgeCustom, detectProfession,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
