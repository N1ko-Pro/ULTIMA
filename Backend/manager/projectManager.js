const fs = require('fs');
const path = require('path');
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

function deleteProjectRecord(userDataPath, projectId) {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Project id is required.');
  }

  const projectsDirectory = ensureProjectsDirectory(userDataPath);
  const filePath = buildProjectFilePath(projectsDirectory, projectId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  saveProject,
  loadProjectSummaries,
  getProjectById,
  deleteProjectRecord,
};
