import React, { useMemo } from 'react';
import { Sparkles, Rocket } from 'lucide-react';
import useUpdater from '@Core/Services/UpdaterService';
import { useLocale } from '@Locales/LocaleProvider';
import { stripHtml } from '@Shared/helpers/strings';
import { useInstallAnimation } from '@Core/Update/helpers/installProgress';
import InstallProgressPanel from '@Core/Update/helpers/InstallProgressPanel';
import ModalCore from '@Core/Modal/ModalCore';

// ─── UpdateAvailableModal ───────────────────────────────────────────────────
// Shows once the update has been silently downloaded in the background.
// App.jsx gates opening to workspace/editor pages and waits for first-run
// tutorials to complete. The user picks "Later" (defers to the TitleBar pill)
// or "Update" (triggers the in-app install animation then restarts).

export default function UpdateAvailableModal({ isOpen, onDismiss }) {
  const t = useLocale();
  const { state, currentVersion, install, finalizeInstall } = useUpdater();

  const notes        = useMemo(() => stripHtml(state.info?.releaseNotes || ''), [state.info?.releaseNotes]);
  const isInstalling = state.status === 'installing';

  const installPercent = useInstallAnimation(isInstalling, finalizeInstall);

  const modalOpen = isOpen || isInstalling;

  const subtitle = state.version
    ? t.updates.modal.subtitle(currentVersion || '—', state.version)
    : null;

  return (
    <ModalCore
      isOpen={modalOpen}
      onClose={isInstalling ? undefined : onDismiss}
      title={isInstalling ? undefined : t.updates.modal.readyTitle}
      subtitle={isInstalling ? undefined : subtitle}
      icon={isInstalling ? undefined : Sparkles}
      iconColorClass="text-indigo-300"
      iconBgClass="bg-indigo-500/[0.1]"
      iconBorderClass="border-indigo-500/[0.22]"
      showCloseIcon={!isInstalling}
      closeOnOverlayClick={!isInstalling}
      disableClose={isInstalling}
      maxWidthClass="max-w-md"
      zIndex={150}
      bodyClassName={isInstalling ? 'p-6 space-y-0' : undefined}
      footer={isInstalling ? undefined : (
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all duration-150"
          >
            {t.updates.modal.later}
          </button>
          <button
            type="button"
            onClick={install}
            className="flex-1 rounded-xl border border-indigo-400/30 bg-indigo-500/[0.12] px-4 py-2.5 text-[13px] font-semibold text-indigo-200 hover:bg-indigo-500/[0.22] hover:border-indigo-400/50 hover:shadow-[0_0_16px_rgba(139,92,246,0.25)] transition-all duration-150 flex items-center justify-center gap-2"
          >
            <Rocket className="w-4 h-4" />
            {t.updates.updateBtn}
          </button>
        </div>
      )}
    >
      {isInstalling ? (
        <InstallProgressPanel
          percent={installPercent}
          currentVersion={currentVersion}
          targetVersion={state.version}
          t={t}
        />
      ) : (
        <>
          <p className="text-[13px] text-zinc-300 leading-relaxed">
            {t.updates.modal.readyBody}
          </p>

          {notes && (
            <div className="rounded-xl border border-white/[0.06] bg-surface-1/40 p-3 max-h-44 overflow-y-auto">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">
                {t.updates.whatsNew}
              </p>
              <pre className="text-[12px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed">
                {notes}
              </pre>
            </div>
          )}
        </>
      )}
    </ModalCore>
  );
}
