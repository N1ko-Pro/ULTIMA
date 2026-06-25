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
const mscToolCli = require('./dll_utils/mscToolCli');
const { downloadTool } = require('./dll_utils/mscToolDownloader');
const { TOOL_VERSION, SIZE_MB } = require('./toolConfig');

let toolDir = null;
let workspaceDir = null;

module.exports = {
  id: 'mysummercar',

  initialize(userDataPath) {
    if (userDataPath && typeof userDataPath === 'string') {
      toolDir = path.join(userDataPath, 'tools', 'msc');
      mscToolCli.configure(toolDir);
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
  // Presence gates usage; version is only a *non-blocking* update offer, so a
  // user who declines an update can still open mods with the installed tool.
  async checkDependencies() {
    const present = mscToolCli.isPresent();
    const installedVersion = mscToolCli.getInstalledVersion();
    const upToDate = present && installedVersion === TOOL_VERSION;

    const item = {
      id: 'msc-tool',
      name: 'MscLocTool',
      version: TOOL_VERSION,
      sizeMb: SIZE_MB,
    };

    if (!present) {
      // Required install — this DOES block opening mods.
      return { ok: false, updateAvailable: false, missing: [item] };
    }
    if (upToDate) {
      return { ok: true, updateAvailable: false, missing: [] };
    }
    // Present but outdated → offer an update, but report ok so nothing blocks.
    return {
      ok: true,
      updateAvailable: true,
      missing: [{ ...item, outdated: true, installedVersion: installedVersion || null }],
    };
  },

  async installDependencies(onProgress) {
    if (!toolDir) throw new Error('Каталог инструментов MSC не инициализирован.');
    await downloadTool(toolDir, onProgress);
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
};
