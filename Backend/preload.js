const { contextBridge, ipcRenderer, webUtils } = require('electron');
const CH = require('./ipcChannels');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send(CH.WIN_MIN),
  maximize: () => ipcRenderer.send(CH.WIN_MAX),
  close: () => ipcRenderer.send(CH.WIN_CLOSE),
  openExternal: (url) => ipcRenderer.invoke(CH.WIN_OPEN_EXTERNAL, url),
  getAppVersion: () => ipcRenderer.invoke(CH.APP_GET_VERSION),
  onOsClose: (callback) => {
    ipcRenderer.on(CH.WIN_OS_CLOSE, callback);
    return () => ipcRenderer.removeListener(CH.WIN_OS_CLOSE, callback);
  },

  // Utility: get native FS path for a File object (Electron 32+)
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // BG3 Workflow
  selectModFile: (extensions) => ipcRenderer.invoke(CH.MOD_SELECT, extensions),
  ingestMod: (payload) => ipcRenderer.invoke(CH.MOD_INGEST, payload),

  // Per-game dependencies
  depsCheck: (gameId) => ipcRenderer.invoke(CH.DEPS_CHECK, gameId),
  depsInstall: (gameId, toolId) => ipcRenderer.invoke(CH.DEPS_INSTALL, gameId, toolId),
  onDepsInstallProgress: (callback) => {
    const handler = (_, percent) => callback(percent);
    ipcRenderer.on(CH.DEPS_INSTALL_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.DEPS_INSTALL_PROGRESS, handler);
  },

  // Game integration (install patcher / translations straight into the game)
  gameGetIntegration: (gameId) => ipcRenderer.invoke(CH.GAME_GET_INTEGRATION, gameId),
  gameDetectPath: (gameId) => ipcRenderer.invoke(CH.GAME_DETECT_PATH, gameId),
  gameSetPath: (gameId, dir) => ipcRenderer.invoke(CH.GAME_SET_PATH, { gameId, dir }),
  gameClearPath: (gameId) => ipcRenderer.invoke(CH.GAME_CLEAR_PATH, gameId),
  gamePickPath: (gameId) => ipcRenderer.invoke(CH.GAME_PICK_PATH, gameId),
  gameInstallPatcher: (gameId) => ipcRenderer.invoke(CH.GAME_INSTALL_PATCHER, gameId),
  gameUninstallPatcher: (gameId) => ipcRenderer.invoke(CH.GAME_UNINSTALL_PATCHER, gameId),
  translateStrings: (dataToTranslate, targetLang, options = {}) => ipcRenderer.invoke(CH.TRANSLATE_STRINGS, {
    dataToTranslate,
    targetLang,
    options,
  }),
  abortTranslateStrings: () => ipcRenderer.invoke(CH.TRANSLATE_ABORT),
  repackMod: (payload) => ipcRenderer.invoke(CH.MOD_REPACK, payload),
  onRepackProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(CH.MOD_REPACK_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.MOD_REPACK_PROGRESS, handler);
  },
  openModFolder: (gameId) => ipcRenderer.invoke(CH.MOD_OPEN_FOLDER, gameId),
  saveProject: (projectData) => ipcRenderer.invoke(CH.PROJECT_SAVE, projectData),
  loadProjects: () => ipcRenderer.invoke(CH.PROJECT_LOAD_ALL),
  deleteProject: (id) => ipcRenderer.invoke(CH.PROJECT_DELETE, id),
  loadProject: (projectId) => ipcRenderer.invoke(CH.PROJECT_LOAD, projectId),

  // XML Import/Export
  exportXml: (translations, modInfo, targetLanguage) => ipcRenderer.invoke(CH.XML_EXPORT, translations, modInfo, targetLanguage),
  importXml: () => ipcRenderer.invoke(CH.XML_IMPORT),
  openXmlFolder: () => ipcRenderer.invoke(CH.XML_OPEN_FOLDER),

  // Auth
  authGetState: () => ipcRenderer.invoke(CH.AUTH_GET_STATE),
  authLogin: () => ipcRenderer.invoke(CH.AUTH_LOGIN),
  authLogout: () => ipcRenderer.invoke(CH.AUTH_LOGOUT),
  authRefresh: () => ipcRenderer.invoke(CH.AUTH_REFRESH),
  authSaveLocalName: (name) => ipcRenderer.invoke(CH.AUTH_SAVE_LOCAL_NAME, name),

  // Dictionary / Glossary
  dictionaryGetAll: () => ipcRenderer.invoke(CH.DICT_GET_ALL),
  dictionarySetGame: (gameId) => ipcRenderer.invoke(CH.DICT_SET_GAME, gameId),
  dictionaryAdd: (source, target, tag) => ipcRenderer.invoke(CH.DICT_ADD, { source, target, tag }),
  dictionaryUpdate: (id, source, target, tag) => ipcRenderer.invoke(CH.DICT_UPDATE, { id, source, target, tag }),
  dictionaryDelete: (id) => ipcRenderer.invoke(CH.DICT_DELETE, id),
  dictionaryExport: () => ipcRenderer.invoke(CH.DICT_EXPORT),
  dictionaryImport: () => ipcRenderer.invoke(CH.DICT_IMPORT),
  dictionaryReset: () => ipcRenderer.invoke(CH.DICT_RESET),

  // Settings
  setTranslationMethod: (method) => ipcRenderer.invoke(CH.SETTINGS_SET_METHOD, method),
  setTranslationSettings: (settingsPatch) => ipcRenderer.invoke(CH.SETTINGS_SET_SETTINGS, settingsPatch),
  setTranslationProxyPool: (proxyPool) => ipcRenderer.invoke(CH.SETTINGS_SET_PROXY_POOL, proxyPool),
  setTranslationProxyConfig: (proxyConfig) => ipcRenderer.invoke(CH.SETTINGS_SET_PROXY_CONFIG, proxyConfig),
  clearTranslationProxyPool: () => ipcRenderer.invoke(CH.SETTINGS_CLEAR_PROXY_POOL),
  getTranslationSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET),

  // Onboarding
  onboardingGet: () => ipcRenderer.invoke(CH.ONBOARDING_GET),
  onboardingUpdate: (patch) => ipcRenderer.invoke(CH.ONBOARDING_UPDATE, patch),

  // .NET Runtime
  dotnetCheck: () => ipcRenderer.invoke(CH.DOTNET_CHECK),
  dotnetInstall: () => ipcRenderer.invoke(CH.DOTNET_INSTALL),
  onDotnetInstallProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    ipcRenderer.on(CH.DOTNET_INSTALL_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.DOTNET_INSTALL_PROGRESS, handler);
  },

  // Updater (electron-updater + GitHub)
  updaterGetState: () => ipcRenderer.invoke(CH.UPDATER_GET_STATE),
  updaterCheck: (opts) => ipcRenderer.invoke(CH.UPDATER_CHECK, opts || {}),
  updaterDownload: () => ipcRenderer.invoke(CH.UPDATER_DOWNLOAD),
  updaterInstall: () => ipcRenderer.invoke(CH.UPDATER_INSTALL),
  updaterFinalizeInstall: () => ipcRenderer.invoke(CH.UPDATER_FINALIZE_INSTALL),
  onUpdaterEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(CH.UPDATER_EVENT, handler);
    return () => ipcRenderer.removeListener(CH.UPDATER_EVENT, handler);
  },

  // Ollama (Local AI)
  ollamaGetStatus: () => ipcRenderer.invoke(CH.OLLAMA_GET_STATUS),
  ollamaPullModel: (modelName) => ipcRenderer.invoke(CH.OLLAMA_PULL_MODEL, modelName),
  ollamaDeleteModel: (modelName) => ipcRenderer.invoke(CH.OLLAMA_DELETE_MODEL, modelName),
  ollamaInstall: () => ipcRenderer.invoke(CH.OLLAMA_INSTALL),
  ollamaStartServer: () => ipcRenderer.invoke(CH.OLLAMA_START_SERVER),
  ollamaStopServer: () => ipcRenderer.invoke(CH.OLLAMA_STOP_SERVER),
  ollamaResetContext: (modelName) => ipcRenderer.invoke(CH.OLLAMA_RESET_CONTEXT, modelName),
  ollamaEnsureRunning: () => ipcRenderer.invoke(CH.OLLAMA_ENSURE_RUNNING),
  ollamaUninstall: () => ipcRenderer.invoke(CH.OLLAMA_UNINSTALL),
  ollamaCancelInstall: () => ipcRenderer.invoke(CH.OLLAMA_CANCEL_INSTALL),
  ollamaCancelPullModel: (modelName) => ipcRenderer.invoke(CH.OLLAMA_CANCEL_PULL, modelName),
  onOllamaPullProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(CH.OLLAMA_PULL_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.OLLAMA_PULL_PROGRESS, handler);
  },
  onOllamaInstallProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(CH.OLLAMA_INSTALL_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.OLLAMA_INSTALL_PROGRESS, handler);
  },
  onOllamaStatusChanged: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(CH.OLLAMA_STATUS_CHANGED, handler);
    return () => ipcRenderer.removeListener(CH.OLLAMA_STATUS_CHANGED, handler);
  },
  onTranslationItemProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on(CH.TRANSLATE_ITEM_PROGRESS, handler);
    return () => ipcRenderer.removeListener(CH.TRANSLATE_ITEM_PROGRESS, handler);
  },
});
