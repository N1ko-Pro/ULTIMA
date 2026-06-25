const { ipcMain, dialog } = require('electron');
const CH = require('../../../ipcChannels');
const { wrapHandler } = require('../../../handlers/handlerUtils');
const { getSuffix: getLangSuffix, normalizeCode: normalizeLangCode } = require('../../../manager/shared_utils/languages');

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

  ipcMain.handle(CH.MOD_REPACK, wrapHandler(async (_, { updatedData, modName, targetLanguage }) => {
    const langCode = normalizeLangCode(targetLanguage);
    const langSuffix = getLangSuffix(langCode);
    // Match any of the supported language suffixes — keeps re-packing
    // idempotent across language switches (Mod_RU.zip → Mod_DE.zip without
    // ending up as Mod_RU_DE.zip).
    const suffixPattern = /_(?:RU|EN|DE|FR|ES|IT|PL|PT|JA|KO|ZH|UK|TR)$/i;

    const rawName = modName
      ? modName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Translated_Mod'
      : 'Translated_Mod';
    const safeName = suffixPattern.test(rawName)
      ? rawName.replace(suffixPattern, langSuffix)
      : rawName + langSuffix;

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить переведённый мод (.zip)',
      filters: [{ name: 'BG3 Mod Archive', extensions: ['zip'] }],
      defaultPath: `${safeName}.zip`,
    });

    if (canceled || !filePath) return { success: false };

    await bg3Manager.saveAndRepack(updatedData, filePath, langCode);
    return { success: true, filePath };
  }));
}

module.exports = { registerModHandlers };
