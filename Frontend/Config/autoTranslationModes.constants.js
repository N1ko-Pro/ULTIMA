// ─── Auto-translation modes ─────────────────────────────────────────────────
// Two engines drive auto-translation: the cloud "smart" pipeline and the local
// Ollama-backed AI. The string values must match what the backend expects.

/** @typedef {'smart' | 'local'} AutoTranslationModeId */

export const AUTO_TRANSLATION_MODE = {
  SMART: 'smart',
  LOCAL: 'local',
};
