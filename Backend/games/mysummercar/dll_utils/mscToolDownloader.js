// ─────────────────────────────────────────────────────────────────────────────
//  mscToolDownloader.js — download MscLocTool.exe from its release asset into
//  the per-user tools directory, reporting progress (0-100).
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const https = require('https');
const { DOWNLOAD_URL, EXE_NAME } = require('../toolConfig');

const MAX_REDIRECTS = 5;

function fetchTo(url, destPath, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      reject(new Error('Слишком много перенаправлений при загрузке инструмента.'));
      return;
    }

    const request = https.get(url, (res) => {
      // GitHub release assets redirect to a CDN — follow the Location header.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(fetchTo(res.headers.location, destPath, onProgress, redirects + 1));
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Не удалось скачать инструмент: HTTP ${res.statusCode}`));
        return;
      }

      const total = parseInt(res.headers['content-length'] || '0', 10);
      let received = 0;
      const tmpPath = `${destPath}.part`;
      const out = fs.createWriteStream(tmpPath);

      res.on('data', (chunk) => {
        received += chunk.length;
        if (total > 0) onProgress?.(Math.min(99, Math.round((received / total) * 100)));
      });
      res.pipe(out);

      out.on('finish', () => out.close((err) => {
        if (err) { reject(err); return; }
        try {
          fs.renameSync(tmpPath, destPath);
          onProgress?.(100);
          resolve();
        } catch (e) {
          reject(e);
        }
      }));
      out.on('error', (err) => {
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        reject(err);
      });
    });

    request.on('error', reject);
  });
}

/**
 * Download the tool into `toolDir`, reporting 0-100 progress.
 * @param {string} toolDir
 * @param {(percent: number) => void} [onProgress]
 */
async function downloadTool(toolDir, onProgress) {
  fs.mkdirSync(toolDir, { recursive: true });
  const dest = path.join(toolDir, EXE_NAME);
  await fetchTo(DOWNLOAD_URL, dest, onProgress);
}

module.exports = { downloadTool };
