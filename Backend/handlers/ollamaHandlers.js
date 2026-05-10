const { ipcMain } = require("electron");
const { wrapHandler } = require("./handlerUtils");
const ollamaManager = require("../manager/ollamaManager");

function registerOllamaHandlers({ mainWindow }) {
  ipcMain.handle(
    "ollama-get-status",
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
    "ollama-pull-model",
    wrapHandler(async (_, modelName) => {
      try {
        await ollamaManager.pullModel(modelName, {
          onProgress: (progress) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("ollama-pull-progress", {
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
        mainWindow.webContents.send("ollama-status-changed", status);
      }
      return { success: true, status };
    })
  );

  ipcMain.handle(
    "ollama-cancel-pull-model",
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
    "ollama-delete-model",
    wrapHandler(async (_, modelName) => {
      await ollamaManager.deleteModel(modelName);
      const status = await ollamaManager.getStatus();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    "ollama-install",
    wrapHandler(async () => {
      const result = await ollamaManager.installOllama({
        onProgress: (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("ollama-install-progress", progress);
          }
        },
      });
      if (result?.cancelled) return { success: true, cancelled: true };
      // Force immediate status refresh in all windows
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("ollama-status-changed", result);
      }
      return { success: true, status: result };
    })
  );

  ipcMain.handle(
    "ollama-start-server",
    wrapHandler(async () => {
      const status = await ollamaManager.startServer();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    "ollama-uninstall",
    wrapHandler(async () => {
      const status = await ollamaManager.uninstallOllama();
      return { success: true, status };
    })
  );

  ipcMain.handle(
    "ollama-cancel-install",
    wrapHandler(async () => {
      ollamaManager.cancelInstall();
      return { success: true };
    })
  );

  ipcMain.handle(
    "ollama-stop-server",
    wrapHandler(async () => {
      await ollamaManager.stopServer();
      return { success: true };
    })
  );

  ipcMain.handle(
    "ollama-reset-context",
    wrapHandler(async (_, modelName) => {
      const result = await ollamaManager.resetContext(modelName);
      return { success: result };
    })
  );

  ipcMain.handle(
    "ollama-ensure-running",
    wrapHandler(async () => {
      const status = await ollamaManager.ensureHealthy();
      return { success: true, status };
    })
  );
}

module.exports = { registerOllamaHandlers };
