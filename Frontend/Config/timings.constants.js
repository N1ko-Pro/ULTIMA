// ─── Timing constants ───────────────────────────────────────────────────────
// One place for every animation duration, polling interval, hold time and
// chunk size used across the app. Replaces magic numbers scattered through
// notification, translation, tutorial and updater code.

/** Live-toast container behaviour. */
export const TOAST = {
  /** Maximum number of toasts visible on screen simultaneously. */
  MAX_VISIBLE: 2,
  /** Duration of the toast exit animation (must match notifyToastItem CSS). */
  EXIT_MS: 400,
  /** Default visible duration per toast type, in ms. */
  DEFAULT_DURATION_MS: {
    success: 3000,
    info: 3000,
    warning: 4000,
    error: 5000,
  },
};

/** Persistent notification history (bell-icon dropdown). */
export const NOTIFICATION_HISTORY = {
  /** Hard cap on stored notifications. Older items fall off the tail. */
  MAX_ITEMS: 50,
};

/** Auto-translation pipeline. */
export const TRANSLATION = {
  /** Number of strings sent to the backend per IPC call. */
  CHUNK_SIZE: 20,
  /** How long the "completed" message stays on screen after success. */
  COMPLETION_HOLD_MS: 1500,
  /** How long the "stopped" message stays on screen after a cancel. */
  CANCEL_HOLD_MS: 1000,
  /** Minimum completed items before ETA text is rendered. */
  ETA_MIN_COMPLETED: 2,
};

/** Tutorial overlays. */
export const TUTORIAL = {
  /** Delay before the editor tutorial pops up after the editor mounts. */
  EDITOR_AUTO_OPEN_DELAY_MS: 800,
};

/** Auth refresh cadence. */
export const AUTH = {
  /** Background refresh of auth state once the user is logged in. */
  REFRESH_INTERVAL_MS: 60 * 1000,
  /** Lightweight IPC state poll — detects backend-side events (offline expiry)
   *  without network calls. Safe to run when offline. */
  STATE_CHECK_INTERVAL_MS: 30 * 1000,
};

/** Editor panel transitions. */
export const EDITOR = {
  /** Tailwind-equivalent of the panel collapse/expand transition. */
  PANEL_TRANSITION_MS: 600,
};
