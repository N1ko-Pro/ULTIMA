// ─────────────────────────────────────────────────────────────────────────────
//  packManager.js — My Summer Car packaging (the MSC side of the generic
//  MOD_REPACK contract). Dispatches by output mode:
//    • 'replace' — bake translations into a new .dll via MscLocTool inject,
//                  wrapped in a zip with a metadata sidecar. The user swaps it
//                  for the original file.
//    • 'patch'   — (added later) a patch artifact that sits next to the
//                  original and never overwrites it.
//
//  This module is entirely MSC-owned. It never touches BG3 code, and it does
//  NOT mutate the original mod file: the source .dll is re-resolved read-only
//  from `originalPakPath` (extract temp from ingest is long gone), every write
//  goes to an OS temp dir, and temp is cleaned up on every exit path.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const mscToolCli = require('./dll_utils/mscToolCli');
const patcherTool = require('./dll_utils/patcherTool');
const { extractDllFromZip, extractDllFromRar } = require('./dll_utils/archiveDll');
const { buildTranslationTable } = require('./dll_utils/translationTable');
const { resolveTargetAssembly } = require('./dll_utils/assemblyName');
const gameIntegration = require('./gameIntegration');
const { MSC_PATCHER, TOOL_VERSION } = require('./toolConfig');

// Build a filesystem-safe config id from a target assembly / mod name.
function makeModId(targetAssembly, stem) {
  return (targetAssembly || stem).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'mod';
}

function missingPatcherItem() {
  return {
    id: MSC_PATCHER.id,
    name: MSC_PATCHER.name,
    version: MSC_PATCHER.version,
    sizeMb: MSC_PATCHER.sizeMb,
  };
}

