const fs = require('fs');
const path = require('path');

const PROJECTS_DIR_NAME = 'projects';

function buildProjectFilePath(projectsDirectory, projectId) {
  return path.join(projectsDirectory, `${projectId}.json`);
}

// Root that holds every per-game projects folder (and any legacy flat records).
function ensureProjectsRoot(userDataPath) {
  const root = path.join(userDataPath, PROJECTS_DIR_NAME);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

// Per-game projects folder, e.g. <userData>/projects/BG3. `folder` is the short
// filesystem segment resolved from the game registry by the caller.
function ensureProjectsDirectory(userDataPath, folder) {
  const root = ensureProjectsRoot(userDataPath);
  const dir = folder ? path.join(root, folder) : root;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Absolute paths of every *.json record directly inside `dir` (non-recursive).
// Returns [] when the directory does not exist.
function listProjectJsonFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name));
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
  ensureProjectsRoot,
  ensureProjectsDirectory,
  listProjectJsonFiles,
  readProjectFile,
};
