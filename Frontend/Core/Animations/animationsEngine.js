import { PRESETS } from '@Core/Animations/animationsPresets';

// ─── Animation engine ───────────────────────────────────────────────────────
// Tiny wrapper around the Web Animations API. Resolves a preset by name (or
// accepts a custom one), respects `prefers-reduced-motion`, and returns a
// `Promise` so callers can `await` enter-animations before flipping state.
//
//   await animate(node, 'modalIn');
//   await animate(node, 'shake', { iterations: 2 });
//   const handle = animate(node, 'spin'); handle.cancel();

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the OS asks us to reduce motion. Cheap to call. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * @typedef {Object} AnimateHandle
 * @property {Promise<void>} finished  Resolves when the animation finishes naturally.
 * @property {() => void} cancel       Cancels the underlying animation.
 * @property {Animation | null} raw    Underlying `Animation` object (null when reduced motion).
 */

/**
 * Run a preset (or custom keyframes) on `element`. Honours
 * `prefers-reduced-motion`: in that case the animation is skipped and the
 * element is left in its natural style.
 *
 * @param {Element | null | undefined} element
 * @param {import('@Core/Animations/animationsPresets').PresetName | { keyframes: Keyframe[], options?: KeyframeAnimationOptions }} preset
 * @param {KeyframeAnimationOptions} [overrides]  Per-call option overrides (e.g. delay).
 * @returns {AnimateHandle}
 */
export function animate(element, preset, overrides) {
  if (!element || !element.animate) {
    return makeHandle(Promise.resolve(), null);
  }

  if (prefersReducedMotion()) {
    return makeHandle(Promise.resolve(), null);
  }

  const resolved = typeof preset === 'string' ? PRESETS[preset] : preset;
  if (!resolved) return makeHandle(Promise.resolve(), null);

  const animation = element.animate(resolved.keyframes, {
    ...resolved.options,
    ...overrides,
  });

  return makeHandle(animation.finished.then(() => undefined, () => undefined), animation);
}

function makeHandle(finished, raw) {
  return {
    finished,
    cancel: () => { if (raw) raw.cancel(); },
    raw,
  };
}
