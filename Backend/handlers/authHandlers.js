const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const authManager = require('../auth/authManager');

function registerAuthHandlers() {
  ipcMain.handle(
    'auth-get-state',
    wrapHandler(async () => {
      return { success: true, state: authManager.getState() };
    }),
  );

  ipcMain.handle(
    'auth-login',
    wrapHandler(async () => {
      const state = await authManager.login();
      return { success: true, state };
    }),
  );

  ipcMain.handle(
    'auth-logout',
    wrapHandler(async () => {
      const state = await authManager.logout();
      return { success: true, state };
    }),
  );

  ipcMain.handle(
    'auth-start-trial',
    wrapHandler(async () => {
      const state = await authManager.startTrial();
      return { success: true, state };
    }),
  );

  ipcMain.handle(
    'auth-refresh',
    wrapHandler(async () => {
      const result = await authManager.refreshSession();
      return { success: true, state: result.state, refreshed: result.refreshed };
    }),
  );

  ipcMain.handle(
    'auth-save-local-name',
    wrapHandler(async (_, name) => {
      await authManager.saveLocalName(name);
      return { success: true };
    }),
  );
}

module.exports = { registerAuthHandlers };
