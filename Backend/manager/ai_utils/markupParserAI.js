const { toSafeString, escapeRegExp } = require("../shared_utils/textUtils");

// Post-translation markup handling — sanitize AI output, restore [Tn:word] markers to <LSTag>

const CYRILLIC_VOWELS = new Set("аеёиоуыэюя");

/**
 * Fix doubled-vowel typos from AI output (e.g. "ослепиить" → "ослепить").
 * Only removes doubled vowels absent from the glossary reference word.
 */
function fixAiDoubledVowels(aiWord, glossaryWord) {
  const gw = glossaryWord.toLowerCase();
  let result = "";
  for (let i = 0; i < aiWord.length; i++) {
    const ch = aiWord[i].toLowerCase();
    if (i > 0 && ch === aiWord[i - 1].toLowerCase() && CYRILLIC_VOWELS.has(ch) && !gw.includes(ch + ch)) {
      continue;
    }
    result += aiWord[i];
  }
  return result;
}

/**
 * Fix common AI corruption of XML tags in output.
 * The 8B model often breaks <LSTag Tooltip="Value"> by inserting a premature `>`
 * mid-way through an attribute name: <LSTag T>ooltip="Value"> or using [LSTag.
 */
function sanitizeAiXmlOutput(text) {
  if (!text) return text;
  let result = text;

  // Fix bracket corruption: [LSTag → <LSTag, [/LSTag] → </LSTag>
  result = result.replace(/\[LSTag\b/g, "<LSTag");
  // Fix ] closing bracket on opening tag: <LSTag Tooltip="X"]text → <LSTag Tooltip="X">text
  result = result.replace(/(<LSTag\b[^>]*?")\]/g, "$1>");
  result = result.replace(/\[\/LSTag[\]>]/g, "</LSTag>");

  // Fix split opening tag where AI inserts `>` mid-attribute name:
  // <LSTag T>ooltip="AttackRoll">  →  <LSTag Tooltip="AttackRoll">
  // <LSTag T>ype="Spell" Tooltip="X">  →  <LSTag Type="Spell" Tooltip="X">
  // Pattern: <LSTag [partial_name]> [rest_of_attrs]>
  result = result.replace(
    /<LSTag\s+([A-Za-z]*)>([A-Za-z]+(?:="[^"]*")?(?:\s+[A-Za-z]+(?:="[^"]*")?)*)>/g,
    "<LSTag $1$2>"
  );

  return result;
}

/**
 * Remove <LSTag> wrappers hallucinated by the AI — i.e. tags the AI added that
 * were NOT present in the markerText sent to it.
 *
 * In our pipeline, all glossary-resolved LSTags become [Tn:word] markers, so
 * markerText has ZERO <LSTag> for those tooltips. If the AI still outputs
 * <LSTag Tooltip="AttackRoll"> for plain text "броски атаки", it's a hallucination.
 * We strip the wrapper and keep the content.
 */
function removeHallucinatedLSTags(aiOutput, markerText) {
  if (!aiOutput) return aiOutput;
  // Count expected <LSTag> per Tooltip in markerText (raw non-glossary only)
  const expected = {};
  const tagRe = /<LSTag\b[^>]*?Tooltip="([^"]*)"/gi;
  let m;
  while ((m = tagRe.exec(markerText)) !== null) {
    const tp = m[1];
    expected[tp] = (expected[tp] || 0) + 1;
  }
  // Strip any excess occurrences in AI output
  const counts = {};
  return aiOutput.replace(/<LSTag\b[^>]*?Tooltip="([^"]*)"[^>]*>([\s\S]*?)<\/LSTag>/gi, (full, tooltip, content) => {
    counts[tooltip] = (counts[tooltip] || 0) + 1;
    return counts[tooltip] <= (expected[tooltip] || 0) ? full : content;
  });
}

