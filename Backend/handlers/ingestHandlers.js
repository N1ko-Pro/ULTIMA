const { ipcMain, dialog } = require('electron');
const path = require('path');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

// Generic, game-routed mod ingestion. The renderer passes the selected game id;
// the matching game module turns a file (.pak / .dll / archive) into the
// `{ strings, modInfo }` shape the editor consumes. Keeps the shell free of any
// game-specific knowledge.
function registerIngestHandlers(mainWindow, { games }) {
  ipcMain.handle(CH.MOD_SELECT, wrapHandler(async (_, extensions) => {
    const exts = Array.isArray(extensions) && extensions.length
      ? extensions.map((e) => String(e).replace(/^\./, '').toLowerCase())
      : ['pak', 'zip', 'rar'];

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Открыть файл мода',
      filters: [{ name: 'Файлы мода', extensions: exts }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { success: false };

    const filePath = filePaths[0];
    return { success: true, filePath, ext: path.extname(filePath).toLowerCase() };
  }));

  ipcMain.handle(CH.MOD_INGEST, wrapHandler(async (_, { filePath, ext, gameId }) => {
    const gameModule = games.getGameModule(gameId);
    if (!gameModule?.ingest) {
      return { success: false, error: 'Импорт модов для этой игры пока не поддерживается.' };
    }

    // Gate on dependencies — opening a mod is one of the entry points that
    // surfaces the "install required tools" modal.
    if (gameModule.checkDependencies) {
      const deps = await gameModule.checkDependencies();
      if (!deps.ok) {
        return { success: false, dependencyMissing: true, gameId, missing: deps.missing || [] };
      }
    }

    const data = await gameModule.ingest(filePath, ext);
    return { success: true, data };
  }));
}

module.exports = { registerIngestHandlers };
