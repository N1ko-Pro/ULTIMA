import { invoke, subscribe } from './client';

// ─── Mod packing ────────────────────────────────────────────────────────────
// Build the current project into a deliverable for the active game. The result
// path comes back in `result.filePath` so the UI can surface a "Saved to …"
// toast. The handler routes by `gameId` to the matching game module's `pack`.

/**
 * @param {{
 *   gameId: string,
 *   translations: Record<string, string>,
 *   modName?: string,
 *   targetLanguage?: string,
 *   mode?: 'patch' | 'replace',
 *   target?: 'game' | 'zip',
 *   originalPakPath?: string,
 * }} payload
 * @returns {Promise<{ success: boolean, filePath?: string, mode?: string, target?: string, installedTo?: string, error?: string } | null>}
 */
export const repack = ({ gameId, translations, modName, targetLanguage, mode, target, originalPakPath }) =>
  invoke('repackMod', { gameId, updatedData: translations, modName, targetLanguage, mode, target, originalPakPath });

/**
 * Subscribe to pack progress (0-100). The payload is `{ gameId, percent }`.
 * @param {(data: { gameId: string, percent: number }) => void} handler
 * @returns {() => void} unsubscribe
 */
export const onProgress = (handler) => subscribe('onRepackProgress', handler);
