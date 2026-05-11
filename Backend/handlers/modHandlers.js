const { ipcMain, dialog, shell } = require('electron');
const CH = require('../ipcChannels');
const path = require('path');
const fs = require('fs');
const { wrapHandler } = require('./handlerUtils');
const { extractPakFromZip, extractPakFromRar } = require('./archiveUtils');

let translationAbortController = null;

// ─────────────────────────────────────────────────────────────────────────────

function registerModHandlers(mainWindow, { bg3Manager }) {
  // ── File selection (pak / zip / rar) ────────────────────────────────────────
  ipcMain.handle(CH.MOD_SELECT_FILE, wrapHandler(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Открыть файл мода BG3',
      filters: [
        { name: 'Файлы мода BG3', extensions: ['pak', 'zip', 'rar'] },
        { name: 'PAK-файл', extensions: ['pak'] },
        { name: 'ZIP-архив', extensions: ['zip'] },
        { name: 'RAR-архив', extensions: ['rar'] },
      ],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { success: false };
    const filePath = filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    return { success: true, filePath, ext };
  }));

  // ── Archive unpacking (zip / rar → pak → unpack) ────────────────────────────
  ipcMain.handle(CH.MOD_UNPACK_ARCHIVE, wrapHandler(async (_, { filePath, ext }) => {
    let tempDir = null;
    let extractedPakPath = null;

    try {
      if (ext === '.zip') {
        ({ pakPath: extractedPakPath, tempDir } = extractPakFromZip(filePath));
      } else if (ext === '.rar') {
        ({ pakPath: extractedPakPath, tempDir } = await extractPakFromRar(filePath));
      } else {
        throw new Error(`Формат "${ext}" не поддерживается. Используйте .pak, .zip или .rar.`);
      }

      const result = await bg3Manager.unpackAndLoadStrings(extractedPakPath);
      // Return original archive path so the project card shows the right source file.
      // workspaceDirName tells deletion which workspace folder to remove.
      return { success: true, data: { ...result, originalPakPath: filePath } };
    } finally {
      // Always clean up the extracted temp directory
      if (tempDir) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }
  }));

  // Step 1 — only shows the native file picker, returns the chosen path
  ipcMain.handle(CH.MOD_SELECT_PAK, wrapHandler(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Select BG3 Mod (.pak)',
      filters: [{ name: 'BG3 Pak Files', extensions: ['pak'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { success: false };
    return { success: true, filePath: filePaths[0] };
  }));

  // Step 2 — does the actual heavy unpacking (shown after dialog closes)
  ipcMain.handle(CH.MOD_UNPACK_PAK, wrapHandler(async (_, { filePath }) => {
    const result = await bg3Manager.unpackAndLoadStrings(filePath);
    // workspaceDirName is already == path.basename(filePath, '.pak') for direct pak,
    // but including it explicitly keeps the deletion path consistent.
    return { success: true, data: { ...result, originalPakPath: filePath } };
  }));

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

  ipcMain.handle(CH.MOD_REPACK, wrapHandler(async (_, { updatedData, modName }) => {
    const rawName = modName
      ? modName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Translated_Mod'
      : 'Translated_Mod';
    const safeName = /_RU$/i.test(rawName) ? rawName : rawName + '_RU';
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Сохранить переведённый мод (.zip)',
      filters: [{ name: 'BG3 Mod Archive', extensions: ['zip'] }],
      defaultPath: `${safeName}.zip`,
    });

    if (canceled || !filePath) return { success: false };

    await bg3Manager.saveAndRepack(updatedData, filePath);
    return { success: true, filePath };
  }));
  ipcMain.handle(CH.MOD_OPEN_FOLDER, wrapHandler(async () => {
    const dir = bg3Manager.cachedData?.modWorkspaceDir;
    if (!dir) return { success: false, error: 'No mod loaded' };
    await shell.openPath(dir);
    return { success: true };
  }));
}

module.exports = { registerModHandlers };
