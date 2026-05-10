import { escapeRegExp } from '@Shared/helpers/strings';

// ─── Search highlight splitter ──────────────────────────────────────────────
// Given a string and a search query, split into alternating "match" and
// "non-match" parts so the renderer can wrap matches in `<mark>`.

/**
 * @typedef {Object} HighlightPart
 * @property {string} value
 * @property {boolean} isMatch
 */

/**
 * @param {unknown} text
 * @param {unknown} query
 * @returns {HighlightPart[]}
 */
export function splitBySearchQuery(text, query) {
  const sourceText = typeof text === 'string' ? text : String(text ?? '');
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';

  if (!normalizedQuery) {
    return [{ value: sourceText, isMatch: false }];
  }

  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'gi');
  const rawParts = sourceText.split(pattern).filter((part) => part !== '');

  if (rawParts.length === 0) {
    return [{ value: sourceText, isMatch: false }];
  }

  const lowerQuery = normalizedQuery.toLowerCase();

  return rawParts.map((part) => ({
    value: part,
    isMatch: part.toLowerCase() === lowerQuery,
  }));
}
