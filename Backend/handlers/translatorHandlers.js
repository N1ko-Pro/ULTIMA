const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');

function registerTranslatorHandlers({ smartManager, aiManager }) {
  ipcMain.handle('set-translation-method', wrapHandler(async (_, method) => {
    smartManager.setMethod(method);
    return { success: true, settings: { ...smartManager.getSettings(), ...aiManager.getSettings() } };
  }));

  ipcMain.handle('set-translation-settings', wrapHandler(async (_, settingsPatch) => {
    // Route AI-related settings to aiManager
    if (settingsPatch?.ollama?.model !== undefined || settingsPatch?.local?.useDictionary !== undefined) {
      aiManager.updateSettings(settingsPatch);
    }
    // Route Smart-related settings to smartManager
    if (settingsPatch?.method !== undefined || settingsPatch?.smart?.useDictionary !== undefined || settingsPatch?.general !== undefined) {
      smartManager.updateSettings(settingsPatch);
    }
    const settings = { ...smartManager.getSettings(), ...aiManager.getSettings() };
    return { success: true, settings };
  }));

  ipcMain.handle('set-translation-proxy-pool', wrapHandler(async (_, proxyPool) => {
    const settings = smartManager.setProxyPool(proxyPool);
    return { success: true, settings: { ...settings, ...aiManager.getSettings() } };
  }));

  ipcMain.handle('set-translation-proxy-config', wrapHandler(async (_, proxyConfig) => {
    const settings = smartManager.setProxyConfig(proxyConfig);
    return { success: true, settings: { ...settings, ...aiManager.getSettings() } };
  }));

  ipcMain.handle('clear-translation-proxy-pool', wrapHandler(async () => {
    const settings = smartManager.clearProxyPool();
    return { success: true, settings: { ...settings, ...aiManager.getSettings() } };
  }));

  ipcMain.handle('get-translation-settings', wrapHandler(async () => {
    const settings = { ...smartManager.getSettings(), ...aiManager.getSettings() };
    return { success: true, settings };
  }));
}

module.exports = { registerTranslatorHandlers };
