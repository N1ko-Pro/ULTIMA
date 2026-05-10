const fs = require("fs");

const DEFAULT_GENERAL_SETTINGS = {
  appLanguage: "ru",
  autoUpdateEnabled: true,
};

function normalizeGeneralSettings(general) {
  const appLanguage = typeof general?.appLanguage === "string" && general.appLanguage.trim()
    ? general.appLanguage.trim().toLowerCase()
    : DEFAULT_GENERAL_SETTINGS.appLanguage;

  const autoUpdateEnabled = general?.autoUpdateEnabled !== undefined 
    ? Boolean(general.autoUpdateEnabled)
    : DEFAULT_GENERAL_SETTINGS.autoUpdateEnabled;

  return {
    appLanguage,
    autoUpdateEnabled,
  };
}

function normalizeOllamaSettings(ollama) {
  const model = typeof ollama?.model === 'string' ? ollama.model.trim() : '';
  return { model };
}

function buildDefaultSettings(method) {
  return {
    method,
    ollama: normalizeOllamaSettings(),
    general: { ...DEFAULT_GENERAL_SETTINGS },
  };
}

function loadSettingsFromDisk(settingsStoragePath, fallbackMethod) {
  const defaults = buildDefaultSettings(fallbackMethod);

  if (!settingsStoragePath || !fs.existsSync(settingsStoragePath)) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(settingsStoragePath, "utf8"));

    return {
      method: typeof parsed?.method === "string" ? parsed.method : defaults.method,
      ollama: normalizeOllamaSettings(parsed?.ollama),
      general: normalizeGeneralSettings(parsed?.general),
      smart: {
        useDictionary: typeof parsed?.smart?.useDictionary === "boolean"
          ? parsed.smart.useDictionary
          : false,
      },
      local: {
        useDictionary: typeof parsed?.local?.useDictionary === "boolean"
          ? parsed.local.useDictionary
          : true,
      },
    };
  } catch (error) {
    console.warn("Failed to load translation settings:", error?.message || error);
    return defaults;
  }
}

function saveSettingsToDisk(settingsStoragePath, settings) {
  if (!settingsStoragePath) {
    return;
  }

  try {
    fs.writeFileSync(settingsStoragePath, JSON.stringify(settings, null, 2), "utf8");
  } catch (error) {
    console.warn("Failed to persist translation settings:", error?.message || error);
  }
}

module.exports = {
  DEFAULT_GENERAL_SETTINGS,
  normalizeGeneralSettings,
  loadSettingsFromDisk,
  saveSettingsToDisk,
};
