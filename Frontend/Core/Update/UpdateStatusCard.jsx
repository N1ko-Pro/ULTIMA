import React, { useCallback, useMemo } from 'react';
import { RefreshCw, Download, CheckCircle2, AlertCircle, Rocket, Loader2 } from 'lucide-react';
import useUpdater from '@Core/Services/UpdaterService';
import { useLocale } from '@Locales/LocaleProvider';
import { stripHtml } from '@Shared/helpers/strings';

// ─── UpdateStatusCard ───────────────────────────────────────────────────────
// Rich card rendered inside Settings → General. Shows current version, last
// check status, available version + release notes, download progress, and
// the appropriate primary action (Check / Download / Install). Acts as the
// "core" in-app surface for the Update subsystem.

const ACCENT = {
  neutral: { bg: 'bg-white/[0.04]',       border: 'border-white/[0.08]' },
  indigo:  { bg: 'bg-indigo-500/[0.08]',  border: 'border-indigo-500/[0.18]' },
  emerald: { bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/[0.18]' },
  amber:   { bg: 'bg-amber-500/[0.08]',   border: 'border-amber-500/[0.18]' },
};

/**
 * @param {{
 *   autoUpdateEnabled?: boolean,
 *   onAutoUpdateToggle?: (next: boolean) => void,
 * }} props
 */
export default function UpdateStatusCard({ autoUpdateEnabled = true, onAutoUpdateToggle }) {
  const t = useLocale();
  const { state, currentVersion, check, download, install } = useUpdater();

  const { accent, Icon, iconTint, statusText, subText } = useMemo(
    () => describeStatus(state, t, currentVersion),
    [state, t, currentVersion],
  );

  const handleCheck    = useCallback(() => { check(false); },  [check]);
  const handleDownload = useCallback(() => { download(); },    [download]);
  const handleInstall  = useCallback(() => { install(); },     [install]);

  const isChecking    = state.status === 'checking';
  const isAvailable   = state.status === 'available';
  const isDownloading = state.status === 'download-progress';
  const isDownloaded  = state.status === 'downloaded';
  const isError       = state.status === 'error';
  const isIdle        = state.status === 'idle' || state.status === 'not-available' || isError;
  const percent       = state.progress?.percent ?? 0;

  return (
    <div className="relative w-full rounded-2xl border border-white/[0.07] bg-surface-2/40 backdrop-blur-xl p-4 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />

      <div className="flex items-center gap-3.5">
        <div className={`self-start w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${accent.bg} ${accent.border}`}>
          <Icon className={`w-4 h-4 ${iconTint} ${isChecking ? 'animate-spin' : ''}`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">{t.updates.title}</p>
          <p className="text-[12px] text-zinc-500 leading-relaxed mt-0.5">{statusText}</p>
          {subText && <p className="text-[11.5px] text-zinc-600 mt-1">{subText}</p>}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isIdle && (
            <button
              type="button"
              onClick={handleCheck}
              disabled={isChecking}
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.1] px-3 py-2 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/[0.18] hover:border-emerald-400/40 hover:shadow-[0_0_16px_rgba(52,211,153,0.25)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              {t.updates.check}
            </button>
          )}

          {isAvailable && (
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-xl border border-indigo-400/25 bg-indigo-500/[0.1] px-3 py-2 text-[12px] font-semibold text-indigo-200 hover:bg-indigo-500/[0.18] hover:border-indigo-400/40 hover:shadow-[0_0_16px_rgba(139,92,246,0.25)] transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              {t.updates.download}
            </button>
          )}

          {isDownloaded && (
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.1] px-3 py-2 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/[0.18] hover:border-emerald-400/40 hover:shadow-[0_0_16px_rgba(52,211,153,0.25)] transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Rocket className="w-3.5 h-3.5" />
              {t.updates.install}
            </button>
          )}
        </div>
      </div>

      {isDownloading && (
        <div className="mt-4 space-y-1.5">
          <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-400 transition-[width] duration-200 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500">
            <span>{t.updates.downloading} {percent}%</span>
            <span>{formatSpeed(state.progress?.bytesPerSecond || 0)}</span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center justify-between px-7">
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-200">{t.updates.autoUpdate}</p>
            <p className="text-[11.5px] text-zinc-500 mt-0.5">{t.updates.autoUpdateDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => onAutoUpdateToggle?.(!autoUpdateEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
              autoUpdateEnabled
                ? 'bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-white/[0.04] border border-white/[0.08]'
            }`}
            aria-label={t.updates.autoUpdate}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                autoUpdateEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {(isAvailable || isDownloaded) && state.info?.releaseNotes && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            {t.updates.whatsNew}
          </summary>
          <div className="mt-2 rounded-xl border border-white/[0.06] bg-surface-1/40 p-3 max-h-40 overflow-y-auto">
            <pre className="text-[11.5px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed">
              {stripHtml(state.info.releaseNotes)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}

function describeStatus(state, t, currentVersion) {
  const versionSubText = currentVersion ? t.updates.currentVersion(currentVersion) : '';

  switch (state.status) {
    case 'checking':
      return { accent: ACCENT.neutral, Icon: Loader2,      iconTint: 'text-indigo-300',  statusText: t.updates.checking,                              subText: versionSubText };
    case 'available':
      return { accent: ACCENT.indigo,  Icon: Download,     iconTint: 'text-indigo-300',  statusText: t.updates.availableUpdate(state.version || '?'),       subText: versionSubText };
    case 'download-progress':
      return { accent: ACCENT.indigo,  Icon: Download,     iconTint: 'text-indigo-300',  statusText: t.updates.downloading,                            subText: state.version ? t.updates.downloadingVersion(state.version) : '' };
    case 'downloaded':
      return { accent: ACCENT.emerald, Icon: Rocket,       iconTint: 'text-emerald-300', statusText: t.updates.ready,                                  subText: state.version ? t.updates.readyVersion(state.version) : '' };
    case 'not-available':
      return { accent: ACCENT.emerald, Icon: CheckCircle2, iconTint: 'text-emerald-300', statusText: t.updates.upToDate,                               subText: versionSubText };
    case 'error':
      return { accent: ACCENT.amber,   Icon: AlertCircle,  iconTint: 'text-amber-300',   statusText: t.updates.error,                                  subText: state.error || '' };
    case 'idle':
    default:
      return { accent: ACCENT.neutral, Icon: RefreshCw,    iconTint: 'text-zinc-300',    statusText: t.updates.idle,                                   subText: versionSubText };
  }
}

function formatSpeed(bps) {
  if (!bps) return '';
  const mbps = bps / 1024 / 1024;
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}
