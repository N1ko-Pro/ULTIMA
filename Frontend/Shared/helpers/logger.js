// ─── Logger ─────────────────────────────────────────────────────────────────
// Thin wrapper around `console` that:
//   • prefixes every line with `[bg3-ultima]` so logs are filterable
//   • gives us a single place to silence/route logs in the future
//
// Replaces ad-hoc `console.warn` / `console.error` calls scattered across the
// services. Use `log.warn` / `log.error` instead.

const TAG = '[bg3-ultima]';

export const log = {
  /** Diagnostic warning — recoverable issues (e.g. failed background refresh). */
  warn:  (...args) => console.warn(TAG, ...args),
  /** Real error — something the user might notice or that needs investigation. */
  error: (...args) => console.error(TAG, ...args),
  /** Informational trace — kept terse, used during development. */
  info:  (...args) => console.info(TAG, ...args),
};
