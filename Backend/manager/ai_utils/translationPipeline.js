const { toSafeString, hasText, normalizeGameMarkupSpacing, buildGlossaryLookup } = require("../shared_utils/textUtils");
const {
  resolveTagTranslation,
  findBestGlossaryMatch,
} = require("./glossaryResolver");
const {
  sanitizeAiXmlOutput,
  removeHallucinatedLSTags,
  restoreTagsFromMarkers,
} = require("./markupParserAI");

// ─── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_UNIT_STRIP_RE =
  /(\[\d+\])\s+(?:damage|piercing damage|slashing damage|bludgeoning damage|fire damage|cold damage|lightning damage|thunder damage|acid damage|poison damage|necrotic damage|radiant damage|force damage|psychic damage|(?:(?:additional|extra)\s+)?damage|ft\.?|feet)\b/gi;

const RUSSIAN_UNIT_STRIP_RE =
  /(\[\d+\])\s+(?:урон[аеуыоьи]?[мв]?|фут[аоыев]?[мвх]?и?|метр[аоуеыв]?[мвх]?и?|damage|feet|ft\.?)(?!\p{L})/giu;

// ─── Phase 1: Pre-processing ───────────────────────────────────────────────────
// Resolve glossary terms in LSTags → [Tn:word] markers for AI.
// Strip English unit words after [n] tokens.
// Direct glossary match for short standalone texts.

function phasePreProcess(dataEntries, glossaryPairs) {
  const glossaryLookup = buildGlossaryLookup(glossaryPairs);
  const translated = {};
  const toTranslate = {};
  const markerMaps = {};

  for (const [uid, rawText] of dataEntries) {
    const text = toSafeString(rawText);
    if (!hasText(text)) {
      translated[uid] = text;
      continue;
    }

    const markerMap = [];
    let idx = 0;
    const lsTagRe = /<LSTag\b([^>]*)>([\s\S]*?)<\/LSTag>/gi;

    // Convert EVERY LSTag to a [Tn:word] marker — uniform format for the AI.
    // Glossary-resolved tags get the Russian word; unresolved keep the English word.
    // The AI sees only markers (no raw XML), which prevents mixed-format confusion.
    const markerText = text.replace(lsTagRe, (_, attrs, content) => {
      const original = (content || "").trim();
      const resolved = original ? resolveTagTranslation(original, attrs, glossaryLookup) : original;
      const glossaryResolved = resolved !== original;

      idx++;
      const word = glossaryResolved ? resolved : original;
      const shortWord = (word || "").toLowerCase();
      const firstChar = (original || "")[0] || "";
      const originalCase = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase() ? "upper" : "lower";

      markerMap.push({ index: idx, attrs, word: word || '', originalWord: original || '', shortWord, glossaryResolved, originalCase });

      if (!word) return `[T${idx}]`;
      return `[T${idx}:${shortWord}]`;
    });

    markerMaps[uid] = markerMap;
    const cleaned = markerText.replace(SOURCE_UNIT_STRIP_RE, "$1");
    toTranslate[uid] = cleaned;
  }

  // Direct glossary match for short texts without markers/LSTags
  if (Array.isArray(glossaryPairs) && glossaryPairs.length > 0) {
    for (const uid of Object.keys(toTranslate)) {
      const mMap = markerMaps[uid] || [];
      const mText = toTranslate[uid];
      if (mMap.length > 0) continue;
      if (!mText || /<LSTag\b/i.test(mText)) continue;
      const words = mText.trim().split(/\s+/);
      if (words.length === 0 || words.length > 7) continue;

      const match = findBestGlossaryMatch(mText, glossaryPairs);
      if (match) {
        translated[uid] = match;
        delete toTranslate[uid];
      }
    }
  }

  return { translated, toTranslate, markerMaps };
}

// ─── Phase 3: Structural Validation ────────────────────────────────────────────
// Sanitize AI XML output, retry individual entries with dropped markers,
// remove hallucinated LSTags.

