import React from 'react';
import { Rocket, Sparkles } from 'lucide-react';
import { pickPhase } from '@Core/Update/helpers/installProgress';

// ─── Install progress panel ─────────────────────────────────────────────────
// Shared visual block rendered by both `InstallingUpdateModal` (standalone
// overlay) and `UpdateAvailableModal` (installing phase of the richer modal).
// Keeping the markup here means the two modals stay visually synchronised.

/**
 * @param {{
 *   percent: number,
 *   currentVersion: string,
 *   targetVersion: string,
 *   t: any,                  // locale dictionary (`useLocale()` result)
 *   className?: string,
 * }} props
 */
export default function InstallProgressPanel({
  percent,
  currentVersion,
  targetVersion,
  t,
  className = '',
}) {
  const phase = pickPhase(percent);
  const phaseLabel = t.updates.installing?.[phase] ?? phase;
  const titleLabel = t.updates.installing?.title ?? 'Installing update';
  const hintLabel  = t.updates.installing?.hint  ?? 'Do not close the app — it will restart automatically.';

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="relative w-11 h-11 rounded-xl bg-emerald-500/[0.1] border border-emerald-500/[0.22] flex items-center justify-center shrink-0">
          <Rocket className="w-[22px] h-[22px] text-emerald-300" />
          <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-emerald-200/80 animate-[pulse_1.6s_ease-in-out_infinite]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[17px] font-semibold text-zinc-100 tracking-wide">{titleLabel}</h2>
          <p className="text-[12.5px] text-zinc-500 mt-0.5">
            v{currentVersion || '—'} → v{targetVersion || '—'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden relative">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-[length:200%_100%] transition-[width] duration-100 ease-out"
            style={{ width: `${percent}%`, animation: 'bg3_installShimmer 2.4s linear infinite' }}
          />
          <div
            className="absolute top-0 bottom-0 w-8 rounded-full bg-emerald-300/35 blur-md transition-[left] duration-100 ease-out pointer-events-none"
            style={{ left: `calc(${percent}% - 16px)` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="text-zinc-400">{phaseLabel}</span>
          <span className="font-mono text-zinc-300 tabular-nums">{percent}%</span>
        </div>
      </div>

      <p className="text-[11.5px] text-zinc-600 text-center leading-relaxed">{hintLabel}</p>
    </div>
  );
}
