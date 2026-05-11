import React from 'react';
import { Shield, Sparkles } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { DiscordIcon } from '@UI/Social/SocialIcons';

// ─── Auth overlay modal ─────────────────────────────────────────────────────
// Shown when a guest tries to use AI mode in the auto-translate panel.
// Auto-closes if the user already has AI access.

export default function AuthOverlay({ isOpen, onClose }) {
  const t = useLocale();
  const { canUseAI } = useAuth();
  const { isLoggingIn, handleLogin } = useDiscordLogin(onClose);

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
            <p className="text-[13px] text-zinc-400 leading-relaxed">{t.auth.aiModalDesc}</p>
          </div>
        </div>
        <div className="space-y-3">
          <ButtonCore variant="indigo" fullWidth disabled={isLoggingIn} loading={isLoggingIn} onClick={handleLogin}>
            <DiscordIcon className="w-4 h-4 shrink-0" />
            {isLoggingIn ? t.auth.connecting : t.auth.loginDiscord}
          </ButtonCore>
          <p className="text-center text-[12px] text-zinc-600">{t.auth.loginSafe}</p>
        </div>
      </div>
    </ModalCore>
  );
}
