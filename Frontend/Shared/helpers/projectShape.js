import { hasText } from '@Shared/helpers/strings';

// ─── Project shape helpers ──────────────────────────────────────────────────
// Pure transformations between the various shapes a project's strings flow
// through (backend dictionary → editor rows → save payload). No React, no IPC.

/**
 * @typedef {Object} StringRow
 * @property {string} id
 * @property {string} original
 */

/**
 * Convert the backend's `{ id: original }` dictionary into the array form
 * the editor uses for virtualization and ordering.
 * @param {Record<string, string> | null | undefined} strings
 * @returns {StringRow[]}
 */
export function mapStringDictionaryToRows(strings) {
  return Object.entries(strings || {}).map(([id, original]) => ({ id, original }));
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
  return (rows || [])
    .filter((row) => !hasText(translations?.[row.id]))
    .map((row) => ({ id: row.id, text: row.original }));
}

function resolveTranslatedModName(modName) {
  return hasText(modName) ? `${modName}_RU` : '';
}

/**
 * Display name to render in the title bar / project tile. Prefers the user-
 * authored translation name, falls back to `<ModName>_RU`, then to a static
 * placeholder so the UI never shows blank.
 * @param {{ translations?: any, modInfo?: any }} input
 * @returns {string}
 */
export function resolveProjectDisplayName({ translations, modInfo }) {
  if (hasText(translations?.name)) return translations.name;
  return resolveTranslatedModName(modInfo?.name) || 'BG3 Mod Translation';
}

/**
 * Name persisted with the project record on disk. Differs from the display
 * name in that it preserves intentionally-empty values (so the user can clear
 * the field) and uses 'Unknown Mod' as a last-resort placeholder.
 * @param {{ translations?: any, modInfo?: any }} input
 * @returns {string}
 */
export function resolvePersistedProjectName({ translations, modInfo }) {
  if (translations?.name !== undefined) return translations.name;
  return resolveTranslatedModName(modInfo?.name) || 'Unknown Mod';
}
