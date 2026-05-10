const fs = require('fs');
const path = require('path');
const { AUTH_CACHE_FILE, CACHE_TTL_MS } = require('./constants');

let _storePath = '';

// Lazy accessor — safeStorage is only available after app.whenReady().
function _ss() {
  try { return require('electron').safeStorage; } catch { return null; }
}

function init(userDataPath) {
  _storePath = path.join(userDataPath, AUTH_CACHE_FILE);
}

function load() {
  try {
    const raw = fs.readFileSync(_storePath); // Buffer
    const ss = _ss();
    if (ss?.isEncryptionAvailable()) {
      try {
        return JSON.parse(ss.decryptString(raw));
      } catch {
        // Migration: existing cache is plain JSON — decrypt failed, try plaintext.
        try {
          const parsed = JSON.parse(raw.toString('utf8'));
          save(parsed); // Re-save as encrypted immediately.
          console.log('AuthStore: migrated cache to encrypted format');
          return parsed;
        } catch { return null; }
      }
    }
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }
}

function save(data) {
  try {
    const json = JSON.stringify(data, null, 2);
    const ss = _ss();
    if (ss?.isEncryptionAvailable()) {
      fs.writeFileSync(_storePath, ss.encryptString(json)); // writes Buffer
    } else {
      fs.writeFileSync(_storePath, json, 'utf8');
    }
  } catch (err) {
    console.error('AuthStore: failed to save:', err.message);
  }
}

function clear() {
  try {
    if (fs.existsSync(_storePath)) fs.unlinkSync(_storePath);
  } catch (err) {
    console.error('AuthStore: failed to clear:', err.message);
  }
}

function isCacheValid(cached) {
  if (!cached || !cached.cachedAt) return false;
  return Date.now() - cached.cachedAt < CACHE_TTL_MS;
}

module.exports = { init, load, save, clear, isCacheValid };
