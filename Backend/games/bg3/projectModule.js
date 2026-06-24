// ─────────────────────────────────────────────────────────────────────────────
//  games/bg3/projectModule.js
//  BG3-specific half of the project pipeline. The generic project handlers
//  delegate game-specific work here via the module contract:
//    • loadProject            — extract archive (if needed) + unpack PAK → strings
//    • deleteProjectArtifacts — remove the on-disk workspace folders + cache
//  Everything PAK / workspace-folder shaped lives here, not in the generic
//  projectManager.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const bg3Manager = require('./manager/bg3Manager');
const { sanitizeWorkspaceTag } = require('./manager/bg3_utils/workspaceUtils');
const { extractPakFromZip, extractPakFromRar } = require('./handlers/archiveUtils');

const WORKSPACE_REMOVE_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 3,
  retryDelay: 250,
};
const WORKSPACE_REMOVE_RETRY_DELAYS = [0, 400, 1200];

function buildWorkspaceDeletionTargets(workspaceRoot, projectId, projectRecord) {
  if (!fs.existsSync(workspaceRoot)) {
    return [];
  }

  const sessionPrefix = `project_${sanitizeWorkspaceTag(projectId, 'project')}__session`;

  // workspaceDirName is the EXACT folder name created on disk — use it directly.
  // Do NOT re-run it through sanitizeWorkspaceTag: re-sanitizing can convert
  // spaces/apostrophes to underscores, causing a mismatch with the actual folder.
  const storedDirName = projectRecord?.workspaceDirName || '';

  // Legacy fallback for old projects without workspaceDirName: infer from pakPath
  // and sanitize (direct .pak files have a clean name; archives would've stored
  // workspaceDirName, so missing → file was opened with an old version).
  const legacySanitizedName = !storedDirName && projectRecord?.pakPath
    ? sanitizeWorkspaceTag(path.parse(projectRecord.pakPath).name, '')
    : '';

  const targets = new Set();

  for (const entry of fs.readdirSync(workspaceRoot)) {
    const matchesSessionWorkspace =
      entry === sessionPrefix || entry.startsWith(`${sessionPrefix}__work_`);

    const matchesStoredDir = storedDirName &&
      (entry === storedDirName || entry.startsWith(`${storedDirName}__work_`));

    const matchesLegacyDir = legacySanitizedName &&
      (entry === legacySanitizedName || entry.startsWith(`${legacySanitizedName}__work_`));

    if (matchesSessionWorkspace || matchesStoredDir || matchesLegacyDir) {
      targets.add(path.join(workspaceRoot, entry));
    }
  }

  return [...targets];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeWorkspaceTargets(targetPaths) {
  let remainingTargets = targetPaths.filter((targetPath) => fs.existsSync(targetPath));

  for (const delayMs of WORKSPACE_REMOVE_RETRY_DELAYS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    const nextRemainingTargets = [];

    for (const targetPath of remainingTargets) {
      try {
        await fs.promises.rm(targetPath, WORKSPACE_REMOVE_OPTIONS);
      } catch {
        // Retry loop below will check if the OS released the handle a bit later.
      }

      if (fs.existsSync(targetPath)) {
        nextRemainingTargets.push(targetPath);
      }
    }

    remainingTargets = nextRemainingTargets;
    if (remainingTargets.length === 0) {
      return;
    }
  }

  throw new Error(
    `Не удалось полностью удалить папки проекта: ${remainingTargets
      .map((targetPath) => path.basename(targetPath))
      .join(', ')}`
  );
}

// ── Contract: new project from a dropped/selected file ──────────────────────
async function ingest(filePath, ext) {
  let tempDir = null;
  try {
    let pakToUnpack = filePath;
    if (ext === '.zip') {
      ({ pakPath: pakToUnpack, tempDir } = extractPakFromZip(filePath));
    } else if (ext === '.rar') {
      ({ pakPath: pakToUnpack, tempDir } = await extractPakFromRar(filePath));
    } else if (ext !== '.pak') {
      throw new Error(`Формат "${ext}" не поддерживается. Используйте .pak, .zip или .rar.`);
    }

    const result = await bg3Manager.unpackAndLoadStrings(pakToUnpack);
    return { ...result, originalPakPath: filePath };
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── Contract: load a saved project for editing ──────────────────────────────
async function loadProject(projectRecord) {
  if (!projectRecord) {
    return { success: false, error: 'Проект не найден или повреждён.' };
  }

  if (!fs.existsSync(projectRecord.pakPath)) {
    return {
      success: false,
      error: `Оригинальный файл больше не существует по пути: ${projectRecord.pakPath}`,
    };
  }

  const ext = path.extname(projectRecord.pakPath).toLowerCase();
  const isArchive = ext === '.zip' || ext === '.rar';

  let tempDir = null;
  try {
    let extractedPakPath = null;
    if (isArchive) {
      if (ext === '.zip') {
        ({ pakPath: extractedPakPath, tempDir } = extractPakFromZip(projectRecord.pakPath));
      } else {
        ({ pakPath: extractedPakPath, tempDir } = await extractPakFromRar(projectRecord.pakPath));
      }
    }

    const actualPakPath = extractedPakPath || projectRecord.pakPath;
    if (!fs.existsSync(actualPakPath)) {
      return { success: false, error: `Файл не существует по пути: ${actualPakPath}` };
    }

    // Reuse the exact stored folder name (handles legacy names with spaces).
    const storedDir = projectRecord.workspaceDirName;
    const result = await bg3Manager.unpackAndLoadStrings(actualPakPath, {
      ...(storedDir ? { exactWorkspaceDir: storedDir } : { workspaceTag: path.parse(actualPakPath).name }),
    });

    return {
      success: true,
      project: {
        id: projectRecord.id,
        name: projectRecord.name,
        targetLanguage: projectRecord.targetLanguage,
      },
      data: {
        ...result,
        originalPakPath: projectRecord.pakPath,
        translations: projectRecord.translations,
        targetLanguage: projectRecord.targetLanguage,
      },
    };
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── Contract: remove on-disk artifacts when a project is deleted ────────────
async function deleteProjectArtifacts(projectRecord) {
  const workspaceRoot = bg3Manager.workspaceDir;
  if (!workspaceRoot) return;

  bg3Manager.clearCachedDataForWorkspace(workspaceRoot);

  const targets = buildWorkspaceDeletionTargets(workspaceRoot, projectRecord?.id, projectRecord);
  await removeWorkspaceTargets(targets);
}

module.exports = { ingest, loadProject, deleteProjectArtifacts };
