import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Search, Trash2, CircleX, Bookmark, EyeOff, Wrench, Languages, ListPlus, Plus } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { useKeyboardShortcuts } from '@Utils/Keyboard/useKeyboardShortcuts';
import ModalConfirm from '@UI/Modal/ModalConfirm';
import { AutoTranslateButton } from './TopBarButtons';
import VirtualTableRow from './VirtualTableRow';
import { SearchClearButton } from '../MainPageButtons';
import useMainTable from '@Windows/Main/utils/useMainTable';

// ─── Main editor table (presentation) ─────────────────────────────────────────
// The virtualized list of translatable rows plus the "row strip" above it
// (progress, auto-translate trigger, search, filters). All stateful logic lives
// in the `useMainTable` hook — this file only lays out and styles the result.

const PROGRESS_BAR_MAX = '200px';

// ── Brick-assemble timing (custom-strings mode) ──────────────────────────────
// Rows drop in top→bottom with a per-row stagger; the "add custom string"
// button materialises only after the whole cascade has played.
const ASSEMBLE_STAGGER_MS = 52;   // delay between consecutive rows
const ASSEMBLE_CLAMP      = 18;   // cap so long lists don't wait forever
const ASSEMBLE_BRICK_MS   = 550;  // a single row's drop-in duration (matches .cs-brick)
const ASSEMBLE_BTN_POP_MS = 500;  // .cs-pop duration
const ASSEMBLE_BTN_TAIL_MS = 260; // delay after the last row *starts* before the button pops

const cascadeDelayMs = (count) =>
  Math.min(Math.max(count - 1, 0), ASSEMBLE_CLAMP) * ASSEMBLE_STAGGER_MS;

function getProgressGradient(percent) {
  if (percent === 0) return 'from-zinc-700 to-zinc-600';
  if (percent < 30)  return 'from-rose-500 to-red-500';
  if (percent < 60)  return 'from-orange-500 to-amber-500';
  if (percent < 100) return 'from-lime-400 to-emerald-500';
  return 'from-emerald-500 to-teal-500';
}

