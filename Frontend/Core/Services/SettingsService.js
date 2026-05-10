import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SETTINGS } from '@Config/settings.constants';
import * as settingsApi from '@API/settings';
import { isAvailable } from '@API/client';

// ─── Settings service ───────────────────────────────────────────────────────
// Owns the user-facing preference object: app language, translation method,
// Ollama model, dictionary toggles, etc. Hydrated from the backend on mount,
// patched via shallow merges.
//
// Returned `updateTranslationSettings` accepts a partial — only the keys you
// pass are written. Nested objects (`general`, `ollama`, ...) are merged one
// level deep so call sites can do `updateTranslationSettings({ general: {
// appLanguage: 'en' } })` without losing other general fields.

/**
 * @returns {{
 *   translationSettings: typeof DEFAULT_SETTINGS,
 *   updateTranslationSettings: (patch: Partial<typeof DEFAULT_SETTINGS>) => Promise<boolean>,
 * }}
 */
export default function useTranslationSettings() {
  const [translationSettings, setTranslationSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const response = await settingsApi.get();
      if (!cancelled && response?.success && response?.settings) {
        setTranslationSettings(response.settings);
      }
    };

    sync();
    return () => { cancelled = true; };
  }, []);

  const updateTranslationSettings = useCallback(async (patch) => {
    if (!isAvailable()) {
      // No backend available — apply optimistic local merge so the UI still works.
      setTranslationSettings((previous) => mergeSettings(previous, patch));
      return true;
    }

    const response = await settingsApi.set(patch);
    if (response?.success && response?.settings) {
      setTranslationSettings(response.settings);
      return true;
    }
    return false;
  }, []);

  return { translationSettings, updateTranslationSettings };
}

/** Shallow merge with one level of depth for the known nested groups. */
function mergeSettings(previous, patch) {
  return {
    ...previous,
    ...patch,
    general: { ...(previous?.general || {}), ...(patch?.general || {}) },
    ollama:  { ...(previous?.ollama  || {}), ...(patch?.ollama  || {}) },
    smart:   { ...(previous?.smart   || {}), ...(patch?.smart   || {}) },
    local:   { ...(previous?.local   || {}), ...(patch?.local   || {}) },
  };
}
