const path = require("path");
const fs = require("fs");
const {
  DEFAULT_TARGET_LANG,
  DEFAULT_SOURCE_LANG,
} = require("./shared_utils/constants");
const {
  toSafeString,
  hasText,
  normalizeLanguage,
  escapeRegExp,
} = require("./shared_utils/textUtils");
const { runTranslationPipeline } = require("./ai_utils/translationPipeline");
const {
  buildBg3AiSystemPrompt,
  buildFewShotMessages,
  buildSingleUserPrompt,
} = require("./ai_utils/prompt");
const { requestOllamaChatCompletion } = require("./ollama_utils/ollamaChat");
const {
  normalizeOllamaModel,
  DEFAULT_OLLAMA_TEMPERATURE,
} = require("./ollama_utils/constantsAI");
const dictionaryManager = require("./dictionaryManager");

const AI_SETTINGS_FILE_NAME = "ai-translation-settings.json";

// ─── Translation Quality Validation ────────────────────────────────────────────

/**
 * Validate that a translation didn't lose critical structural tokens.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
function validateTranslation(source, translated) {
  if (!hasText(translated)) {
    return { valid: false, reason: "empty" };
  }

  const src = toSafeString(source);
  const trl = toSafeString(translated);

  // Check that numbered placeholders [1], [2], etc. are preserved
  const srcPlaceholders = (src.match(/\[\d+\]/g) || []).sort();
  const trlPlaceholders = (trl.match(/\[\d+\]/g) || []).sort();
  if (srcPlaceholders.join(",") !== trlPlaceholders.join(",")) {
    return { valid: false, reason: "placeholders_mismatch" };
  }

  // Check that {0}, {1} placeholders are preserved
  const srcBraces = (src.match(/\{\d+\}/g) || []).sort();
  const trlBraces = (trl.match(/\{\d+\}/g) || []).sort();
  if (srcBraces.join(",") !== trlBraces.join(",")) {
    return { valid: false, reason: "braces_mismatch" };
  }

  // Check <br> count preserved
  const srcBr = (src.match(/<br\s*\/?>/gi) || []).length;
  const trlBr = (trl.match(/<br\s*\/?>/gi) || []).length;
  if (srcBr !== trlBr) {
    return { valid: false, reason: "br_count_mismatch" };
  }

  // NOTE: <LSTag> and [Tn:] marker counts cannot be validated here:
  // src has raw LSTags, but AI output has [Tn:] markers instead — they're never equal.
  // LSTag/marker integrity is validated inside translateWithMarkupPreservation
  // where both markerText and AI output are available.

  // Translation shouldn't be identical to source (translation happened)
  if (src === trl && src.length > 20) {
    return { valid: false, reason: "untranslated" };
  }

  // Translation shouldn't be way too short or too long vs source
  const ratio = trl.length / Math.max(src.length, 1);
  if (ratio < 0.3 && src.length > 30) {
    return { valid: false, reason: "too_short" };
  }
  if (ratio > 4.0 && src.length > 10) {
    return { valid: false, reason: "too_long" };
  }

  // Detect source-language echo: AI outputted both the original and the translation.
  // Check if the first 28 chars of the source (requires ≥8 Latin letters) appear verbatim
  // in the translated text — a clear sign the model concatenated source + result.
  if (src.length >= 28) {
    const srcSample = src.substring(0, 28);
    const latinLetters = (srcSample.match(/[a-zA-Z]/g) || []).length;
    if (latinLetters >= 8 && trl.includes(srcSample)) {
      return { valid: false, reason: "source_echoed" };
    }
  }

  // Detect repeated content: AI doubled the translation output.
  // Split on sentence terminators and check for repeated segments (≥15 chars each).
  const trlSentences = trl
    .split(/[.!?](?:\s|$)/)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((s) => s.length >= 15);
  if (trlSentences.length >= 2) {
    const seen = new Set();
    for (const seg of trlSentences) {
      if (seen.has(seg)) return { valid: false, reason: "repeated_content" };
      seen.add(seg);
    }
  }

  return { valid: true };
}

// ─── AI Manager ────────────────────────────────────────────────────────────────

class AiManager {
  constructor() {
    this.ollamaModel = normalizeOllamaModel("");
    this.useDictionary = true;
    this.defaultTargetLang = DEFAULT_TARGET_LANG;
    this.defaultSourceLang = DEFAULT_SOURCE_LANG;
    this._settingsPath = "";
  }

  initializeSettings(userDataPath) {
    if (!userDataPath || typeof userDataPath !== "string") return;
    this._settingsPath = path.join(userDataPath, AI_SETTINGS_FILE_NAME);
    this._loadSettings();
  }

  _loadSettings() {
    if (!this._settingsPath || !fs.existsSync(this._settingsPath)) {
      // Migration: read from old shared settings file
      const legacyPath = path.join(path.dirname(this._settingsPath), "translation-settings.json");
      if (fs.existsSync(legacyPath)) {
        try {
          const legacy = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
          this.ollamaModel = normalizeOllamaModel(legacy?.ollama?.model);
          this.useDictionary = legacy?.local?.useDictionary ?? true;
          this._saveSettings();
          return;
        } catch { /* ignore */ }
      }
      return;
    }
    try {
      const data = JSON.parse(fs.readFileSync(this._settingsPath, "utf8"));
      this.ollamaModel = normalizeOllamaModel(data?.ollamaModel);
      this.useDictionary = typeof data?.useDictionary === "boolean" ? data.useDictionary : true;
    } catch {
      /* use defaults */
    }
  }

  _saveSettings() {
    if (!this._settingsPath) return;
    try {
      fs.writeFileSync(this._settingsPath, JSON.stringify({
        ollamaModel: this.ollamaModel,
        useDictionary: this.useDictionary,
      }, null, 2), "utf8");
    } catch (err) {
      console.warn("AiManager: failed to save settings", err?.message);
    }
  }

  setOllamaModel(model) {
    this.ollamaModel = normalizeOllamaModel(model);
    this._saveSettings();
    return this.getSettings();
  }

  setUseDictionary(value) {
    const nextValue = Boolean(value);
    if (this.useDictionary === nextValue) return this.getSettings();
    this.useDictionary = nextValue;
    this._saveSettings();
    return this.getSettings();
  }

  updateSettings(settingsPatch = {}) {
    if (settingsPatch?.ollama?.model !== undefined) {
      this.ollamaModel = normalizeOllamaModel(settingsPatch.ollama.model);
    }
    if (settingsPatch?.local?.useDictionary !== undefined) {
      this.useDictionary = Boolean(settingsPatch.local.useDictionary);
    }
    this._saveSettings();
    return this.getSettings();
  }

  getSettings() {
    return {
      ollama: { model: this.ollamaModel },
      local: { useDictionary: this.useDictionary },
    };
  }

  _resolveRuntimeOptions(targetLang, options = {}, promptGlossaryPairs = null) {
    const glossaryPairs = Array.isArray(options.glossaryPairs) ? options.glossaryPairs : [];
    const glossaryPairsForPrompt = Array.isArray(promptGlossaryPairs)
      ? promptGlossaryPairs
      : glossaryPairs;

    return {
      systemPrompt: buildBg3AiSystemPrompt(glossaryPairsForPrompt, normalizeLanguage(targetLang, this.defaultTargetLang)),
      targetLang: normalizeLanguage(targetLang, this.defaultTargetLang),
      sourceLang: normalizeLanguage(options.sourceLang, this.defaultSourceLang),
      preserveMarkup: options.preserveMarkup !== false,
      model: normalizeOllamaModel(options.ollamaModel || this.ollamaModel),
      temperature: Number.isFinite(options.temperature)
        ? options.temperature
        : DEFAULT_OLLAMA_TEMPERATURE,
      timeoutMs: Number.isFinite(options.timeoutMs) && options.timeoutMs > 5000
        ? Math.floor(options.timeoutMs)
        : 300000,
      glossaryPairs,
      promptGlossaryPairs: glossaryPairsForPrompt,
    };
  }

  _isFatalAiError(error) {
    const message = toSafeString(error?.message);
    return (
      message === "RATE_LIMIT_EXCEEDED" ||
      message === "OLLAMA_MODEL_NOT_FOUND"
    );
  }

  _pickRelevantGlossaryPairs(dataToTranslate, glossaryPairs, maxPairs = 60) {
    if (!Array.isArray(glossaryPairs) || glossaryPairs.length <= maxPairs) {
      return glossaryPairs;
    }

    const combinedText = Object.values(dataToTranslate || {})
      .filter(hasText)
      .map((value) => toSafeString(value).toLowerCase())
      .join(" ");

    if (!combinedText) {
      return glossaryPairs.slice(0, maxPairs);
    }

    const matched = [];
    const fallback = [];

    for (const pair of glossaryPairs) {
      const [source, target] = pair || [];
      if (!source || !target) continue;

      const sourceText = toSafeString(source).trim().toLowerCase();
      if (!sourceText) continue;

      const safeSource = escapeRegExp(sourceText);
      // Allow optional English plural suffix (s / es) so "saving throws" matches "Saving Throw"
      const regex = new RegExp(`(^|[^\\p{L}0-9_])${safeSource}(?:e?s)?($|[^\\p{L}0-9_])`, "giu");
      const hits = (combinedText.match(regex) || []).length;

      if (hits > 0) {
        matched.push({ pair, hits });
      } else {
        fallback.push(pair);
      }
    }

    // Sort matched pairs by frequency (most used in this batch first)
    matched.sort((a, b) => b.hits - a.hits);
    const selected = matched.slice(0, maxPairs).map((m) => m.pair);

    if (selected.length < maxPairs) {
      return selected.concat(fallback).slice(0, maxPairs);
    }
    return selected;
  }

  async _requestCompletion(messages, runtimeOptions, abortSignal = null) {
    return requestOllamaChatCompletion({
      model: runtimeOptions.model,
      messages,
      temperature: runtimeOptions.temperature,
      timeoutMs: runtimeOptions.timeoutMs,
      abortSignal,
    });
  }

  /**
   * Translate a single segment with validation and retry.
   * If the first attempt fails validation, retry once with slightly higher temperature
   * to get a different output.
   */
  async _translateSingleSegment(sourceText, runtimeOptions, abortSignal = null) {
    if (!hasText(sourceText)) {
      return toSafeString(sourceText);
    }

    const src = toSafeString(sourceText);
    const userPrompt = buildSingleUserPrompt({
      sourceLang: runtimeOptions.sourceLang,
      targetLang: runtimeOptions.targetLang,
      text: src,
    });

    const messages = [
      { role: "system", content: runtimeOptions.systemPrompt },
      ...buildFewShotMessages(),
      { role: "user", content: userPrompt },
    ];

    // Attempt 1
    const translated = await this._requestCompletion(messages, runtimeOptions, abortSignal);
    const result = toSafeString(translated) || src;

    const validation = validateTranslation(src, result);
    if (validation.valid) {
      return result;
    }

    // Attempt 2: retry with slightly higher temperature for a different output.
    try {
      const retryOptions = { ...runtimeOptions, temperature: Math.min(runtimeOptions.temperature + 0.15, 0.5) };
      const retryTranslated = await this._requestCompletion(messages, retryOptions, abortSignal);
      const retryResult = toSafeString(retryTranslated) || src;
      const retryValidation = validateTranslation(src, retryResult);
      if (retryValidation.valid) {
        return retryResult;
      }
    } catch (error) {
      if (error.message === 'ABORTED') throw error;
      // Retry failed, use first attempt
    }

    return result;
  }

  async _translateDictionaryWithRetry(dataToTranslate, runtimeOptions, abortSignal = null, onItemProgress = null) {
    const translated = {};
    const entries = Object.entries(dataToTranslate || {});

    if (entries.length === 0) {
      return translated;
    }

    let completedCount = 0;
    const totalCount = entries.length;

    // Always translate each entry individually via the focused single prompt.
    // This matches few-shot format and gives 8B models the best quality —
    // batch mode with delimiters caused marker loss and tag corruption.
    for (const [entryKey, rawText] of entries) {
      const sourceText = toSafeString(rawText);

      if (!hasText(sourceText)) {
        translated[entryKey] = sourceText;
        completedCount++;
        onItemProgress?.({ completed: completedCount, total: totalCount });
        continue;
      }

      if (abortSignal?.aborted) throw new Error('ABORTED');

      try {
        translated[entryKey] = await this._translateSingleSegment(
          sourceText,
          runtimeOptions,
          abortSignal
        );
      } catch (error) {
        if (error.message === 'ABORTED') throw error;
        if (this._isFatalAiError(error)) {
          throw error;
        }
        translated[entryKey] = sourceText;
      }

      completedCount++;
      onItemProgress?.({ completed: completedCount, total: totalCount });
    }

    return translated;
  }

  async translateBatchWithRetry(dataToTranslate, targetLang = this.defaultTargetLang, options = {}) {
    // Inject glossary pairs if dictionary is enabled
    const aiOptions = { ...options };
    if (this.useDictionary && options.useDictionary !== false && !Array.isArray(aiOptions.glossaryPairs)) {
      aiOptions.glossaryPairs = dictionaryManager.toGlossaryPairs();
    }

    const fullGlossaryPairs = Array.isArray(aiOptions.glossaryPairs) ? aiOptions.glossaryPairs : [];
    const promptGlossaryPairs = this._pickRelevantGlossaryPairs(dataToTranslate, fullGlossaryPairs);
    const runtimeOptions = this._resolveRuntimeOptions(targetLang, { ...aiOptions, glossaryPairs: fullGlossaryPairs }, promptGlossaryPairs);
    const entries = Object.entries(dataToTranslate || {});
    if (entries.length === 0) return {};

    const abortSignal = aiOptions.abortSignal;
    const onItemProgress = typeof aiOptions.onItemProgress === 'function' ? aiOptions.onItemProgress : null;

    if (!runtimeOptions.preserveMarkup) {
      return this._translateDictionaryWithRetry(dataToTranslate, runtimeOptions, abortSignal, onItemProgress);
    }

    // Phase 2 callback: main translation pass (with progress events)
    const translateFn = (segmentDict) =>
      this._translateDictionaryWithRetry(segmentDict, runtimeOptions, abortSignal, onItemProgress);

    // Phase 3 retries: silent — must not fire onItemProgress or the bar regresses
    const retryFn = (segmentDict) =>
      this._translateDictionaryWithRetry(segmentDict, runtimeOptions, abortSignal, null);

    return runTranslationPipeline(
      dataToTranslate,
      { translateFn, retryFn },
      runtimeOptions.glossaryPairs
    );
  }
}

module.exports = new AiManager();
