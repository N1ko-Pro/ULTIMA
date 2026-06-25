// ─────────────────────────────────────────────────────────────────────────────
//  stringClassifier/rules.js — pure, weighted detectors for deciding whether an
//  extracted string is player-facing TEXT or a TECHNICAL token (identifier,
//  path, key, format, asset name, …).
//
//  Each rule returns a signed weight: positive pushes toward "technical",
//  negative toward "text". The engine (index.js) sums them into a score and
//  buckets it into three confidence bands. Rules are intentionally STRUCTURAL
//  (shape of the string), not dictionary-based — structure is what reliably
//  separates `SpannerSetAttach` / `foo/bar` / `(itemx)` from real sentences,
//  while staying deterministic, offline and explainable. Ambiguous lone words
//  (Open, Fold, Trigger, Button) deliberately land in the middle "uncertain"
//  band rather than being hidden — only IL context (a later phase) can resolve
//  those, so we keep them visible.
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_EXT = /\.(png|jpe?g|tga|dds|bmp|gif|wav|ogg|mp3|aif|unity3d|assetbundle|bundle|prefab|fbx|obj|blend|mat|shader|compute|json|xml|csv|cfg|ini|asset|anim|controller|ttf|otf|lua|cs)$/i;
const GUID = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i;
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const VERSION = /^v?\d+(\.\d+){1,3}[a-z0-9]*$/i;

// Unity / .NET / PlayMaker terms that strongly hint at code when they appear as
// a whole space/punctuation-delimited token. Disputable UI words (open, close,
// fold, trigger, button, …) are deliberately excluded.
const TECH_KEYWORDS = new Set([
  'fsm', 'playmaker', 'mesh', 'collider', 'rigidbody', 'prefab', 'shader',
  'canvas', 'rect', 'transform', 'gameobject', 'raycast', 'coroutine',
  'texture', 'material', 'renderer', 'animator', 'spawner', 'hashmap',
  'enum', 'awake', 'onenable', 'ondisable', 'fixedupdate', 'lateupdate',
  'vector3', 'quaternion', 'monobehaviour', 'scriptableobject',
]);

const hasWhitespace = (t) => /\s/.test(t);

function isPathLike(t) {
  if (hasWhitespace(t)) return false;
  if (!/[/\\]/.test(t)) return false;
  return t.split(/[/\\]/).filter(Boolean).length >= 2;
}

function isParenTag(t) {
  // "(Clone)", "(itemx)" or any lowercase ≥3-char token in trailing parens.
  return /\((?:clone|itemx)\)/i.test(t) || /\([a-z][a-z0-9]{2,}\)\s*$/.test(t);
}

function isFormatOrCode(t) {
  const s = t.trim();
  if (!s) return false;
  if (GUID.test(s) || HEX_COLOR.test(s) || VERSION.test(s)) return true;
  // No letters at all (any script) → numbers / punctuation / format specifiers
  // like "{0}", "100%", "-->", "1,2,3".
  return !/\p{L}/u.test(s);
}

function allCapsWeight(t) {
  if (hasWhitespace(t)) return 0;
  if (!/^[A-Z][A-Z0-9]+$/.test(t)) return 0;
  // Longer all-caps tokens (ITEMS, ENABLED) read as identifiers; very short
  // ones (OK, ON, YES) are usually UI and stay merely "suspicious".
  return t.length >= 5 ? 3 : 1;
}

function keywordWeight(t) {
  const tokens = t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let hits = 0;
  for (const tok of tokens) if (TECH_KEYWORDS.has(tok)) hits += 1;
  return Math.min(hits, 2);
}

// A "word-like" token: letters (+ apostrophe/hyphen) with optional trailing
// sentence punctuation. Excludes anything with digits, parens, slashes, etc.
const WORD_LIKE = /^[\p{L}][\p{L}'’-]*[.,!?:;]?$/u;

function isMultiword(t) {
  const tokens = t.trim().split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.filter((tok) => WORD_LIKE.test(tok)).length >= 2;
}

function isSentenceShaped(t) {
  return /[.!?,:;]\s/.test(t) || /\p{Ll}[.!?]$/u.test(t);
}

// id == reason code (mapped to a localized label in the UI).
const RULES = [
  { id: 'format',    score: (t) => (isFormatOrCode(t) ? 6 : 0) },
  { id: 'path',      score: (t) => (isPathLike(t) ? 5 : 0) },
  { id: 'assetExt',  score: (t) => (!hasWhitespace(t) && ASSET_EXT.test(t) ? 5 : 0) },
  { id: 'parenTag',  score: (t) => (isParenTag(t) ? 4 : 0) },
  { id: 'snake',     score: (t) => (/[A-Za-z0-9]_[A-Za-z0-9]/.test(t) ? 3 : 0) },
  { id: 'camel',     score: (t) => (/[a-z][A-Z]/.test(t) || /[A-Z]{2,}[a-z]/.test(t) ? 3 : 0) },
  { id: 'allCaps',   score: (t) => allCapsWeight(t) },
  { id: 'alnumMix',  score: (t) => (!hasWhitespace(t) && /[A-Za-z]\d|\d[A-Za-z]/.test(t) ? 1 : 0) },
  { id: 'keyword',   score: (t) => keywordWeight(t) },
  { id: 'noSpace',   score: (t) => (!hasWhitespace(t) && t.length > 1 ? 1 : 0) },
  { id: 'multiword', score: (t) => (isMultiword(t) ? -4 : 0) },
  { id: 'sentence',  score: (t) => (isSentenceShaped(t) ? -2 : 0) },
  { id: 'hasSpace',  score: (t) => (hasWhitespace(t) ? -1 : 0) },
];

// Reason codes that explain a TECHNICAL verdict (shown in the UI tooltip).
const TECHNICAL_REASONS = new Set([
  'format', 'path', 'assetExt', 'parenTag', 'snake', 'camel', 'allCaps',
  'alnumMix', 'keyword', 'noSpace', 'cluster', 'ctxTechnical',
]);

const THRESHOLDS = { technical: 3, text: -2 };

module.exports = { RULES, THRESHOLDS, TECHNICAL_REASONS };
