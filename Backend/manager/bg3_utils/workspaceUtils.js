const fs = require('fs');

function sanitizeWorkspaceTag(rawTag, fallbackTag) {
  const text = typeof rawTag === 'string' ? rawTag.trim() : '';
  const sanitized = text.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (sanitized) return sanitized;
  const fallbackText = typeof fallbackTag === 'string' ? fallbackTag.trim() : '';
  return fallbackText.replace(/[^a-zA-Z0-9._-]/g, '_') || 'mod';
}

function createSessionWorkspaceTag(baseTag) {
  const sessionSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${baseTag}__work_${sessionSuffix}`;
}

function ensureWorkspaceDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      const stats = fs.lstatSync(dirPath);
      if (stats.isDirectory()) {
        return true;
      }

      fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }

    fs.mkdirSync(dirPath, { recursive: true });
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function resolveWorkspaceDirectory(baseModWorkspaceDir) {
  if (ensureWorkspaceDirectory(baseModWorkspaceDir)) {
    return baseModWorkspaceDir;
  }

  throw new Error(`Could not create workspace directory: ${baseModWorkspaceDir}`);
}

module.exports = {
  sanitizeWorkspaceTag,
  createSessionWorkspaceTag,
  resolveWorkspaceDirectory,
};
