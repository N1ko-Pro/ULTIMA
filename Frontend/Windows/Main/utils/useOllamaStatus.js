import { useState, useEffect, useCallback, useMemo } from 'react';
import { OLLAMA_MODEL_DROPDOWN_OPTIONS } from '@Config/autoTranslation.config';
import { isOllamaModelInstalled } from '@Shared/helpers/ollamaModel';
import * as ollamaApi from '@API/ollama';

// ─── useOllamaStatus ────────────────────────────────────────────────────────
// Queries `@API/ollama.getStatus` once per `enabled` flip and
// derives three things needed by the auto-translate panel's "local AI"
// branch:
//   • whether the Ollama server is running
//   • which of the supported models are actually installed locally
//   • the currently-configured model, or '' if it's no longer installed
//
// A `null` in `installedModelNames` / `localServerRunning` means "not yet
// queried" — callers use that to render a loading state.

const NULL_STATE = {
  installedModelNames: null,
  localServerRunning: null,
};

/**
 * @param {{ enabled: boolean, configuredModel: string }} options
 * @returns {{
 *   installedModelNames: string[] | null,
 *   localServerRunning:  boolean | null,
 *   installedOptions:    typeof OLLAMA_MODEL_DROPDOWN_OPTIONS,
 *   effectiveModel:      string,
 *   isReady:             boolean,
 * }}
 */
export function useOllamaStatus({ enabled, configuredModel }) {
  const [status, setStatus] = useState(NULL_STATE);
  const { installedModelNames, localServerRunning } = status;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    ollamaApi.getStatus()
      .then((res) => {
        if (cancelled) return;
        const running = Boolean(res?.success && res.status?.running);
        setStatus({
          localServerRunning:  running,
          installedModelNames: running ? (res.status?.models || []).map((m) => m.name) : [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStatus({ localServerRunning: false, installedModelNames: [] });
      });

    const unsubscribe = ollamaApi.onStatusChanged((newStatus) => {
      const running = Boolean(newStatus?.running);
      setStatus({
        localServerRunning:  running,
        installedModelNames: running ? (newStatus?.models || []).map((m) => m.name) : [],
      });
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [enabled]);

  /**
   * Pragmatic name match between a configured model id and an installed one.
   * Handles `:latest` suffix, explicit tags and `hf.co/...` hashes.
   */
  const isModelInstalled = useCallback(
    (modelId) => isOllamaModelInstalled(modelId, installedModelNames ?? []),
    [installedModelNames],
  );

  const installedOptions = useMemo(
    () => OLLAMA_MODEL_DROPDOWN_OPTIONS.filter((m) => isModelInstalled(m.id)),
    [isModelInstalled],
  );

  const effectiveModel = isModelInstalled(configuredModel) ? configuredModel : '';
  const isReady = localServerRunning === true && installedOptions.length > 0;

  return {
    installedModelNames,
    localServerRunning,
    installedOptions,
    effectiveModel,
    isReady,
  };
}
