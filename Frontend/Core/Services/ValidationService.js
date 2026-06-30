import { useCallback, useEffect, useMemo, useState } from 'react';
import { hasText } from '@Shared/helpers/strings';

// ─── Validation service ─────────────────────────────────────────────────────
// Validates a project before .pak repacking: every row needs a translation,
// every required mod-data field needs a value. Pure logic — UI feedback is
// driven by the snapshot returned from `handleValidatePackBeforeOpen`.

const REQUIRED_MOD_FIELDS = ['name', 'author', 'uuid'];
const REQUIRED_MOD_FIELD_LABELS = {
  name:   'Имя мода',
  author: 'Автор',
  uuid:   'UUID мода',
};

/**
 * @typedef {Object} ValidationSnapshot
 * @property {boolean} isValid
 * @property {{ mainTable: boolean, modData: boolean, description: boolean }} missingSections
 * @property {string[]} missingMainTableRowIds
 * @property {number} missingMainTableCount
 * @property {{ name: boolean, author: boolean, uuid: boolean, description: boolean }} missingModDataFields
 * @property {string[]} missingModDataFieldLabels
 */

/**
 * Pure validator. Run it without React when you just need a yes/no answer.
 * @param {{ originalStrings?: any, translations?: any, modInfo?: any }} input
 * @returns {ValidationSnapshot}
 */
export function validatePackRequirements({ originalStrings, translations, modInfo }) {
  const rows = Array.isArray(originalStrings) ? originalStrings : [];
  const safeTranslations = translations || {};

  // Only rows the user actually sees/works with in the main table are required:
  // skip manually-hidden rows and anything that's effectively "technical"
  // (structural-technical, or a non-target-language row while the "Другой язык"
  // toggle is off). This mirrors the editor's `effectiveCategoryOf` using state
  // persisted inside `translations`, so the red highlight matches the visible
  // set and isn't thrown off by hidden/technical/foreign rows.
  const techOverride = (safeTranslations._techOverride && typeof safeTranslations._techOverride === 'object') ? safeTranslations._techOverride : {};
  const hiddenRows = (safeTranslations._hidden && typeof safeTranslations._hidden === 'object') ? safeTranslations._hidden : {};
  const bookmarks = (safeTranslations._bookmarks && typeof safeTranslations._bookmarks === 'object') ? safeTranslations._bookmarks : {};
  const showForeign = Boolean(safeTranslations._view?.showForeign);
  const showTechnical = Boolean(safeTranslations._view?.showTechnical);
  // Active editor filter (persisted in `_view.filter`). The pre-pack check is
  // scoped to it so the warning matches both what the user is working on and
  // the filter-scoped progress bar: under "Избранные" only bookmarked rows are
  // required, under "Скрытые" only the manually-hidden ones, "Все" = whole mod.
  // NOTE: strings OUTSIDE the active filter still ship with their ORIGINAL text
  // — scoping only changes what we warn about, not what actually gets packed.
  const rawFilter = safeTranslations._view?.filter;
  const activeFilter = rawFilter === 'favorites' || rawFilter === 'hidden' ? rawFilter : 'all';

  const isTechnical = (row) => {
    const override = techOverride[row.id];
    if (override) return override === 'technical';
    const auto = row.category || 'text';
    if (auto === 'technical') return true;
    if (!showForeign && row.foreign) return true;
    return false;
  };

  const isRequiredRow = (row) => {
    // "Скрытые" works exclusively on the manually-hidden rows (mirrors the
    // editor view, which shows them regardless of the technical toggle).
    if (activeFilter === 'hidden') return Boolean(hiddenRows[row.id]);
    // All / favorites never include hidden rows; technical/foreign rows are
    // excluded unless the "Технические" toggle reveals them (mirrors progress).
    if (hiddenRows[row.id]) return false;
    if (!showTechnical && isTechnical(row)) return false;
    if (activeFilter === 'favorites') return Boolean(bookmarks[row.id]);
    return true;
  };

  const missingMainTableRowIds = rows
    .filter((row) => isRequiredRow(row) && !hasText(safeTranslations[row.id]))
    .map((row) => row.id);

  const resolvedFields = {
    name:        hasText(resolveField(safeTranslations.name,        modInfo?.name ? `${modInfo.name}_RU` : '')),
    author:      hasText(resolveField(safeTranslations.author,      modInfo?.author || '')),
    uuid:        hasText(resolveField(safeTranslations.uuid,        modInfo?.uuid   || '')),
    description: hasText(safeTranslations.description || ''),
  };

  const missingModDataFields = {
    name:        !resolvedFields.name,
    author:      !resolvedFields.author,
    uuid:        !resolvedFields.uuid,
    description: !resolvedFields.description,
  };

  const missingModDataFieldLabels = REQUIRED_MOD_FIELDS
    .filter((key) => missingModDataFields[key])
    .map((key) => REQUIRED_MOD_FIELD_LABELS[key]);

  const missingSections = {
    mainTable:   missingMainTableRowIds.length > 0,
    modData:     missingModDataFieldLabels.length > 0,
    description: missingModDataFields.description,
  };

  return {
    isValid:                  !missingSections.mainTable && !missingSections.modData && !missingSections.description,
    missingSections,
    missingMainTableRowIds,
    missingMainTableCount:    missingMainTableRowIds.length,
    missingModDataFields,
    missingModDataFieldLabels,
  };
}

/**
 * React hook with state that remembers the last failed validation for the
 * current project. Resets when `resetKey` changes (typically on project
 * load).
 * @param {{ originalStrings?: any, translations?: any, modInfo?: any, resetKey?: any }} input
 */
export default function usePackValidation({ originalStrings, translations, modInfo, resetKey }) {
  const sourceKey = useMemo(() => {
    const stringsKey = Array.isArray(originalStrings) ? originalStrings.map((row) => row.id).join('|') : '';
    return `${stringsKey}::${modInfo?.uuid || ''}`;
  }, [originalStrings, modInfo?.uuid]);

  const [validationState, setValidationState] = useState({
    sourceKey: '',
    packValidationSnapshot: null,
    packValidationAttempt: 0,
  });

  // Reset memory on project load. The setState here is intentional:
  // we want to clear any stale snapshot the moment a new project loads,
  // and there's no equivalent "derive from input" form because the snapshot
  // is also mutated by `handleValidatePackBeforeOpen`.
  useEffect(() => {
    if (resetKey === undefined) return;
    setValidationState({
      sourceKey,
      packValidationSnapshot: null,
      packValidationAttempt: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleValidatePackBeforeOpen = useCallback(() => {
    const result = validatePackRequirements({ originalStrings, translations, modInfo });

    setValidationState((previous) => {
      const base = previous.sourceKey === sourceKey
        ? previous
        : { sourceKey, packValidationSnapshot: null, packValidationAttempt: 0 };

      if (result.isValid) {
        return { ...base, sourceKey, packValidationSnapshot: null };
      }
      return {
        ...base,
        sourceKey,
        packValidationSnapshot: result,
        packValidationAttempt: base.packValidationAttempt + 1,
      };
    });

    return result;
  }, [originalStrings, translations, modInfo, sourceKey]);

  const isCurrent = validationState.sourceKey === sourceKey;
  return {
    packValidationSnapshot: isCurrent ? validationState.packValidationSnapshot : null,
    packValidationAttempt:  isCurrent ? validationState.packValidationAttempt : 0,
    handleValidatePackBeforeOpen,
  };
}

/** Translation values may be intentionally empty ('') — only fall back when undefined. */
function resolveField(translationValue, fallback) {
  return translationValue !== undefined ? translationValue : fallback;
}
