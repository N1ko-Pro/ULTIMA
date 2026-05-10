import { DURATION, EASING } from '@Core/Styles/theme';

// ─── Animation presets ──────────────────────────────────────────────────────
// Every preset animates ONLY `transform`, `opacity` and `filter` so the
// browser can run it on the compositor (GPU). Anything that animates
// `width`, `height`, `top`, `box-shadow`, `background-color` would force
// layout/paint and is forbidden here.
//
// A preset has the shape:
//   {
//     keyframes: Keyframe[]                // Web Animations API keyframes
//     options:   KeyframeAnimationOptions  // duration, easing, fill mode
//   }
//
// Consume via `animate(el, preset)` (engine), `useAnimate().play(preset)`
// (imperative trigger) or `useTransition(active, preset)` (mount/unmount).
// CSS classes that need the same animation should reference matching global
// keyframes in `globals.css` (kept in sync by name).

const baseOpts = (duration, easing = EASING.enter) => ({
  duration,
  easing,
  fill: 'both',
});

/** Pure opacity fade-in. Use for ambient panels and overlays. */
export const fadeIn = {
  keyframes: [
    { opacity: 0 },
    { opacity: 1 },
  ],
  options: baseOpts(DURATION.medium),
};

/** Pure opacity fade-out. Companion to `fadeIn` for `useTransition`. */
export const fadeOut = {
  keyframes: [
    { opacity: 1 },
    { opacity: 0 },
  ],
  options: baseOpts(DURATION.short, EASING.exit),
};

/** Slide up from below combined with fade. Default page-enter motion. */
export const slideUp = {
  keyframes: [
    { opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  options: baseOpts(DURATION.base, EASING.spring),
};

/** Slide down from above. Used for pop-down menus and toasts arriving on top. */
export const slideDown = {
  keyframes: [
    { opacity: 0, transform: 'translateY(-8px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
  options: baseOpts(DURATION.short),
};

/** Slide in from the right. Newest-first lists (notifications). */
export const slideInRight = {
  keyframes: [
    { opacity: 0, transform: 'translateX(20px)' },
    { opacity: 1, transform: 'translateX(0)' },
  ],
  options: baseOpts(DURATION.medium, EASING.spring),
};

/** Slide out to the right + slight blur. Companion exit for `slideInRight`. */
export const slideOutRight = {
  keyframes: [
    { opacity: 1, transform: 'translateX(0)    scale(1)',    filter: 'blur(0)' },
    { opacity: 0, transform: 'translateX(28px) scale(0.94)', filter: 'blur(3px)' },
  ],
  options: baseOpts(DURATION.medium, EASING.exit),
};

/** Subtle zoom-in for cards entering view. Pairs well with `slideUp`. */
export const scaleIn = {
  keyframes: [
    { opacity: 0, transform: 'translateY(16px) scale(0.98)' },
    { opacity: 1, transform: 'translateY(0)    scale(1)' },
  ],
  options: baseOpts(DURATION.short),
};

/** Modal panel reveal. Slightly more dramatic scale than scaleIn. */
export const modalIn = {
  keyframes: [
    { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
    { opacity: 1, transform: 'translateY(0)    scale(1)' },
  ],
  options: baseOpts(DURATION.base, EASING.enter),
};

/** Modal panel exit. Reverse of `modalIn` for graceful close. */
export const modalOut = {
  keyframes: [
    { opacity: 1, transform: 'translateY(0)    scale(1)' },
    { opacity: 0, transform: 'translateY(8px)  scale(0.97)' },
  ],
  options: baseOpts(DURATION.short, EASING.exit),
};

/** Modal overlay (backdrop) fade-in. */
export const overlayIn = {
  keyframes: [
    { opacity: 0 },
    { opacity: 1 },
  ],
  options: baseOpts(DURATION.short, 'ease-out'),
};

/** Modal overlay (backdrop) fade-out. */
export const overlayOut = {
  keyframes: [
    { opacity: 1 },
    { opacity: 0 },
  ],
  options: baseOpts(DURATION.short, 'ease-in'),
};

/** Pressed-button micro feedback: 1 → 0.96 → 1. */
export const microPress = {
  keyframes: [
    { transform: 'scale(1)' },
    { transform: 'scale(0.96)' },
    { transform: 'scale(1)' },
  ],
  options: baseOpts(DURATION.micro),
};

/** Light horizontal shake for invalid actions (buttons, inputs). */
export const shake = {
  keyframes: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(4px)' },
    { transform: 'translateX(-3px)' },
    { transform: 'translateX(2px)' },
    { transform: 'translateX(0)' },
  ],
  options: baseOpts(DURATION.medium, 'ease-in-out'),
};

/** Stronger shake for cards/panels — adds a tiny rotation for tactile feel. */
export const shakeStrong = {
  keyframes: [
    { transform: 'translateX(0) rotate(0)' },
    { transform: 'translateX(-6px) rotate(-0.5deg)' },
    { transform: 'translateX(6px)  rotate(0.5deg)' },
    { transform: 'translateX(-4px) rotate(0)' },
    { transform: 'translateX(4px)  rotate(0)' },
    { transform: 'translateX(-2px) rotate(0)' },
    { transform: 'translateX(2px)  rotate(0)' },
    { transform: 'translateX(0)    rotate(0)' },
  ],
  options: baseOpts(480, 'cubic-bezier(0.36,0.07,0.19,0.97)'),
};

/** Indigo glow burst — used to draw the eye to a "Download" CTA. */
export const downloadHighlight = {
  keyframes: [
    { boxShadow: '0 0 0  0 rgba(99,102,241,0)'    },
    { boxShadow: '0 0 12px 2px rgba(99,102,241,0.45)' },
    { boxShadow: '0 0 18px 4px rgba(99,102,241,0.30)' },
    { boxShadow: '0 0 12px 2px rgba(99,102,241,0.45)' },
    { boxShadow: '0 0 0  0 rgba(99,102,241,0)'    },
  ],
  options: baseOpts(480, 'ease-in-out'),
};

/** Spinner rotate (used as JS-driven fallback for inline spinners). */
export const spin = {
  keyframes: [
    { transform: 'rotate(0deg)' },
    { transform: 'rotate(360deg)' },
  ],
  options: { duration: 900, easing: 'linear', iterations: Infinity },
};

/** Indexed access for engines that take a string id. */
export const PRESETS = {
  fadeIn,
  fadeOut,
  slideUp,
  slideDown,
  slideInRight,
  slideOutRight,
  scaleIn,
  modalIn,
  modalOut,
  overlayIn,
  overlayOut,
  microPress,
  shake,
  shakeStrong,
  downloadHighlight,
  spin,
};

/** @typedef {keyof typeof PRESETS} PresetName */
