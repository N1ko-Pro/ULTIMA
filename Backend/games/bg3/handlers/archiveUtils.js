const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');

/** Recursively finds the first .pak file inside an extracted directory. */
function findPakInDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findPakInDir(fullPath);
      if (found) return found;
    } else if (entry.name.toLowerCase().endsWith('.pak')) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Validates that the ZIP contains a .pak entry (no extraction),
 * then extracts everything to tempDir and returns the pak path.
 */
function extractPakFromZip(zipFilePath) {
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (err) {
    throw new Error(`Не удалось открыть ZIP-архив: ${err.message}`);
  }
  const entries = zip.getEntries();

  const hasPak = entries.some((e) => e.entryName.toLowerCase().endsWith('.pak'));
  if (!hasPak) {
    throw new Error(
      'PAK-файл не найден внутри ZIP-архива. Убедитесь, что архив содержит файл мода BG3 с расширением .pak.'
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg3-zip-'));
  zip.extractAllTo(tempDir, true);
  const pakPath = findPakInDir(tempDir);
  if (!pakPath) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('Не удалось извлечь PAK-файл из ZIP-архива.');
  }
  return { pakPath, tempDir };
}

/**
 * Checks RAR for a .pak entry WITHOUT extracting first, then extracts only that file.
 * Throws immediately if no .pak is found — no tempDir is ever created in that case.
 */
async function extractPakFromRar(rarFilePath) {
  let createExtractorFromFile;
  try {
    ({ createExtractorFromFile } = await import('node-unrar-js'));
  } catch {
    throw new Error(
      'Библиотека для распаковки RAR не найдена. Пожалуйста, конвертируйте архив в ZIP или используйте .pak напрямую.'
    );
  }

  const lister = await createExtractorFromFile({ filepath: rarFilePath, targetPath: os.tmpdir() });
  const list = lister.getFileList();
  const fileHeaders = [...list.fileHeaders];
  const pakHeader = fileHeaders.find(
    (h) => !h.flags?.directory && h.name.toLowerCase().endsWith('.pak')
  );

  if (!pakHeader) {
    throw new Error(
      'PAK-файл не найден внутри RAR-архива. Убедитесь, что архив содержит файл мода BG3 с расширением .pak.'
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg3-rar-'));
  const extractor = await createExtractorFromFile({ filepath: rarFilePath, targetPath: tempDir });
  const extracted = extractor.extract({ files: [pakHeader.name] });
  for (const _file of extracted.files) { /* noop — consume generator */ }

  const pakPath = findPakInDir(tempDir);
  if (!pakPath) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('Не удалось извлечь PAK-файл из RAR-архива.');
  }
  return { pakPath, tempDir };
}

module.exports = { findPakInDir, extractPakFromZip, extractPakFromRar };
