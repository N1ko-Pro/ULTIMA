import React from 'react';
import { Languages, Package, Settings, DownloadCloud, UploadCloud } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Editor top-bar buttons ─────────────────────────────────────────────────
// A collection of the larger action buttons rendered in the editor top bar.
// Each is self-contained and receives a single click handler.

export function AutoTranslateButton({ disabled, isTranslating, onOpen, className = '' }) {
  const t = useLocale();
  const isDisabled = disabled || isTranslating;
  const baseClass = isDisabled
    ? 'bg-surface-2/50 border-white/[0.04] opacity-40 cursor-not-allowed'
    : 'bg-violet-500/[0.10] border-violet-400/[0.18] hover:bg-violet-500/[0.16] hover:border-violet-400/[0.32] hover:shadow-[0_0_24px_rgba(167,139,250,0.15)] active:scale-[0.97]';

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isDisabled}
      className={`group relative flex h-[52px] items-center justify-center gap-3 px-7 rounded-2xl border transition-all duration-200 overflow-hidden shrink-0 ${className} ${baseClass}`}
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-400/0 via-violet-400/[0.06] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <Languages className={`relative z-10 w-5 h-5 transition-all duration-200 ${isDisabled ? 'text-white/20' : 'text-violet-300/80 group-hover:text-violet-200 group-hover:-translate-y-0.5'}`} />
      <span className={`relative z-10 text-[14px] font-semibold tracking-wide whitespace-nowrap ${isDisabled ? 'text-white/20' : 'text-zinc-200 group-hover:text-white'}`}>
        {t.editor.autoTranslate}
      </span>
    </button>
  );
}

export function PackButton({ onPack }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onPack}
      className="group relative flex h-[42px] items-center justify-center gap-2.5 px-5 rounded-xl bg-blue-500/[0.1] border border-blue-400/[0.2] transition-all duration-200 hover:bg-blue-500/[0.16] hover:border-blue-400/[0.32] hover:shadow-[0_0_24px_rgba(96,165,250,0.12)] overflow-hidden active:scale-[0.97]"
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/0 via-blue-400/[0.06] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <Package className="relative z-10 w-4 h-4 text-blue-300/80 group-hover:text-blue-200 transition-all duration-200 group-hover:-translate-y-0.5" />
      <span className="relative z-10 text-[13px] font-semibold text-blue-200/80 tracking-wide group-hover:text-blue-100">{t.editor.pack}</span>
    </button>
  );
}

export function SettingsButton({ onSettings }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onSettings}
      title={t.editor.settings}
      aria-label={t.editor.settings}
      className="group relative flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2] hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] active:scale-[0.95] overflow-hidden"
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-white/0 via-white/[0.04] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <Settings className="relative z-10 w-4 h-4 text-zinc-300 group-hover:text-white transition-all duration-500 group-hover:rotate-90" />
    </button>
  );
}

function ExportButton({ onExport }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onExport}
      title={t.editor.exportTitle}
      className="group relative flex h-[42px] items-center justify-center gap-2.5 px-5 rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2] hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] overflow-hidden active:scale-[0.97]"
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/0 via-blue-400/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <DownloadCloud className="relative z-10 w-4 h-4 text-blue-300/80 group-hover:text-blue-200 group-hover:translate-y-0.5 transition-all duration-200" />
      <span className="relative z-10 text-[13px] font-semibold text-zinc-200 group-hover:text-white tracking-wide">{t.editor.export}</span>
    </button>
  );
}

function ImportButton({ onImport }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onImport}
      title={t.editor.importTitle}
      className="group relative flex h-[42px] items-center justify-center gap-2.5 px-5 rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2] hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] overflow-hidden active:scale-[0.97]"
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <UploadCloud className="relative z-10 w-4 h-4 text-emerald-300/80 group-hover:text-emerald-200 group-hover:-translate-y-0.5 transition-all duration-200" />
      <span className="relative z-10 text-[13px] font-semibold text-zinc-200 group-hover:text-white tracking-wide">{t.editor.import}</span>
    </button>
  );
}

/** Labelled border-group that frames the XML import/export pair. */
export function XmlActionGroup({ onImport, onExport }) {
  return (
    <GroupFrame label="XML">
      <ImportButton onImport={onImport} />
      <ExportButton onExport={onExport} />
    </GroupFrame>
  );
}

/** Labelled border-group that frames the tools strip on the left. */
export function ToolsGroup({ children, className = '', ...rest }) {
  return (
    <GroupFrame label="TOOLS" className={className} {...rest}>
      {children}
    </GroupFrame>
  );
}

/**
 * Shared "tab-style" border frame with a caption on the top edge. Used by
 * both XmlActionGroup and ToolsGroup. Keeping this here avoids duplicating
 * the decorative top-edge markup twice.
 */
function GroupFrame({ label, children, className = '', ...rest }) {
  return (
    <div className={`relative flex items-center gap-2 px-2 mt-2 mb-2 ${className}`} {...rest}>
      <div className="absolute -top-[14px] left-4 right-4 flex items-center justify-center pointer-events-none">
        <div className="w-full h-2 border-t border-l border-white/[0.1] rounded-tl-lg" />
        <span className="text-[9px] text-zinc-600 font-bold px-1.5 tracking-widest leading-none bg-surface-1">{label}</span>
        <div className="w-full h-2 border-t border-r border-white/[0.1] rounded-tr-lg" />
      </div>
      {children}
    </div>
  );
}
