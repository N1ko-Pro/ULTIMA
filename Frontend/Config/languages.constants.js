// ─── Translation target languages ──────────────────────────────────────────
// Single source of truth for the renderer. Mirrors
// `Backend/manager/shared_utils/languages.js` but adds UI labels.
//
// `flag` references one of the named exports from `@UI/EULA/FlagIcons` so
// dropdowns/badges can render a small inline SVG without pulling extra
// dependencies. `nativeLabel` is shown in the dropdown row; the human-
// readable Russian/English label comes from the locale catalogue under
// `t.languages[code]`.

export const DEFAULT_TARGET_LANGUAGE = 'ru';

export const TARGET_LANGUAGES = [
  { code: 'ru', folder: 'Russian',    suffix: '_RU', nativeLabel: 'Русский',    flag: 'FlagRU' },
  { code: 'en', folder: 'English',    suffix: '_EN', nativeLabel: 'English',    flag: 'FlagUS' },
  { code: 'de', folder: 'German',     suffix: '_DE', nativeLabel: 'Deutsch',    flag: 'FlagDE' },
  { code: 'fr', folder: 'French',     suffix: '_FR', nativeLabel: 'Français',   flag: 'FlagFR' },
  { code: 'es', folder: 'Spanish',    suffix: '_ES', nativeLabel: 'Español',    flag: 'FlagES' },
  { code: 'it', folder: 'Italian',    suffix: '_IT', nativeLabel: 'Italiano',   flag: 'FlagIT' },
  { code: 'pl', folder: 'Polish',     suffix: '_PL', nativeLabel: 'Polski',     flag: 'FlagPL' },
  { code: 'pt', folder: 'Portuguese', suffix: '_PT', nativeLabel: 'Português',  flag: 'FlagBR' },
  { code: 'ja', folder: 'Japanese',   suffix: '_JA', nativeLabel: '日本語',     flag: 'FlagJP' },
  { code: 'ko', folder: 'Korean',     suffix: '_KO', nativeLabel: '한국어',     flag: 'FlagKR' },
  { code: 'zh', folder: 'Chinese',    suffix: '_ZH', nativeLabel: '简体中文',   flag: 'FlagCN' },
  { code: 'uk', folder: 'Ukrainian',  suffix: '_UK', nativeLabel: 'Українська', flag: 'FlagUA' },
  { code: 'tr', folder: 'Turkish',    suffix: '_TR', nativeLabel: 'Türkçe',     flag: 'FlagTR' },
];

const BY_CODE = TARGET_LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang;
  return acc;
}, {});

export function normalizeLanguageCode(code) {
  if (typeof code !== 'string') return DEFAULT_TARGET_LANGUAGE;
  const lower = code.trim().toLowerCase();
  return BY_CODE[lower] ? lower : DEFAULT_TARGET_LANGUAGE;
}

export function getLanguage(code) {
  return BY_CODE[normalizeLanguageCode(code)];
}

export function getLanguageSuffix(code) {
  return getLanguage(code).suffix;
}

export function getLanguageFolder(code) {
  return getLanguage(code).folder;
}

export function getLanguageNativeLabel(code) {
  return getLanguage(code).nativeLabel;
}
