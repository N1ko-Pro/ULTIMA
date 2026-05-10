// ─── Ollama model "tier" styling ────────────────────────────────────────────
// Visual configuration for model cards on the Settings → AI page. The keys
// here ("lite", "recommended", "heavy", "newest", "rose") are NOT subscription
// tiers — they classify the local model itself by hardware requirement and
// recency. See `tiers.constants.js` for the unrelated subscription enum.

/**
 * @typedef {Object} ModelTierStyle
 * @property {string} card     Default card border + background classes.
 * @property {string} cardSel  Same, but applied when the card is selected.
 * @property {string} badge    Pill badge classes.
 * @property {string} glow     Drop-shadow class for selected state.
 * @property {string} dot      Status dot background.
 * @property {string} dotText  Status dot text colour.
 * @property {string} edge     Top-edge gradient stop.
 * @property {string} tag      Inline-tag border + text classes.
 */

/** @type {Record<string, ModelTierStyle>} */
export const MODEL_TIER_STYLES = {
  lite: {
    card:    'border-sky-500/15 bg-sky-500/[0.02] backdrop-blur-xl',
    cardSel: 'border-sky-400/30 bg-sky-500/[0.07] backdrop-blur-xl',
    badge:   'text-sky-300 bg-sky-500/[0.12] border-sky-500/25',
    glow:    'shadow-[0_2px_16px_rgba(14,165,233,0.08)]',
    dot:     'bg-sky-400',
    dotText: 'text-sky-400',
    edge:    'via-sky-400/[0.12]',
    tag:     'border-sky-400/20 bg-sky-500/[0.08] text-sky-300/80',
  },
  recommended: {
    card:    'border-emerald-500/20 bg-emerald-500/[0.03] backdrop-blur-xl',
    cardSel: 'border-emerald-400/35 bg-emerald-500/[0.08] backdrop-blur-xl',
    badge:   'text-emerald-300 bg-emerald-500/[0.12] border-emerald-500/25',
    glow:    'shadow-[0_2px_20px_rgba(52,211,153,0.1)]',
    dot:     'bg-emerald-400',
    dotText: 'text-emerald-400',
    edge:    'via-emerald-400/[0.12]',
    tag:     'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300/80',
  },
  heavy: {
    card:    'border-amber-500/15 bg-amber-500/[0.02] backdrop-blur-xl',
    cardSel: 'border-amber-400/30 bg-amber-500/[0.07] backdrop-blur-xl',
    badge:   'text-amber-300 bg-amber-500/[0.12] border-amber-500/25',
    glow:    'shadow-[0_2px_16px_rgba(245,158,11,0.08)]',
    dot:     'bg-amber-400',
    dotText: 'text-amber-400',
    edge:    'via-amber-400/[0.12]',
    tag:     'border-amber-400/20 bg-amber-500/[0.08] text-amber-300/80',
  },
  newest: {
    card:    'border-violet-500/15 bg-violet-500/[0.02] backdrop-blur-xl',
    cardSel: 'border-violet-400/30 bg-violet-500/[0.07] backdrop-blur-xl',
    badge:   'text-violet-300 bg-violet-500/[0.12] border-violet-500/25',
    glow:    'shadow-[0_2px_16px_rgba(139,92,246,0.08)]',
    dot:     'bg-violet-400',
    dotText: 'text-violet-400',
    edge:    'via-violet-400/[0.12]',
    tag:     'border-violet-400/20 bg-violet-500/[0.08] text-violet-300/80',
  },
  rose: {
    card:    'border-rose-500/15 bg-rose-500/[0.02] backdrop-blur-xl',
    cardSel: 'border-rose-400/30 bg-rose-500/[0.07] backdrop-blur-xl',
    badge:   'text-rose-300 bg-rose-500/[0.12] border-rose-500/25',
    glow:    'shadow-[0_2px_16px_rgba(244,63,94,0.08)]',
    dot:     'bg-rose-400',
    dotText: 'text-rose-400',
    edge:    'via-rose-400/[0.12]',
    tag:     'border-rose-400/20 bg-rose-500/[0.08] text-rose-300/80',
  },
};

/** Fallback used when an unknown tier id is requested. */
export const FALLBACK_MODEL_TIER = 'recommended';

/**
 * Safe accessor — never returns undefined.
 * @param {string} tierId
 * @returns {ModelTierStyle}
 */
export const getModelTierStyle = (tierId) =>
  MODEL_TIER_STYLES[tierId] || MODEL_TIER_STYLES[FALLBACK_MODEL_TIER];
