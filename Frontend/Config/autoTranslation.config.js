import { Gauge, Layers3, ShieldCheck, Sparkles } from 'lucide-react';

// ─── Auto-translation models, methods and Ollama dropdown ───────────────────
// Drives the "Smart" tab and the model picker on the AI tab. Everything that
// is *visual* about a translation method/model lives here; the runtime
// pipeline only ever consumes the ids.

const MODEL_X = 'model-x';
const MODEL_COMPAT = 'model-compat';

export const AUTO_TRANSLATION_MODELS_IDS = {
  X: MODEL_X,
  COMPAT: MODEL_COMPAT,
};

/**
 * Translates a method id back into the model id that owns it.
 * Used when the persisted settings only remember the method.
 * @param {string} method
 * @returns {string}
 */
export function getModelByMethod(method) {
  return method === 'compatibility' ? MODEL_COMPAT : MODEL_X;
}

export const AUTO_TRANSLATION_MODELS = [
  { id: MODEL_X,      title: 'Модель 1', subtitle: 'google-translate-api-x',          icon: Sparkles },
  { id: MODEL_COMPAT, title: 'Модель 2', subtitle: '@vitalets/google-translate-api',   icon: ShieldCheck },
];

export const AUTO_TRANSLATION_METHODS_BY_MODEL = {
  [MODEL_X]: [
    {
      id: 'single',
      name: 'Single',
      description: 'Переводит каждую строку отдельно. Максимальная точность и аккуратная работа с короткими фразами.',
      badge: 'Точность',
      icon: Sparkles,
      color: 'text-emerald-300',
      bg: 'bg-emerald-400/10',
    },
    {
      id: 'standard',
      name: 'Batch',
      description: 'Обрабатывает строки пакетами. Более стабильный режим для крупных модов и больших объемов текста.',
      badge: 'Стабильность',
      icon: Layers3,
      color: 'text-amber-300',
      bg: 'bg-amber-400/10',
    },
  ],
  [MODEL_COMPAT]: [
    {
      id: 'compatibility',
      name: 'Стандарт',
      description:
        'Классическая библиотека с одним проверенным режимом. Хороший резервный вариант при нестабильной работе основной модели.',
      badge: 'Fallback',
      icon: Gauge,
      color: 'text-sky-300',
      bg: 'bg-sky-400/10',
    },
  ],
};

export const OLLAMA_MODEL_DROPDOWN_OPTIONS = [
  {
    id: 'hf.co/IlyaGusev/saiga_yandexgpt_8b_gguf:Q8_0',
    title: 'Saiga YandexGPT 8B',
    badge: 'Рекомендуется',
    tags: ['Качество', 'RU'],
    size: '~ 9 ГБ',
    vram: '10 ГБ VRAM',
    tier: 'newest',
    description:
      'Лучший выбор для перевода игрового контента EN→RU. Специально дообучена на русскоязычных текстах — высокое качество перевода диалогов, описаний предметов и способностей.',
  },
];
