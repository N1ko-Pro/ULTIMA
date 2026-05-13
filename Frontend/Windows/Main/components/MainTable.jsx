import React, { useMemo, useState, useCallback, useRef, useDeferredValue } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Search, Trash2, Bookmark, BookmarkX } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { useKeyboardShortcuts } from '@Utils/Keyboard/useKeyboardShortcuts';
import ModalConfirm from '@UI/Modal/ModalConfirm';
import { AutoTranslateButton } from './TopBarButtons';
import VirtualTableRow from './VirtualTableRow';
import { SearchClearButton } from '../MainPageButtons';

// ─── Main editor table ──────────────────────────────────────────────────────
// The virtualized list of translatable rows plus the "row strip" above it
// (progress, auto-translate trigger, search). ClearAll-confirm modal lives
// here too because it is tightly coupled to the table's state.
//
// Stateful plumbing (auto-translation pipeline, validation resets) is owned
// by `MainPage` and threaded in via props — this component stays focused on
// presenting and filtering rows.

const PROGRESS_BAR_WIDTH = 'clamp(150px, 15vw, 200px)';

function getProgressGradient(percent) {
  if (percent === 0) return 'from-zinc-700 to-zinc-600';
  if (percent < 30)  return 'from-rose-500 to-red-500';
  if (percent < 60)  return 'from-orange-500 to-amber-500';
  if (percent < 100) return 'from-lime-400 to-emerald-500';
  return 'from-emerald-500 to-teal-500';
}

