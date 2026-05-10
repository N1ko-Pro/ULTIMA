const { translate: singleTranslate, batchTranslate: translateBatchX } = require("google-translate-api-x");
const { translate: translateCompatibility } = require("@vitalets/google-translate-api");

const {
  DEFAULT_METHOD,
  DEFAULT_CHUNK_SIZE_LIMIT,
} = require("./constantsSmart");
const {
  DEFAULT_TARGET_LANG,
  DEFAULT_SOURCE_LANG,
} = require("../shared_utils/constants");
const {
  toSafeString,
  hasText,
  normalizeLanguage,
  isRateLimitError,
} = require("../shared_utils/textUtils");
const { appendWithDelimiter, splitTranslatedBatch } = require("./batchSplitter");
const { translateWithMarkupPreservation } = require("./markupParserSmart");
const proxyManager = require("../proxyManager");

const METHODS = {
  standard: translateBatchX,
  single: singleTranslate,
  compatibility: translateCompatibility,
};

function isRateLimitExceededError(error) {
  return error?.message === "RATE_LIMIT_EXCEEDED" || isRateLimitError(error);
}

class GoogleTranslateManager {
  constructor() {
    this.currentMethod = DEFAULT_METHOD;
    this.defaultTargetLang = DEFAULT_TARGET_LANG;
    this.defaultSourceLang = DEFAULT_SOURCE_LANG;
    this.defaultChunkSizeLimit = DEFAULT_CHUNK_SIZE_LIMIT;
  }

  setMethod(method) {
    if (METHODS[method]) {
      this.currentMethod = method;
      return true;
    }
    return false;
  }

  getMethod() {
    return this.currentMethod;
  }

  getRuntimeSettings() {
    return {
      method: this.currentMethod,
      defaultTargetLang: this.defaultTargetLang,
      defaultSourceLang: this.defaultSourceLang,
      chunkSizeLimit: this.defaultChunkSizeLimit,
      proxy: proxyManager.getRuntimeInfo(),
    };
  }

  _buildRequestOptions(options = {}) {
    const requestOptions = { ...(options.requestOptions || {}) };

    if (!requestOptions.agent && options.useProxy !== false) {
      const proxyAgent = proxyManager.getAgent();
      if (proxyAgent) {
        requestOptions.agent = proxyAgent;
      }
    }

    return requestOptions;
  }

  _buildProviderOptions(targetLang, options = {}) {
    const to = normalizeLanguage(targetLang, this.defaultTargetLang);
    const from = normalizeLanguage(options.sourceLang, this.defaultSourceLang);

    const providerOptions = { to };
    if (from && from !== "auto") {
      providerOptions.from = from;
    }

    if (this.currentMethod === "standard") {
      providerOptions.rejectOnPartialFail = false;
    }

    const requestOptions = this._buildRequestOptions(options);
    if (Object.keys(requestOptions).length > 0) {
      if (this.currentMethod === "compatibility") {
        providerOptions.fetchOptions = requestOptions;
      } else {
        providerOptions.requestOptions = requestOptions;
      }
    }

    return providerOptions;
  }

