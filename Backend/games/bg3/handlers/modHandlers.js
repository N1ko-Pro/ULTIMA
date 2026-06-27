const { ipcMain } = require('electron');
const CH = require('../../../ipcChannels');
const { wrapHandler } = require('../../../handlers/handlerUtils');

let translationAbortController = null;

// ─────────────────────────────────────────────────────────────────────────────

function registerModHandlers(mainWindow, { bg3Manager }) {
  ipcMain.handle(CH.TRANSLATE_STRINGS, wrapHandler(async (_, { dataToTranslate, targetLang, options }) => {
    if (translationAbortController) {
      translationAbortController.abort();
    }
    translationAbortController = new AbortController();

    // Per-item progress callback for AI translation (emits IPC to renderer)
    const onItemProgress = (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(CH.TRANSLATE_ITEM_PROGRESS, progress);
      }
    };

    try {
      const result = await bg3Manager.translateBatch(dataToTranslate, targetLang, {
        ...options,
        abortSignal: translationAbortController.signal,
        onItemProgress,
      });
      return { success: true, data: result };
    } catch (error) {
      if (error.message === 'ABORTED' || translationAbortController.signal.aborted) {
        return { success: false, error: 'ABORTED' };
      }
      throw error;
    } finally {
      translationAbortController = null;
    }
  }));

  ipcMain.handle(CH.TRANSLATE_ABORT, wrapHandler(async () => {
    if (translationAbortController) {
      translationAbortController.abort();
      translationAbortController = null;
    }
    return { success: true };
  }));
}

module.exports = { registerModHandlers };
