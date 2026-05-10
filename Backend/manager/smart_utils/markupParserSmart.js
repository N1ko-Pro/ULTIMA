const {
  MARKUP_OR_PLACEHOLDER_SPLIT_REGEX,
  MARKUP_TOKEN_REGEX,
  PLACEHOLDER_TOKEN_REGEX,
} = require("./constantsSmart");
const { toSafeString, hasText, normalizeGameMarkupSpacing } = require("../shared_utils/textUtils");

// Inline-marker pipeline: LSTags are replaced with {#N}content{/#N} so that
// the translator sees tag content in its surrounding sentence context.
const LSTAG_REGEX = /<LSTag\b([^>]*)>([\s\S]*?)<\/LSTag>/gi;
const INLINE_TAG_REGEX = /\{#(\d+)\}([\s\S]*?)\{\/#\1\}/g;
const ORPHANED_MARKER_REGEX = /\{\/?#\d+\}/g;

function compressLSTagsInline(text) {
  const map = [];
  const compressed = toSafeString(text).replace(LSTAG_REGEX, (_, attrs, content) => {
    const idx = map.length;
    map.push({ attrs });
    return `{#${idx}}${content.trim()}{/#${idx}}`;
  });
  return { text: compressed, map };
}

function restoreLSTagsInline(text, map) {
  if (!map || map.length === 0) return text;
  let result = toSafeString(text).replace(INLINE_TAG_REGEX, (match, idxStr, content) => {
    const entry = map[parseInt(idxStr, 10)];
    if (!entry) return content.trim();
    return `<LSTag${entry.attrs}>${content.trim()}</LSTag>`;
  });
  // Clean up any orphaned markers that weren't matched as pairs
  result = result.replace(ORPHANED_MARKER_REGEX, '');
  return result;
}

function isFixedToken(token) {
  return MARKUP_TOKEN_REGEX.test(token) || PLACEHOLDER_TOKEN_REGEX.test(token);
}

function isTranslatableSegment(segment) {
  return toSafeString(segment).trim() !== "";
}

function makeSegmentKey(uid, segmentIndex) {
  return `${uid}::SEG::${segmentIndex}`;
}

function buildMarkupAwarePlan(sourceText) {
  const text = toSafeString(sourceText);
  const segments = [];

  const tokens = text
    .split(MARKUP_OR_PLACEHOLDER_SPLIT_REGEX)
    .filter((token) => token !== undefined && token !== "")
    .map((token) => {
      if (isFixedToken(token)) {
        return { type: "fixed", value: token };
      }

      const segmentIndex = segments.length;
      segments.push(token);
      return { type: "segment", index: segmentIndex };
    });

  return { tokens, segments };
}

function rebuildFromMarkupAwarePlan(plan, translatedSegments) {
  return plan.tokens
    .map((token) => {
      if (token.type === "fixed") return token.value;
      return translatedSegments[token.index] ?? plan.segments[token.index] ?? "";
    })
    .join("");
}

async function translateWithMarkupPreservation(dataToTranslate, translateDictionaryFn) {
  const translated = {};
  const entries = Object.entries(dataToTranslate || {});

  if (entries.length === 0) return translated;

  // Phase 1: replace LSTags with inline markers {#N}content{/#N}
  // Tag content stays in the sentence so the translator uses context.
  const compressedMap = {};
  const tagMaps = {};
  for (const [uid, rawText] of entries) {
    const { text, map } = compressLSTagsInline(rawText);
    compressedMap[uid] = text;
    tagMaps[uid] = map;
  }

  // Phase 2: build plans and collect translatable segments
  const plansByUid = {};
  const segmentDictionary = {};
  for (const [uid, compressedText] of Object.entries(compressedMap)) {
    if (!hasText(compressedText)) {
      translated[uid] = compressedText;
      continue;
    }

    const plan = buildMarkupAwarePlan(compressedText);
    plansByUid[uid] = plan;

    let hasTranslatableSegments = false;
    plan.segments.forEach((segment, segmentIndex) => {
      if (!isTranslatableSegment(segment)) return;
      hasTranslatableSegments = true;
      segmentDictionary[makeSegmentKey(uid, segmentIndex)] = segment;
    });

    if (!hasTranslatableSegments) translated[uid] = compressedText;
  }

  if (Object.keys(segmentDictionary).length === 0) {
    for (const uid of Object.keys(translated)) {
      translated[uid] = restoreLSTagsInline(translated[uid], tagMaps[uid]);
    }
    return translated;
  }

  // Phase 3: translate segments
  const translatedSegments = await translateDictionaryFn(segmentDictionary);

  // Phase 4: reassemble and restore LSTags
  for (const [uid, rawText] of entries) {
    if (translated[uid] !== undefined) {
      translated[uid] = restoreLSTagsInline(translated[uid], tagMaps[uid]);
      continue;
    }

    const plan = plansByUid[uid];
    if (!plan) {
      translated[uid] = toSafeString(rawText);
      continue;
    }

    const rowTranslatedSegments = plan.segments.map((segment, segmentIndex) => {
      if (!isTranslatableSegment(segment)) return segment;
      return translatedSegments[makeSegmentKey(uid, segmentIndex)] ?? segment;
    });

    const assembled = rebuildFromMarkupAwarePlan(plan, rowTranslatedSegments);
    const restored = restoreLSTagsInline(assembled, tagMaps[uid]);
    translated[uid] = normalizeGameMarkupSpacing(restored);
  }

  return translated;
}

module.exports = {
  translateWithMarkupPreservation,
};
