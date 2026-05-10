const path = require("path");
const { DEFAULT_METHOD } = require("./smart_utils/constantsSmart");
const { GoogleTranslateManager } = require("./smart_utils/googleEngine");
const proxyManager = require("./proxyManager");
const dictionaryManager = require("./dictionaryManager");
const {
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings,
  loadSettingsFromDisk,
  saveSettingsToDisk,
} = require("./smart_utils/settingsStore");

const TRANSLATION_SETTINGS_FILE_NAME = "translation-settings.json";

class SmartManager {
  constructor() {
    this.googleTranslateManager = new GoogleTranslateManager();

    this.generalSettings = { ...DEFAULT_GENERAL_SETTINGS };
    this.smart = { useDictionary: false };
    this.settingsStoragePath = "";
  }

  initializeSettingsStore(userDataPath) {
    if (!userDataPath || typeof userDataPath !== "string") {
      return;
    }

    this.settingsStoragePath = path.join(userDataPath, TRANSLATION_SETTINGS_FILE_NAME);
    const loadedSettings = loadSettingsFromDisk(this.settingsStoragePath, DEFAULT_METHOD);

    this.googleTranslateManager.setMethod(loadedSettings.method);
    this.generalSettings = normalizeGeneralSettings(loadedSettings.general);
    this.smart.useDictionary = loadedSettings.smart?.useDictionary ?? false;
  }

  _persistSettingsToDisk() {
    saveSettingsToDisk(this.settingsStoragePath, {
      method: this.googleTranslateManager.getMethod(),
      smart: {
        useDictionary: this.smart.useDictionary,
      },
      general: {
        ...this.generalSettings,
      },
    });
  }

  setMethod(method) {
    const isChanged = this.googleTranslateManager.setMethod(method);
    if (isChanged) {
      this._persistSettingsToDisk();
    }

    return isChanged;
  }

  setProxyPool(proxyEntries) {
    proxyManager.setPool(proxyEntries || []);
    return this.getSettings();
  }

  setProxyConfig(proxyConfig) {
    proxyManager.setPoolFromConfig(proxyConfig || {});
    return this.getSettings();
  }

  clearProxyPool() {
    proxyManager.clearPool();
    return this.getSettings();
  }

  setSmartUseDictionary(value) {
    const nextValue = Boolean(value);
    if (this.smart.useDictionary === nextValue) return this.getSettings();
    this.smart.useDictionary = nextValue;
    this._persistSettingsToDisk();
    return this.getSettings();
  }

  setGeneralSettings(generalPatch) {
    this.generalSettings = normalizeGeneralSettings({
      ...this.generalSettings,
      ...(generalPatch || {}),
    });
    this._persistSettingsToDisk();
    return this.getSettings();
  }

  updateSettings(settingsPatch = {}) {
    const nextMethod = settingsPatch?.method;
    if (nextMethod !== undefined) {
      this.setMethod(nextMethod);
    }

    if (settingsPatch?.smart?.useDictionary !== undefined) {
      this.setSmartUseDictionary(settingsPatch.smart.useDictionary);
    }

    if (settingsPatch?.general !== undefined) {
      this.setGeneralSettings(settingsPatch.general);
    }

    return this.getSettings();
  }

  getSettings() {
    const runtimeSettings = this.googleTranslateManager.getRuntimeSettings();

    return {
      ...runtimeSettings,
      smart: {
        useDictionary: this.smart.useDictionary,
      },
      general: {
        ...this.generalSettings,
      },
    };
  }

  async translateBatchWithRetry(dataToTranslate, targetLang, options = {}) {
    const useDictionary = options.useDictionary !== false;
    if (useDictionary) {
      const protectedData = {};
      const glossaryMaps = {};
      for (const [id, text] of Object.entries(dataToTranslate || {})) {
        const { protected: protectedText, map } = dictionaryManager.protectInText(text);
        protectedData[id] = protectedText;
        glossaryMaps[id] = map;
      }

      const result = await this.googleTranslateManager.translateBatchWithRetry(protectedData, targetLang, options);
      if (result && typeof result === 'object') {
        const processed = {};
        for (const [id, text] of Object.entries(result)) {
          processed[id] = dictionaryManager.restoreFromMap(text, glossaryMaps[id] || {});
        }
        return processed;
      }
      return result;
    }

    return await this.googleTranslateManager.translateBatchWithRetry(dataToTranslate, targetLang, options);
  }
}

module.exports = new SmartManager();