async function phaseStructuralValidation(text, markerText, mMap, translateFn, uid) {
  let result = sanitizeAiXmlOutput(text);

  if (mMap.length > 0) {
    const countMarkers = (t) => (t.match(/\[T\d+[:\]]/g) || []).length;
    let actualMarkers = countMarkers(result);

    // Retry 1: same input, different temperature (handled by translateFn internals)
    if (actualMarkers < mMap.length) {
      try {
        const retried = await translateFn({ [uid]: markerText });
        const retriedText = sanitizeAiXmlOutput(retried[uid] || result);
        const retriedCount = countMarkers(retriedText);
        if (retriedCount > actualMarkers) {
          result = retriedText;
          actualMarkers = retriedCount;
        }
      } catch { /* fallback handles remaining drops */ }
    }

    // Retry 2: append marker reminder to input if still missing markers
    if (actualMarkers < mMap.length) {
      try {
        const markerList = mMap.map(e => `[T${e.index}:${e.shortWord || ''}]`).join(', ');
        const reinforced = markerText + `\n\n(Сохрани все маркеры: ${markerList})`;
        const retried2 = await translateFn({ [uid]: reinforced });
        const retried2Text = sanitizeAiXmlOutput(retried2[uid] || result);
        const retried2Count = countMarkers(retried2Text);
        if (retried2Count > actualMarkers) {
          result = retried2Text;
        }
      } catch { /* positional fallback in restoreTagsFromMarkers handles remaining */ }
    }
  }

  result = removeHallucinatedLSTags(result, markerText);
  return result;
}

// ─── Phase 4 / 6: Unit Stripping & Typo Fix ───────────────────────────────────
// Strip Russian unit words after [n] tokens and fix common AI typos.

function phaseUnitStripping(text) {
  let result = text.replace(RUSSIAN_UNIT_STRIP_RE, "$1");
  result = result
    .replace(/уронну(?!\p{L})/giu, "урону")
    .replace(/уроню(?!\p{L})/giu, "урону")
    .replace(/уронению(?!\p{L})/giu, "урону")
    .replace(/уронение(?!\p{L})/giu, "урон");
  return result;
}

// ─── BR normalization ──────────────────────────────────────────────────────────
// LLMs often reformat inline <br><br> to separate lines.
// Collapse back to inline to preserve single-line structure.

function normalizeBrTags(text) {
  return text.replace(/\s*\n\s*(<br\s*\/?>\s*(?:<br\s*\/?>\s*)*)\n\s*/gi, "$1");
}

// ─── Phase 7: Tag Restoration ──────────────────────────────────────────────────
// Reuse first-seen translation for repeated segments across entries.

