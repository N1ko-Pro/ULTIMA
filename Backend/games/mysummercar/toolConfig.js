// ─────────────────────────────────────────────────────────────────────────────
//  toolConfig.js — My Summer Car downloadable tooling.
//
//  MSC needs two per-game tools, neither bundled in the installer. Both are
//  downloaded on demand into %APPDATA%/ULTIMA/Tools/MSC/ from GitHub release
//  assets published by the N1ko-Pro/ULTIMA_TOOLS repo:
//
//    • MscLocTool.exe       — dnlib CLI (extract / inject). Required to open
//                             and to build (replace mode) any MSC mod.
//    • MSCLocAPI.dll        — universal MSCLoader runtime patcher (MSCLoc API).
//                             Required only to build a PATCH artifact; bundled
//                             into the produced zip so end users install it
//                             alongside the original mod.
//
//  Each tool records a sidecar `<name>.version` file next to it so the app can
//  detect an outdated copy and offer an update.
// ─────────────────────────────────────────────────────────────────────────────

const releaseAsset = (tag, file) =>
  `https://github.com/N1ko-Pro/ULTIMA_TOOLS/releases/download/${tag}/${file}`;

// ── MscLocTool (dnlib extract/inject) ────────────────────────────────────────
const MSC_TOOL = Object.freeze({
  id: 'msc-tool',
  name: 'MscLocTool',
  version: '1.1.0',
  fileName: 'MscLocTool.exe',
  versionFile: 'MscLocTool.version',
  sizeMb: 65,
  downloadUrl: releaseAsset('msc-tools-v1.1.0', 'MscLocTool.exe'),
});

// ── MSCLoc API (runtime MSCLoader patcher for the patch artifact) ─────────────
// Published in N1ko-Pro/ULTIMA_TOOLS under the `loc-patcher-v<version>` tag.
const MSC_PATCHER = Object.freeze({
  id: 'msc-patcher',
  name: 'MSCLoc API',
  version: '1.0.8',
  fileName: 'MSCLocAPI.dll',
  versionFile: 'MSCLocAPI.version',
  sizeMb: 1,
  downloadUrl: releaseAsset('loc-patcher-v1.0.8', 'MSCLocAPI.dll'),
});

// All MSC tools, in display order (used by checkDependencies / status widget).
const TOOLS = Object.freeze([MSC_TOOL, MSC_PATCHER]);

function getTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}

module.exports = {
  MSC_TOOL,
  MSC_PATCHER,
  TOOLS,
  getTool,

  // ── Legacy exports (MscLocTool) kept for existing imports ─────────────────
  TOOL_VERSION: MSC_TOOL.version,
  EXE_NAME: MSC_TOOL.fileName,
  VERSION_FILE: MSC_TOOL.versionFile,
  DOWNLOAD_URL: MSC_TOOL.downloadUrl,
  SIZE_MB: MSC_TOOL.sizeMb,
};
