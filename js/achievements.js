/* achievements.js — data-driven achievements. Add a line (or a loop) to grow the list. */
(function (g) {
  'use strict';
  const V = g.VITO, C = V.Config, E = V.Engine;
  const list = [];
  const add = (id, fa, desc, test, title) => list.push({ id, fa, desc, test, title: title || null });
  const faNum = (n) => V.Text.fa(n);

  add('first_log', 'اولین قدم', 'اولین کوئستت رو ثبت کن', (d) => d.logs >= 1);
  add('first_custom', 'کوئست‌ساز', 'یک کوئست دلخواه بساز', (d, s) => s.customTasks.length >= 1);
  const STREAK_TITLES = { 7: 'ثابت‌قدم', 30: 'اراده‌ی آهنین', 100: 'خستگی‌ناپذیر', 365: 'اسطوره‌ی پایداری' };
  [3, 7, 14, 30, 60, 100, 200, 365].forEach((n) => add('streak_' + n, `${faNum(n)} روز پیاپی`, `${faNum(n)} روز پشت‌هم فعال باش`, (d) => d.best >= n, STREAK_TITLES[n]));
  [5, 10, 20, 30, 40, 50, 60, 75, 85, 100].forEach((n) => add('lv_' + n, `سطح ${faNum(n)}`, `به سطح ${faNum(n)} برس`, (d) => d.level >= n));
  C.RANKS.slice(1).forEach((r) => add('rank_' + r.id, `رتبه‌ی ${r.id}`, `به رتبه‌ی ${r.id} برس`, (d) => E.rankIndex(d.rank) >= E.rankIndex(r), `شکارچی رتبه‌ی ${r.id}`));
  [1000, 5000, 10000, 25000, 50000, 100000, 250000].forEach((n) => add('xp_' + n, `${faNum(n)} XP`, `مجموع XP رو به ${faNum(n)} برسون`, (d) => d.total >= n));
  const STAT_TITLES = { str: 'پهلوان', int: 'خردمند', cha: 'سخنور', fin: 'گنج‌یاب', will: 'ذهن پولادین', vit: 'تن‌آهنین' };
  C.STATS.forEach((s) => [10, 25, 50].forEach((n) => add(`${s.id}_${n}`, `${s.fa} ${faNum(n)}`, `${s.fa} رو به سطح ${faNum(n)} برسون`, (d) => d.stats[s.id].level >= n, n === 25 ? STAT_TITLES[s.id] : null)));
  [10, 50, 100, 500, 1000].forEach((n) => add('logs_' + n, `${faNum(n)} ثبت`, `${faNum(n)} بار کوئست ثبت کن`, (d) => d.logs >= n));
  [1, 7, 30, 100].forEach((n) => add('clear_' + n, `پاکسازی ${faNum(n)}`, `${faNum(n)} روز همه‌ی کوئست‌های روز رو کامل کن`, (d) => d.clears >= n));

  /** Marks newly earned achievements on `state.unlocked` and returns them. */
  function evaluate(state, derived, now) {
    const fresh = [];
    for (const a of list) {
      if (state.unlocked[a.id]) continue;
      if (a.test(derived, state)) { state.unlocked[a.id] = now || Date.now(); fresh.push(a); }
    }
    return fresh;
  }
  function latestTitle(state) {
    let best = null;
    for (const a of list) if (a.title && state.unlocked[a.id] && (!best || state.unlocked[a.id] >= state.unlocked[best.id])) best = a;
    return best ? best.title : null;
  }
  V.Achievements = { list, evaluate, latestTitle, byId: (id) => list.find((a) => a.id === id) };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Achievements;
})(typeof window !== 'undefined' ? window : globalThis);
