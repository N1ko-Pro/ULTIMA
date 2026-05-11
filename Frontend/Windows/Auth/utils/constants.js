import { Zap, Bot, BookOpen, FileCode } from 'lucide-react';

// ─── Auth page styling constants ────────────────────────────────────────────
// Local palette for the welcome screen feature cards.

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
    { icon: Zap,       title: t.welcome.features.smartTitle,      desc: t.welcome.features.smartDesc,      color: 'violet' },
    { icon: Bot,       title: t.welcome.features.aiTitle,         desc: t.welcome.features.aiDesc,         color: 'sky'    },
    { icon: BookOpen,  title: t.welcome.features.dictionaryTitle, desc: t.welcome.features.dictionaryDesc, color: 'amber'  },
    { icon: FileCode,  title: t.welcome.features.xmlTitle,        desc: t.welcome.features.xmlDesc,        color: 'zinc'   },
  ];
}
