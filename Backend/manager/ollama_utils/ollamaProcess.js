const { exec } = require('child_process');

const WINDOWS_OLLAMA_TASKKILL = 'taskkill /f /t /im "ollama app.exe" 2>nul & taskkill /f /t /im ollama_llama_server.exe 2>nul & taskkill /f /t /im ollama.exe 2>nul';

function stopOllamaProcesses() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(WINDOWS_OLLAMA_TASKKILL, { windowsHide: true }, () => resolve());
    } else {
      exec("pkill -f 'ollama serve'", () => resolve());
    }
  });
}

module.exports = { stopOllamaProcesses };
