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

// Unity rich-text markup (<color=…>, <b>, <i>, <size=…>, <material=…>, <quad>).
// These only ever wrap player-facing text to style it — their presence is a
// definitive "this is content, not a technical token" signal.
const RICH_TEXT = /<\/?(?:b|i|color|size|material|quad)\b[^>]*>/i;

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

const { isContentException } = require('./allowlist');

// Calendar words (weekdays + months, EN/PT/ES) are real content, never code —
// they must not be swept up by the lone-word heuristic. Foreign ones are still
// flagged separately by the language detector (the "non-English" toggle).
const CALENDAR = new Set([
  // English
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  // Portuguese
  'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta', 'sábado', 'sabado',
  'domingo', 'janeiro', 'fevereiro', 'março', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  // Spanish
  'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'enero',
  'febrero', 'marzo', 'mayo', 'junio', 'julio', 'septiembre', 'octubre',
  'noviembre', 'diciembre',
]);

function isPathLike(t) {
  if (hasWhitespace(t)) return false;
  if (!/[/\\]/.test(t)) return false;
  const segments = t.split(/[/\\]/).filter(Boolean).length;
  // Multi-segment paths (`a/b/c`) OR a single token carrying a leading/trailing
  // slash (`ITEMS/`, `/Spawn`, `Assets\`). Both are structural identifiers /
  // resource prefixes, never player-facing prose.
  return segments >= 2 || /[/\\]$/.test(t) || /^[/\\]/.test(t);
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

// A "natural word" token: a real language word, not an identifier. Letters with
// optional apostrophe/hyphen and trailing sentence punctuation, where ONLY the
// first letter may be uppercase. This excludes camelCase / PascalMixed / ALLCAPS
// identifiers (DeliveryJobs, djDiff, GFX) from the word count, so an identifier
// next to a real word (e.g. "DeliveryJobs Canvas") isn't mistaken for prose.
const WORD_LIKE = /^[\p{L}][\p{Ll}'’-]*[.,!?:;]?$/u;

function isMultiword(t) {
  const tokens = t.trim().split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.filter((tok) => WORD_LIKE.test(tok)).length >= 2;
}

// Natural-language prose: a phrase where EVERY token is a real word (≥2 of
// them). This is the strongest "shown to the player" signal — a string with no
// identifier-shaped token is human-readable text ("Job Details", "Delivery
// status", "Show available delivery jobs"). Weighted to override even a
// technical IL-context (+8). A single identifier token (e.g. "DeliveryJobs
// Canvas") breaks it, so mixed identifier+word strings stay technical.
function isProse(t) {
  const tokens = t.trim().split(/\s+/);
  if (tokens.length < 2) return false;
  return tokens.every((tok) => WORD_LIKE.test(tok));
}

// A lone token (no whitespace) that carries letters. Single words are far more
// likely to be UI keys / identifiers (Start, Button, Fuse, ID, year, Player…)
// than prose — the same word inside a sentence stays text (multiword wins).
// Calendar words (weekdays / months) are excluded — they are real content.
function isLoneWord(t) {
  const s = t.trim();
  if (s.length < 2 || hasWhitespace(s) || !/\p{L}/u.test(s)) return false;
  const word = s.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (CALENDAR.has(word)) return false;
  if (isContentException(s)) return false; // proper nouns (e.g. Peräjärvi)
  return true;
}

// A bare single letter (R, L, m, p). Never prose — always an axis / channel /
// index identifier. (Even the English words "I"/"a" appear as lone strings only
// as keys, and the verdict is reversible via the technical toggle.)
function isSingleLetter(t) {
  const s = t.trim();
  return s.length === 1 && /\p{L}/u.test(s);
}

// "Indexed name" — a short phrase that ends in a number (separate OR glued) and
// is built only from bare identifier tokens: `State 13`, `Thunder 1`,
// `table_pub 6`, `light bulb10`, `light bulb8`. These are numbered object / asset
// names, never prose. Guarded to ≤3 tokens with no punctuation so real
// sentences ("Press E to enter") never match.
function isWordNumber(t) {
  const s = t.trim();
  if (!/\d$/.test(s)) return false;          // must end in a digit
  if (isSentenceShaped(s)) return false;     // not a real sentence
  const tokens = s.split(/\s+/);
  if (tokens.length > 3) return false;       // short phrase only
  // every token: letters / digits / underscore only (no punctuation, %, $, …).
  return tokens.every((tok) => /^[\p{L}\p{N}_]+$/u.test(tok));
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
  // Any underscore anywhere (snake_case, MVD_, HTAP_, _foo, `table_pub 6`).
  // Underscores never occur in natural prose, so the space-free guard is
  // dropped — an underscore is a strong identifier signal even beside a number.
  { id: 'snake',     score: (t) => (/_/.test(t) ? 4 : 0) },
  { id: 'camel',     score: (t) => (/[a-z][A-Z]/.test(t) || /[A-Z]{2,}[a-z]/.test(t) ? 3 : 0) },
  { id: 'allCaps',   score: (t) => allCapsWeight(t) },
  { id: 'alnumMix',  score: (t) => (!hasWhitespace(t) && /[A-Za-z]\d|\d[A-Za-z]/.test(t) ? 1 : 0) },
  { id: 'keyword',   score: (t) => keywordWeight(t) },
  { id: 'singleChar', score: (t) => (isSingleLetter(t) ? 4 : 0) },
  { id: 'wordNumber', score: (t) => (isWordNumber(t) ? 4 : 0) },
  { id: 'loneWord',  score: (t) => (isLoneWord(t) ? 2 : 0) },
  { id: 'noSpace',   score: (t) => (!hasWhitespace(t) && t.length > 1 ? 1 : 0) },
  { id: 'multiword', score: (t) => (isMultiword(t) ? -4 : 0) },
  { id: 'prose',     score: (t) => (isProse(t) ? -8 : 0) },
  // Rich-text markup is a hard "content" override — beats every technical signal
  // (paths from "</color>", lone-word, etc.) so styled UI strings stay visible.
  { id: 'richText',  score: (t) => (RICH_TEXT.test(t) ? -50 : 0) },
  { id: 'sentence',  score: (t) => (isSentenceShaped(t) ? -2 : 0) },
  { id: 'hasSpace',  score: (t) => (hasWhitespace(t) ? -1 : 0) },
];

// Reason codes that explain a TECHNICAL verdict (shown in the UI tooltip).
const TECHNICAL_REASONS = new Set([
  'format', 'path', 'assetExt', 'parenTag', 'snake', 'camel', 'allCaps',
  'alnumMix', 'keyword', 'singleChar', 'wordNumber', 'loneWord', 'noSpace',
  'cluster', 'ctxTechnical',
]);

const THRESHOLDS = { technical: 3, text: -2 };

module.exports = { RULES, THRESHOLDS, TECHNICAL_REASONS };
