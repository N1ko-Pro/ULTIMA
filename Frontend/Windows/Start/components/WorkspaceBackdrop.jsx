import React, { useId, forwardRef } from 'react';

// ─── Workspace backdrop ──────────────────────────────────────────────────────
// Per-game decorative artwork band in the upper area of the workspace. The
// image is fully opaque at the left/right screen edges and fades to transparent
// toward the centre. The fade boundary is given a ragged "torn page" edge by
// displacing ONLY the gradient mask — the image itself stays crisp.
//
// The root accepts a forwarded ref so the host can drive a scroll parallax,
// nudging the band upward as the workspace scrolls (it would otherwise sit
// statically behind the scroll container).

const VIEW_W = 1000;
const VIEW_H = 620;

export const WorkspaceBackdrop = forwardRef(function WorkspaceBackdrop({ image }, ref) {
  const rawId = useId().replace(/[:]/g, '');
  const fadeId = `ws-fade-${rawId}`;
  const roughId = `ws-rough-${rawId}`;
  const maskId = `ws-mask-${rawId}`;

  if (!image) return null;

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 top-0 z-0 pointer-events-none overflow-hidden"
      style={{ height: VIEW_H, willChange: 'transform', transform: 'translate3d(0,0,0)' }}
      aria-hidden="true"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.34" stopColor="#000" />
            <stop offset="0.66" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>

          <filter id={roughId} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.03" numOctaves="2" seed="11" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="55" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={VIEW_W} height={VIEW_H}>
            <rect
              x="-60"
              y="-60"
              width={VIEW_W + 120}
              height={VIEW_H + 120}
              fill={`url(#${fadeId})`}
              filter={`url(#${roughId})`}
            />
          </mask>
        </defs>

        <image
          href={image}
          x="0"
          y="0"
          width={VIEW_W}
          height={VIEW_H}
          preserveAspectRatio="xMidYMid slice"
          mask={`url(#${maskId})`}
          opacity="0.45"
        />
      </svg>

      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(9,9,11,0.5) 0%, rgba(9,9,11,0) 18%, rgba(9,9,11,0) 55%, rgba(9,9,11,1) 93%)' }}
      />
    </div>
  );
});
