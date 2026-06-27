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
    // `_view` is transient UI state (active filter + scroll position); it must
    // not mark the project dirty. Everything else (including object meta maps
    // like _bookmarks / _hidden / _techOverride) counts toward the fingerprint.
    .filter(([key]) => key !== '_view')
    .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value ?? '')])
    .filter(([, value]) => value !== '' && value !== '{}' && value !== 'null')
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(entries);
}