// Sanitize a mod name into a safe file-name stem.
function safeFileStem(name) {
  const cleaned = (name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
  return cleaned || 'MSC_Mod';
}

// Re-resolve the original .dll (read-only) from the path the project stored.
// For a bare .dll → use it directly (no temp). For an archive → extract into a
// temp dir the caller must clean up.
async function resolveSourceDll(originalPakPath) {
  if (!originalPakPath || !fs.existsSync(originalPakPath)) {
    throw new Error(`Оригинальный файл мода не найден: ${originalPakPath || '(путь не задан)'}`);
  }
  const ext = path.extname(originalPakPath).toLowerCase();
  if (ext === '.dll') return { dllPath: originalPakPath, tempDir: null };
  if (ext === '.zip') return extractDllFromZip(originalPakPath);
  if (ext === '.rar') return extractDllFromRar(originalPakPath);
  throw new Error(`Формат "${ext}" не поддерживается для упаковки MSC.`);
}

// ── replace mode ─────────────────────────────────────────────────────────────
// Inject translations into a fresh .dll and wrap it in a zip with info.json.
async function buildReplaceArtifact({ updatedData, modName, targetLanguage, originalPakPath }, ctx) {
  const stem = safeFileStem(modName);
  const filePath = await ctx.promptOutputPath(`${stem}_${(targetLanguage || 'loc')}_ULTIMA.zip`, [
    { name: 'MSC Translated Mod', extensions: ['zip'] },
  ]);
  if (!filePath) return { success: false };

  const source = await resolveSourceDll(originalPakPath);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msc-pack-'));
  try {
    ctx.onProgress?.(10);

    // Validate the translation set against the original extract: only ids that
    // exist in the DLL may be injected (drops meta keys / stale rows).
    const literals = await mscToolCli.extract(source.dllPath);
    const originalIds = new Set(literals.map((l) => l.id));
    const table = buildTranslationTable(updatedData, originalIds, {
      originalModName: modName || '',
      language: targetLanguage || '',
      appVersion: TOOL_VERSION,
    });
    ctx.onProgress?.(40);

    const dllName = path.basename(source.dllPath);
    const outDll = path.join(outDir, dllName);
    const { replaced } = await mscToolCli.inject(source.dllPath, table.entries, outDll);
    ctx.onProgress?.(75);

    // Wrap the translated DLL + a human-readable metadata sidecar into the zip.
    const info = {
      schema: table.schema,
      mode: 'replace',
      originalModName: table.originalModName,
      language: table.language,
      appVersion: table.appVersion,
      replacedStrings: replaced,
      dll: dllName,
      note:
        'Замените оригинальный .dll этого мода файлом из архива. ВНИМАНИЕ: при ' +
        'обновлении оригинального мода файл будет перезаписан — потребуется ' +
        'пересобрать перевод.',
    };

    const zip = new AdmZip();
    zip.addLocalFile(outDll);
    zip.addFile('info.json', Buffer.from(JSON.stringify(info, null, 2), 'utf8'));
    zip.writeZip(filePath);
    ctx.onProgress?.(100);

    return { success: true, filePath, mode: 'replace' };
  } finally {
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }
    if (source.tempDir) {
      try { fs.rmSync(source.tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── patch mode ───────────────────────────────────────────────────────────────
// Produces a translation patch that sits ALONGSIDE the original mod (never
// replaces its .dll). Two targets:
//   • target 'game' — write the translation table straight into the game's
//     Mods/Config/MSCLocAPI folder (patcher must already be installed in-game).
//     No zip, no manual copying — active on next launch.
//   • target 'zip'  — a self-contained archive (patcher + table + readme) for
//     sharing with other users.
async function buildPatchArtifact(input, ctx) {
  const { updatedData, modName, targetLanguage, originalPakPath } = input;
  const toGame = input.target === 'game';

  // ── Preconditions differ by target ──────────────────────────────────────
  if (toGame) {
    if (!gameIntegration.getGamePath()) {
      return { success: false, error: 'GAME_PATH_MISSING' };
    }
    if (!gameIntegration.isPatcherInstalled()) {
      // Patcher engine not yet installed into the game — frontend offers to.
      return { success: false, error: 'PATCHER_MISSING_GAME', missingTool: MSC_PATCHER.id };
    }
  } else if (!patcherTool.isPresent()) {
    // Zip target bundles the patcher from the downloaded tool copy.
    return { success: false, error: 'PATCHER_MISSING', missingTool: MSC_PATCHER.id, missing: [missingPatcherItem()] };
  }

  const stem = safeFileStem(modName);

  // Zip target needs an output path up-front (cancellable before any work).
  let filePath = null;
  if (!toGame) {
    filePath = await ctx.promptOutputPath(`${stem}_${(targetLanguage || 'loc')}_ULTIMA.zip`, [
      { name: 'MSC Translation Patch', extensions: ['zip'] },
    ]);
    if (!filePath) return { success: false };
  }

  const source = await resolveSourceDll(originalPakPath);
  try {
    ctx.onProgress?.(15);

    const targetAssembly = resolveTargetAssembly(source.dllPath);
    const literals = await mscToolCli.extract(source.dllPath);
    const originalIds = new Set(literals.map((l) => l.id));
    const sourceTextById = new Map(literals.map((l) => [l.id, l.text]));
    const table = buildTranslationTable(updatedData, originalIds, {
      targetAssembly,
      originalModName: modName || '',
      language: targetLanguage || '',
      appVersion: TOOL_VERSION,
    }, sourceTextById);
    ctx.onProgress?.(55);

    const modId = makeModId(targetAssembly, stem);

    // ── target: game — write the table directly into the game ──────────────
    if (toGame) {
      const res = gameIntegration.installTable(modId, JSON.stringify(table, null, 2));
      if (!res.ok) return { success: false, error: res.error };
      ctx.onProgress?.(100);
      return {
        success: true,
        mode: 'patch',
        target: 'game',
        installedTo: res.installedTo,
        strings: Object.keys(table.entries).length,
      };
    }

    // ── target: zip — self-contained shareable archive ─────────────────────
    const info = [
      `ULTIMA — патч перевода для My Summer Car`,
      ``,
      `Оригинальный мод : ${table.originalModName || stem}`,
      `Целевая сборка   : ${targetAssembly}`,
      `Язык             : ${table.language || '—'}`,
      `Строк в переводе : ${Object.keys(table.entries).length}`,
      ``,
      `УСТАНОВКА:`,
      `1. Установите оригинальный мод как обычно (его .dll НЕ заменяется).`,
      `2. Скопируйте содержимое папки Mods из этого архива в папку Mods`,
      `   вашего MSCLoader (MSCLocAPI.dll + Config/MSCLocAPI/${modId}.json).`,
      `3. Запустите игру — строки будут переведены в рантайме.`,
      ``,
      `Перевод работает поверх оригинала и сохраняется при его обновлении,`,
      `пока совпадают идентификаторы строк.`,
    ].join('\r\n');

    const zip = new AdmZip();
    zip.addLocalFile(patcherTool.getPath(), 'Mods');
    zip.addFile(
      `Mods/Config/MSCLocAPI/${modId}.json`,
      Buffer.from(JSON.stringify(table, null, 2), 'utf8')
    );
    zip.addFile('info.txt', Buffer.from(info, 'utf8'));
    zip.writeZip(filePath);
    ctx.onProgress?.(100);

    return { success: true, filePath, mode: 'patch', target: 'zip' };
  } finally {
    if (source.tempDir) {
      try { fs.rmSync(source.tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── entry point ──────────────────────────────────────────────────────────────
/**
 * @param {{ updatedData, modName, targetLanguage, mode, originalPakPath }} input
 * @param {{ promptOutputPath, onProgress }} ctx
 * @returns {Promise<{ success: boolean, filePath?: string, mode?: string, error?: string }>}
 */
async function pack(input, ctx) {
  const mode = input?.mode || 'replace';
  try {
    switch (mode) {
      case 'replace':
        return await buildReplaceArtifact(input, ctx);
      case 'patch':
        return await buildPatchArtifact(input, ctx);
      default:
        return { success: false, error: `Неизвестный режим упаковки: "${mode}".` };
    }
  } catch (error) {
    // Never throw out of the contract: temp dirs are cleaned in the builders'
    // finally blocks, the source file is never mutated, so a failed pack just
    // reports a clean error.
    return { success: false, error: error?.message || String(error) };
  }
}

module.exports = { pack, resolveSourceDll, buildReplaceArtifact, buildPatchArtifact };
