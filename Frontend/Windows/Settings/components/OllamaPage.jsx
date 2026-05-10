import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cpu, Download, Server, Shield, Zap } from 'lucide-react';
import ButtonCore from '@Core/Buttons/ButtonCore';
import { useLocale } from '@Locales/LocaleProvider';
import { OllamaFeatureBullet } from './OllamaFeatureBullet';
import { OllamaInstallProgress } from './OllamaInstallProgress';
import { OllamaCancelConfirmDialog } from './OllamaCancelConfirmDialog';
import * as ollamaApi from '@API/ollama';

// ─── OllamaPage ─────────────────────────────────────────────────────────────
// Install-Ollama pitch shown when the user opens the AI tab but the Ollama
// runtime is not yet present on their machine. Owns the install IPC flow,
// live progress panel and cancel confirmation.

const COMPLETE_HOLD_MS = 1500;

/**
 * @param {{ onInstallComplete: (status: any) => void }} props
 */
export default function OllamaPage({ onInstallComplete }) {
  const t = useLocale();
  const [isInstalling,      setIsInstalling]      = useState(false);
  const [isCancelling,      setIsCancelling]      = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [installProgress,   setInstallProgress]   = useState(null);
  const cleanupRef = useRef(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    cleanupRef.current = ollamaApi.onInstallProgress((data) => setInstallProgress(data));
    return () => { cleanupRef.current?.(); };
  }, []);

  const handleInstall = useCallback(async () => {
    if (isInstalling) return;
    setIsInstalling(true);
    setShowCancelConfirm(false);
    setInstallProgress({ phase: 'downloading', percent: 0, message: t.ollama.initializing });
    try {
      const res = await ollamaApi.install();
      if (res?.cancelled) {
        setInstallProgress(null);
        return;
      }
      if (res?.success && res?.status) {
        if (cancellingRef.current) {
          setInstallProgress(null);
          return;
        }
        setInstallProgress({ phase: 'complete', percent: 100, message: '' });
        await new Promise((r) => setTimeout(r, COMPLETE_HOLD_MS));
        onInstallComplete?.(res.status);
        return;
      }
      setInstallProgress({ phase: 'error', message: res?.error || t.ollama.installFailed });
    } catch (err) {
      if (cancellingRef.current || err?.message?.includes('CANCELLED')) {
        setInstallProgress(null);
      } else {
        setInstallProgress({ phase: 'error', message: err?.message || t.common.unknownError });
      }
    } finally {
      setIsInstalling(false);
      cancellingRef.current = false;
      setIsCancelling(false);
    }
  }, [isInstalling, onInstallComplete, t.ollama.initializing, t.ollama.installFailed, t.common.unknownError]);

  const handleCancelRequest = useCallback(() => setShowCancelConfirm(true), []);

  const handleCancelConfirm = useCallback(async () => {
    setShowCancelConfirm(false);
    cancellingRef.current = true;
    setIsCancelling(true);
    try {
      await ollamaApi.cancelInstall();
    } catch { /* silent */ }
  }, []);

  const handleCancelAbort = useCallback(() => setShowCancelConfirm(false), []);

  const showInstallBtn = (!installProgress || installProgress.phase === 'error') && !isInstalling && !showCancelConfirm;

  return (
    <div className="flex flex-col items-center py-1 animate-[fadeIn_220ms_ease-out]">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-violet-500/15 blur-2xl scale-[2.5]" />
        <div className="relative w-14 h-14 rounded-2xl bg-surface-3 border border-violet-500/25 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Server className="w-7 h-7 text-violet-300" />
        </div>
      </div>

      <h3 className="text-sm font-bold text-white mb-1">{t.ollama.notInstalled}</h3>
      <p className="text-[11px] text-zinc-500 text-center mb-4 max-w-[240px] leading-relaxed">
        {t.ollama.description}
      </p>

      <div className="w-full rounded-xl border border-white/[0.07] bg-surface-2/60 backdrop-blur-xl p-3.5 mb-4 space-y-2.5">
        <OllamaFeatureBullet icon={Zap}    color="text-amber-400"   bg="bg-amber-500/[0.08]"   border="border border-amber-500/[0.18]"   title={t.ollama.featureOffline}  subtitle={t.ollama.featureOfflineDesc} />
        <OllamaFeatureBullet icon={Shield} color="text-emerald-400" bg="bg-emerald-500/[0.08]" border="border border-emerald-500/[0.18]" title={t.ollama.featureNoLimits} subtitle={t.ollama.featureNoLimitsDesc} />
        <OllamaFeatureBullet icon={Cpu}    color="text-sky-400"     bg="bg-sky-500/[0.08]"     border="border border-sky-500/[0.18]"     title={t.ollama.featureGPU}      subtitle={t.ollama.featureGPUDesc} />
      </div>

      {showCancelConfirm && (
        <div className="w-full mb-4">
          <OllamaCancelConfirmDialog
            onConfirm={handleCancelConfirm}
            onAbort={handleCancelAbort}
            isInstallingPhase={installProgress?.phase === 'installing'}
          />
        </div>
      )}

      {installProgress && (
        <div className={`w-full mb-4 ${showCancelConfirm ? 'hidden' : ''}`}>
          <OllamaInstallProgress
            progress={installProgress}
            onCancel={handleCancelRequest}
            isCancelling={isCancelling}
          />
        </div>
      )}

      {showInstallBtn && (
        <ButtonCore variant="violet" icon={Download} fullWidth onClick={handleInstall}>
          {t.ollama.installButton}
        </ButtonCore>
      )}

      <p className="text-[10px] text-zinc-600 mt-2 text-center">{t.ollama.systemInfo}</p>
    </div>
  );
}
