import React from 'react';
import { Gamepad2, Info, Settings } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { LauncherDock } from '@Core/Navigation/LauncherDock';

// ─── Start page launcher rail ────────────────────────────────────────────────
// Workspace quick-action dock, glued to the bottom edge of the profile chip in
// the top-left corner. It is a thin wrapper around the shared `LauncherDock`:
// this file only owns the Start-page item set and the positioning that keeps
// the dock tracking the profile panel's measured height frame by frame.
//
// Variant A — the dock expands on hover, so there is no longer an explicit
// toggle button; hovering reveals the labels (change game / about / settings).

// Profile panel starts at top-5 (20px); the dock rests 8px below its bottom.
const PROFILE_TOP = '20px';
const STACK_GAP   = '8px';

/**
 * @param {{
 *   profileHeight?: number,
 *   onOpenGameSelect?: () => void,
 *   onOpenHome?: () => void,
 *   onSettingsOpen?: () => void,
 * }} props
 */
export function StartLauncherRail({
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

  // Glue the dock to the profile's bottom edge (measured in real time).
  const railTop = `calc(${PROFILE_TOP} + ${profileHeight}px + ${STACK_GAP})`;

  // The profile panel above closes on any outside mousedown. The dock is its
  // sibling, not a descendant, so flag dock clicks as consumed (same
  // convention as the notification center) to keep the profile open while the
  // user interacts with the dock.
  const markConsumed = (e) => { e.nativeEvent._layerConsumed = true; };

  return (
    <LauncherDock
      items={items}
      className="left-6"
      style={{ top: railTop }}
      dataTutorial="top-buttons"
      onMouseDown={markConsumed}
    />
  );
}
