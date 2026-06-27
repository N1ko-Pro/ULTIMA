import React, { useState, useRef, useEffect } from 'react';
import {
  Blocks, FolderSearch, FolderOpen, Search, Puzzle, Wrench, Eraser,
  CheckCircle2, AlertTriangle, Download, RefreshCw, Loader2, MapPin, Trash2,
} from 'lucide-react';
import { notify } from '@Shared/notifications/notifyCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── MscIntegrationPanel ──────────────────────────────────────────────────────
// Top-right workspace control for My Summer Car (sits under the settings
// button). A squircle trigger that drops a side panel down-left, folding three
// things into one card:
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

const PATCHER_TOOL_ID = 'msc-patcher';

const TOOL_STATUS = {
  installed: { icon: CheckCircle2, text: 'text-emerald-400', dot: 'bg-emerald-400',
    pill: 'text-emerald-300 bg-emerald-500/[0.10] border-emerald-500/20' },
  update: { icon: RefreshCw, text: 'text-amber-400', dot: 'bg-amber-400',
    pill: 'text-amber-300 bg-amber-500/[0.10] border-amber-500/20',
    btn: 'border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.14] hover:border-amber-400/40' },
  missing: { icon: AlertTriangle, text: 'text-red-400', dot: 'bg-red-400',
    pill: 'text-red-300 bg-red-500/[0.10] border-red-500/20',
    btn: 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.14] hover:border-emerald-400/40' },
};

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
      if (rootRef.current && !rootRef.current.contains(e.target) && !isBusy) setIsOpen(false);
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
      else setError({ scope: 'patcher', msg: res?.error === 'GAME_PATH_MISSING' ? t.integration.needGameFirst : (res?.error || t.deps.errorDesc) });
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
    <div ref={rootRef} className="relative">
      {/* Collapsed trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title={t.integration.title}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl border border-white/[0.1] bg-surface-2/85 active:scale-[0.95] transition-transform duration-150 ${aggCfg.glow}`}
      >
        {actionable && <span className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${aggCfg.tint} to-transparent`} />}
        {actionable && <span className={`pointer-events-none absolute inset-0 rounded-2xl border ${aggCfg.ring} ${anyMissing ? 'animate-pulse' : ''}`} />}
        <span className={`pointer-events-none absolute inset-0 rounded-2xl bg-white/[0.05] transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
        <Blocks className={`relative w-[22px] h-[22px] transition-colors duration-200 ${actionable ? aggCfg.text : 'text-zinc-300'}`} />
        <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-surface-0 ${aggCfg.dot} ${anyMissing ? 'animate-pulse' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-[340px] origin-top-right"
          style={{ animation: 'notify-center-in 200ms cubic-bezier(0.22,1,0.36,1) both' }}
        >
          <div className="rounded-xl border border-white/[0.08] bg-surface-2/85 p-4 space-y-4 shadow-[0_20px_56px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div>
              <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">{t.integration.title}</p>
              <p className={`text-[12px] font-medium mt-1 ${actionable ? aggCfg.text : 'text-emerald-400'}`}>{headerSub}</p>
            </div>

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
      )}
    </div>
  );
}

function Section({ icon: Icon, label, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <Icon className="w-3 h-3 text-zinc-600" />
        <p className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">{label}</p>
      </div>
      {children}
    </div>
  );
}

function PatcherCard({ t, patcherName, patcherItem, status, installed, upToDate, gameFound, busy, progress, isBusy, onInstall, onUninstall }) {
  const installing = busy === 'patcher';
  const removing = busy === 'uninstall';
  const cardCls = !installed
    ? 'border-white/[0.06] bg-white/[0.02]'
    : upToDate ? 'border-emerald-500/15 bg-emerald-500/[0.04]' : 'border-amber-500/20 bg-amber-500/[0.05]';
  const StateIcon = !installed ? Puzzle : upToDate ? CheckCircle2 : RefreshCw;
  const stateIconCls = !installed ? 'text-zinc-500' : upToDate ? 'text-emerald-400' : 'text-amber-400';

  const sub = installing ? `${t.integration.installingPatcher} · ${Math.round(progress)}%`
    : removing ? t.integration.removingPatcher
    : !installed ? `${t.deps.statusMissing}${patcherItem?.sizeMb ? ` · ≈${patcherItem.sizeMb} ${t.deps.mb}` : ''}`
    : upToDate ? `v${status.patcherInstalledVersion || status.patcherVersion}`
    : status.patcherInstalledVersion ? `v${status.patcherInstalledVersion} → v${status.patcherVersion}` : `${t.deps.statusUpdate} · v${status.patcherVersion}`;

  return (
    <div className={`rounded-xl border p-3 ${cardCls}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <StateIcon className={`w-4 h-4 shrink-0 ${stateIconCls}`} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-zinc-100 truncate">{patcherName}</p>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{sub}</p>
          </div>
        </div>
        {installed && upToDate && !installing && !removing && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/[0.10] border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t.deps.statusUpToDate}
          </span>
        )}
      </div>

      {installing && (
        <div className="mt-2.5 h-1.5 bg-surface-3/60 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      {!installing && !removing && (
        <div className="mt-2.5 flex gap-1.5">
          {!installed ? (
            <button
              type="button" disabled={isBusy || !gameFound} onClick={onInstall}
              title={gameFound ? t.integration.installPatcher : t.integration.needGameFirst}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 text-[11.5px] font-medium hover:bg-emerald-500/[0.14] transition-all active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-emerald-500/[0.08]"
            >
              <Download className="w-3.5 h-3.5" />
              {t.integration.install}
            </button>
          ) : (
            <>
              {!upToDate && (
                <button
                  type="button" disabled={isBusy} onClick={onInstall} title={t.deps.updateAction}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] text-amber-300 text-[11.5px] font-medium hover:bg-amber-500/[0.14] transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t.deps.updateAction}
                </button>
              )}
              <button
                type="button" disabled={isBusy} onClick={onUninstall} title={t.integration.removePatcher}
                className={`inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-white/[0.1] text-zinc-400 hover:text-red-300 hover:border-red-500/30 hover:bg-red-500/[0.08] transition-all active:scale-[0.98] disabled:opacity-40 ${upToDate ? 'flex-1' : 'px-3'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {upToDate && t.integration.remove}
              </button>
            </>
          )}
        </div>
      )}

      {!installed && !gameFound && !installing && (
        <p className="text-[10.5px] text-zinc-600 mt-2">{t.integration.needGameFirst}</p>
      )}
    </div>
  );
}

function ToolRow({ tool, t, busy, progress, isBusy, isError, onInstall }) {
  const cfg = TOOL_STATUS[tool.status] || TOOL_STATUS.installed;
  const RowIcon = cfg.icon;
  const installing = busy === tool.id;
  const cardCls = tool.status === 'installed'
    ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
    : 'border-white/[0.06] bg-white/[0.02]';

  const versionLine = tool.status === 'update'
    ? (tool.installedVersion ? `v${tool.installedVersion} → v${tool.version}` : `${t.deps.statusUpdate} · v${tool.version}`)
    : tool.status === 'missing'
      ? `${t.deps.statusMissing}${tool.sizeMb ? ` · ≈${tool.sizeMb} ${t.deps.mb}` : ''}`
      : `v${tool.version}`;

  return (
    <div className={`rounded-xl border p-3 ${cardCls}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <RowIcon className={`w-4 h-4 shrink-0 ${cfg.text}`} />
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-zinc-100 truncate">{tool.name}</p>
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">
              {installing ? `${t.deps.downloadingLabel} · ${Math.round(progress)}%` : versionLine}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {tool.status === 'installed' ? (
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {t.deps.statusUpToDate}
            </span>
          ) : installing ? (
            <span className="inline-flex items-center justify-center w-8 h-8 text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </span>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              title={tool.status === 'update' ? t.deps.updateAction : t.deps.installAction}
              onClick={onInstall}
              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200 active:scale-[0.94] disabled:opacity-40 ${
                isError ? 'border-white/[0.1] text-zinc-300 hover:bg-white/[0.05]' : cfg.btn
              }`}
            >
              {tool.status === 'update' || isError ? <RefreshCw className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {installing && (
        <div className="mt-2.5 h-1.5 bg-surface-3/60 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
