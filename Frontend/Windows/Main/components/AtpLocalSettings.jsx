import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import DropdownCore from '@Core/Dropdown/DropdownCore';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── AtpLocalSettings ───────────────────────────────────────────────────────
// Settings body shown under the auto-translate panel when the user picks
// "Local AI" mode. Four possible states, derived from `useOllamaStatus`:
//
//   1. Still checking        — loading spinner
//   2. Ollama not running    — warning + "open settings" CTA
//   3. Running, no models    — "install a model" warning
//   4. Ready                 — model dropdown
//
// Stateless — everything is driven by props.

/**
 * @param {{
 *   installedModelNames: string[] | null,
 *   localServerRunning:  boolean | null,
 *   installedOptions:    Array<{ id: string, title: string }>,
 *   effectiveModel:      string,
 *   onChangeModel:       (modelId: string) => void,
 *   onOpenSettings:      (tab?: string) => void,
 * }} props
 */
export default function AtpLocalSettings({
  installedModelNames,
  localServerRunning,
  installedOptions,
  effectiveModel,
  onChangeModel,
  onOpenSettings,
}) {
  const t = useLocale();

  if (installedModelNames === null) {
    return (
      <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-white/[0.07] bg-white/[0.02] text-zinc-600 text-[12px]">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        {t.atp.ollamaChecking}
      </div>
    );
  }

  if (localServerRunning === false) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05]">
          <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
          <span className="text-[11px] text-amber-400/90">{t.atp.ollamaNoServer}</span>
        </div>
        <ButtonCore
          variant="violet"
          size="sm"
          onClick={() => onOpenSettings?.('ollama')}
          style={{ animation: 'borderPulse 3s linear infinite' }}
        >
          {t.ollama.installButton}
        </ButtonCore>
      </div>
    );
  }

  if (installedOptions.length === 0) {
    return (
      <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] text-amber-400/70 text-[12px]">
        <AlertCircle className="w-3 h-3 shrink-0" />
        {t.atp.ollamaNoModels}
      </div>
    );
  }

  return (
    <div className="w-full">
      <label className="text-[10px] font-semibold text-zinc-400 mb-0.5 block">{t.atp.ollamaModelLabel}</label>
      <DropdownCore value={effectiveModel} options={installedOptions} onChange={onChangeModel} />
    </div>
  );
}
