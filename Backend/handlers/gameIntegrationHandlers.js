const { ipcMain, dialog } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

// Generic, game-routed "integration with the installed game" handlers. A game
// module MAY expose: getGameIntegration(), detectGamePath(), setGamePath(dir),
// installPatcherToGame(onProgress). Games that don't (BG3) simply report that
// integration is unsupported. Keeps the shell free of game-specific knowledge.
function registerGameIntegrationHandlers(mainWindow, { games }) {
  ipcMain.handle(CH.GAME_GET_INTEGRATION, wrapHandler(async (_, gameId) => {
    const game = games.getGameModule(gameId);
    if (!game?.getGameIntegration) return { success: true, supported: false };
    return { success: true, supported: true, status: await game.getGameIntegration() };
  }));

  ipcMain.handle(CH.GAME_DETECT_PATH, wrapHandler(async (_, gameId) => {
    const game = games.getGameModule(gameId);
    if (!game?.detectGamePath) return { success: false, error: 'Интеграция не поддерживается.' };
    return { success: true, status: game.detectGamePath() };
  }));

  ipcMain.handle(CH.GAME_SET_PATH, wrapHandler(async (_, { gameId, dir }) => {
    const game = games.getGameModule(gameId);
    if (!game?.setGamePath) return { success: false, error: 'Интеграция не поддерживается.' };
    const res = game.setGamePath(dir);
    if (!res.ok) return { success: false, error: res.error, status: res.status };
    return { success: true, status: res.status };
  }));

  ipcMain.handle(CH.GAME_CLEAR_PATH, wrapHandler(async (_, gameId) => {
    const game = games.getGameModule(gameId);
    if (!game?.clearGamePath) return { success: false, error: 'Интеграция не поддерживается.' };
    return game.clearGamePath();
  }));

  // Folder picker + validate-and-store in one step.
  ipcMain.handle(CH.GAME_PICK_PATH, wrapHandler(async (_, gameId) => {
    const game = games.getGameModule(gameId);
    if (!game?.setGamePath) return { success: false, error: 'Интеграция не поддерживается.' };

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Укажите папку игры',
      properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0) return { success: false, canceled: true };

    const res = game.setGamePath(filePaths[0]);
    if (!res.ok) return { success: false, error: res.error, status: res.status };
    return { success: true, status: res.status };
  }));

  ipcMain.handle(CH.GAME_INSTALL_PATCHER, wrapHandler(async (_, gameId) => {
    const game = games.getGameModule(gameId);
    if (!game?.installPatcherToGame) return { success: false, error: 'Интеграция не поддерживается.' };
    return game.installPatcherToGame((percent) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CH.DEPS_INSTALL_PROGRESS, percent);
      }
    });
  }));

  ipcMain.handle(CH.GAME_UNINSTALL_PATCHER, wrapHandler(async (_, gameId) => {
    const game = games.getGameModule(gameId);
    if (!game?.uninstallPatcherFromGame) return { success: false, error: 'Интеграция не поддерживается.' };
    return game.uninstallPatcherFromGame();
  }));
}

module.exports = { registerGameIntegrationHandlers };
