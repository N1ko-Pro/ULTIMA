import { useCallback, useRef } from 'react';
import { animate as runAnimation } from '@Core/Animations/animationsEngine';

// ─── useMicroInteraction ────────────────────────────────────────────────────
// Press / hover micro-feedback. Wire the returned `bind` object onto a
// pressable element to get a tiny scale-down on click without writing CSS.
//
//   const { ref, bind } = useMicroInteraction();
//   <button ref={ref} {...bind}>Click me</button>

/**
 * @param {object} [options]
 * @param {string} [options.press] Preset name to play on press. Defaults to
 *   `microPress`. Pass `null` to disable press feedback.
 * @returns {{
 *   ref: React.MutableRefObject<HTMLElement | null>,
 *   bind: { onPointerDown: (e: PointerEvent) => void },
 *   trigger: (preset?: string) => void,
 * }}
 */
export function useMicroInteraction(options = {}) {
  const { press = 'microPress' } = options;
  const ref = useRef(null);
  const handleRef = useRef(null);

  const trigger = useCallback((preset = press) => {
    if (!preset || !ref.current) return;
    if (handleRef.current) handleRef.current.cancel();
    handleRef.current = runAnimation(ref.current, preset);
  }, [press]);

  const onPointerDown = useCallback(() => {
    if (!press) return;
    trigger(press);
  }, [press, trigger]);

  return {
    ref,
    bind: { onPointerDown },
    trigger,
  };
}