export default function MainTable(props) {
  const {
    originalStrings,
    translations,
    packValidationAttempt = 0,
    isAtpExpanded,
    isTranslating,
    onAutoTranslateOpen,
    onVisibleRowsChange,
    customStringsEnabled = false,
    classifierEnabled = false,
  } = props;

  const t = useLocale();
  const table = useMainTable(props);

  // Search input focus (Ctrl+F) — a presentational concern, kept in the view so
  // the logic hook doesn't expose a raw ref.
  const searchInputRef = useRef(null);
  useKeyboardShortcuts({ onFocusSearch: () => searchInputRef.current?.focus() });

  // Report the currently-visible rows up so auto-translate can scope to them.
  useEffect(() => {
    onVisibleRowsChange?.(table.displayedStrings);
  }, [table.displayedStrings, onVisibleRowsChange]);

  // When switching into/out of the custom-strings mode the rows "assemble"
  // brick-by-brick from top to bottom: each row drops in with a staggered
  // delay. We only run this for a short window right after the swap so rows
  // mounted later by scrolling don't keep animating. Triggered from the click
  // handler (an event) — not an effect — so it covers every entry/exit path.
  const [isAssembling, setIsAssembling] = useState(false);
  const assembleTimerRef = useRef(null);
  const selectFilter = useCallback((next) => {
    const cur = table.bookmarkFilter;
    if (next !== cur && (cur === 'custom' || next === 'custom')) {
      // Keep the assemble window open long enough for the full cascade to play
      // (plus the add-button pop when entering custom) so nothing gets cut off.
      const targetCount = next === 'custom' ? table.customCount : Number.MAX_SAFE_INTEGER;
      const cascade = cascadeDelayMs(targetCount) + ASSEMBLE_BRICK_MS;
      const windowMs = cascade + (next === 'custom' ? ASSEMBLE_BTN_POP_MS + 200 : 200);
      setIsAssembling(true);
      clearTimeout(assembleTimerRef.current);
      assembleTimerRef.current = setTimeout(() => setIsAssembling(false), windowMs);
    }
    table.handleSelectFilter(next);
  }, [table]);
  useEffect(() => () => clearTimeout(assembleTimerRef.current), []);

  return (
    <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-8 scroll-smooth z-10 flex flex-col relative">
      <div
        className="mx-auto w-full h-full flex flex-col min-h-0 app-slide-up"
        style={{ maxWidth: 'clamp(900px, 85vw, 1400px)' }}
      >
        {/* Header strip: progress + auto-translate button + search */}
        <div className="shrink-0 mb-4 flex items-center pl-1 pr-[14px] gap-0">
          <div className="glass-panel px-5 py-3 rounded-2xl flex items-center min-w-0 flex-[0_1_300px]" data-tutorial="editor-progress">
            <div className="flex flex-col gap-1.5 items-start min-w-0 w-full">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-none truncate max-w-full">
                {t.editor.progressLabel}
              </span>
              <div className="flex items-center gap-3 w-full min-w-0">
                <div className="h-1.5 bg-surface-2 rounded-full ring-1 ring-white/[0.1] relative flex-1 min-w-0" style={{ maxWidth: PROGRESS_BAR_MAX }}>
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div
                      className={`h-full bg-gradient-to-r ${getProgressGradient(table.progress)} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${table.progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-300 shrink-0">
                  {table.translatedCount} / {table.totalCount}
                </span>
              </div>
            </div>
          </div>

          <DividerLine isHidden={isAtpExpanded} direction="r" />

          <div
            data-tutorial="editor-btn-translate"
            className={`transition-all origin-bottom min-w-0 flex-[0_1_210px] ${
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
              className="w-full min-w-0"
            />
          </div>

          <DividerLine isHidden={isAtpExpanded} direction="l" />

          <div className="relative group min-w-0 flex-[0_1_300px]" data-tutorial="editor-search">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Search className="w-4 h-4 text-zinc-500 group-focus-within:text-white/60 transition-colors duration-200" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.editor.searchPlaceholderFull}
              value={table.searchQuery || ''}
              onChange={(e) => table.setSearchQuery(e.target.value)}
              className="w-full bg-surface-2 border border-white/[0.07] [&:not(:focus)]:hover:border-white/[0.12] focus:border-white/[0.4] rounded-2xl py-3 pl-12 pr-10 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none focus:ring-2 focus:ring-white/[0.12] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)] focus:bg-surface-3 transition-[border-color,background-color,box-shadow] duration-200"
            />
            {table.searchQuery && <SearchClearButton onClick={() => table.setSearchQuery('')} />}
          </div>
        </div>

        {/* Toolbar — two rows: primary filters (top) + classifier toggles (bottom) */}
        <div className="shrink-0 mb-3 pr-[14px]">
          <div className="flex flex-col rounded-xl border border-white/[0.07] bg-surface-1/60 backdrop-blur-sm divide-y divide-white/[0.06]">

            {/* Row 1 — All / Favorites / Hidden / Custom + row limit */}
            <div className="flex items-center gap-0 h-11 px-3">
              <div className="flex items-center shrink-0">
                {[
                  { value: 'all',       label: t.editor.filterAll,       Icon: null,     count: 0 },
                  { value: 'favorites', label: t.editor.filterFavorites, Icon: Bookmark, count: table.bookmarks.size },
                  { value: 'hidden',    label: t.editor.filterHidden,    Icon: EyeOff,   count: table.hiddenRows.size },
                ].map(({ value: v, label, Icon, count }) => {
                  // 'all' is always reachable; the rest disable themselves when empty.
                  const disabled = v !== 'all' && count === 0;
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={disabled}
                      onClick={() => selectFilter(v)}
                      className={`flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                        disabled
                          ? 'text-zinc-700 opacity-40 cursor-not-allowed'
                          : table.bookmarkFilter === v
                            ? v === 'favorites'
                              ? 'bg-amber-400/[0.15] text-amber-300'
                              : 'bg-surface-4/80 text-zinc-200'
                            : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      {Icon && (
                        <Icon className={`w-[11px] h-[11px] shrink-0 ${
                          table.bookmarkFilter === v && v === 'favorites' ? 'fill-amber-400/70' : ''
                        }`} />
                      )}
                      {label}
                      {count > 0 && (
                        <span className={`text-[10px] font-bold tabular-nums leading-none px-1 py-px rounded ${
                          table.bookmarkFilter === v
                            ? v === 'favorites' ? 'text-amber-300/70' : 'text-zinc-400'
                            : 'text-zinc-700'
                        }`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 min-w-0" />

              {/* Row count when not showing full set */}
              {table.displayedStrings.length < table.filteredStrings.length && table.bookmarkFilter === 'all' && (
                <>
                  <span className="text-[11px] text-zinc-600 font-medium tabular-nums shrink-0 pr-3">
                    {table.displayedStrings.length} {t.editor.ofTotal} {table.filteredStrings.length}
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
                      onClick={() => table.setRowLimit(value)}
                      className={`h-[22px] px-2 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                        table.rowLimit === value
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

            {/* Row 2 — classifier toggles (left) + custom-strings filter (right).
                Rendered for games that have a classifier and/or custom strings;
                each classifier toggle disables itself when its set is empty. */}
            {(classifierEnabled || customStringsEnabled) && (
              <div className="flex items-center gap-2 h-11 px-3">
                {classifierEnabled && (
                  <>
                    <button
                      type="button"
                      disabled={!table.hasClassified}
                      onClick={table.handleToggleShowTechnical}
                      title={table.showTechnical ? t.editor.techHideTitle : t.editor.techShowTitle}
                      className={`flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                        !table.hasClassified
                          ? 'text-zinc-700 opacity-40 cursor-not-allowed'
                          : table.showTechnical
                            ? 'bg-sky-400/[0.14] text-sky-300'
                            : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Wrench className="w-[12px] h-[12px] shrink-0" />
                      {table.showTechnical ? t.editor.techShown : t.editor.techHidden}
                      {table.technicalHiddenCount > 0 && !table.showTechnical && (
                        <span className="text-[10px] font-bold tabular-nums leading-none px-1 py-px rounded text-zinc-700">
                          {table.technicalHiddenCount}
                        </span>
                      )}
                    </button>

                    <div className="w-px h-4 bg-white/[0.07] shrink-0" />

                    <button
                      type="button"
                      disabled={!table.hasForeign}
                      onClick={table.handleToggleShowForeign}
                      title={table.showForeign ? t.editor.foreignHideTitle : t.editor.foreignShowTitle}
                      className={`flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-semibold rounded-md transition-all duration-150 ${
                        !table.hasForeign
                          ? 'text-zinc-700 opacity-40 cursor-not-allowed'
                          : table.showForeign
                            ? 'bg-violet-400/[0.14] text-violet-300'
                            : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <Languages className="w-[12px] h-[12px] shrink-0" />
                      {table.showForeign ? t.editor.foreignShown : t.editor.foreignHidden}
                      {table.foreignCount > 0 && !table.showForeign && (
                        <span className="text-[10px] font-bold tabular-nums leading-none px-1 py-px rounded text-zinc-700">
                          {table.foreignCount}
                        </span>
                      )}
                    </button>
                  </>
                )}

                <div className="flex-1 min-w-0" />

                {/* Custom strings — a distinct *mode* toggle, styled like the
                    "Import" pill: dark surface + violet icon. Lights up violet
                    when active; the gradient sweep only runs on hover (never
                    looping while active — that's distracting). */}
                {customStringsEnabled && (
                  <>
                    <div className="w-px h-5 bg-white/[0.08] shrink-0 mr-1" />
                    <button
                      type="button"
                      onClick={() => selectFilter(table.bookmarkFilter === 'custom' ? 'all' : 'custom')}
                      title={t.customStrings.subtitle}
                      aria-pressed={table.bookmarkFilter === 'custom'}
                      className={`group relative flex h-8 items-center gap-2 rounded-xl px-3 border overflow-hidden transition-all duration-200 active:scale-[0.97] shrink-0 ${
                        table.bookmarkFilter === 'custom'
                          ? 'bg-violet-500/[0.14] border-violet-400/45 shadow-[0_0_18px_-6px_rgba(139,92,246,0.6)]'
                          : 'bg-white/[0.06] border-white/[0.12] hover:bg-white/[0.1] hover:border-white/[0.2]'
                      }`}
                    >
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-400/0 via-violet-400/[0.08] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                      <ListPlus className={`relative z-10 w-4 h-4 transition-colors duration-200 ${
                        table.bookmarkFilter === 'custom' ? 'text-violet-200' : 'text-violet-300/80 group-hover:text-violet-200'
                      }`} />
                      <span className={`relative z-10 text-[12px] font-semibold tracking-wide whitespace-nowrap transition-colors duration-200 ${
                        table.bookmarkFilter === 'custom' ? 'text-violet-50' : 'text-zinc-300 group-hover:text-white'
                      }`}>{t.editor.filterCustom}</span>
                      {table.customCount > 0 && (
                        <span className={`relative z-10 text-[10px] font-bold tabular-nums leading-none px-1.5 py-0.5 rounded-md ${
                          table.bookmarkFilter === 'custom' ? 'bg-violet-300/20 text-violet-50' : 'bg-white/[0.08] text-zinc-400'
                        }`}>{table.customCount}</span>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

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
              {customStringsEnabled && table.bookmarkFilter === 'custom' ? (
                <div className="flex items-center gap-2 shrink-0">
                  {/* Clear translations of all custom rows (keep the rows). */}
                  <button
                    type="button"
                    onClick={() => table.setIsClearCustomOpen(true)}
                    disabled={table.customTranslatedCount === 0}
                    title={t.editor.clearAllCustomTitle}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-surface-3 border-white/[0.08] text-zinc-500 hover:text-red-300 active:scale-[0.97] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-zinc-500"
                  >
                    <Trash2 className="w-[13px] h-[13px] transition-all duration-200" />
                    <span className="text-[11px] font-semibold">{t.editor.clearAllCustom}</span>
                  </button>
                  {/* Delete every custom row entirely. */}
                  <button
                    type="button"
                    onClick={() => table.setIsDeleteCustomOpen(true)}
                    disabled={table.customCount === 0}
                    title={t.editor.deleteAllCustomTitle}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-red-500/[0.06] border-red-500/20 text-red-300/80 hover:text-red-200 hover:bg-red-500/[0.12] active:scale-[0.97] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-red-300/80 disabled:hover:bg-red-500/[0.06]"
                  >
                    <CircleX className="w-[13px] h-[13px] transition-all duration-200" />
                    <span className="text-[11px] font-semibold">{t.editor.deleteAllCustom}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => table.setIsClearAllOpen(true)}
                  title={t.editor.clearAllTitle}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-surface-3 border-white/[0.08] text-zinc-500 hover:text-red-300 active:scale-[0.97] transition-colors duration-200 shrink-0"
                >
                  <Trash2 className="w-[13px] h-[13px] transition-all duration-200" />
                  <span className="text-[11px] font-semibold">{t.editor.clearAll}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Virtualized rows */}
        <div className="flex-1 min-h-0 relative pr-[14px]" data-tutorial="editor-table-rows">
          <Virtuoso
            key={`${table.bookmarkFilter}:${table.loadKey}`}
            initialTopMostItemIndex={table.applyIndex}
            rangeChanged={table.handleRangeChanged}
            style={{ height: '100%' }}
            overscan={400}
            computeItemKey={(_, row) => row.id}
            components={{
              Footer: () => {
                const showAdd = customStringsEnabled
                  && table.bookmarkFilter === 'custom'
                  && table.displayedStrings.length > 0;
                // Button waits for the last row's drop-in, then pops — but a
                // touch earlier than the full drop so it doesn't feel laggy.
                const delayMs = cascadeDelayMs(table.displayedStrings.length) + ASSEMBLE_BTN_TAIL_MS;
                return (
                  <div className={showAdd ? 'pt-1.5 pb-20' : ''} style={showAdd ? undefined : { height: '80px' }}>
                    {showAdd && (
                      <AddCustomRowButton
                        onClick={table.handleAddCustomRow}
                        label={t.customStrings.addRow}
                        animate={isAssembling}
                        delayMs={delayMs}
                      />
                    )}
                  </div>
                );
              },
              EmptyPlaceholder: () => (
                customStringsEnabled && table.bookmarkFilter === 'custom'
                  ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
                      <p className="text-[13px] text-zinc-500 leading-relaxed max-w-sm">{t.customStrings.empty}</p>
                      <div className="w-full max-w-md">
                        <AddCustomRowButton
                          onClick={table.handleAddCustomRow}
                          label={t.customStrings.addRow}
                          animate={isAssembling}
                          delayMs={ASSEMBLE_BTN_TAIL_MS}
                        />
                      </div>
                    </div>
                  )
                  : null
              ),
            }}
            data={table.displayedStrings}
            itemContent={(index, row) => {
              const isCustom = row.isCustom === true;
              const displayIndex = isCustom
                ? Number(row.id.slice('custom:'.length)) + 1
                : (table.rowIndexById.get(row.id) ?? 0) + 1;
              const isMissingByValidation = !isCustom && table.missingRowIdSet.has(row.id);
              const isRequiredMissing =
                isMissingByValidation && table.dismissedAttempts[row.id] !== packValidationAttempt;
              // Brick-assemble cascade: stagger the drop-in by row position,
              // clamped so deep rows don't wait too long. Only while assembling.
              const appearStyle = isAssembling
                ? { animationDelay: `${Math.min(index, ASSEMBLE_CLAMP) * ASSEMBLE_STAGGER_MS}ms` }
                : undefined;

              return (
                <VirtualTableRow
                  key={row.id}
                  row={row}
                  translation={isCustom ? row.translation : translations[row.id]}
                  isCustom={isCustom}
                  searchQuery={table.searchQuery}
                  displayIndex={displayIndex}
                  appearClassName={isAssembling ? 'cs-brick' : undefined}
                  appearStyle={appearStyle}
                  isMissingByValidation={isMissingByValidation}
                  isRequiredMissing={isRequiredMissing}
                  isBookmarked={!isCustom && table.bookmarks.has(row.id)}
                  isHidden={!isCustom && table.hiddenRows.has(row.id)}
                  techState={isCustom ? 'text' : table.effectiveCategoryOf(row.id)}
                  techReasons={row.techReasons}
                  onTranslateChange={table.handleTranslateChange}
                  onClearTranslation={table.handleClearTranslation}
                  onToggleBookmark={isCustom ? undefined : table.handleToggleBookmark}
                  onToggleHidden={isCustom ? undefined : table.handleToggleHidden}
                  onToggleTechnical={isCustom ? undefined : (table.hasClassified ? table.handleToggleTechnical : undefined)}
                  onCustomSourceChange={isCustom ? table.handleCustomSourceChange : undefined}
                  onDeleteCustomRow={isCustom ? table.handleDeleteCustomRow : undefined}
                  onDismissHighlight={table.dismissMissingRowHighlight}
                />
              );
            }}
          />
        </div>
      </div>

      <ModalConfirm
        isOpen={table.isClearAllOpen}
        onCancel={() => table.setIsClearAllOpen(false)}
        onConfirm={table.handleClearAllTranslations}
        title={t.editor.clearAllTitle}
        subtitle={t.projects.deleteSubtitle}
        icon={Trash2}
        variant="danger"
        confirmLabel={t.editor.clearAll}
        confirmIcon={Trash2}
        cancelLabel={t.common.cancel}
      >
        <p className="text-zinc-300 text-sm leading-relaxed">
          {t.editor.clearAllConfirm(table.visibleTranslatedCount)}
        </p>
      </ModalConfirm>

      <ModalConfirm
        isOpen={table.isClearCustomOpen}
        onCancel={() => table.setIsClearCustomOpen(false)}
        onConfirm={table.handleClearAllCustom}
        title={t.editor.clearAllCustomTitle}
        subtitle={t.projects.deleteSubtitle}
        icon={Trash2}
        variant="danger"
        confirmLabel={t.editor.clearAllCustom}
        confirmIcon={Trash2}
        cancelLabel={t.common.cancel}
      >
        <p className="text-zinc-300 text-sm leading-relaxed">
          {t.editor.clearAllCustomConfirm(table.customTranslatedCount)}
        </p>
      </ModalConfirm>

      <ModalConfirm
        isOpen={table.isDeleteCustomOpen}
        onCancel={() => table.setIsDeleteCustomOpen(false)}
        onConfirm={table.handleDeleteAllCustom}
        title={t.editor.deleteAllCustomTitle}
        subtitle={t.projects.deleteSubtitle}
        icon={CircleX}
        variant="danger"
        confirmLabel={t.editor.deleteAllCustom}
        confirmIcon={CircleX}
        cancelLabel={t.common.cancel}
      >
        <p className="text-zinc-300 text-sm leading-relaxed">
          {t.editor.deleteAllCustomConfirm(table.customCount)}
        </p>
      </ModalConfirm>
    </div>
  );
}

function AddCustomRowButton({ onClick, label, animate = false, delayMs = 0 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-dashed border-violet-400/30 bg-violet-400/[0.03] text-violet-300/80 text-[13px] font-semibold hover:bg-violet-400/[0.08] hover:border-violet-400/50 hover:text-violet-200 transition-all duration-150 active:scale-[0.99] ${animate ? 'cs-pop' : ''}`}
      style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <Plus className="w-4 h-4" />
      {label}
    </button>
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
