function toSafeString(value) {
  return typeof value === "string" ? value : String(value ?? "");
}

function hasText(value) {
  return toSafeString(value).trim() !== "";
}

function normalizeLanguage(language, fallback) {
  const normalized = toSafeString(language).trim().toLowerCase();
  return normalized || fallback;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRateLimitError(error) {
  const message = toSafeString(error?.message);
  return error?.statusCode === 429 || message.includes("429");
}

function buildGlossaryLookup(glossaryPairs) {
  const lookup = {};
  if (!Array.isArray(glossaryPairs)) return lookup;
  for (const [source, translated] of glossaryPairs) {
    if (source && translated) {
      lookup[source.toLowerCase()] = translated;
    }
  }
  return lookup;
}

function normalizeGameMarkupSpacing(text) {
  return toSafeString(text)
    .replace(/([^\s([{<])(\[\d+\])/g, "$1 $2")
    .replace(/(\[\d+\])(?=[^\s.,;:!?"\])}])/g, "$1 ")
    .replace(/([^\s([{<])(\[#\d+\])/g, "$1 $2")
    .replace(/(\[#\d+\])(?=[^\s.,;:!?"\])}])/g, "$1 ")
    .replace(/([^\s([{])(<(?!\/?br\b)[A-Za-z][^>]*>)/g, "$1 $2")
    .replace(/(<\/(?!br\b)[A-Za-z][^>]*>)(?=[^\s.,;:!?"\])}])/g, "$1 ");
}

module.exports = {
  toSafeString,
  hasText,
  normalizeLanguage,
  escapeRegExp,
  isRateLimitError,
  buildGlossaryLookup,
  normalizeGameMarkupSpacing,
};
