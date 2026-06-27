// ─────────────────────────────────────────────────────────────────────────────
//  games/bg3 — Baldur's Gate 3 game module.
//  Self-contained entry point implementing the backend game-module contract:
//  exposes an initializer, IPC handler registration, and the project pipeline
//  hooks (loadProject / deleteProjectArtifacts). The app shell talks to games
//  through this contract instead of reaching into individual managers directly.
// ─────────────────────────────────────────────────────────────────────────────

const bg3Manager = require('./manager/bg3Manager');
const { registerModHandlers } = require('./handlers/modHandlers');
const { registerXmlHandlers } = require('./handlers/xmlHandlers');
const { loadProject, deleteProjectArtifacts, ingest } = require('./projectModule');
const { getSuffix: getLangSuffix, normalizeCode: normalizeLangCode } = require('../../manager/shared_utils/languages');

// Matches any supported language suffix so re-packing stays idempotent across
// language switches (Mod_RU.zip → Mod_DE.zip, never Mod_RU_DE.zip).
const LANG_SUFFIX_PATTERN = /_(?:RU|EN|DE|FR|ES|IT|PL|PT|JA|KO|ZH|UK|TR)$/i;

module.exports = {
  id: 'bg3',

  // Called once on app boot.
  initialize(userDataPath, appPath) {
    bg3Manager.initialize(userDataPath, appPath);
  },

  // Registers this game's IPC handlers (mod ingest/pack + XML import/export).
  registerHandlers({ mainWindow, app }) {
    registerModHandlers(mainWindow, { bg3Manager });
    registerXmlHandlers(mainWindow, app);
  },

  // Folder revealed by the generic "open folder" action: the currently-loaded
  // mod's workspace if one is open, otherwise the BG3 workspace root.
  getWorkspaceFolder() {
    return bg3Manager.cachedData?.modWorkspaceDir || bg3Manager.workspaceDir;
  },

  // Project pipeline hooks — called by the generic project handlers, resolved
  // via the project record's `game` field.
  ingest,
  loadProject,
  deleteProjectArtifacts,

  // Packaging contract (called by the generic MOD_REPACK router). BG3 always
  // builds a single localization .pak wrapped in a .zip; it ignores `mode` and
  // `originalPakPath` (those are for games with multiple output modes, e.g.
  // MSC patch/replace). Behaviour is 1:1 with the former BG3-only handler.
  async pack(input, ctx) {
    const { updatedData, modName, targetLanguage } = input;

    const langCode = normalizeLangCode(targetLanguage);
    const langSuffix = getLangSuffix(langCode);

    const rawName = modName
      ? modName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Translated_Mod'
      : 'Translated_Mod';
    const safeName = LANG_SUFFIX_PATTERN.test(rawName)
      ? rawName.replace(LANG_SUFFIX_PATTERN, langSuffix)
      : rawName + langSuffix;

    const filePath = await ctx.promptOutputPath(`${safeName}.zip`, [
      { name: 'BG3 Mod Archive', extensions: ['zip'] },
    ]);
    if (!filePath) return { success: false };

    await bg3Manager.saveAndRepack(updatedData, filePath, langCode);
    return { success: true, filePath };
  },
};
