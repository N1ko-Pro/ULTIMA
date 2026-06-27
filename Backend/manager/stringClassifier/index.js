// ─────────────────────────────────────────────────────────────────────────────
//  stringClassifier — decides whether extracted strings are player-facing TEXT
//  or TECHNICAL tokens, so the editor can hide the noise by default without ever
//  destroying data.
//
//  Design (Phase 1 — deterministic, offline, explainable):
//    • Per-string weighted scoring from structural rules (./rules.js).
//    • Three confidence bands: 'technical' | 'uncertain' | 'text'.
//        - 'technical' → hidden by default (high confidence it's a key/path/id).
//        - 'uncertain' → shown but flagged (lone words, short all-caps, …).
//        - 'text'      → shown clean (natural multi-word language).
//    • A conservative bias: only clear cases are marked technical; anything
//      ambiguous stays visible. Hiding a real UI string is worse than showing junk.
//    • A second clustering pass escalates 'uncertain' strings that share a
//      namespace prefix (e.g. `MSCQualityTweaks_*`) with confirmed technical ones.
//
//  Each verdict carries `reasons` (rule codes) so the UI can explain itself and
//  the user can trust / override it. The API accepts an optional per-string
//  `context` object (IL usage from the tool) — unused today, but wired so a
//  future phase can feed it in without reshaping callers.
// ─────────────────────────────────────────────────────────────────────────────

const { RULES, THRESHOLDS, TECHNICAL_REASONS } = require('./rules');
const { scoreContext } = require('./context');
const { detectForeignLanguage } = require('./language');

/**
 * Classify a single string.
 * @param {string} text
 * @param {object} [context]  optional IL-usage signals from the extractor
 * @returns {{ category: 'text'|'technical'|'uncertain', score: number, reasons: string[] }}
 */
function classifyString(text, context) {
  const value = typeof text === 'string' ? text : '';
  let score = 0;
  const reasons = [];

  for (const rule of RULES) {
    const weight = rule.score(value, context);
    if (weight) {
      score += weight;
      reasons.push(rule.id);
    }
  }

  // IL-usage context (Phase 2) — decisive when present, no-op when absent.
  const ctx = scoreContext(context);
  if (ctx.weight) {
    score += ctx.weight;
    reasons.push(...ctx.reasons);
  }

  let category = 'uncertain';
  if (score >= THRESHOLDS.technical) category = 'technical';
  else if (score <= THRESHOLDS.text) category = 'text';

  // Surface only the reasons that justify a "technical" lean — negative
  // (text) signals would be noise in the UI explanation.
  return {
    category,
    score,
    reasons: reasons.filter((r) => TECHNICAL_REASONS.has(r)),
    foreign: detectForeignLanguage(value),
  };
}

// Escalate 'uncertain' strings that share a `Prefix_` namespace with ≥2 strings
// already judged technical. Cheap structural clustering; grows more powerful
// once IL context lands.
function applyPrefixClustering(results) {
  const technicalByPrefix = new Map();
  const prefixOf = (text) => {
    const i = text.indexOf('_');
    return i > 0 ? text.slice(0, i) : null;
  };

  for (const r of results) {
    if (r.category !== 'technical') continue;
    const prefix = prefixOf(r.text);
    if (prefix) technicalByPrefix.set(prefix, (technicalByPrefix.get(prefix) || 0) + 1);
  }

  for (const r of results) {
    if (r.category !== 'uncertain') continue;
    const prefix = prefixOf(r.text);
    if (prefix && (technicalByPrefix.get(prefix) || 0) >= 2) {
      r.category = 'technical';
      if (!r.reasons.includes('cluster')) r.reasons.push('cluster');
    }
  }
}

/**
 * Classify a batch of strings and return a meta map keyed by id.
 * @param {Array<{ id: string, text: string, context?: object }>} items
 * @returns {Record<string, { category: string, score: number, reasons: string[] }>}
 */
function classifyStrings(items) {
  const results = (items || []).map(({ id, text, context }) => {
    const verdict = classifyString(text, context);
    return { id, text: typeof text === 'string' ? text : '', ...verdict };
  });

  applyPrefixClustering(results);

  const meta = {};
  for (const r of results) {
    meta[r.id] = { category: r.category, score: r.score, reasons: r.reasons, foreign: r.foreign };
  }
  return meta;
}

module.exports = { classifyString, classifyStrings };
