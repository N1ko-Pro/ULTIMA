// ─── Translation fingerprints ───────────────────────────────────────────────
// Stable, sorted serialisation of a translation map used to detect "dirty"
// state without comparing the whole object. Empty values are excluded so a
// flicker through `''` doesn't mark the project unsaved.

/**
 * Build a deterministic string fingerprint of a translations dictionary.
 * Two dictionaries with the same non-empty entries always produce the same
 * fingerprint regardless of insertion order.
 *
 * @param {Record<string, unknown> | null | undefined} translations
 * @returns {string}
 */
export function buildTranslationsFingerprint(translations) {
  const entries = Object.entries(translations || {})
    .map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')])
    .filter(([, value]) => value !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(entries);
}
