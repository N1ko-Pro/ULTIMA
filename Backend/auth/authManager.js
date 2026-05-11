const discord = require('./discordOAuth');
const supabase = require('./supabaseClient');
const authStore = require('./authStore');
const { TIER, CACHE_TTL_MS, OFFLINE_TICK_MS, OFFLINE_MAX_DELTA_MS } = require('./constants');

// ─── Embedded Auth Configuration ───────────────────────────────────────────────
const AUTH_CONFIG = {
  discord: {
    clientId: "1493595583095505069",
    guildId: "1493596798252486678",
    devRoleId: "1494627724218728529"
  },
  supabase: {
    url: "https://ersjewekswnxxxgdzeff.supabase.co",
    anonKey: "sb_publishable_wm1Pr6qR6EKJjwsyPiuqQw_rkiMgzvN"
  }
};

// ─── AuthManager ────────────────────────────────────────────────────────────────

class AuthManager {
  constructor() {
    this._config  = AUTH_CONFIG;
    this._state   = this._guestState();
    this._offlineTimer   = null;  // setTimeout handle for the anti-cheat tick
    this._offlineTracker = null;  // { offlineSince, tickElapsed, lastTickAt }
  }

  // ── Initialization ──────────────────────────────────────────────────────────

  initialize(userDataPath, _appPath) {
    authStore.init(userDataPath);

    // Configure Supabase (if credentials provided)
    if (this._config?.supabase?.url && this._config?.supabase?.anonKey) {
      supabase.configure(this._config.supabase.url, this._config.supabase.anonKey);
    }

    // Restore cached session
    const cached = authStore.load();
    if (cached && authStore.isCacheValid(cached)) {
      this._state = cached.authState || this._guestState();
      if (cached.roles && !this._state.roles) {
        this._state.roles = cached.roles;
      }
      // Re-derive tier from cached roles — prevents editing the cache file to gain a higher tier.
      this._state.tier = this._deriveTierFromCache();
      console.log(`AuthManager: restored session — ${this._state.user?.username || 'guest'} [${this._state.tier}]`);
      // Resume or expire any saved offline tracker from the previous session.
      this._initOfflineTrackerFromCache(cached);
      // Always verify with server on startup, regardless of cached roles.
      this._silentRefresh();
    } else if (cached?.tokens?.refresh_token) {
      // Cache expired but we have a refresh token — schedule silent refresh
      this._state = cached.authState || this._guestState();
      if (cached.roles && !this._state.roles) {
        this._state.roles = cached.roles;
      }
      // Re-derive tier from cached roles before the async refresh completes.
      this._state.tier = this._deriveTierFromCache();
      // Resume or expire any saved offline tracker from the previous session.
      this._initOfflineTrackerFromCache(cached);
      this._silentRefresh();
    }
  }

  get isConfigured() {
    return Boolean(
      this._config?.discord?.clientId &&
      this._config?.discord?.guildId,
    );
  }

