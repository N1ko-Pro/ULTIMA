import React from 'react';
import { Languages, X } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Translation status bar ─────────────────────────────────────────────────
// Top-of-editor overlay that replaces the toolbar while auto-translate is
// running. Shows the current stage label, progress percent and a cancel
// button.

function TranslationStatusBar({ visible, stage, progress, onCancel }) {
  const t = useLocale();
  if (!visible) return null;

  const safeProgress = Math.max(0, Math.min(100, progress ?? 0));
  const stageLabel = stage || t.editor.autoTranslating;
  const fillWidth = Math.max(safeProgress, 3);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 h-20 flex items-center justify-between px-8 overflow-hidden animate-[slideInFromTop_0.5s_cubic-bezier(0.16,1,0.3,1)]">
      <div className="absolute inset-0 bg-surface-1/95 backdrop-blur-2xl border-b border-white/[0.08]" />
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] via-transparent to-white/[0.01] pointer-events-none" />

      <div className="relative flex items-center justify-between w-full z-10">
        <div className="flex items-center gap-5">
          <div className="relative flex items-center justify-center w-[46px] h-[46px]">
            <div className="absolute inset-0 border border-white/[0.08] rounded-xl" />
            <div className="absolute inset-0 border-2 border-white/30 rounded-xl border-t-transparent animate-spin" />
            <Languages className="w-6 h-6 text-white/60" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-200 tracking-wide">{t.editor.autoTranslating}</h4>
            <p className="text-xs text-zinc-500 font-medium tracking-wide flex items-center mt-1">{stageLabel}</p>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-10">
          <div className="w-full h-2.5 bg-surface-2 backdrop-blur-md rounded-full overflow-hidden border border-white/[0.06] relative">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-white/40 via-white/25 to-white/15 transition-[width] duration-300 ease-out shadow-[0_0_12px_rgba(255,255,255,0.15)]"
              style={{ width: `${fillWidth}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent w-full h-full rounded-full mix-blend-overlay" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-semibold px-1">
            <span className="text-zinc-400">{t.editor.percentDone(safeProgress)}</span>
          </div>
        </div>

        {onCancel && (
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
