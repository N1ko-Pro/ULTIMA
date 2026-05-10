import { AUTO_TRANSLATION_MODE } from './autoTranslationModes.constants';

// ─── Default settings ───────────────────────────────────────────────────────
// Initial state used when no persisted settings are available, and as a
// merge-base for partial patches coming from the backend.

export const DEFAULT_OLLAMA_MODEL = 'hf.co/IlyaGusev/saiga_yandexgpt_8b_gguf:Q8_0';

export const DEFAULT_SETTINGS = {
  general: {
    appLanguage: 'ru',
  },
  method: 'single',
  ollama: {
    model: DEFAULT_OLLAMA_MODEL,
  },
  smart: {
    useDictionary: false,
  },
  local: {
    useDictionary: true,
  },
  autoTranslate: {
    defaultMode: AUTO_TRANSLATION_MODE.SMART,
  },
  updates: {
    autoUpdateEnabled: true,
  },
};