function rewrapInOutsideSegments(text, attrs, baseTranslated, stem, originalCase) {
  if (!text || !baseTranslated) return text;

  function enforceCase(s) {
    if (!s || !originalCase) return s;
    if (originalCase === "upper" && s[0] !== s[0].toUpperCase()) {
      return s[0].toUpperCase() + s.slice(1);
    }
    if (originalCase === "lower" && s[0] !== s[0].toLowerCase()) {
      return s[0].toLowerCase() + s.slice(1);
    }
    return s;
  }

  const parts = text.split(/(<LSTag\b[^>]*>[\s\S]*?<\/LSTag>)/gi);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      let seg = parts[i];
      const exact = new RegExp("(?<![\\p{L}])" + escapeRegExp(baseTranslated) + "(?![\\p{L}])", "iu");
      const mExact = seg.match(exact);
      if (mExact) {
        const content = enforceCase(mExact[0]);
        seg = seg.replace(exact, `<LSTag${attrs}>${content}</LSTag>`);
        parts[i] = seg;
        break;
      }
      const stemRegex = new RegExp("(?<![\\p{L}])" + escapeRegExp(stem) + "[\\p{L}]*(?![\\p{L}])", "iu");
      const mStem = seg.match(stemRegex);
      if (mStem) {
        const content = enforceCase(mStem[0]);
        seg = seg.replace(stemRegex, `<LSTag${attrs}>${content}</LSTag>`);
        parts[i] = seg;
        break;
      }
    }
  }
  return parts.join("");
}

// --- TAG MARKER substitution ---

// Bracket-based marker format: [T1:word] (glossary) or [T1] (opaque)
const TAG_MARKER_REGEX = /\[T(\d+)(?::([\s\S]*?))?\]/g;

/**
 * Replace [Tn:word] markers back with <LSTag attrs>word</LSTag>.
 * Uses content-based matching (not just IDs) to handle AI marker renumbering.
 * Falls back to Unicode-aware stem matching for any markers dropped by the AI.
 */
