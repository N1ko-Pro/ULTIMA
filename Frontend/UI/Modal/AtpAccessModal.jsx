import React, { useState } from 'react';
import { useAuth } from '@Core/Services/AuthService';
import { TIER, TIER_CARD } from '@Config/tiers.constants';
import { useLocale } from '@Locales/LocaleProvider';
import { Zap, Bot, Crown, ExternalLink, Gift, AlertCircle, Check, X, Star, CheckCircle2, Sparkles } from 'lucide-react';
import { DiscordIcon } from '@UI/Social/SocialIcons';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import { MEDIA_LINKS } from '@Config/media.config';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import * as appWindow from '@API/appWindow';

// ─── Feature row ────────────────────────────────────────────────────────────────

function FeatureRow({ label, enabled, color }) {
  return (
    <div className="flex items-center gap-2.5">
      {enabled
        ? <Check className={`w-4 h-4 shrink-0 ${color}`} />
        : <X className="w-4 h-4 shrink-0 text-zinc-700" />
      }
      <span className={`text-[13px] ${enabled ? 'text-zinc-300' : 'text-zinc-600'}`}>{label}</span>
    </div>
  );
}

// ─── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({ icon: Icon, tierLabel, title, features, btnLabel, buttonVariant, accent, recommended, onClick, isCurrent, currentLabel }) {
  return (
    <div className={`relative rounded-xl border overflow-hidden transition-all duration-200 ${accent.border} ${accent.bg} ${recommended ? accent.glow : ''}`}>
      {isCurrent && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50">
          <Sparkles className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <span className="text-[13px] font-bold text-emerald-300 tracking-wide drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">{currentLabel}</span>
        </div>
      )}
      {recommended && (
        <div className={`absolute top-0 inset-x-0 h-[1px] ${accent.topLine}`} />
      )}

      {recommended && (
        <span className={`absolute top-3 right-3 inline-flex items-center justify-center w-6 h-6 rounded-full border ${accent.badge}`}>
          <Star className="w-3 h-3" />
        </span>
      )}

      <div
        className="p-5 flex flex-col gap-4 h-full"
        style={isCurrent ? { filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' } : undefined}
      >
        <div className="flex items-center gap-2.5 pr-24">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${accent.iconBg} ${accent.border}`}>
            <Icon className={`w-8 h-5 ${accent.text}`} />
          </div>
          <span className={`text-[15px] font-bold tracking-wide ${accent.text}`}>{tierLabel}</span>
        </div>

        <p className="text-[14px] font-semibold text-zinc-200 leading-snug">{title}</p>

        <div className="flex flex-col gap-2">
          {features.map((f, i) => (
            <FeatureRow key={i} label={f.label} enabled={f.enabled} color={accent.text} />
          ))}
        </div>

        <ButtonCore variant={buttonVariant} icon={Crown} fullWidth onClick={onClick}>
          {btnLabel}
          <ExternalLink className="w-3.5 h-3.5 opacity-50 shrink-0" />
        </ButtonCore>
      </div>
    </div>
  );
}

// ─── AtpAccessModal ───────────────────────────────────────────────────

export default function AtpAccessModal({ isOpen, onClose }) {
  const t = useLocale();
  const { isLoggedIn, tier, trialDaysLeft, startTrial } = useAuth();
  const { isLoggingIn, handleLogin } = useDiscordLogin(onClose);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [trialError, setTrialError] = useState(null);

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    setTrialError(null);
    const res = await startTrial();
    setIsStartingTrial(false);
    if (res?.success) {
      onClose();
    } else {
      setTrialError(res?.error || t.auth.connectionError);
    }
  };

  const canStartTrial  = isLoggedIn && tier === TIER.FREE && trialDaysLeft > 0;
  const isPremiumUser  = tier === TIER.PREMIUM;
  const smartFeature   = t.auth.atpPremiumFeature;

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={onClose}
      title={t.auth.subscriptionModalTitle}
      subtitle={
        isPremiumUser
          ? t.auth.upgradeSubtitle
          : isLoggedIn ? t.auth.atpAccessSubtitle : t.settings.requiresAuth
      }
      subtitleClassName={isPremiumUser ? 'text-amber-400/70' : 'text-red-400/70'}
      icon={Zap}
      iconColorClass="text-indigo-300"
      iconBgClass="bg-indigo-500/[0.08]"
      iconBorderClass="border-indigo-500/20"
      showCloseIcon
      closeOnOverlayClick
      maxWidthClass="max-w-lg"
      headerClassName="px-7 pt-7 pb-5"
      bodyClassName="px-7 py-6 space-y-4"
    >
      {!isLoggedIn ? (
        <>
          <p className="text-[14px] text-zinc-400 leading-relaxed">{t.auth.loginPromptDesc}</p>
          <ButtonCore variant="indigo" fullWidth size="lg" disabled={isLoggingIn} onClick={handleLogin}>
            <DiscordIcon className="w-4 h-4 shrink-0" />
            {isLoggingIn ? t.auth.connecting : t.auth.loginDiscord}
          </ButtonCore>
          <p className="text-center text-[12px] text-zinc-600">{t.auth.loginSafe}</p>
        </>
      ) : (
        <>
          <p className="text-[14px] text-zinc-400 leading-relaxed">{t.auth.atpAccessDesc}</p>

          <div className="grid grid-cols-2 gap-3">
            <PlanCard
              icon={Zap}
              tierLabel={t.tiers.premium}
              title={t.auth.atpPremiumFeature}
              features={[
                { label: smartFeature, enabled: true },
                { label: t.auth.atpAiFeature, enabled: false },
              ]}
              btnLabel={t.auth.atpPremiumBtn}
              buttonVariant="premium"
              accent={TIER_CARD[TIER.PREMIUM]}
              recommended={false}
              onClick={() => appWindow.openExternal(MEDIA_LINKS.boosty)}
              isCurrent={isPremiumUser}
              currentLabel={t.auth.subscriptionActive}
            />
            <PlanCard
              icon={Bot}
              tierLabel={t.tiers.ultra}
              title={t.auth.atpUltraFeature}
              features={[
                { label: smartFeature, enabled: true },
                { label: t.auth.atpAiFeature, enabled: true },
              ]}
              btnLabel={t.auth.atpUltraBtn}
              buttonVariant="ultra"
              accent={TIER_CARD[TIER.ULTRA]}
              recommended={true}
              onClick={() => appWindow.openExternal(MEDIA_LINKS.boosty)}
            />
          </div>

          {canStartTrial && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[11px] text-zinc-600">{t.common.or}</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <ButtonCore
                variant="warning"
                icon={Gift}
                fullWidth
                disabled={isStartingTrial}
                loading={isStartingTrial}
                onClick={handleStartTrial}
              >
                {isStartingTrial ? t.auth.activating : t.auth.trialFreeBtn(trialDaysLeft)}
              </ButtonCore>
              {trialError && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] text-red-300/80 text-[12px] leading-snug">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{trialError}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </ModalCore>
  );
}
