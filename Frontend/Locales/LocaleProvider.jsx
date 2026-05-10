/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';
import ru from './ru';
import en from './en';

// ─── Locale provider & hook ─────────────────────────────────────────────────
// Single source of truth for UI text. The provider receives the current
// language id (driven by `general.appLanguage` settings) and exposes the
// matching dictionary through `useLocale()`.
//
// Adding a new language:
//   1. Create the dictionary file (e.g. `de.js`) mirroring `ru.js` shape.
//   2. Register it in LOCALES below.
//   3. Add an option in the settings UI.

/** @typedef {'ru' | 'en'} LocaleId */

const LOCALES = { ru, en };
const FALLBACK_LOCALE = 'ru';

const LocaleContext = createContext(LOCALES[FALLBACK_LOCALE]);

/**
 * Wrap the app root with this provider. `lang` is the active language id;
 * unknown values fall back to the default (Russian).
 * @param {{ lang: LocaleId, children: React.ReactNode }} props
 */
export function LocaleProvider({ lang, children }) {
  const dictionary = useMemo(
    () => LOCALES[lang] ?? LOCALES[FALLBACK_LOCALE],
    [lang],
  );
  return <LocaleContext.Provider value={dictionary}>{children}</LocaleContext.Provider>;
}

/**
 * Returns the active locale dictionary. Use inside any component:
 *   const t = useLocale();
 *   <p>{t.common.save}</p>
 */
export function useLocale() {
  return useContext(LocaleContext);
}

export { ru, en };
export const SUPPORTED_LOCALES = Object.keys(LOCALES);
