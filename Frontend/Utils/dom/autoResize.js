// ─── Textarea auto-resize ───────────────────────────────────────────────────
// Single-purpose helper: makes a textarea grow with its content. Resets
// `height` first so the next `scrollHeight` measurement reflects only the
// natural content height (otherwise a previously-larger value sticks).

/**
 * Resize a textarea element so it tightly fits its content.
 * Safe to call with `null`/`undefined` — does nothing in that case.
 * @param {HTMLTextAreaElement | null | undefined} el
 */
export function autoResize(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
