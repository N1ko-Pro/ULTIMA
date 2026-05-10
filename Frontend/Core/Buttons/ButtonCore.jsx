import React, { forwardRef } from 'react';

// ─── ButtonCore ─────────────────────────────────────────────────────────────
// Single source of truth for button styling. Every clickable action in the
// app that isn't a toggle or a link should render through this component.
//
// Variants — match the colour semantics used across the dark glass UI:
//
//   ── Standard ─────────────────────────────────────────────────────────────
//   primary        Solid emerald          — main confirm / save / install
//   primary-white  Solid white            — primary on very dark panels (project modals)
//   white-glass    Semi-translucent white — hero/auth page primary action
//   secondary      Glass surface          — cancel, dismiss, back
//   ghost          Transparent            — quiet cancel, inline aux action
//
//   ── Coloured tint ────────────────────────────────────────────────────────
//   danger         Red            — delete, discard, irreversible
//   warning        Amber          — caution, "skip" confirmations
//   emerald        Tinted green   — soft CTAs (check update, .NET install)
//   sky            Sky/cyan       — pack, export, tool actions
//   indigo         Indigo         — download, Discord login
//   violet         Violet         — Ollama install, feature CTAs
//
//   ── Tier branding ────────────────────────────────────────────────────────
//   premium        #c451f1 fuchsia — PREMIUM tier
//   ultra          #f1c40f gold    — ULTRA tier
//
// Sizes:
//   sm  h-7   px-3   text-[12px]   rounded-lg
//   md  h-9   px-4   text-[13px]   rounded-xl  (default)
//   lg  h-10  px-5   text-[14px]   rounded-xl
//
// Extra props:
//   icon / iconRight  Lucide component rendered left or right of label
//   fullWidth         Stretches to container width (flex-1 alternative)
//   loading           Shows a spinner and disables interaction

const VARIANT = {
  'primary': [
    'bg-emerald-500 hover:bg-emerald-400 text-white border-transparent',
    'shadow-[0_0_20px_rgba(16,185,129,0.18)] hover:shadow-[0_0_24px_rgba(16,185,129,0.28)]',
  ].join(' '),
  'primary-white': [
    'bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-900 border-transparent',
    'shadow-[0_2px_16px_rgba(255,255,255,0.08)] hover:shadow-[0_6px_28px_rgba(255,255,255,0.13)]',
  ].join(' '),
  'white-glass': [
    'bg-white/[0.88] hover:bg-white/[0.96] text-zinc-800 hover:text-zinc-900',
    'border-white/[0.5] hover:border-white/[0.75]',
  ].join(' '),
  'secondary': [
    'bg-surface-3 hover:bg-surface-4 text-zinc-300',
    'border-white/[0.08] hover:border-white/[0.14]',
  ].join(' '),
  'ghost': [
    'bg-transparent hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-200',
    'border-transparent',
  ].join(' '),
  'danger': [
    'bg-red-500/[0.12] hover:bg-red-500/[0.2] text-red-300',
    'border-red-500/25 hover:border-red-500/40',
  ].join(' '),
  'warning': [
    'bg-amber-500/[0.12] hover:bg-amber-500/[0.2] text-amber-300',
    'border-amber-500/25 hover:border-amber-500/40',
  ].join(' '),
  'emerald': [
    'bg-emerald-500/[0.14] hover:bg-emerald-500/[0.22] text-emerald-100',
    'border-emerald-400/30 hover:border-emerald-400/50',
    'hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]',
  ].join(' '),
  'sky': [
    'bg-sky-500/[0.1] hover:bg-sky-500/[0.18] text-sky-200 hover:text-sky-100',
    'border-sky-500/30 hover:border-sky-400/40',
    'hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]',
  ].join(' '),
  'indigo': [
    'bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14] text-indigo-300 hover:text-indigo-200',
    'border-indigo-500/25 hover:border-indigo-400/40',
    'hover:shadow-[0_0_24px_rgba(99,102,241,0.18)]',
  ].join(' '),
  'violet': [
    'bg-violet-500/[0.08] hover:bg-violet-500/[0.14] text-violet-300 hover:text-violet-200',
    'border-violet-500/25 hover:border-violet-400/40',
    'hover:shadow-[0_0_20px_rgba(139,92,246,0.18)]',
  ].join(' '),
  'premium': [
    'bg-[#c451f1]/[0.08] hover:bg-[#c451f1]/[0.16] text-[#c451f1]',
    'border-[#c451f1]/30 hover:border-[#c451f1]/50',
    'hover:shadow-[0_0_16px_rgba(196,81,241,0.2)]',
  ].join(' '),
  'ultra': [
    'bg-[#f1c40f]/[0.08] hover:bg-[#f1c40f]/[0.16] text-[#f1c40f]',
    'border-[#f1c40f]/30 hover:border-[#f1c40f]/50',
    'hover:shadow-[0_0_16px_rgba(241,196,15,0.25)]',
  ].join(' '),
};

const SIZE = {
  sm: { wrap: 'h-7  px-3   text-[12px] gap-1.5 rounded-lg',  icon: 'w-3 h-3'     },
  md: { wrap: 'h-9  px-4   text-[13px] gap-2   rounded-xl',  icon: 'w-3.5 h-3.5' },
  lg: { wrap: 'h-10 px-5   text-[14px] gap-2   rounded-xl',  icon: 'w-4 h-4'     },
};

const baseClass =
  'inline-flex items-center justify-center font-semibold border ' +
  'transition-all duration-200 active:scale-[0.98] whitespace-nowrap ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20';

/**
 * @param {{
 *   children?: React.ReactNode,
 *   variant?: keyof typeof VARIANT,
 *   size?: keyof typeof SIZE,
 *   icon?: React.ComponentType<{ className?: string }>,
 *   iconRight?: React.ComponentType<{ className?: string }>,
 *   type?: 'button' | 'submit' | 'reset',
 *   disabled?: boolean,
 *   loading?: boolean,
 *   fullWidth?: boolean,
 *   className?: string,
 *   onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void,
 * } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'>} props
 */
const ButtonCore = forwardRef(function ButtonCore({
  children,
  variant = 'secondary',
  size = 'md',
  icon: IconLeft,
  iconRight: IconRight,
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  onClick,
  ...rest
}, ref) {
  const variantClass = VARIANT[variant] || VARIANT.secondary;
  const { wrap: sizeClass, icon: iconClass } = SIZE[size] || SIZE.md;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={[
        baseClass,
        sizeClass,
        variantClass,
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading ? (
        <span className={`inline-block rounded-full border-2 border-current/40 border-t-current animate-spin ${iconClass}`} />
      ) : (
        IconLeft && <IconLeft className={iconClass} />
      )}
      {children}
      {!loading && IconRight && <IconRight className={iconClass} />}
    </button>
  );
});

export default ButtonCore;
