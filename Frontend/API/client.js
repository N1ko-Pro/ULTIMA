// ─── Electron IPC client ─────────────────────────────────────────────────────
// Low-level transport for everything in @API/*. Exposes three primitives:
//
//   invoke(method, ...args)       Async ipcRenderer.invoke wrapper. Returns
//                                 `null` when the bridge or method is missing
//                                 (running outside Electron, preload out of
//                                 date, etc.) so callers can fall back without
//                                 a try/catch dance.
//
//   send(method, ...args)         Fire-and-forget ipcRenderer.send. Used for
//                                 window controls — these have no return.
//
//   subscribe(method, handler)    For preload methods that return their own
//                                 unsubscribe fn (push streams: install
//                                 progress, updater events, etc.). Returns a
//                                 noop unsubscribe when missing so callers'
//                                 cleanup code never crashes.
//
// Errors are NOT swallowed inside `invoke` — propagate them so each domain
// wrapper / consumer can decide on its own UX (toast, retry, ignore).
//
// All preload methods are listed in `Backend/preload.js`. This module is the
// ONE place in the renderer that touches `window.electronAPI` directly; if
// you find yourself reaching for it elsewhere, add a domain function instead.

/** True when the IPC bridge is wired up (preload loaded, running in Electron). */
export function isAvailable() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI);
}

/**
 * Look up a method on `window.electronAPI` and call it with `args`. Returns
 * `null` if the bridge or method is unavailable; otherwise propagates the
 * value (and any thrown error) from the underlying ipcRenderer.invoke call.
 *
 * @template T
 * @param {string} method  Name of the preload method.
 * @param {...any} args    Forwarded to the method as-is.
 * @returns {Promise<T | null>}
 */
export async function invoke(method, ...args) {
  const fn = window?.electronAPI?.[method];
  if (typeof fn !== 'function') return null;
  return fn(...args);
}

/**
 * Fire-and-forget call. Used for `ipcRenderer.send` style preload methods
 * (window minimize/maximize/close) that don't return anything.
 *
 * @param {string} method
 * @param {...any} args
 */
export function send(method, ...args) {
  const fn = window?.electronAPI?.[method];
  if (typeof fn === 'function') fn(...args);
}

/**
 * Subscribe to a streaming event. The preload helpers (`onOllamaPullProgress`
 * etc.) themselves return an unsubscribe fn; we just pass `handler` through
 * and surface that. Returns a noop when the method is missing so callers can
 * always call the result in their cleanup without guards.
 *
 * @param {string} method
 * @param {(data: any) => void} handler
 * @returns {() => void}
 */
export function subscribe(method, handler) {
  const subscriber = window?.electronAPI?.[method];
  if (typeof subscriber !== 'function') return () => {};
  const unsubscribe = subscriber(handler);
  return typeof unsubscribe === 'function' ? unsubscribe : () => {};
}
