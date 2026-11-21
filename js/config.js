/* config.js — every tunable number of the game lives here. */
(function (g) {
  'use strict';
  const V = (g.VITO = g.VITO || {});

  // Radar order = clockwise from the top.
  const STATS = [
    { id: 'str', code: 'STR', fa: 'قدرت', color: '#ff5d73' },
    { id: 'int', code: 'INT', fa: 'هوش', color: '#36c5ff' },
    { id: 'cha', code: 'CHA', fa: 'ارتباطات', color: '#ffb347' },
    { id: 'fin', code: 'FIN', fa: 'مالی', color: '#f2d14b' },
    { id: 'will', code: 'WILL', fa: 'اراده', color: '#b388ff' },
    { id: 'vit', code: 'VIT', fa: 'استقامت', color: '#3ddc97' },
  ];

  // Ranks rise with level. Title = "<profession> <adj>", e.g. «آشپز ماهر».
  const RANKS = [
    { id: 'E', minLevel: 1, adj: 'نوآموز', color: '#8e9bb3' },
    { id: 'D', minLevel: 8, adj: 'کارآموز', color: '#3ddc97' },
    { id: 'C', minLevel: 20, adj: 'ماهر', color: '#36c5ff' },
    { id: 'B', minLevel: 38, adj: 'حرفه‌ای', color: '#9a86ff' },
    { id: 'A', minLevel: 60, adj: 'استاد', color: '#ffb347' },
    { id: 'S', minLevel: 85, adj: 'افسانه‌ای', color: '#ff3d6e' },
  ];

  // mpu = default effort-minutes per unit (used only when a custom task gives no minutes).
  const UNITS = {
    session: { fa: 'جلسه', mpu: 45, step: 1, min: 1 },
    minute: { fa: 'دقیقه', mpu: 1, step: 5, min: 1 },
    hour: { fa: 'ساعت', mpu: 60, step: 0.5, min: 0.5 },
    page: { fa: 'صفحه', mpu: 2.5, step: 5, min: 1 },
    rep: { fa: 'تکرار', mpu: 0.125, step: 5, min: 1 },
    km: { fa: 'کیلومتر', mpu: 7, step: 0.5, min: 0.5 },
    glass: { fa: 'لیوان', mpu: 1, step: 1, min: 1 },
    count: { fa: 'بار', mpu: 15, step: 1, min: 1 },
  };

  V.Config = {
    VERSION: '2.0.0',
    STORAGE_KEY: 'vitoSystem.v2',
    PREVIEW: !!(typeof window !== 'undefined' && window.VITO_PREVIEW), // single-file preview build: no downloads, no outside network
    K: 0.5, // XP per effort-minute at intensity 1  →  XP = minutes × K × intensity
    INTENSITY: [1, 3], // 1 light … 3 extreme
    LEVEL: { a: 60, b: 12, c: 0.9 }, // XP needed for level n → n+1  =  a + b·n + c·n²
    SOFT_CAP: 500, // XP per day at full rate…
    SOFT_RATE: 0.25, // …and this fraction beyond it
    STREAK: { minXP: 30, perDay: 0.005, max: 0.15 }, // a day counts at ≥ minXP; bonus is added to XP
    CLEAR: { rate: 0.1, min: 10 }, // all of today's quests done → bonus
    MAX_MINUTES_PER_TASK_DAY: 360, // cap on how much effort of ONE task counts per day
    REF_BAND: [0.7, 1.3], // custom task XP must stay within this band of a similar library task
    CUSTOM_BAND: [0.75, 1.25], // requested XP vs. the system's fair value
    MATCH_MIN: 0.4, // minimum similarity to treat a library task as a reference
    DAY_START_HOUR: 4, // the game day starts at 04:00 so night owls keep their streak
    STATS, RANKS, UNITS,
    WEEKDAYS: [ // Persian week order; `d` = JS getDay()
      { d: 6, s: 'ش', fa: 'شنبه' }, { d: 0, s: 'ی', fa: 'یکشنبه' }, { d: 1, s: 'د', fa: 'دوشنبه' },
      { d: 2, s: 'س', fa: 'سه‌شنبه' }, { d: 3, s: 'چ', fa: 'چهارشنبه' }, { d: 4, s: 'پ', fa: 'پنجشنبه' }, { d: 5, s: 'ج', fa: 'جمعه' },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.Config;
})(typeof window !== 'undefined' ? window : globalThis);
