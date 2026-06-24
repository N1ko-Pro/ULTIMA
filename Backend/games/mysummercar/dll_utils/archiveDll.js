// ─────────────────────────────────────────────────────────────────────────────
//  archiveDll.js — pull a .dll mod out of a .zip / .rar archive.
//  Mirror of the BG3 archive helper, but targets .dll (My Summer Car mods).
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');

function findDllInDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findDllInDir(fullPath);
      if (found) return found;
    } else if (entry.name.toLowerCase().endsWith('.dll')) {
      return fullPath;
    }
  }
  return null;
}

function extractDllFromZip(zipFilePath) {
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (err) {
    throw new Error(`Не удалось открыть ZIP-архив: ${err.message}`);
  }

  const hasDll = zip.getEntries().some((e) => e.entryName.toLowerCase().endsWith('.dll'));
  if (!hasDll) {
    throw new Error('DLL-файл не найден внутри ZIP-архива. Убедитесь, что архив содержит мод My Summer Car (.dll).');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msc-zip-'));
  zip.extractAllTo(tempDir, true);
  const dllPath = findDllInDir(tempDir);
  if (!dllPath) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('Не удалось извлечь DLL-файл из ZIP-архива.');
  }
  return { dllPath, tempDir };
}

async function extractDllFromRar(rarFilePath) {
  let createExtractorFromFile;
  try {
    ({ createExtractorFromFile } = await import('node-unrar-js'));
  } catch {
    throw new Error('Библиотека для распаковки RAR не найдена. Конвертируйте архив в ZIP или используйте .dll напрямую.');
  }

  const lister = await createExtractorFromFile({ filepath: rarFilePath, targetPath: os.tmpdir() });
  const fileHeaders = [...lister.getFileList().fileHeaders];
  const dllHeader = fileHeaders.find((h) => !h.flags?.directory && h.name.toLowerCase().endsWith('.dll'));
  if (!dllHeader) {
    throw new Error('DLL-файл не найден внутри RAR-архива. Убедитесь, что архив содержит мод My Summer Car (.dll).');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msc-rar-'));
  const extractor = await createExtractorFromFile({ filepath: rarFilePath, targetPath: tempDir });
  const extracted = extractor.extract({ files: [dllHeader.name] });
  for (const _file of extracted.files) { /* consume generator */ }

  const dllPath = findDllInDir(tempDir);
  if (!dllPath) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('Не удалось извлечь DLL-файл из RAR-архива.');
  }
  return { dllPath, tempDir };
}

module.exports = { findDllInDir, extractDllFromZip, extractDllFromRar };
