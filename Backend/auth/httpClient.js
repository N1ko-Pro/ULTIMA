const https = require('https');

/**
 * Simple HTTPS request utility (similar to ollama_utils/httpUtils but for external APIs).
 * Returns { status, body, json }.
 */
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = { ...options.headers };

    let bodyStr = null;
    if (options.body != null) {
      bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = Buffer.byteLength(bodyStr, 'utf8');
    }

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(body);
          } catch { /* not JSON */ }
          resolve({ status: res.statusCode, body, json });
        });
      },
    );

    req.on('error', reject);
    req.setTimeout(options.timeout || 15000, () => req.destroy(new Error('REQUEST_TIMEOUT')));

    if (bodyStr) req.write(bodyStr, 'utf8');
    req.end();
  });
}

module.exports = { httpsRequest };
