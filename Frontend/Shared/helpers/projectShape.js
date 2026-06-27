import { hasText } from '@Shared/helpers/strings';
import { getLanguageSuffix } from '@Config/languages.constants';

// ─── Project shape helpers ──────────────────────────────────────────────────
// Pure transformations between the various shapes a project's strings flow
// through (backend dictionary → editor rows → save payload). No React, no IPC.

/**
 * @typedef {Object} StringRow
 * @property {string} id
 * @property {string} original
 * @property {'text'|'technical'|'uncertain'} [category]  auto classification
 * @property {string[]} [techReasons]  reason codes behind the classification
 */

/**
 * Convert the backend's `{ id: original }` dictionary into the array form
 * the editor uses for virtualization and ordering. An optional `meta` map
 * (`{ id: { category, reasons } }`, produced by the string classifier for
 * games like MSC) annotates each row so the editor can filter technical noise.
 * @param {Record<string, string> | null | undefined} strings
 * @param {Record<string, { category?: string, reasons?: string[] }> | null | undefined} [meta]
 * @returns {StringRow[]}
 */
export function mapStringDictionaryToRows(strings, meta) {
  return Object.entries(strings || {}).map(([id, original]) => {
    const info = meta?.[id];
    return {
      id,
      original,
      category: info?.category || 'text',
      techReasons: info?.reasons || [],
      foreign: info?.foreign || false,
    };
  });
}

/**
 * Build a `{ id: '' }` object for every row — used to seed an empty
 * translation map so React's controlled inputs always have a defined value.
 * @param {StringRow[] | null | undefined} rows
 * @returns {Record<string, string>}
 */
export function createEmptyTranslations(rows) {
  return (rows || []).reduce((accumulator, row) => {
    accumulator[row.id] = '';
    return accumulator;
  }, {});
}

/**
 * Convert a list of items into a `{ id: item[valueKey] }` dictionary.
 * Items missing an `id` are skipped silently.
 * @param {Array<Record<string, any>> | null | undefined} items
 * @param {string} valueKey
 * @returns {Record<string, string>}
 */
export function toIdValueDictionary(items, valueKey) {
  return (items || []).reduce((accumulator, item) => {
    if (!item?.id) return accumulator;
    accumulator[item.id] = item[valueKey] ?? '';
    return accumulator;
  }, {});
}

/**
 * Filter rows that still need a translation, returning a `[{ id, text }]`
 * shape ready to feed into the auto-translate pipeline.
 * @param {StringRow[] | null | undefined} rows
 * @param {Record<string, string> | null | undefined} translations
 * @returns {Array<{ id: string, text: string }>}
 */
export function collectPendingTranslationRows(rows, translations) {
  const overrides = translations?._techOverride || {};
  // Foreign-language rows are skipped only when "hide non-English" is effective
  // (explicit toggle, or the smart default for mods that are mostly English).
  const explicit = translations?._view?.hideForeign;
  const hideForeign = typeof explicit === 'boolean' ? explicit : shouldHideForeignByDefault(rows);
  return (rows || [])
    // Skip strings classified (or marked) as technical — they aren't meant for
    // translation, so they shouldn't consume auto-translate budget.
    .filter((row) => (overrides[row.id] || row.category || 'text') !== 'technical')
    .filter((row) => !(hideForeign && row.foreign && overrides[row.id] !== 'text'))
    .filter((row) => !hasText(translations?.[row.id]))
    .map((row) => ({ id: row.id, text: row.original }));
}

/**
 * Smart default for the "hide non-English" toggle. When foreign-language rows
 * DOMINATE the mod (>50%), the mod's ORIGINAL language is non-English — hiding
 * them would leave nothing to translate, so default the toggle OFF. Otherwise
 * the foreign rows are duplicate twins the author bundled → default ON.
 * @param {Array<{ foreign?: boolean }> | null | undefined} rows
 * @returns {boolean}
 */
export function shouldHideForeignByDefault(rows) {
  const list = rows || [];
  if (list.length === 0) return true;
  const foreign = list.reduce((n, r) => n + (r.foreign ? 1 : 0), 0);
  return foreign / list.length < 0.5;
}

function resolveTranslatedModName(modName, targetLanguage) {
  if (!hasText(modName)) return '';
  // Suffix from the project's selected target language ('_RU', '_DE', '_JA', …).
  // Falls back to '_RU' (the historical default) so legacy callers that don't
  // pass a language still produce stable display names.
  return `${modName}${getLanguageSuffix(targetLanguage)}`;
}

/**
 * Display name to render in the title bar / project tile. Prefers the user-
 * authored translation name, falls back to `<ModName><suffix>`, then to a
 * static placeholder so the UI never shows blank.
 * @param {{ translations?: any, modInfo?: any, targetLanguage?: string }} input
 * @returns {string}
 */
export function resolveProjectDisplayName({ translations, modInfo, targetLanguage }) {
  if (hasText(translations?.name)) return translations.name;
  return resolveTranslatedModName(modInfo?.name, targetLanguage) || 'BG3 Mod Translation';
}

/**
 * Name persisted with the project record on disk. Differs from the display
 * name in that it preserves intentionally-empty values (so the user can clear
 * the field) and uses 'Unknown Mod' as a last-resort placeholder.
 * @param {{ translations?: any, modInfo?: any, targetLanguage?: string }} input
 * @returns {string}
 */
export function resolvePersistedProjectName({ translations, modInfo, targetLanguage }) {
  if (translations?.name !== undefined) return translations.name;
  return resolveTranslatedModName(modInfo?.name, targetLanguage) || 'Unknown Mod';
}
