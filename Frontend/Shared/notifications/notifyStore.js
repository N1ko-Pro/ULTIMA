import { NOTIFICATION_HISTORY } from '@Config/timings.constants';

// ─── Notification history store ─────────────────────────────────────────────
// In-memory persistent log of notifications shown via `notify.warning` /
// `notify.error`. Powers the bell-icon dropdown (`notifyCenter`).
//
// API kept intentionally tiny:
//   recordHistory(notification) — append (or refresh existing dup)
//   markAllRead()                — flip every unread to read
//   remove(id) / clear()         — explicit removal
//   subscribe(fn)                — pub-sub for `useSyncExternalStore`
//
// Filtering by type happens upstream in `notifyCore.js`. The store always
// records whatever is passed in.

let history = [];
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn());

const findDuplicateIndex = (notification) =>
  history.findIndex(
    (item) => item.title === notification.title && item.message === notification.message,
  );

export const notifyStore = {
  /** Snapshot. Returns the same reference until something changes. */
  getAll: () => history,

  /**
   * Append a notification to the history. If an entry with the same
   * `title + message` already exists, refresh its timestamp instead of
   * stacking duplicates.
   * @param {object} notification
   */
  recordHistory(notification) {
    const existingIndex = findDuplicateIndex(notification);

    if (existingIndex !== -1) {
      const existing = history[existingIndex];
      history = [
        { ...existing, timestamp: Date.now(), read: false },
        ...history.slice(0, existingIndex),
        ...history.slice(existingIndex + 1),
      ];
    } else {
      history = [
        { ...notification, timestamp: Date.now(), read: false },
        ...history,
      ].slice(0, NOTIFICATION_HISTORY.MAX_ITEMS);
    }
    emit();
  },

  markAllRead() {
    if (history.every((n) => n.read)) return;
    history = history.map((n) => (n.read ? n : { ...n, read: true }));
    emit();
  },

  markRead(id) {
    const idx = history.findIndex((n) => n.id === id);
    if (idx === -1 || history[idx].read) return;
    history = history.map((n, i) => (i === idx ? { ...n, read: true } : n));
    emit();
  },

  remove(id) {
    const next = history.filter((n) => n.id !== id);
    if (next.length === history.length) return;
    history = next;
    emit();
  },

  removeByTitle(title) {
    const next = history.filter((n) => n.title !== title);
    if (next.length === history.length) return;
    history = next;
    emit();
  },

  clear() {
    if (history.length === 0) return;
    history = [];
    emit();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
