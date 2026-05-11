const { contextBridge, ipcRenderer, webUtils } = require('electron');
const CH = require('./ipcChannels');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send(CH.WIN_MIN),
  maximize: () => ipcRenderer.send(CH.WIN_MAX),
  close: () => ipcRenderer.send(CH.WIN_CLOSE),
  openExternal: (url) => ipcRenderer.invoke(CH.WIN_OPEN_EXTERNAL, url),
  onOsClose: (callback) => {
    ipcRenderer.on(CH.WIN_OS_CLOSE, callback);
    return () => ipcRenderer.removeListener(CH.WIN_OS_CLOSE, callback);
  },

  // Utility: get native FS path for a File object (Electron 32+)
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // BG3 Workflow
  selectFile: () => ipcRenderer.invoke(CH.MOD_SELECT_FILE),
  selectPakFile: () => ipcRenderer.invoke(CH.MOD_SELECT_PAK),
  unpackPakFile: (filePath) => ipcRenderer.invoke(CH.MOD_UNPACK_PAK, { filePath }),
  unpackArchiveFile: (filePath, ext) => ipcRenderer.invoke(CH.MOD_UNPACK_ARCHIVE, { filePath, ext }),
  translateStrings: (dataToTranslate, targetLang, options = {}) => ipcRenderer.invoke(CH.TRANSLATE_STRINGS, {
    dataToTranslate,
    targetLang,
    options,
  }),
  abortTranslateStrings: () => ipcRenderer.invoke(CH.TRANSLATE_ABORT),
  repackMod: (updatedData, modName) => ipcRenderer.invoke(CH.MOD_REPACK, { updatedData, modName }),
  openModFolder: () => ipcRenderer.invoke(CH.MOD_OPEN_FOLDER),
  saveProject: (projectData) => ipcRenderer.invoke(CH.PROJECT_SAVE, projectData),
  loadProjects: () => ipcRenderer.invoke(CH.PROJECT_LOAD_ALL),
  deleteProject: (id) => ipcRenderer.invoke(CH.PROJECT_DELETE, id),
  loadProject: (projectId) => ipcRenderer.invoke(CH.PROJECT_LOAD, projectId),

  // XML Import/Export
  exportXml: (translations, modInfo) => ipcRenderer.invoke(CH.XML_EXPORT, translations, modInfo),
  importXml: () => ipcRenderer.invoke(CH.XML_IMPORT),

  // Auth
  authGetState: () => ipcRenderer.invoke(CH.AUTH_GET_STATE),
  authLogin: () => ipcRenderer.invoke(CH.AUTH_LOGIN),
  authLogout: () => ipcRenderer.invoke(CH.AUTH_LOGOUT),
  authRefresh: () => ipcRenderer.invoke(CH.AUTH_REFRESH),
  authSaveLocalName: (name) => ipcRenderer.invoke(CH.AUTH_SAVE_LOCAL_NAME, name),

  // Dictionary / Glossary
  dictionaryGetAll: () => ipcRenderer.invoke(CH.DICT_GET_ALL),
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
