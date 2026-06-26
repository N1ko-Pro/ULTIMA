import React, { useState } from 'react';

// ─── LauncherDock ────────────────────────────────────────────────────────────
// Shared vertical navigation dock used across the Home (game-select) and Start
// (workspace) screens, so the two read as one cohesive app rather than three
// unrelated layouts.
//
// Behaviour (variant A — hover-expand):
//   • Collapsed it is a 40px-wide column of icon buttons, aligned to the same
//     left edge / glyph centering as the profile chip above it.
//   • On hover the capsule animates its width open to the right, fading in a
//     text label next to each icon — like a mini launcher. No click needed.
//   • Each row shows a left-edge accent pill on hover (Discord / VS Code
//     activity-bar signature) and lifts its icon + label contrast.
//
// The dock is purely presentational: callers pass the action items and the
// absolute positioning (so the Start page can glue it under the profile while
// the Home page anchors it to the top-left corner).

const COLLAPSED_WIDTH = '40px';
const EXPANDED_WIDTH   = '210px';
const EASE             = 'cubic-bezier(0.4,0,0.2,1)';

/**
 * @typedef {{
 *   key: string,
 *   icon: import('lucide-react').LucideIcon,
 *   label: string,
 *   onClick: () => void,
 *   spin?: boolean,
 * }} DockItem
 *
 * @param {{
 *   items: DockItem[],
 *   className?: string,
 *   style?: React.CSSProperties,
 *   dataTutorial?: string,
 *   onMouseDown?: (e: React.MouseEvent) => void,
 * }} props
 */
export function LauncherDock({ items, className = '', style, dataTutorial, onMouseDown }) {
  const [hovered, setHovered] = useState(false);

  if (!items?.length) return null;

  const labelStyle = {
    opacity:         hovered ? 1 : 0,
    transition:      `opacity 200ms ${EASE}`,
    transitionDelay: hovered ? '110ms' : '0ms',
  };

  return (
    <div
      className={`absolute z-20 ${className}`}
      style={style}
      data-tutorial={dataTutorial}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="rounded-xl border border-white/[0.08] bg-surface-2/85 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
        style={{
          width:      hovered ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          transition: `width 360ms ${EASE}`,
        }}
      >
        <div className="flex flex-col p-1 gap-0.5">
          {items.map(({ key, icon: Icon, label, onClick, spin }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              title={hovered ? undefined : label}
              className="group/item relative flex items-center w-full h-9 rounded-lg hover:bg-white/[0.06] active:scale-[0.97] transition-colors duration-200"
            >
              {/* Left-edge accent pill — grows in on hover (launcher signature) */}
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-0 rounded-full bg-indigo-400 group-hover/item:h-4 transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" />

              <span className="flex items-center justify-center w-8 h-9 shrink-0">
                <Icon
                  className={`w-5 h-5 text-zinc-400 group-hover/item:text-zinc-100 transition-all duration-500 ${spin ? 'group-hover/item:rotate-90' : ''}`}
                />
              </span>
              <span
                className="pl-1 pr-2 text-[13px] font-medium text-zinc-300 group-hover/item:text-zinc-100 whitespace-nowrap transition-colors duration-200"
                style={labelStyle}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LauncherDock;
