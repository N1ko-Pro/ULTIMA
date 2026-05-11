const { ipcMain, app } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

function registerUpdateHandlers({ updateManager }) {
  ipcMain.handle(CH.UPDATER_GET_STATE, wrapHandler(async () => {
    return { success: true, state: updateManager.getState(), currentVersion: app.getVersion() };
  }));

  ipcMain.handle(CH.UPDATER_CHECK, wrapHandler(async (_e, payload) => {
    const silent = !!(payload && payload.silent);
    return await updateManager.checkForUpdates({ silent });
  }));

  ipcMain.handle(CH.UPDATER_DOWNLOAD, wrapHandler(async () => {
    return await updateManager.downloadUpdate();
  }));

  // Start the NSIS installer in silent mode WITHOUT quitting the app.
  // The renderer then shows an in-app progress bar and, once it hits
  // 100 %, calls 'updater-finalize-install' below to quit Electron so
  // NSIS can actually swap the files and relaunch the new version.
  ipcMain.handle(CH.UPDATER_INSTALL, wrapHandler(async () => {
    return updateManager.startSilentInstall();
  }));

  // Quit Electron so the already-running silent NSIS installer can
  // finish replacing the binaries (and launch the new version thanks
  // to the --force-run flag passed by electron-updater).
  ipcMain.handle(CH.UPDATER_FINALIZE_INSTALL, wrapHandler(async () => {
    return updateManager.finalizeInstall();
  }));
}

module.exports = { registerUpdateHandlers };
