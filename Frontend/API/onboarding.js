import { invoke } from './client';

// ─── Onboarding state ───────────────────────────────────────────────────────
// Persistent boolean flags driving "first-time user" tutorials and one-shot
// dialogs (EULA, .NET install, editor walkthrough, etc.). Lives on disk so
// the same user doesn't see the same intro twice across launches.

/**
 * @returns {Promise<{ success: boolean, onboarding?: Record<string, boolean | string> } | null>}
 */
export const get = () => invoke('onboardingGet');

/**
 * Patch one or more flags. Server merges into the current state and returns
 * the resulting full object so the renderer can mirror it.
 * @param {Record<string, boolean | string>} patch
 */
export const update = (patch) => invoke('onboardingUpdate', patch);
