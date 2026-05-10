const { exec, spawn } = require('child_process');
const fs = require('fs');
const { getCustomOllamaDir, getCustomOllamaUninstaller } = require('./ollamaPaths');
const { stopOllamaProcesses } = require('./ollamaProcess');
/**
 * Silently uninstall Ollama on Windows.
 * Stops the server first, then runs the Inno Setup uninstaller with UAC elevation.
 *
 * @param {object} opts
 * @param {function} opts.onProgress      — called with progress events
 * @returns {{ installed: false, running: false, models: [] }}
 */
async function uninstallOllama({ onProgress } = {}) {
  if (process.platform !== 'win32') throw new Error('UNSUPPORTED_PLATFORM');

  const customOllamaDir = getCustomOllamaDir();
  const customUninstaller = getCustomOllamaUninstaller();

  // ── Step 1: Stop running Ollama processes ────────────────────────────────
  onProgress?.({ phase: 'stopping', message: 'Остановка сервера Ollama...' });
  await stopOllamaProcesses();
  await new Promise((r) => setTimeout(r, 2000));

  // ── Step 2: Run uninstaller from custom directory if it exists ────────────
  if (fs.existsSync(customUninstaller)) {
    onProgress?.({ phase: 'uninstalling', message: 'Запуск деинсталлятора Ollama...' });
    try {
      const escaped = customUninstaller.replace(/'/g, "''");
      const psCommand = `Start-Process -FilePath '${escaped}' -ArgumentList '/VERYSILENT','/NORESTART' -Verb RunAs -Wait`;
      await new Promise((resolve) => {
        const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCommand], { windowsHide: true });
        ps.on('close', () => resolve());
        ps.on('error', () => resolve());
      });
      // Wait for uninstaller to complete
      await new Promise((r) => setTimeout(r, 3000));
    } catch {
      // Continue with manual cleanup if uninstaller fails
    }
  }

  // ── Step 3: Remove custom Ollama directory (includes executable and models) ─
  onProgress?.({ phase: 'removing', message: 'Удаление файлов Ollama...' });

  if (fs.existsSync(customOllamaDir)) {
    try {
      fs.rmSync(customOllamaDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch (err) {
      // If graceful delete fails, try to unlock and delete
      try {
        await new Promise((resolve) => {
          exec(`icacls "${customOllamaDir}" /grant "${process.env.USERNAME}":F /T /C /Q`, { windowsHide: true }, () => resolve());
        });
        await new Promise((r) => setTimeout(r, 500));
        fs.rmSync(customOllamaDir, { recursive: true, force: true });
      } catch {
        // Best effort - log would go here
        console.warn('Failed to remove custom Ollama directory:', err.message);
      }
    }
  }

  return { installed: false, running: false, models: [] };
}

module.exports = { uninstallOllama };
