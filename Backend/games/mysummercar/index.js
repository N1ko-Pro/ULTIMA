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

module.exports = {
  id: 'mysummercar',

  initialize(userDataPath) {
    if (userDataPath && typeof userDataPath === 'string') {
      toolDir = path.join(userDataPath, 'tools', 'msc');
      mscToolCli.configure(toolDir);
    }
  },

  registerHandlers() { /* no game-specific IPC yet */ },

  // ── Dependency contract ───────────────────────────────────────────────────
  async checkDependencies() {
    const ok = mscToolCli.isPresent();
    return {
      ok,
      missing: ok ? [] : [{
        id: 'msc-tool',
        name: 'MscLocTool',
        version: TOOL_VERSION,
        sizeMb: SIZE_MB,
      }],
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
