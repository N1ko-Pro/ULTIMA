import React from 'react';
import {
  CheckCircle2, AlertTriangle, Download, RefreshCw, Loader2, Puzzle, Trash2,
} from 'lucide-react';

// ─── MscIntegrationCards ──────────────────────────────────────────────────────
// Presentational building blocks for `MscIntegrationPanel`: the labelled
// section wrapper, the translation-patcher card, and a build-tool row. Split
// into their own module so the panel file stays focused on state + actions.
// These are dumb components — all state, handlers and aggregation live in the
// panel that renders them.

// Per build-tool status visuals (icon / text / dot / pill / action button).
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

// Labelled group: a small uppercase caption with an icon, then its content.
export function Section({ icon: Icon, label, children }) {
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

// The runtime patcher installed once into the game: status + install / update /
// remove controls and a download progress bar.
export function PatcherCard({ t, patcherName, patcherItem, status, installed, upToDate, gameFound, busy, progress, isBusy, onInstall, onUninstall }) {
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

// A single build tool (e.g. MscLocTool): status pill / install / update + a
// download progress bar.
export function ToolRow({ tool, t, busy, progress, isBusy, isError, onInstall }) {
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
