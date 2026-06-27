import React from 'react';
import { Gamepad2, Info } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import StartIconButton from './StartIconButton';

// ─── Start page launcher rail ────────────────────────────────────────────────
// Workspace quick-action rail, glued to the bottom edge of the profile chip in
// the top-left corner. A vertical stack of squircle icon buttons (one size to
// match the rest of the workspace chrome): "change game" and "about".
//
// Settings moved OUT of the rail to the top-right corner (see StartPage), so
// this rail now only carries navigation entries.

// Profile panel starts at top-5 (20px); the rail rests 8px below its bottom.
const PROFILE_TOP = '20px';
const STACK_GAP   = '8px';

/**
 * @param {{
 *   profileHeight?: number,
 *   onOpenGameSelect?: () => void,
 *   onOpenHome?: () => void,
 * }} props
 */
export function StartLauncherRail({
  profileHeight = 40,
  onOpenGameSelect,
  onOpenHome,
}) {
  const t = useLocale();

  const items = [
    onOpenGameSelect && { key: 'game',  icon: Gamepad2, label: t.games.change,      onClick: onOpenGameSelect },
    onOpenHome       && { key: 'about', icon: Info,     label: t.projects.aboutApp, onClick: onOpenHome },
  ].filter(Boolean);

  if (items.length === 0) return null;

  // Glue the rail to the profile's bottom edge (measured in real time).
  const railTop = `calc(${PROFILE_TOP} + ${profileHeight}px + ${STACK_GAP})`;

  // The profile panel above closes on any outside mousedown. The rail is its
  // sibling, not a descendant, so flag rail clicks as consumed (same
  // convention as the notification center) to keep the profile open while the
  // user interacts with the rail.
  const markConsumed = (e) => { e.nativeEvent._layerConsumed = true; };

  return (
    <div
      className="absolute z-20 left-6 flex flex-col gap-2"
      style={{ top: railTop }}
      data-tutorial="top-buttons"
      onMouseDown={markConsumed}
    >
      {items.map(({ key, icon, label, onClick }) => (
        <StartIconButton key={key} icon={icon} label={label} onClick={onClick} />
      ))}
    </div>
  );
}
