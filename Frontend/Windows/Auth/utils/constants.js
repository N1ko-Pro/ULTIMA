import { Zap, Bot, BookOpen, FileCode } from 'lucide-react';
import { TIER, TIER_COLORS } from '@Config/tiers.constants';

// ─── Auth page styling constants ────────────────────────────────────────────
// Local palette for the welcome screen feature cards. Colour keys here
// are semantic labels, not tier ids — they happen to map onto tiers only
// for display purposes.

/** Combined text+bg+border string per tier — derived from TIER_COLORS. */
export const TIER_STYLES = Object.fromEntries(
  Object.entries(TIER_COLORS).map(([key, v]) => [key, `${v.text} ${v.bg} ${v.border}`]),
);

export const ICON_COLORS = {
  violet:  'text-violet-400',
  fuchsia: 'text-fuchsia-400',
  amber:   'text-amber-400',
  sky:     'text-sky-400',
  purple:  'text-[#c451f1]',
  yellow:  'text-[#f1c40f]',
  zinc:    'text-zinc-400',
};

export const BORDER_COLORS = {
  violet:  'border-violet-500/20',
  fuchsia: 'border-fuchsia-500/20',
  amber:   'border-amber-500/20',
  sky:     'border-sky-500/20',
  purple:  'border-[#c451f1]/20',
  yellow:  'border-[#f1c40f]/20',
  zinc:    'border-zinc-500/20',
};

export const GLOW_COLORS = {
  violet:  'from-violet-500/[0.06]',
  fuchsia: 'from-fuchsia-500/[0.06]',
  amber:   'from-amber-500/[0.06]',
  sky:     'from-sky-500/[0.06]',
  purple:  'from-[#c451f1]/[0.06]',
  yellow:  'from-[#f1c40f]/[0.06]',
  zinc:    'from-zinc-500/[0.06]',
};

/**
 * Build the feature list shown on the welcome screen. Uses the locale
 * dictionary to keep titles/descriptions translatable.
 */
export function getFeatures(t) {
  return [
    { icon: Zap,       title: t.welcome.features.smartTitle,      desc: t.welcome.features.smartDesc,      tier: TIER.PREMIUM, color: 'purple' },
    { icon: Bot,       title: t.welcome.features.aiTitle,         desc: t.welcome.features.aiDesc,         tier: TIER.ULTRA,   color: 'yellow' },
    { icon: BookOpen,  title: t.welcome.features.dictionaryTitle, desc: t.welcome.features.dictionaryDesc, tier: TIER.FREE,    color: 'sky'    },
    { icon: FileCode,  title: t.welcome.features.xmlTitle,        desc: t.welcome.features.xmlDesc,        tier: TIER.GUEST,   color: 'zinc'   },
  ];
}
