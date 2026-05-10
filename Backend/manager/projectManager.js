const fs = require('fs');
const path = require('path');
const { sanitizeWorkspaceTag } = require('./bg3_utils/workspaceUtils');
const {
  normalizeProjectRecord,
  toProjectSummary,
  ensureObject,
} = require('./project_utils/normalizer');
const {
  buildProjectFilePath,
  ensureProjectsDirectory,
  readProjectFile,
} = require('./project_utils/fileIO');

let DEFAULT_WORKSPACE_ROOT = path.join(__dirname, '..', 'workspace');
const WORKSPACE_REMOVE_OPTIONS = {
  recursive: true,
  force: true,
  maxRetries: 3,
  retryDelay: 250,
};
const WORKSPACE_REMOVE_RETRY_DELAYS = [0, 400, 1200];

function initialize(userDataPath, appRootPath) {
  const workspaceBase = (appRootPath && typeof appRootPath === 'string')
    ? appRootPath
    : userDataPath;
  if (workspaceBase) {
    DEFAULT_WORKSPACE_ROOT = path.join(workspaceBase, 'workspace');
  }
}

function resolveWorkspaceRoot(workspaceRoot) {
  return typeof workspaceRoot === 'string' && workspaceRoot.trim().length > 0
    ? workspaceRoot
    : DEFAULT_WORKSPACE_ROOT;
}

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

function getProjectById(userDataPath, projectId) {
  if (!projectId || typeof projectId !== 'string') {
    return null;
  }

  const projectsDirectory = ensureProjectsDirectory(userDataPath);
  const filePath = buildProjectFilePath(projectsDirectory, projectId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const rawProject = readProjectFile(filePath);
  if (!rawProject) {
    return null;
  }

  return normalizeProjectRecord(rawProject, { fallbackId: projectId });
}

function saveProject(userDataPath, projectData) {
  const projectsDirectory = ensureProjectsDirectory(userDataPath);
  const incomingProject = ensureObject(projectData);

  const existingProject =
    typeof incomingProject.id === 'string' && incomingProject.id
      ? getProjectById(userDataPath, incomingProject.id)
      : null;

  // When updating an existing project, preserve all previously-saved translations
  // and workspaceDirName so that partial updates (e.g. renaming name/author) never
  // silently wipe the workspace reference or translated strings.
  const mergedProjectData =
    existingProject && incomingProject.translations
      ? {
          ...incomingProject,
          workspaceDirName:
            incomingProject.workspaceDirName || existingProject.workspaceDirName || '',
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

  const filePath = buildProjectFilePath(projectsDirectory, normalizedProject.id);
  fs.writeFileSync(filePath, JSON.stringify(normalizedProject, null, 2), 'utf8');

  return normalizedProject;
}

function loadProjectSummaries(userDataPath) {
  const projectsDirectory = ensureProjectsDirectory(userDataPath);

  return fs
    .readdirSync(projectsDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      const filePath = path.join(projectsDirectory, fileName);
      const fallbackId = path.basename(fileName, '.json');
      const parsedProject = readProjectFile(filePath);
      if (!parsedProject) {
        return null;
      }

      const normalizedProject = normalizeProjectRecord(parsedProject, { fallbackId });
      if (!normalizedProject) {
        return null;
      }

      return toProjectSummary(normalizedProject);
    })
    .filter(Boolean)
    .sort((left, right) => right.lastModified - left.lastModified);
}

async function deleteProject(userDataPath, projectId, workspaceRoot) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Project id is required.');
  }

  const projectRecord = getProjectById(userDataPath, projectId);
  const workspaceTargets = buildWorkspaceDeletionTargets(
    resolveWorkspaceRoot(workspaceRoot),
    projectId,
    projectRecord
  );

  await removeWorkspaceTargets(workspaceTargets);

  const projectsDirectory = ensureProjectsDirectory(userDataPath);
  const filePath = buildProjectFilePath(projectsDirectory, projectId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function loadProjectForEditing({ userDataPath, projectId, bg3Manager, extractedPakPath }) {
  if (!projectId || typeof projectId !== 'string') {
    return { success: false, error: 'Не указан идентификатор проекта.' };
  }

  const projectRecord = getProjectById(userDataPath, projectId);
  if (!projectRecord) {
    return { success: false, error: 'Проект не найден или повреждён.' };
  }

  // Use the pre-extracted PAK path if provided (archive projects),
  // otherwise fall back to the stored pakPath (direct .pak projects).
  const actualPakPath = extractedPakPath || projectRecord.pakPath;

  if (!fs.existsSync(actualPakPath)) {
    return {
      success: false,
      error: `Файл не существует по пути: ${actualPakPath}`,
    };
  }

  // Use the stored workspaceDirName directly (as-is) so we reuse the exact folder on disk,
  // even if it contains spaces or other characters that sanitizeWorkspaceTag would change.
  const storedDir = projectRecord.workspaceDirName;

  const result = await bg3Manager.unpackAndLoadStrings(actualPakPath, {
    ...(storedDir ? { exactWorkspaceDir: storedDir } : { workspaceTag: path.parse(actualPakPath).name }),
  });

  return {
    success: true,
    project: {
      id: projectRecord.id,
      name: projectRecord.name,
    },
    data: {
      ...result,
      originalPakPath: projectRecord.pakPath,
      translations: projectRecord.translations,
    },
  };
}

module.exports = {
  initialize,
  saveProject,
  loadProjectSummaries,
  getProjectById,
  deleteProject,
  loadProjectForEditing,
};
