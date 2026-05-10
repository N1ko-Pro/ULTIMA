import { useRef, useCallback } from 'react';

// ─── useTiltEffect ──────────────────────────────────────────────────────────
// 3D-tilt interaction for project cards. Writes `transform` imperatively and
// exposes `--mouse-x`/`--mouse-y` custom properties so the CSS can position a
// cursor-follow spotlight without re-rendering.

/**
 * @param {{ maxTilt?: number, scale?: number, perspective?: number }} [options]
 */
export function useTiltEffect({ maxTilt = 8, scale = 1.02, perspective = 1000 } = {}) {
  const ref = useRef(null);

  const onMouseMove = useCallback((event) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((event.clientX - centerX) / (rect.width / 2)) * maxTilt;
    const rotateX = -((event.clientY - centerY) / (rect.height / 2)) * maxTilt;

    const mouseXPct = ((event.clientX - rect.left) / rect.width * 100).toFixed(0);
    const mouseYPct = ((event.clientY - rect.top) / rect.height * 100).toFixed(0);

    el.style.transition = 'transform 0.15s ease-out';
    el.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(1)}deg) rotateY(${rotateY.toFixed(1)}deg) scale3d(${scale},${scale},${scale})`;
    el.style.setProperty('--mouse-x', `${mouseXPct}%`);
    el.style.setProperty('--mouse-y', `${mouseYPct}%`);
  }, [maxTilt, scale, perspective]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)`;
  }, [perspective]);

  return { ref, onMouseMove, onMouseLeave };
}
