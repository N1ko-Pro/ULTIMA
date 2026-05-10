import { useEffect, useState } from 'react';

// ─── useDeferredMount ───────────────────────────────────────────────────────
// Delays rendering of heavy content until AFTER a parent animation/transition
// has settled. Solves the classic "panel slides open and stutters because
// hundreds of children mount on the same frame" problem by giving the browser
// a moment to finish the cheap CSS animation before we hand it heavy DOM work.
//
// Usage:
//
//   const ready = useDeferredMount(isOpen, 220);
//   return (
//     <Panel>
//       {ready ? <HeavyList /> : <LightSkeletonOrNothing />}
//     </Panel>
//   );
//
// The hook flips `ready` to true `delayMs` after `active` becomes true, and
// flips back to false IMMEDIATELY when `active` becomes false (so unmount
// doesn't wait — the panel is already collapsing visually).

/**
 * @param {boolean} active   Сигнал "должен отображаться ресурсоемкий контент".
 * @param {number} [delayMs] Задержка перед готовностью переключается в значение true. По умолчанию 220 мс.
 *                           Приблизительно сопоставьте это значение с длительностью перехода родительского элемента:
 *                           на один кадр меньше, чтобы ресурсоемкий контент
 *                           появлялся сразу после завершения открытия панели.
 * @returns {boolean}
 */
export function useDeferredMount(active, delayMs = 220) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // All state writes go through setTimeout so the effect body itself never
    // calls setState synchronously — keeps React 19's strict rule happy and
    // also gives the browser a chance to commit the parent's width change
    // before we mount the heavy children.
    if (!active) {
      const id = setTimeout(() => setReady(false), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setReady(true), Math.max(delayMs, 0));
    return () => clearTimeout(id);
  }, [active, delayMs]);

  return ready;
}
