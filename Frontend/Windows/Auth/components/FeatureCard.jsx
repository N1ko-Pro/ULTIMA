import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';
import { TIER_STYLES, ICON_COLORS, BORDER_COLORS, GLOW_COLORS } from '../utils/constants';

// ─── Feature card ───────────────────────────────────────────────────────────
// Single card in the welcome-screen feature grid.

export function FeatureCard({ icon: Icon, title, desc, tier, color, index }) {
  const t = useLocale();
  return (
    <div
      className={`relative rounded-2xl border ${BORDER_COLORS[color]} bg-white/[0.03] p-5 app-slide-up h-full flex flex-col`}
      style={{ animationDelay: `${150 + index * 80}ms` }}
    >
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${GLOW_COLORS[color]} to-transparent opacity-60 pointer-events-none`} />
      <div className="absolute inset-x-0 top-0 h-[1px] rounded-t-2xl bg-gradient-to-r from-transparent via-white/[0.1] to-transparent opacity-50" />
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 30% 20%, rgba(255,255,255,0.02) 0%, transparent 70%)' }}
      />

      <div className="relative flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center shrink-0">
          <Icon className={`w-[18px] h-[18px] ${ICON_COLORS[color]}`} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="text-[13px] font-semibold text-zinc-200 mb-1">{title}</h3>
          <p className="text-[12px] text-zinc-500 leading-relaxed flex-1">{desc}</p>
          <span className={`inline-block mt-2 self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${TIER_STYLES[tier]}`}>
            {t.tiers[tier] || tier}
          </span>
        </div>
      </div>
    </div>
  );
}
