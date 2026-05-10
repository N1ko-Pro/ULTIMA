import { useState, useCallback, useRef, useEffect } from 'react';
import { notify } from '@Shared/notifications/notifyCore';
import { useLocale } from '@Locales/LocaleProvider';
import { log } from '@Shared/helpers/logger';
import { formatEta } from '@Shared/helpers/time';
import { AUTO_TRANSLATION_MODE } from '@Config/autoTranslationModes.constants';
import { TRANSLATION } from '@Config/timings.constants';
import {
  collectPendingTranslationRows,
  toIdValueDictionary,
} from '@Shared/helpers/projectShape';
import * as translationsApi from '@API/translations';
import * as settingsApi from '@API/settings';
import * as ollamaApi from '@API/ollama';

// ─── Translation service ────────────────────────────────────────────────────
// Drives the auto-translation pipeline:
//   1. Collects rows that still need a translation.
//   2. Splits them into chunks (`TRANSLATION.CHUNK_SIZE`).
//   3. Sends each chunk through the backend, listens for per-item progress.
//   4. Merges the result into the project translations.
//   5. Cancellable at any point — emits a "stopping" stage immediately.
//
// Two modes are supported via `AUTO_TRANSLATION_MODE`:
//   • smart  — cloud Google Translate pipeline
//   • local  — Ollama-backed AI (runs the local server on demand)

/**
 * @param {{
 *   originalStrings: any[] | null,
 *   translations: Record<string, string>,
 *   setTranslations: (next: any) => void,
 * }} deps
 */
