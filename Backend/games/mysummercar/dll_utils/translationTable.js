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
function buildTranslationTable(updatedData, originalIds, meta = {}) {
  const validIds = originalIds instanceof Set ? originalIds : new Set(originalIds || []);
  const cleaned = stripMetaKeys(updatedData);

  const entries = {};
  for (const id of Object.keys(cleaned)) {
    // Only ids that exist in the original extract may be injected; this keeps
    // the table valid even if the editor state carries stale/foreign keys.
    if (!validIds.has(id)) continue;
    const value = cleaned[id];
    if (typeof value !== 'string') continue;
    if (value.trim() === '') continue; // empty → leave original string untouched
    entries[id] = value;
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
