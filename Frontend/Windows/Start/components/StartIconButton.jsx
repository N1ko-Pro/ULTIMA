import React from 'react';

// ─── StartIconButton ──────────────────────────────────────────────────────────
// The single squircle icon button used across the workspace chrome (launcher
// rail, settings, integration trigger). One size everywhere — a 48px rounded
// square with a 22px glyph — so every corner action reads as the same family.

/**
 * @param {{
 *   icon: import('lucide-react').LucideIcon,
 *   label?: string,
 *   onClick?: () => void,
 *   spin?: boolean,            // gentle 90° rotate on hover (settings cog)
 *   dataTutorial?: string,
 *   onMouseDown?: (e: React.MouseEvent) => void,
 * }} props
 */
export default function StartIconButton({ icon: Icon, label, onClick, spin, dataTutorial, onMouseDown }) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      title={label}
      aria-label={label}
      data-tutorial={dataTutorial}
      className="group relative flex items-center justify-center w-12 h-12 rounded-2xl border border-white/[0.1] bg-surface-2/85 active:scale-[0.95] transition-transform duration-150"
    >
      <span className="pointer-events-none absolute inset-0 rounded-2xl bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <Icon
        className={`relative w-[22px] h-[22px] text-zinc-300 group-hover:text-white transition-all duration-300 ${spin ? 'group-hover:rotate-90' : ''}`}
      />
    </button>
  );
}
