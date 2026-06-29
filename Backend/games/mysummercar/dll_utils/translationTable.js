// ─────────────────────────────────────────────────────────────────────────────
//  translationTable.js — build the My Summer Car translation table from the
//  editor's translation map. MSC-specific shaping (lives entirely in the MSC
//  module): it pairs the user's `id -> text` translations with the ids actually
//  present in the original DLL's extract, drops UI meta keys, and wraps the
//  result in the on-disk table/manifest schema the patcher and the replace
//  step consume.
//
//  Pure module: no I/O, no mutation of inputs. Ids are the `u<hex16>` hashes
//  produced by stringId.makeStringId / MscLocTool MakeId.
// ─────────────────────────────────────────────────────────────────────────────

const { stripMetaKeys } = require('../../../manager/shared_utils/translationData');
const { makeStringId } = require('./stringId');

const SCHEMA_VERSION = 1;

/**
 * @param {Record<string, unknown>} updatedData  Editor translations (id → text),
 *   possibly mixed with UI meta keys (_bookmarks, name, uuid, …).
 * @param {Iterable<string>} originalIds  Ids that exist in the original DLL's
 *   extract — only these are valid table keys.
 * @param {{
 *   targetAssembly?: string,
 *   originalModName?: string,
 *   language?: string,
 *   translator?: string,
 *   appVersion?: string,
 * }} [meta]
 * @param {Map<string,string>|Record<string,string>|null} [sourceTextById]
 *   Optional id → original source text. When provided, the builder also emits
 *   case-variant keys (UPPER / lower) for each translated entry — some mods
 *   display UI text upper/lower-cased at runtime (incl. markup, e.g.
 *   `<COLOR=YELLOW>`), so the live string hashes to a different id than the
 *   extracted literal; the variant keys let the runtime patcher/text-hook match.
 * @returns {{
 *   schema: number,
 *   targetAssembly: string,
 *   originalModName: string,
 *   language: string,
 *   translator: string,
 *   appVersion: string,
 *   entries: Record<string, string>,
 * }}
 */
function buildTranslationTable(updatedData, originalIds, meta = {}, sourceTextById = null) {
  const validIds = originalIds instanceof Set ? originalIds : new Set(originalIds || []);
  const cleaned = stripMetaKeys(updatedData);

  const srcMap = sourceTextById instanceof Map
    ? sourceTextById
    : (sourceTextById ? new Map(Object.entries(sourceTextById)) : null);

  const entries = {};
  const setIfAbsent = (id, value) => {
    if (!Object.prototype.hasOwnProperty.call(entries, id)) entries[id] = value;
  };

  for (const id of Object.keys(cleaned)) {
    // Only ids that exist in the original extract may be injected; this keeps
    // the table valid even if the editor state carries stale/foreign keys.
    if (!validIds.has(id)) continue;
    const value = cleaned[id];
    if (typeof value !== 'string') continue;
    if (value.trim() === '') continue; // empty → leave original string untouched
    entries[id] = value;

    // Case-variant keys (only when source text is known) so a runtime-uppercased
    // (or lowercased) display still resolves to the same translation.
    const src = srcMap && srcMap.get(id);
    if (typeof src === 'string' && src) {
      const upper = src.toUpperCase();
      const lower = src.toLowerCase();
      if (upper !== src) setIfAbsent(makeStringId(upper), value);
      if (lower !== src && lower !== upper) setIfAbsent(makeStringId(lower), value);
    }
  }

  // Custom strings: user-supplied source → translation pairs for UI text that is
  // NOT in the DLL extract (e.g. baked into Unity prefabs / asset bundles). These
  // intentionally bypass the `validIds` filter — they're keyed by the hash of the
  // source the runtime text-hook sees. Case variants are emitted too so the user
  // need not match the exact runtime casing.
  const custom = updatedData && updatedData._custom;
  if (Array.isArray(custom)) {
    for (const item of custom) {
      if (!item || typeof item !== 'object') continue;
      const source = typeof item.source === 'string' ? item.source : '';
      const value = typeof item.translation === 'string' ? item.translation : '';
      if (!source || value.trim() === '') continue;
      setIfAbsent(makeStringId(source), value);
      const upper = source.toUpperCase();
      const lower = source.toLowerCase();
      if (upper !== source) setIfAbsent(makeStringId(upper), value);
      if (lower !== source && lower !== upper) setIfAbsent(makeStringId(lower), value);
    }
  }

  return {
    schema: SCHEMA_VERSION,
    targetAssembly: meta.targetAssembly || '',
    originalModName: meta.originalModName || '',
    language: meta.language || '',
    translator: meta.translator || '',
    appVersion: meta.appVersion || '',
    entries,
  };
}

module.exports = { buildTranslationTable, SCHEMA_VERSION };
