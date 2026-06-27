import React, { useState, useRef, useEffect } from 'react';
import { Puzzle, Download, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── ToolStatusWidget ────────────────────────────────────────────────────────
// Top-right status pill for the per-game helper tools (e.g. MscLocTool). It
// replaces the old "install required tools" modal that auto-opened on launch:
// the status now lives permanently on screen and only the blocking install
// modal (triggered when opening a mod without the tool) remains.
//
// Collapsed it is a squircle showing a single aggregate status:
//   • red    — a tool is missing (soft glow + pulsing dot)
//   • amber  — a tool has an update available (soft glow)
//   • green  — everything installed and current
//
// Clicking it expands a dropdown styled to match the expanded mini-profile
// drawer (dark surface + inset cards + status pills + tinted action buttons).
// Each tool gets its own install/update button; with 2+ actionable tools a
// footer "install all / update all" button installs them in sequence.

const ALL = '__all__';

const STATUS = {
  installed: {
    icon: CheckCircle2,
    text: 'text-emerald-400',
    dot:  'bg-emerald-400',
    glow: '',
    tint: 'from-emerald-400/[0.07]',
    pill: 'text-emerald-300 bg-emerald-500/[0.10] border-emerald-500/20',
  },
  update: {
    icon: RefreshCw,
    text: 'text-amber-400',
    dot:  'bg-amber-400',
    glow: 'shadow-[0_0_30px_-8px_rgba(251,191,36,0.55)]',
    tint: 'from-amber-400/[0.12]',
    ring: 'border-amber-400/40',
    pill: 'text-amber-300 bg-amber-500/[0.10] border-amber-500/20',
    btn:  'border-amber-500/25 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.14] hover:border-amber-400/40',
  },
  missing: {
    icon: AlertTriangle,
    text: 'text-red-400',
    dot:  'bg-red-400',
    glow: 'shadow-[0_0_30px_-8px_rgba(248,113,113,0.6)]',
    tint: 'from-red-400/[0.12]',
    ring: 'border-red-400/45',
    pill: 'text-red-300 bg-red-500/[0.10] border-red-500/20',
    btn:  'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.14] hover:border-emerald-400/40',
  },
};

// Worst-status-wins aggregation for the collapsed glyph.
function aggregate(tools) {
  if (tools.some((tdef) => tdef.status === 'missing')) return 'missing';
  if (tools.some((tdef) => tdef.status === 'update'))  return 'update';
  return 'installed';
}

/**
 * @param {{
 *   tools: Array<{ id, name, version, sizeMb, status: 'installed'|'missing'|'update', installedVersion?: string }>,
 *   onInstall: (onProgress: (percent: number) => void, toolId?: string) => Promise<void>,
 * }} props
 */
export default function ToolStatusWidget({ tools = [], onInstall }) {
  const t = useLocale();
  const [isOpen, setIsOpen]     = useState(false);
  const [busyId, setBusyId]     = useState(null);   // tool.id | ALL | null
  const [progress, setProgress] = useState(0);
  const [errorId, setErrorId]   = useState(null);   // tool.id | ALL | null
  const [errorMsg, setErrorMsg] = useState(null);
  const rootRef = useRef(null);

  const isBusy = busyId !== null;

  // Outside-click closes the dropdown (unless an install is running). Flag the
  // event as layer-consumed so the sibling profile panel (top-left) doesn't
  // treat widget clicks as "outside".
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        // Keep open when clicking inside another floating layer
        // (notifications, profile, etc.).
        if (e.target?.closest?.('[data-floating-layer]')) return;
        if (!isBusy) setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen, isBusy]);

  if (!tools.length) return null;

  const agg        = aggregate(tools);
  const aggCfg     = STATUS[agg];
  const actionable = agg !== 'installed';
  const anyMissing = agg === 'missing';
  const actionableCount = tools.filter((tool) => tool.status !== 'installed').length;

  const subtitle = agg === 'missing' ? t.deps.toolsAttention
    : agg === 'update' ? t.deps.toolsUpdate
    : t.deps.toolsReady;

  // id = a tool.id (single tool) or ALL (every actionable tool, in sequence).
  const runInstall = async (id) => {
    setBusyId(id);
    setProgress(0);
    setErrorId(null);
    setErrorMsg(null);
    try {
      if (id === ALL) {
        const targets = tools.filter((tool) => tool.status !== 'installed');
        for (let i = 0; i < targets.length; i += 1) {
          const base = (i / targets.length) * 100;
          const span = 100 / targets.length;
          await onInstall?.((percent) => setProgress(base + (percent * span) / 100), targets[i].id);
        }
      } else {
        await onInstall?.((percent) => setProgress(percent), id);
      }
      // `tools` refreshes via the parent (checkDeps) → statuses flip to green.
      setBusyId(null);
    } catch (err) {
      setErrorMsg(err?.message || t.deps.errorDesc);
      setErrorId(id);
      setBusyId(null);
    }
  };

  // Right-hand control for a single tool card.
  const renderRowControl = (tool, cfg) => {
    if (tool.status === 'installed') {
      return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {t.deps.statusUpToDate}
        </span>
      );
    }

    if (busyId === tool.id) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
        </span>
      );
    }

    // While "install all" runs, actionable rows show a quiet spinner.
    if (busyId === ALL) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
        </span>
      );
    }

    const isUpdate = tool.status === 'update';
    const isRetry  = errorId === tool.id;
    const ActionIcon = isUpdate || isRetry ? RefreshCw : Download;
    const label = isRetry ? t.deps.retry : isUpdate ? t.deps.updateAction : t.deps.installAction;
    return (
      <button
        type="button"
        disabled={isBusy}
        title={label}
        aria-label={label}
        onClick={() => runInstall(tool.id)}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200 active:scale-[0.94] disabled:opacity-40 ${
          isRetry ? 'border-white/[0.1] text-zinc-300 hover:bg-white/[0.05]' : cfg.btn
        }`}
      >
        <ActionIcon className="w-4 h-4" />
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative" data-floating-layer>
      {/* Collapsed pill */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title={t.deps.toolsTitle}
        className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl border border-white/[0.1] bg-surface-2/85 active:scale-[0.95] transition-transform duration-150 ${aggCfg.glow}`}
      >
        {/* Subtle status hue — a soft gradient wash, no hard colored border */}
        {actionable && (
          <span className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${aggCfg.tint} to-transparent`} />
        )}
        {/* Status outline ring — colored emphasis; pulses in sync with the dot
            when a tool is missing (both use the same `animate-pulse` cadence). */}
        {actionable && (
          <span className={`pointer-events-none absolute inset-0 rounded-2xl border ${aggCfg.ring} ${anyMissing ? 'animate-pulse' : ''}`} />
        )}
        {/* Hover / open tint on a non-blur overlay (GPU-composited opacity) */}
        <span
          className={`pointer-events-none absolute inset-0 rounded-2xl bg-white/[0.05] transition-opacity duration-200 ${
            isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        <Puzzle className={`relative w-[22px] h-[22px] transition-colors duration-200 ${actionable ? aggCfg.text : 'text-zinc-300'}`} />
        <span
          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-surface-0 ${aggCfg.dot} ${anyMissing ? 'animate-pulse' : ''}`}
        />
      </button>

      {/* Dropdown — mirrors the expanded mini-profile drawer */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-[320px] origin-top-right"
          style={{ animation: 'notify-center-in 200ms cubic-bezier(0.22,1,0.36,1) both' }}
        >
          <div className="rounded-xl border border-white/[0.08] bg-surface-2/85 p-4 space-y-3 shadow-[0_20px_56px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div>
              <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">{t.deps.toolsTitle}</p>
              <p className={`text-[12px] font-medium mt-1 ${actionable ? aggCfg.text : 'text-zinc-500'}`}>{subtitle}</p>
            </div>

            {/* Tool cards */}
            <div className="space-y-2">
              {tools.map((tool) => {
                const cfg = STATUS[tool.status] || STATUS.installed;
                const RowIcon = cfg.icon;
                const isInstalling = busyId === tool.id;
                const versionLine = tool.status === 'update'
                  ? (tool.installedVersion
                      ? `v${tool.installedVersion} → v${tool.version}`
                      : `${t.deps.statusUpdate} · v${tool.version}`)
                  : tool.status === 'missing'
                    ? `${t.deps.statusMissing}${tool.sizeMb ? ` · ≈${tool.sizeMb} ${t.deps.mb}` : ''}`
                    : `v${tool.version}`;

                return (
                  <div
                    key={tool.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <RowIcon className={`w-4 h-4 shrink-0 ${cfg.text}`} />
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-zinc-100 truncate">{tool.name}</p>
                          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {isInstalling
                              ? `${t.deps.downloadingLabel} · ${Math.round(progress)}%`
                              : versionLine}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">{renderRowControl(tool, cfg)}</div>
                    </div>

                    {/* Download progress bar — shown while this tool installs */}
                    {isInstalling && (
                      <div className="mt-2.5 h-1.5 bg-surface-3/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error message (for the most recent failed action) */}
            {errorMsg && !isBusy && (
              <p className="text-[11px] text-red-400 leading-relaxed px-0.5">{errorMsg}</p>
            )}

            {/* "Install/Update all" footer — only when 2+ tools need action */}
            {actionableCount > 1 && (
              busyId === ALL ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="h-1.5 bg-surface-3/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-[11px] text-zinc-500">
                    <span>{t.deps.downloadingLabel}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => runInstall(ALL)}
                  className={`w-full flex items-center justify-center gap-2 h-10 rounded-xl border text-[13px] font-medium transition-all duration-200 active:scale-[0.99] disabled:opacity-40 ${
                    anyMissing ? STATUS.missing.btn : STATUS.update.btn
                  }`}
                >
                  {anyMissing ? <Download className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                  {anyMissing ? t.deps.installAllAction : t.deps.updateAllAction}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