export default function useAutoTranslation({ originalStrings, translations, setTranslations }) {
  const t = useLocale();
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; });

  const [isTranslating,       setIsTranslating]       = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translationStage,    setTranslationStage]    = useState('');

  const completionTimerRef    = useRef(null);
  const cancelledRef          = useRef(false);
  const translationModeRef    = useRef('');
  const totalItemsRef         = useRef(0);
  const baseCompletedRef      = useRef(0);
  const startTimeRef          = useRef(0);
  const itemProgressCleanupRef = useRef(null);

  useEffect(() => () => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    itemProgressCleanupRef.current?.();
  }, []);

  /** Apply smooth percentage progress and update the visible "stage" text. */
  const updateProgressSmooth = useCallback((overallCompleted) => {
    const total = totalItemsRef.current;
    if (total <= 0) return;

    const progress = Math.min(100, Math.round((overallCompleted / total) * 100));
    setTranslationProgress(progress);

    const elapsed   = (Date.now() - startTimeRef.current) / 1000;
    const rate      = overallCompleted > 0 ? elapsed / overallCompleted : 0;
    const remaining = (total - overallCompleted) * rate;

    const isLocal = translationModeRef.current === AUTO_TRANSLATION_MODE.LOCAL;
    const modeLabel = isLocal ? tRef.current.editor.modeLocalLabel : tRef.current.editor.modeSmartLabel;
    const etaText = overallCompleted > TRANSLATION.ETA_MIN_COMPLETED
      ? formatEta(remaining, tRef.current)
      : '';
    const etaSuffix = etaText ? `  •  ${etaText}` : '';

    setTranslationStage(
      tRef.current.editor.stageProgress(modeLabel, Math.min(overallCompleted, total), total) + etaSuffix,
    );
  }, []);

  /** Free Ollama VRAM by forcing a context reset on the active model. */
  const resetOllamaContext = useCallback(async () => {
    try {
      const settingsRes = await settingsApi.get();
      const model = settingsRes?.settings?.ollama?.model;
      if (model) await ollamaApi.resetContext(model);
    } catch (err) {
      log.warn('Failed to reset Ollama context:', err);
    }
  }, []);

  const cancelAutoTranslation = useCallback(async () => {
    cancelledRef.current = true;
    setTranslationStage(tRef.current.editor.stageStopping);
    try {
      await translationsApi.abort();
      if (translationModeRef.current === AUTO_TRANSLATION_MODE.LOCAL) {
        await resetOllamaContext();
      }
    } catch (err) {
      log.error('Failed to abort translation:', err);
    }
  }, [resetOllamaContext]);

  const triggerAutoTranslation = useCallback(
    async (modeId = AUTO_TRANSLATION_MODE.SMART, options = {}) => {
      if (!originalStrings || originalStrings.length === 0) return;

      const isLocalMode = modeId === AUTO_TRANSLATION_MODE.LOCAL;

      // Local mode requires Ollama to be running; auto-start if needed.
      if (isLocalMode) {
        try {
          const ensureRes = await ollamaApi.ensureRunning();
          if (!ensureRes?.success || !ensureRes?.status?.running) {
            notify.error(t.editor.ollamaNotRunning, t.editor.ollamaNotRunningDesc);
            return;
          }
        } catch {
          notify.error(t.editor.ollamaError, t.editor.ollamaErrorDesc);
          return;
        }
      }

      translationModeRef.current = modeId;
      const modeLabel = isLocalMode ? t.editor.modeLocalLabel : t.editor.modeSmartLabel;

      cancelledRef.current = false;
      setIsTranslating(true);
      setTranslationProgress(0);
      setTranslationStage(t.editor.stagePreparing(modeLabel));

      let translationFailed = false;

      try {
        const dataToTranslateArray = collectPendingTranslationRows(originalStrings, translations);
        const totalItems = dataToTranslateArray.length;

        if (totalItems === 0) {
          translationModeRef.current = '';
          setIsTranslating(false);
          notify.info(t.editor.nothingToTranslate, t.editor.nothingToTranslateDesc);
          return;
        }

        totalItemsRef.current = totalItems;
        baseCompletedRef.current = 0;
        startTimeRef.current = Date.now();
        setTranslationStage(t.editor.stageLaunching(modeLabel));

        // Per-item progress events.
        itemProgressCleanupRef.current?.();
        itemProgressCleanupRef.current = translationsApi.onItemProgress(({ completed }) => {
          if (cancelledRef.current) return;
          updateProgressSmooth(baseCompletedRef.current + completed);
        });

        const chunkSize = TRANSLATION.CHUNK_SIZE;
        let completed = 0;

        for (let i = 0; i < totalItems; i += chunkSize) {
          if (cancelledRef.current) break;

          const chunk = dataToTranslateArray.slice(i, i + chunkSize);
          const chunkDict = toIdValueDictionary(chunk, 'text');
          baseCompletedRef.current = completed;

          const result = await translationsApi.translate(chunkDict, 'ru', {
            mode: isLocalMode ? 'local' : 'smart',
            ...options,
          });

          if (cancelledRef.current || result?.error === 'ABORTED') break;

          if (result?.success && result.data) {
            setTranslations((prev) => ({ ...prev, ...result.data }));
            completed += chunk.length;
            baseCompletedRef.current = completed;
            updateProgressSmooth(completed);
            continue;
          }

          translationFailed = true;
          notify.error(t.editor.translateError, result?.error || t.editor.translateErrorDesc);
          break;
        }
      } catch (err) {
        translationFailed = true;
        if (err.message !== 'ABORTED') {
          notify.error(t.editor.translateError, err.message);
        }
      } finally {
        itemProgressCleanupRef.current?.();
        itemProgressCleanupRef.current = null;

        const wasCancelled = cancelledRef.current;
        const wasSuccessful = !wasCancelled && !translationFailed;
        translationModeRef.current = '';

        if (isLocalMode) {
          await resetOllamaContext();
        }

        if (wasCancelled) {
          setTranslationStage(tRef.current.editor.stageStopped);
          setTimeout(() => {
            setIsTranslating(false);
            setTranslationProgress(0);
            setTranslationStage('');
          }, TRANSLATION.CANCEL_HOLD_MS);
        } else {
          setTranslationStage(
            wasSuccessful ? tRef.current.editor.stageCompleted : tRef.current.editor.translateError,
          );
          completionTimerRef.current = setTimeout(() => {
            setIsTranslating(false);
            setTranslationProgress(0);
            setTranslationStage('');
          }, TRANSLATION.COMPLETION_HOLD_MS);
        }
      }
    },
    [originalStrings, translations, setTranslations, updateProgressSmooth, resetOllamaContext, t.editor],
  );

  return {
    isTranslating,
    triggerAutoTranslation,
    cancelAutoTranslation,
    translationProgress,
    translationStage,
  };
}
