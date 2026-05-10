const fs = require('fs');
const path = require('path');

const PROJECTS_DIR_NAME = 'projects';

function buildProjectFilePath(projectsDirectory, projectId) {
  return path.join(projectsDirectory, `${projectId}.json`);
}

function ensureProjectsDirectory(userDataPath) {
  const projectsDirectory = path.join(userDataPath, PROJECTS_DIR_NAME);
  if (!fs.existsSync(projectsDirectory)) {
    fs.mkdirSync(projectsDirectory, { recursive: true });
  }

  return projectsDirectory;
}

function readProjectFile(filePath) {
  try {
    const rawJson = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawJson);
  } catch {
    return null;
  }
}

module.exports = {
  buildProjectFilePath,
  ensureProjectsDirectory,
  readProjectFile,
};
