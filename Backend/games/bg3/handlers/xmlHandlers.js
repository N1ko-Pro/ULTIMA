const { ipcMain, shell } = require('electron');
const { wrapHandler } = require('../../../handlers/handlerUtils');
const xmlManager = require('../manager/xmlManager');
const CH = require('../../../ipcChannels');

function registerXmlHandlers(mainWindow, app) {
  ipcMain.handle(CH.XML_EXPORT, wrapHandler(async (_, translations, modInfo, targetLanguage) => {
    return await xmlManager.exportXml(mainWindow, app, translations, modInfo, targetLanguage);
  }));

  ipcMain.handle(CH.XML_IMPORT, wrapHandler(async () => {
    return await xmlManager.importXml(mainWindow, app);
  }));

  // Reveal the XML folder (created on demand) in the OS file manager.
  ipcMain.handle(CH.XML_OPEN_FOLDER, wrapHandler(async () => {
    const dir = xmlManager.ensureXmlDir(app);
    const error = await shell.openPath(dir);
    if (error) return { success: false, error };
    return { success: true, path: dir };
  }));
}

module.exports = { registerXmlHandlers };
