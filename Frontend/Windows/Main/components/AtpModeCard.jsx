import React from 'react';
import { Lock } from 'lucide-react';

// ─── AtpModeCard ────────────────────────────────────────────────────────────
// One of the two cards in the auto-translate panel's mode picker. Displays
// icon, label, description and a lock affordance when the mode is gated by
// tier. Fires `onClick` which — for locked cards — will typically open the
// auth overlay instead of selecting.

const CONTAINER_STATE = {
  locked:
    'border-white/[0.06] bg-white/[0.01] opacity-60',
  error:
    'border-red-400/30 bg-red-500/[0.06] animate-[autoTranslateShake_340ms_ease-in-out]',
  selected:
    'border-white/[0.18] bg-white/[0.04] shadow-[0_2px_16px_rgba(0,0,0,0.2)]',
  idle:
    'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.06] hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
};

const ACCENT_STATE = {
  error:    'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]',
  selected: 'bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.2)]',
  idle:     'bg-white/[0.06]',
};

const ICON_WRAP_STATE = {
  error:    'bg-red-500/[0.12] border-red-500/20',
  selected: 'bg-white/[0.1] border-white/[0.16]',
  idle:     'bg-white/[0.04] border-white/[0.08] group-hover/card:bg-white/[0.08] group-hover/card:border-white/[0.14]',
};

const ICON_COLOR_STATE = {
  error:    'text-red-300',
  selected: 'text-white',
  idle:     'text-zinc-400 group-hover/card:text-zinc-200',
};

/** Pick the rendering variant for the card based on flags. */
function pickVariant({ locked, hasError, isSelected }) {
  if (locked)     return 'locked';
  if (hasError)   return 'error';
  if (isSelected) return 'selected';
  return 'idle';
}

/**
 * @param {{
 *   icon: React.ComponentType<any>,
 *   label: React.ReactNode,
 *   description: React.ReactNode,
 *   isSelected?: boolean,
 *   hasError?: boolean,
 *   locked?: boolean,
 *   onClick: () => void,
 * }} props
 */
export default function AtpModeCard({ icon: Icon, label, description, isSelected, hasError, locked, onClick }) {
  const variant = pickVariant({ locked, hasError, isSelected });
  const containerClass = CONTAINER_STATE[variant] ?? CONTAINER_STATE.idle;
  // Locked cards render in the same visual state as idle for everything
  // except opacity, so fall back to idle for nested accents.
  const accentVariant = variant === 'locked' ? 'idle' : variant;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group/card relative flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-all duration-200 cursor-pointer select-none text-left w-full ${containerClass}`}
    >
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent rounded-t-2xl" />
      <div className={`absolute h-[calc(100%-16px)] w-[2px] left-[2px] top-[8px] rounded-full transition-all duration-300 ${ACCENT_STATE[accentVariant]}`} />

      <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 shrink-0 ${ICON_WRAP_STATE[accentVariant]}`}>
        <Icon className={`w-4 h-4 transition-all duration-300 ${ICON_COLOR_STATE[accentVariant]}`} />
      </div>

      <div className="flex-1 min-w-0">
        <span className={`text-[13px] font-semibold leading-tight transition-colors duration-200 block whitespace-nowrap ${
          hasError ? 'text-red-200' : isSelected ? 'text-white' : 'text-zinc-200 group-hover/card:text-white'
        }`}>
          {label}
        </span>
        <span className={`text-[12px] leading-tight block mt-0.5 transition-colors duration-200 whitespace-nowrap ${
          isSelected ? 'text-zinc-400' : 'text-zinc-500 group-hover/card:text-zinc-400'
        }`}>
          {description}
        </span>
      </div>

      {locked && <Lock className="w-3.5 h-3.5 text-zinc-500 shrink-0 self-start mt-0.5" />}
    </button>
  );
}
