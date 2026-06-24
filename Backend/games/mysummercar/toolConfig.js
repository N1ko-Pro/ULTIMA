// ─────────────────────────────────────────────────────────────────────────────
//  toolConfig.js — MscLocTool (dnlib) distribution config.
//  The tool is NOT bundled in the installer; it is downloaded on demand into
//  %APPDATA%/ULTIMA/tools/msc/ from a GitHub release asset.
//
//  The asset is built & published by .github/workflows/build-msc-tool.yml when
//  a tag `msc-tools-v<TOOL_VERSION>` is pushed. Bump TOOL_VERSION here and push
//  a matching tag to ship a new tool build.
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_VERSION = '1.0.0';
const EXE_NAME = 'MscLocTool.exe';

const DOWNLOAD_URL =
  `https://github.com/N1ko-Pro/ULTIMA/releases/download/msc-tools-v${TOOL_VERSION}/${EXE_NAME}`;

// Approx download size shown in the dependency modal.
const SIZE_MB = 65;

module.exports = { TOOL_VERSION, EXE_NAME, DOWNLOAD_URL, SIZE_MB };
