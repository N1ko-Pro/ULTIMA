import { useEffect, useRef, useState } from 'react';
import { animate as runAnimation } from '@Core/Animations/animationsEngine';

// ─── useTransition ──────────────────────────────────────────────────────────
// Mount/unmount with enter-and-exit animations. Wrap a route/page in this
// hook to avoid abrupt cuts when switching views.
//
//   const { ref, isMounted } = useTransition(isVisible, 'slideUp');
//   return isMounted ? <div ref={ref}>{children}</div> : null;
//
// Implementation note:
// `isMounted` is derived as `active || isExiting`. We never call
// `setState` inside an effect body to flip mount/unmount — only the
// already-finished exit animation toggles `isExiting` back to false.

/**
 * @param {boolean} active   Whether the content should currently be visible.
 * @param {string | object} enterPreset  Preset to play on enter.
 * @param {string | object} [exitPreset] Preset to play on exit. Defaults to
 *   the reverse of the enter.
 * @returns {{
 *   ref: React.MutableRefObject<HTMLElement | null>,
 *   isMounted: boolean,
 * }}
 */
export function useTransition(active, enterPreset, exitPreset) {
  const [isExiting, setIsExiting] = useState(false);
  const ref = useRef(null);
  const isMounted = active || isExiting;

  // Enter: play the enter animation each time `active` flips true.
  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const handle = runAnimation(ref.current, enterPreset);
    return () => handle.cancel();
  }, [active, enterPreset]);

  // Exit: when `active` flips false while still mounted, run exit animation
  // and toggle `isExiting` off when it settles. Cancelled cleanly if the user
  // re-activates before the animation finishes.
  useEffect(() => {
    if (active) {
      // Re-activated mid-exit — just stop showing the exiting state.
      if (isExiting) setIsExiting(false);
      return undefined;
    }
    if (!ref.current) return undefined;

    setIsExiting(true);
    const target = exitPreset || invertPreset(enterPreset);
    const handle = runAnimation(ref.current, target);
    let cancelled = false;
    handle.finished.then(() => {
      if (!cancelled) setIsExiting(false);
    });
    return () => { cancelled = true; handle.cancel(); };
    // `isExiting` is intentionally excluded from deps to avoid re-running
    // exit logic when we toggle it ourselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, enterPreset, exitPreset]);

  return { ref, isMounted };
}

/**
 * Best-effort inversion of an enter preset. Reverses the keyframes so the
 * element exits along the same path it entered.
 */
function invertPreset(preset) {
  if (typeof preset === 'string') return preset; // engine will skip if missing
  if (!preset || !Array.isArray(preset.keyframes)) return preset;
  return {
    ...preset,
    keyframes: [...preset.keyframes].reverse(),
  };
}
