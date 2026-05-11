const { spawn, exec } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {
  getCustomOllamaDir,
  getCustomOllamaModelsDir,
  getCustomOllamaUninstaller,
} = require('./ollamaPaths');
const { stopOllamaProcesses } = require('./ollamaProcess');

/**
 * Download a file with redirect support, progress reporting, cancellation, and integrity verification.
 * @param {string} url
 * @param {string} destPath
 * @param {function} onProgress  — called with { percent, speedMBps }
 * @param {{ cancelled, request }} cancelCtrl — shared cancellation object
 */
function downloadFile(url, destPath, onProgress, cancelCtrl = {}) {
  // Helper function to clean up downloaded file
  const cleanupDownloadedFile = () => {
    try { fs.unlinkSync(destPath); } catch { /* ignore */ }
  };

  return new Promise((resolve, reject) => {
    let redirectCount = 0;
    let attempt = 0;
    const maxAttempts = 5;
    const retryDelayMs = 2000;
    const retryStatusCodes = new Set([408, 429, 500, 502, 503, 504]);
    const transientNetworkCodes = new Set([
      'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED', 'EHOSTUNREACH', 'ECONNABORTED', 'HPE_HEADER_OVERFLOW',
    ]);

    const scheduleRetry = (requestUrl) => {
      if (cancelCtrl.cancelled) { reject(new Error('INSTALL_CANCELLED')); return false; }
      attempt += 1;
      if (attempt < maxAttempts) {
        const delay = retryDelayMs * attempt;
        setTimeout(() => makeRequest(requestUrl), delay);
        return true;
      }
      return false;
    };

    const makeRequest = (requestUrl) => {
      if (cancelCtrl.cancelled) { reject(new Error('INSTALL_CANCELLED')); return; }
      if (redirectCount > 10) { reject(new Error('TOO_MANY_REDIRECTS')); return; }

      let downloadFinished = false;

      const protocol = requestUrl.startsWith('https') ? https : http;
      const request = protocol.get(
        requestUrl,
        { headers: { 'User-Agent': 'BG3-ULTIMA-Translator/2.0' } },
        (response) => {
          if (cancelCtrl.cancelled) { response.destroy(); reject(new Error('INSTALL_CANCELLED')); return; }

          const REDIRECT_CODES = [301, 302, 303, 307, 308];
          if (REDIRECT_CODES.includes(response.statusCode) && response.headers.location) {
            redirectCount += 1;
            response.resume();
            makeRequest(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            if (retryStatusCodes.has(response.statusCode) && scheduleRetry(requestUrl)) {
              response.resume();
              return;
            }
            reject(new Error(`DOWNLOAD_HTTP_${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloaded = 0;
          let speedWindowBytes = 0;
          let speedWindowStart = Date.now();
          let speedMBps = 0;
          const fileStream = fs.createWriteStream(destPath);

          response.on('data', (chunk) => {
            if (cancelCtrl.cancelled) {
              response.destroy();
              fileStream.destroy();
              reject(new Error('INSTALL_CANCELLED'));
              return;
            }
            downloaded += chunk.length;
            speedWindowBytes += chunk.length;

            const now = Date.now();
            const elapsed = now - speedWindowStart;
            if (elapsed >= 500) {
              speedMBps = (speedWindowBytes / elapsed) * 1000 / (1024 * 1024);
              speedWindowBytes = 0;
              speedWindowStart = now;
            }

            if (totalSize > 0) {
              onProgress?.({ percent: Math.round((downloaded / totalSize) * 100), speedMBps });
            }
          });

          response.pipe(fileStream);
          response.on('error', (ERR) => {
            fileStream.destroy();
            cleanupDownloadedFile();
            if (cancelCtrl.cancelled) reject(new Error('INSTALL_CANCELLED'));
            else reject(ERR);
          });
          fileStream.on('finish', () => {
            downloadFinished = true;
            if (cancelCtrl.cancelled) {
              cleanupDownloadedFile();
              reject(new Error('INSTALL_CANCELLED'));
              return;
            }
            fileStream.close(() => {
              // Verify file was downloaded and has content
              try {
                const stats = fs.statSync(destPath);
                if (stats.size === 0) {
                  cleanupDownloadedFile();
                  reject(new Error('DOWNLOAD_EMPTY'));
                } else {
                  resolve();
                }
              } catch (ERR) {
                cleanupDownloadedFile();
                reject(ERR);
              }
            });
          });
          fileStream.on('error', (ERR) => {
            cleanupDownloadedFile();
            reject(ERR);
          });
        }
      );

      cancelCtrl.request = request;
      request.on('error', (err) => {
        if (downloadFinished) return;
        if (cancelCtrl.cancelled) {
          cleanupDownloadedFile();
          reject(new Error('INSTALL_CANCELLED'));
          return;
        }
        if (err?.code && transientNetworkCodes.has(err.code) && scheduleRetry(requestUrl)) {
          return;
        }
        cleanupDownloadedFile();
        reject(err);
      });
    };

    makeRequest(url);
  });
}

/**
 * Robust cleanup of a partial custom Ollama install.
 * Stops all Ollama processes, runs the custom uninstaller if available, then wipes the managed directory.
 * @param {object} options
 * @param {boolean} options.skipDelay - skip initial delay if process already confirmed dead
 */
async function cleanupPartialInstall({ skipDelay = false } = {}) {
  const customOllamaDir = getCustomOllamaDir();
  const customUninstaller = getCustomOllamaUninstaller();

  await stopOllamaProcesses();

  if (!skipDelay) await new Promise((r) => setTimeout(r, 3000));

  if (fs.existsSync(customUninstaller)) {
    try {
      await new Promise((resolve) => {
        const ps = spawn('powershell', [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-Command',
          `Start-Process -FilePath '${customUninstaller.replace(/'/g, "''")}' -ArgumentList '/VERYSILENT','/NORESTART','/SUPPRESSMSGBOXES' -Verb RunAs -Wait`
        ], { windowsHide: true });
        ps.on('close', () => resolve());
        ps.on('error', () => resolve());
      });
    } catch { /* best effort */ }
  }

  await new Promise((r) => setTimeout(r, 2000));

  if (fs.existsSync(customOllamaDir)) {
    try {
      fs.rmSync(customOllamaDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
    } catch {
      try {
        await new Promise((resolve) => {
          exec(`icacls "${customOllamaDir}" /grant "${process.env.USERNAME}":F /T /C /Q`, { windowsHide: true }, () => resolve());
        });
        await new Promise((r) => setTimeout(r, 500));
        fs.rmSync(customOllamaDir, { recursive: true, force: true });
      } catch { /* best effort */ }
    }
  }
}

/**
 * Download and silently install Ollama on Windows.
 * Improved stability with simplified cancellation, better error handling, and validation.
 *
 * @param {object} opts
 * @param {function} opts.onProgress       — called with progress events
 * @param {{ cancelled, request, process }} opts.cancelCtrl — shared mutable cancellation object
 * @param {function} opts.getStatus        — async fn from OllamaManager
 * @param {function} opts.startServer       — async fn to start server
 * @returns {object}  status object, or { cancelled: true }
 */
async function installOllama({ onProgress, cancelCtrl, getStatus, startServer } = {}) {
  if (process.platform !== 'win32') throw new Error('UNSUPPORTED_PLATFORM');

  // Use unique temp filename to avoid conflicts
  const tempId = crypto.randomBytes(8).toString('hex');
  const installerPath = path.join(os.tmpdir(), `OllamaSetup_${tempId}.exe`);
  const downloadUrl = 'https://ollama.com/download/OllamaSetup.exe';
  const startedSignalPath = path.join(os.tmpdir(), `bg3_ollama_started_${tempId}.signal`);

  // Custom installation directory
  const customInstallDir = getCustomOllamaDir();
  const CUSTOM_MODELS_DIR = getCustomOllamaModelsDir();

  // Create custom directory if it doesn't exist
  if (!fs.existsSync(customInstallDir)) {
    fs.mkdirSync(customInstallDir, { recursive: true });
  }

  // Track cleanup tasks
  const cleanupTasks = [];
  const addCleanup = (fn) => cleanupTasks.push(fn);
  const runCleanup = async () => {
    for (const task of cleanupTasks) {
      try { await task(); } catch { /* ignore */ }
    }
  };

  try {
    // ── Phase 1: Download ────────────────────────────────────────────────────
    onProgress?.({ phase: 'downloading', percent: 0, message: 'Загрузка установщика Ollama...' });
    addCleanup(() => fs.promises.unlink(installerPath).catch(() => {}));

    await downloadFile(downloadUrl, installerPath, ({ percent, speedMBps }) => {
      if (cancelCtrl.cancelled) return;
      onProgress?.({ phase: 'downloading', percent, speedMBps, message: `Загрузка установщика... ${percent}%` });
    }, cancelCtrl);

    if (cancelCtrl.cancelled) {
      await runCleanup();
      return { cancelled: true };
    }

    // Verify installer file integrity
    const installerStats = fs.statSync(installerPath);
    if (installerStats.size < 1024 * 1024) { // Less than 1MB is suspicious
      throw new Error('DOWNLOAD_CORRUPTED: Загруженный файл повреждён или слишком мал.');
    }

    // ── Phase 2: Silent install via direct PowerShell command ───────────────
    onProgress?.({ phase: 'elevating', percent: 100, message: 'Подтвердите запрос прав администратора (UAC)...' });

    const UAC_DECLINED_CODE = 98;
    const CANCEL_CODE = 99;
    const signalPath = path.join(os.tmpdir(), `bg3_ollama_cancel_${tempId}.signal`);
    const scriptPath = path.join(os.tmpdir(), `bg3_ollama_install_${tempId}.ps1`);

    try { fs.unlinkSync(signalPath); } catch { /* ignore stale */ }
    try { fs.unlinkSync(startedSignalPath); } catch { /* ignore stale */ }
    cancelCtrl.signalPath = signalPath;
    cancelCtrl.installerPath = installerPath;
    addCleanup(() => fs.promises.unlink(scriptPath).catch(() => {}));
    addCleanup(() => fs.promises.unlink(signalPath).catch(() => {}));
    addCleanup(() => fs.promises.unlink(startedSignalPath).catch(() => {}));

    fs.writeFileSync(scriptPath, [
      `$sig = '${signalPath.replace(/'/g, "''")}'`,
      `$started = '${startedSignalPath.replace(/'/g, "''")}'`,
      `$installer = '${installerPath.replace(/'/g, "''")}'`,
      `$installDir = '${customInstallDir.replace(/'/g, "''")}'`,
      `$p = Start-Process -PassThru -FilePath $installer -ArgumentList @('/VERYSILENT','/NORESTART','/SUPPRESSMSGBOXES',('/DIR="' + $installDir + '"'))`,
      `New-Item -Path $started -ItemType File -Force | Out-Null`,
      `while (-not $p.HasExited) {`,
      `  if (Test-Path $sig) {`,
      `    taskkill /f /t /pid $($p.Id) 2>$null`,
      `    Start-Sleep -Milliseconds 800`,
      `    if (Test-Path $installDir) { Remove-Item -Path $installDir -Recurse -Force -ErrorAction SilentlyContinue }`,
      `    Remove-Item $sig -Force -ErrorAction SilentlyContinue`,
      `    exit ${CANCEL_CODE}`,
      `  }`,
      `  Start-Sleep -Milliseconds 300`,
      `}`,
      `if ($p.ExitCode -eq 0) {`,
      `  Start-Sleep -Milliseconds 2000`,
      `  Get-Process | Where-Object { $_.Name -match '^ollama' } | Stop-Process -Force -ErrorAction SilentlyContinue`,
      `  Start-Sleep -Milliseconds 1000`,
      `  Get-Process | Where-Object { $_.Name -match '^ollama' } | Stop-Process -Force -ErrorAction SilentlyContinue`,
      `}`,
      `exit $p.ExitCode`,
    ].join('\r\n'), 'utf8');

    const escapedScript = scriptPath.replace(/'/g, "''");
    const installerExitCode = await new Promise((resolve) => {
      const ps = spawn('powershell', [
        '-NoProfile', '-NonInteractive',
        '-Command',
        `try { $p = Start-Process -Verb RunAs -PassThru -WindowStyle Hidden -FilePath powershell -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','${escapedScript}'); $p.WaitForExit(); exit $p.ExitCode } catch { exit ${UAC_DECLINED_CODE} }`,
      ], { windowsHide: true });

      cancelCtrl.process = ps;

      ps.on('close', (code) => resolve(code ?? -1));
      ps.on('error', () => resolve(-1));

      // Poll for started signal file to detect when installer actually starts
      const checkSignal = () => {
        if (fs.existsSync(startedSignalPath)) {
          if (!cancelCtrl.cancelled) {
            onProgress?.({ phase: 'installing', percent: 0, message: 'Установка Ollama' });
          }
        } else if (!cancelCtrl.cancelled) {
          setTimeout(checkSignal, 500);
        }
      };
      setTimeout(checkSignal, 1000);

      // Fallback: if no signal received after 10 seconds, assume UAC was approved
      setTimeout(() => {
        if (!cancelCtrl.cancelled) {
          onProgress?.({ phase: 'installing', percent: 0, message: 'Установка Ollama' });
        }
      }, 10000);
    });

    if (cancelCtrl.cancelled) {
      await runCleanup();
      await cleanupPartialInstall({ skipDelay: true });
      return { cancelled: true };
    }

    // UAC was declined by user
    if (installerExitCode === UAC_DECLINED_CODE) {
      await runCleanup();
      return { cancelled: true };
    }

    // ── Phase 3: Post-install validation ─────────────────────────────────────
    onProgress?.({ phase: 'validating', percent: 100, message: 'Проверка установки...' });

    const status = await getStatus();

    // Only treat as failure if validation fails, regardless of exit code
    // Some installers return non-zero exit codes even on success (e.g., reboot required)
    if (!status.installed) {
      await runCleanup();
      await cleanupPartialInstall();
      throw new Error(`INSTALL_VALIDATION_FAILED: Ollama не найден после установки. Код выхода: ${installerExitCode}`);
    }

    // ── Phase 4: Start server immediately ────────────────────────────────────
    if (startServer) {
      onProgress?.({ phase: 'starting', percent: 0, message: 'Настройка сервера Ollama...' });
      try {
        // Set OLLAMA_MODELS environment variable for this process
        process.env.OLLAMA_MODELS = CUSTOM_MODELS_DIR;
        await startServer({
          onProgress: (progress) => {
            onProgress?.({ phase: 'starting', percent: progress.percent, message: progress.message });
          }
        });
        // Give server a moment to start
        await new Promise(r => setTimeout(r, 1000));
        onProgress?.({ phase: 'starting', percent: 100, message: 'Сервер запущен!' });
      } catch (err) {
        // Don't fail the entire install if server start fails
        // User can manually start server later
        console.warn('Server auto-start failed:', err.message);
        onProgress?.({ phase: 'starting', percent: 100, message: 'Настройка завершена' });
      }
    }

    await runCleanup();
    onProgress?.({ phase: 'complete', percent: 100, message: 'Ollama успешно установлен!' });

    // Return updated status
    return await getStatus();
  } catch (err) {
    await runCleanup();
    
    if (err.message === 'INSTALL_CANCELLED' || cancelCtrl.cancelled) {
      return { cancelled: true };
    }
    
    if (err.message === 'DOWNLOAD_CORRUPTED') {
      throw new Error('Загруженный файл повреждён. Попробуйте загрузить снова.');
    }
    
    if (err.message === 'DOWNLOAD_EMPTY') {
      throw new Error('Ошибка загрузки: файл пуст. Проверьте подключение к интернету.');
    }
    
    if (err.message === 'INSTALL_VALIDATION_FAILED') {
      throw new Error('Установка прошла, но Ollama не найден. Попробуйте установить вручную.');
    }
    
    if (typeof err.message === 'string' && err.message.startsWith('DOWNLOAD_HTTP_')) {
      const httpCode = err.message.split('_')[2];
      const messageMap = {
        '404': 'Ошибка загрузки: файл не найден на сервере Ollama.',
        '500': 'Ошибка загрузки: внутренний сбой сервера Ollama. Попробуйте позже.',
        '502': 'Ошибка загрузки: плохой ответ от сервера. Попробуйте позже.',
        '503': 'Ошибка загрузки: сервис временно недоступен. Попробуйте позже.',
        '504': 'Ошибка загрузки: сервер не отвечает. Проверьте подключение и повторите.',
      };
      throw new Error(messageMap[httpCode] || `Ошибка загрузки: HTTP ${httpCode}.`);
    }
    
    throw err;
  }
}

module.exports = { installOllama };
