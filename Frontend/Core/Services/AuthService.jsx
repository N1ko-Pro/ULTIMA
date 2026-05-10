/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TIER } from '@Config/tiers.constants';
import { AUTH } from '@Config/timings.constants';
import * as authApi from '@API/auth';

// ─── Auth service ───────────────────────────────────────────────────────────
// Application-wide authentication state and actions. Wraps the Electron auth
// IPC and local-name persistence; mirrors the tier flags from
// `Backend/auth/constants.js`.
//
// This file lives in Core/Services because it is a business service —
// `TIER` constants and tier-styling now live in `Config/`.

const AuthContext = createContext(null);

const INITIAL_STATE = {
  isLoggedIn: false,
  tier: TIER.GUEST,
  user: null,
  trialDaysLeft: 0,
  isInGuild: false,
  isLoading: true,
  isConfigured: false,
};

const LOCAL_NAME_KEY = 'bg3-ultima-local-name';
const LOCAL_NAME_MAX = 100;

const safeStorage = {
  read() {
    try { return localStorage.getItem(LOCAL_NAME_KEY) || ''; }
    catch { return ''; }
  },
  write(value) {
    try {
      if (value) localStorage.setItem(LOCAL_NAME_KEY, value);
      else localStorage.removeItem(LOCAL_NAME_KEY);
    } catch { /* ignore quota / disabled storage */ }
  },
};

export function AuthProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const startupRefreshDoneRef = useRef(false);

  // Online/offline detection.
  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Load initial auth state from Electron.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.getState();
        if (cancelled) return;
        if (res?.success) {
          setState({ ...res.state, isLoading: false });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, isLoading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    try {
      const res = await authApi.login();
      if (!res) return { success: false, error: 'API недоступен' };
      if (res.success) setState((prev) => ({ ...prev, ...res.state }));
      return res;
    } catch (err) {
      return { success: false, error: err?.message || 'Ошибка входа' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const res = await authApi.logout();
      if (!res) return { success: false };
      if (res.success) setState((prev) => ({ ...prev, ...res.state }));
      return res;
    } catch {
      return { success: false };
    }
  }, []);

  const startTrial = useCallback(async () => {
    try {
      const res = await authApi.startTrial();
      if (!res) return { success: false, error: 'API недоступен' };
      if (res.success) setState((prev) => ({ ...prev, ...res.state }));
      return res;
    } catch (err) {
      return { success: false, error: err?.message || 'Ошибка активации' };
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const res = await authApi.refresh();
      if (res?.success && res.state) setState((prev) => ({ ...prev, ...res.state }));
      setRefreshFailed(!res?.refreshed);
    } catch {
      setRefreshFailed(true);
    }
  }, []);

  // Effective tier: cached tier is always used — features stay available offline.
  // The OfflineBanner and profile card inform the user when the server is unreachable.
  const effectiveTier = state.tier;
  const canUseAI            = effectiveTier === TIER.ULTRA   || effectiveTier === TIER.TRIAL || effectiveTier === TIER.DEVELOPER;
  const canUseAutoTranslate = effectiveTier === TIER.PREMIUM || effectiveTier === TIER.ULTRA || effectiveTier === TIER.TRIAL || effectiveTier === TIER.DEVELOPER;
  const canUseDictionary    = effectiveTier !== TIER.GUEST;
  const isDeveloper         = effectiveTier === TIER.DEVELOPER;

  // Local author name — persisted in localStorage, mirrored to Supabase.
  const [localName, setLocalNameRaw] = useState(() => safeStorage.read());

  const setLocalName = useCallback((name) => {
    const v = (name || '').slice(0, LOCAL_NAME_MAX);
    setLocalNameRaw(v);
    safeStorage.write(v);
    authApi.saveLocalName(v)?.catch?.(() => {});
  }, []);

  // Sync local name from server when logging in.
  useEffect(() => {
    const serverName = state.serverLocalName;
    if (!state.isLoggedIn || !serverName) return;
    const stored = safeStorage.read();
    if (serverName !== stored) {
      setLocalNameRaw(serverName);
      safeStorage.write(serverName);
    }
  }, [state.isLoggedIn, state.serverLocalName]);

  // Immediate connectivity check when auth state first loads from cache.
  useEffect(() => {
    if (state.isLoggedIn && !state.isLoading && !startupRefreshDoneRef.current) {
      startupRefreshDoneRef.current = true;
      refresh();
    }
    if (!state.isLoggedIn) {
      startupRefreshDoneRef.current = false;
      setRefreshFailed(false);
    }
  }, [state.isLoggedIn, state.isLoading, refresh]);

  // Lightweight state poll — works offline (pure IPC, no network).
  // Detects backend-side events such as offline cache expiry.
  const checkState = useCallback(async () => {
    try {
      const res = await authApi.getState();
      if (res?.success && res.state) setState((prev) => ({ ...prev, ...res.state }));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!state.isLoggedIn) return undefined;
    const id = setInterval(checkState, AUTH.STATE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state.isLoggedIn, checkState]);

  // Periodic refresh while logged in.
  useEffect(() => {
    if (!state.isLoggedIn) return undefined;
    const id = setInterval(refresh, AUTH.REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state.isLoggedIn, refresh]);

  // Refresh immediately when coming back online.
  useEffect(() => {
    if (!isOffline && state.isLoggedIn) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
      startTrial,
      refresh,
      canUseAI,
      canUseAutoTranslate,
      canUseDictionary,
      isDeveloper,
      localName,
      setLocalName,
      isOffline,
      refreshFailed,
    }),
    [state, login, logout, startTrial, refresh, canUseAI, canUseAutoTranslate, canUseDictionary, isDeveloper, localName, setLocalName, isOffline, refreshFailed],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Read auth state and actions. Throws when used outside <AuthProvider>.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
