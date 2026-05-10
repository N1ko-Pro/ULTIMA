const TAG_SPLIT_REGEX = /(<[^>]*>)/g;

/**
 * Split text into alternating non-tag / tag parts.
 * Returns array of { value: string, isTag: boolean }.
 */
function splitByTags(text) {
  const parts = [];
  const segments = text.split(TAG_SPLIT_REGEX);
  for (const seg of segments) {
    if (seg === '') continue;
    parts.push({ value: seg, isTag: TAG_SPLIT_REGEX.test(seg) });
    TAG_SPLIT_REGEX.lastIndex = 0;
  }
  return parts;
}

/**
 * Apply a replacer function only to non-tag segments and reassemble the string.
 */
function applyToTextNodes(text, replacer) {
  const parts = splitByTags(text);
  return parts.map(({ value, isTag }) => (isTag ? value : replacer(value))).join('');
}

/**
 * Replace source glossary terms in `text` with unique placeholder tokens BEFORE translation.
 * Returns { protected: string, map: Object<token, target> }.
 * Longest terms are replaced first to avoid partial-match conflicts.
 * Skips content inside XML/HTML tags (e.g. tag attributes).
 */
function protectGlossaryInText(text, entries) {
  if (!text || !entries || entries.length === 0) return { protected: text, map: {} };

  const sorted = [...entries].sort((a, b) => b.source.length - a.source.length);

  const map = {};
  let idx = 0;

  const result = applyToTextNodes(text, (segment) => {
    let updated = segment;
    for (const { source, target } of sorted) {
      if (!source || !target) continue;
      const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(`(?<![\\w\\u0400-\\u04FF])${escaped}(?![\\w\\u0400-\\u04FF])`, 'gi');
      if (searchRegex.test(updated)) {
        const token = `[GLS${idx}]`;
        map[token] = target;
        updated = updated.replace(
          new RegExp(`(?<![\\w\\u0400-\\u04FF])${escaped}(?![\\w\\u0400-\\u04FF])`, 'gi'),
          token
        );
        idx++;
      }
    }
    return updated;
  });

  return { protected: result, map };
}

/**
 * Restore placeholder tokens produced by protectGlossaryInText with their target translations.
 */
function restoreGlossaryFromMap(text, map) {
  if (!text || !map || Object.keys(map).length === 0) return text;

  let result = text;
  for (const [token, target] of Object.entries(map)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), target);
  }
  return result;
}

/**
 * Convert entries array to [source, target] pairs for prompt injection.
 */
function entriesToGlossaryPairs(entries) {
  return (entries || []).map((e) => [e.source, e.target]);
}

module.exports = { protectGlossaryInText, restoreGlossaryFromMap, entriesToGlossaryPairs };
