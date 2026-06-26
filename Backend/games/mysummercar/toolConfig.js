// ─────────────────────────────────────────────────────────────────────────────
//  toolConfig.js — MscLocTool (dnlib) distribution config.
//  The tool is NOT bundled in the installer; it is downloaded on demand into
//  %APPDATA%/ULTIMA/Tools/MSC/ from a GitHub release asset.
//
//  The asset is built & published by the build-msc-tool.yml workflow in the
//  N1ko-Pro/ULTIMA_TOOLS repo when a tag `msc-tools-v<TOOL_VERSION>` is pushed
//  there. Bump TOOL_VERSION here and push a matching tag in ULTIMA_TOOLS to
//  ship a new tool build.
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_VERSION = '1.1.0';
const EXE_NAME = 'MscLocTool.exe';
// Sidecar file recording the version actually downloaded, so the app can detect
// an outdated tool and prompt an update (the exe itself exposes no version).
const VERSION_FILE = 'MscLocTool.version';

const DOWNLOAD_URL =
  `https://github.com/N1ko-Pro/ULTIMA_TOOLS/releases/download/msc-tools-v${TOOL_VERSION}/${EXE_NAME}`;

// Approx download size shown in the dependency modal.
const SIZE_MB = 65;

module.exports = { TOOL_VERSION, EXE_NAME, VERSION_FILE, DOWNLOAD_URL, SIZE_MB };
