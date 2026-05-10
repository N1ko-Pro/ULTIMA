import React from 'react';
import { User, Clock, Shield, Crown, Star, Code2 } from 'lucide-react';
import { TIER, TIER_COLORS } from '@Config/tiers.constants';
import { useLocale } from '@Locales/LocaleProvider';

// ─── BadgeTier ──────────────────────────────────────────────────────────────
// Subscription-tier badge: icon + colored label. Used in the profile panel
// and top-right of the editor view.

const TIER_ICONS = {
  [TIER.GUEST]:     User,
  [TIER.TRIAL]:     Clock,
  [TIER.FREE]:      Shield,
  [TIER.PREMIUM]:   Crown,
  [TIER.ULTRA]:     Star,
  [TIER.DEVELOPER]: Code2,
};

const SIZE = {
  sm: { gap: 'gap-1',   px: 'px-1.5', py: 'py-0.5', rounded: 'rounded-md', icon: 'w-2.5 h-2.5' },
  md: { gap: 'gap-1.5', px: 'px-2',   py: 'py-1',   rounded: 'rounded-lg', icon: 'w-3 h-3' },
};

/**
 * @param {{ tier: string, size?: keyof typeof SIZE }} props
 */
export default function BadgeTier({ tier, size = 'md' }) {
  const t = useLocale();
  const colors = TIER_COLORS[tier] || TIER_COLORS[TIER.GUEST];
  const Icon = TIER_ICONS[tier] || User;
  const dim = SIZE[size] || SIZE.md;
  const label = t.tiers?.[tier] || tier;

  return (
    <span
      className={`inline-flex items-center ${dim.gap} ${dim.px} ${dim.py} ${dim.rounded} text-[11px] font-bold tracking-wide uppercase leading-none border ${colors.text} ${colors.bg} ${colors.border}`}
    >
      <Icon className={dim.icon} />
      {label}
    </span>
  );
}
