import { send, invoke, subscribe } from './client';

// ─── Window controls ────────────────────────────────────────────────────────
// Frameless-window chrome — minimize / maximize / close, plus the OS-close
// hook so the renderer can intercept the native X button (e.g. unsaved-
// changes confirm). `openExternal` belongs here too: opening URLs in the
// default browser is a window-host concern, not data.

/** Minimise the host window. */
export const minimize = () => send('minimize');

/** Toggle maximised / restored state. */
export const maximize = () => send('maximize');

/** Programmatically close the host window. Routes through `os-window-close`. */
export const close = () => send('close');

/**
 * Open a URL in the user's default browser.
 * @param {string} url
 */
export const openExternal = (url) => invoke('openExternal', url);

/** Reveal the unpacked mod folder in the OS file manager. */
export const openModFolder = () => invoke('openModFolder');

/**
 * Subscribe to the OS-level close request (X button / Alt+F4). Returns an
 * unsubscribe fn — call it from your effect cleanup.
 * @param {() => void} handler
 * @returns {() => void}
 */
export const onOsClose = (handler) => subscribe('onOsClose', handler);
