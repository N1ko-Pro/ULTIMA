const http = require('http');

/**
 * Low-level HTTP GET/DELETE using Node.js http module.
 * Improved with proper connection cleanup and error handling.
 */
function httpSimple(urlStr, method = 'GET', { timeoutMs = 5000, bodyStr = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const headers = {};
    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');
    }
    headers['Connection'] = 'close'; // Force connection close to prevent pooling issues

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
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        cleanup();
        if (!isResolved) {
          isResolved = true;
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
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
        reject(err);
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

    if (bodyStr) req.write(bodyStr, 'utf8');
    req.end();
  });
}

module.exports = { httpSimple };
