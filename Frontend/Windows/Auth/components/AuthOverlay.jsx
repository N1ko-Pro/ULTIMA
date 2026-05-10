import React, { useState } from 'react';
import { Shield, Gift, Crown, Clock, Sparkles, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { TIER } from '@Config/tiers.constants';
import { MEDIA_LINKS } from '@Config/media.config';
import { useLocale } from '@Locales/LocaleProvider';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { DiscordIcon } from '@UI/Social/SocialIcons';
import * as appWindow from '@API/appWindow';

// ─── Auth overlay modal ─────────────────────────────────────────────────────
// Shown when a user without auto-translate access tries to run the
// pipeline. Three states: guest (must login), logged-in FREE (can start
// trial), logged-in PREMIUM (needs Ultra). Auto-closes if the user already
// has AI access.

export default function AuthOverlay({ isOpen, onClose }) {
  const t = useLocale();
  const { isLoggedIn, tier, trialDaysLeft, canUseAI, startTrial } = useAuth();
  const { isLoggingIn, handleLogin } = useDiscordLogin();

  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [trialError,      setTrialError]      = useState(null);

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

  // Already has access — auto-close (guards against stale isOpen).
  if (isOpen && canUseAI) {
    onClose();
    return null;
  }

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={onClose}
      title={t.auth.aiModalTitle}
      icon={Shield}
      iconColorClass="text-indigo-300"
      iconBgClass="bg-indigo-500/[0.08]"
      iconBorderClass="border-indigo-500/20"
      showCloseIcon
      maxWidthClass="max-w-sm"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-violet-500/[0.1] bg-violet-500/[0.03] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-violet-300/60 mt-0.5 shrink-0" />
            <div className="text-[13px] text-zinc-400 leading-relaxed space-y-1.5">
              <p>{t.auth.aiModalDesc}</p>
              <p className="text-zinc-500">{t.auth.aiModalDescSub}</p>
            </div>
          </div>
        </div>

        {!isLoggedIn && (
          <div className="space-y-3">
            <ButtonCore variant="indigo" fullWidth disabled={isLoggingIn} loading={isLoggingIn} onClick={handleLogin}>
              <DiscordIcon className="w-4 h-4 shrink-0" />
              {isLoggingIn ? t.auth.connecting : t.auth.loginDiscord}
            </ButtonCore>
            <p className="text-center text-[12px] text-zinc-600">{t.auth.loginSafe}</p>
          </div>
        )}

        {isLoggedIn && tier === TIER.FREE && (
          <div className="space-y-3">
            {trialDaysLeft > 0 ? (
              <>
                <ButtonCore variant="warning" icon={Gift} fullWidth disabled={isStartingTrial} loading={isStartingTrial} onClick={handleStartTrial}>
                  {isStartingTrial ? t.auth.activating : t.auth.trialFreeBtn(trialDaysLeft)}
                </ButtonCore>
                {trialError && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] text-red-300/80 text-[12px] leading-snug">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{trialError}</span>
                  </div>
                )}
                <div className="text-center text-[12px] text-zinc-600">{t.common.or}</div>
              </>
            ) : (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                <span className="text-[13px] text-zinc-400">{t.auth.trialEnded}</span>
              </div>
            )}

            <ButtonCore variant="ultra" icon={Crown} fullWidth onClick={() => appWindow.openExternal(MEDIA_LINKS.boosty)}>
              {t.auth.getPremium}
              <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
            </ButtonCore>
          </div>
        )}

        {isLoggedIn && tier === TIER.PREMIUM && (
          <ButtonCore variant="ultra" icon={Crown} fullWidth onClick={() => appWindow.openExternal(MEDIA_LINKS.boosty)}>
            {t.auth.getPremium}
            <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
          </ButtonCore>
        )}

      </div>
    </ModalCore>
  );
}
