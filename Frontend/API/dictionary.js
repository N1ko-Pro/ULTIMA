import { invoke } from './client';

// ─── Glossary / dictionary ──────────────────────────────────────────────────
// CRUD over the user-editable translation glossary. Backend wraps every
// response in `{ success, data?, error? }`; we pass that through unchanged so
// the panel can pattern-match on `success`.

/**
 * @typedef {Object} DictEntry
 * @property {string} id
 * @property {string} source
 * @property {string} target
 * @property {string} [tag]
 */

/** @returns {Promise<{ success: boolean, data?: DictEntry[] } | null>} */
export const getAll = () => invoke('dictionaryGetAll');

/**
 * @returns {Promise<{ success: boolean, data?: DictEntry } | null>}
 */
export const add = (source, target, tag) =>
  invoke('dictionaryAdd', source, target, tag);

/** @returns {Promise<{ success: boolean, data?: DictEntry } | null>} */
export const update = (id, source, target, tag) =>
  invoke('dictionaryUpdate', id, source, target, tag);

/** @returns {Promise<{ success: boolean } | null>} */
export const remove = (id) => invoke('dictionaryDelete', id);

/** Open a save dialog and write the current glossary to disk. */
export const exportFile = () => invoke('dictionaryExport');

/** Open a picker and merge the chosen glossary file. */
export const importFile = () => invoke('dictionaryImport');

/** Reset to the bundled default glossary. Returns the new entry list. */
export const reset = () => invoke('dictionaryReset');
