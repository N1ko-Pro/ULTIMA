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

  // Project pipeline hooks — called by the generic project handlers, resolved
  // via the project record's `game` field.
  ingest,
  loadProject,
  deleteProjectArtifacts,
};
