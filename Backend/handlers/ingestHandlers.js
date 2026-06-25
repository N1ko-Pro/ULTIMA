const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
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

  // Reveal the selected game's own folder in the OS file manager. Routes to the
  // game module so each game opens its own workspace (BG3: the loaded mod's
  // folder or workspace/BG3; MSC: workspace/MSC).
  ipcMain.handle(CH.MOD_OPEN_FOLDER, wrapHandler(async (_, gameId) => {
    const gameModule = games.getGameModule(gameId);
    const dir = gameModule?.getWorkspaceFolder ? gameModule.getWorkspaceFolder() : null;
    if (!dir) {
      return { success: false, error: 'Папка для этой игры недоступна.' };
    }
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch { /* fall through — shell.openPath will report failure */ }
    const result = await shell.openPath(dir);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  }));
}

module.exports = { registerIngestHandlers };
