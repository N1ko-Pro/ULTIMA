import { useMemo, useState, useCallback, useRef, useEffect, useDeferredValue } from 'react';

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
  const [isClearCustomOpen,  setIsClearCustomOpen]  = useState(false);
  const [isDeleteCustomOpen, setIsDeleteCustomOpen] = useState(false);
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
  // Show rows detected as being in another (non-target) language — foreign-
  // language twins the author bundled. Mirrors the technical toggle: OFF by
  // default (foreign rows hidden), turning it ON reveals them.
  const [showForeign,       setShowForeign]       = useState(() => Boolean(translations?._view?.showForeign));

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
    setShowForeign(Boolean(view?.showForeign));
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
  // "Другой язык" toggle is off (so they hide + drop from progress). Turning
  // the toggle on reveals them.
  const effectiveCategoryOf = useCallback((id) => {
    const override = techOverride[id];
    if (override) return override;
    const auto = autoCategoryById[id] || 'text';
    if (auto === 'technical') return 'technical';
    if (!showForeign && foreignById[id]) return 'technical';
    return auto;
  }, [techOverride, autoCategoryById, showForeign, foreignById]);
  const hasClassified = useMemo(
    () => (originalStrings || []).some((row) => (row.category || 'text') !== 'text'),
    [originalStrings],
  );

  // Whether a row counts toward translation progress. The view toggles ADD
  // their rows to the workload: technical rows count once "Технические" is on,
  // and other-language rows count once "Другой язык" is on. A manual per-row
  // override always wins ('text' → counts, 'technical' → only when shown).
  const isCountableRow = useCallback((id) => {
    const override = techOverride[id];
    if (override === 'text') return true;
    if (override === 'technical') return Boolean(showTechnical);
    const auto = autoCategoryById[id] || 'text';
    if (auto === 'technical') return Boolean(showTechnical);
    if (foreignById[id]) return Boolean(showForeign);
    return true;
  }, [techOverride, autoCategoryById, foreignById, showTechnical, showForeign]);

  const countableStrings = useMemo(
    () => (originalStrings || []).filter((row) => isCountableRow(row.id)),
    [originalStrings, isCountableRow],
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

  // ── Custom strings (MSC) — stored in translations._custom as an array of
  // { source, translation }. Surfaced as synthetic rows (id `custom:<index>`)
  // under a dedicated "custom" filter so the user can see/edit what they added.
  // They are NOT part of the DLL extract, so they never appear under all /
  // favorites / hidden and don't affect the main progress count.
  const customRows = useMemo(() => {
    const arr = Array.isArray(translations._custom) ? translations._custom : [];
    return arr.map((e, i) => ({
      id: `custom:${i}`,
      original: typeof e?.source === 'string' ? e.source : '',
      translation: typeof e?.translation === 'string' ? e.translation : '',
      isCustom: true,
      category: 'text',
    }));
  }, [translations._custom]);
  const customCount = customRows.length;
  const customTranslatedCount = useMemo(
    () => customRows.filter((r) => r.translation && r.translation.trim()).length,
    [customRows],
  );

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

  // Toggle non-target-language ("Другой язык") visibility and persist it.
  const handleToggleShowForeign = useCallback(() => {
    persistView({ showForeign: !showForeign });
    setShowForeign((v) => !v);
  }, [persistView, showForeign]);

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
  // Custom is exempt — it's a creation surface that must stay reachable even
  // with zero rows so the user can add the first one in-table.
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
    // Custom strings live in their own filter, separate from the DLL extract.
    if (bookmarkFilter === 'custom') {
      let custom = customRows;
      if (deferredQuery) {
        const q = deferredQuery.toLowerCase();
        custom = custom.filter((row) =>
          row.original?.toLowerCase().includes(q) || row.translation?.toLowerCase().includes(q));
      }
      return rowLimit !== 'all' ? custom.slice(0, Number(rowLimit)) : custom;
    }

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
  }, [filteredStrings, bookmarkFilter, bookmarks, hiddenRows, rowLimit, showTechnical, effectiveCategoryOf, customRows, deferredQuery]);

  // Ids of rows currently visible under the active filter + search + technical
  // visibility, IGNORING the row-limit pagination (the limit only caps how many
  // are rendered, not what "visible" means). Used by "Очистить всё" so it clears
  // only what the user actually sees — never technical/hidden/foreign rows.
  const visibleRowIds = useMemo(() => {
    if (bookmarkFilter === 'custom') return []; // custom has its own clear/delete buttons
    let result = filteredStrings;
    if (bookmarkFilter === 'hidden') {
      result = result.filter((row) => hiddenRows.has(row.id));
    } else {
      result = result.filter((row) => !hiddenRows.has(row.id));
      if (bookmarkFilter === 'favorites') result = result.filter((row) => bookmarks.has(row.id));
      if (!showTechnical) result = result.filter((row) => effectiveCategoryOf(row.id) !== 'technical');
    }
    return result.map((row) => row.id);
  }, [filteredStrings, bookmarkFilter, bookmarks, hiddenRows, showTechnical, effectiveCategoryOf]);

  // How many of those visible rows actually have a translation to clear.
  const visibleTranslatedCount = useMemo(
    () => visibleRowIds.reduce((n, id) => ((translations[id] || '').trim() ? n + 1 : n), 0),
    [visibleRowIds, translations],
  );

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
    (rowId, value) => {
      // Custom rows (id `custom:<index>`) live in translations._custom, not as
      // a flat id → text entry — route the edit there.
      if (typeof rowId === 'string' && rowId.startsWith('custom:')) {
        const idx = Number(rowId.slice('custom:'.length));
        setTranslations((prev) => {
          const arr = Array.isArray(prev._custom) ? prev._custom.slice() : [];
          if (idx >= 0 && idx < arr.length) arr[idx] = { ...arr[idx], translation: value };
          return { ...prev, _custom: arr };
        });
        return;
      }
      setTranslations((prev) => ({ ...prev, [rowId]: value }));
    },
    [setTranslations],
  );

  const handleClearTranslation = useCallback(
    (rowId) => {
      if (typeof rowId === 'string' && rowId.startsWith('custom:')) {
        const idx = Number(rowId.slice('custom:'.length));
        setTranslations((prev) => {
          const arr = Array.isArray(prev._custom) ? prev._custom.slice() : [];
          if (idx >= 0 && idx < arr.length) arr[idx] = { ...arr[idx], translation: '' };
          return { ...prev, _custom: arr };
        });
        return;
      }
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    },
    [setTranslations],
  );

  // ── Custom strings (MSC) — direct in-table mutations ──────────────────────
  // Append a fresh blank custom row. Surfaced immediately under the "custom"
  // filter where the user fills in source + translation inline.
  const handleAddCustomRow = useCallback(() => {
    setTranslations((prev) => {
      const arr = Array.isArray(prev._custom) ? prev._custom.slice() : [];
      arr.push({ source: '', translation: '' });
      return { ...prev, _custom: arr };
    });
  }, [setTranslations]);

  // Edit the source (original) of a custom row.
  const handleCustomSourceChange = useCallback((rowId, value) => {
    if (typeof rowId !== 'string' || !rowId.startsWith('custom:')) return;
    const idx = Number(rowId.slice('custom:'.length));
    setTranslations((prev) => {
      const arr = Array.isArray(prev._custom) ? prev._custom.slice() : [];
      if (idx >= 0 && idx < arr.length) arr[idx] = { ...arr[idx], source: value };
      return { ...prev, _custom: arr };
    });
  }, [setTranslations]);

  // Remove a custom row entirely (distinct from clearing only the translation).
  const handleDeleteCustomRow = useCallback((rowId) => {
    if (typeof rowId !== 'string' || !rowId.startsWith('custom:')) return;
    const idx = Number(rowId.slice('custom:'.length));
    setTranslations((prev) => {
      const arr = Array.isArray(prev._custom) ? prev._custom.slice() : [];
      if (idx >= 0 && idx < arr.length) arr.splice(idx, 1);
      if (arr.length) return { ...prev, _custom: arr };
      const next = { ...prev };
      delete next._custom;
      return next;
    });
  }, [setTranslations]);

  const handleClearAllTranslations = useCallback(() => {
    const ids = visibleRowIds;
    if (!ids.length) { setIsClearAllOpen(false); return; }
    const idSet = new Set(ids);
    setTranslations((prev) => {
      const next = { ...prev };
      // Clear ONLY the currently-visible rows — leave technical/hidden/foreign
      // rows and all meta keys (_bookmarks, _techOverride, name, …) intact.
      idSet.forEach((id) => {
        if (Object.prototype.hasOwnProperty.call(next, id)) delete next[id];
      });
      return next;
    });
    setDismissedAttempts({});
    onResetValidation?.();
    setIsClearAllOpen(false);
  }, [visibleRowIds, setTranslations, onResetValidation]);

  // ── Custom strings (MSC) — bulk actions ──────────────────────────────────
  // Clear the translation of every custom row, keeping the rows themselves.
  const handleClearAllCustom = useCallback(() => {
    setTranslations((prev) => {
      const arr = Array.isArray(prev._custom) ? prev._custom : [];
      if (!arr.length) return prev;
      return { ...prev, _custom: arr.map((e) => ({ ...e, translation: '' })) };
    });
    setIsClearCustomOpen(false);
  }, [setTranslations]);

  // Delete every custom row entirely.
  const handleDeleteAllCustom = useCallback(() => {
    setTranslations((prev) => {
      if (!prev._custom) return prev;
      const next = { ...prev };
      delete next._custom;
      return next;
    });
    setIsDeleteCustomOpen(false);
  }, [setTranslations]);

  // Per-row reclassification. Toggles between technical (hidden) and text
  // Per-row reclassification. Toggles a row between "technical" (hidden) and
  // visible. Foreign rows are rendered as technical while the "Другой язык"
  // toggle is off, so the toggle target is derived from the row's *effective*
  // state — not just its auto verdict — otherwise "вернуть в перевод" would flip
  // the wrong way.
  //
  // When a row is RESTORED out of technical we mark it 'uncertain' (not 'text'):
  // 'uncertain' rows stay visible regardless of the technical toggle and keep an
  // always-visible amber wrench, so the user can clearly see the row came back
  // and can send it back to technical with one click. 'text' would render a
  // hidden, hover-only wrench (looking like nothing changed).
  const handleToggleTechnical = useCallback((rowId) => {
    setTranslations((prev) => {
      const current = prev._techOverride || {};
      const auto = autoCategoryById[rowId] || 'text';
      const isForeign = Boolean(foreignById[rowId]);
      // The row's natural category (no user override) under the current view.
      const naturalTechnical = auto === 'technical' || (isForeign && !showForeign);
      const naturalCategory = naturalTechnical ? 'technical' : 'text';
      // Current effective state (override wins over the natural verdict).
      const override = current[rowId];
      const effectiveTechnical = override ? override === 'technical' : naturalTechnical;
      // Restoring out of technical: only rows the classifier ITSELF deemed
      // technical come back as 'uncertain' (visible + amber, revertible wrench).
      // A row the user manually pushed into technical (or a foreign row) returns
      // to plain 'text' — no amber mark, since it was never auto-technical.
      const restoreTarget = auto === 'technical' ? 'uncertain' : 'text';
      const target = effectiveTechnical ? restoreTarget : 'technical';
      const next = { ...current };
      // Drop the override only when the target matches the row's natural verdict
      // (e.g. re-hiding a naturally-technical row); otherwise store the genuine
      // correction (incl. the 'uncertain' restored state).
      if (target === naturalCategory) delete next[rowId];
      else next[rowId] = target;
      return { ...prev, _techOverride: next };
    });
  }, [setTranslations, autoCategoryById, foreignById, showForeign]);

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
    showForeign,
    handleToggleShowForeign,
    hasForeign,
    foreignCount,
    applyIndex,
    loadKey,
    handleRangeChanged,
    // sets / classification
    bookmarks,
    hiddenRows,
    customCount,
    customTranslatedCount,
    visibleTranslatedCount,
    hasClassified,
    effectiveCategoryOf,
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
    // custom bulk-action modals
    isClearCustomOpen,
    setIsClearCustomOpen,
    handleClearAllCustom,
    isDeleteCustomOpen,
    setIsDeleteCustomOpen,
    handleDeleteAllCustom,
    // per-row mutations
    handleTranslateChange,
    handleClearTranslation,
    handleToggleBookmark,
    handleToggleHidden,
    handleToggleTechnical,
    // custom strings (MSC)
    handleAddCustomRow,
    handleCustomSourceChange,
    handleDeleteCustomRow,
  };
}
