import { invoke, subscribe } from './client';

// ─── Auto-translate pipeline ────────────────────────────────────────────────
// Drives the bulk translation backend (Smart / Local / Ollama). The streaming
// per-item progress feeds the status bar and per-row indicators.

/**
 * Run a batch of strings through the configured translation backend.
 *
 * @param {Array<{ id: string, text: string }>} dataToTranslate
 * @param {string} targetLang
 * @param {object} [options]
 * @returns {Promise<{ success: boolean, translations?: Record<string, string>, error?: string } | null>}
 */
export const translate = (dataToTranslate, targetLang, options = {}) =>
  invoke('translateStrings', dataToTranslate, targetLang, options);

/** Cancel any in-flight `translate(...)` call. */
export const abort = () => invoke('abortTranslateStrings');

/**
 * Subscribe to per-item progress updates while a translation batch runs.
 * Returns an unsubscribe fn.
 * @param {(progress: { id: string, value: string, index: number, total: number }) => void} handler
 */
export const onItemProgress = (handler) => subscribe('onTranslationItemProgress', handler);
