import { invoke } from './client';

// ─── File pickers & path resolution ─────────────────────────────────────────
// File dialogs and the Electron 32+ `webUtils.getPathForFile` shim. These are
// thin enough that they don't really need their own domain, but live here so
// nothing else has to know about the `electronAPI?.getPathForFile?.()` quirk.

/**
 * Open a game-aware mod file picker.
 * @param {string[]} extensions Accepted extensions (e.g. ['pak','zip','rar'] or ['dll','zip','rar'])
 * @returns {Promise<{ success: boolean, filePath?: string, ext?: string } | null>}
 */
export const selectModFile = (extensions) => invoke('selectModFile', extensions);

/**
 * Ingest a mod file for the given game → returns its strings + modInfo.
 * @param {string} filePath
 * @param {string} ext  lower-cased extension incl. dot
 * @param {string} gameId
 */
export const ingestMod = (filePath, ext, gameId) => invoke('ingestMod', { filePath, ext, gameId });

/**
 * Native FS path for a `File` instance. Electron 32+ blanks `file.path` under
 * contextIsolation; the preload exposes `webUtils.getPathForFile` as the
 * supported replacement. Falls back to `file.path` on older runtimes and to
 * an empty string outside Electron.
 * @param {File} file
 * @returns {string}
 */
export function getPathForFile(file) {
  return window?.electronAPI?.getPathForFile?.(file) ?? file?.path ?? '';
}
