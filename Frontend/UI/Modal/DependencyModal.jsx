import React, { useState } from 'react';
import { Download, AlertTriangle, CheckCircle2, Loader2, Puzzle } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';

// ─── DependencyModal ─────────────────────────────────────────────────────────
// Generic, game-agnostic "install required tools" dialog. Driven by the missing
// dependency list a game module reports. Used by My Summer Car (download the
// dnlib-based MscLocTool) and reusable for any future game dependency.

export default function DependencyModal({ isOpen, missing, onInstall, onClose }) {
  const t = useLocale();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, installing, completed, error
  const [error, setError] = useState(null);

  const items = missing || [];
  const isUpdate = items.some((dep) => dep.outdated);

  const handleInstall = async () => {
    setStatus('installing');
    setProgress(0);
    setError(null);
    try {
      await onInstall?.((percent) => setProgress(percent));
      setStatus('completed');
    } catch (err) {
      setStatus('error');
      setError(err?.message || t.deps.errorDesc);
    }
  };

  const isBusy = status === 'installing';

  const StatusIcon = status === 'completed' ? CheckCircle2
    : status === 'error' ? AlertTriangle
    : isBusy ? Loader2
    : Puzzle;

  const iconColor = status === 'completed' ? 'text-emerald-400'
    : status === 'error' ? 'text-amber-400'
    : 'text-indigo-400';

  const iconBg = status === 'completed'
    ? 'bg-emerald-500/[0.12] border-emerald-500/[0.25]'
    : status === 'error'
      ? 'bg-amber-500/[0.12] border-amber-500/[0.25]'
      : 'bg-indigo-500/[0.12] border-indigo-500/[0.25]';

  const titleText = status === 'completed' ? t.deps.installed
    : status === 'error' ? t.deps.errorTitle
    : isBusy ? t.deps.installing
    : isUpdate ? t.deps.updateTitle
    : t.deps.title;

  const descText = status === 'completed' ? t.deps.installedDesc
    : status === 'error' ? error
    : isBusy ? t.deps.waitMessage
    : isUpdate ? t.deps.updateDescription
    : t.deps.description;

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={status === 'idle' ? onClose : undefined}
      closeOnOverlayClick={status === 'idle'}
      showCloseIcon={status === 'idle'}
      disableClose={isBusy}
      maxWidthClass="max-w-lg"
      zIndex={260}
      containerClassName="top-9"
      bodyClassName="p-8 space-y-0"
    >
      <div className="flex items-center justify-center mb-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${iconBg}`}>
          <StatusIcon className={`w-8 h-8 ${iconColor} ${isBusy ? 'animate-spin' : ''}`} />
        </div>
      </div>

      <h2 className="text-[20px] font-semibold text-zinc-100 text-center mb-3">{titleText}</h2>
      <p className="text-[13.5px] text-zinc-400 text-center leading-relaxed mb-6">{descText}</p>

      {status === 'idle' && items.length > 0 && (
        <div className="mb-6 space-y-2">
          {items.map((dep) => (
            <div key={dep.id} className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
              <span className="text-[13px] font-medium text-zinc-200">{dep.name}</span>
              <div className="flex items-center gap-2.5">
                {dep.outdated && dep.installedVersion && (
                  <span className="text-[11px] text-zinc-600 line-through">v{dep.installedVersion}</span>
                )}
                {dep.version && <span className="text-[12px] font-medium text-indigo-300/90">v{dep.version}</span>}
                {dep.sizeMb ? <span className="text-[12px] text-zinc-500">≈ {dep.sizeMb} {t.deps.mb}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {isBusy && (
        <div className="mb-6">
          <div className="h-2 bg-surface-3/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-zinc-500">
            <span>{t.deps.downloadingLabel}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {status === 'idle' && (
          <>
            <ButtonCore variant="emerald" icon={Download} fullWidth size="lg" onClick={handleInstall}>
              {isUpdate ? t.deps.updateNow : t.deps.installNow}
            </ButtonCore>
            <ButtonCore variant="ghost" size="lg" className="self-center" onClick={onClose}>
              {t.deps.later}
            </ButtonCore>
          </>
        )}

        {status === 'completed' && (
          <ButtonCore variant="emerald" fullWidth size="lg" onClick={onClose}>
            {t.deps.continue}
          </ButtonCore>
        )}

        {status === 'error' && (
          <>
            <ButtonCore variant="secondary" fullWidth size="lg" onClick={handleInstall}>
              {t.deps.retry}
            </ButtonCore>
            <ButtonCore variant="ghost" size="lg" className="self-center" onClick={onClose}>
              {t.common.close}
            </ButtonCore>
          </>
        )}
      </div>
    </ModalCore>
  );
}
