const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const authManager = require('../auth/authManager');
const CH = require('../ipcChannels');

function registerAuthHandlers() {
  ipcMain.handle(
    CH.AUTH_GET_STATE,
    wrapHandler(async () => {
      return { success: true, state: authManager.getState() };
    }),
  );

  ipcMain.handle(
    CH.AUTH_LOGIN,
    wrapHandler(async () => {
      const state = await authManager.login();
      return { success: true, state };
    }),
  );

  ipcMain.handle(
    CH.AUTH_LOGOUT,
    wrapHandler(async () => {
      const state = await authManager.logout();
      return { success: true, state };
    }),
  );

  ipcMain.handle(
    CH.AUTH_REFRESH,
    wrapHandler(async () => {
      const result = await authManager.refreshSession();
      return { success: true, state: result.state, refreshed: result.refreshed };
    }),
  );

  ipcMain.handle(
    CH.AUTH_SAVE_LOCAL_NAME,
    wrapHandler(async (_, name) => {
      await authManager.saveLocalName(name);
      return { success: true };
    }),
  );
}

module.exports = { registerAuthHandlers };
