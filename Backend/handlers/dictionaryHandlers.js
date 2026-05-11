const { ipcMain, dialog } = require('electron');
const path = require('path');
const { wrapHandler } = require('./handlerUtils');
const dictionaryManager = require('../manager/dictionaryManager');
const CH = require('../ipcChannels');

function registerDictionaryHandlers() {
  ipcMain.handle(CH.DICT_GET_ALL, wrapHandler(async () => {
    return { success: true, data: dictionaryManager.getAll() };
  }));

  ipcMain.handle(CH.DICT_ADD, wrapHandler(async (_, { source, target, tag }) => {
    const entry = dictionaryManager.addEntry(source, target, tag);
    return { success: true, data: entry };
  }));

  ipcMain.handle(CH.DICT_UPDATE, wrapHandler(async (_, { id, source, target, tag }) => {
    const entry = dictionaryManager.updateEntry(id, source, target, tag);
    return { success: !!entry, data: entry };
  }));

  ipcMain.handle(CH.DICT_DELETE, wrapHandler(async (_, id) => {
    const ok = dictionaryManager.deleteEntry(id);
    return { success: ok };
  }));

  ipcMain.handle(CH.DICT_EXPORT, wrapHandler(async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    const storageDir = dictionaryManager.getStorageDirectory();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Экспорт словаря',
      defaultPath: storageDir ? path.join(storageDir, 'glossary-export.json') : 'glossary-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false };
    const ok = dictionaryManager.exportToFile(filePath);
    return { success: ok };
  }));

  ipcMain.handle(CH.DICT_IMPORT, wrapHandler(async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    const storageDir = dictionaryManager.getStorageDirectory();
    const dialogOptions = {
      title: 'Импорт словаря',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    };
    if (storageDir) dialogOptions.defaultPath = storageDir;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, dialogOptions);
    if (canceled || !filePaths?.length) return { success: false };
    const data = dictionaryManager.importFromFile(filePaths[0]);
    return data ? { success: true, data } : { success: false };
  }));

  ipcMain.handle(CH.DICT_RESET, wrapHandler(async () => {
    const data = dictionaryManager.resetToDefaults();
    return data ? { success: true, data } : { success: false };
  }));
}

module.exports = { registerDictionaryHandlers };
