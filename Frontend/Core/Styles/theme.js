// ─── Design tokens ──────────────────────────────────────────────────────────
// Single source of truth for visual primitives the JS layer needs at runtime
// (animations, dynamic style props). Tailwind already covers static styles —
// this file is for places where Tailwind classes can't reach: keyframes,
// animator presets, hand-rolled transitions, dynamic shadow tints.
//
// Anything visual that is read by JS lives here. Anything purely declarative
// stays in `tailwind.config.js` so it can be tree-shaken.

/** Tailwind-aligned surface palette. Mirrors `tailwind.config.colors.surface`. */
export const SURFACE = {
  0: '#09090b',
  1: '#0f0f12',
  2: '#141418',
  3: '#1a1a1f',
  4: '#222228',
};

/** Border-radius scale. Use `RADIUS.lg` etc. when inline-styling is required. */
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
};

/** Shadow recipes used inline (e.g. for animator presets). */
export const SHADOW = {
  panel:    '0 24px 64px rgba(0,0,0,0.5)',
  toast:    '0 1px 1px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
  innerHi:  'inset 0 1px 0 rgba(255,255,255,0.04)',
  cardLow:  '0 1px 3px rgba(0,0,0,0.3)',
};

/** Animation durations, in milliseconds. */
export const DURATION = {
  instant: 80,
  micro:   150,
  short:   200,
  base:    250,
  medium:  400,
  long:    600,
};

/** Cubic-bezier easings as CSS strings. */
export const EASING = {
  /** Material-inspired snappy enter. Used for most UI reveals. */
  enter:    'cubic-bezier(0.16, 1, 0.3, 1)',
  /** Reverse of `enter` for symmetric exit. */
  exit:     'cubic-bezier(0.4, 0, 1, 1)',
  /** Smooth two-way for resizing/opening panels. */
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** Springy overshoot for fun micro-interactions. */
  spring:   'cubic-bezier(0.22, 1, 0.36, 1)',
};

/** Z-index ladder. Same names should appear in CSS classes when used there. */
export const Z = {
  base:        0,
  panel:       10,
  modal:       100,
  homeOverlay: 100,
  dropdown:    200,
  notifyCenter: 300,
  loading:     50,
  toast:       9999,
};
