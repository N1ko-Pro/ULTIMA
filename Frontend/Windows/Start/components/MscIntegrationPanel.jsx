import React, { useState, useRef, useEffect } from 'react';
import {
  Blocks, FolderSearch, FolderOpen, Search, Puzzle, Wrench, Eraser,
  CheckCircle2, Loader2, MapPin, ChevronRight,
} from 'lucide-react';
import { notify } from '@Shared/notifications/notifyCore';
import { useLocale } from '@Locales/LocaleProvider';
import { Section, PatcherCard, ToolRow } from './MscIntegrationCards';

// ─── MscIntegrationPanel ──────────────────────────────────────────────────────
// Top-right workspace control for My Summer Car (sits under the settings
// button). A squircle trigger that MORPHS into the panel: pressing it dissolves
// the icon button into the panel header (width/height grow, right-anchored) and
// the body slides down underneath; the collapse chevron reverses it back into
// the button — mirroring the mini-profile's open/close choreography.
//
// Folds three things into one card:
//
//   1. Папка игры       — auto-detected (Steam) / user-picked install path,
//                         with the ability to change or clear it.
//   2. Патчер перевода  — the runtime patcher installed ONCE into the game
//                         (install / update / remove + version status).
//   3. Инструменты      — the remaining build tool (MscLocTool). The patcher is
//                         intentionally excluded here: it lives in the game,
//                         managed by section 2, not as a per-build dependency.
//
// The collapsed glyph + dot reflect overall readiness: red when a REQUIRED build
// tool is missing, amber when patch-mode setup is incomplete (no game path /
// patcher absent or outdated), green when everything is ready.
//
// The presentational cards (Section / PatcherCard / ToolRow) live in
// `./MscIntegrationCards`; this file owns the state, actions and aggregation.

const PATCHER_TOOL_ID = 'msc-patcher';

// Morph geometry + shared easing for the open/close choreography.
const COLLAPSED_SIZE = '48px';
const PANEL_WIDTH    = '340px';
const HEADER_HEIGHT  = '58px';
const EASE           = 'cubic-bezier(0.4,0,0.2,1)';

// Collapsed-trigger visuals for the aggregate readiness state.
const AGG = {
  installed: { text: 'text-zinc-300', dot: 'bg-emerald-400', glow: '', ring: '', tint: '' },
  update: {
    text: 'text-amber-400', dot: 'bg-amber-400',
    glow: 'shadow-[0_0_30px_-8px_rgba(251,191,36,0.55)]',
    ring: 'border-amber-400/40', tint: 'from-amber-400/[0.12]',
  },
  missing: {
    text: 'text-red-400', dot: 'bg-red-400',
    glow: 'shadow-[0_0_30px_-8px_rgba(248,113,113,0.6)]',
    ring: 'border-red-400/45', tint: 'from-red-400/[0.12]',
  },
};

function aggregate(tools) {
  if (tools.some((tdef) => tdef.status === 'missing')) return 'missing';
  if (tools.some((tdef) => tdef.status === 'update'))  return 'update';
  return 'installed';
}

