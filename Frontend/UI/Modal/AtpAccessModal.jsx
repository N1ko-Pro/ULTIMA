import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';
import { Shield, Sparkles } from 'lucide-react';
import { DiscordIcon } from '@UI/Social/SocialIcons';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';

// ─── AtpAccessModal ───────────────────────────────────────────────────
// Shown when a guest tries to open a feature that requires Discord login.

export default function AtpAccessModal({ isOpen, onClose }) {
  const t = useLocale();
  const { isLoggingIn, handleLogin } = useDiscordLogin(onClose);

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={onClose}
      title={t.auth.atpAccessTitle}
      subtitle={t.settings.requiresAuth}
      subtitleClassName="text-red-400/70"
      icon={Shield}
      iconColorClass="text-indigo-300"
      iconBgClass="bg-indigo-500/[0.08]"
      iconBorderClass="border-indigo-500/20"
      showCloseIcon
      closeOnOverlayClick
      maxWidthClass="max-w-sm"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-violet-500/[0.1] bg-violet-500/[0.03] p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-violet-300/60 mt-0.5 shrink-0" />
            <p className="text-[13px] text-zinc-400 leading-relaxed">{t.auth.loginPromptDesc}</p>
          </div>
        </div>
        <ButtonCore variant="indigo" fullWidth size="lg" disabled={isLoggingIn} loading={isLoggingIn} onClick={handleLogin}>
          <DiscordIcon className="w-4 h-4 shrink-0" />
          {isLoggingIn ? t.auth.connecting : t.auth.loginDiscord}
        </ButtonCore>
        <p className="text-center text-[12px] text-zinc-600">{t.auth.loginSafe}</p>
      </div>
    </ModalCore>
  );
}
