import { useMemo, useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';
import { shouldHideForeignByDefault } from '@Shared/helpers/projectShape';

// ─── useMainTable ─────────────────────────────────────────────────────────────
// All of the editor table's stateful logic, extracted from the presentational
// `MainTable` component: search, filtering (all / favorites / hidden), technical
// classification, bookmarks/hidden sets, progress counts, validation-highlight
// dismissal, per-row mutations, and the persisted view (active filter + scroll
// position restored across save/reload). The component consumes the returned
// bag and renders — no business logic lives in the JSX.

/**
 * @param {{
 *   originalStrings: any[] | null,
 *   translations: Record<string, any>,
 *   setTranslations: (next: any) => void,
 *   onResetValidation?: () => void,
 *   packValidation?: any,
 *   packValidationAttempt?: number,
 * }} params
 */
export default function useMainTable({
  originalStrings,
  translations,
  setTranslations,
  onResetValidation,
  packValidation,
  packValidationAttempt = 0,
}) {
  const [searchQuery,       setSearchQuery]       = useState('');
  const [dismissedAttempts, setDismissedAttempts] = useState(() => ({}));
  const [isClearAllOpen,    setIsClearAllOpen]    = useState(false);
  const [bookmarkFilter,    setBookmarkFilter]    = useState(() => {
    const f = translations?._view?.filter;
    return f === 'favorites' || f === 'hidden' ? f : 'all';
  });
  // Top row index to apply on the next Virtuoso mount (project load / filter
  // switch). Restored from the persisted _view on load.
  const [applyIndex,        setApplyIndex]        = useState(() => {
    const i = translations?._view?.index;
    return typeof i === 'number' && i > 0 ? i : 0;
  });
  // Bumped on every project (re)load so Virtuoso remounts and re-applies the
  // restored scroll index even when the active filter is unchanged.
  const [loadKey,           setLoadKey]           = useState(0);
  const [rowLimit,          setRowLimit]          = useState('all');
  const [showTechnical,     setShowTechnical]     = useState(() => Boolean(translations?._view?.showTechnical));
  // Hide rows detected as non-English (foreign-language twins the author
  // bundled). Default is smart: ON for mostly-English mods, but OFF when the
  // mod's original language is itself non-English (foreign rows dominate), so
  // such a mod doesn't open to an empty list.
  const [hideForeign,       setHideForeign]       = useState(() => {
    const v = translations?._view?.hideForeign;
    return typeof v === 'boolean' ? v : shouldHideForeignByDefault(originalStrings);
  });

  // Per-filter scroll restoration via initialTopMostItemIndex: we remember each
  // filter's last top row (and the loaded _view position) and re-apply it when
  // Virtuoso remounts (key change on filter switch / project load).
  const filterIndexRef = useRef({});
  const topIndexRef = useRef(0);
  const persistViewTimerRef = useRef(null);

  // Filter reads the deferred value so typing in the search box never blocks on
  // re-rendering 1000+ rows.
  const deferredQuery = useDeferredValue(searchQuery);

  // Reset dismissed validation highlights + restore the persisted editor view
  // (active filter + scroll position) when the project changes.
  useEffect(() => {
    setDismissedAttempts({});
    const view = translations?._view;
    const f = view?.filter;
    const filter = f === 'favorites' || f === 'hidden' ? f : 'all';
    const index = typeof view?.index === 'number' && view.index > 0 ? view.index : 0;
    filterIndexRef.current = { [filter]: index };
    setBookmarkFilter(filter);
    setApplyIndex(index);
    setShowTechnical(Boolean(view?.showTechnical));
    setHideForeign(typeof view?.hideForeign === 'boolean' ? view.hideForeign : shouldHideForeignByDefault(originalStrings));
    setLoadKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalStrings]);

  // ── Technical-string classification (MSC etc.) ────────────────────────────
  // Rows carry an auto `category` ('text' | 'uncertain' | 'technical') from the
  // backend classifier. The user can override per-row; overrides persist in the
  // project under `translations._techOverride`. Technical rows are hidden by
  // default and excluded from the progress count so the denominator is honest.
  const techOverride = useMemo(() => {
    const raw = translations._techOverride;
    return raw && typeof raw === 'object' ? raw : {};
  }, [translations._techOverride]);
  const autoCategoryById = useMemo(() => {
    const map = {};
    (originalStrings || []).forEach((row) => { map[row.id] = row.category || 'text'; });
    return map;
  }, [originalStrings]);
  // Rows the backend flagged as non-English.
  const foreignById = useMemo(() => {
    const map = {};
    (originalStrings || []).forEach((row) => { if (row.foreign) map[row.id] = true; });
    return map;
  }, [originalStrings]);
  const hasForeign = useMemo(
    () => (originalStrings || []).some((row) => row.foreign),
    [originalStrings],
  );
  // Effective category. A per-row override wins; otherwise structural technical
  // stays technical, and foreign rows are treated as technical while the
  // "hide non-English" toggle is on (so they hide + drop from progress).
  const effectiveCategoryOf = useCallback((id) => {
    const override = techOverride[id];
    if (override) return override;
    const auto = autoCategoryById[id] || 'text';
    if (auto === 'technical') return 'technical';
    if (hideForeign && foreignById[id]) return 'technical';
    return auto;
  }, [techOverride, autoCategoryById, hideForeign, foreignById]);
  const hasClassified = useMemo(
    () => (originalStrings || []).some((row) => (row.category || 'text') !== 'text'),
    [originalStrings],
  );

  const countableStrings = useMemo(
    () => (originalStrings || []).filter((row) => effectiveCategoryOf(row.id) !== 'technical'),
    [originalStrings, effectiveCategoryOf],
  );
  const totalCount = countableStrings.length;
  const translatedCount = useMemo(
    () => countableStrings.filter((row) => translations[row.id]?.trim()).length,
    [countableStrings, translations],
  );

  const progress = totalCount > 0 ? Math.round((translatedCount / totalCount) * 100) : 0;
  const missingRowIdSet = useMemo(
    () => new Set(packValidation?.missingMainTableRowIds || []),
    [packValidation],
  );

  // Auto-dismiss red highlights when the user fills in the row (e.g. via auto-translate).
  useEffect(() => {
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
    if (!raw || typeof raw !== 'object') return new Set();
    return new Set(Object.keys(raw));
  }, [translations._bookmarks]);

  // ── Hidden rows — stored in translations._hidden as { rowId: true } ───────
  // A manual per-row "hide" (distinct from the auto technical classification).
  // Hidden rows only appear under the "Скрытые" filter.
  const hiddenRows = useMemo(() => {
    const raw = translations._hidden;
    if (!raw || typeof raw !== 'object') return new Set();
    return new Set(Object.keys(raw));
  }, [translations._hidden]);

  const handleToggleBookmark = useCallback((rowId) => {
    setTranslations((prev) => {
      const current = prev._bookmarks || {};
      const next = { ...current };
      if (next[rowId]) { delete next[rowId]; } else { next[rowId] = true; }
      return { ...prev, _bookmarks: next };
    });
  }, [setTranslations]);

  const handleToggleHidden = useCallback((rowId) => {
    setTranslations((prev) => {
      const current = prev._hidden || {};
      const next = { ...current };
      if (next[rowId]) { delete next[rowId]; } else { next[rowId] = true; }
      return { ...prev, _hidden: next };
    });
  }, [setTranslations]);

  // ── Persisted view (filter + scroll index) ────────────────────────────────
  // Written into `_view` so the position is restored after save/reload. `_view`
  // is excluded from the dirty fingerprint, so updating it never marks unsaved.
  const persistView = useCallback((patch) => {
    setTranslations((prev) => {
      const cur = prev._view || {};
      const changed = Object.keys(patch).some((k) => cur[k] !== patch[k]);
      if (!changed) return prev;
      return { ...prev, _view: { ...cur, ...patch } };
    });
  }, [setTranslations]);

  // Track the top visible row (ref only — no re-render) and persist it shortly
  // after scrolling settles.
  const handleRangeChanged = useCallback((range) => {
    const start = range?.startIndex ?? 0;
    topIndexRef.current = start;
    filterIndexRef.current[bookmarkFilter] = start;
    if (persistViewTimerRef.current) clearTimeout(persistViewTimerRef.current);
    persistViewTimerRef.current = setTimeout(() => {
      persistView({ filter: bookmarkFilter, index: start });
    }, 400);
  }, [persistView, bookmarkFilter]);

  useEffect(() => () => {
    if (persistViewTimerRef.current) clearTimeout(persistViewTimerRef.current);
  }, []);

  // Toggle technical-string visibility and persist it into the view so it is
  // restored on reload.
  const handleToggleShowTechnical = useCallback(() => {
    persistView({ showTechnical: !showTechnical });
    setShowTechnical((v) => !v);
  }, [persistView, showTechnical]);

  // Toggle non-English hiding and persist it.
  const handleToggleHideForeign = useCallback(() => {
    persistView({ hideForeign: !hideForeign });
    setHideForeign((v) => !v);
  }, [persistView, hideForeign]);

  // Switch row filter, remembering the current filter's position so we can
  // restore it when the user comes back, and applying the target's position.
  const handleSelectFilter = useCallback((next) => {
    if (next === bookmarkFilter) return;
    filterIndexRef.current[bookmarkFilter] = topIndexRef.current;
    setApplyIndex(filterIndexRef.current[next] ?? 0);
    setBookmarkFilter(next);
    persistView({ filter: next, index: filterIndexRef.current[next] ?? 0 });
  }, [bookmarkFilter, persistView]);

  // Auto-reset filter when its set empties out (last favorite/hidden removed).
  useEffect(() => {
    if ((bookmarkFilter === 'favorites' && bookmarks.size === 0) ||
        (bookmarkFilter === 'hidden' && hiddenRows.size === 0)) {
      setApplyIndex(filterIndexRef.current.all ?? 0);
      setBookmarkFilter('all');
    }
  }, [bookmarkFilter, bookmarks.size, hiddenRows.size]);

  const filteredStrings = useMemo(() => {
    if (!deferredQuery) return originalStrings || [];
    const q = deferredQuery.toLowerCase();
    return originalStrings.filter((row) =>
      row.original?.toLowerCase().includes(q) ||
      translations[row.id]?.toLowerCase().includes(q),
    );
  }, [originalStrings, translations, deferredQuery]);

  // Apply row filter (all / favorites / hidden) + technical visibility + limit.
  const displayedStrings = useMemo(() => {
    let result = filteredStrings;
    if (bookmarkFilter === 'hidden') {
      // Hidden view: only manually-hidden rows, shown regardless of technical.
      result = result.filter((row) => hiddenRows.has(row.id));
    } else {
      // All / favorites: never show hidden rows here.
      result = result.filter((row) => !hiddenRows.has(row.id));
      if (bookmarkFilter === 'favorites') result = result.filter((row) => bookmarks.has(row.id));
      if (!showTechnical) result = result.filter((row) => effectiveCategoryOf(row.id) !== 'technical');
    }
    if (rowLimit !== 'all') result = result.slice(0, Number(rowLimit));
    return result;
  }, [filteredStrings, bookmarkFilter, bookmarks, hiddenRows, rowLimit, showTechnical, effectiveCategoryOf]);

  // Structural technical rows currently hidden (within the search-filtered set).
  // Counts only shape-based technical (not foreign) so the two toggles stay
  // independent in the UI.
  const technicalHiddenCount = useMemo(
    () => filteredStrings.filter(
      (row) => (techOverride[row.id] || row.category || 'text') === 'technical',
    ).length,
    [filteredStrings, techOverride],
  );

  // Foreign rows detected (excluding any the user explicitly restored to text).
  const foreignCount = useMemo(
    () => filteredStrings.filter((row) => row.foreign && techOverride[row.id] !== 'text').length,
    [filteredStrings, techOverride],
  );

  // O(1) lookup of a row's display index in the FULL list. Without this the
  // Virtuoso itemContent did `originalStrings.indexOf(row)` per visible row per
  // render — O(n²) on every scroll for big mods.
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
      const { uuid, name, author, description, _bookmarks, _techOverride, _hidden } = prev;
      return {
        uuid, name, author, description,
        ...(_bookmarks ? { _bookmarks } : {}),
        ...(_techOverride ? { _techOverride } : {}),
        ...(_hidden ? { _hidden } : {}),
      };
    });
    setDismissedAttempts({});
    onResetValidation?.();
    setIsClearAllOpen(false);
  }, [setTranslations, onResetValidation]);

  // Per-row reclassification. Toggles between technical (hidden) and text
  // (visible); an override that matches the auto verdict is dropped so the map
  // only stores genuine corrections.
  const handleToggleTechnical = useCallback((rowId) => {
    setTranslations((prev) => {
      const auto = autoCategoryById[rowId] || 'text';
      const current = prev._techOverride || {};
      const effective = current[rowId] || auto;
      const target = effective === 'technical' ? 'text' : 'technical';
      const next = { ...current };
      if (target === auto) delete next[rowId];
      else next[rowId] = target;
      return { ...prev, _techOverride: next };
    });
  }, [setTranslations, autoCategoryById]);

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

  return {
    // search
    searchQuery,
    setSearchQuery,
    // filters / view
    bookmarkFilter,
    handleSelectFilter,
    rowLimit,
    setRowLimit,
    showTechnical,
    setShowTechnical,
    handleToggleShowTechnical,
    hideForeign,
    handleToggleHideForeign,
    hasForeign,
    foreignCount,
    applyIndex,
    loadKey,
    handleRangeChanged,
    // sets / classification
    bookmarks,
    hiddenRows,
    hasClassified,
    effectiveCategoryOf,
    // derived lists
    filteredStrings,
    displayedStrings,
    technicalHiddenCount,
    rowIndexById,
    // progress
    totalCount,
    translatedCount,
    progress,
    // validation
    missingRowIdSet,
    dismissedAttempts,
    dismissMissingRowHighlight,
    // clear-all modal
    isClearAllOpen,
    setIsClearAllOpen,
    handleClearAllTranslations,
    // per-row mutations
    handleTranslateChange,
    handleClearTranslation,
    handleToggleBookmark,
    handleToggleHidden,
    handleToggleTechnical,
  };
}
