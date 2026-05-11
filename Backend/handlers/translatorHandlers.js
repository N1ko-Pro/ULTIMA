const { ipcMain } = require('electron');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

function registerTranslatorHandlers({ smartManager, aiManager }) {
  ipcMain.handle(CH.SETTINGS_SET_METHOD, wrapHandler(async (_, method) => {
    smartManager.setMethod(method);
    return { success: true, settings: { ...smartManager.getSettings(), ...aiManager.getSettings() } };
  }));

  ipcMain.handle(CH.SETTINGS_SET_SETTINGS, wrapHandler(async (_, settingsPatch) => {
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

  ipcMain.handle(CH.SETTINGS_SET_PROXY_POOL, wrapHandler(async (_, proxyPool) => {
    const settings = smartManager.setProxyPool(proxyPool);
    return { success: true, settings: { ...settings, ...aiManager.getSettings() } };
  }));

  ipcMain.handle(CH.SETTINGS_SET_PROXY_CONFIG, wrapHandler(async (_, proxyConfig) => {
    const settings = smartManager.setProxyConfig(proxyConfig);
    return { success: true, settings: { ...settings, ...aiManager.getSettings() } };
  }));

  ipcMain.handle(CH.SETTINGS_CLEAR_PROXY_POOL, wrapHandler(async () => {
    const settings = smartManager.clearProxyPool();
    return { success: true, settings: { ...settings, ...aiManager.getSettings() } };
  }));

  ipcMain.handle(CH.SETTINGS_GET, wrapHandler(async () => {
    const settings = { ...smartManager.getSettings(), ...aiManager.getSettings() };
    return { success: true, settings };
  }));
}

module.exports = { registerTranslatorHandlers };
