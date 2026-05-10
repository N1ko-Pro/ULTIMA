const fs = require('fs');
const path = require('path');

function findModFiles(dir) {
  let targetLocaPath = null;
  let targetXmlPath = null;
  let metaLsxPath = null;

  const traverse = (currentDir) => {
    if (!fs.existsSync(currentDir)) return;
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        traverse(fullPath);
      } else {
        if (file.toLowerCase().endsWith('.loca')) {
          targetLocaPath = fullPath;
        }
        if (file.toLowerCase().endsWith('.xml') && fullPath.toLowerCase().includes('localization')) {
          targetXmlPath = fullPath;
        }
        if (file.toLowerCase() === 'meta.lsx') {
          metaLsxPath = fullPath;
        }
      }
    }
  };

  traverse(dir);
  return { targetLocaPath, targetXmlPath, metaLsxPath };
}

function findLocalizationRoot(locaDir, workspaceDir) {
  const parts = locaDir.split(path.sep);
  const locIdx = parts.findIndex(p => p.toLowerCase() === 'localization');
  if (locIdx !== -1) {
    return parts.slice(0, locIdx + 1).join(path.sep);
  }
  return workspaceDir;
}

module.exports = {
  findModFiles,
  findLocalizationRoot
};