function phaseSegmentDedup(translated, dataToTranslate, allEntries) {
  const normTkKey = (s) => s.replace(/\[\d+\]/g, "[#]").trim();
  const getTkList = (s) => {
    const tokens = [];
    s.replace(/\[(\d+)\]/g, (_, n) => {
      tokens.push(n);
    });
    return tokens;
  };
  const remapTk = (text, from, to) => {
    if (from.length !== to.length) return text;
    const m = {};
    for (let i = 0; i < from.length; i++) {
      if (from[i] !== to[i]) m[from[i]] = to[i];
    }
    if (!Object.keys(m).length) return text;
    let r = text;
    for (const [f, t] of Object.entries(m))
      r = r.replace(new RegExp("\\[" + f + "\\]", "g"), `[__TK${t}__]`);
    return r.replace(/\[__TK(\d+)__\]/g, "[$1]");
  };

  const BR_SPLIT = /((?:<br\s*\/?\s*>\s*)+)/gi;
  const segCache = new Map();

  const sortedUids = allEntries
    .map(([uid]) => uid)
    .filter((uid) => translated[uid] !== undefined)
    .sort(
      (a, b) =>
        toSafeString(dataToTranslate[a] || "").length -
        toSafeString(dataToTranslate[b] || "").length
    );

  for (const uid of sortedUids) {
    const rawText = toSafeString(dataToTranslate[uid] || "");
    const transText = translated[uid];

    const srcParts = rawText.split(BR_SPLIT);
    const transParts = transText.split(BR_SPLIT);

    const srcSegs = srcParts.filter((_, i) => i % 2 === 0);
    const transSegs = transParts.filter((_, i) => i % 2 === 0);
    const transSeps = transParts.filter((_, i) => i % 2 === 1);

    if (srcSegs.length !== transSegs.length) continue;

    let changed = false;
    for (let i = 0; i < srcSegs.length; i++) {
      const raw = srcSegs[i].trim();
      if (!raw || raw.length < 15 || !/[\p{L}]/u.test(raw)) continue;

      const key = normTkKey(raw);
      const tokens = getTkList(raw);

      if (segCache.has(key)) {
        const cached = segCache.get(key);
        const remapped = remapTk(cached.trans, cached.tokens, tokens);
        if (transSegs[i].trim() !== remapped.trim()) {
          transSegs[i] = remapped;
          changed = true;
        }
      } else {
        segCache.set(key, { trans: transSegs[i], tokens });
      }
    }

    if (changed) {
      const parts = [];
      for (let i = 0; i < transSegs.length; i++) {
        parts.push(transSegs[i]);
        if (i < transSeps.length) parts.push(transSeps[i]);
      }
      translated[uid] = normalizeGameMarkupSpacing(parts.join(""));
    }
  }
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────────
//
//  Phase 1 — Pre-processing:       glossary → markers, strip source units
//  Phase 2 — AI Translation:       main translation pass
//  Phase 3 — Structural Validation: sanitize XML, retry dropped markers
//  Phase 4 — Unit Stripping:       strip Russian unit words, fix typos
//  Phase 5 — Tag Restoration:      [Tn:word] → <LSTag>
//  Phase 6 — Final Cleanup:        normalize + segment dedup

async function runTranslationPipeline(dataToTranslate, callbacks, glossaryPairs) {
  const { translateFn } = callbacks;
  const entries = Object.entries(dataToTranslate || {});
  if (entries.length === 0) return {};

  // ── Phase 1: Pre-processing ──────────────────────────────────────────────────
  const { translated, toTranslate, markerMaps } = phasePreProcess(
    entries,
    glossaryPairs
  );

  if (Object.keys(toTranslate).length === 0) return translated;

  // ── Phase 2: AI Translation ──────────────────────────────────────────────────
  const translatedDict = await translateFn(toTranslate);

  // ── Phases 3–6: Per-entry processing ─────────────────────────────────────────
  for (const [uid, rawText] of entries) {
    if (translated[uid] !== undefined) continue;
    const mMap = markerMaps[uid] || [];
    const markerText = toTranslate[uid] || toSafeString(rawText);
    let text = translatedDict[uid] ?? toSafeString(rawText);

    // Phase 3: Structural validation + retry
    text = await phaseStructuralValidation(
      text,
      markerText,
      mMap,
      translateFn,
      uid
    );

    // Phase 4: Unit stripping + br normalization
    text = phaseUnitStripping(text);
    text = normalizeBrTags(text);

    // Phase 5: Tag restoration — [Tn:word] → <LSTag>
    text = sanitizeAiXmlOutput(text);
    text = removeHallucinatedLSTags(text, markerText);
    text = phaseUnitStripping(text);
    const withTags = restoreTagsFromMarkers(text, mMap);

    // Phase 6: Final cleanup
    let finalText = normalizeBrTags(withTags);
    finalText = sanitizeAiXmlOutput(finalText);
    finalText = phaseUnitStripping(finalText);
    translated[uid] = normalizeGameMarkupSpacing(finalText);
  }

  // ── Segment dedup ────────────────────────────────────────────────────────────
  phaseSegmentDedup(translated, dataToTranslate, entries);

  return translated;
}

module.exports = { runTranslationPipeline };
