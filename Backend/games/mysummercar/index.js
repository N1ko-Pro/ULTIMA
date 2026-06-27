// ─────────────────────────────────────────────────────────────────────────────
//  games/mysummercar — My Summer Car game module (backend contract).
//  Mods are managed .NET .dll files with hardcoded string literals, read/written
//  via the bundled MscLocTool (dnlib). The tool is a downloadable dependency
//  (see toolConfig.js) — the generic dependency flow prompts the user to install
//  it before mods can be opened.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { loadStrings } = require('./mscManager');
const { pack } = require('./packManager');
const mscToolCli = require('./dll_utils/mscToolCli');
const patcherTool = require('./dll_utils/patcherTool');
const gameIntegration = require('./gameIntegration');
const { downloadToolById } = require('./dll_utils/mscToolDownloader');
const { MSC_TOOL, MSC_PATCHER } = require('./toolConfig');

let toolDir = null;
let workspaceDir = null;

module.exports = {
  id: 'mysummercar',

  initialize(userDataPath) {
    if (userDataPath && typeof userDataPath === 'string') {
      // Downloaded per-game tooling lives under <userData>/Tools/<GAME>.
      // (Kept in userData rather than the install dir so it stays writable
      // regardless of the installer's per-machine/Program Files location.)
      toolDir = path.join(userDataPath, 'Tools', 'MSC');
      mscToolCli.configure(toolDir);
      patcherTool.configure(toolDir);
      gameIntegration.configure(toolDir);
      // Per-game workspace segment. MSC extracts to temp dirs during ingest, so
      // this folder is mostly a stable, game-owned location for "open folder".
      workspaceDir = path.join(userDataPath, 'workspace', 'MSC');
    }
  },

  registerHandlers() { /* no game-specific IPC yet */ },

  // Folder revealed by the generic "open folder" action.
  getWorkspaceFolder() {
    return workspaceDir;
  },

  // ── Dependency contract ───────────────────────────────────────────────────
  // Two tools: MscLocTool (extract/inject — REQUIRED to open & build) and
  // MSCLoc API (runtime patcher — needed ONLY for patch-mode builds).
  //
  // Presence of MscLocTool gates usage (`ok`); the patcher never blocks opening
  // a mod, so it is reported in `tools` (for the status widget) but kept out of
  // the on-entry `missing` set. A version mismatch is a non-blocking update.
  //
  //   • `ok`              — false only when MscLocTool is absent.
  //   • `missing`         — actionable on-entry items (MscLocTool install/update).
  //   • `updateAvailable` — MscLocTool present but outdated.
  //   • `tools`           — FULL list with per-tool `status` for the widget
  //                         ('installed' | 'missing' | 'update').
  async checkDependencies() {
    // MscLocTool (gates opening).
    const toolPresent = mscToolCli.isPresent();
    const toolVersion = mscToolCli.getInstalledVersion();
    const toolUpToDate = toolPresent && toolVersion === MSC_TOOL.version;

    const toolItem = { id: MSC_TOOL.id, name: MSC_TOOL.name, version: MSC_TOOL.version, sizeMb: MSC_TOOL.sizeMb };
    const toolStatus = !toolPresent
      ? { ...toolItem, status: 'missing' }
      : toolUpToDate
        ? { ...toolItem, status: 'installed', installedVersion: toolVersion }
        : { ...toolItem, status: 'update', installedVersion: toolVersion || null };

    // MSCLoc API (needed only for patch builds — non-blocking here).
    const patcherPresent = patcherTool.isPresent();
    const patcherVersion = patcherTool.getInstalledVersion();
    const patcherUpToDate = patcherPresent && patcherVersion === MSC_PATCHER.version;

    const patcherItem = { id: MSC_PATCHER.id, name: MSC_PATCHER.name, version: MSC_PATCHER.version, sizeMb: MSC_PATCHER.sizeMb };
    const patcherStatus = !patcherPresent
      ? { ...patcherItem, status: 'missing' }
      : patcherUpToDate
        ? { ...patcherItem, status: 'installed', installedVersion: patcherVersion }
        : { ...patcherItem, status: 'update', installedVersion: patcherVersion || null };

    const tools = [toolStatus, patcherStatus];

    // On-entry `missing` only concerns the blocking tool (MscLocTool).
    const missing = [];
    if (!toolPresent) missing.push(toolItem);
    else if (!toolUpToDate) missing.push({ ...toolItem, outdated: true, installedVersion: toolVersion || null });

    return {
      ok: toolPresent,
      updateAvailable: toolPresent && !toolUpToDate,
      missing,
      tools,
    };
  },

  async installDependencies(onProgress, toolId) {
    if (!toolDir) throw new Error('Каталог инструментов MSC не инициализирован.');
    // Install the requested tool; default to MscLocTool when unspecified.
    const id = toolId === MSC_PATCHER.id ? MSC_PATCHER.id : MSC_TOOL.id;
    await downloadToolById(toolDir, id, onProgress);
  },

  // ── Project pipeline ──────────────────────────────────────────────────────
  async ingest(filePath, ext) {
    const result = await loadStrings(filePath, ext);
    return { ...result, originalPakPath: filePath };
  },

  async loadProject(projectRecord) {
    if (!projectRecord) {
      return { success: false, error: 'Проект не найден или повреждён.' };
    }
    if (!fs.existsSync(projectRecord.pakPath)) {
      return {
        success: false,
        error: `Оригинальный файл больше не существует по пути: ${projectRecord.pakPath}`,
      };
    }

    const ext = path.extname(projectRecord.pakPath).toLowerCase();
    const result = await loadStrings(projectRecord.pakPath, ext);

    return {
      success: true,
      project: {
        id: projectRecord.id,
        name: projectRecord.name,
        targetLanguage: projectRecord.targetLanguage,
      },
      data: {
        ...result,
        originalPakPath: projectRecord.pakPath,
        translations: projectRecord.translations,
        targetLanguage: projectRecord.targetLanguage,
      },
    };
  },

  async deleteProjectArtifacts() { /* no workspace folders for MSC */ },

  // ── Packaging contract (generic MOD_REPACK router calls this) ─────────────
  // MSC supports two output modes: 'replace' (inject → new .dll) and 'patch'
  // (separate artifact alongside the original). See packManager.js. The
  // original mod file is never mutated.
  pack,

  // ── Game integration (workspace panel) ────────────────────────────────────
  // Optional contract methods used by the generic game-integration handler.
  // They let ULTIMA install the patcher once into the game and write patch
  // translations straight into it, instead of bundling the patcher per artifact.
  getGameIntegration() {
    return gameIntegration.getStatus();
  },

  detectGamePath() {
    gameIntegration.detectAndStore();
    return gameIntegration.getStatus();
  },

  setGamePath(dir) {
    const res = gameIntegration.setGamePath(dir);
    return { ...res, status: gameIntegration.getStatus() };
  },

  // Forget the remembered game path.
  clearGamePath() {
    gameIntegration.clearGamePath();
    return { success: true, status: gameIntegration.getStatus() };
  },

  // Install the patcher engine into the game's Mods folder, downloading it
  // first if it isn't in the tools cache yet (or the cached copy is outdated).
  // Doubles as the "update" path: an outdated cache is re-downloaded.
  async installPatcherToGame(onProgress) {
    if (!gameIntegration.getGamePath()) {
      return { success: false, error: 'GAME_PATH_MISSING' };
    }
    const needDownload = !patcherTool.isPresent()
      || patcherTool.getInstalledVersion() !== MSC_PATCHER.version;
    if (needDownload) {
      if (!toolDir) return { success: false, error: 'Каталог инструментов MSC не инициализирован.' };
      await downloadToolById(toolDir, MSC_PATCHER.id, onProgress);
    } else {
      onProgress?.(100);
    }
    const res = gameIntegration.installPatcher();
    if (!res.ok) return { success: false, error: res.error };
    return { success: true, installedTo: res.installedTo, status: gameIntegration.getStatus() };
  },

  // Remove the patcher from the game's Mods folder.
  uninstallPatcherFromGame() {
    const res = gameIntegration.uninstallPatcher();
    if (!res.ok) return { success: false, error: res.error };
    return { success: true, status: gameIntegration.getStatus() };
  },
};
