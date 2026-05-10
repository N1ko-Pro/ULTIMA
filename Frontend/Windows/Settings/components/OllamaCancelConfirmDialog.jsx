import React from 'react';
import { XCircle } from 'lucide-react';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Ollama cancel-confirm dialog ───────────────────────────────────────────
// Inline panel shown while the user is mid-install and has clicked the
// cancel icon. Swaps copy depending on whether we're still in the download
// phase or already installing (the latter leaves files behind and requires
// a clean-up).

/**
 * @param {{
 *   onConfirm: () => void,
 *   onAbort: () => void,
 *   isInstallingPhase: boolean,
 * }} props
 */
export function OllamaCancelConfirmDialog({ onConfirm, onAbort, isInstallingPhase }) {
  const t = useLocale();
  const description = isInstallingPhase
    ? t.ollama.cancelInstallPhaseInstall
    : t.ollama.cancelInstallPhaseDownload;

  return (
    <div className="w-full rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-3 animate-[fadeIn_150ms_ease-out]">
      <div className="flex items-start gap-2.5">
        <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-200 mb-1">{t.ollama.cancelInstallTitle}</p>
          <p className="text-[11px] text-amber-200/60 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ButtonCore variant="danger" size="sm" className="flex-1" onClick={onConfirm}>
          {t.ollama.cancelInstallYes}
        </ButtonCore>
        <ButtonCore variant="secondary" size="sm" className="flex-1" onClick={onAbort}>
          {t.ollama.cancelInstallNo}
        </ButtonCore>
      </div>
    </div>
  );
}
