const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-min'),
  maximize: () => ipcRenderer.send('window-max'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onOsClose: (callback) => {
    ipcRenderer.on('os-window-close', callback);
    return () => ipcRenderer.removeListener('os-window-close', callback);
  },

  // Utility: get native FS path for a File object (Electron 32+)
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // BG3 Workflow
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectPakFile: () => ipcRenderer.invoke('select-pak-file'),
  unpackPakFile: (filePath) => ipcRenderer.invoke('unpack-pak-file', { filePath }),
  unpackArchiveFile: (filePath, ext) => ipcRenderer.invoke('unpack-archive-file', { filePath, ext }),
  translateStrings: (dataToTranslate, targetLang, options = {}) => ipcRenderer.invoke('translate-strings', {
    dataToTranslate,
    targetLang,
    options,
  }),
  abortTranslateStrings: () => ipcRenderer.invoke('abort-translate-strings'),
  repackMod: (updatedData) => ipcRenderer.invoke('repack-mod', { updatedData }),
  openModFolder: () => ipcRenderer.invoke('open-mod-folder'),
  saveProject: (projectData) => ipcRenderer.invoke('save-project', projectData),
  loadProjects: () => ipcRenderer.invoke('load-projects'),
  deleteProject: (id) => ipcRenderer.invoke('delete-project', id),
  loadProject: (projectId) => ipcRenderer.invoke('load-project', projectId),
  
  // XML Import/Export
  exportXml: (translations, modInfo) => ipcRenderer.invoke('export-xml', translations, modInfo),
  importXml: () => ipcRenderer.invoke('import-xml'),

  // Auth
  authGetState: () => ipcRenderer.invoke('auth-get-state'),
  authLogin: () => ipcRenderer.invoke('auth-login'),
  authLogout: () => ipcRenderer.invoke('auth-logout'),
  authStartTrial: () => ipcRenderer.invoke('auth-start-trial'),
  authRefresh: () => ipcRenderer.invoke('auth-refresh'),
  authSaveLocalName: (name) => ipcRenderer.invoke('auth-save-local-name', name),

  // Dictionary / Glossary
  dictionaryGetAll: () => ipcRenderer.invoke('dictionary-get-all'),
  dictionaryAdd: (source, target, tag) => ipcRenderer.invoke('dictionary-add', { source, target, tag }),
  dictionaryUpdate: (id, source, target, tag) => ipcRenderer.invoke('dictionary-update', { id, source, target, tag }),
  dictionaryDelete: (id) => ipcRenderer.invoke('dictionary-delete', id),
  dictionaryExport: () => ipcRenderer.invoke('dictionary-export'),
  dictionaryImport: () => ipcRenderer.invoke('dictionary-import'),
  dictionaryReset: () => ipcRenderer.invoke('dictionary-reset'),

  // Settings
  setTranslationMethod: (method) => ipcRenderer.invoke('set-translation-method', method),
  setTranslationSettings: (settingsPatch) => ipcRenderer.invoke('set-translation-settings', settingsPatch),
  setTranslationProxyPool: (proxyPool) => ipcRenderer.invoke('set-translation-proxy-pool', proxyPool),
  setTranslationProxyConfig: (proxyConfig) => ipcRenderer.invoke('set-translation-proxy-config', proxyConfig),
  clearTranslationProxyPool: () => ipcRenderer.invoke('clear-translation-proxy-pool'),
  getTranslationSettings: () => ipcRenderer.invoke('get-translation-settings'),

  // Onboarding
  onboardingGet: () => ipcRenderer.invoke('onboarding-get'),
  onboardingUpdate: (patch) => ipcRenderer.invoke('onboarding-update', patch),

  // .NET Runtime
  dotnetCheck: () => ipcRenderer.invoke('dotnet-check'),
  dotnetInstall: () => ipcRenderer.invoke('dotnet-install'),
  onDotnetInstallProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    ipcRenderer.on('dotnet-install-progress', handler);
    return () => ipcRenderer.removeListener('dotnet-install-progress', handler);
  },

  // Updater (electron-updater + GitHub)
  updaterGetState: () => ipcRenderer.invoke('updater-get-state'),
  updaterCheck: (opts) => ipcRenderer.invoke('updater-check', opts || {}),
  updaterDownload: () => ipcRenderer.invoke('updater-download'),
  updaterInstall: () => ipcRenderer.invoke('updater-install'),
  updaterFinalizeInstall: () => ipcRenderer.invoke('updater-finalize-install'),
  onUpdaterEvent: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('updater-event', handler);
    return () => ipcRenderer.removeListener('updater-event', handler);
  },

  // Ollama (Local AI)
  ollamaGetStatus: () => ipcRenderer.invoke('ollama-get-status'),
  ollamaPullModel: (modelName) => ipcRenderer.invoke('ollama-pull-model', modelName),
  ollamaDeleteModel: (modelName) => ipcRenderer.invoke('ollama-delete-model', modelName),
  ollamaInstall: () => ipcRenderer.invoke('ollama-install'),
  ollamaStartServer: () => ipcRenderer.invoke('ollama-start-server'),
  ollamaStopServer: () => ipcRenderer.invoke('ollama-stop-server'),
  ollamaResetContext: (modelName) => ipcRenderer.invoke('ollama-reset-context', modelName),
  ollamaEnsureRunning: () => ipcRenderer.invoke('ollama-ensure-running'),
  ollamaUninstall: () => ipcRenderer.invoke('ollama-uninstall'),
  ollamaCancelInstall: () => ipcRenderer.invoke('ollama-cancel-install'),
  ollamaCancelPullModel: (modelName) => ipcRenderer.invoke('ollama-cancel-pull-model', modelName),
  onOllamaPullProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ollama-pull-progress', handler);
    return () => ipcRenderer.removeListener('ollama-pull-progress', handler);
  },
  onOllamaInstallProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ollama-install-progress', handler);
    return () => ipcRenderer.removeListener('ollama-install-progress', handler);
  },
  onOllamaStatusChanged: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('ollama-status-changed', handler);
    return () => ipcRenderer.removeListener('ollama-status-changed', handler);
  },
  onTranslationItemProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('translation-item-progress', handler);
    return () => ipcRenderer.removeListener('translation-item-progress', handler);
  },
});
