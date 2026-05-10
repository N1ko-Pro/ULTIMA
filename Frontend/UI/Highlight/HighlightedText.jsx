import React from 'react';
import { tokenizeGameTextMarkup } from './highlightMarkup';
import { splitBySearchQuery } from './highlightSearch';

// ─── HighlightedText ────────────────────────────────────────────────────────
// Renders BG3 mod text with two overlapping highlights:
//   1. Game markup / placeholders coloured by kind.
//   2. Search-query matches wrapped in <mark>.
//
// Keep both passes pure — no state, no effects.

const MARKUP_CLASS = {
  break:       'text-sky-300/90',
  lsTag:       'text-fuchsia-300/90',
  generic:     'text-amber-300/90',
  placeholder: 'text-yellow-300/95',
};

const SEARCH_MATCH_CLASS = 'rounded-sm bg-amber-300/35 text-amber-100 px-[1px]';

function renderQueryParts(parts, keyPrefix) {
  return parts.map((part, index) =>
    part.isMatch ? (
      <mark key={`${keyPrefix}-${index}`} className={SEARCH_MATCH_CLASS}>
        {part.value}
      </mark>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{part.value}</React.Fragment>
    ),
  );
}

/**
 * @param {{
 *   text: string,
 *   mode?: 'table' | 'editor',
 *   searchQuery?: string,
 * }} props
 */
export default function HighlightedText({ text, mode = 'table', searchQuery = '' }) {
  const tokens = tokenizeGameTextMarkup(text);

  return tokens.map((token, index) => {
    const queryParts = splitBySearchQuery(token.value, searchQuery);

    if (token.type === 'text') {
      return (
        <React.Fragment key={`text-${index}`}>
          {renderQueryParts(queryParts, `text-${index}`)}
        </React.Fragment>
      );
    }

    const tokenColor =
      token.type === 'placeholder'
        ? MARKUP_CLASS.placeholder
        : MARKUP_CLASS[token.markupType] || MARKUP_CLASS.generic;

    const layoutClass =
      mode === 'editor'
        ? '[overflow-wrap:anywhere]'
        : 'font-mono text-[12px] font-semibold [overflow-wrap:anywhere]';

    return (
      <span key={`tag-${index}`} className={`${layoutClass} ${tokenColor}`}>
        {renderQueryParts(queryParts, `tag-${index}`)}
      </span>
    );
  });
}
