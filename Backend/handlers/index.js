const { ipcMain, BrowserWindow } = require('electron');
const CH = require('../ipcChannels');
const { registerModHandlers } = require('./modHandlers');
const { registerProjectHandlers } = require('./projectHandlers');
const { registerTranslatorHandlers } = require('./translatorHandlers');
const { registerXmlHandlers } = require('./xmlHandlers');
const { registerDictionaryHandlers } = require('./dictionaryHandlers');
const { registerOllamaHandlers } = require('./ollamaHandlers');
const { registerAuthHandlers } = require('./authHandlers');
const { registerOnboardingHandlers } = require('./onboardingHandlers');
const { registerUpdateHandlers } = require('./updateHandlers');
const { registerDotNetHandlers } = require('./dotnetHandlers');

function registerWindowHandlers(mainWindow, app) {
  ipcMain.on(CH.WIN_MIN, () => mainWindow?.minimize());
  ipcMain.on(CH.WIN_MAX, () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on(CH.WIN_CLOSE, () => {
    app.isQuitting = true;
    app.quit();
  });

  ipcMain.handle(CH.WIN_OPEN_EXTERNAL, (_event, url) => {
    const win = new BrowserWindow({
      width: 1200,
      height: 820,
      minWidth: 800,
      minHeight: 500,
      parent: mainWindow,
      autoHideMenuBar: true,
      backgroundColor: '#0f0f13',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    win.loadURL(url);
  });
}

function registerAllHandlers({ app, mainWindow, getUserDataPath, services }) {
  const { bg3Manager, smartManager, projectManager, aiManager, updateManager } = services;

  registerWindowHandlers(mainWindow, app);
  registerModHandlers(mainWindow, { bg3Manager });
  registerProjectHandlers(getUserDataPath, { projectManager, bg3Manager });
  registerTranslatorHandlers({ smartManager, aiManager });
  registerXmlHandlers(mainWindow, app);
  registerDictionaryHandlers();
  registerOllamaHandlers({ mainWindow });
  registerAuthHandlers();
  registerOnboardingHandlers(getUserDataPath);
  registerUpdateHandlers({ updateManager });
  registerDotNetHandlers();
}

module.exports = { registerAllHandlers };
