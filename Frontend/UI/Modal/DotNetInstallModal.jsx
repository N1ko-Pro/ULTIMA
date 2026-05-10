import React, { useState } from 'react';
import { Download, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';

export default function DotNetInstallModal({ isOpen, onInstall, onLater, onDismiss }) {
  const t = useLocale();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, downloading, installing, completed, error
  const [error, setError] = useState(null);

  const handleInstall = async () => {
    setStatus('downloading');
    setProgress(0);
    setError(null);

    try {
      await onInstall?.((progressValue) => {
        if (progressValue === -1) {
          setStatus('installing');
          setProgress(100);
        } else {
          setProgress(progressValue);
          if (progressValue >= 100) {
            setStatus('installing');
          }
        }
      });
      setStatus('completed');
    } catch (err) {
      setStatus('error');
      setError(err.message || t.dotnet.errorTitle);
    }
  };

  const handleLater = () => {
    onLater?.();
    onDismiss?.();
  };

  const isBusy = status === 'downloading' || status === 'installing';

  const StatusIcon = status === 'completed' ? CheckCircle2
    : status === 'error' ? AlertTriangle
    : isBusy ? Loader2
    : Download;

  const iconColor = status === 'completed' ? 'text-emerald-400'
    : status === 'error' ? 'text-amber-400'
    : 'text-indigo-400';

  const iconBg = status === 'completed'
    ? 'bg-emerald-500/[0.12] border-emerald-500/[0.25]'
    : 'bg-indigo-500/[0.12] border-indigo-500/[0.25]';

  const titleText = status === 'completed' ? t.dotnet.installed
    : status === 'error' ? t.dotnet.errorTitle
    : status === 'downloading' ? t.dotnet.downloading
    : status === 'installing' ? t.dotnet.installing
    : t.dotnet.title;

  const descText = status === 'idle' ? t.dotnet.descriptionInstall
    : status === 'completed' ? t.dotnet.installedDesc
    : status === 'error' ? error
    : t.dotnet.waitMessage;

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={status === 'idle' ? onDismiss : undefined}
      closeOnOverlayClick={status === 'idle'}
      showCloseIcon={status === 'idle'}
      disableClose={isBusy}
      maxWidthClass="max-w-lg"
      zIndex={250}
      containerClassName="top-9"
      bodyClassName="p-8 space-y-0"
    >
      {/* Icon */}
      <div className="flex items-center justify-center mb-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${iconBg}`}>
          <StatusIcon className={`w-8 h-8 ${iconColor} ${isBusy ? 'animate-spin' : ''}`} />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-[20px] font-semibold text-zinc-100 text-center mb-3">{titleText}</h2>

      {/* Description */}
      <p className="text-[13.5px] text-zinc-400 text-center leading-relaxed mb-6">{descText}</p>

      {/* Progress bar */}
      {isBusy && (
        <div className="mb-6">
          <div className="h-2 bg-surface-3/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-zinc-500">
            <span>{status === 'downloading' ? t.dotnet.downloadingLabel : t.dotnet.installingLabel}</span>
            {status === 'downloading' && <span>{Math.round(progress)}%</span>}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {status === 'idle' && (
          <>
            <ButtonCore variant="emerald" icon={Download} fullWidth size="lg" onClick={handleInstall}>
              {t.dotnet.installNow}
            </ButtonCore>
            <ButtonCore variant="ghost" fullWidth size="lg" onClick={handleLater}>
              {t.dotnet.later}
            </ButtonCore>
          </>
        )}

        {status === 'completed' && (
          <ButtonCore variant="emerald" fullWidth size="lg" onClick={onDismiss}>
            {t.dotnet.continue}
          </ButtonCore>
        )}

        {status === 'error' && (
          <>
            <ButtonCore variant="secondary" fullWidth size="lg" onClick={handleInstall}>
              {t.dotnet.retry}
            </ButtonCore>
            <ButtonCore variant="ghost" fullWidth size="lg" onClick={handleLater}>
              {t.dotnet.later}
            </ButtonCore>
          </>
        )}
      </div>
    </ModalCore>
  );
}
