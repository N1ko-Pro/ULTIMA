const fs = require('fs');
const path = require('path');
const {
  normalizeProjectRecord,
  toProjectSummary,
  ensureObject,
} = require('./project_utils/normalizer');
const {
  buildProjectFilePath,
  ensureProjectsRoot,
  ensureProjectsDirectory,
  listProjectJsonFiles,
  readProjectFile,
} = require('./project_utils/fileIO');
const { GAMES, getGameFolder, DEFAULT_GAME_ID, isValidGameId } = require('../games/gameRegistry');

// ─────────────────────────────────────────────────────────────────────────────
//  projectManager — generic, game-agnostic CRUD over project JSON records.
//  Records are physically separated per game inside the workspace:
//  <userData>/workspace/<FOLDER>/<id>.json (FOLDER = BG3, MSC, …), sitting next
//  to that game's working files. The game is taken from each record's `game`
//  field; lookups that only have an id scan every game folder (ids are UUIDs).
//  Older builds stored records under a separate <userData>/projects root (flat
//  or per-game); both are relocated into the workspace by migrateLegacyProjects.
// ─────────────────────────────────────────────────────────────────────────────

// Candidate directories to scan, in priority order: each game folder, then the
// legacy flat root (for records that predate per-game separation).
function collectProjectDirs(userDataPath) {
  const root = ensureProjectsRoot(userDataPath);
  const dirs = [];
  const seen = new Set();
  for (const game of GAMES) {
    const dir = path.join(root, game.folder);
    if (!seen.has(dir)) { seen.add(dir); dirs.push(dir); }
  }
  dirs.push(root); // legacy flat files live directly in the root
  return dirs;
}

