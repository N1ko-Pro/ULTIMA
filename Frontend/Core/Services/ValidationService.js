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

  const missingMainTableRowIds = rows
    .filter((row) => !hasText(safeTranslations[row.id]))
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
