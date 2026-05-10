const http = require('http');
const { toSafeString } = require('../shared_utils/textUtils');
const {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_API_CHAT,
  DEFAULT_OLLAMA_TEMPERATURE,
} = require('./constantsAI');

/**
 * Strip self-chat artifacts, broken stop tokens, and hallucinated commentary
 * that small models sometimes produce. Applied to every translation response.
 */
function sanitizeTranslationResponse(text) {
  let t = text;

  // Leaked stop tokens
  t = t.replace(/\|?\s*<\|?im_end\|?>\s*/gi, '');
  t = t.replace(/<\|im_start\|>[\s\S]*/gi, '');
  t = t.replace(/<\/s\s*>[\s\S]*/gi, '');

  // Leading translation prefixes ("Перевод:", "Translation:", etc.)
  t = t.replace(/^(?:Перевод|Translation|Вот перевод|Here is the translation)\s*[:：]\s*/i, '');

  // Wrapping quotes
  t = t.replace(/^["«»""](.+)["«»""]$/s, '$1');

  // Everything after self-chat indicators
  const selfChatPatterns = [
    /\n\s*```[\s\S]*/,
    /\n\s*(?:IN|Input|Source|Вход)\s*[:：]\s/i,
    /\n\s*(?:OUT|Output|Target|Выход)\s*[:：]\s/i,
    /\n\s*(?:Примечание|Note|Обратите внимание|Пояснение|Перевод|Теперь|Давайте|Это перевод|Этот ответ|Я перевёл|Вот перевод)\s*[:：\s]/i,
    /\n\s*<b>\s*(?:Примечание|Note|Обратите внимание|Пояснение)\s*[:：]?\s*<\/b>/i,
    /\n\s*#{1,3}\s/,
    /\n\s*\((?:Обратите|Note|Примечание|Прим)/i,
    /\n\s*---\s*\n/,
    /\n\s*\*{3,}\s*\n/,
  ];
  for (const pat of selfChatPatterns) t = t.replace(pat, '');

  // Trailing parenthetical notes: (Исправил падеж...), (Теги сохранены...), etc.
  t = t.replace(/\n\s*\([А-ЯЁA-Z][^)]{4,}\)\s*$/i, '');

  // Common Saiga typo: "исполз" → "использ"
  t = t.replace(/исполз/gi, 'использ');

  return t.trim();
}

/**
 * Send a chat completion request to Ollama and return the sanitized response.
 *
 * Model parameter rationale (ALMA/WMT research):
 * - temperature 0.1–0.3: low creativity, high accuracy for translation
 * - top_p 0.9, top_k 20, min_p 0.05: balanced sampling without noise
 * - repeat_penalty 1.05: light penalty; 1.1+ causes unnatural synonym avoidance
 * - num_ctx 4096 / num_predict 2048: enough for glossary + few-shot + game text
 */
async function requestOllamaChatCompletion({
  model,
  messages,
  temperature = DEFAULT_OLLAMA_TEMPERATURE,
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
  timeoutMs = 300000,
  abortSignal = null,
}) {
  const bodyStr = JSON.stringify({
    model,
    messages,
    stream: true,
    think: false,
    options: {
      temperature,
      top_p: 0.9,
      top_k: 20,
      min_p: 0.05,
      repeat_penalty: 1.05,
      num_ctx: 4096,
      num_predict: 2048,
      stop: ['<|im_start|>', '<|im_end|>', '###', '```', '\nIN:', '\nInput:', '\nSource:', '\nВход:', '\nПримечание:', '\nNote:'],
    },
  });

  const rawText = await new Promise((resolve, reject) => {
    if (abortSignal?.aborted) return reject(new Error('ABORTED'));

    const url = new URL(`${baseUrl}${OLLAMA_API_CHAT}`);
    let req = null;
    let isResolved = false;

    const cleanup = () => {
      if (req && !req.destroyed) {
        try {
          req.destroy();
        } catch { /* ignore cleanup errors */ }
      }
    };

    req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
        'Connection': 'close', // Force connection close to prevent pooling issues
      },
    }, (res) => {
      if (res.statusCode === 404) {
        cleanup();
        isResolved = true;
        return reject(new Error('OLLAMA_MODEL_NOT_FOUND'));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const errChunks = [];
        res.on('data', (c) => errChunks.push(c));
        res.on('end', () => {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`OLLAMA_HTTP_${res.statusCode}: ${Buffer.concat(errChunks).toString().slice(0, 400)}`));
          }
        });
        res.on('error', (err) => {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        });
        return;
      }

      let lineBuffer = '';
      let fullContent = '';

      res.on('data', (chunk) => {
        lineBuffer += chunk.toString('utf8');
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.message?.content) fullContent += obj.message.content;
          } catch { /* partial JSON, skip */ }
        }
      });

      res.on('end', () => {
        // Process any remaining data in the line buffer
        if (lineBuffer.trim()) {
          try {
            const obj = JSON.parse(lineBuffer);
            if (obj.message?.content) fullContent += obj.message.content;
          } catch { /* partial JSON, skip */ }
        }
        cleanup();
        if (!isResolved) {
          isResolved = true;
          resolve(fullContent);
        }
      });

      res.on('error', (err) => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        if (abortSignal?.aborted || err.message === 'ABORTED') {
          reject(new Error('ABORTED'));
        } else {
          reject(err);
        }
      }
    });

    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          reject(new Error('OLLAMA_TIMEOUT'));
        }
      });
    }

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          reject(new Error('ABORTED'));
        }
      }, { once: true });
    }

    req.write(bodyStr, 'utf8');
    req.end();
  });

  const trimmed = toSafeString(rawText).trim();
  if (!trimmed) throw new Error('OLLAMA_EMPTY_RESPONSE');

  return sanitizeTranslationResponse(trimmed);
}

/**
 * Unload the model from GPU memory by sending a generate request with keep_alive=0.
 * This frees VRAM without stopping the Ollama server.
 * Improved with proper connection cleanup and error handling.
 */
async function resetOllamaContext({
  model,
  baseUrl = OLLAMA_DEFAULT_BASE_URL,
  timeoutMs = 15000,
} = {}) {
  if (!model) return false;

  const bodyStr = JSON.stringify({
    model,
    prompt: '',
    keep_alive: 0,
    stream: false,
  });

  return new Promise((resolve) => {
    const url = new URL(`${baseUrl}/api/generate`);
    let req = null;
    let isResolved = false;

    const cleanup = () => {
      if (req && !req.destroyed) {
        try {
          req.destroy();
        } catch { /* ignore cleanup errors */ }
      }
    };

    req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr, 'utf8'),
        'Connection': 'close',
      },
    }, (res) => {
      // Drain response data
      res.on('data', () => {});
      res.on('end', () => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          resolve(true);
        }
      });
      res.on('error', () => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        resolve(false);
      }
    });

    if (timeoutMs > 0) {
      req.setTimeout(timeoutMs, () => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          resolve(false);
        }
      });
    }

    req.write(bodyStr, 'utf8');
    req.end();
  });
}

module.exports = { requestOllamaChatCompletion, resetOllamaContext };
