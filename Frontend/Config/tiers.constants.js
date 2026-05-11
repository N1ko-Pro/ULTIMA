// ─── Access Tiers ────────────────────────────────────────────────────────────
// Mirrors Backend/auth/constants.js — keep in sync.
// Access is binary: GUEST (not logged in) vs FREE/DEVELOPER (logged in).

/** @typedef {'guest' | 'free' | 'developer'} TierId */

/** Identifiers for every supported tier. */
export const TIER = {
  GUEST: 'guest',
  FREE: 'free',
  DEVELOPER: 'developer',
};

/** Human-readable label for each tier (Russian, used by UI). */
export const TIER_LABELS = {
  [TIER.GUEST]: 'Гость',
  [TIER.FREE]: 'Участник',
  [TIER.DEVELOPER]: 'Разработчик',
};

/** Tailwind classnames per tier — shared between badges, panels, dots. */
export const TIER_COLORS = {
  [TIER.GUEST]:     { text: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    dot: 'bg-zinc-400' },
  [TIER.FREE]:      { text: 'text-sky-300',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-400' },
  [TIER.DEVELOPER]: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
};

