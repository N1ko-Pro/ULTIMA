// ─── String helpers ─────────────────────────────────────────────────────────
// Pure, dependency-free string utilities used across the app. Anything that
// touches the DOM or React belongs elsewhere.

/**
 * Returns true when the value is a non-empty trimmed string. Used everywhere
 * a "this field has been filled in" check is needed (validation, dirty
 * markers, conditional rendering).
 * @param {unknown} value
 * @returns {boolean}
 */
export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Escape a string for safe use inside a `RegExp` literal. Mirrors the
 * MDN-recommended pattern.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert a small subset of HTML (release-notes style: `<li>`, `<br>`,
 * `<p>`, etc.) into plain text with newline separators. Used by the updater
 * UI to render `info.releaseNotes` inside a `<pre>`.
 *
 * @param {string | null | undefined} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
