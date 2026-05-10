const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const xmlManager = require('../manager/xmlManager');

function registerXmlHandlers(mainWindow, app) {
  ipcMain.handle('export-xml', wrapHandler(async (_, translations, modInfo) => {
    return await xmlManager.exportXml(mainWindow, app, translations, modInfo);
  }));

  ipcMain.handle('import-xml', wrapHandler(async () => {
    return await xmlManager.importXml(mainWindow, app);
  }));
}

module.exports = { registerXmlHandlers };
