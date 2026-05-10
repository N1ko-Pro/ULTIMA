const { exec } = require('child_process');
const { stopOllamaProcesses } = require('./ollamaProcess');

/**
 * Start the Ollama server in the background and wait for it to bind.
 *
 * @param {object} opts
 * @param {function} opts.getStatus      — async fn from OllamaManager
 * @param {function} opts.onProgress    — optional callback for progress updates
 * @returns {object} status object
 */
function startServer({ getStatus, ollamaExec = 'ollama', onProgress } = {}) {
  return new Promise((resolve) => {
    const command = process.platform === 'win32'
      ? `start /b "" "${ollamaExec}" serve`
      : `${ollamaExec} serve &`;

    exec(command, { windowsHide: true }, () => {
      // Ignore exit code — fails harmlessly if already running
    });

    const checkStatus = async (attempt = 0) => {
      const status = await getStatus();
      const messages = [
        'Инициализация сервера...',
        'Подготовка окружения...',
        'Загрузка конфигурации...',
        'Запуск службы...',
        'Проверка соединения...',
        'Инициализация GPU...',
        'Последние штрихи...'
      ];
      const messageIndex = Math.min(Math.floor(attempt / 2), messages.length - 1);

      if (status.running && messageIndex >= messages.length - 1) {
        // Server is ready and we've reached the final message
        if (onProgress) {
          onProgress({ percent: 100, message: messages[messages.length - 1] });
        }
        resolve(status);
      } else if (attempt >= 20) {
        // Timeout - show final message at 100%
        if (onProgress) {
          onProgress({ percent: 100, message: messages[messages.length - 1] });
        }
        resolve(status);
      } else {
        // Report progress during startup attempts
        if (onProgress) {
          const percent = Math.min(Math.round((attempt / 14) * 100), 95);
          onProgress({ percent, message: messages[messageIndex] });
        }
        setTimeout(() => checkStatus(attempt + 1), 500);
      }
    };

    checkStatus(0);
  });
}

/**
 * Stop the Ollama server process to free GPU memory.
 */
function stopServer() {
  return stopOllamaProcesses();
}

module.exports = { startServer, stopServer };
