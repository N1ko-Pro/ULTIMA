const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const xmlManager = require('../manager/xmlManager');
const CH = require('../ipcChannels');

function registerXmlHandlers(mainWindow, app) {
  ipcMain.handle(CH.XML_EXPORT, wrapHandler(async (_, translations, modInfo) => {
    return await xmlManager.exportXml(mainWindow, app, translations, modInfo);
  }));

  ipcMain.handle(CH.XML_IMPORT, wrapHandler(async () => {
    return await xmlManager.importXml(mainWindow, app);
  }));
}

module.exports = { registerXmlHandlers };
