import React from 'react';

// ─── Page background ────────────────────────────────────────────────────────
// Decorative layered background for the Start page: dot grid, radial fade,
// soft top spotlight, SVG noise and edge vignette. Fully decorative — no
// interactivity, no state.

export function PageBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-surface-0">
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 35%, rgba(9,9,11,0.95) 0%, transparent 100%)' }}
      />
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-white/[0.03] blur-[120px]" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.12] mix-blend-overlay" aria-hidden="true">
        <filter id="startNoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#startNoise)" />
      </svg>
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(9,9,11,1) 100%)' }}
      />
    </div>
  );
}