  get _devRoleId() {
    return this._config?.discord?.devRoleId || null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getState() {
    return { ...this._state, isConfigured: this.isConfigured };
  }

  async login() {
    if (!this.isConfigured) {
      throw new Error('Авторизация не настроена. Проверьте auth.config.json');
    }

    const { clientId, guildId } = this._config.discord;

    // 1. Open Discord OAuth window (PKCE) → get authorization code + verifier
    const { code, codeVerifier } = await discord.openOAuthWindow(clientId);

    // 2. Exchange code for tokens using PKCE verifier (no clientSecret)
    const tokenData = await discord.exchangeCode(code, clientId, codeVerifier);
    const { access_token, refresh_token, expires_in } = tokenData;

    // 3. Fetch Discord user profile
    const user = await discord.fetchUser(access_token);

    // 4. Fetch guild membership + roles
    const member = await discord.fetchGuildMember(access_token, guildId);
    const roles = member?.roles || [];

    // 5. Upsert user in Supabase (creates row on first login, syncs local_name)
    let serverLocalName = null;
    if (supabase.isConfigured) {
      try {
        const supaUser = await supabase.upsertUser(user.id, user.username);
        serverLocalName = supaUser?.local_name || null;
        console.log('AuthManager: Supabase upsert OK');
      } catch (err) {
        console.warn('AuthManager: Supabase upsert failed:', err.message);
      }
    } else {
      console.warn('AuthManager: Supabase not configured — skipping upsert');
    }

    // 6. Determine tier
    const tier = this._determineTier(roles, this._devRoleId);

    // 7. Build state
    this._state = {
      isLoggedIn: true,
      tier,
      user: this._buildUserObject(user),
      isInGuild: !!member,
      serverLocalName,
      roles,
    };

    // 8. Persist to disk
    this._persistCache(access_token, refresh_token, expires_in);

    console.log(`AuthManager: logged in — ${user.username} [${tier}]`);
    return this._state;
  }

  async logout() {
    this._stopOfflineTimer();
    authStore.clear();
    this._state = this._guestState();
    return this._state;
  }

  async saveLocalName(name) {
    if (!this._state.isLoggedIn || !this._state.user?.id) return;
    if (!supabase.isConfigured) return;
    await supabase.updateLocalName(this._state.user.id, name || '');
  }

  async refreshSession() {
    if (!this.isConfigured) return { state: this._state, refreshed: false };

    const cached = authStore.load();
    if (!cached?.tokens?.refresh_token) return { state: this._state, refreshed: false };

    const attemptedRefreshToken = cached.tokens.refresh_token;
    const { clientId, guildId } = this._config.discord;

    try {
      const tokenData = await discord.refreshAccessToken(
        attemptedRefreshToken,
        clientId,
      );
      if (!tokenData) {
        // Check if a concurrent login replaced the tokens while we waited
        const fresh = authStore.load();
        if (fresh?.tokens?.refresh_token && fresh.tokens.refresh_token !== attemptedRefreshToken) {
          console.log('AuthManager: token refresh skipped — concurrent login detected');
          return { state: this._state, refreshed: false };
        }

        // Discord PKCE refresh requires no client_secret — rotation may not be
        // supported. If the access token is still valid, re-verify using it.
        if (cached.tokens.access_token && cached.tokens.expires_at > Date.now()) {
          return this._reverifyWithToken(
            cached.tokens.access_token,
            cached.tokens.refresh_token,
            Math.floor((cached.tokens.expires_at - Date.now()) / 1000),
            guildId,
          );
        }

        console.warn('AuthManager: token refresh failed — session expired');
        return { state: await this.logout(), refreshed: false };
      }

      const { access_token, refresh_token, expires_in } = tokenData;
      return this._reverifyWithToken(access_token, refresh_token, expires_in, guildId);
    } catch (err) {
      console.warn('AuthManager: refresh failed:', err.message);
      this._startOfflineTimer();
      return { state: this._state, refreshed: false };
    }
  }

  async _reverifyWithToken(accessToken, refreshToken, expiresIn, guildId) {
    // Re-fetch user using the access token
    const user = await discord.fetchUser(accessToken);

    // Always fetch current roles from Discord to detect role changes
    const member = await discord.fetchGuildMember(accessToken, guildId);
    const roles = member?.roles || [];

    // Re-check local_name in Supabase
    let serverLocalName = null;
    if (supabase.isConfigured) {
      const supaUser = await supabase.getUser(user.id);
      if (!supaUser) {
        console.warn('AuthManager: user not found in Supabase — forcing logout');
        return { state: await this.logout(), refreshed: false };
      }
      serverLocalName = supaUser?.local_name || null;
    }

    const tier = this._determineTier(roles, this._devRoleId);

    this._state = {
      isLoggedIn: true,
      tier,
      user: this._buildUserObject(user),
      isInGuild: !!member,
      serverLocalName,
      roles,
    };

    this._stopOfflineTimer();
    this._persistCache(accessToken, refreshToken, expiresIn);
    return { state: this._state, refreshed: true };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  _guestState() {
    return {
      isLoggedIn: false,
      tier: TIER.GUEST,
      user: null,
      isInGuild: false,
    };
  }

  _deriveTierFromCache() {
    return this._determineTier(this._state.roles || [], this._devRoleId);
  }

  _buildUserObject(discordUser) {
    return {
      id: discordUser.id,
      username: discordUser.username,
      displayName: discordUser.global_name || discordUser.username,
      avatar: discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=64`
        : null,
    };
  }

  _determineTier(roles, devRoleId) {
    if (devRoleId && roles.includes(devRoleId)) return TIER.DEVELOPER;
    return TIER.FREE;
  }

  _persistCache(accessToken, refreshToken, expiresIn) {
    authStore.save({
      authState: this._state,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: Date.now() + expiresIn * 1000,
      },
      cachedAt: Date.now(),
      roles: this._state.roles || [], // Cache Discord roles
    });
  }

  _silentRefresh() {
    // Non-blocking refresh in background
    this.refreshSession().catch((err) => {
      console.warn('AuthManager: silent refresh failed:', err.message);
    });
  }

  // ── Offline cache timer (anti-cheat) ────────────────────────────────────────
  // Accumulates real elapsed offline time in small clamped ticks.
  // effectiveElapsed = max(tickElapsed, wallElapsed) so that:
  //   - Clock advanced forward  → wallElapsed grows quickly → expiry triggered
  //   - Clock moved backward    → tick still increments → can't slow expiry
  //   - App restarted in a loop → each gap adds at most OFFLINE_MAX_DELTA_MS

  _initOfflineTrackerFromCache(cached) {
    const saved = cached?.offlineTracker;
    if (!saved || !this._state.isLoggedIn) return;
    const now = Date.now();
    const gapDelta    = Math.min(Math.max(0, now - saved.lastTickAt), OFFLINE_MAX_DELTA_MS);
    const tickElapsed = saved.tickElapsed + gapDelta;
    const wallElapsed = Math.max(0, now - saved.offlineSince);
    if (Math.max(tickElapsed, wallElapsed) >= CACHE_TTL_MS) {
      console.log('AuthManager: offline cache expired during closure — demoting to guest');
      authStore.clear();
      this._state = this._guestState();
    } else {
      this._offlineTracker = { offlineSince: saved.offlineSince, tickElapsed, lastTickAt: now };
      this._scheduleTick();
      console.log(`AuthManager: resumed offline timer — ${Math.round(Math.max(tickElapsed, wallElapsed) / 1000)}s elapsed`);
    }
  }

  _startOfflineTimer() {
    if (this._offlineTracker) return; // already running
    const now = Date.now();
    this._offlineTracker = { offlineSince: now, tickElapsed: 0, lastTickAt: now };
    this._persistOfflineTracker();
    this._scheduleTick();
    console.log('AuthManager: offline timer started');
  }

  _stopOfflineTimer() {
    if (!this._offlineTracker) return;
    this._offlineTracker = null;
    if (this._offlineTimer) { clearTimeout(this._offlineTimer); this._offlineTimer = null; }
    this._clearOfflineTracker();
    console.log('AuthManager: offline timer stopped — connection restored');
  }

  _scheduleTick() {
    if (this._offlineTimer) clearTimeout(this._offlineTimer);
    this._offlineTimer = setTimeout(() => this._offlineTick(), OFFLINE_TICK_MS);
  }

  _offlineTick() {
    if (!this._offlineTracker) return;
    const now   = Date.now();
    const delta = now - this._offlineTracker.lastTickAt;
    // Clamp: caps forward-jump abuse and rejects backward ticks
    const safeDelta = delta < 0 ? 0 : Math.min(delta, OFFLINE_MAX_DELTA_MS);
    this._offlineTracker.tickElapsed += safeDelta;
    this._offlineTracker.lastTickAt   = now;

    const wallElapsed      = Math.max(0, now - this._offlineTracker.offlineSince);
    const effectiveElapsed = Math.max(this._offlineTracker.tickElapsed, wallElapsed);
    this._persistOfflineTracker();

    if (effectiveElapsed >= CACHE_TTL_MS) {
      this._expireOfflineSession();
      return;
    }
    this._scheduleTick();
  }

  _expireOfflineSession() {
    console.log('AuthManager: offline cache expired — demoting to guest');
    this._offlineTracker = null;
    if (this._offlineTimer) { clearTimeout(this._offlineTimer); this._offlineTimer = null; }
    authStore.clear();
    this._state = this._guestState();
  }

  _persistOfflineTracker() {
    try {
      const cached = authStore.load();
      if (!cached) return;
      cached.offlineTracker = this._offlineTracker;
      authStore.save(cached);
    } catch (err) {
      console.warn('AuthManager: failed to persist offline tracker:', err.message);
    }
  }

  _clearOfflineTracker() {
    try {
      const cached = authStore.load();
      if (!cached) return;
      delete cached.offlineTracker;
      authStore.save(cached);
    } catch (err) {
      console.warn('AuthManager: failed to clear offline tracker:', err.message);
    }
  }
}

module.exports = new AuthManager();
