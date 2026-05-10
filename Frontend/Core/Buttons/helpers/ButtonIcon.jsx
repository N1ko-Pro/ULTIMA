import React from 'react';

// ─── ButtonIcon ─────────────────────────────────────────────────────────────
// Icon-only square button. Always requires an `aria-label` / `label` prop for
// accessibility. Use ButtonCore for text + icon combos.
//
// Variants and sizes mirror ButtonCore but adapted for square geometry.

const VARIANT = {
  primary:   'text-zinc-200 bg-white/[0.06]  border-white/[0.12]  hover:bg-white/[0.1]    hover:border-white/[0.2]',
  secondary: 'text-zinc-500 bg-transparent   border-white/[0.06]  hover:text-zinc-200     hover:bg-white/[0.04]  hover:border-white/[0.12]',
  ghost:     'text-zinc-500 bg-transparent   border-transparent   hover:text-zinc-200     hover:bg-white/[0.04]',
  danger:    'text-red-400  bg-red-500/[0.06] border-red-500/15   hover:bg-red-500/[0.12] hover:border-red-500/30',
  warning:   'text-amber-400 bg-amber-500/[0.06] border-amber-500/15 hover:bg-amber-500/[0.12] hover:border-amber-500/30',
};

const SIZE = {
  sm: { wrap: 'w-6  h-6  rounded-md',  icon: 'w-3   h-3'   },
  md: { wrap: 'w-8  h-8  rounded-lg',  icon: 'w-3.5 h-3.5' },
  lg: { wrap: 'w-9  h-9  rounded-xl',  icon: 'w-4   h-4'   },
  xl: { wrap: 'w-10 h-10 rounded-xl',  icon: 'w-4.5 h-4.5' },
};

const baseClass =
  'inline-flex items-center justify-center border shrink-0 ' +
  'transition-all duration-200 active:scale-[0.95] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20';

/**
 * @param {{
 *   icon: React.ComponentType<{ className?: string }>,
 *   label: string,
 *   variant?: keyof typeof VARIANT,
 *   size?: keyof typeof SIZE,
 *   disabled?: boolean,
 *   className?: string,
 *   onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void,
 * } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>} props
 */
export default function ButtonIcon({
  icon: Icon,
  label,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  className = '',
  onClick,
  ...rest
}) {
  const variantClass = VARIANT[variant] || VARIANT.secondary;
  const { wrap, icon: iconClass } = SIZE[size] || SIZE.md;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[baseClass, wrap, variantClass, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon className={iconClass} />
    </button>
  );
}
