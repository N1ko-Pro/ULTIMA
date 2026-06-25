import React from 'react';
import { Gamepad2, Info, Settings, ChevronRight } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Start page launcher rail ────────────────────────────────────────────────
// Vertical quick-action rail sitting directly under the profile panel in the
// top-left corner. Collapsed, it shows a column of icon buttons (change game,
// about, settings). The bottom toggle animates the rail's width open to the
// right, revealing text labels next to each icon — like a mini launcher.
//
// The 40px icon column keeps the same left edge / glyph centering as the
// profile icon above it so the two read as one cohesive launcher.
//
// The rail is glued to the profile's bottom edge: `profileHeight` is the
// profile panel's real measured height, so the rail tracks the open/close
// animation frame by frame and adapts to the guest vs. logged-in layouts.

const RAIL_COLLAPSED = '40px';
const RAIL_EXPANDED  = '208px';

// Profile panel starts at top-5 (20px); the rail rests 8px below its bottom.
const PROFILE_TOP    = '20px';
const STACK_GAP      = '8px';

/**
 * @param {{
 *   expanded: boolean,
 *   onToggleExpand: () => void,
 *   profileHeight?: number,
 *   onOpenGameSelect?: () => void,
 *   onOpenHome?: () => void,
 *   onSettingsOpen?: () => void,
 * }} props
 */
export function StartLauncherRail({
  expanded,
  onToggleExpand,
  profileHeight = 40,
  onOpenGameSelect,
  onOpenHome,
  onSettingsOpen,
}) {
  const t = useLocale();

  const items = [
    onOpenGameSelect && { key: 'game',     icon: Gamepad2, label: t.games.change,      onClick: onOpenGameSelect },
    onOpenHome       && { key: 'about',    icon: Info,     label: t.projects.aboutApp, onClick: onOpenHome },
    onSettingsOpen   && { key: 'settings', icon: Settings, label: t.settings.title,    onClick: onSettingsOpen, spin: true },
  ].filter(Boolean);

  if (items.length === 0) return null;

  // Glue the rail to the profile's bottom edge (measured in real time).
  const railTop = `calc(${PROFILE_TOP} + ${profileHeight}px + ${STACK_GAP})`;

  // The profile panel above closes on any outside mousedown. The rail is its
  // sibling, not a descendant, so flag rail clicks as consumed (same
  // convention as the notification center) to keep the profile open while the
  // user toggles or uses the rail.
  const markConsumed = (e) => { e.nativeEvent._layerConsumed = true; };

  const labelStyle = {
    opacity:    expanded ? 1 : 0,
    transition: 'opacity 200ms cubic-bezier(0.4,0,0.2,1)',
    transitionDelay: expanded ? '120ms' : '0ms',
  };

  return (
    <div
      className="absolute z-20 left-6"
      data-tutorial="top-buttons"
      style={{ top: railTop }}
      onMouseDown={markConsumed}
    >
      <div
        className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl overflow-hidden"
        style={{
          width:      expanded ? RAIL_EXPANDED : RAIL_COLLAPSED,
          transition: 'width 420ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="flex flex-col p-1 gap-0.5">
          {items.map(({ key, icon: Icon, label, onClick, spin }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              title={expanded ? undefined : label}
              className="group flex items-center w-full h-9 rounded-lg hover:bg-white/[0.06] active:scale-[0.97] transition-colors duration-200"
            >
              <span className="flex items-center justify-center w-8 h-9 shrink-0">
                <Icon
                  className={`w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-all duration-500 ${spin ? 'group-hover:rotate-90' : ''}`}
                />
              </span>
              <span
                className="pl-1 pr-2 text-[13px] font-medium text-zinc-400 group-hover:text-zinc-200 whitespace-nowrap transition-colors duration-200"
                style={labelStyle}
              >
                {label}
              </span>
            </button>
          ))}

          {/* Divider between actions and the expand toggle */}
          <div className="h-px bg-white/[0.08] mx-1.5 my-1" />

          <button
            type="button"
            onClick={onToggleExpand}
            title={expanded ? t.projects.launcherCollapse : t.projects.launcherExpand}
            className="group flex items-center w-full h-9 rounded-lg hover:bg-white/[0.06] active:scale-[0.97] transition-colors duration-200"
          >
            <span className="flex items-center justify-center w-8 h-9 shrink-0">
              <ChevronRight
                className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300"
                style={{
                  transform:  expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 420ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            </span>
            <span
              className="pl-1 pr-2 text-[13px] font-medium text-zinc-400 group-hover:text-zinc-200 whitespace-nowrap transition-colors duration-200"
              style={labelStyle}
            >
              {expanded ? t.projects.launcherCollapse : t.projects.launcherExpand}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
