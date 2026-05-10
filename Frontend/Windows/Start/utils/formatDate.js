// ─── formatDate ─────────────────────────────────────────────────────────────
// Compact "DD Mon YYYY HH:MM" timestamp in Russian locale. Used by project
// cards to render the last-modified timestamp.

/**
 * @param {number | Date} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}