// Locate the on-disk file for a project id across game folders + legacy root.
function findProjectFile(userDataPath, projectId) {
  for (const dir of collectProjectDirs(userDataPath)) {
    const filePath = buildProjectFilePath(dir, projectId);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function getProjectById(userDataPath, projectId) {
  if (!projectId || typeof projectId !== 'string') {
    return null;
  }

  const filePath = findProjectFile(userDataPath, projectId);
  if (!filePath) {
    return null;
  }

  const rawProject = readProjectFile(filePath);
  if (!rawProject) {
    return null;
  }

  return normalizeProjectRecord(rawProject, { fallbackId: projectId });
}

function saveProject(userDataPath, projectData) {
  const incomingProject = ensureObject(projectData);

  const existingFilePath =
    typeof incomingProject.id === 'string' && incomingProject.id
      ? findProjectFile(userDataPath, incomingProject.id)
      : null;
  const existingProject = existingFilePath
    ? normalizeProjectRecord(readProjectFile(existingFilePath) || {}, { fallbackId: incomingProject.id })
    : null;

  // When updating an existing project, preserve all previously-saved translations
  // and workspaceDirName so that partial updates (e.g. renaming name/author) never
  // silently wipe the workspace reference or translated strings. The same goes
  // for `targetLanguage` — callers that only want to rename the mod shouldn't
  // accidentally reset the language of the project.
  const mergedProjectData =
    existingProject && incomingProject.translations
      ? {
          ...incomingProject,
          workspaceDirName:
            incomingProject.workspaceDirName || existingProject.workspaceDirName || '',
          targetLanguage:
            incomingProject.targetLanguage || existingProject.targetLanguage || '',
          // Keep the original game ownership if the caller didn't specify one.
          game: incomingProject.game || existingProject.game,
          translations: {
            ...existingProject.translations,
            ...incomingProject.translations,
          },
        }
      : incomingProject;

  const normalizedProject = normalizeProjectRecord(mergedProjectData, {
    fallbackId: existingProject?.id,
    existingCreatedAt: existingProject?.createdAt,
  });

  if (!normalizedProject) {
    throw new Error('Project data is invalid: missing pakPath.');
  }

  const projectsDirectory = ensureProjectsDirectory(userDataPath, getGameFolder(normalizedProject.game));
  const filePath = buildProjectFilePath(projectsDirectory, normalizedProject.id);
  fs.writeFileSync(filePath, JSON.stringify(normalizedProject, null, 2), 'utf8');

  // If the record previously lived elsewhere (legacy flat root, or a different
  // game folder), drop the stale copy so it isn't listed twice.
  if (existingFilePath && path.resolve(existingFilePath) !== path.resolve(filePath)) {
    try { fs.unlinkSync(existingFilePath); } catch { /* ignore */ }
  }

  return normalizedProject;
}

function loadProjectSummaries(userDataPath) {
  const summaries = [];
  const seenIds = new Set();

  for (const dir of collectProjectDirs(userDataPath)) {
    for (const filePath of listProjectJsonFiles(dir)) {
      const fallbackId = path.basename(filePath, '.json');
      const parsedProject = readProjectFile(filePath);
      if (!parsedProject) continue;

      const normalizedProject = normalizeProjectRecord(parsedProject, { fallbackId });
      if (!normalizedProject) continue;

      // Game folders are scanned before the legacy root, so the canonical copy
      // wins if a record briefly exists in both during migration.
      if (seenIds.has(normalizedProject.id)) continue;
      seenIds.add(normalizedProject.id);

      summaries.push(toProjectSummary(normalizedProject));
    }
  }

  return summaries.sort((left, right) => right.lastModified - left.lastModified);
}

function deleteProjectRecord(userDataPath, projectId) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Project id is required.');
  }

  const filePath = findProjectFile(userDataPath, projectId);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// One-time, best-effort relocation of legacy flat records into their per-game
// folder (based on the record's `game`, defaulting to BG3 for pre-multi-game
// data). Also relocates records from the old <userData>/projects root into the
// workspace. Safe to run on every boot — it only moves *.json records.
function migrateLegacyProjects(userDataPath) {
  migrateProjectsRootToWorkspace(userDataPath);
  try {
    const root = ensureProjectsRoot(userDataPath);
    for (const filePath of listProjectJsonFiles(root)) {
      const raw = readProjectFile(filePath);
      const game = raw && isValidGameId(raw.game) ? raw.game : DEFAULT_GAME_ID;
      const targetDir = ensureProjectsDirectory(userDataPath, getGameFolder(game));
      const targetPath = buildProjectFilePath(targetDir, path.basename(filePath, '.json'));
      if (path.resolve(targetPath) === path.resolve(filePath)) continue;
      try {
        fs.renameSync(filePath, targetPath);
      } catch {
        // Cross-device or locked — fall back to copy + best-effort unlink.
        try {
          fs.copyFileSync(filePath, targetPath);
          fs.unlinkSync(filePath);
        } catch { /* leave the legacy file in place; it's still readable */ }
      }
    }
  } catch { /* migration is best-effort, never block startup */ }
}

// Relocate project records from the obsolete <userData>/projects root (flat or
// per-game subfolders) into <userData>/workspace/<GAME>/, then drop the now-empty
// old tree. Records are matched by `game`; unrecognized subfolders keep their
// name. Best-effort: never throws, never overwrites an existing target.
function migrateProjectsRootToWorkspace(userDataPath) {
  const oldRoot = path.join(userDataPath, 'projects');
  if (!fs.existsSync(oldRoot)) return;

  const moveRecord = (srcPath, folder) => {
    const destDir = ensureProjectsDirectory(userDataPath, folder);
    const destPath = path.join(destDir, path.basename(srcPath));
    if (fs.existsSync(destPath) || path.resolve(destPath) === path.resolve(srcPath)) return;
    try {
      fs.renameSync(srcPath, destPath);
    } catch {
      try { fs.copyFileSync(srcPath, destPath); fs.unlinkSync(srcPath); } catch { /* keep original */ }
    }
  };

  try {
    for (const entry of fs.readdirSync(oldRoot, { withFileTypes: true })) {
      const srcPath = path.join(oldRoot, entry.name);
      if (entry.isDirectory()) {
        // Per-game subfolder (BG3, MSC, …) → same-named workspace subfolder.
        for (const filePath of listProjectJsonFiles(srcPath)) moveRecord(filePath, entry.name);
        try { fs.rmdirSync(srcPath); } catch { /* not empty / ignore */ }
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // Flat legacy record → resolve its game from the file content.
        const raw = readProjectFile(srcPath);
        const game = raw && isValidGameId(raw.game) ? raw.game : DEFAULT_GAME_ID;
        moveRecord(srcPath, getGameFolder(game));
      }
    }
    try { fs.rmdirSync(oldRoot); } catch { /* not empty / ignore */ }
  } catch (e) {
    console.warn('[migration] projects→workspace skipped:', e?.message);
  }
}

module.exports = {
  saveProject,
  loadProjectSummaries,
  getProjectById,
  deleteProjectRecord,
  migrateLegacyProjects,
};
