const fs = require('fs');
const path = require('path');

// ── Localization-folder priority ───────────────────────────────────────────
// Some mods ship with multiple localization sub-folders (e.g. `English`,
// `Korean`, `Chinese`). When opening the mod we want to translate FROM the
// English source, so we always look for `Localization/English/` first and
// only fall back to whatever else exists if English is missing.
const PREFERRED_LOCALE_FOLDER = 'english';

/**
 * Walk a directory tree and pull out the mod's primary `.loca` / `.xml` /
 * `meta.lsx`. When more than one localization sub-folder exists, the one
 * named `English` wins — that gives Smart/AI translation a stable source
 * language regardless of how the mod author ordered the folders.
 */
function findModFiles(dir) {
  let metaLsxPath = null;

  // Collect all candidate loca/xml files alongside the localization sub-
  // folder they live in, then pick the best one at the end. Doing this in
  // two passes keeps the priority logic out of the recursion itself.
  const locaCandidates = []; // { path, localeFolder }
  const xmlCandidates  = []; // { path, localeFolder }

  const localeFolderFor = (filePath) => {
    // Find the segment immediately after `Localization/` (case-insensitive).
    const parts = filePath.split(path.sep);
    const idx = parts.findIndex((p) => p.toLowerCase() === 'localization');
    if (idx === -1 || idx + 1 >= parts.length) return '';
    return parts[idx + 1].toLowerCase();
  };

  const traverse = (currentDir) => {
    if (!fs.existsSync(currentDir)) return;
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        traverse(fullPath);
        continue;
      }

      const lower = file.toLowerCase();
      const isHidden = file.startsWith('__');

      if (lower.endsWith('.loca') && !isHidden) {
        locaCandidates.push({ path: fullPath, localeFolder: localeFolderFor(fullPath) });
      }
      if (lower.endsWith('.xml') && fullPath.toLowerCase().includes('localization') && !isHidden) {
        xmlCandidates.push({ path: fullPath, localeFolder: localeFolderFor(fullPath) });
      }
      if (lower === 'meta.lsx') {
        metaLsxPath = fullPath;
      }
    }
  };

  traverse(dir);

  const pickPreferred = (candidates) => {
    if (candidates.length === 0) return null;
    const english = candidates.find((c) => c.localeFolder === PREFERRED_LOCALE_FOLDER);
    return (english || candidates[0]).path;
  };

  return {
    targetLocaPath: pickPreferred(locaCandidates),
    targetXmlPath:  pickPreferred(xmlCandidates),
    metaLsxPath,
  };
}

function findLocalizationRoot(locaDir, workspaceDir) {
  const parts = locaDir.split(path.sep);
  const locIdx = parts.findIndex((p) => p.toLowerCase() === 'localization');
  if (locIdx !== -1) {
    return parts.slice(0, locIdx + 1).join(path.sep);
  }
  return workspaceDir;
}

module.exports = {
  findModFiles,
  findLocalizationRoot,
};
