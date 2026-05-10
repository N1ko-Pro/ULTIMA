import { invoke } from './client';

// ─── Larian XML import / export ─────────────────────────────────────────────
// Two-way bridge between the project translations and the Larian XML format
// used by the in-game localisation files.

/**
 * Export current translations to a Larian XML the user picks a path for.
 * @param {Record<string, string>} translations
 * @param {object} modInfo
 * @returns {Promise<{ success: boolean, filePath?: string, error?: string } | null>}
 */
export const exportFile = (translations, modInfo) =>
  invoke('exportXml', translations, modInfo);

/**
 * Open a Larian XML and return parsed entries plus suggested merges.
 * @returns {Promise<{ success: boolean, items?: Array<{ id: string, value: string }>, error?: string } | null>}
 */
export const importFile = () => invoke('importXml');
