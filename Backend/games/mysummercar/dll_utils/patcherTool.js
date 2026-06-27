// ─────────────────────────────────────────────────────────────────────────────
//  patcherTool.js — locate the downloaded MSCLocAPI.dll (MSCLoc API).
//  Unlike MscLocTool it is not executed here: it is a data asset bundled into
//  the patch artifact. This module only resolves its path, presence and
//  recorded version (sidecar), mirroring mscToolCli's presence API.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { MSC_PATCHER } = require('../toolConfig');

let toolDir = null;

function configure(dir) {
  toolDir = dir;
}

function getPath() {
  return toolDir ? path.join(toolDir, MSC_PATCHER.fileName) : null;
}

function isPresent() {
  const p = getPath();
  return Boolean(p && fs.existsSync(p));
}

// Version recorded by the downloader sidecar; null when unknown.
function getInstalledVersion() {
  if (!toolDir) return null;
  try {
    const versionPath = path.join(toolDir, MSC_PATCHER.versionFile);
    if (!fs.existsSync(versionPath)) return null;
    return fs.readFileSync(versionPath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

module.exports = { configure, getPath, isPresent, getInstalledVersion };
