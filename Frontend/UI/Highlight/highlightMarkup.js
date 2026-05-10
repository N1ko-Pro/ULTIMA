// ─── Game-text markup tokenizer ─────────────────────────────────────────────
// Splits BG3 mod text into structured tokens: literal text, BG3 markup tags
// (<lstag>, <br>, custom <foo>) and numeric placeholders ([0], [12]).
// Pure data — no DOM, no React.

const MARKUP_SPLIT_REGEX = /(<\/?[A-Za-z][^>]*>)/g;
const MARKUP_TOKEN_REGEX = /^<\/?[A-Za-z][^>]*>$/;
const PLACEHOLDER_SPLIT_REGEX = /(\[\d+\])/g;
const PLACEHOLDER_TOKEN_REGEX = /^\[\d+\]$/;

/** @typedef {'text' | 'markup' | 'placeholder'} GameTokenType */
/** @typedef {'break' | 'lsTag' | 'generic'} MarkupKind */

/**
 * @typedef {Object} GameToken
 * @property {GameTokenType} type
 * @property {MarkupKind} [markupType]   Only present when type === 'markup'.
 * @property {string} value
 */

/** Determine which kind of markup a tag is so the renderer can colour it. */
function detectMarkupType(token) {
  const lower = token.toLowerCase();
  if (lower.startsWith('<br') || lower.startsWith('</br')) return 'break';
  if (lower.startsWith('<lstag') || lower.startsWith('</lstag')) return 'lsTag';
  return 'generic';
}

/**
 * Tokenize a string into the renderer-ready stream described above.
 * @param {unknown} value
 * @returns {GameToken[]}
 */
export function tokenizeGameTextMarkup(value) {
  const text = typeof value === 'string' ? value : String(value ?? '');

  return text
    .split(MARKUP_SPLIT_REGEX)
    .filter(Boolean)
    .reduce((tokens, segment) => {
      if (MARKUP_TOKEN_REGEX.test(segment)) {
        tokens.push({
          type: 'markup',
          markupType: detectMarkupType(segment),
          value: segment,
        });
        return tokens;
      }

      segment
        .split(PLACEHOLDER_SPLIT_REGEX)
        .filter(Boolean)
        .forEach((part) => {
          if (PLACEHOLDER_TOKEN_REGEX.test(part)) {
            tokens.push({ type: 'placeholder', value: part });
            return;
          }
          tokens.push({ type: 'text', value: part });
        });

      return tokens;
    }, []);
}
