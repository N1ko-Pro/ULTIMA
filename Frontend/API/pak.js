import { invoke } from './client';

// ─── Mod packing (.pak) ─────────────────────────────────────────────────────
// Repack the current workspace into a single `.pak` deliverable. The `.pak`
// path comes back in `result.filePath` so the UI can surface a "Saved to …"
// toast.

/**
 * @param {Record<string, string>} translations
 * @param {string} [modName]
 * @returns {Promise<{ success: boolean, filePath?: string, error?: string } | null>}
 */
export const repack = (translations, modName) => invoke('repackMod', translations, modName);
