// ─────────────────────────────────────────────────────────────────────────────
//  dotnetHandlers.js
//  IPC handlers for .NET runtime check and installation.
// ─────────────────────────────────────────────────────────────────────────────

const { ipcMain } = require('electron');
const dotnetManager = require('../manager/dotnetManager');

function registerDotNetHandlers() {
  // Check if .NET 8.0 Desktop Runtime is installed
  ipcMain.handle('dotnet-check', async () => {
    return await dotnetManager.checkDotNetRuntime();
  });

  // Install .NET 8.0 Desktop Runtime with progress updates
  ipcMain.handle('dotnet-install', async (event) => {
    return new Promise((resolve, reject) => {
      dotnetManager.installDotNetRuntime((progress) => {
        event.sender.send('dotnet-install-progress', progress);
      })
        .then(() => resolve({ success: true }))
        .catch((error) => reject(error.message));
    });
  });
}

module.exports = { registerDotNetHandlers };
