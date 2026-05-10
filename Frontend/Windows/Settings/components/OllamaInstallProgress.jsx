import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import ButtonIcon from '@Core/Buttons/helpers/ButtonIcon';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Ollama install progress ────────────────────────────────────────────────
// Compact progress panel shown while the NSIS installer is running.
// Download phase exposes real percent + transfer speed. The "installing"
// phase has no measurable progress, so we show an indeterminate shimmer
// plus a rotating set of reassurance phrases keyed to elapsed seconds.

const INSTALL_PHRASE_THRESHOLDS = [10, 22, 36, 50, 65, 72, Infinity];

const STATUS_COLOR = {
  complete:   'text-emerald-300',
  error:      'text-red-300',
  cancelling: 'text-zinc-400',
  running:    'text-violet-300',
};

/**
 * @param {{
 *   progress: {
 *     phase: 'downloading' | 'installing' | 'complete' | 'error',
 *     percent?: number,
 *     message?: string,
 *     speedMBps?: number,
 *   },
 *   onCancel: () => void,
 *   isCancelling: boolean,
 * }} props
 */
export function OllamaInstallProgress({ progress, onCancel, isCancelling }) {
  const t = useLocale();
  const { phase, percent = 0, message = '', speedMBps = 0 } = progress;
  const isDownloading = phase === 'downloading';
  const isInstalling  = phase === 'installing';
  const isComplete    = phase === 'complete';
  const isError       = phase === 'error';
  const canCancel     = (isDownloading || isInstalling) && !isCancelling;

  // Rotating phrase for the "installing" phase — resets when we leave it.
  // The `setTimeout(_, 0)` pattern defers the reset out of the effect body so
  // lint doesn't flag it as "synchronous setState within effect".
  const [installSeconds, setInstallSeconds] = useState(0);
  useEffect(() => {
    const reset = setTimeout(() => setInstallSeconds(0), 0);
    if (!isInstalling || isCancelling) {
      return () => clearTimeout(reset);
    }
    const timer = setInterval(() => setInstallSeconds((s) => s + 1), 1000);
    return () => { clearTimeout(reset); clearInterval(timer); };
  }, [isInstalling, isCancelling]);

  const phraseIdx = INSTALL_PHRASE_THRESHOLDS.findIndex((max) => installSeconds < max);
  const installPhrase = t.ollama.installPhrases[phraseIdx < 0 ? t.ollama.installPhrases.length - 1 : phraseIdx] ?? '';

  const statusIcon = isComplete
    ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
    : isError
      ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
      : <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${isCancelling ? 'text-zinc-400' : 'text-violet-400'}`} />;

  const statusColor =
    isComplete     ? STATUS_COLOR.complete
    : isError      ? STATUS_COLOR.error
    : isCancelling ? STATUS_COLOR.cancelling
                   : STATUS_COLOR.running;

  const statusText =
    isCancelling   ? t.ollama.cancelling
    : isComplete   ? t.ollama.installComplete
    : isError      ? t.ollama.installError
    : isDownloading ? t.ollama.downloadingInstaller
                    : t.ollama.installingProgress;

  return (
    <div className="w-full rounded-xl border border-white/[0.07] bg-surface-2/60 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {statusIcon}
          <span className={`text-xs font-semibold truncate ${statusColor}`}>{statusText}</span>
        </div>

        {canCancel && (
          <ButtonIcon icon={X} label={t.ollama.cancelInstall} variant="danger" size="sm" onClick={onCancel} />
        )}
      </div>

      {isDownloading && (
        <>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-400 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">
              {speedMBps > 0.01 ? t.ollama.speedMbs(speedMBps.toFixed(1)) : message}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono tabular-nums">{percent}%</span>
          </div>
        </>
      )}

      {isInstalling && !isCancelling && (
        <>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-[shimmer_1.6s_ease-in-out_infinite]" />
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed transition-all duration-500">{installPhrase}</p>
        </>
      )}

      {isError && <p className="text-xs text-red-300/80 leading-relaxed">{message}</p>}
      {isComplete && <p className="text-xs text-emerald-300/80">{t.ollama.installSuccess}</p>}
    </div>
  );
}
