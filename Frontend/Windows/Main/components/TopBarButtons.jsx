import React, { useRef, useEffect, useState } from 'react';
import { Languages, Package, Settings, DownloadCloud, UploadCloud, FolderOpen } from 'lucide-react';
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

  // Swap the full label for a short one ("Авто") when the button is too narrow
  // to show it — nicer than an ellipsis. We compare the full label's intrinsic
  // width (measured via a hidden probe) against the space left for the label
  // inside the button. Hysteresis prevents flicker at the threshold.
  const btnRef = useRef(null);
  const probeRef = useRef(null);
  const shortRef = useRef(false);
  const [short, setShort] = useState(false);

  useEffect(() => {
    const btn = btnRef.current;
    const probe = probeRef.current;
    if (!btn || !probe || typeof ResizeObserver === 'undefined') return undefined;
    const OVERHEAD = 88; // px-7 (56) + icon (20) + gap-3 (12) — everything but the label
    const HYST = 12;
    const measure = () => {
      const fullWidth = probe.offsetWidth;
      const available = btn.clientWidth - OVERHEAD;
      if (!shortRef.current && fullWidth > available) { shortRef.current = true; setShort(true); }
      else if (shortRef.current && fullWidth <= available - HYST) { shortRef.current = false; setShort(false); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(btn);
    return () => ro.disconnect();
  }, []);

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onOpen}
      disabled={isDisabled}
      title={t.editor.autoTranslate}
      className={`group relative flex h-[52px] items-center justify-center gap-3 px-7 rounded-2xl border transition-all duration-200 overflow-hidden ${className} ${baseClass}`}
    >
      {/* Hidden probe holding the FULL label, used only to measure its width. */}
      <span
        ref={probeRef}
        aria-hidden="true"
        className="absolute -z-10 opacity-0 pointer-events-none whitespace-nowrap text-[14px] font-semibold tracking-wide"
      >
        {t.editor.autoTranslate}
      </span>
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-400/0 via-violet-400/[0.06] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <Languages className={`relative z-10 w-5 h-5 shrink-0 transition-all duration-200 ${isDisabled ? 'text-white/20' : 'text-violet-300/80 group-hover:text-violet-200 group-hover:-translate-y-0.5'}`} />
      <span className={`relative z-10 text-[14px] font-semibold tracking-wide truncate ${isDisabled ? 'text-white/20' : 'text-zinc-200 group-hover:text-white'}`}>
        {short ? t.editor.autoTranslateShort : t.editor.autoTranslate}
      </span>
    </button>
  );
}

export function PackButton({ onPack, compact = false }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onPack}
      title={t.editor.pack}
      aria-label={t.editor.pack}
      className={`group relative flex h-[42px] items-center justify-center rounded-xl bg-blue-500/[0.1] border border-blue-400/[0.2] transition-all duration-200 hover:bg-blue-500/[0.16] hover:border-blue-400/[0.32] hover:shadow-[0_0_24px_rgba(96,165,250,0.12)] overflow-hidden active:scale-[0.97] shrink-0 ${compact ? 'w-[42px]' : 'gap-2.5 px-5'}`}
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/0 via-blue-400/[0.06] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <Package className="relative z-10 w-4 h-4 text-blue-300/80 group-hover:text-blue-200 transition-all duration-200 group-hover:-translate-y-0.5" />
      {!compact && <span className="relative z-10 text-[13px] font-semibold text-blue-200/80 tracking-wide group-hover:text-blue-100 whitespace-nowrap">{t.editor.pack}</span>}
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

