import { invoke } from './client';

// ─── User settings ──────────────────────────────────────────────────────────
// App preferences (translation method, language, Ollama model, proxy pool…).
// All mutators return `{ success, settings }` so callers can replace local
// state with the canonical server-side value (instead of merging optimistically
// and risking drift).

/** @returns {Promise<{ success: boolean, settings?: any } | null>} */
export const get = () => invoke('getTranslationSettings');

/**
 * Patch one or more keys; only the keys present in `patch` are updated.
 * @param {object} patch
 * @returns {Promise<{ success: boolean, settings?: any } | null>}
 */
export const set = (patch) => invoke('setTranslationSettings', patch);

/** Convenience: set just the active translation method (smart/local/ollama). */
export const setMethod = (method) => invoke('setTranslationMethod', method);

/** Replace the entire proxy pool with a new list. */
export const setProxyPool = (pool) => invoke('setTranslationProxyPool', pool);

/** Patch the proxy config object (rotation strategy, timeouts, …). */
export const setProxyConfig = (config) => invoke('setTranslationProxyConfig', config);

/** Empty the proxy pool. */
export const clearProxyPool = () => invoke('clearTranslationProxyPool');
