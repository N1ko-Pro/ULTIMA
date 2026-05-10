import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Bot, Loader2, Server } from 'lucide-react';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';
import { OLLAMA_MODEL_DROPDOWN_OPTIONS } from '@Config/autoTranslation.config';
import { isOllamaModelInstalled } from '@Shared/helpers/ollamaModel';
import * as ollamaApi from '@API/ollama';
import { AiModelCard } from './AiModelCard';
import { AiRefreshButton } from './AiRefreshButton';
import { AiUninstallRow } from './AiUninstallRow';
import OllamaPage from './OllamaPage';

// ─── AiPage ─────────────────────────────────────────────────────────────────
// AI tab body. Three high-level states based on the Ollama runtime:
//   1. Not installed → delegate to `OllamaPage` (the install pitch).
//   2. Installed but not running → "start server" CTA + manual instructions.
//   3. Running → model management (install / select / delete + refresh).
//
// Owns the pull-progress plumbing (progress, speed, cancel) and the
// uninstall flow (delete every installed model first, then uninstall).

const INITIAL_SPEED = { completed: 0, ts: 0 };
const DELETE_EXIT_ANIM_MS = 300;

export default function AiPage({ ollamaModel, onOllamaModelChange, onModelAutoSelected }) {
  const t = useLocale();
  const [status,            setStatus]            = useState(null);
  const [isLoading,         setIsLoading]         = useState(true);
  const [isStarting,        setIsStarting]        = useState(false);
  const [isUninstalling,    setIsUninstalling]    = useState(false);
  const [pullingModel,      setPullingModel]      = useState(null);
  const [isCancellingPull,  setIsCancellingPull]  = useState(false);
  const [pullProgress,      setPullProgress]      = useState(0);
  const [pullStatus,        setPullStatus]        = useState('');
  const [pullSpeedMbs,      setPullSpeedMbs]      = useState(0);
  const [deletingModelId,   setDeletingModelId]   = useState(null);

  const pullCleanupRef = useRef(null);
  const pullingModelRef = useRef(null);
  const pullSpeedRef = useRef(INITIAL_SPEED);

  // ── Status fetch ────────────────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ollamaApi.getStatus();
      if (res?.success) {
        setStatus(res.status);
        if (res.status.pullingModel && !pullingModelRef.current) {
          setPullingModel(res.status.pullingModel);
          pullingModelRef.current = res.status.pullingModel;
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // ── Pull progress stream ────────────────────────────────────────────────
  useEffect(() => {
    pullCleanupRef.current = ollamaApi.onPullProgress((data) => {
      // Recover from window reopen: if we get progress events for a model we
      // don't know about, adopt it as the current pull target.
      if (data.model && !pullingModelRef.current) {
        setPullingModel(data.model);
        pullingModelRef.current = data.model;
      }

      if (data.total > 0) {
        setPullProgress(Math.round((data.completed / data.total) * 100));
        updateSpeed(pullSpeedRef, data.completed, setPullSpeedMbs);
      }
      if (data.status) setPullStatus(data.status);

      // Backend signals completion via `status` containing 'success'.
      if (data.status === 'success' || data.status?.includes('success')) {
        const completedModelId = pullingModelRef.current;
        pullingModelRef.current = null;
        setPullingModel(null);
        setPullProgress(0);
        setPullStatus('');
        setPullSpeedMbs(0);
        pullSpeedRef.current = INITIAL_SPEED;
        setIsCancellingPull(false);

        if (completedModelId) (onModelAutoSelected ?? onOllamaModelChange)?.(completedModelId);
        refreshStatus();
      }
    });

    return () => { pullCleanupRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleStartServer = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await ollamaApi.startServer();
      if (res?.success && res?.status) setStatus(res.status);
    } catch { /* silent */ } finally {
      setIsStarting(false);
    }
  }, []);

  const handlePull = useCallback(async (modelId) => {
    pullingModelRef.current = modelId;
    setPullingModel(modelId);
    setPullProgress(0);
    setPullStatus('');
    setIsCancellingPull(false);
    try {
      const res = await ollamaApi.pullModel(modelId);
      if (res?.success && !res?.cancelled && res?.status) setStatus(res.status);
    } catch { /* cancellation handled separately */ }
    finally {
      if (pullingModelRef.current === modelId) {
        pullingModelRef.current = null;
        setPullingModel(null);
        setPullProgress(0);
        setPullStatus('');
        setPullSpeedMbs(0);
        pullSpeedRef.current = INITIAL_SPEED;
        setIsCancellingPull(false);
      }
    }
  }, []);

  const handleCancelPull = useCallback(async () => {
    const modelId = pullingModelRef.current;
    if (!modelId) return;
    setIsCancellingPull(true);
    try {
      const res = await ollamaApi.cancelPullModel(modelId);
      if (res?.success && res?.status) setStatus(res.status);
    } catch { /* silent */ }
    finally {
      pullingModelRef.current = null;
      setPullingModel(null);
      setPullProgress(0);
      setPullStatus('');
      setPullSpeedMbs(0);
      pullSpeedRef.current = INITIAL_SPEED;
      setIsCancellingPull(false);
    }
  }, []);

  const handleDelete = useCallback(async (modelId) => {
    setDeletingModelId(modelId);
    try {
      // Small delay lets the card animate out before the list refreshes.
      await new Promise((r) => setTimeout(r, 200));
      const res = await ollamaApi.deleteModel(modelId);
      if (res?.success && res?.status) {
        setStatus(res.status);
        if (ollamaModel === modelId) onOllamaModelChange('');
      }
    } catch { /* silent */ }
    finally {
      setTimeout(() => setDeletingModelId(null), DELETE_EXIT_ANIM_MS);
    }
  }, [ollamaModel, onOllamaModelChange]);

  const handleUninstall = useCallback(async () => {
    setIsUninstalling(true);
    try {
      const installed = status?.models || [];
      for (const m of installed) {
        try { await ollamaApi.deleteModel(m.name); }
        catch { /* per-model failures are non-fatal */ }
      }
      const res = await ollamaApi.uninstall();
      if (res?.success && res?.status) setStatus(res.status);
      else await refreshStatus();
    } catch {
      await refreshStatus();
    } finally {
      setIsUninstalling(false);
    }
  }, [refreshStatus, status]);

  const isModelInstalled = (modelId) =>
    isOllamaModelInstalled(modelId, (status?.models || []).map((m) => m.name));

  // ── Render branches ─────────────────────────────────────────────────────
  if (isLoading && !status) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 rounded-2xl bg-white/[0.03]" />
        <div className="h-16 rounded-2xl bg-white/[0.03]" />
      </div>
    );
  }

  if (!status?.installed) {
    return <OllamaPage onInstallComplete={(newStatus) => setStatus(newStatus)} />;
  }

  if (!status?.running) {
    return (
      <div className="space-y-3 animate-[fadeIn_220ms_ease-out]">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-violet-300 shrink-0" />
            <span className="text-sm font-semibold text-white">Ollama</span>
          </div>
          <AiRefreshButton onRefresh={refreshStatus} />
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] backdrop-blur-xl p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-200 mb-0.5">{t.ollama.serverStopped}</p>
              <p className="text-[11px] text-amber-200/60 leading-relaxed">
                {t.ollama.serverStoppedDesc}
              </p>
            </div>
          </div>
          <div className="flex items-center rounded-lg bg-black/20 border border-white/[0.07] px-3 py-2">
            <code className="text-[11px] font-mono text-emerald-300 select-all">ollama serve</code>
          </div>
        </div>

        <ButtonCore variant="emerald" icon={Server} fullWidth disabled={isStarting} loading={isStarting} onClick={handleStartServer}>
          {isStarting ? t.ollama.starting : t.ollama.startServer}
        </ButtonCore>

        <AiUninstallRow isUninstalling={isUninstalling} onUninstall={handleUninstall} />
      </div>
    );
  }

  // Running — full model management UI.
  return (
    <div className="space-y-4 animate-[fadeIn_220ms_ease-out]">
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] backdrop-blur-xl px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
            <div className="absolute w-3 h-3 rounded-full bg-emerald-400/20 animate-ping" />
            <div className="relative w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-emerald-300">{t.ollama.running}</span>
            <span className="text-[10px] text-zinc-600 font-mono ml-2 truncate">{status?.baseUrl || 'localhost:11434'}</span>
          </div>
        </div>
        <AiRefreshButton onRefresh={refreshStatus} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <Bot className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <span className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">{t.ollama.models}</span>
        </div>

        <div className="space-y-2">
          {OLLAMA_MODEL_DROPDOWN_OPTIONS.map((model) => (
            <AiModelCard
              key={model.id}
              model={model}
              isSelected={ollamaModel === model.id && isModelInstalled(model.id)}
              isInstalled={isModelInstalled(model.id)}
              isPulling={pullingModel === model.id}
              isCancellingPull={pullingModel === model.id && isCancellingPull}
              isDeleting={deletingModelId === model.id}
              pullProgress={pullingModel === model.id ? pullProgress : 0}
              pullStatus={pullingModel === model.id ? pullStatus : ''}
              pullSpeedMbs={pullingModel === model.id ? pullSpeedMbs : 0}
              onSelect={onOllamaModelChange}
              onPull={handlePull}
              onCancelPull={handleCancelPull}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      <AiUninstallRow isUninstalling={isUninstalling} onUninstall={handleUninstall} />
    </div>
  );
}

/** Compute a rolling transfer-rate from consecutive completed counts. */
function updateSpeed(ref, completedNow, setMbs) {
  const now = Date.now();
  const prev = ref.current;
  const dtSec = (now - prev.ts) / 1000;

  if (prev.ts === 0 || dtSec <= 0) {
    ref.current = { completed: completedNow, ts: now };
    return;
  }

  if (completedNow > prev.completed) {
    if (dtSec >= 0.05) {
      setMbs((completedNow - prev.completed) / dtSec / (1024 * 1024));
      ref.current = { completed: completedNow, ts: now };
    }
    return;
  }

  // `completed` went backwards → a new blob started. Re-seed the counter.
  ref.current = { completed: completedNow, ts: now };
}
