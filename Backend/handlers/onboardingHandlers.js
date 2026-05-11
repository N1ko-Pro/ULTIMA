const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { wrapHandler } = require('./handlerUtils');
const CH = require('../ipcChannels');

let configPath = null;
let configCache = null;

function getDefaultConfig() {
  return { eulaAccepted: false, welcomeShown: false, tutorialStartPage: false, tutorialEditor: false, tutorialAutoTranslate: false, tutorialDictionary: false };
}

function loadConfig() {
  if (configCache) return configCache;
  try {
    if (fs.existsSync(configPath)) {
      configCache = { ...getDefaultConfig(), ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
    } else {
      configCache = getDefaultConfig();
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(configCache, null, 2), 'utf-8');
    }
  } catch {
    configCache = getDefaultConfig();
  }
  return configCache;
}

function saveConfig(config) {
  configCache = config;
  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save onboarding config:', err);
  }
}

function registerOnboardingHandlers(getUserDataPath) {
  configPath = path.join(getUserDataPath(), 'onboarding.json');

  ipcMain.handle(CH.ONBOARDING_GET, wrapHandler(async () => {
    return { success: true, data: loadConfig() };
  }));

  ipcMain.handle(CH.ONBOARDING_UPDATE, wrapHandler(async (_, patch) => {
    const config = loadConfig();
    Object.assign(config, patch);
    saveConfig(config);
    return { success: true, data: config };
  }));
}

module.exports = { registerOnboardingHandlers };
