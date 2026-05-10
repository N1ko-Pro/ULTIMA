import { invoke, subscribe } from './client';

// ─── App auto-updater ───────────────────────────────────────────────────────
// Wraps `electron-updater`. The main process owns the state machine
// (idle → checking → available → download-progress → downloaded → installing);
// the renderer just observes via `onEvent` and triggers transitions.

/**
 * @returns {Promise<{ success: boolean, state?: any, currentVersion?: string } | null>}
 */
export const getState = () => invoke('updaterGetState');

/**
 * Probe the update server. Pass `{ silent: true }` for background checks
 * that should not surface a "no updates" toast.
 * @param {{ silent?: boolean }} [options]
 */
export const check = (options = {}) => invoke('updaterCheck', options);

/** Start downloading the available update. */
export const download = () => invoke('updaterDownload');

/** Run the silent installer (does not quit the app yet). */
export const install = () => invoke('updaterInstall');

/** Quit so NSIS can swap binaries and relaunch with the new version. */
export const finalizeInstall = () => invoke('updaterFinalizeInstall');

/**
 * Subscribe to state-machine transitions.
 * @param {(state: any) => void} handler
 * @returns {() => void}
 */
export const onEvent = (handler) => subscribe('onUpdaterEvent', handler);
