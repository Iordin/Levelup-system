/* ai.js — Gemini client. The model only PROPOSES; engine.judgeCustom decides. Every call can fail: callers fall back to local rules. */
(function (g) {
  'use strict';
  const V = g.VITO, T = V.Text, { clamp } = T;
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
  const FALLBACKS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
  const MSG = {
    NO_KEY: 'کلید Gemini تنظیم نشده.',
    KEY: 'کلید Gemini معتبر نیست یا دسترسی ندارد.',
    REGION: 'گوگل از این شبکه جواب نمی‌ده؛ VPN رو روشن کن.',
    NETWORK: 'اتصال به Gemini برقرار نشد؛ اینترنت یا VPN رو بررسی کن.',
    TIMEOUT: 'Gemini دیر جواب داد.',
    CANCEL: 'لغو شد.',
    QUOTA: 'سهمیه‌ی رایگان Gemini تموم شده؛ کمی بعد دوباره امتحان کن.',
    MODEL: 'این مدل در دسترس نیست؛ نام مدل رو در تنظیمات عوض کن.',
    SERVER: 'سرور Gemini مشکل داره؛ کمی بعد دوباره امتحان کن.',
    BLOCKED: 'Gemini این درخواست رو رد کرد.',
    PARSE: 'جواب Gemini قابل‌فهم نبود.',
    BAD_REQUEST: 'درخواست به Gemini پذیرفته نشد.',
    PREVIEW: 'پیش‌نمایش به اینترنت بیرون وصل نیست؛ Gemini روی نسخه‌ی نصب‌شده‌ی برنامه کار می‌کنه.',
  };
  class AIError extends Error {
    constructor(code, extra) { super(MSG[code] || code); this.name = 'AIError'; this.code = code; if (extra) Object.assign(this, extra); }
  }

  // The request field for JSON mode changed between API generations, so try the newest shape first and degrade.
  const variants = (schema) => [
    (c) => Object.assign({}, c, { responseFormat: { text: { mimeType: 'application/json', schema } } }),
    (c) => Object.assign({}, c, { responseMimeType: 'application/json' }),
    (c) => c,
  ];
  let goodVariant = 0;

  function mapHttp(status, data) {
    const err = (data && data.error) || {}, msg = String(err.message || '');
    const extra = { status, detail: msg };
    if (status === 400 && (err.status === 'FAILED_PRECONDITION' || /location is not supported/i.test(msg))) return new AIError('REGION', extra);
    if (/API key not valid|API_KEY_INVALID|API key expired/i.test(msg) || status === 401 || status === 403) return new AIError('KEY', extra);
    if (status === 404) return new AIError('MODEL', extra);
    if (status === 429) return new AIError('QUOTA', extra);
    if (status >= 500) return new AIError('SERVER', extra);
    return new AIError('BAD_REQUEST', extra);
  }

  async function once({ key, model, system, prompt, cfg, signal, timeoutMs }) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort('timeout'), timeoutMs);
    const onAbort = () => ctl.abort('cancel');
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    let res;
    try {
      res = await fetch(BASE + encodeURIComponent(model) + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: cfg }),
        signal: ctl.signal,
      });
    } catch (e) {
      if (ctl.signal.aborted) throw new AIError(ctl.signal.reason === 'cancel' ? 'CANCEL' : 'TIMEOUT');
      throw new AIError('NETWORK');
    } finally { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* not json */ }
    if (!res.ok) throw mapHttp(res.status, data);
    if (data && data.promptFeedback && data.promptFeedback.blockReason) throw new AIError('BLOCKED');
    const cand = data && data.candidates && data.candidates[0];
    const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map((p) => p.text || '').join('') : '';
    if (!text.trim()) throw new AIError('PARSE', { finish: cand && cand.finishReason });
    return text;
  }
  function parseJson(text) {
    const s = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new AIError('PARSE');
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new AIError('PARSE'); }
  }

  /** Ask for a JSON object. Retries other request shapes (400/parse) and other models (404/429/5xx). */
  async function generateJson({ settings, system, prompt, schema, signal, timeoutMs }) {
    const key = settings && settings.apiKey && settings.apiKey.trim();
    if (!key) throw new AIError('NO_KEY');
    if (V.Config.PREVIEW) throw new AIError('PREVIEW');
    const first = (settings.model || '').trim() || DEFAULT_MODEL;
    const models = [first].concat(FALLBACKS.filter((m) => m !== first)).slice(0, 3);
    const vs = variants(schema);
    let last = null;
    for (const model of models) {
      for (let vi = goodVariant; vi < vs.length; vi++) {
        try {
          const text = await once({ key, model, system, prompt, cfg: vs[vi]({ temperature: 0.2, maxOutputTokens: 4096 }), signal, timeoutMs: timeoutMs || 25000 });
          const out = parseJson(text);
          goodVariant = vi;
          return { data: out, model };
        } catch (e) {
          last = e;
          if ((e.code === 'BAD_REQUEST' || e.code === 'PARSE') && vi < vs.length - 1) continue;
          if (e.code === 'MODEL' || e.code === 'QUOTA' || e.code === 'SERVER') break;
          throw e;
        }
      }
    }
    throw last || new AIError('NETWORK');
  }

  // ── tasks ──
  const JUDGE_SCHEMA = {
    type: 'object',
    properties: {
      approved: { type: 'boolean' }, name: { type: 'string' }, minutes: { type: 'number' }, intensity: { type: 'number' },
      stats: { type: 'object', properties: { str: { type: 'number' }, vit: { type: 'number' }, int: { type: 'number' }, will: { type: 'number' }, cha: { type: 'number' }, fin: { type: 'number' } }, required: ['str', 'vit', 'int', 'will', 'cha', 'fin'] },
      match_id: { type: ['string', 'null'] }, max_per_day: { type: 'number' }, reason: { type: 'string' },
    },
    required: ['approved', 'name', 'minutes', 'intensity', 'stats', 'reason'],
  };
  const SYSTEM = 'You are the rules engine of a Persian self-improvement RPG. You calibrate how much XP a real-life activity deserves so that progression stays fair across professions. Answer with one JSON object only, no markdown.';

  function refLines(library, input, professionId) {
    const E = V.Engine, seen = new Map();
    const add = (t) => seen.set(t.id, t);
    E.findSimilar(input.name, library.all(), { prefer: professionId, limit: 10 }).forEach((x) => add(x.task));
    const p = library.profession(professionId);
    if (p) p.tasks.slice(0, 8).forEach(add);
    ['gym', 'read', 'meditate', 'study'].forEach((id) => library.get(id) && add(library.get(id)));
    return Array.from(seen.values()).slice(0, 26).map((t) => `${t.id} | ${t.name} | ${t.dose} ${t.unitLabel} | ${t.mpd} min | intensity ${t.intensity} | ${t.xp} XP`).join('\n');
  }
  function judgePrompt(input, profName, refs) {
    return [
      `Player profession: ${profName || 'unspecified'}.`,
      `New task written by the player (Persian): "${input.name}"`,
      `One log = ${input.dose} ${input.unitLabel || input.unit}. Player's own time estimate for one log: ${input.minutes ? input.minutes + ' minutes' : 'not given'}. Player's requested XP per log: ${input.xp || 'not given'}.`,
      'Scale: XP = minutes × 0.5 × intensity. Intensity 1.0 = light routine, 1.5 = focused, 2.0 = demanding, 2.5 = hard training, 3.0 = extreme (rare).',
      'Reference tasks already in the game (id | name | amount | minutes | intensity | XP):',
      refs,
      'Return JSON with keys: approved (false only if this is not a real, healthy activity), name (cleaned Persian name, max 40 chars),',
      'minutes (realistic effort minutes for ONE log), intensity (1.0-3.0), stats (weights for str, vit, int, will, cha, fin summing to about 1),',
      'match_id (id of the most similar reference task or null), max_per_day (sensible maximum amount per day, same unit as the log), reason (one short Persian sentence on why this XP is fair).',
    ].join('\n');
  }
  function sanitizeJudge(r) {
    if (!r || typeof r !== 'object') throw new AIError('PARSE');
    const n = (x) => (isFinite(+x) ? +x : 0);
    return {
      approved: r.approved !== false,
      name: typeof r.name === 'string' ? r.name.trim().slice(0, 48) : '',
      minutes: clamp(n(r.minutes), 0, 600),
      intensity: n(r.intensity) > 0 ? clamp(n(r.intensity), 1, 3) : 0,
      stats: r.stats && typeof r.stats === 'object' ? r.stats : null,
      match_id: typeof r.match_id === 'string' ? r.match_id : null,
      max_per_day: n(r.max_per_day) > 0 ? n(r.max_per_day) : 0,
      reason: typeof r.reason === 'string' ? r.reason.trim().slice(0, 200) : '',
    };
  }
  async function judgeTask(settings, input, { library, professionId }) {
    const prof = library.profession(professionId);
    const { data, model } = await generateJson({ settings, system: SYSTEM, schema: JUDGE_SCHEMA, prompt: judgePrompt(input, prof ? prof.name : '', refLines(library, input, professionId)) });
    const out = sanitizeJudge(data);
    if (out.match_id && !library.get(out.match_id)) out.match_id = null;
    out.model = model;
    return out;
  }

  const DETECT_SCHEMA = { type: 'object', properties: { profession_id: { type: ['string', 'null'] }, custom_name: { type: ['string', 'null'] }, reason: { type: 'string' } }, required: ['reason'] };
  async function detectProfession(settings, text, professions) {
    const list = professions.map((p) => `${p.id} | ${p.name}`).join('\n');
    const prompt = `A user describes what they do every day (Persian):\n"${text}"\n\nKnown professions (id | name):\n${list}\n\nReturn JSON: profession_id (the best matching id, or null if none fits), custom_name (a short Persian profession name if none fits, else null), reason (one short Persian sentence).`;
    const { data } = await generateJson({ settings, system: SYSTEM, schema: DETECT_SCHEMA, prompt });
    const id = typeof data.profession_id === 'string' && professions.some((p) => p.id === data.profession_id) ? data.profession_id : null;
    return { id, customName: !id && typeof data.custom_name === 'string' ? data.custom_name.trim().slice(0, 40) : '', reason: String(data.reason || '').slice(0, 200) };
  }
  async function test(settings) {
    const t0 = Date.now();
    const { model } = await generateJson({ settings, system: 'Answer with one JSON object only.', prompt: 'Return {"ok": true}', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] }, timeoutMs: 20000 });
    return { ok: true, model, ms: Date.now() - t0 };
  }
  const isReady = (s) => !!(s && s.ai !== false && s.apiKey && s.apiKey.trim());

  V.AI = { AIError, MSG, DEFAULT_MODEL, FALLBACKS, generateJson, judgeTask, detectProfession, test, isReady, parseJson, sanitizeJudge, _resetVariant: () => { goodVariant = 0; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = V.AI;
})(typeof window !== 'undefined' ? window : globalThis);
