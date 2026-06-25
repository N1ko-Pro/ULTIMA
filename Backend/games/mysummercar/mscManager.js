// ─────────────────────────────────────────────────────────────────────────────
//  mscManager.js — My Summer Car mod ingestion.
//  Resolves a mod .dll (directly or from a .zip/.rar) and extracts its
//  hardcoded string literals via the bundled MscLocTool (dnlib), shaped into the
//  `{ strings, modInfo }` contract the editor consumes for any game.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const mscToolCli = require('./dll_utils/mscToolCli');
const { extractDllFromZip, extractDllFromRar } = require('./dll_utils/archiveDll');
const { readAssemblyDescription } = require('./dll_utils/assemblyInfo');
const { classifyStrings } = require('../../manager/stringClassifier');

function buildModInfo(sourcePath, dllPath) {
  return {
    name: path.basename(sourcePath, path.extname(sourcePath)),
    author: '',
    uuid: '',
    // MSC mods carry no .pak metadata; the description is read from the DLL's
    // embedded .NET assembly info (AssemblyDescription / Title / Product).
    description: dllPath ? readAssemblyDescription(dllPath) : '',
  };
}

// Resolve a source file to the actual .dll path (extracting archives first).
async function resolveDll(filePath, ext) {
  if (ext === '.dll') return { dllPath: filePath, tempDir: null };
  if (ext === '.zip') return extractDllFromZip(filePath);
  if (ext === '.rar') return extractDllFromRar(filePath);
  throw new Error(`Формат "${ext}" не поддерживается. Используйте .dll, .zip или .rar.`);
}

/**
 * @returns {Promise<{ strings: Record<string,string>, stringMeta: object, modInfo: object, workspaceDirName: null }>}
 */
async function loadStrings(filePath, ext) {
  let tempDir = null;
  try {
    const resolved = await resolveDll(filePath, ext);
    tempDir = resolved.tempDir;

    if (!fs.existsSync(resolved.dllPath)) {
      throw new Error(`Файл не существует по пути: ${resolved.dllPath}`);
    }

    const literals = await mscToolCli.extract(resolved.dllPath);
    const items = [];
    const strings = {};
    for (const { id, text, context } of literals) {
      if (text && text.trim()) {
        strings[id] = text;
        // `context` (IL-usage signals) is present only with newer MscLocTool
        // builds; the classifier treats it as optional (Phase 2).
        items.push({ id, text, context });
      }
    }

    // Classify each literal as player-facing text vs technical token so the
    // editor can hide the noise by default (see manager/stringClassifier).
    const stringMeta = classifyStrings(items);

    return {
      strings,
      stringMeta,
      modInfo: buildModInfo(filePath, resolved.dllPath),
      workspaceDirName: null,
    };
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

module.exports = { loadStrings };
