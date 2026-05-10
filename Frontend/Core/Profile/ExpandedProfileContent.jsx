import React, { useState } from 'react';
import { Shield, Bot, Zap, Crown, Gift, LogOut, WifiOff } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { useAuth } from '@Core/Services/AuthService';
import { TIER } from '@Config/tiers.constants';
import { notify } from '@Shared/notifications/notifyCore';
import { DiscordIcon } from '@UI/Social/SocialIcons';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import AtpAccessModal from '@UI/Modal/AtpAccessModal';
import BadgeTier from '@UI/Badge/BadgeTier';

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
// Body of the expanded profile drawer — subscription status, feature access
// card, and action buttons. Shared across Auth, Start and Editor profile panels.

export function ExpandedProfileContent({ isVisible }) {
  const t = useLocale();
  const {
    isLoggedIn, tier, trialDaysLeft, subscriptionDaysLeft, canUseAI, canUseAutoTranslate, isInGuild,
    isLoading, logout, startTrial, isDeveloper, refreshFailed, isOffline,
  } = useAuth();
  const { isLoggingIn: loggingIn, handleLogin } = useDiscordLogin();

  const [isLoggingOut,    setIsLoggingOut]    = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isSubModalOpen,  setIsSubModalOpen]  = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    const res = await startTrial();
    setIsStartingTrial(false);
    if (res?.success) notify.success(t.auth.trialActivated, t.auth.trialActivatedDesc);
    else               notify.error(t.common.error, res?.error || t.auth.trialErrorActivate);
  };

  const canStartTrial  = isLoggedIn && tier === TIER.FREE && trialDaysLeft > 0;
  const showSubscribeBtn = isLoggedIn && !canUseAI && trialDaysLeft === 0;
  const isUpgrade      = tier === TIER.PREMIUM;

  return (
    <div
      className="space-y-4"
      style={{
        opacity:    isVisible ? 1 : 0,
        transition: 'opacity 280ms cubic-bezier(0.4,0,0.2,1)',
        willChange: 'opacity',
      }}
    >
      {/* ── Subscription status card ──────────────────────────────────────── */}
      {isLoggedIn && tier !== TIER.GUEST && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            {t.auth.subscriptionSection}
          </p>
          <div className="flex items-center justify-between">
            <BadgeTier tier={tier} />
            {(subscriptionDaysLeft !== null || tier === TIER.TRIAL || isDeveloper) && (
              <span className={`text-[11px] font-medium ${isDeveloper ? 'text-emerald-400' : 'text-zinc-400'}`}>
                {isDeveloper ? '∞' : t.auth.subscriptionDaysLeft(tier === TIER.TRIAL ? trialDaysLeft : subscriptionDaysLeft)}
              </span>
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
          <FeatureRow icon={Bot} label={t.auth.atpAiFeature}      active={canUseAI} activeText={t.auth.available} noText={t.auth.notAvailable} />
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="space-y-2 pt-1">
        {canStartTrial && (
          <button
            type="button"
            onClick={handleStartTrial}
            disabled={isStartingTrial}
            className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] text-amber-300 text-[13px] font-medium hover:bg-amber-500/[0.1] hover:border-amber-500/30 transition-all duration-200 disabled:opacity-40"
          >
            <Gift className="w-3.5 h-3.5" />
            {isStartingTrial ? t.auth.activating : t.auth.trialActivateBtn(trialDaysLeft)}
          </button>
        )}
        {showSubscribeBtn && (
          <button
            type="button"
            onClick={() => setIsSubModalOpen(true)}
            className="w-full flex items-center justify-center gap-2.5 h-10 rounded-xl border border-[#f1c40f]/20 bg-[#f1c40f]/[0.06] text-[#f1c40f] text-[13px] font-medium hover:bg-[#f1c40f]/[0.1] hover:border-[#f1c40f]/30 transition-all duration-200"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>{isUpgrade ? t.auth.upgradeToUltra : t.auth.getSubscription}</span>
          </button>
        )}
        <AtpAccessModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} />
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