  async _executeWithRateLimitRecovery(operation, options = {}) {
    const allowProxyRotation = options.useProxy !== false && options.allowProxyRotation !== false;
    const poolSize = proxyManager.getPoolSize();
    const maxAttempts = allowProxyRotation && poolSize > 0 ? poolSize : 1;

    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        if (!isRateLimitError(error)) {
          throw error;
        }

        attempt += 1;

        if (!allowProxyRotation || attempt >= maxAttempts) {
          throw new Error("RATE_LIMIT_EXCEEDED");
        }

        const rotated = proxyManager.rotate();
        if (!rotated) {
          throw new Error("RATE_LIMIT_EXCEEDED");
        }

        console.warn(
          `Translator [${this.currentMethod}] 429 received. Switched proxy to ${proxyManager.getActiveProxyMasked()} (${attempt}/${maxAttempts - 1}).`
        );
      }
    }

    throw new Error("RATE_LIMIT_EXCEEDED");
  }

  async _translateText(text, targetLang, options = {}) {
    const provider = METHODS[this.currentMethod] || METHODS[DEFAULT_METHOD];
    const providerOptions = this._buildProviderOptions(targetLang, options);
    return provider(toSafeString(text), providerOptions);
  }

  async _translateSingleEntry(entryKey, entryText, targetLang, options = {}) {
    const sourceText = toSafeString(entryText);

    if (!hasText(sourceText)) {
      return sourceText;
    }

    try {
      const response = await this._executeWithRateLimitRecovery(
        () => this._translateText(sourceText, targetLang, options),
        options
      );
      return toSafeString(response?.text ?? sourceText);
    } catch (error) {
      if (isRateLimitExceededError(error)) {
        throw new Error("RATE_LIMIT_EXCEEDED");
      }

      console.warn(`Translator [${this.currentMethod}] fallback for key ${entryKey}:`, error?.message || error);
      return sourceText;
    }
  }

  _resolveChunkSizeLimit(customChunkSizeLimit) {
    if (Number.isFinite(customChunkSizeLimit) && customChunkSizeLimit > 100) {
      return Math.floor(customChunkSizeLimit);
    }

    return this.defaultChunkSizeLimit;
  }

  async _translateDictionaryWithRetry(dataToTranslate, targetLang = this.defaultTargetLang, options = {}) {
    const translated = {};
    const entries = Object.entries(dataToTranslate || {});
    const onItemProgress = typeof options.onItemProgress === 'function' ? options.onItemProgress : null;
    const totalCount = entries.length;
    let completedCount = 0;

    if (entries.length === 0) {
      return translated;
    }

    if (this.currentMethod === "single") {
      for (const [entryKey, entryText] of entries) {
        translated[entryKey] = await this._translateSingleEntry(entryKey, entryText, targetLang, options);
        completedCount++;
        onItemProgress?.({ completed: completedCount, total: totalCount });
      }
      return translated;
    }

    const chunkSizeLimit = this._resolveChunkSizeLimit(options.chunkSizeLimit);

    const chunks = [];
    let currentKeys = [];
    let currentText = "";

    for (const [entryKey, rawText] of entries) {
      const sourceText = toSafeString(rawText);

      if (!hasText(sourceText)) {
        translated[entryKey] = sourceText;
        completedCount++;
        onItemProgress?.({ completed: completedCount, total: totalCount });
        continue;
      }

      const nextChunkText = appendWithDelimiter(currentText, sourceText);
      if (nextChunkText.length > chunkSizeLimit && currentKeys.length > 0) {
        chunks.push({ keys: currentKeys, text: currentText });
        currentKeys = [entryKey];
        currentText = sourceText;
        continue;
      }

      currentKeys.push(entryKey);
      currentText = nextChunkText;
    }

    if (currentKeys.length > 0) {
      chunks.push({ keys: currentKeys, text: currentText });
    }

    for (const chunk of chunks) {
      try {
        const response = await this._executeWithRateLimitRecovery(
          () => this._translateText(chunk.text, targetLang, options),
          options
        );
        const split = splitTranslatedBatch(response?.text);

        if (split.length !== chunk.keys.length) {
          console.warn(
            `Translator [${this.currentMethod}] segment mismatch: expected ${chunk.keys.length}, got ${split.length}. Falling back to single-entry translation.`
          );

          for (const entryKey of chunk.keys) {
            translated[entryKey] = await this._translateSingleEntry(
              entryKey,
              dataToTranslate[entryKey],
              targetLang,
              options
            );
            completedCount++;
            onItemProgress?.({ completed: completedCount, total: totalCount });
          }

          continue;
        }

        chunk.keys.forEach((entryKey, index) => {
          translated[entryKey] = split[index] ?? toSafeString(dataToTranslate[entryKey]);
          completedCount++;
          onItemProgress?.({ completed: completedCount, total: totalCount });
        });
      } catch (error) {
        if (isRateLimitExceededError(error)) {
          throw new Error("RATE_LIMIT_EXCEEDED");
        }

        console.warn(
          `Translator [${this.currentMethod}] chunk failed (${error?.message}), falling back to single-entry translation.`
        );

        for (const entryKey of chunk.keys) {
          translated[entryKey] = await this._translateSingleEntry(
            entryKey,
            dataToTranslate[entryKey],
            targetLang,
            options
          );
          completedCount++;
          onItemProgress?.({ completed: completedCount, total: totalCount });
        }
      }
    }

    return translated;
  }

  async translateBatchWithRetry(dataToTranslate, targetLang = this.defaultTargetLang, options = {}) {
    const entries = Object.entries(dataToTranslate || {});
    if (entries.length === 0) return {};

    const preserveMarkup = options.preserveMarkup !== false;
    const resolvedTargetLang = normalizeLanguage(targetLang, this.defaultTargetLang);
    const resolvedSourceLang = normalizeLanguage(options.sourceLang, this.defaultSourceLang);
    const runtimeOptions = { ...options, sourceLang: resolvedSourceLang };

    if (!preserveMarkup) {
      return this._translateDictionaryWithRetry(dataToTranslate, resolvedTargetLang, runtimeOptions);
    }

    return translateWithMarkupPreservation(
      dataToTranslate,
      (segmentDict) => this._translateDictionaryWithRetry(segmentDict, resolvedTargetLang, runtimeOptions)
    );
  }
}

module.exports = {
  GoogleTranslateManager,
};
