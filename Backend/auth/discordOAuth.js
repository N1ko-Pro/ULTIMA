const crypto = require('crypto');
const { BrowserWindow } = require('electron');
const { httpsRequest } = require('./httpClient');
const {
  DISCORD_API_BASE,
  DISCORD_AUTHORIZE_URL,
  DISCORD_TOKEN_URL,
  DISCORD_REDIRECT_URI,
  DISCORD_SCOPES,
} = require('./constants');

// ─── Singleton guard ────────────────────────────────────────────────────────────
let _authWindow = null;

// ─── Helper to get main window ─────────────────────────────────────────────────────
function getMainWindow() {
  const windows = BrowserWindow.getAllWindows();
  // Return the first non-auth window (main window)
  return windows.find(w => w !== _authWindow) || null;
}

// ─── PKCE helpers ───────────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ─── OAuth window ───────────────────────────────────────────────────────────────

/**
 * Opens the Discord OAuth2 authorization window using PKCE flow.
 * Returns { code, codeVerifier } — no clientSecret ever leaves the app.
 * @param {string} clientId - Discord client ID
 */
function openOAuthWindow(clientId) {
  return new Promise((resolve, reject) => {
    if (_authWindow && !_authWindow.isDestroyed()) {
      _authWindow.focus();
      return reject(new Error('Окно авторизации уже открыто'));
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: DISCORD_SCOPES.join(' '),
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    let resolved = false;

    _authWindow = new BrowserWindow({
      width: 520,
      height: 750,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'Discord — Авторизация',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      if (_authWindow && !_authWindow.isDestroyed()) _authWindow.destroy();
      _authWindow = null;

      // Focus main window after successful auth
      if (result.code) {
        const mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          setTimeout(() => {
            if (!mainWin.isDestroyed()) {
              mainWin.setAlwaysOnTop(true);
              mainWin.focus();
              if (mainWin.isMinimized()) mainWin.restore();
              setTimeout(() => {
                if (!mainWin.isDestroyed()) {
                  mainWin.setAlwaysOnTop(false);
                }
              }, 200);
            }
          }, 100);
        }
        resolve({ code: result.code, codeVerifier });
      } else {
        reject(new Error(result.error || 'Авторизация отменена'));
      }
    };

    const tryCapture = (url) => {
      if (!url.startsWith(DISCORD_REDIRECT_URI)) return false;
      try {
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const error = parsed.searchParams.get('error');
        finish(code ? { code } : { error: error || 'access_denied' });
      } catch {
        finish({ error: 'invalid_redirect' });
      }
      return true;
    };

    _authWindow.webContents.on('will-redirect', (event, url) => {
      if (tryCapture(url)) event.preventDefault();
    });
    _authWindow.webContents.on('will-navigate', (event, url) => {
      if (tryCapture(url)) event.preventDefault();
    });

    _authWindow.on('closed', () => {
      _authWindow = null;
      finish({ error: 'Окно закрыто пользователем' });
    });

    _authWindow.loadURL(`${DISCORD_AUTHORIZE_URL}?${params}`);
  });
}

// ─── Token exchange (PKCE — no clientSecret) ───────────────────────────────────

async function exchangeCode(code, clientId, codeVerifier) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
    code_verifier: codeVerifier,
  }).toString();

  const res = await httpsRequest(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (res.status !== 200 || !res.json?.access_token) {
    const detail = res.json?.error_description || res.json?.error || `HTTP ${res.status}`;
    throw new Error(`Ошибка обмена кода: ${detail}`);
  }

  return res.json;
}

// ─── Token refresh (PKCE — no clientSecret) ─────────────────────────────────────

async function refreshAccessToken(token, clientId) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: token,
  }).toString();

  const res = await httpsRequest(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (res.status !== 200 || !res.json?.access_token) return null;
  return res.json;
}

// ─── Discord API helpers ────────────────────────────────────────────────────────

async function fetchUser(accessToken) {
  const res = await httpsRequest(`${DISCORD_API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status !== 200 || !res.json) {
    throw new Error(`Не удалось получить профиль Discord: HTTP ${res.status}`);
  }
  return res.json;
}

async function fetchGuildMember(accessToken, guildId) {
  const res = await httpsRequest(
    `${DISCORD_API_BASE}/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status !== 200) return null;
  return res.json;
}

module.exports = {
  openOAuthWindow,
  exchangeCode,
  refreshAccessToken,
  fetchUser,
  fetchGuildMember,
};
