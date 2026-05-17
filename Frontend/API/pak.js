import { invoke } from './client';

// ─── Mod packing (.pak) ─────────────────────────────────────────────────────
// Repack the current workspace into a single `.pak` deliverable. The `.pak`
// path comes back in `result.filePath` so the UI can surface a "Saved to …"
// toast.

/**
 * @param {Record<string, string>} translations
 * @param {string} [modName]
 * @param {string} [targetLanguage] Translator code (e.g. 'ru', 'en', 'de')
 *   — drives the `Localization/<Language>/...` folder inside the .pak and
 *   the `_LANG` suffix appended to the resulting .zip filename.
 * @returns {Promise<{ success: boolean, filePath?: string, error?: string } | null>}
 */
export const repack = (translations, modName, targetLanguage) =>
  invoke('repackMod', translations, modName, targetLanguage);
