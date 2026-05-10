import { invoke, subscribe } from './client';

// ─── .NET runtime (LSLib dependency) ────────────────────────────────────────
// LSLib (used to unpack/repack `.pak`) needs the .NET 8 runtime present on
// the host. `check` returns whether the user already has it, `install`
// downloads and runs the official MS installer with progress streaming.

/**
 * @returns {Promise<{ success: boolean, installed?: boolean, version?: string, error?: string } | null>}
 */
export const check = () => invoke('dotnetCheck');

/**
 * Run the .NET installer. Use `onInstallProgress` to follow the download/
 * install phases.
 */
export const install = () => invoke('dotnetInstall');

/**
 * @param {(progress: { phase: string, percent: number, message?: string }) => void} handler
 * @returns {() => void}
 */
export const onInstallProgress = (handler) => subscribe('onDotnetInstallProgress', handler);
