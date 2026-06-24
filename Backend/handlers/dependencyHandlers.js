const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

// Generic, game-routed dependency check / install. A game module may expose
// `checkDependencies()` and `installDependencies(onProgress)`; games without
// dependencies are simply reported as ready.
function registerDependencyHandlers(mainWindow, { games }) {
  ipcMain.handle(CH.DEPS_CHECK, wrapHandler(async (_, gameId) => {
    const gameModule = games.getGameModule(gameId);
    if (!gameModule?.checkDependencies) {
      return { success: true, ok: true, missing: [] };
    }
    const result = await gameModule.checkDependencies();
    return { success: true, ok: !!result.ok, missing: result.missing || [] };
  }));

  ipcMain.handle(CH.DEPS_INSTALL, wrapHandler(async (event, gameId) => {
    const gameModule = games.getGameModule(gameId);
    if (!gameModule?.installDependencies) {
      return { success: false, error: 'Для этой игры нет устанавливаемых зависимостей.' };
    }
    await gameModule.installDependencies((percent) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CH.DEPS_INSTALL_PROGRESS, percent);
      }
    });
    return { success: true };
  }));
}

module.exports = { registerDependencyHandlers };
