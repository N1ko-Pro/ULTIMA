// Pre-translation glossary resolution — match English text to glossary entries,
// resolve LSTag content via glossary lookup, stem-based matching for short texts.

const LSTAG_REGEX = /<LSTag\b([^>]*)>([\s\S]*?)<\/LSTag>/gi;

/**
 * Resolve a translated word for LSTag content using (in priority order):
 * 1) exact glossary match on content
 * 2) glossary match on tooltip (direct + camelCase-split)
 * 3) original content as-is (AI will translate it in-context via marker)
 */
function resolveTagTranslation(content, attrs, glossaryLookup) {
  const base = (content || "").trim();
  if (!base) return base;

  // Detect original case: first letter lowercase → result should be lowercase too
  const isLower = base[0] === base[0].toLowerCase() && base[0] !== base[0].toUpperCase();

  function matchCase(translated) {
    if (!translated || !isLower) return translated;
    return translated[0].toLowerCase() + translated.slice(1);
  }

  // Try glossary lookup with singular/plural fallback
  function tryGlossary(word) {
    if (!word) return undefined;
    const lower = word.toLowerCase();
    // Exact match
    const exact = glossaryLookup[lower];
    if (exact) return exact;
    // Singular fallback: "attack rolls" → "attack roll", "checks" → "check", "saving throws" → "saving throw"
    if (lower.endsWith("ies")) {
      const sing = glossaryLookup[lower.slice(0, -3) + "y"];
      if (sing) return sing;
    }
    if (lower.endsWith("es")) {
      const sing = glossaryLookup[lower.slice(0, -2)];
      if (sing) return sing;
    }
    if (lower.endsWith("s")) {
      const sing = glossaryLookup[lower.slice(0, -1)];
      if (sing) return sing;
    }
    return undefined;
  }

  // 1. Glossary match on content (exact + plural fallback)
  const contentMatch = tryGlossary(base);
  if (contentMatch) return matchCase(contentMatch);

  // 2. Try tooltip-based matching
  const tooltipMatch = (attrs || "").match(/Tooltip="([^"]+)"/i);
  const tooltip = tooltipMatch ? tooltipMatch[1] : "";

  if (tooltip) {
    // 2a. Direct glossary match on tooltip value
    const tooltipDirect = tryGlossary(tooltip);
    if (tooltipDirect) return matchCase(tooltipDirect);

    // 2b. Split camelCase/underscores: "AbilityCheck" → "Ability Check", "SD_Target_X" → parts
    const spaced = tooltip
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    const spacedMatch = tryGlossary(spaced);
    if (spacedMatch) return matchCase(spacedMatch);

    // 2c. Try individual words from split tooltip (longest first for compound terms)
    const parts = spaced.split(/\s+/).filter(p => p.length > 2);
    if (parts.length > 2) {
      for (let len = Math.min(parts.length, 3); len >= 1; len--) {
        for (let i = 0; i <= parts.length - len; i++) {
          const phrase = parts.slice(i, i + len).join(" ");
          const sub = tryGlossary(phrase);
          if (sub) return matchCase(sub);
        }
      }
    }
  }

  // 3. No translation found — keep original content.
  return base;
}

// --- Simple English stemmer for glossary matching ---

function simpleEnglishStem(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return w;
  if (w.endsWith("ly")) return w.slice(0, -2);
  if (w.endsWith("ing")) return w.slice(0, -3);
  if (w.endsWith("ed")) return w.slice(0, -2);
  if (w.endsWith("es")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/**
 * Match short English text against glossary using stem-based comparison.
 * Returns the glossary target if a confident match is found, null otherwise.
 * Handles variant forms: "Attacking Recklessly" ≈ "Reckless Attack".
 */
function findBestGlossaryMatch(text, glossaryPairs) {
  if (!text || !Array.isArray(glossaryPairs)) return null;
  const textWords = text.trim().split(/\s+/).filter(w => w.length > 1);
  if (textWords.length === 0 || textWords.length > 7) return null;

  const textLower = text.toLowerCase().trim();

  // 1. Exact match
  for (const [source, target] of glossaryPairs) {
    if (source.toLowerCase() === textLower) return target;
  }

  // 2. Stem-based match: all glossary source stems must appear in text stems
  const textStems = textWords.map(w => simpleEnglishStem(w));
  let bestMatch = null;
  let bestLen = 0;

  for (const [source, target] of glossaryPairs) {
    const sourceWords = source.toLowerCase().split(/\s+/);
    if (sourceWords.length === 0) continue;
    const sourceStems = sourceWords.map(w => simpleEnglishStem(w));

    const allMatched = sourceStems.every(ss =>
      textStems.some(ts => {
        const ml = Math.min(ts.length, ss.length);
        return ml >= 3 && ts.slice(0, ml) === ss.slice(0, ml);
      })
    );

    // Text shouldn't have too many extra words (max 2 beyond glossary entry)
    // Coverage: glossary entry must cover at least half the text words
    const coverage = sourceWords.length / textWords.length;
    if (allMatched && textWords.length <= sourceWords.length + 2 && coverage >= 0.5 && sourceWords.length > bestLen) {
      bestLen = sourceWords.length;
      bestMatch = target;
    }
  }

  return bestMatch;
}

module.exports = {
  resolveTagTranslation,
  findBestGlossaryMatch,
};
