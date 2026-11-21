/* views.js — every screen and sheet. Views are pure functions of ctx = {state, d, A (actions), ui, title, getTask, cur()}. */
(function (g) {
  'use strict';
  const V = g.VITO, C = V.Config, E = V.Engine, T = V.Text, L = V.Library, Ach = V.Achievements, D = V.Dom;
  const { h, s, fill, icon, emblem, HEX } = D;
  const fa = T.fa, num = T.num;
  const STAT = Object.fromEntries(C.STATS.map((x) => [x.id, x]));

  let dateFmt = null;
  try { dateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { /* plain keys */ }
  const dateLabel = (key) => { const [y, m, d] = key.split('-').map(Number); return dateFmt ? dateFmt.format(new Date(y, m - 1, d, 12)) : key; };
  const amount = (t, n) => `${fa(num(n))} ${t.unitLabel}`;
  const topStats = (t, n) => Object.entries(t.stats).filter(([, v]) => v > 0.05).sort((a, b) => b[1] - a[1]).slice(0, n || 2).map(([k]) => STAT[k]);
  const statChips = (t, n) => h('span', { class: 'chips' }, topStats(t, n).map((st) => h('span', { class: 'chip', style: { '--c': st.color } }, st.code)));
  const mainColor = (t) => (topStats(t, 1)[0] || STAT.will).color;
  const xpOf = (t, n) => Math.max(1, Math.round(E.xpPerUnit(t) * n));
  const win = (cls, ...kids) => h('section', { class: 'win ' + (cls || '') }, ...kids);
  const winTitle = (ic, text, meta) => h('h2', { class: 'win-title' }, icon(ic, 18), h('span', { class: 'grow' }, text), meta ? h('span', { class: 'meta' }, meta) : null);
  const frag = (nodes) => { const f = document.createDocumentFragment(); f.append(...nodes.filter(Boolean)); return f; };
  const spinner = (text) => h('div', { class: 'row' }, h('div', { class: 'spin' }), h('span', { class: 'hint' }, text));
  const stepFor = (t) => (t.dose >= 300 ? 100 : t.dose >= 100 ? 50 : C.UNITS[t.unit].step);
  const r2 = (x) => Math.round(x * 100) / 100;
  const isSingle = (t) => (t.unit === 'session' || t.unit === 'count') && t.dose === 1;

  // ───────── chrome ─────────
  function hud(ctx, startPct) {
    const { state, d } = ctx;
    return h('div', { class: 'hud', style: { '--rank': d.rank.color } },
      emblem(d.rank, 44),
      h('div', { class: 'who' }, h('b', null, state.profile.name), h('span', null, ctx.title)),
      h('div', { class: 'lv' }, h('small', null, 'LV'), String(d.level)),
      h('div', { class: 'xp' }, h('div', { class: 'bar', style: { '--p': startPct } }, h('i')), h('span', { class: 'num' }, `${d.into}/${d.need} XP`)));
  }
  const TABS = [['status', 'وضعیت', 'status'], ['quests', 'کوئست‌ها', 'quests'], ['achievements', 'دستاوردها', 'trophy'], ['settings', 'تنظیمات', 'settings']];
  const nav = (ctx) => h('div', { class: 'in' }, TABS.map(([id, label, ic]) => h('button', { class: 'tab', 'aria-current': ctx.tab === id ? 'page' : null, onclick: () => ctx.A.go(id) }, icon(ic, 24), h('span', null, label))));

  // ───────── status ─────────
  function radar(d, pop) {
    const R = 100, N = C.STATS.length;
    const maxLv = Math.max(...C.STATS.map((x) => d.stats[x.id].level));
    const axisMax = Math.max(5, Math.ceil((maxLv * 1.1) / 5) * 5);
    const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / N; return [r * Math.cos(a), r * Math.sin(a)]; };
    const fmt = (p) => p.map((n) => n.toFixed(1)).join(',');
    const rad = (st) => R * Math.min(1, 0.1 + 0.9 * (d.stats[st.id].level / axisMax));
    const svg = s('svg', { class: 'radar' + (pop ? ' pop' : ''), viewBox: '-150 -138 300 276', role: 'img', 'aria-label': 'نمودار استات‌ها' });
    [0.25, 0.5, 0.75, 1].forEach((f) => svg.append(s('polygon', { class: 'ring', points: C.STATS.map((_, i) => fmt(pt(i, R * f))).join(' ') })));
    C.STATS.forEach((_, i) => { const [x, y] = pt(i, R); svg.append(s('line', { class: 'axis', x1: 0, y1: 0, x2: x.toFixed(1), y2: y.toFixed(1) })); });
    svg.append(s('polygon', { class: 'poly', points: C.STATS.map((st, i) => fmt(pt(i, rad(st)))).join(' ') }));
    const dots = s('g', { class: 'dots' });
    C.STATS.forEach((st, i) => { const [x, y] = pt(i, rad(st)); dots.append(s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.2, fill: st.color })); });
    svg.append(dots);
    C.STATS.forEach((st, i) => {
      const [x, y] = pt(i, R + 26);
      svg.append(s('text', { x: x.toFixed(1), y: (y + 4).toFixed(1), 'text-anchor': 'middle', 'font-size': 12 }, s('tspan', { fill: st.color }, st.code), s('tspan', { dx: 5, fill: '#e8f1ff' }, String(d.stats[st.id].level))));
    });
    return svg;
  }
  function weekChart(d) {
    const max = Math.max(100, ...d.week.map((x) => x.xp));
    const lab = (wd) => C.WEEKDAYS.find((x) => x.d === wd).s;
    return h('div', { class: 'week' }, d.week.map((x, i) => h('div', { class: 'col' + (i === 6 ? ' today' : ''), title: x.xp + ' XP' },
      h('div', { class: 'barwrap' }, h('i', { style: { '--h': Math.max(3, (x.xp / max) * 100) + '%' } })), h('span', null, lab(x.wd)))));
  }
  const fact = (v, label) => h('div', null, h('b', null, String(v)), h('span', null, label));
  function achRow(a, got) {
    const locked = !got;
    return h('div', { class: 'ach', 'data-lock': locked ? '1' : '0' },
      s('svg', { class: 'gem', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
        s('polygon', { points: HEX, fill: 'none', stroke: 'currentColor', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
        s('path', { d: locked ? 'M37 47h26v20H37zM42 47v-6a8 8 0 0 1 16 0v6' : 'M50 27l7.5 15.5 17 2.2-12.4 11.7 3.1 16.8L50 64.2 34.8 73.2l3.1-16.8-12.4-11.7 17-2.2z', fill: locked ? 'none' : 'currentColor', stroke: locked ? 'currentColor' : 'none', 'stroke-width': 4, 'stroke-linejoin': 'round' })),
      h('div', null, h('b', null, a.fa), h('span', { class: 'd' }, a.desc), a.title && got ? h('div', { style: { marginTop: '4px' } }, h('span', { class: 'badge' }, 'عنوان: ' + a.title)) : null));
  }
  function status(ctx) {
    const { state, d } = ctx, r = d.rank, nr = d.nextRank;
    const title = Ach.latestTitle(state);
    const recent = Ach.list.filter((a) => state.unlocked[a.id]).sort((a, b) => state.unlocked[b.id] - state.unlocked[a.id]).slice(0, 3);
    const pop = !ctx.ui.radarShown; ctx.ui.radarShown = true;
    return frag([
      win('hero', h('div', { style: { display: 'contents', '--rank': r.color } }, emblem(r, 88, true),
        h('div', null, h('h1', null, state.profile.name), h('div', { class: 'title', style: { color: r.color } }, ctx.title),
          title ? h('div', { class: 'sub' }, 'عنوان: ' + title) : null,
          h('div', { class: 'lvbig' }, h('small', null, 'LV'), String(d.level)),
          h('div', { class: 'sub' }, nr ? [`${fa(nr.minLevel - d.level)} سطح تا رتبه‌ی `, h('bdi', { class: 'rk', style: { color: nr.color } }, nr.id)] : 'بالاترین رتبه‌ی سیستم'),
          h('div', { class: 'sub' }, 'مجموع: ', h('span', { class: 'num' }, `${d.total.toLocaleString('en-US')} XP`))))),
      win('', winTitle('status', 'استات‌ها'), radar(d, pop),
        h('div', { class: 'stat-list' }, C.STATS.map((st) => { const p = d.stats[st.id]; return h('div', { class: 'stat-row', style: { '--c': st.color } }, h('span', { class: 'code' }, st.code), h('div', null, h('span', { class: 'name' }, st.fa), h('div', { class: 'bar', style: { '--p': p.pct } }, h('i'))), h('span', { class: 'lvl' }, String(p.level))); }))),
      win('', winTitle('bolt', 'این هفته'), h('div', { class: 'facts' }, fact(d.today.xp, 'XP امروز'), fact(d.streak, 'روز پیاپی'), fact(d.best, 'بهترین رکورد')), weekChart(d)),
      recent.length ? win('', winTitle('trophy', 'آخرین دستاوردها'), recent.map((a) => achRow(a, true))) : null,
    ]);
  }

  // ───────── quests ─────────
  function ring(done, total) {
    const c = 2 * Math.PI * 24, p = total ? done / total : 0;
    return h('div', { class: 'ring', role: 'img', 'aria-label': `${done} از ${total} کوئست` },
      s('svg', { viewBox: '0 0 58 58' }, s('circle', { class: 'bg', cx: 29, cy: 29, r: 24 }), s('circle', { class: 'fg', cx: 29, cy: 29, r: 24, 'stroke-dasharray': c.toFixed(1), 'stroke-dashoffset': (c * (1 - p)).toFixed(1) })),
      h('b', null, `${done}/${total}`));
  }
  function questCard(ctx, q) {
    const t = ctx.getTask(q.taskId), d = ctx.d;
    const prog = E.progressOf(d, q), done = prog >= q.target - 1e-9, single = isSingle(t), simple = single && q.target === 1;
    const tick = single || done ? 'M31 52L45 66L70 36' : 'M50 30V70M30 50H70';
    return h('article', { class: 'win quest', 'data-done': done ? '1' : '0', style: done ? null : { '--c': mainColor(t) } },
      h('button', { class: 'check', 'aria-label': (done ? 'کامل شده: ' : single ? 'ثبت انجام: ' : 'ثبت مقدار: ') + t.name, onclick: (e) => ctx.A.tap(q, e.currentTarget) },
        s('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' }, s('polygon', { class: 'hexfill', points: HEX, 'stroke-linejoin': 'round' }), s('path', { class: 'tick', d: tick }))),
      h('div', { class: 'q-main' }, h('div', { class: 'q-name' }, t.name),
        h('div', { class: 'q-meta' }, h('span', { class: 'xp' }, `${xpOf(t, q.target)} XP`), simple ? null : h('span', null, amount(t, q.target)), statChips(t)),
        simple ? null : h('div', { class: 'q-foot' }, h('div', { class: 'bar', style: { '--p': Math.min(1, prog / q.target) } }, h('i')), h('span', { class: 'tiny mute' }, `${fa(num(prog))}/${fa(num(q.target))}`))),
      h('button', { class: 'icon-btn', 'aria-label': 'گزینه‌های کوئست', onclick: () => ctx.A.questMenu(q) }, icon('more', 20)));
  }
  function quests(ctx) {
    const { state, d } = ctx;
    const todays = E.questsToday(state, d).filter((q) => ctx.getTask(q.taskId));
    const st = E.clearStatus(state, d, ctx.getTask);
    const isDone = (q) => E.progressOf(d, q) >= q.target - 1e-9;
    const out = [win('', h('div', { class: 'day' },
      h('div', null, h('h1', null, dateLabel(d.today.key)), h('div', { class: 'line' },
        h('span', null, icon('bolt', 14), `${d.today.xp} XP امروز`), h('span', null, icon('flame', 14), `${fa(d.streak)} روز پیاپی`),
        st.clear ? h('span', { style: { color: 'var(--ok)' } }, icon('check', 14), 'همه‌ی کوئست‌ها کامل شد') : null)),
      ring(st.done, st.total)))];
    if (!state.quests.length) out.push(win('empty', h('p', null, 'هنوز کوئستی نداری. از کتابخونه‌ی سیستم چند تا انتخاب کن یا کوئست دلخواه بساز.'), h('button', { class: 'btn primary', onclick: () => ctx.A.openAdd() }, icon('plus', 18), 'افزودن کوئست')));
    else if (!todays.length) out.push(win('empty', h('p', null, 'برای امروز کوئستی برنامه‌ریزی نشده.')));
    else todays.filter((q) => !isDone(q)).concat(todays.filter(isDone)).forEach((q) => out.push(questCard(ctx, q)));
    if (state.quests.length) out.push(h('button', { class: 'btn block add-quest', onclick: () => ctx.A.openAdd() }, icon('plus', 18), 'افزودن کوئست'));
    return frag(out);
  }

  // ───────── achievements ─────────
  function achievements(ctx) {
    const { state } = ctx, u = state.unlocked, all = Ach.list;
    const got = all.filter((a) => u[a.id]).sort((a, b) => u[b.id] - u[a.id]), lock = all.filter((a) => !u[a.id]);
    const open = !!ctx.ui.lockedOpen;
    return frag([
      win('', winTitle('trophy', 'دستاوردها', `${fa(got.length)} از ${fa(all.length)}`), h('div', { class: 'bar thick', style: { '--p': got.length / all.length, marginBottom: '8px' } }, h('i')),
        got.length ? got.map((a) => achRow(a, true)) : h('p', { class: 'hint' }, 'هنوز دستاوردی نداری. اولین کوئستت رو ثبت کن.')),
      win('', h('button', { class: 'btn ghost block', 'aria-expanded': String(open), onclick: () => { ctx.ui.lockedOpen = !open; ctx.A.render(); } }, icon('lock', 18), `${open ? 'پنهان کردن' : 'نمایش'} دستاوردهای قفل‌شده (${fa(lock.length)})`),
        open ? h('div', { style: { marginTop: '8px' } }, lock.map((a) => achRow(a, false))) : null),
    ]);
  }

  // ───────── settings ─────────
  let fieldSeq = 0;
  /** Labelled form field: the label is tied to the control (or the group) so screen readers announce it. */
  const field = (label, control, hint) => {
    const lab = h('label', null, label);
    const input = control.matches && control.matches('input,select,textarea') ? control : control.querySelector && control.querySelector('input,select,textarea');
    if (input) { input.id = input.id || 'fld' + (++fieldSeq); lab.htmlFor = input.id; }
    else { control.setAttribute('role', 'group'); control.setAttribute('aria-label', label); }
    return h('div', { class: 'field' }, lab, control, hint ? h('div', { class: 'hint' }, hint) : null);
  };
  const toggleRow = (label, on, fn) => h('div', { class: 'row' }, h('span', { class: 'grow' }, label), h('button', { class: 'chip', 'aria-pressed': String(!!on), onclick: () => fn(!on) }, on ? 'روشن' : 'خاموش'));
  function settings(ctx) {
    const { state, A } = ctx, S = state.settings, prof = L.profession(state.profile.professionId);
    const keyInp = h('input', { class: 'input', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'AIza…', value: S.apiKey, style: { direction: 'ltr' }, onchange: (e) => A.setSetting('apiKey', e.target.value.trim()) });
    const t = ctx.ui.aiTest;
    const hours = [0, 1, 2, 3, 4, 5, 6];
    return frag([
      win('', winTitle('status', 'حساب'),
        h('div', { class: 'stack' },
          field('نام', h('input', { class: 'input', value: state.profile.name, maxlength: 24, onchange: (e) => A.setName(e.target.value) })),
          h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'small mute' }, 'حرفه'), h('b', null, prof ? `${prof.icon} ${prof.name}` : state.profile.customName || 'دلخواه')), h('button', { class: 'btn small', onclick: () => A.pickProfession() }, 'تغییر حرفه')))),
      win('', winTitle('bolt', 'هوش مصنوعی (Gemini)'),
        h('div', { class: 'stack' },
          C.PREVIEW ? h('p', { class: 'hint', style: { margin: 0, color: 'var(--gold)' } }, 'این پیش‌نمایشه و به اینترنت بیرون وصل نیست. بررسی با Gemini فقط روی نسخه‌ی نصب‌شده کار می‌کنه؛ اینجا سیستم با قانون‌های داخلی بررسی می‌کنه.') : null,
          h('p', { class: 'hint', style: { margin: 0 } }, 'برای بررسی XP کوئست‌های دلخواه. اگه کلید نذاری یا اینترنت نباشه، سیستم با قانون‌های داخلی خودش بررسی می‌کنه. کلید فقط روی همین دستگاه می‌مونه.'),
          toggleRow('استفاده از Gemini', S.ai, (v) => A.setSetting('ai', v)),
          field('کلید API', h('div', { class: 'row' }, h('div', { class: 'grow' }, keyInp), h('button', { class: 'icon-btn', 'aria-label': 'نمایش کلید', onclick: () => { keyInp.type = keyInp.type === 'password' ? 'text' : 'password'; } }, icon('eye', 20))),
            'کلید رایگان رو از aistudio.google.com/apikey بگیر. گوگل از ایران جواب نمی‌ده؛ برای ارزیابی هوشمند VPN لازمه.'),
          field('نام مدل', h('input', { class: 'input', value: S.model, placeholder: V.AI.DEFAULT_MODEL, style: { direction: 'ltr' }, onchange: (e) => A.setSetting('model', e.target.value.trim()) })),
          h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => A.testAI() }, 'تست اتصال'),
            t ? (t.busy ? spinner('در حال تست…') : h('span', { class: 'badge ' + (t.ok ? 'ai' : 'warn') }, t.text)) : null))),
      win('', winTitle('settings', 'ظاهر و صدا'),
        h('div', { class: 'stack' },
          field('رنگ سیستم', h('div', { class: 'chips' }, [['auto', 'خودکار (روز آبی، شب بنفش)'], ['blue', 'آبی'], ['purple', 'بنفش']].map(([v, l]) => h('button', { class: 'chip', 'aria-pressed': String(S.theme === v), onclick: () => A.setSetting('theme', v) }, l)))),
          toggleRow('صدا', S.sound, (v) => A.setSetting('sound', v)), toggleRow('لرزش', S.vibrate, (v) => A.setSetting('vibrate', v)),
          field('شروع روز', h('select', { class: 'input', onchange: (e) => A.setSetting('dayStartHour', +e.target.value) }, hours.map((n) => h('option', { value: n, selected: n === S.dayStartHour }, `ساعت ${fa(n)} صبح`))), 'اگه شب‌ها دیر می‌خوابی، روزِ بازی از این ساعت شروع می‌شه تا پیاپی بودنت نپره.'))),
      win('', winTitle('download', 'داده‌ها'),
        h('div', { class: 'stack' },
          h('p', { class: 'hint', style: { margin: 0 } }, `${fa(state.events.length)} رکورد ذخیره شده. پشتیبان‌گیری مرتب، تنها راه مطمئن برای نگه‌داشتن پیشرفتته.`),
          h('div', { class: 'row wrap' }, h('button', { class: 'btn small', onclick: () => A.exportData() }, icon('download', 16), 'پشتیبان‌گیری'), h('button', { class: 'btn small', onclick: () => A.importData() }, icon('upload', 16), 'بازیابی'),
            ctx.canInstall ? h('button', { class: 'btn small', onclick: () => A.install() }, 'نصب برنامه') : null),
          h('div', { class: 'row wrap' }, h('button', { class: 'btn small ghost', onclick: () => A.forceUpdate() }, icon('refresh', 16), 'بروزرسانی اجباری'), h('button', { class: 'btn small danger', onclick: () => A.resetAll() }, icon('trash', 16), 'پاک‌کردن همه‌چیز')))),
      h('p', { class: 'hint', style: { textAlign: 'center' } }, `سیستم ویتو نسخه‌ی ${C.VERSION}`),
    ]);
  }

  // ───────── onboarding ─────────
  function typeLines(el, lines) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = lines.join('\n'); return; }
    let i = 0, j = 0, text = '';
    (function tick() {
      if (!el.isConnected || i >= lines.length) return;
      if (j < lines[i].length) { text += lines[i][j++]; } else { text += '\n'; i++; j = 0; }
      el.textContent = text; setTimeout(tick, 16);
    })();
  }
  function professionPicker(ctx, onPick, selectedId) {
    const search = h('input', { class: 'input', type: 'search', placeholder: 'جستجوی حرفه…', 'aria-label': 'جستجوی حرفه' });
    const grid = h('div', { class: 'pick' });
    const paint = () => {
      const q = T.norm(search.value);
      const list = L.professions.filter((p) => !q || T.norm(p.name).includes(q) || p.kw.some((k) => k.includes(q)));
      fill(grid, list.map((p) => h('button', { 'aria-pressed': String(p.id === selectedId), onclick: () => onPick({ id: p.id }) }, h('span', { class: 'ic' }, p.icon), p.name)));
      if (!list.length) grid.append(h('p', { class: 'hint', style: { gridColumn: '1/-1' } }, 'چیزی پیدا نشد. پایین‌تر حرفه‌ی دلخواهت رو بنویس.'));
    };
    search.addEventListener('input', paint); paint();

    const ta = h('textarea', { class: 'input', 'aria-label': 'کارهای روزانه', placeholder: 'هر خط یک کار. مثلاً:\nشادو زدن\nطناب بوکسوری\nدویدن' });
    const res = h('div', { class: 'stack' });
    const btn = h('button', { class: 'btn small', onclick: async () => {
      const text = ta.value.trim(); if (!text) return;
      btn.disabled = true; fill(res, spinner('در حال تشخیص…'));
      const found = E.detectProfession(text, L.professions).slice(0, 3);
      let ai = null;
      if ((!found.length || found[0].score < 0.4) && V.AI.isReady(ctx.state.settings)) { try { ai = await V.AI.detectProfession(ctx.state.settings, text, L.professions); } catch (e) { ai = { error: e.message }; } }
      const nodes = [];
      if (ai && ai.id) { const p = L.profession(ai.id); nodes.push(h('button', { class: 'btn block', onclick: () => onPick({ id: p.id }) }, `${p.icon} ${p.name} (پیشنهاد Gemini)`), h('p', { class: 'hint', style: { margin: 0 } }, ai.reason)); }
      if (ai && ai.customName) nodes.push(h('button', { class: 'btn block', onclick: () => onPick({ custom: ai.customName }) }, `ثبت به‌عنوان «${ai.customName}»`), h('p', { class: 'hint', style: { margin: 0 } }, ai.reason));
      found.forEach((f) => { const p = L.profession(f.id); if (!(ai && ai.id === p.id)) nodes.push(h('button', { class: 'btn block ghost', onclick: () => onPick({ id: p.id }) }, `${p.icon} ${p.name} — ${fa(Math.round(Math.min(1, f.score) * 100))}٪ تطابق`)); });
      if (!nodes.length) nodes.push(h('p', { class: 'hint', style: { margin: 0 } }, 'چیزی تشخیص داده نشد. از لیست انتخاب کن یا حرفه‌ی دلخواهت رو بنویس.'));
      if (ai && ai.error) nodes.push(h('span', { class: 'badge warn' }, ai.error));
      fill(res, nodes); btn.disabled = false;
    } }, 'تشخیص بده');
    const custom = h('input', { class: 'input', placeholder: 'مثلاً: نانوا، عکاس، راننده…', maxlength: 30, 'aria-label': 'حرفه‌ی دلخواه' });
    return h('div', { class: 'stack' }, search, grid,
      win('tight', h('div', { class: 'stack' }, h('b', null, 'از روی کارهام تشخیص بده'), ta, btn, res)),
      win('tight', h('div', { class: 'stack' }, h('b', null, 'حرفه‌م توی لیست نیست'), custom, h('button', { class: 'btn small', onclick: () => { const v = custom.value.trim(); if (v) onPick({ custom: v }); } }, 'ثبت حرفه‌ی دلخواه'), h('p', { class: 'hint', style: { margin: 0 } }, 'برای حرفه‌ی دلخواه، کوئست‌های عمومی و کوئست‌های خودت استفاده می‌شن.'))));
  }
  function onboarding(ctx) {
    const o = ctx.ui.onb || (ctx.ui.onb = { step: 0, name: '', profId: null, custom: '', picks: null });
    const steps = h('div', { class: 'steps' }, [0, 1, 2].map((i) => h('i', { class: i <= o.step ? 'on' : '' })));
    const go = (n) => { o.step = n; ctx.A.render(); window.scrollTo(0, 0); };
    if (o.step === 0) {
      const lines = h('div', { class: 'lines', 'aria-hidden': 'true' });
      requestAnimationFrame(() => typeLines(lines, ['> VITO SYSTEM v2.0', '> NEW PLAYER DETECTED', '> AWAITING IDENTITY_']));
      const inp = h('input', { class: 'input', placeholder: 'اسمت چیه؟', maxlength: 24, value: o.name, autocomplete: 'off', 'aria-label': 'نام', oninput: (e) => { o.name = e.target.value; } });
      return frag([steps, h('div', { class: 'boot' }, h('h1', null, 'سیستم ویتو'), lines, h('p', { class: 'mute', style: { margin: 0 } }, 'هر کاری که برای رشدت می‌کنی اینجا XP می‌شه و رتبه‌ات رو بالا می‌بره.'),
        win('', h('div', { class: 'stack' }, field('اسم قهرمان', inp), h('button', { class: 'btn primary block', onclick: () => { o.name = inp.value.trim() || 'شکارچی'; go(1); } }, 'ورود به سیستم'))))]);
    }
    if (o.step === 1) {
      return frag([steps, win('', winTitle('status', 'حرفه‌ات چیه؟'), professionPicker(ctx, (p) => { o.profId = p.id || 'custom'; o.custom = p.custom || ''; o.picks = null; go(2); }, o.profId)),
        h('button', { class: 'btn ghost block', onclick: () => go(0) }, 'برگشت')]);
    }
    const start = L.starters(o.profId);
    if (!o.picks) o.picks = new Set(start.map((t) => t.id));
    const prof = L.profession(o.profId);
    return frag([steps, win('', winTitle('quests', 'کوئست‌های شروع', prof ? prof.name : o.custom),
      h('p', { class: 'hint', style: { margin: '0 0 6px' } }, 'چند کوئست برای شروع انتخاب کن. بعداً هر وقت خواستی عوضشون می‌کنی.'),
      start.map((t) => { const b = h('button', { class: 'chip', 'aria-pressed': String(o.picks.has(t.id)), onclick: () => { o.picks.has(t.id) ? o.picks.delete(t.id) : o.picks.add(t.id); b.setAttribute('aria-pressed', String(o.picks.has(t.id))); fill(b, o.picks.has(t.id) ? [icon('check', 14), 'انتخاب شد'] : 'انتخاب'); } }, o.picks.has(t.id) ? [icon('check', 14), 'انتخاب شد'] : 'انتخاب');
        return h('div', { class: 'list-item' }, h('div', null, h('b', null, t.name), h('div', { class: 'meta' }, h('span', { class: 'num', style: { color: 'var(--acc)' } }, `${t.xp} XP`), h('span', null, amount(t, t.dose)), statChips(t))), b); })),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => go(1) }, 'برگشت'), h('button', { class: 'btn primary grow', onclick: () => ctx.A.finishOnboarding({ name: o.name, professionId: o.profId, customName: o.custom, starterIds: [...o.picks] }) }, 'شروع سیستم'))]);
  }

  // ───────── sheets ─────────
  function logSheet(ctx, q) {
    const t = ctx.getTask(q.taskId), U = C.UNITS[t.unit], step = stepFor(t);
    const left = Math.max(0, q.target - E.progressOf(ctx.d, q));
    const inp = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: String(r2(Math.max(U.min, Math.min(t.dose, left > 0 ? left : t.dose)))), 'aria-label': 'مقدار' });
    const pv = h('div', { class: 'preview', 'aria-live': 'polite' });
    const ok = h('button', { class: 'btn primary block' }, 'ثبت');
    const read = () => Math.max(0, parseFloat(inp.value) || 0);
    const refresh = () => {
      const p = E.previewLog(ctx.cur().state, t, read(), Date.now());
      ok.disabled = !p.ok;
      if (!p.ok) { fill(pv, h('small', null, p.reason === 'daily_cap' ? 'سقف امروز این کوئست پر شده.' : 'یک مقدار معتبر وارد کن.')); return; }
      const notes = [];
      if (p.clipped) notes.push(`فقط ${amount(t, p.amount)} حساب می‌شه (سقف روزانه)`);
      if (p.softCapped) notes.push('از سقف XP روزانه رد شدی؛ امتیاز کمتر می‌شه');
      if (p.mult > 1) notes.push(`پاداش پیاپی: ${fa(Math.round((p.mult - 1) * 1000) / 10)}٪`);
      fill(pv, `+${p.xp} XP`, notes.length ? h('small', null, notes.join('، ')) : null);
    };
    const set = (v) => { inp.value = String(r2(Math.max(0, v))); refresh(); };
    inp.addEventListener('input', refresh);
    const quick = [...new Set([t.dose / 2, t.dose, left > 0 ? left : 0, t.dose * 2].map(r2).filter((x) => x >= U.min))].sort((a, b) => a - b);
    const sh = D.sheet({ title: t.name, body: h('div', { class: 'stack' },
      h('div', { class: 'stepper' }, h('button', { class: 'btn', 'aria-label': 'کمتر', onclick: () => set(read() - step) }, '−'), h('div', { class: 'val' }, inp, h('div', { class: 'small mute' }, t.unitLabel)), h('button', { class: 'btn', 'aria-label': 'بیشتر', onclick: () => set(read() + step) }, '+')),
      h('div', { class: 'chips', style: { justifyContent: 'center' } }, quick.map((v) => h('button', { class: 'chip', onclick: () => set(v) }, fa(num(v))))), pv, ok) });
    ok.addEventListener('click', () => { if (ctx.A.log(q, read(), ok)) sh.close(); });
    refresh();
  }

  function questSheet(ctx, q) {
    const t = ctx.getTask(q.taskId), U = C.UNITS[t.unit], step = stepFor(t);
    const body = h('div', { class: 'stack' });
    const sh = D.sheet({ title: t.name, body });
    const paint = () => {
      const c = ctx.cur();
      if (!c.state.quests.includes(q)) { sh.close(); return; }
      const prog = E.progressOf(c.d, q), logs = c.d.today.events.filter((e) => e.task === q.taskId), days = q.days && q.days.length ? q.days : C.WEEKDAYS.map((w) => w.d);
      const room = Math.max(0, t.maxDaily - prog);
      fill(body, 
        h('div', { class: 'meta', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center', fontSize: '13px', color: 'var(--mute)' } },
          h('span', { class: 'num', style: { color: 'var(--acc)' } }, `${t.xp} XP`), h('span', null, `برای ${amount(t, t.dose)}`), statChips(t, 3), h('span', null, `سقف روزانه: ${amount(t, t.maxDaily)}`)),
        room > 0 ? h('button', { class: 'btn primary block', onclick: () => { sh.close(); ctx.A.openLog(q); } }, icon('plus', 18), 'ثبت مقدار') : h('p', { class: 'hint', style: { margin: 0 } }, 'سقف امروز این کوئست پر شده.'),
        field('هدف روزانه', h('div', { class: 'stepper' }, h('button', { class: 'btn', 'aria-label': 'کمتر', onclick: () => { ctx.A.updateQuest(q, { target: r2(Math.max(U.min, q.target - step)) }); paint(); } }, '−'),
          h('div', { class: 'val', style: { textAlign: 'center', font: '700 24px var(--hud)', direction: 'ltr' } }, fa(num(q.target)), h('div', { class: 'small mute', style: { font: '400 13px var(--sans)', direction: 'rtl' } }, t.unitLabel)),
          h('button', { class: 'btn', 'aria-label': 'بیشتر', onclick: () => { ctx.A.updateQuest(q, { target: r2(Math.min(t.maxDaily, q.target + step)) }); paint(); } }, '+'))),
        field('روزهای هفته', h('div', { class: 'chips' }, C.WEEKDAYS.map((w) => h('button', { class: 'chip', 'aria-pressed': String(days.includes(w.d)), 'aria-label': w.fa, onclick: () => {
          const next = days.includes(w.d) ? days.filter((x) => x !== w.d) : days.concat(w.d);
          if (!next.length) return;
          ctx.A.updateQuest(q, { days: next.length === 7 ? null : next }); paint();
        } }, w.s)))),
        logs.length ? field('ثبت‌های امروز', h('div', null, logs.map((e) => h('div', { class: 'list-item' }, h('span', null, `${amount(t, e.amt)} — ${e.xp} XP`), h('button', { class: 'icon-btn', 'aria-label': 'حذف این ثبت', onclick: () => { ctx.A.deleteLog(e.id); paint(); } }, icon('trash', 18)))))) : null,
        h('button', { class: 'btn danger block', onclick: async () => { if (await D.confirmBox({ title: 'حذف کوئست', text: `«${t.name}» از کوئست‌هات برداشته می‌شه. XPهایی که گرفتی می‌مونه.`, ok: 'حذف', danger: true })) { ctx.A.removeQuest(q); sh.close(); } } }, icon('trash', 18), 'حذف کوئست'));
    };
    paint();
  }

  const FLAG_TEXT = { xp_lowered: 'XP درخواستی کاهش یافت', xp_raised: 'XP درخواستی افزایش یافت', xp_ok: 'XP درخواستی تأیید شد', anchored: 'هم‌تراز با تسک مشابه شد', minutes_adjusted: 'زمان با تسک مشابه تنظیم شد', minutes_estimated: 'زمان تخمینی' };
  const DEFAULT_DOSE = { minute: 30, hour: 1, page: 10, rep: 20, km: 2, glass: 1, session: 1, count: 1 };
  function verdictView(ctx, res, onAdded, onEdit) {
    const { task, verdict } = res;
    const bad = !verdict.approved;
    return h('div', { class: 'verdict' },
      h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, task.name),
        h('span', { class: 'badge ' + (verdict.by === 'ai' ? 'ai' : '') }, verdict.by === 'ai' ? 'ارزیابی Gemini' : 'ارزیابی آفلاین')),
      bad ? h('p', { style: { margin: 0, color: '#ffb3bd' } }, 'سیستم این کوئست رو تأیید نکرد.') : h('div', null, h('div', { class: 'xpbig' }, `+${task.xp} XP`), h('div', { class: 'small mute' }, `برای هر ${amount(task, task.dose)}`)),
      verdict.reason ? h('p', { class: 'small', style: { margin: 0 } }, verdict.reason) : null,
      h('div', { class: 'chips' }, verdict.refName ? h('span', { class: 'badge' }, `مرجع: «${verdict.refName}» (${verdict.refXp} XP)`) : null,
        verdict.flags.filter((f) => FLAG_TEXT[f]).map((f) => h('span', { class: 'badge' }, FLAG_TEXT[f])), res.aiError ? h('span', { class: 'badge warn' }, res.aiError) : null),
      h('div', { class: 'row wrap small mute' }, statChips(task, 3), h('span', null, `سقف روزانه: ${amount(task, task.maxDaily)}`)),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: onEdit }, 'ویرایش'),
        bad ? null : h('button', { class: 'btn primary grow', onclick: () => { ctx.A.addCustom(res); onAdded(); } }, icon('plus', 18), 'افزودن کوئست')));
  }
  function customForm(ctx, onAdded) {
    const f = { unit: 'session' };
    const name = h('input', { class: 'input', placeholder: 'مثلاً: شادو زدن', maxlength: 40, 'aria-label': 'نام کوئست' });
    const dose = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: '1', 'aria-label': 'مقدار هر بار' });
    const unit = h('select', { class: 'input', 'aria-label': 'واحد', onchange: (e) => { f.unit = e.target.value; dose.value = String(DEFAULT_DOSE[f.unit] || 1); } }, Object.entries(C.UNITS).map(([k, u]) => h('option', { value: k, selected: k === f.unit }, u.fa)));
    const minutes = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: 'any', placeholder: 'اختیاری', 'aria-label': 'زمان به دقیقه' });
    const xp = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '0', step: '1', placeholder: 'اختیاری', 'aria-label': 'XP پیشنهادی' });
    const out = h('div');
    const go = h('button', { class: 'btn primary block', onclick: async () => {
      if (!name.value.trim()) { D.toast('اسم کوئست رو بنویس.', { kind: 'bad' }); name.focus(); return; }
      go.disabled = true; fill(out, spinner('سیستم در حال ارزیابی…'));
      const res = await ctx.A.judgeCustom({ name: name.value.trim(), unit: f.unit, unitLabel: C.UNITS[f.unit].fa, dose: parseFloat(dose.value) || 1, minutes: parseFloat(minutes.value) || 0, xp: parseFloat(xp.value) || 0 });
      go.disabled = false; fill(out, verdictView(ctx, res, onAdded, () => fill(out)));
    } }, 'بررسی توسط سیستم');
    return h('div', { class: 'stack' },
      field('نام کوئست', name),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field('واحد', unit)), h('div', { class: 'grow' }, field('مقدار هر بار', dose))),
      h('div', { class: 'row' }, h('div', { class: 'grow' }, field('زمان هر بار (دقیقه)', minutes)), h('div', { class: 'grow' }, field('XP پیشنهادی', xp))),
      h('p', { class: 'hint', style: { margin: 0 } }, 'سیستم کوئست تو رو با کوئست‌های مشابه حرفه‌ات مقایسه می‌کنه. اگه XP پیشنهادیت از مقیاس بازی دور باشه، اصلاحش می‌کنه.'), go, out);
  }

  function addSheet(ctx, startTab) {
    const prof = L.profession(ctx.state.profile.professionId);
    let tab = startTab || (prof ? 'prof' : 'common'), q = '';
    const tabs = [prof ? ['prof', 'حرفه‌ی من'] : null, ['common', 'عمومی'], ['custom', 'دلخواه']].filter(Boolean);
    const body = h('div', { class: 'stack' }), list = h('div');
    const search = h('input', { class: 'input', type: 'search', placeholder: 'جستجو…', 'aria-label': 'جستجو', oninput: (e) => { q = T.norm(e.target.value); paint(); } });
    const sh = D.sheet({ title: 'افزودن کوئست', full: true, body });
    const has = (id) => ctx.cur().state.quests.some((x) => x.taskId === id);
    const row = (t) => h('div', { class: 'list-item' }, h('div', null, h('b', null, t.name), h('div', { class: 'meta' }, h('span', { class: 'num', style: { color: 'var(--acc)' } }, `${t.xp} XP`), h('span', null, `برای ${amount(t, t.dose)}`), statChips(t))),
      has(t.id) ? h('span', { class: 'badge' }, icon('check', 14), 'اضافه شد') : h('button', { class: 'btn small', onclick: () => { if (ctx.A.addQuest(t)) paint(); } }, icon('plus', 16), 'افزودن'));
    const match = (t) => !q || T.norm(t.name).includes(q) || t.kw.some((k) => k.includes(q));
    function paint() {
      fill(tabBar, tabs.map(([id, label]) => h('button', { class: 'chip', 'aria-pressed': String(tab === id), onclick: () => { tab = id; paint(); } }, label)));
      search.hidden = tab === 'custom';
      if (tab === 'prof') fill(list, prof.tasks.filter(match).map(row));
      else if (tab === 'common') {
        const nodes = [];
        C.STATS.forEach((st) => { const ts = L.common.filter((t) => match(t) && topStats(t, 1)[0] === st); if (ts.length) nodes.push(h('div', { style: { color: st.color, fontWeight: 800, fontSize: '13px', margin: '14px 0 2px' } }, st.fa), ...ts.map(row)); });
        fill(list, nodes);
      } else {
        const mine = ctx.cur().state.customTasks;
        fill(list, customForm(ctx, () => paint()), mine.length ? h('div', { style: { marginTop: '16px' } }, h('b', { style: { fontSize: '14px' } }, 'کوئست‌های دلخواه تو'),
          mine.map((t) => h('div', { class: 'list-item' }, h('div', null, h('b', null, t.name), h('div', { class: 'meta' }, h('span', { class: 'num', style: { color: 'var(--acc)' } }, `${t.xp} XP`), h('span', null, `برای ${amount(t, t.dose)}`))),
            h('div', { class: 'row' }, has(t.id) ? h('span', { class: 'badge' }, icon('check', 14), 'اضافه شد') : h('button', { class: 'btn small', onclick: () => { ctx.A.addQuest(t); paint(); } }, icon('plus', 16)),
              h('button', { class: 'icon-btn', 'aria-label': 'حذف از کتابخونه', onclick: async () => { if (await D.confirmBox({ title: 'حذف کوئست دلخواه', text: `«${t.name}» برای همیشه حذف می‌شه.`, ok: 'حذف', danger: true })) { ctx.A.deleteCustom(t.id); paint(); } } }, icon('trash', 18)))))) : null);
      }
    }
    const tabBar = h('div', { class: 'chips' });
    body.append(tabBar, search, list); paint();
    return sh;
  }
  /** Preview-only: shows the backup as text to copy, because the sandbox cannot start a file download. */
  function exportSheet(json) {
    const ta = h('textarea', { class: 'input', 'aria-label': 'متن پشتیبان', rows: 8, style: { direction: 'ltr', minHeight: '170px', fontSize: '12px', padding: '10px', lineHeight: '1.5' } });
    ta.value = json; ta.readOnly = true;
    const copy = async () => { try { await navigator.clipboard.writeText(json); D.toast('کپی شد.', { kind: 'ok' }); } catch (e) { ta.focus(); ta.select(); D.toast('متن انتخاب شد؛ دستی کپی کن.'); } };
    return D.sheet({ title: 'پشتیبان', body: h('div', { class: 'stack' },
      h('p', { class: 'hint', style: { margin: 0 } }, 'توی پیش‌نمایش دانلود فایل ممکن نیست. متن رو کپی کن و توی یه فایل با پسوند .json نگه دار؛ با «بازیابی» برمی‌گرده.'),
      ta, h('button', { class: 'btn primary block', onclick: copy }, 'کپی متن')) });
  }
  function professionSheet(ctx, onPick) {
    const sh = D.sheet({ title: 'تغییر حرفه', full: true, body: h('div') });
    sh.setBody(professionPicker(ctx, (p) => { onPick(p); sh.close(); }, ctx.state.profile.professionId));
    return sh;
  }

  V.Views = { exportSheet, hud, nav, status, quests, achievements, settings, onboarding, logSheet, questSheet, addSheet, professionSheet };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Views;
})(typeof window !== 'undefined' ? window : globalThis);
