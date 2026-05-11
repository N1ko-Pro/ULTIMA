const { ipcMain } = require("electron");
const { wrapHandler } = require("./handlerUtils");
const ollamaManager = require("../manager/ollamaManager");
const CH = require('../ipcChannels');

function registerOllamaHandlers({ mainWindow }) {
  ipcMain.handle(
    CH.OLLAMA_GET_STATUS,
    wrapHandler(async () => {
      const status = await ollamaManager.getStatus();
      // If server is not running, also scan disk for installed models
      if (!status.running && status.installed) {
        const diskModels = ollamaManager.scanInstalledModelsFromDisk();
        status.models = diskModels.map(name => ({ name }));
      }
      return { success: true, status };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_PULL_MODEL,
    wrapHandler(async (_, modelName) => {
      try {
        await ollamaManager.pullModel(modelName, {
          onProgress: (progress) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(CH.OLLAMA_PULL_PROGRESS, {
                model: modelName,
                ...progress,
              });
            }
          },
        });
      } catch (err) {
        if (err?.message === 'PULL_CANCELLED') return { success: true, cancelled: true };
        throw err;
      }

      const status = await ollamaManager.getStatus();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CH.OLLAMA_STATUS_CHANGED, status);
      }
      return { success: true, status };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_CANCEL_PULL,
    wrapHandler(async (_, modelName) => {
      // 1. Signal cancellation and destroy the HTTP stream
      ollamaManager.cancelPull();
      // 2. Wait briefly so Ollama releases file handles before we touch the blobs
      await new Promise((r) => setTimeout(r, 600));
      // 3. Try API delete (works only if the manifest was already written)
      try { await ollamaManager.deleteModel(modelName); } catch { /* not in manifest yet */ }
      // 4. Remove orphaned blob files — covers the case where the pull was
      //    cancelled before Ollama committed the manifest (most common case)
      await ollamaManager.pruneOrphanBlobs();
      const status = await ollamaManager.getStatus();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_DELETE_MODEL,
    wrapHandler(async (_, modelName) => {
      await ollamaManager.deleteModel(modelName);
      const status = await ollamaManager.getStatus();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_INSTALL,
    wrapHandler(async () => {
      const result = await ollamaManager.installOllama({
        onProgress: (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(CH.OLLAMA_INSTALL_PROGRESS, progress);
          }
        },
      });
      if (result?.cancelled) return { success: true, cancelled: true };
      // Force immediate status refresh in all windows
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CH.OLLAMA_STATUS_CHANGED, result);
      }
      return { success: true, status: result };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_START_SERVER,
    wrapHandler(async () => {
      const status = await ollamaManager.startServer();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_UNINSTALL,
    wrapHandler(async () => {
      const status = await ollamaManager.uninstallOllama();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_CANCEL_INSTALL,
    wrapHandler(async () => {
      ollamaManager.cancelInstall();
      return { success: true };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_STOP_SERVER,
    wrapHandler(async () => {
      await ollamaManager.stopServer();
      return { success: true };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_RESET_CONTEXT,
    wrapHandler(async (_, modelName) => {
      const result = await ollamaManager.resetContext(modelName);
      return { success: result };
    })
  );

  ipcMain.handle(
    CH.OLLAMA_ENSURE_RUNNING,
    wrapHandler(async () => {
      const status = await ollamaManager.ensureHealthy();
      return { success: true, status };
    })
  );
}

module.exports = { registerOllamaHandlers };
