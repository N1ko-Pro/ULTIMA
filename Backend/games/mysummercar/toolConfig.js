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

// ── GitHub coordinates (for dynamic "latest patcher" resolution) ─────────────
// The patcher's published version is resolved live from the ULTIMA_TOOLS
// releases (see dll_utils/patcherRelease.js); MSC_PATCHER.version below is the
// pinned fallback/floor used when GitHub is unreachable.
const GH_TOOLS_OWNER = 'N1ko-Pro';
const GH_TOOLS_REPO = 'ULTIMA_TOOLS';
const PATCHER_TAG_PREFIX = 'MSCLoc-API-v';

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
// Published in N1ko-Pro/ULTIMA_TOOLS under the `MSCLoc-API-v<version>` tag.
const MSC_PATCHER = Object.freeze({
  id: 'msc-patcher',
  name: 'MSCLoc API',
  version: '1.1.1',
  fileName: 'MSCLocAPI.dll',
  versionFile: 'MSCLocAPI.version',
  sizeMb: 1,
  downloadUrl: releaseAsset('MSCLoc-API-v1.1.1', 'MSCLocAPI.dll'),
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

  // ── GitHub coordinates for dynamic patcher version resolution ─────────────
  GH_TOOLS_OWNER,
  GH_TOOLS_REPO,
  PATCHER_TAG_PREFIX,

  // ── Legacy exports (MscLocTool) kept for existing imports ─────────────────
  TOOL_VERSION: MSC_TOOL.version,
  EXE_NAME: MSC_TOOL.fileName,
  VERSION_FILE: MSC_TOOL.versionFile,
  DOWNLOAD_URL: MSC_TOOL.downloadUrl,
  SIZE_MB: MSC_TOOL.sizeMb,
};
