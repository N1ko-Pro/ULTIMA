import { useEffect, useRef, useState } from 'react';

// ─── Install progress helpers ───────────────────────────────────────────────
// The actual install is performed by NSIS outside our process — we can't
// measure its real progress, so we SIMULATE a progress bar for UX, then call
// `finalizeInstall()` to quit and let NSIS swap the binaries.

export const INSTALL_ANIM_MS   = 2200;  // 0 → 100 % animation length
export const HOLD_AT_100_MS    = 300;   // brief pause at 100 % before finalise
export const FINALIZE_RETRY_MS = 6000;  // safety retry if NSIS hasn't killed us

/**
 * Convert a percent value into the locale phase key shown below the bar.
 * @param {number} percent
 * @returns {'preparing' | 'installing' | 'finalizing' | 'restarting'}
 */
export function pickPhase(percent) {
  if (percent >= 100) return 'restarting';
  if (percent >= 85)  return 'finalizing';
  if (percent >= 20)  return 'installing';
  return 'preparing';
}

/**
 * Drives the simulated progress bar. Runs once per `isActive` flip to true:
 * eases 0 → 100 over `INSTALL_ANIM_MS`, holds briefly at 100 %, then calls
 * `finalizeInstall` with a safety-net retry in case NSIS didn't quit us.
 *
 * @param {boolean} isActive
 * @param {() => void | Promise<void>} finalizeInstall
 * @returns {number} current percent, 0..100
 */
export function useInstallAnimation(isActive, finalizeInstall) {
  const [percent, setPercent] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isActive || startedRef.current) return undefined;
    startedRef.current = true;

    const startTime = performance.now();
    let rafId = 0;
    let holdId = 0;
    let retryId = 0;
    let finalized = false;

    const callFinalize = () => {
      if (finalized) return;
      finalized = true;
      try { finalizeInstall(); } catch { /* ignore */ }
      retryId = window.setTimeout(() => {
        try { finalizeInstall(); } catch { /* ignore */ }
      }, FINALIZE_RETRY_MS);
    };

    const tick = (now) => {
      const elapsed = now - startTime;
      const linear = Math.min(1, elapsed / INSTALL_ANIM_MS);
      const eased = 1 - Math.pow(1 - linear, 3);
      setPercent(Math.round(eased * 100));

      if (linear < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setPercent(100);
        holdId = window.setTimeout(callFinalize, HOLD_AT_100_MS);
      }
    };
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(holdId);
      window.clearTimeout(retryId);
    };
  }, [isActive, finalizeInstall]);

  return percent;
}
