import { invoke } from './client';

// ─── File pickers & path resolution ─────────────────────────────────────────
// File dialogs and the Electron 32+ `webUtils.getPathForFile` shim. These are
// thin enough that they don't really need their own domain, but live here so
// nothing else has to know about the `electronAPI?.getPathForFile?.()` quirk.

/**
 * Open a generic file picker (any supported extension).
 * @returns {Promise<{ success: boolean, filePath?: string, ext?: string } | null>}
 */
export const selectFile = () => invoke('selectFile');

/**
 * Open a `.pak`-only picker.
 * @returns {Promise<{ success: boolean, filePath?: string, ext?: string } | null>}
 */
export const selectPakFile = () => invoke('selectPakFile');

/**
 * Unpack a `.pak` and return its strings + modInfo.
 * @param {string} filePath
 */
export const unpackPakFile = (filePath) => invoke('unpackPakFile', filePath);

/**
 * Unpack a `.zip` or `.rar` archive that contains a `.pak` inside.
 * @param {string} filePath
 * @param {'.zip' | '.rar'} ext
 */
export const unpackArchiveFile = (filePath, ext) => invoke('unpackArchiveFile', filePath, ext);

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
