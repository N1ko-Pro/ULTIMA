import React, { useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import HighlightedText from '@UI/Highlight/HighlightedText';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Virtual table row ──────────────────────────────────────────────────────
// Single row rendered by the react-virtuoso list inside MainTable. Displays
// the original string (highlighted) plus a controlled textarea for the
// translation. Captures Ctrl+Z while empty to restore the previously-cleared
// value (native undo wouldn't work across React's state cycle).

const VirtualTableRow = React.memo(function VirtualTableRow({
  row,
  translation,
  displayIndex,
  isMissingByValidation,
  isRequiredMissing,
  onTranslateChange,
  onClearTranslation,
  onDismissHighlight,
  searchQuery,
}) {
  const t = useLocale();
  const normalizedTranslation = translation || '';
  const isTranslated = Boolean(normalizedTranslation.trim());
  const prevValueRef = useRef(normalizedTranslation);
  const textareaRef = useRef(null);

  const handleClear = () => {
    prevValueRef.current = normalizedTranslation;
    onClearTranslation(row.id);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Capture-phase Ctrl+Z: if the row is empty AND we have a saved buffer,
  // restore it and prevent the Electron/Chromium native undo.
  useEffect(() => {
    if (normalizedTranslation || !prevValueRef.current) return undefined;

    const handleUndo = (e) => {
      const isZKey = e.key === 'z' || e.code === 'KeyZ';
      if (!(e.ctrlKey || e.metaKey) || !isZKey) return;
      if (document.activeElement !== textareaRef.current) return;
      e.preventDefault();
      const toRestore = prevValueRef.current;
      prevValueRef.current = '';
      onTranslateChange(row.id, toRestore);
    };

    window.addEventListener('keydown', handleUndo, true);
    return () => window.removeEventListener('keydown', handleUndo, true);
  }, [normalizedTranslation, onTranslateChange, row.id]);

  const rowBorder = isRequiredMissing
    ? 'bg-red-500/[0.04] border-red-500/20 [&:not(:focus-within)]:hover:bg-red-500/[0.07] focus-within:bg-red-500/[0.12] focus-within:border-red-400/50 focus-within:shadow-[0_4px_28px_rgba(239,68,68,0.1),inset_3px_0_0_0_rgba(239,68,68,0.45)]'
    : isTranslated
      ? 'bg-surface-2/70 border-white/[0.09] [&:not(:focus-within)]:hover:bg-surface-2/90 [&:not(:focus-within)]:hover:border-white/[0.13] focus-within:bg-surface-3/90 focus-within:border-white/[0.25]'
      : 'bg-surface-0/40 border-white/[0.04] [&:not(:focus-within)]:hover:bg-surface-1/60 [&:not(:focus-within)]:hover:border-white/[0.07] focus-within:bg-surface-2/80 focus-within:border-white/[0.18]';

  const indexColor = isRequiredMissing
    ? 'text-red-300/70 group-hover:text-red-200 group-focus-within:text-red-200'
    : 'text-zinc-600 group-hover:text-zinc-400 group-focus-within:text-zinc-300';

  const editBorder = isRequiredMissing
    ? 'border-red-500/30 [&:not(:focus-within)]:hover:border-red-400/40 bg-red-950/20 focus-within:border-red-400/60 focus-within:ring-2 focus-within:ring-red-500/15'
    : isTranslated
      ? 'border-white/[0.08] [&:not(:focus-within)]:hover:border-white/[0.12] bg-surface-3/80 focus-within:border-white/[0.4] focus-within:ring-2 focus-within:ring-white/[0.12] focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]'
      : 'border-white/[0.06] [&:not(:focus-within)]:hover:border-white/[0.1] bg-surface-2/60 focus-within:border-white/[0.4] focus-within:bg-surface-4/60 focus-within:ring-2 focus-within:ring-white/[0.1] focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.03)]';

  return (
    <div className="pb-1.5">
      <div className={`group grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)] gap-4 p-3 px-6 rounded-2xl items-center transition-all duration-200 border ${rowBorder}`}>
        <div className={`text-center font-mono text-[12px] font-semibold transition-colors duration-200 border-r border-white/[0.06] pr-4 self-center ${indexColor}`}>
          {displayIndex}
        </div>

        <div className="text-[13px] text-zinc-300 leading-relaxed font-medium break-words [overflow-wrap:anywhere] select-text pl-4 border-r border-white/[0.06] pr-4 self-center min-w-0 relative">
          {!isTranslated && (
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400/60 shadow-[0_0_6px_rgba(251,146,60,0.4)]" />
          )}
          <HighlightedText text={row.original} mode="table" searchQuery={searchQuery} />
        </div>

        <div className="relative flex items-stretch gap-3 pl-4 min-w-0 self-stretch">
          <div className={`relative flex flex-col flex-1 w-full min-w-0 overflow-hidden rounded-xl border transition-all duration-200 ${editBorder}`}>
            {/* Overlay for search highlighting — sits behind the transparent textarea. */}
            <div
              className={`pointer-events-none absolute inset-0 z-0 rounded-xl px-4 py-2.5 text-[13px] font-medium leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-[inherit] ${
                isRequiredMissing ? 'text-red-100/90' : 'text-zinc-100'
              }`}
              aria-hidden="true"
            >
              {normalizedTranslation ? (
                <HighlightedText text={normalizedTranslation} mode="editor" searchQuery={searchQuery} />
              ) : (
                <span className="text-transparent">.</span>
              )}
            </div>

            <textarea
              ref={textareaRef}
              className="relative z-10 flex-1 w-full min-w-0 resize-none overflow-hidden bg-transparent px-4 py-2.5 text-[13px] font-medium leading-relaxed [overflow-wrap:anywhere] font-[inherit] text-transparent caret-zinc-200 placeholder-zinc-600 focus:outline-none"
              style={{ fieldSizing: 'content', minHeight: '40px' }}
              placeholder=""
              value={normalizedTranslation}
              rows={1}
              onFocus={() => onDismissHighlight(row.id, isMissingByValidation)}
              onChange={(e) => onTranslateChange(row.id, e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={handleClear}
            title={t.editor.clearRow}
            aria-label={t.editor.clearRow}
            className="w-8 h-8 shrink-0 self-center flex items-center justify-center rounded-lg text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/[0.08] transition-all duration-200 focus:outline-none"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default VirtualTableRow;
