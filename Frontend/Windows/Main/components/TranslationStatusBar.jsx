import React from 'react';
import { CheckCircle2, Languages, X } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Translation status bar ─────────────────────────────────────────────────
// Three visual phases driven by `phase` prop:
//   'translating' — white spinner, white bar, progress %, cancel button
//   'applying'    — emerald spinner, full green bar, indeterminate secondary bar
//   'done'        — CheckCircle, full green bar with shimmer, "Completed!"

function TranslationStatusBar({ visible, stage, progress, phase, onCancel }) {
  const t = useLocale();
  if (!visible) return null;

  const safeProgress = Math.max(0, Math.min(100, progress ?? 0));
  const isApplying = phase === 'applying';
  const isDone     = phase === 'done';
  const isComplete = isApplying || isDone;
  const stageLabel = stage || t.editor.autoTranslating;
  const fillWidth  = Math.max(safeProgress, 3);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 h-20 flex items-center justify-between px-8 overflow-hidden animate-[slideInFromTop_0.5s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="absolute inset-0 bg-surface-1/95 backdrop-blur-2xl border-b border-white/[0.08]" />
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] via-transparent to-white/[0.01] pointer-events-none" />

      {/* Emerald tint — fades in when complete */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] via-teal-400/[0.05] to-emerald-500/[0.03] pointer-events-none transition-opacity duration-700"
        style={{ opacity: isComplete ? 1 : 0 }}
      />

      <div className="relative flex items-center justify-between w-full z-10">

        {/* ── Left: icon + text ──────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="relative flex items-center justify-center w-[46px] h-[46px]">
            <div className={`absolute inset-0 rounded-xl border transition-colors duration-500 ${
              isComplete ? 'border-emerald-500/40' : 'border-white/[0.08]'
            }`} />

            {isDone ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 animate-complete-in" />
            ) : isApplying ? (
              <>
                <div className="absolute inset-0 border-2 border-emerald-400/60 rounded-xl border-t-transparent animate-spin" />
                <Languages className="w-6 h-6 text-emerald-400/80" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 border-2 border-white/30 rounded-xl border-t-transparent animate-spin" />
                <Languages className="w-6 h-6 text-white/60" />
              </>
            )}
          </div>

          <div>
            <h4 className="text-sm font-bold text-zinc-200 tracking-wide">{t.editor.autoTranslating}</h4>
            <p className={`text-xs font-medium tracking-wide mt-1 transition-colors duration-500 ${
              isComplete ? 'text-emerald-400' : 'text-zinc-500'
            }`}>
              {stageLabel}
            </p>
          </div>
        </div>

        {/* ── Center: progress bar ───────────────────────────────────────── */}
        <div className="flex-1 max-w-2xl mx-10">
          {/* Main bar */}
          <div className={`w-full h-2.5 bg-surface-2 rounded-full overflow-hidden border relative transition-all duration-500 ${
            isComplete
              ? 'border-emerald-500/30 shadow-[0_0_18px_rgba(52,211,153,0.25)]'
              : 'border-white/[0.06]'
          }`}>
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width,box-shadow] duration-500 ease-out ${
                isComplete
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_16px_rgba(52,211,153,0.5)]'
                  : 'bg-gradient-to-r from-white/40 via-white/25 to-white/15 shadow-[0_0_12px_rgba(255,255,255,0.15)]'
              }`}
              style={{ width: `${fillWidth}%` }}
            />
            {/* Shimmer sweep — always on when bar is full */}
            {isComplete && (
              <div className="absolute inset-y-0 w-[35%] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer pointer-events-none" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent rounded-full mix-blend-overlay pointer-events-none" />
          </div>

          {/* Below bar: indeterminate strip when applying, percent text otherwise */}
          <div className="mt-2 px-1 h-4 flex items-center">
            {isApplying ? (
              <div className="w-full h-[3px] rounded-full overflow-hidden bg-emerald-950/50 relative">
                <div
                  className="absolute top-0 bottom-0 w-[40%] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent"
                  style={{ animation: 'indeterminate 1.5s ease-in-out infinite' }}
                />
              </div>
            ) : (
              <span className={`text-xs font-semibold transition-colors duration-500 ${
                isDone ? 'text-emerald-400' : 'text-zinc-400'
              }`}>
                {t.editor.percentDone(safeProgress)}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: cancel (hidden when complete) ───────────────────────── */}
        {!isComplete && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 group"
            title={t.editor.stopTranslation}
          >
            <X className="w-5 h-5 text-zinc-400 group-hover:text-red-400 transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(TranslationStatusBar);
