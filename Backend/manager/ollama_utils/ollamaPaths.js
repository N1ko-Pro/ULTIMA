const path = require('path');

const OLLAMA_CUSTOM_DIR = 'Ollama Core';
const OLLAMA_CUSTOM_MODELS_DIR = 'models';

function getCustomOllamaDir() {
  const appDir = path.join(__dirname, '..', '..');
  return path.join(appDir, OLLAMA_CUSTOM_DIR);
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
  getCustomOllamaDir,
  getCustomOllamaModelsDir,
  getCustomOllamaExe,
  getCustomOllamaUninstaller,
};
