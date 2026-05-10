import React from 'react';

/**
 * Minimal inline SVG flag icons (no external deps).
 * Sized via className (defaults to w-5 h-4).
 */

const baseCls = 'inline-block rounded-[2px] ring-1 ring-black/30 overflow-hidden';

export function FlagRU({ className = 'w-5 h-[14px]' }) {
  return (
    <svg
      className={`${baseCls} ${className}`}
      viewBox="0 0 9 6"
      preserveAspectRatio="none"
      aria-label="Русский"
    >
      <rect width="9" height="2" y="0" fill="#FFFFFF" />
      <rect width="9" height="2" y="2" fill="#0039A6" />
      <rect width="9" height="2" y="4" fill="#D52B1E" />
    </svg>
  );
}

export function FlagUS({ className = 'w-5 h-[14px]' }) {
  return (
    <svg
      className={`${baseCls} ${className}`}
      viewBox="0 0 7410 3900"
      preserveAspectRatio="none"
      aria-label="English"
    >
      <rect width="7410" height="3900" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={i * 300} width="7410" height="300" fill="#FFFFFF" />
      ))}
      <rect width="2964" height="2100" fill="#3C3B6E" />
    </svg>
  );
}

export default { FlagRU, FlagUS };
