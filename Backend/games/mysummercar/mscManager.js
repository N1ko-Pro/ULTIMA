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

function buildModInfo(sourcePath) {
  return {
    name: path.basename(sourcePath, path.extname(sourcePath)),
    author: '',
    uuid: '',
    description: '',
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
 * @returns {Promise<{ strings: Record<string,string>, modInfo: object, workspaceDirName: null }>}
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
    const strings = {};
    for (const { id, text } of literals) {
      if (text && text.trim()) strings[id] = text;
    }

    return { strings, modInfo: buildModInfo(filePath), workspaceDirName: null };
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

module.exports = { loadStrings };
