import React from 'react';
import { Shield, Bot, Zap, Heart, LogOut, WifiOff, ExternalLink } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { useAuth } from '@Core/Services/AuthService';
import { MEDIA_LINKS } from '@Config/media.config';
import { DiscordIcon } from '@UI/Social/SocialIcons';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import BadgeTier from '@UI/Badge/BadgeTier';
import * as appWindow from '@API/appWindow';

// ─── FeatureRow ─────────────────────────────────────────────────────────────
// Single feature row in the features card: icon + label + active/inactive badge.

function FeatureRow({ icon: Icon, label, active, activeText, noText }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-400' : 'text-zinc-600'}`} />
        <span className={`text-[12px] font-medium ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</span>
      </div>
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        active
          ? 'text-emerald-300 bg-emerald-500/[0.10] border-emerald-500/20'
          : 'text-zinc-400 bg-white/[0.04] border-white/[0.08]'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
        {active ? activeText : noText}
      </span>
    </div>
  );
}

// ─── Expanded profile content ───────────────────────────────────────────────
// Body of the expanded profile drawer — access status, feature list,
// support button, and auth actions. Shared across Auth, Start and Editor panels.

export function ExpandedProfileContent({ isVisible }) {
  const t = useLocale();
  const {
    isLoggedIn, tier, canUseAI, canUseAutoTranslate, isInGuild,
    isLoading, logout, isDeveloper, refreshFailed, isOffline,
  } = useAuth();
  const { isLoggingIn: loggingIn, handleLogin } = useDiscordLogin();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  return (
    <div
      className="space-y-4"
      style={{
        opacity:    isVisible ? 1 : 0,
        transition: 'opacity 280ms cubic-bezier(0.4,0,0.2,1)',
        willChange: 'opacity',
      }}
    >
      {/* ── Account status card ───────────────────────────────────────────── */}
      {isLoggedIn && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            {t.auth.accountSection}
          </p>
          <div className="flex items-center justify-between">
            <BadgeTier tier={tier} />
            {isDeveloper && (
              <span className="text-[11px] font-medium text-emerald-400">∞</span>
            )}
          </div>
          {(refreshFailed || isOffline) && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-400/75">{t.auth.offlineMode}</p>
            </div>
          )}
          {!isInGuild && (
            <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Shield className="w-3 h-3 shrink-0" />
              {t.auth.notOnServer}
            </p>
          )}
        </div>
      )}

      {/* ── Features access card ──────────────────────────────────────────── */}
      {isLoggedIn && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            {t.auth.featuresSection}
          </p>
          <FeatureRow icon={Zap} label={t.auth.atpPremiumFeature} active={canUseAutoTranslate} activeText={t.auth.available} noText={t.auth.notAvailable} />
          <div className="h-px bg-white/[0.04]" />
          <FeatureRow icon={Bot} label={t.auth.atpAiFeature} active={canUseAI} activeText={t.auth.available} noText={t.auth.notAvailable} />
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => appWindow.openExternal(MEDIA_LINKS.boosty)}
            className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] text-rose-300 text-[13px] font-medium hover:bg-rose-500/[0.1] hover:border-rose-500/30 transition-all duration-200"
          >
            <Heart className="w-3.5 h-3.5" />
            <span>{t.auth.supportUs}</span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </button>
        )}
        {isLoggedIn && (
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-white/[0.06] text-zinc-400 text-[13px] font-medium hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.04] transition-all duration-200 disabled:opacity-40"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLoggingOut ? t.auth.loggingOut : t.auth.logout}
          </button>
        )}
        {!isLoggedIn && (
          <button
            type="button"
            onClick={handleLogin}
            disabled={loggingIn || isLoading}
            className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] text-indigo-300 text-[13px] font-medium hover:bg-indigo-500/[0.12] hover:border-indigo-400/40 transition-all duration-200 disabled:opacity-40"
          >
            <DiscordIcon className="w-4 h-4" />
            {loggingIn ? t.auth.connecting : t.auth.loginDiscord}
          </button>
        )}
      </div>
    </div>
  );
}
