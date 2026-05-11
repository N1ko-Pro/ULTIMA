const AUTH_CACHE_FILE = 'auth-cache.json';

// ─── Offline cache config ────────────────────────────────────────────────────
// CACHE_TTL_MS       — How long a user can stay offline before being demoted
//                      to guest. Change this to adjust the offline window.
// OFFLINE_TICK_MS    — How often the anti-cheat timer fires (main process).
// OFFLINE_MAX_DELTA  — Max time credited per tick. Caps clock-forward jumps
//                      and restart-loop abuse to at most this value per tick.
const CACHE_TTL_MS         = 24 * 60 * 60 * 1000;            // ← main configurable (default 24 h)
const OFFLINE_TICK_MS      = 30 * 1000;            // tick every 30 s
const OFFLINE_MAX_DELTA_MS = 90 * 1000;            // clamp per tick (allows NTP jitter)

const TIER = {
  GUEST: 'guest',
  FREE: 'free',
  DEVELOPER: 'developer',
};

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/v10/oauth2/token';
const DISCORD_REDIRECT_URI = 'http://localhost/auth/callback';
const DISCORD_SCOPES = ['identify', 'guilds.members.read'];

module.exports = {
  AUTH_CACHE_FILE,
  CACHE_TTL_MS,
  OFFLINE_TICK_MS,
  OFFLINE_MAX_DELTA_MS,
  TIER,
  DISCORD_API_BASE,
  DISCORD_AUTHORIZE_URL,
  DISCORD_TOKEN_URL,
  DISCORD_REDIRECT_URI,
  DISCORD_SCOPES,
};
