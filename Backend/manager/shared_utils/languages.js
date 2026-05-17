// ─────────────────────────────────────────────────────────────────────────────
//  languages.js — single source of truth for translation target languages.
//
//  Each entry maps a translator code (Google Translate ISO-style) to the
//  Larian Localization folder name baked into BG3 .pak files. The mod's
//  `Localization/<folder>/<modname>.loca` path is resolved through `getFolder`
//  so the same .loca filename (which BG3 matches by name, not by directory)
//  ships into the language-specific subdirectory the player has selected.
//
//  Suffix is an ASCII tag (`_RU`, `_DE`, …) appended to the mod's display
//  name and to the resulting .pak/.zip file when no explicit override comes
//  from the renderer. Description is used as a default English-friendly
//  meta.lsx description; Russian keeps its native phrasing for backwards
//  compatibility with already-published translation mods.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LANG_CODE = 'ru';

const LANGUAGES = [
  { code: 'ru', folder: 'Russian',    suffix: '_RU' },
  { code: 'en', folder: 'English',    suffix: '_EN' },
  { code: 'de', folder: 'German',     suffix: '_DE' },
  { code: 'fr', folder: 'French',     suffix: '_FR' },
  { code: 'es', folder: 'Spanish',    suffix: '_ES' },
  { code: 'it', folder: 'Italian',    suffix: '_IT' },
  { code: 'pl', folder: 'Polish',     suffix: '_PL' },
  { code: 'pt', folder: 'Portuguese', suffix: '_PT' },
  { code: 'ja', folder: 'Japanese',   suffix: '_JA' },
  { code: 'ko', folder: 'Korean',     suffix: '_KO' },
  { code: 'zh', folder: 'Chinese',    suffix: '_ZH' },
  { code: 'uk', folder: 'Ukrainian',  suffix: '_UK' },
  { code: 'tr', folder: 'Turkish',    suffix: '_TR' },
];

const BY_CODE = LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang;
  return acc;
}, {});

function normalizeCode(code) {
  if (typeof code !== 'string') return DEFAULT_LANG_CODE;
  const lower = code.trim().toLowerCase();
  return BY_CODE[lower] ? lower : DEFAULT_LANG_CODE;
}

function getLanguage(code) {
  return BY_CODE[normalizeCode(code)];
}

function getFolder(code) {
  return getLanguage(code).folder;
}

function getSuffix(code) {
  return getLanguage(code).suffix;
}

function isSupported(code) {
  return typeof code === 'string' && Boolean(BY_CODE[code.trim().toLowerCase()]);
}

module.exports = {
  LANGUAGES,
  DEFAULT_LANG_CODE,
  normalizeCode,
  getLanguage,
  getFolder,
  getSuffix,
  isSupported,
};
