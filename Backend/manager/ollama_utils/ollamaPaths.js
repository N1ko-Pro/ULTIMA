const path = require('path');

const OLLAMA_CUSTOM_DIR = 'Ollama Core';
const OLLAMA_CUSTOM_MODELS_DIR = 'models';

let _baseDir = null;

function setBaseDir(userDataPath) {
  _baseDir = userDataPath;
}

function getCustomOllamaDir() {
  if (_baseDir) return path.join(_baseDir, OLLAMA_CUSTOM_DIR);
  // Fallback: use %APPDATA%\ULTIMA to avoid EPERM in C:\Program Files
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'ULTIMA', OLLAMA_CUSTOM_DIR);
  }
  return path.join(__dirname, '..', '..', OLLAMA_CUSTOM_DIR);
}

function getCustomOllamaModelsDir() {
  return path.join(getCustomOllamaDir(), OLLAMA_CUSTOM_MODELS_DIR);
}

function getCustomOllamaExe() {
  return path.join(getCustomOllamaDir(), 'ollama.exe');
}

function getCustomOllamaUninstaller() {
  return path.join(getCustomOllamaDir(), 'unins000.exe');
}

module.exports = {
  setBaseDir,
  getCustomOllamaDir,
  getCustomOllamaModelsDir,
  getCustomOllamaExe,
  getCustomOllamaUninstaller,
};
