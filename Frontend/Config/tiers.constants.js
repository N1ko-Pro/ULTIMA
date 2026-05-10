// ─── Subscription Tiers ─────────────────────────────────────────────────────
// Mirrors Backend/auth/constants.js — keep in sync.
// These values describe WHO the user is, not how things look in some panel.

/** @typedef {'guest' | 'trial' | 'free' | 'premium' | 'ultra' | 'developer'} TierId */

/** Identifiers for every supported subscription tier. */
export const TIER = {
  GUEST: 'guest',
  TRIAL: 'trial',
  FREE: 'free',
  PREMIUM: 'premium',
  ULTRA: 'ultra',
  DEVELOPER: 'developer',
};

/** Human-readable label for each tier (Russian, used by UI). */
export const TIER_LABELS = {
  [TIER.GUEST]: 'Гость',
  [TIER.TRIAL]: 'Пробный',
  [TIER.FREE]: 'Бесплатный',
  [TIER.PREMIUM]: 'Премиум',
  [TIER.ULTRA]: 'Ультра',
  [TIER.DEVELOPER]: 'Разработчик',
};

/** Tailwind classnames per tier — shared between badges, panels, dots. */
export const TIER_COLORS = {
  [TIER.GUEST]:     { text: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    dot: 'bg-zinc-400' },
  [TIER.TRIAL]:     { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  [TIER.FREE]:      { text: 'text-sky-300',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-400' },
  [TIER.PREMIUM]:   { text: 'text-[#c451f1]',   bg: 'bg-[#c451f1]/10',   border: 'border-[#c451f1]/20',   dot: 'bg-[#c451f1]' },
  [TIER.ULTRA]:     { text: 'text-[#f1c40f]',   bg: 'bg-[#f1c40f]/10',   border: 'border-[#f1c40f]/20',   dot: 'bg-[#f1c40f]' },
  [TIER.DEVELOPER]: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
};

/**
 * Rich card-level palette used by plan/feature cards (e.g. AtpAccessModal).
 * Properties match the `accent` shape consumed by PlanCard:
 *   border  — card border ring
 *   bg      — card background fill
 *   text    — primary text / icon colour
 *   iconBg  — icon container background
 *   badge   — tier pill classes (text + bg + border)
 *   topLine — optional decorative top-edge gradient
 *   glow    — optional drop-shadow for the recommended card
 */
export const TIER_CARD = {
  [TIER.PREMIUM]: {
    border:  'border-[#c451f1]/20',
    bg:      'bg-[#c451f1]/[0.03]',
    text:    'text-[#c451f1]',
    iconBg:  'bg-[#c451f1]/[0.08]',
    badge:   'text-[#c451f1]/80 bg-[#c451f1]/10 border-[#c451f1]/20',
    topLine: '',
    glow:    '',
  },
  [TIER.ULTRA]: {
    border:  'border-[#f1c40f]/25',
    bg:      'bg-[#f1c40f]/[0.04]',
    text:    'text-[#f1c40f]',
    iconBg:  'bg-[#f1c40f]/[0.08]',
    badge:   'text-[#f1c40f]/80 bg-[#f1c40f]/10 border-[#f1c40f]/25',
    topLine: 'bg-gradient-to-r from-transparent via-[#f1c40f]/40 to-transparent',
    glow:    'shadow-[0_0_24px_rgba(241,196,15,0.07)]',
  },
};
