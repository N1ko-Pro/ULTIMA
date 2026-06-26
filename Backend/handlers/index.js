const { ipcMain, BrowserWindow } = require('electron');
const CH = require('../ipcChannels');
const { registerProjectHandlers } = require('./projectHandlers');
const { registerIngestHandlers } = require('./ingestHandlers');
const { registerDependencyHandlers } = require('./dependencyHandlers');
const { registerTranslatorHandlers } = require('./translatorHandlers');
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

  ipcMain.handle(CH.APP_GET_VERSION, () => app.getVersion());

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

function registerAllHandlers({ app, mainWindow, getUserDataPath, games, services }) {
  const { smartManager, projectManager, aiManager, updateManager } = services;

  registerWindowHandlers(mainWindow, app);

  // Per-game IPC handlers (mod ingest/pack, localization import/export, …).
  for (const game of games.listGameModules()) {
    game.registerHandlers({ mainWindow, app });
  }

  registerProjectHandlers(getUserDataPath, { projectManager, games });
  registerIngestHandlers(mainWindow, { games });
  registerDependencyHandlers(mainWindow, { games });
  registerTranslatorHandlers({ smartManager, aiManager });
  registerDictionaryHandlers();
  registerOllamaHandlers({ mainWindow });
  registerAuthHandlers();
  registerOnboardingHandlers(getUserDataPath);
  registerUpdateHandlers({ updateManager });
  registerDotNetHandlers();
}

module.exports = { registerAllHandlers };
