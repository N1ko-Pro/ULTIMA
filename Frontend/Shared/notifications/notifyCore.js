import { notifyStore } from './notifyStore';
import { TOAST } from '@Config/timings.constants';

// ─── Notification public API ────────────────────────────────────────────────
// One-line call site for any code that needs to surface user-visible feedback:
//
//   notify.success('Saved', 'Your project has been saved');
//   notify.error('Failed', err.message);
//
// Implementation detail: the live toast is delivered via a window event so
// `<NotifyToastStack />` (mounted at app root) can pick it up without any
// prop wiring. `error` and `warning` are also recorded into the persistent
// history store for the bell-icon dropdown.

const HISTORY_TYPES = new Set(['warning', 'error']);
const NOTIFICATION_EVENT = 'app-notification';

const dispatch = (type, title, message, duration, options = {}) => {
  const detail = {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    duration,
    ...options,
  };

  if (HISTORY_TYPES.has(type)) {
    notifyStore.recordHistory(detail);
  }

  window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail }));
};

const D = TOAST.DEFAULT_DURATION_MS;

/**
 * Public notification API. The `duration` arg is the time the toast remains
 * on screen, in ms. Pass `0` (or omit on a custom call) for a sticky toast
 * that only closes on user click.
 */
export const notify = {
  success: (title, message, duration = D.success) => dispatch('success', title, message, duration),
  info:    (title, message, duration = D.info)    => dispatch('info',    title, message, duration),
  warning: (title, message, duration = D.warning) => dispatch('warning', title, message, duration),
  error:   (title, message, duration = D.error)   => dispatch('error',   title, message, duration),
  warningAction: (title, message, action, duration = D.warning) => dispatch('warning', title, message, duration, { action }),
  dismissByTitle: (title) => notifyStore.removeByTitle(title),
};

/** Event name used internally by the toast stack to subscribe. */
export const NOTIFY_EVENT = NOTIFICATION_EVENT;