export default function MscIntegrationPanel({
  tools = [],
  onInstallTool,
  integration,
  gameId,
  onDetectPath,
  onPickPath,
  onClearPath,
  onInstallPatcher,
  onUninstallPatcher,
}) {
  const t = useLocale();
  const [isOpen, setIsOpen]     = useState(false);
  const [busy, setBusy]         = useState(null);   // toolId | 'patcher' | 'uninstall' | 'detect' | 'pick' | 'clear' | null
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState(null);   // { scope, msg }
  const rootRef = useRef(null);

  const isBusy = busy !== null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target) && !isBusy) {
        // Don't close when the click lands in another floating layer
        // (notifications, profile, etc.).
        if (e.target?.closest?.('[data-floating-layer]')) return;
        setIsOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape' && !isBusy) setIsOpen(false); };
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, isBusy]);

  const buildTools = tools.filter((tool) => tool.id !== PATCHER_TOOL_ID);
  const patcherItem = tools.find((tool) => tool.id === PATCHER_TOOL_ID) || null;
  const status = integration?.status || null;
  const gameFound = !!status?.valid;
  const patcherInstalled = !!status?.patcherInstalled;
  const patcherUpToDate = !!status?.patcherUpToDate;
  const patcherName = status?.patcherName || patcherItem?.name || 'MSCLoc API';

  const toolAgg = aggregate(buildTools.length ? buildTools : tools);
  const setupIncomplete = !gameFound || !patcherInstalled || (patcherInstalled && !patcherUpToDate);
  const agg = toolAgg === 'missing' ? 'missing'
    : (toolAgg === 'update' || setupIncomplete) ? 'update'
    : 'installed';
  const aggCfg = AGG[agg];
  const actionable = agg !== 'installed';
  const anyMissing = agg === 'missing';

  const headerSub = toolAgg === 'missing' ? t.deps.toolsAttention
    : agg === 'installed' ? t.integration.allReady
    : (toolAgg === 'update' && !setupIncomplete) ? t.deps.toolsUpdate
    : t.integration.setupHint;

  // ── Actions ────────────────────────────────────────────────────────────────
  const runToolInstall = async (toolId) => {
    setBusy(toolId); setProgress(0); setError(null);
    try {
      await onInstallTool?.((p) => setProgress(p), toolId);
      setBusy(null);
    } catch (err) {
      setError({ scope: toolId, msg: err?.message || t.deps.errorDesc });
      setBusy(null);
    }
  };

  const runDetect = async () => {
    setBusy('detect'); setError(null);
    try {
      const res = await onDetectPath?.(gameId);
      if (res?.success && res.status?.valid) notify.success(t.integration.gameFound, res.status.gamePath);
      else setError({ scope: 'game', msg: t.integration.detectFailed });
    } catch (err) {
      setError({ scope: 'game', msg: err?.message || t.integration.detectFailed });
    } finally { setBusy(null); }
  };

  const runPick = async () => {
    setBusy('pick'); setError(null);
    try {
      const res = await onPickPath?.(gameId);
      if (res?.success && res.status?.valid) notify.success(t.integration.gameFound, res.status.gamePath);
      else if (res && !res.canceled) setError({ scope: 'game', msg: res.error === 'NOT_A_GAME_FOLDER' ? t.integration.notAGameFolder : (res.error || t.integration.detectFailed) });
    } catch (err) {
      setError({ scope: 'game', msg: err?.message || t.integration.detectFailed });
    } finally { setBusy(null); }
  };

  const runClear = async () => {
    setBusy('clear'); setError(null);
    try {
      await onClearPath?.(gameId);
    } catch (err) {
      setError({ scope: 'game', msg: err?.message || t.deps.errorDesc });
    } finally { setBusy(null); }
  };

  const runInstallPatcher = async () => {
    setBusy('patcher'); setProgress(0); setError(null);
    try {
      const res = await onInstallPatcher?.(gameId, (p) => setProgress(p));
      if (res?.success) notify.success(t.integration.patcherInstalledTitle, t.integration.patcherInstalledMsg);
      else setError({ scope: 'patcher', msg:
        res?.error === 'GAME_PATH_MISSING' ? t.integration.needGameFirst
        : res?.error === 'PATCHER_LOCKED' ? t.integration.patcherLocked
        : (res?.error || t.deps.errorDesc) });
    } catch (err) {
      setError({ scope: 'patcher', msg: err?.message || t.deps.errorDesc });
    } finally { setBusy(null); }
  };

  const runUninstallPatcher = async () => {
    setBusy('uninstall'); setError(null);
    try {
      const res = await onUninstallPatcher?.(gameId);
      if (res?.success) notify.success(t.integration.patcherRemovedTitle, t.integration.patcherRemovedMsg);
      else setError({ scope: 'patcher', msg: res?.error || t.deps.errorDesc });
    } catch (err) {
      setError({ scope: 'patcher', msg: err?.message || t.deps.errorDesc });
    } finally { setBusy(null); }
  };

  return (
    <div ref={rootRef} className="relative flex flex-col items-end" data-floating-layer>
      {/* Morph surface: the collapsed icon button and the expanded panel header
          are the SAME bordered box — it grows right-anchored from 48px square to
          the full-width header, dissolving one layer into the other. */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/[0.1] bg-surface-2/85 ${!isOpen ? aggCfg.glow : ''}`}
        style={{
          width:  isOpen ? PANEL_WIDTH : COLLAPSED_SIZE,
          height: isOpen ? HEADER_HEIGHT : COLLAPSED_SIZE,
          transition: isOpen
            ? `width 460ms ${EASE}, height 460ms ${EASE}`
            : `width 460ms ${EASE} 200ms, height 460ms ${EASE} 200ms`,
        }}
      >
        {/* Collapsed layer — the status glyph + dot. Fades out as we expand. */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={t.integration.title}
          className="group absolute inset-0 flex items-center justify-center active:scale-[0.95] transition-transform duration-150"
          style={{
            opacity:         isOpen ? 0 : 1,
            pointerEvents:   isOpen ? 'none' : 'auto',
            transition:      `opacity 200ms ${EASE}`,
            transitionDelay: isOpen ? '0ms' : '230ms',
          }}
        >
          {actionable && <span className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${aggCfg.tint} to-transparent`} />}
          {actionable && <span className={`pointer-events-none absolute inset-0 rounded-2xl border ${aggCfg.ring} ${anyMissing ? 'animate-pulse' : ''}`} />}
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <Blocks className={`relative w-[22px] h-[22px] transition-colors duration-200 ${actionable ? aggCfg.text : 'text-zinc-300'}`} />
          <span className={`absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${aggCfg.dot} ${anyMissing ? 'animate-pulse' : ''}`} />
        </button>

        {/* Expanded layer — header row (title + status + collapse chevron).
            Fades in once the box has begun widening. */}
        <div
          className="absolute inset-0 pl-4 pr-2.5 flex items-center justify-between gap-2"
          style={{
            opacity:         isOpen ? 1 : 0,
            pointerEvents:   isOpen ? 'auto' : 'none',
            transition:      `opacity 220ms ${EASE}`,
            transitionDelay: isOpen ? '180ms' : '0ms',
          }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase truncate">{t.integration.title}</p>
            <p className={`text-[12px] font-medium mt-0.5 truncate ${actionable ? aggCfg.text : 'text-emerald-400'}`}>{headerSub}</p>
          </div>
          <button
            type="button"
            onClick={() => !isBusy && setIsOpen(false)}
            aria-label={t.common.back}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.92] shrink-0 disabled:opacity-40"
            disabled={isBusy}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body drawer — slides down/up under the header, scaling from the top
          edge. Right-anchored so it tucks back into the button on close. */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight:       isOpen ? '660px' : '0px',
          marginTop:       isOpen ? '8px' : '0px',
          transition:      `max-height 460ms ${EASE}, margin-top 460ms ${EASE}`,
          transitionDelay: isOpen ? '120ms' : '0ms',
        }}
      >
        <div
          className="w-[340px] rounded-xl border border-white/[0.08] bg-surface-2/85 shadow-[0_20px_56px_rgba(0,0,0,0.5)]"
          style={{
            transform:       isOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.97)',
            transformOrigin: 'top right',
            opacity:         isOpen ? 1 : 0,
            transition:      `transform 460ms ${EASE}, opacity 300ms ${EASE}`,
            transitionDelay: isOpen ? '150ms' : '0ms',
          }}
        >
          <div className="p-4 space-y-4">
            {/* ── Game folder ─────────────────────────────────────────────── */}
            <Section icon={MapPin} label={t.integration.gameSection}>
              {gameFound ? (
                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-emerald-300">{t.integration.gameFound}</p>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5" title={status.gamePath}>{status.gamePath}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    <button
                      type="button" disabled={isBusy} onClick={runPick}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-white/[0.1] text-zinc-300 text-[11.5px] font-medium hover:bg-white/[0.05] transition-all active:scale-[0.98] disabled:opacity-40"
                    >
                      {busy === 'pick' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {t.integration.change}
                    </button>
                    <button
                      type="button" disabled={isBusy} onClick={runClear} title={t.integration.clearPath}
                      className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-white/[0.1] text-zinc-400 hover:text-red-300 hover:border-red-500/30 hover:bg-red-500/[0.08] transition-all active:scale-[0.98] disabled:opacity-40"
                    >
                      {busy === 'clear' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eraser className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <Search className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-zinc-200">{t.integration.gameNotFound}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{t.integration.gameNotFoundSub}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button" disabled={isBusy} onClick={runDetect}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-sky-500/25 bg-sky-500/[0.08] text-sky-300 text-[12px] font-medium hover:bg-sky-500/[0.14] transition-all active:scale-[0.98] disabled:opacity-40"
                    >
                      {busy === 'detect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSearch className="w-3.5 h-3.5" />}
                      {busy === 'detect' ? t.integration.detecting : t.integration.detect}
                    </button>
                    <button
                      type="button" disabled={isBusy} onClick={runPick}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-white/[0.1] text-zinc-300 text-[12px] font-medium hover:bg-white/[0.05] transition-all active:scale-[0.98] disabled:opacity-40"
                    >
                      {busy === 'pick' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.integration.choose}
                    </button>
                  </div>
                </div>
              )}
              {error?.scope === 'game' && <p className="text-[11px] text-red-400 leading-relaxed px-0.5 mt-2">{error.msg}</p>}
            </Section>

            {/* ── Translation patcher ─────────────────────────────────────── */}
            <Section icon={Puzzle} label={t.integration.patcherSection}>
              <PatcherCard
                t={t}
                patcherName={patcherName}
                patcherItem={patcherItem}
                status={status}
                installed={patcherInstalled}
                upToDate={patcherUpToDate}
                gameFound={gameFound}
                busy={busy}
                progress={progress}
                isBusy={isBusy}
                onInstall={runInstallPatcher}
                onUninstall={runUninstallPatcher}
              />
              {error?.scope === 'patcher' && <p className="text-[11px] text-red-400 leading-relaxed px-0.5 mt-2">{error.msg}</p>}
            </Section>

            {/* ── Build tools ─────────────────────────────────────────────── */}
            {buildTools.length > 0 && (
              <Section icon={Wrench} label={t.integration.toolsSection}>
                <div className="space-y-2">
                  {buildTools.map((tool) => (
                    <ToolRow
                      key={tool.id}
                      tool={tool}
                      t={t}
                      busy={busy}
                      progress={progress}
                      isBusy={isBusy}
                      isError={error?.scope === tool.id}
                      onInstall={() => runToolInstall(tool.id)}
                    />
                  ))}
                </div>
                {buildTools.some((tool) => error?.scope === tool.id) && (
                  <p className="text-[11px] text-red-400 leading-relaxed px-0.5 mt-2">{error.msg}</p>
                )}
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
