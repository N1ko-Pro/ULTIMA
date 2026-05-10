// ─── Time formatting helpers ────────────────────────────────────────────────
// Compact "X ago" / "ETA" formatters used by the notification center and
// translation status bar. Russian-only labels for now — i18n will arrive
// alongside the locale dictionaries when needed.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Render a "X ago" label for a given timestamp. Resolution caps at days; the
 * caller can decide to render an absolute date for older entries.
 * @param {number} timestampMs Unix-ms timestamp.
 * @returns {string}
 */
export function timeAgo(timestampMs) {
  const diffMs = Math.max(0, Date.now() - timestampMs);
  if (diffMs < MINUTE) return 'только что';
  if (diffMs < HOUR)   return `${Math.floor(diffMs / MINUTE)} мин. назад`;
  if (diffMs < DAY)    return `${Math.floor(diffMs / HOUR)} ч. назад`;
  return `${Math.floor(diffMs / DAY)} д. назад`;
}

/**
 * Convert a remaining-seconds value into a localized ETA string. Uses the
 * locale dictionary so the same helper serves Russian and English UIs.
 * Returns '' for invalid or non-positive input.
 * @param {number} seconds
 * @param {{ editor: { etaSec: Function, etaMin: Function, etaMinSec: Function } }} t
 * @returns {string}
 */
export function formatEta(seconds, t) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return t.editor.etaSec(Math.ceil(seconds));

  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return secs > 0 ? t.editor.etaMinSec(mins, secs) : t.editor.etaMin(mins);
}
