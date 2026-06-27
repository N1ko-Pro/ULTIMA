import { invoke } from './client';

// ─── Game integration ────────────────────────────────────────────────────────
// Lets ULTIMA install the runtime patcher once into the user's game and write
// patch translations straight into it (instead of bundling the patcher in every
// artifact). Backed by optional contract methods on a game module; games that
// don't support it report `supported: false`.

/**
 * @typedef {{
 *   gamePath: string|null,
 *   detected: boolean,
 *   valid: boolean,
 *   patcherInstalled: boolean,
 *   patcherName?: string,
 *   patcherVersion?: string,
 *   patcherInstalledVersion?: string|null,
 *   patcherUpToDate?: boolean,
 * }} IntegrationStatus
 */

/** @returns {Promise<{ success: boolean, supported: boolean, status?: IntegrationStatus }>} */
export const getStatus = (gameId) => invoke('gameGetIntegration', gameId);

/** Auto-detect the game path (Steam) and persist it. */
export const detectPath = (gameId) => invoke('gameDetectPath', gameId);

/** Persist a known game path. */
export const setPath = (gameId, dir) => invoke('gameSetPath', gameId, dir);

/** Forget the remembered game path. */
export const clearPath = (gameId) => invoke('gameClearPath', gameId);

/** Open a folder picker, validate + persist the chosen game path. */
export const pickPath = (gameId) => invoke('gamePickPath', gameId);

/** Install (downloading if needed) the patcher engine into the game's Mods. */
export const installPatcher = (gameId) => invoke('gameInstallPatcher', gameId);

/** Remove the patcher engine from the game's Mods. */
export const uninstallPatcher = (gameId) => invoke('gameUninstallPatcher', gameId);