function restoreTagsFromMarkers(text, markerMap) {
  if (!markerMap || markerMap.length === 0) {
    // No markers expected — strip any hallucinated [Tn:word] to just the word
    return (text || "").replace(/\[T\d+(?::([\s\S]*?))?\]/g, (_, w) => (w || "").trim());
  }

  const safeText = toSafeString(text);

  // Phase 1: Collect all [Tn:word] and [Tn] markers from AI output
  const outputMarkers = [];
  const collectRe = /\[T(\d+)(?::([\s\S]*?))?\]/g;
  let m;
  while ((m = collectRe.exec(safeText)) !== null) {
    outputMarkers.push({ id: parseInt(m[1], 10), word: (m[2] || "").trim() });
  }

  if (outputMarkers.length === 0) {
    // AI dropped ALL markers — stem-match every entry in the remaining text
    let result = safeText;
    for (const entry of markerMap) {
      const word = (entry.word || "").trim();
      if (!word) continue;
      const stemLen = Math.max(3, word.length - 3);
      const stem = word.toLowerCase().slice(0, stemLen);
      result = rewrapInOutsideSegments(result, entry.attrs, word, stem, entry.originalCase);
    }
    return result;
  }

  // Phase 2: Match output markers → markerMap entries using content-based matching.
  const usedEntries = new Set();
  const assignments = new Array(outputMarkers.length);

  // Pass 1: exact content match (case-insensitive), also check shortWord
  for (let i = 0; i < outputMarkers.length; i++) {
    const omWord = outputMarkers[i].word.toLowerCase();
    for (const entry of markerMap) {
      if (usedEntries.has(entry.index)) continue;
      const entryWord = (entry.word || "").trim().toLowerCase();
      const entryShort = (entry.shortWord || "").trim().toLowerCase();
      if (entryWord === omWord || entryShort === omWord) {
        assignments[i] = entry;
        usedEntries.add(entry.index);
        break;
      }
    }
  }

  // Pass 2: stem match for unmatched output markers (word-by-word for multi-word)
  for (let i = 0; i < outputMarkers.length; i++) {
    if (assignments[i]) continue;
    const omWord = outputMarkers[i].word.toLowerCase();
    if (!omWord) continue;

    let bestEntry = null;
    let bestScore = 0;

    for (const entry of markerMap) {
      if (usedEntries.has(entry.index)) continue;
      const entryWord = (entry.word || "").trim().toLowerCase();
      if (!entryWord) continue;

      let score;
      const omWords = omWord.split(/\s+/);
      const entryWords = entryWord.split(/\s+/);

      if (entryWords.length > 1 || omWords.length > 1) {
        // Multi-word: compare per-word stems independently
        let matched = 0;
        for (const ew of entryWords) {
          const ewStem = ew.slice(0, Math.max(3, ew.length - 2));
          for (const ow of omWords) {
            const owStem = ow.slice(0, Math.max(3, ow.length - 2));
            const ml = Math.min(ewStem.length, owStem.length);
            if (ml >= 3 && ewStem.slice(0, ml) === owStem.slice(0, ml)) {
              matched++;
              break;
            }
          }
        }
        score = entryWords.length > 0 ? matched / entryWords.length : 0;
      } else {
        // Single-word: prefix comparison
        const omStem = omWord.slice(0, Math.max(3, omWord.length - 3));
        const entryStem = entryWord.slice(0, Math.max(3, entryWord.length - 3));
        const minLen = Math.min(omStem.length, entryStem.length);
        let common = 0;
        for (let c = 0; c < minLen; c++) {
          if (omStem[c] === entryStem[c]) common++;
          else break;
        }
        const maxLen = Math.max(omStem.length, entryStem.length);
        score = maxLen > 0 ? common / maxLen : 0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    if (bestEntry && bestScore >= 0.5) {
      assignments[i] = bestEntry;
      usedEntries.add(bestEntry.index);
    }
  }

  // Pass 3: ID-based fallback for still-unmatched output markers
  for (let i = 0; i < outputMarkers.length; i++) {
    if (assignments[i]) continue;
    const entry = markerMap.find(e => e.index === outputMarkers[i].id && !usedEntries.has(e.index));
    if (entry) {
      assignments[i] = entry;
      usedEntries.add(entry.index);
    }
  }

  // Pass 4: Positional fallback — assign remaining unmatched output markers to
  // remaining markerMap entries in order. Handles AI renumbering AND cross-language
  // mismatch (English entry word vs Russian AI output) where passes 1-3 all fail.
  const unusedEntries = markerMap.filter(e => !usedEntries.has(e.index));
  let unusedIdx = 0;
  for (let i = 0; i < outputMarkers.length; i++) {
    if (assignments[i]) continue;
    if (unusedIdx < unusedEntries.length) {
      assignments[i] = unusedEntries[unusedIdx];
      usedEntries.add(unusedEntries[unusedIdx].index);
      unusedIdx++;
    }
  }

  // Phase 3: Replace markers with LSTags.
  // Use AI output (inflected form) only if it stem-matches the glossary entry.
  // If AI replaced the glossary word with a synonym, fall back to the glossary word.
  let outputIdx = 0;
  let result = safeText.replace(TAG_MARKER_REGEX, (_full, _idStr, word) => {
    const entry = assignments[outputIdx];
    outputIdx++;
    if (entry) {
      const aiWord = (word || "").trim();
      let tagContent = aiWord || entry.word;

      // Validate AI word matches glossary entry root (per-word for multi-word).
      // Uses common-prefix ratio to handle Russian morphology: verb/adj/noun
      // forms of the same root diverge early (ослеп-ить vs ослепл-ённый).
      if (aiWord && entry.glossaryResolved) {
        // Fix doubled-vowel typos before validation (e.g. "ослепиить" → "ослепить")
        const fixedWord = fixAiDoubledVowels(aiWord, entry.word);

        const glossaryWords = entry.word.toLowerCase().split(/\s+/);
        const fixedWords = fixedWord.toLowerCase().split(/\s+/);
        const valid = glossaryWords.every(gw => {
          const gwStem = gw.slice(0, Math.max(3, gw.length - 2));
          return fixedWords.some(aw => {
            const awStem = aw.slice(0, Math.max(3, aw.length - 2));
            const ml = Math.min(gwStem.length, awStem.length);
            if (ml < 3) return false;
            let common = 0;
            for (let c = 0; c < ml; c++) {
              if (gwStem[c] === awStem[c]) common++;
              else break;
            }
            // Accept if common prefix covers ≥70% of the shorter stem (min 3 chars)
            return common >= 3 && common >= Math.ceil(ml * 0.7);
          });
        });
        if (!valid) {
          // AI substituted synonym — use glossary word instead
          tagContent = entry.word;
        } else {
          tagContent = fixedWord;
        }
      }

      // Enforce case from the original English word
      if (entry.originalCase === "upper" && tagContent[0] !== tagContent[0].toUpperCase()) {
        tagContent = tagContent[0].toUpperCase() + tagContent.slice(1);
      } else if (entry.originalCase === "lower" && tagContent[0] !== tagContent[0].toLowerCase()) {
        tagContent = tagContent[0].toLowerCase() + tagContent.slice(1);
      }
      return `<LSTag${entry.attrs}>${tagContent}</LSTag>`;
    }
    return (word || "").trim();
  });

  // Phase 4: Fallback — recover any dropped markers via stem matching
  for (const entry of markerMap) {
    if (usedEntries.has(entry.index)) continue;
    const word = (entry.word || "").trim();
    if (!word) continue;
    const stemLen = Math.max(3, word.length - 3);
    // For multi-word entries (e.g. "Проверка характеристики"), stem matching with spaces
    // fails because word-boundary regex can't span spaces. Use first word only.
    const firstWord = word.split(/\s+/)[0];
    const stem = word.includes(" ")
      ? firstWord.toLowerCase().slice(0, Math.max(3, firstWord.length - 2))
      : word.toLowerCase().slice(0, stemLen);
    result = rewrapInOutsideSegments(result, entry.attrs, word, stem, entry.originalCase);
  }

  // Phase 5: Absorb trailing words split from multi-word glossary entries.
  // AI sometimes writes [T2:проверках] характеристики instead of [T2:проверках характеристики],
  // producing <LSTag>проверках</LSTag> характеристики after Phase 3. Absorb the trailing word.
  const multiWordEntries = markerMap.filter(e => e.glossaryResolved && (e.word || "").includes(" "));
  if (multiWordEntries.length > 0) {
    result = result.replace(
      /(<LSTag\b([^>]*)>)([^<]+)(<\/LSTag>)\s+([\p{L}]+)/giu,
      (full, open, attrs, content, close, nextWord) => {
        const entry = multiWordEntries.find(e => e.attrs.trim() === attrs.trim());
        if (!entry) return full;
        if (content.trim().includes(" ")) return full; // Already multi-word inside tag

        const words = entry.word.trim().split(/\s+/);
        const firstStem = words[0].toLowerCase().slice(0, Math.max(3, words[0].length - 2));
        const contentStem = content.trim().toLowerCase().slice(0, firstStem.length);

        const secondStem = words[1].toLowerCase().slice(0, Math.max(3, words[1].length - 2));
        const nextStem = nextWord.toLowerCase().slice(0, secondStem.length);

        if (contentStem === firstStem && nextStem === secondStem) {
          return `${open}${content.trim()} ${nextWord}${close}`;
        }
        return full;
      }
    );
  }

  // Phase 6: Strip any remaining [Tn:...] markers that weren't restored (AI hallucinations)
  result = result.replace(/\[T\d+:([^\]]+)\]/g, "$1");
  result = result.replace(/\[T\d+\]/g, "");

  return result;
}

module.exports = {
  sanitizeAiXmlOutput,
  removeHallucinatedLSTags,
  restoreTagsFromMarkers,
};
