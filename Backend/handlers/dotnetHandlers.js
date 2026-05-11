// ─────────────────────────────────────────────────────────────────────────────
//  dotnetHandlers.js
//  IPC handlers for .NET runtime check and installation.
// ─────────────────────────────────────────────────────────────────────────────

const { ipcMain } = require('electron');
const dotnetManager = require('../manager/dotnetManager');
const CH = require('../ipcChannels');

function registerDotNetHandlers() {
  // Check if .NET 8.0 Desktop Runtime is installed
  ipcMain.handle(CH.DOTNET_CHECK, async () => {
    return await dotnetManager.checkDotNetRuntime();
  });

  // Install .NET 8.0 Desktop Runtime with progress updates
  ipcMain.handle(CH.DOTNET_INSTALL, async (event) => {
    return new Promise((resolve, reject) => {
      dotnetManager.installDotNetRuntime((progress) => {
        event.sender.send(CH.DOTNET_INSTALL_PROGRESS, progress);
      })
        .then(() => resolve({ success: true }))
        .catch((error) => reject(error.message));
    });
  });
}

module.exports = { registerDotNetHandlers };
