import React from 'react';
import { Shield, User, Code2, ChevronDown, Edit2 } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { TIER, TIER_COLORS } from '@Config/tiers.constants';
import CopyChip from '@Frontend/Core/Profile/CopyChip';

// ─── User status card ───────────────────────────────────────────────────────
// Compact avatar + tier badge used on the welcome screen. Collapses/expands
// a detailed profile section underneath.

const TIER_ICON = {
  [TIER.GUEST]:     User,
  [TIER.FREE]:      Shield,
  [TIER.DEVELOPER]: Code2,
};

export function UserStatusCard({ user, tier, isExpanded, onToggle, profileView, onEditName }) {
  const t = useLocale();
  const colors = TIER_COLORS[tier] || TIER_COLORS[TIER.GUEST];
  const TierIcon = TIER_ICON[tier] || User;

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl app-slide-up"
        style={{ animationDelay: '80ms' }}
      >
        <div className="relative shrink-0">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-10 h-10 rounded-full ring-2 ring-white/[0.08]" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-500" />
            </div>
          )}
          {profileView === 'main' && isExpanded && (
            <button
              type="button"
              onClick={onEditName}
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface-2 border border-white/[0.14] flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition-all duration-200 active:scale-[0.9]"
              aria-label="Редактировать имя"
            >
              <Edit2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-[14px] font-semibold text-zinc-100 truncate">{user?.displayName || user?.username}</p>
          <div className="relative mt-0.5 h-[18px] w-full overflow-hidden">
            {/* Tier badge — visible when collapsed */}
            <div
              className="absolute inset-0 flex items-center gap-2 transition-opacity duration-300"
              style={{ opacity: isExpanded ? 0 : 1, pointerEvents: isExpanded ? 'none' : 'auto' }}
            >
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase leading-none border ${colors.text} ${colors.bg} ${colors.border}`}>
                <TierIcon className="w-2.5 h-2.5" />
                {t.tiers[tier] || tier}
              </span>
            </div>
            {/* Username + ID — visible when expanded */}
            <div
              className="absolute inset-0 flex items-center min-w-0 transition-opacity duration-300"
              style={{ opacity: isExpanded ? 1 : 0, pointerEvents: isExpanded ? 'auto' : 'none' }}
            >
              <p className="text-[11px] font-mono truncate min-w-0">
                <CopyChip value={user?.username}>
                  <span className="text-indigo-300 font-medium">@{user?.username}</span>
                </CopyChip>
                <span className="text-zinc-600"> | </span>
                <CopyChip value={user?.id}>
                  <span className="text-zinc-500">{user?.id}</span>
                </CopyChip>
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="absolute left-1/2 -translate-x-1/2 -bottom-[11px] z-10 flex items-center justify-center w-10 h-[11px] rounded-b-lg bg-white/[0.04] backdrop-blur-xl border border-t-0 border-white/[0.12] hover:border-white/[0.28] hover:bg-white/[0.08] transition-all duration-300 group"
        aria-label="Toggle profile"
      >
        <ChevronDown className={`w-2.5 h-2.5 text-white/40 group-hover:text-white/70 transition-all duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
