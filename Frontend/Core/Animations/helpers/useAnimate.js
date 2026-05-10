import { useCallback, useRef } from 'react';
import { animate as runAnimation } from '@Core/Animations/animationsEngine';

// ─── useAnimate ─────────────────────────────────────────────────────────────
// Imperative animation handle for any element. Pattern:
//
//   const { ref, play } = useAnimate();
//   <div ref={ref}>…</div>
//   <button onClick={() => play('shake')}>Shake</button>

/**
 * @returns {{
 *   ref: React.MutableRefObject<HTMLElement | null>,
 *   play: (preset: string | object, overrides?: KeyframeAnimationOptions) => Promise<void>,
 *   cancel: () => void,
 * }}
 */
export function useAnimate() {
  const ref = useRef(null);
  const handleRef = useRef(null);

  const play = useCallback(async (preset, overrides) => {
    if (handleRef.current) handleRef.current.cancel();
    const handle = runAnimation(ref.current, preset, overrides);
    handleRef.current = handle;
    await handle.finished;
  }, []);

  const cancel = useCallback(() => {
    if (handleRef.current) handleRef.current.cancel();
    handleRef.current = null;
  }, []);

  return { ref, play, cancel };
}
