// ─────────────────────────────────────────────────────────────────────────────
//  translationData.js — neutral, game-agnostic helpers for the editor's
//  translation dictionary.
//
//  The renderer stores user translations as a flat `id -> text` map, but mixes
//  in a handful of NON-string meta keys (bookmarks, per-row technical overrides,
//  hidden flags) plus mod-info fields. None of these are mod strings, so they
//  must be stripped before a game module injects/packs the translations.
//
//  This lives in shared_utils (not under any game folder) on purpose: it only
//  knows about the renderer's own meta keys, never about a specific game.
// ─────────────────────────────────────────────────────────────────────────────

// Keys that are NOT translatable mod strings and must never reach a game's
// pack/inject step. `_bookmarks` / `_techOverride` / `_hidden` are renderer
// editor state; `name` / `author` / `uuid` / `description` are mod-info fields.
const META_KEYS = Object.freeze([
  '_bookmarks',
  '_techOverride',
  '_hidden',
  '_view',
  '_custom',
  'name',
  'author',
  'uuid',
  'description',
]);

const META_KEY_SET = new Set(META_KEYS);

/**
 * Return a shallow copy of `updatedData` with all meta keys removed. Pure:
 * never mutates the input. Non-object input yields an empty object.
 *
 * @param {Record<string, unknown>} updatedData
 * @returns {Record<string, unknown>} translations without meta keys
 */
function stripMetaKeys(updatedData) {
  if (!updatedData || typeof updatedData !== 'object') return {};
  const out = {};
  for (const key of Object.keys(updatedData)) {
    if (META_KEY_SET.has(key)) continue;
    out[key] = updatedData[key];
  }
  return out;
}

module.exports = { META_KEYS, stripMetaKeys };
