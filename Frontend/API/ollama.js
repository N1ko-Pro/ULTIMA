import { invoke, subscribe } from './client';

// ─── Ollama (local AI runtime) ──────────────────────────────────────────────
// The app's "Local AI" mode shells out to a bundled / user-installed Ollama
// process. This module covers the full lifecycle: install → run → pull/delete
// models → reset context → uninstall.
//
// All the long-running ops (`install`, `pullModel`) stream progress through
// dedicated subscriptions and can be cancelled.

/**
 * @returns {Promise<{ success: boolean, status?: { running: boolean, installed: boolean, models: string[] }, error?: string } | null>}
 */
export const getStatus = () => invoke('ollamaGetStatus');

/**
 * Download a model from the Ollama registry.
 * @param {string} modelName
 */
export const pullModel = (modelName) => invoke('ollamaPullModel', modelName);

/**
 * Cancel an in-flight `pullModel` call.
 * @param {string} modelName
 */
export const cancelPullModel = (modelName) => invoke('ollamaCancelPullModel', modelName);

/**
 * Remove a model from local storage.
 * @param {string} modelName
 */
export const deleteModel = (modelName) => invoke('ollamaDeleteModel', modelName);

/** Download + install the Ollama runtime itself. */
export const install = () => invoke('ollamaInstall');

/** Cancel an in-flight `install` call. */
export const cancelInstall = () => invoke('ollamaCancelInstall');

/** Spawn the local Ollama server process. */
export const startServer = () => invoke('ollamaStartServer');

/** Stop the spawned server (does nothing if it's externally managed). */
export const stopServer = () => invoke('ollamaStopServer');

/** Start the server iff it isn't already running. */
export const ensureRunning = () => invoke('ollamaEnsureRunning');

/**
 * Wipe the conversation context for a model (useful when prompt drift creeps
 * in mid-batch).
 * @param {string} modelName
 */
export const resetContext = (modelName) => invoke('ollamaResetContext', modelName);

/** Uninstall the Ollama runtime entirely. */
export const uninstall = () => invoke('ollamaUninstall');

// ─── Subscriptions ──────────────────────────────────────────────────────────

/**
 * @param {(progress: { model: string, percent: number, status?: string }) => void} handler
 * @returns {() => void}
 */
export const onPullProgress = (handler) => subscribe('onOllamaPullProgress', handler);

/**
 * @param {(progress: { phase: string, percent: number, message?: string }) => void} handler
 * @returns {() => void}
 */
export const onInstallProgress = (handler) => subscribe('onOllamaInstallProgress', handler);

/**
 * @param {(status: { running: boolean, installed: boolean, models: string[] }) => void} handler
 * @returns {() => void}
 */
export const onStatusChanged = (handler) => subscribe('onOllamaStatusChanged', handler);