// Per-accent hover treatment for the shared TOOLS icon button. Mirrors the
// original colour highlight (tinted text + border + bg + glow) and radial
// overlay each button had — only the resting container is unified to the
// top bar's glass base (bg-white/[0.06] + white border).
const ICON_ACCENTS = {
  amber:   { hover: 'hover:text-amber-300 hover:border-amber-400/20 hover:bg-amber-400/[0.06] hover:shadow-[0_0_16px_rgba(251,191,36,0.1)]',  overlay: 'from-amber-400/0 via-amber-400/[0.05] to-transparent' },
  sky:     { hover: 'hover:text-sky-300 hover:border-sky-400/20 hover:bg-sky-400/[0.06] hover:shadow-[0_0_16px_rgba(56,189,248,0.1)]',         overlay: 'from-sky-400/0 via-sky-400/[0.05] to-transparent' },
  emerald: { hover: 'hover:text-emerald-300 hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:shadow-[0_0_16px_rgba(52,211,153,0.1)]', overlay: 'from-emerald-400/0 via-emerald-400/[0.05] to-transparent' },
  violet:  { hover: 'hover:text-violet-300 hover:border-violet-400/20 hover:bg-violet-400/[0.06] hover:shadow-[0_0_16px_rgba(167,139,250,0.12)]', overlay: 'from-violet-400/0 via-violet-400/[0.05] to-transparent' },
  red:     { hover: 'hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.06] hover:shadow-[0_0_16px_rgba(248,113,113,0.1)]',         overlay: 'from-red-500/0 via-red-500/[0.05] to-transparent' },
  muted:   { hover: 'hover:text-zinc-400 hover:border-white/[0.12] hover:bg-white/[0.03]',                                                      overlay: 'from-white/0 via-white/[0.03] to-transparent' },
};

/**
 * Shared square icon button for the TOOLS group. Resting container matches the
 * rest of the top bar (glass base), while each button keeps its own accent
 * highlight (`accent`), idle colour (`idleClass`) and icon animation
 * (`iconClass`).
 */
export function IconButton({ icon: Icon, onClick, title, accent = 'amber', idleClass = 'text-zinc-400', iconClass = '', className = '', ...rest }) {
  const a = ICON_ACCENTS[accent] || ICON_ACCENTS.amber;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`group relative flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] ${idleClass} ${a.hover} transition-all duration-200 overflow-hidden active:scale-[0.95] shrink-0 ${className}`}
      {...rest}
    >
      <span className={`absolute inset-0 bg-gradient-to-br ${a.overlay} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
      <Icon className={`relative z-10 ${iconClass}`} />
    </button>
  );
}

function ExportButton({ onExport, compact = false }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onExport}
      title={t.editor.exportTitle}
      aria-label={t.editor.export}
      className={`group relative flex h-[42px] items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2] hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] overflow-hidden active:scale-[0.97] shrink-0 ${compact ? 'w-[42px]' : 'gap-2.5 px-5'}`}
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-400/0 via-blue-400/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <DownloadCloud className="relative z-10 w-4 h-4 text-blue-300/80 group-hover:text-blue-200 group-hover:translate-y-0.5 transition-all duration-200" />
      {!compact && <span className="relative z-10 text-[13px] font-semibold text-zinc-200 group-hover:text-white tracking-wide whitespace-nowrap">{t.editor.export}</span>}
    </button>
  );
}

function ImportButton({ onImport, compact = false }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onImport}
      title={t.editor.importTitle}
      aria-label={t.editor.import}
      className={`group relative flex h-[42px] items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2] hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] overflow-hidden active:scale-[0.97] shrink-0 ${compact ? 'w-[42px]' : 'gap-2.5 px-5'}`}
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <UploadCloud className="relative z-10 w-4 h-4 text-emerald-300/80 group-hover:text-emerald-200 group-hover:-translate-y-0.5 transition-all duration-200" />
      {!compact && <span className="relative z-10 text-[13px] font-semibold text-zinc-200 group-hover:text-white tracking-wide whitespace-nowrap">{t.editor.import}</span>}
    </button>
  );
}

/** Icon-only button that reveals the XML folder in the OS file manager. */
function OpenFolderButton({ onOpenFolder }) {
  const t = useLocale();
  return (
    <button
      type="button"
      onClick={onOpenFolder}
      title={t.editor.openXmlFolderTitle}
      aria-label={t.editor.openXmlFolder}
      className="group relative flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-white/[0.2] hover:shadow-[0_0_20px_rgba(255,255,255,0.04)] overflow-hidden active:scale-[0.97] shrink-0"
    >
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-amber-400/0 via-amber-400/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
      <FolderOpen className="relative z-10 w-4 h-4 text-amber-300/80 group-hover:text-amber-200 group-hover:-translate-y-0.5 transition-all duration-200" />
    </button>
  );
}

/** Labelled border-group that frames the XML import / open-folder / export trio. */
export function XmlActionGroup({ onImport, onExport, onOpenFolder, compact = false }) {
  return (
    <GroupFrame label="XML">
      <ImportButton onImport={onImport} compact={compact} />
      {onOpenFolder && <OpenFolderButton onOpenFolder={onOpenFolder} />}
      <ExportButton onExport={onExport} compact={compact} />
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
