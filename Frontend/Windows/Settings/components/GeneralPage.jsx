import React, { useState } from 'react';
import { Globe, RotateCcw } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';
import UpdateStatusCard from '@Core/Update/UpdateStatusCard';

// ─── GeneralPage ────────────────────────────────────────────────────────────
// "Общее" tab of the Settings dialog. Language picker + reset-tutorial
// affordance + update status card.

const APP_LANGUAGE_OPTIONS = [
  { value: 'ru', label: 'Русский (RU)' },
  { value: 'en', label: 'English (EN)' },
];

export default function GeneralPage({
  appLanguage,
  autoUpdateEnabled,
  onAppLanguageChange,
  onAutoUpdateToggle,
  onResetTutorial,
}) {
  const t = useLocale();

  return (
    <div className="flex flex-col min-h-full animate-[fadeIn_220ms_ease-out]">
      <div className="space-y-4">
        <LanguageRow value={appLanguage} onChange={onAppLanguageChange} />

        {onResetTutorial && (
          <ResetTutorialRow
            onConfirm={() => {
              onResetTutorial();
              notify.success(t.settings.resetTutorialDone, t.settings.resetTutorialDoneDesc);
            }}
          />
        )}

        <UpdateStatusCard autoUpdateEnabled={autoUpdateEnabled} onAutoUpdateToggle={onAutoUpdateToggle} />
      </div>
    </div>
  );
}

function LanguageRow({ value, onChange }) {
  const t = useLocale();
  return (
    <div className="relative w-full rounded-2xl border border-white/[0.07] bg-surface-2/40 backdrop-blur-xl p-4 overflow-hidden flex items-start gap-3.5">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
      <div className="mt-0.5 w-8 h-8 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/[0.18] flex items-center justify-center shrink-0">
        <Globe className="w-4 h-4 text-indigo-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100">{t.settings.language}</p>
        <p className="text-[12px] text-zinc-500 leading-relaxed mt-0.5">{t.settings.languageDesc}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="shrink-0 rounded-xl border border-white/[0.08] bg-surface-3 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-white/[0.18] transition-colors duration-150 cursor-pointer"
      >
        {APP_LANGUAGE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Row with a two-stage confirm: one button → [confirmation banner + Yes/No].
 * The grid-in-grid is used so the two button states share the same footprint
 * and the container doesn't reflow.
 */
function ResetTutorialRow({ onConfirm }) {
  const t = useLocale();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setConfirming(false);
  };

  return (
    <div className="relative w-full rounded-2xl border border-white/[0.07] bg-surface-2/40 backdrop-blur-xl p-4 overflow-hidden flex items-center gap-3.5">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />
      <div className="self-start w-8 h-8 rounded-xl bg-amber-500/[0.08] border border-amber-500/[0.18] flex items-center justify-center shrink-0">
        <RotateCcw className="w-4 h-4 text-amber-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100">{t.settings.resetTutorial}</p>
        <p className="text-[12px] text-zinc-500 leading-relaxed mt-0.5">{t.settings.resetTutorialDesc}</p>
      </div>

      <div className="shrink-0 flex flex-col items-end" style={{ gap: confirming ? '0.5rem' : 0 }}>
        <div
          style={{
            overflow: 'hidden',
            maxHeight: confirming ? '28px' : '0px',
            opacity:   confirming ? 1      : 0,
            transform: confirming ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'max-height 400ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 350ms ease-out, transform 350ms ease-out',
          }}
        >
          <p className="text-[12px] font-semibold text-amber-200/90 whitespace-nowrap leading-7">
            {t.settings.resetTutorialConfirm}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplate: '1fr / 1fr' }}>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{
              gridArea: '1 / 1',
              opacity:       confirming ? 0 : 1,
              transform:     confirming ? 'translateY(4px) scale(0.98)' : 'translateY(0) scale(1)',
              pointerEvents: confirming ? 'none' : 'auto',
              transition: 'opacity 300ms ease-out, transform 350ms cubic-bezier(0.25,0.46,0.45,0.94)',
            }}
            className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2 text-[12px] font-semibold text-amber-300 hover:bg-amber-500/[0.14] hover:border-amber-400/30 whitespace-nowrap"
          >
            {t.settings.resetTutorial}
          </button>

          <div
            style={{
              gridArea: '1 / 1',
              opacity:       confirming ? 1 : 0,
              transform:     confirming ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.98)',
              pointerEvents: confirming ? 'auto' : 'none',
              transition: 'opacity 320ms ease-out 50ms, transform 380ms cubic-bezier(0.34,1.56,0.64,1) 50ms',
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-all duration-150 whitespace-nowrap"
            >
              {t.settings.resetTutorialNo}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.1] px-3 py-2 text-[12px] font-semibold text-amber-300 hover:bg-amber-500/[0.18] hover:border-amber-400/40 hover:shadow-[0_0_16px_rgba(245,158,11,0.2)] active:scale-[0.97] transition-all duration-150 whitespace-nowrap"
            >
              {t.settings.resetTutorialYes}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
