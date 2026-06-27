// ─────────────────────────────────────────────────────────────────────────────
//  stringClassifier/allowlist.js — proper-noun content exceptions.
//
//  Some real, player-facing words structurally look like noise to the heuristics:
//  a lone capitalized token (→ "technical") or a word with diacritics (→ "foreign").
//  Place / character names from the game are the classic case. They must always
//  be treated as CONTENT — never auto-hidden as technical, never flagged foreign.
//
//  Matching is on the normalized form: lowercased, stripped of any non-letters,
//  so "Peräjärvi", "PERÄJÄRVI" and "peräjärvi." all match the single entry.
// ─────────────────────────────────────────────────────────────────────────────

// Lowercased, letters-only. Keep entries normalized via `normalizeWord`.
const CONTENT_EXCEPTIONS = new Set([
  // My Summer Car — place names (Finnish, lone capitalized words / diacritics).
  'peräjärvi',
  'loppe',
  'rykipohja',
  'kesselinperä',
]);

// Normalize a token the same way both detectors compare words: lowercase and
// drop everything that isn't a letter (trailing punctuation, quotes, …).
function normalizeWord(word) {
  return String(word || '').toLowerCase().replace(/[^\p{L}]/gu, '');
}

// True when the whole trimmed string is a single allowlisted proper noun.
function isContentException(text) {
  return CONTENT_EXCEPTIONS.has(normalizeWord(text));
}

// True when an individual already-lowercased word is allowlisted.
function isExceptionWord(word) {
  return CONTENT_EXCEPTIONS.has(normalizeWord(word));
}

module.exports = { CONTENT_EXCEPTIONS, normalizeWord, isContentException, isExceptionWord };
