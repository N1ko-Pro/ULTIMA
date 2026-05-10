import { Bot, SlidersHorizontal, Zap } from 'lucide-react';

// ─── Settings page tabs ─────────────────────────────────────────────────────
// Defines the navigation order and labels of the settings dialog. The `id`
// is referenced by `useAppState.handleOpenSettings(tab)` to deep-link.

export const SETTINGS_TAB_IDS = {
  GENERAL: 'general',
  AUTO_TRANSLATION: 'auto-translation',
  OLLAMA: 'ollama',
};

export const SETTINGS_TABS = {
  GENERAL:          { id: SETTINGS_TAB_IDS.GENERAL,          label: 'Общее',  icon: SlidersHorizontal },
  AUTO_TRANSLATION: { id: SETTINGS_TAB_IDS.AUTO_TRANSLATION, label: 'Smart',  icon: Zap },
  OLLAMA:           { id: SETTINGS_TAB_IDS.OLLAMA,           label: 'AI',     icon: Bot },
};

/** Ordered list — used to render tab strip top-down. */
export const SETTINGS_TABS_LIST = [
  SETTINGS_TABS.GENERAL,
  SETTINGS_TABS.AUTO_TRANSLATION,
  SETTINGS_TABS.OLLAMA,
];
