import { invoke } from './client';

// ─── Authentication ─────────────────────────────────────────────────────────
// Discord-based login + Supabase session glue. All methods return the IPC
// envelope `{ success, state?, error? }` unchanged so the AuthService context
// can merge the new `state` slice into its React state.

/**
 * @typedef {Object} AuthEnvelope
 * @property {boolean} success
 * @property {{ isLoggedIn: boolean, tier: string, user?: any, isInGuild?: boolean, isConfigured?: boolean, serverLocalName?: string }} [state]
 * @property {string} [error]
 */

/** @returns {Promise<AuthEnvelope | null>} */
export const getState = () => invoke('authGetState');

/** Trigger the Discord OAuth flow. */
export const login = () => invoke('authLogin');

/** End the local session (server-side stays valid until token expiry). */
export const logout = () => invoke('authLogout');

/** Re-fetch tier info from the server. */
export const refresh = () => invoke('authRefresh');

/**
 * Persist the user's local "author" name on the server (for syncing
 * across devices). Fire-and-forget by convention.
 * @param {string} name
 */
export const saveLocalName = (name) => invoke('authSaveLocalName', name);
