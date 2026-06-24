import { invoke, subscribe } from './client';

// ─── Per-game dependencies ──────────────────────────────────────────────────
// Some games need extra tooling that isn't bundled in the installer (e.g. the
// My Summer Car localization tool). These are checked on entering a game and
// downloaded on demand.

/**
 * @param {string} gameId
 * @returns {Promise<{ success: boolean, ok: boolean, missing: Array<{id,name,version,sizeMb}> } | null>}
 */
export const check = (gameId) => invoke('depsCheck', gameId);

/**
 * @param {string} gameId
 * @returns {Promise<{ success: boolean, error?: string } | null>}
 */
export const install = (gameId) => invoke('depsInstall', gameId);

/**
 * Subscribe to install progress (0-100).
 * @param {(percent: number) => void} handler
 * @returns {() => void} unsubscribe
 */
export const onInstallProgress = (handler) => subscribe('onDepsInstallProgress', handler);