export default function MainTable({
  originalStrings,
  translations,
  setTranslations,
  onResetValidation,
  packValidation,
  packValidationAttempt = 0,
  isAtpExpanded,
  isTranslating,
  onAutoTranslateOpen,
}) {
  const t = useLocale();
  const [searchQuery,         setSearchQuery]         = useState('');
  const [dismissedAttempts,   setDismissedAttempts]   = useState(() => ({}));
  const [isClearAllOpen,      setIsClearAllOpen]      = useState(false);
  const [bookmarkFilter,       setBookmarkFilter]       = useState('all');
  const [rowLimit,            setRowLimit]            = useState('all');
  const searchInputRef = useRef(null);

  // Filter reads the deferred value so typing in the search box never
  // blocks on re-rendering 1000+ rows.
  const deferredQuery = useDeferredValue(searchQuery);

  useKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  // Reset dismissed validation highlights when the project changes.
  React.useEffect(() => {
    setDismissedAttempts({});
  }, [originalStrings]);

  const totalCount = originalStrings?.length || 0;
  const translatedCount = useMemo(
    () => originalStrings?.filter((row) => translations[row.id]?.trim()).length || 0,
    [originalStrings, translations],
  );

  const progress = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;
  const missingRowIdSet = useMemo(
    () => new Set(packValidation?.missingMainTableRowIds || []),
    [packValidation],
  );

  // Auto-dismiss red highlights when the user fills in the row (e.g. via auto-translate).
  React.useEffect(() => {
    if (!packValidation?.missingMainTableRowIds || packValidationAttempt === 0) return;
    const newlyTranslated = packValidation.missingMainTableRowIds.filter(
      (rowId) => translations[rowId]?.trim(),
    );
    if (newlyTranslated.length === 0) return;
    setDismissedAttempts((prev) => {
      const next = { ...prev };
      newlyTranslated.forEach((rowId) => { next[rowId] = packValidationAttempt; });
      return next;
    });
  }, [translations, packValidation, packValidationAttempt]);

  // ── Bookmarks — stored in translations._bookmarks as { rowId: true } ──────
  const bookmarks = useMemo(() => {
    const raw = translations._bookmarks;
    if (!raw) return new Set();
    return new Set(Object.keys(raw));
  }, [translations._bookmarks]);

  const handleToggleBookmark = useCallback((rowId) => {
    setTranslations((prev) => {
      const current = prev._bookmarks || {};
      const next = { ...current };
      if (next[rowId]) { delete next[rowId]; } else { next[rowId] = true; }
      return { ...prev, _bookmarks: next };
    });
  }, [setTranslations]);

  // Auto-reset filter when last bookmark is removed
  React.useEffect(() => {
    if (bookmarkFilter !== 'all' && bookmarks.size === 0) setBookmarkFilter('all');
  }, [bookmarkFilter, bookmarks.size]);

  const filteredStrings = useMemo(() => {
    if (!deferredQuery) return originalStrings || [];
    const q = deferredQuery.toLowerCase();
    return originalStrings.filter((row) =>
      row.original?.toLowerCase().includes(q) ||
      translations[row.id]?.toLowerCase().includes(q),
    );
  }, [originalStrings, translations, deferredQuery]);

  // Apply bookmark filter + row limit on top of search-filtered strings
  const displayedStrings = useMemo(() => {
    let result = filteredStrings;
    if (bookmarkFilter === 'only') result = result.filter((row) =>  bookmarks.has(row.id));
    else if (bookmarkFilter === 'hide') result = result.filter((row) => !bookmarks.has(row.id));
    if (rowLimit !== 'all') result = result.slice(0, Number(rowLimit));
    return result;
  }, [filteredStrings, bookmarkFilter, bookmarks, rowLimit]);

  // O(1) lookup of a row's display index in the FULL list. Without this the
  // Virtuoso itemContent did `originalStrings.indexOf(row)` per visible row
  // per render — O(n²) on every scroll for big mods.
  const rowIndexById = useMemo(() => {
    const map = new Map();
    if (originalStrings) {
      for (let i = 0; i < originalStrings.length; i += 1) map.set(originalStrings[i].id, i);
    }
    return map;
  }, [originalStrings]);

  const handleTranslateChange = useCallback(
    (rowId, value) => setTranslations((prev) => ({ ...prev, [rowId]: value })),
    [setTranslations],
  );

  const handleClearTranslation = useCallback(
    (rowId) => setTranslations((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    }),
    [setTranslations],
  );

  const handleClearAllTranslations = useCallback(() => {
    setTranslations((prev) => {
      const { uuid, name, author, description, _bookmarks } = prev;
      return { uuid, name, author, description, ...(_bookmarks ? { _bookmarks } : {}) };
    });
    setDismissedAttempts({});
    onResetValidation?.();
    setIsClearAllOpen(false);
  }, [setTranslations, onResetValidation]);

  const dismissMissingRowHighlight = useCallback(
    (rowId, isMissingByValidation) => {
      if (!isMissingByValidation) return;
      setDismissedAttempts((prev) => {
        if (prev[rowId] === packValidationAttempt) return prev;
        return { ...prev, [rowId]: packValidationAttempt };
      });
    },
    [packValidationAttempt],
  );

  return (
    <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-8 scroll-smooth z-10 flex flex-col relative">
      <div
        className="mx-auto w-full h-full flex flex-col min-h-0 app-slide-up"
        style={{ maxWidth: 'clamp(900px, 85vw, 1400px)' }}
      >
        {/* Header strip: progress + auto-translate button + search */}
        <div className="shrink-0 mb-4 flex items-center pl-1 pr-[14px] gap-0">
          <div className="glass-panel px-5 py-3 rounded-2xl flex items-center shrink-0" data-tutorial="editor-progress">
            <div className="flex flex-col gap-1.5 items-start">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
                {t.editor.progressLabel}
              </span>
              <div className="flex items-center gap-3">
                <div className="h-1.5 bg-surface-2 rounded-full ring-1 ring-white/[0.1] relative" style={{ width: PROGRESS_BAR_WIDTH }}>
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div
                      className={`h-full bg-gradient-to-r ${getProgressGradient(progress)} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-300">
                  {translatedCount} / {totalCount}
                </span>
              </div>
            </div>
          </div>

          <DividerLine isHidden={isAtpExpanded} origin="right" direction="r" />

          <div
            data-tutorial="editor-btn-translate"
            className={`transition-all origin-bottom shrink-0 ${
              isAtpExpanded
                ? 'scale-y-0 scale-x-50 opacity-0 pointer-events-none translate-y-4'
                : 'scale-100 opacity-100 translate-y-0'
            }`}
            style={{ transitionDuration: '400ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <AutoTranslateButton
              disabled={!originalStrings.length}
              isTranslating={isTranslating}
              onOpen={onAutoTranslateOpen}
            />
          </div>

          <DividerLine isHidden={isAtpExpanded} origin="left" direction="l" />

          <div className="relative group shrink-0 w-full" style={{ maxWidth: '300px' }} data-tutorial="editor-search">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-white/60 transition-colors duration-200" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.editor.searchPlaceholderFull}
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.07] [&:not(:focus)]:hover:border-white/[0.12] focus:border-white/[0.4] rounded-2xl py-3 pl-12 pr-10 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-white/[0.12] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)] focus:bg-surface-3 transition-[border-color,background-color,box-shadow] duration-200"
            />
            {searchQuery && <SearchClearButton onClick={() => setSearchQuery('')} />}
          </div>
        </div>

        {/* Toolbar */}
        <div className="shrink-0 mb-3 pr-[14px]">
          <div className="flex items-center gap-0 h-10 px-3 rounded-xl border border-white/[0.07] bg-surface-1/60 backdrop-blur-sm">

            {/* Bookmark filter — always visible */}
            <div className="flex items-center shrink-0 pr-3">
              {[
                { value: 'all',  label: t.editor.filterAll,  Icon: null },
                { value: 'only', label: t.editor.filterOnly, Icon: Bookmark },
                { value: 'hide', label: t.editor.filterHide, Icon: BookmarkX },
              ].map(({ value: v, label, Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBookmarkFilter(v)}
                  className={`flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                    bookmarkFilter === v
                      ? v === 'only'
                        ? 'bg-amber-400/[0.15] text-amber-300'
                        : 'bg-surface-4/80 text-zinc-200'
                      : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
                  }`}
                >
                  {Icon && (
                    <Icon className={`w-[11px] h-[11px] shrink-0 ${
                      bookmarkFilter === v && v === 'only' ? 'fill-amber-400/70' : ''
                    }`} />
                  )}
                  {label}
                  {v === 'only' && bookmarks.size > 0 && (
                    <span className={`text-[10px] font-bold tabular-nums leading-none px-1 py-px rounded ${
                      bookmarkFilter === 'only' ? 'text-amber-300/70' : 'text-zinc-700'
                    }`}>{bookmarks.size}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-white/[0.07] shrink-0" />

            <div className="flex-1 min-w-0" />

            {/* Row count when not showing full set */}
            {displayedStrings.length < filteredStrings.length && bookmarkFilter !== 'only' && (
              <>
                <span className="text-[11px] text-zinc-600 font-medium tabular-nums shrink-0 pr-3">
                  {displayedStrings.length} {t.editor.ofTotal} {filteredStrings.length}
                </span>
                <div className="w-px h-4 bg-white/[0.07] shrink-0" />
              </>
            )}

            {/* Right: row limit */}
            <div className="flex items-center gap-2.5 shrink-0 pl-3">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-none">
                {t.editor.showRows}
              </span>
              <div className="flex items-center gap-px bg-black/[0.18] rounded-lg p-[3px] border border-white/[0.06]">
                {[['25','25'],['50','50'],['100','100'],['200','200'],['500','500'],['Все','all']].map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRowLimit(value)}
                    className={`h-[22px] px-2 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                      rowLimit === value
                        ? 'bg-surface-4/80 text-zinc-200 shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Column headers */}
        <div className="shrink-0 pb-3 z-20 relative pr-[14px]" data-tutorial="editor-table">
          <div className="relative grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_68px] gap-4 px-6 py-3.5 rounded-2xl border border-white/[0.07] bg-surface-2/90">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent rounded-t-2xl" />
            <div className="text-xs font-black text-zinc-500 uppercase tracking-widest text-center border-r border-white/[0.07] pr-4 flex items-center justify-center">#</div>
            <div className="text-xs font-black text-zinc-400 uppercase tracking-widest pl-1 border-r border-white/[0.07] pr-4 flex items-center">
              {t.editor.colOriginal}
            </div>
            <div className="col-span-2 flex items-center gap-3 text-xs font-black text-zinc-400 uppercase tracking-widest pl-4">
              <span>{t.editor.colTranslation}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent min-w-4" />
              <button
                type="button"
                onClick={() => setIsClearAllOpen(true)}
                title={t.editor.clearAllTitle}
                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-surface-3 border-white/[0.08] text-zinc-500 hover:text-red-300 active:scale-[0.97] transition-colors duration-200 shrink-0"
              >
                <Trash2 className="w-[13px] h-[13px] transition-all duration-200" />
                <span className="text-[11px] font-semibold">{t.editor.clearAll}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Virtualized rows */}
        <div className="flex-1 min-h-0 relative pr-[14px]" data-tutorial="editor-table-rows">
          <Virtuoso
            style={{ height: '100%' }}
            overscan={400}
            computeItemKey={(_, row) => row.id}
            components={{ Footer: () => <div style={{ height: '80px' }} /> }}
            data={displayedStrings}
            itemContent={(_, row) => {
              const displayIndex = (rowIndexById.get(row.id) ?? 0) + 1;
              const isMissingByValidation = missingRowIdSet.has(row.id);
              const isRequiredMissing =
                isMissingByValidation && dismissedAttempts[row.id] !== packValidationAttempt;

              return (
                <VirtualTableRow
                  key={row.id}
                  row={row}
                  translation={translations[row.id]}
                  searchQuery={searchQuery}
                  displayIndex={displayIndex}
                  isMissingByValidation={isMissingByValidation}
                  isRequiredMissing={isRequiredMissing}
                  isBookmarked={bookmarks.has(row.id)}
                  onTranslateChange={handleTranslateChange}
                  onClearTranslation={handleClearTranslation}
                  onToggleBookmark={handleToggleBookmark}
                  onDismissHighlight={dismissMissingRowHighlight}
                />
              );
            }}
          />
        </div>
      </div>

      <ModalConfirm
        isOpen={isClearAllOpen}
        onCancel={() => setIsClearAllOpen(false)}
        onConfirm={handleClearAllTranslations}
        title={t.editor.clearAllTitle}
        subtitle={t.projects.deleteSubtitle}
        icon={Trash2}
        variant="danger"
        confirmLabel={t.editor.clearAll}
        confirmIcon={Trash2}
        cancelLabel={t.common.cancel}
      >
        <p className="text-zinc-300 text-sm leading-relaxed">
          {t.editor.clearAllConfirm(translatedCount)}
        </p>
      </ModalConfirm>
    </div>
  );
}

function DividerLine({ isHidden, direction }) {
  const gradientClass = direction === 'r'
    ? 'bg-gradient-to-r from-transparent via-white/[0.08] to-transparent'
    : 'bg-gradient-to-l from-transparent via-white/[0.08] to-transparent';
  const originClass = direction === 'r' ? 'origin-right' : 'origin-left';
  return (
    <div
      className={`flex-1 h-px ${gradientClass} min-w-4 ${originClass} transition-[transform,opacity] ${
        isHidden ? 'scale-x-0 opacity-0' : 'scale-x-100 opacity-100'
      }`}
      style={{ transitionDuration: '400ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
    />
  );
}
