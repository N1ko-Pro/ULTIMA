import React from 'react';

/**
 * Minimal inline SVG flag icons (no external deps).
 * Sized via className (defaults to w-5 h-[14px]). All flags share the same
 * thin black ring + rounded corners for visual consistency.
 *
 * Each component renders a 9:6 / 3:2 viewBox with simple geometric shapes
 * — these are intentionally schematic, not pixel-accurate national flags.
 * They exist so the language dropdown / target-language badge can show a
 * recognizable visual cue without bundling a flag asset library.
 */

const baseCls = 'inline-block rounded-[2px] ring-1 ring-black/30 overflow-hidden';
const DEFAULT_SIZE = 'w-5 h-[14px]';

// ── Helpers ────────────────────────────────────────────────────────────────
function HorizontalTriband({ colors, label, className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label={label}>
      <rect width="9" height="2" y="0" fill={colors[0]} />
      <rect width="9" height="2" y="2" fill={colors[1]} />
      <rect width="9" height="2" y="4" fill={colors[2]} />
    </svg>
  );
}

function VerticalTriband({ colors, label, className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label={label}>
      <rect x="0" y="0" width="3" height="6" fill={colors[0]} />
      <rect x="3" y="0" width="3" height="6" fill={colors[1]} />
      <rect x="6" y="0" width="3" height="6" fill={colors[2]} />
    </svg>
  );
}

function HorizontalBicolor({ colors, label, className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label={label}>
      <rect width="9" height="3" y="0" fill={colors[0]} />
      <rect width="9" height="3" y="3" fill={colors[1]} />
    </svg>
  );
}

// ── National flags ─────────────────────────────────────────────────────────
export function FlagRU({ className = DEFAULT_SIZE }) {
  return <HorizontalTriband colors={['#FFFFFF', '#0039A6', '#D52B1E']} label="Русский" className={className} />;
}

export function FlagUS({ className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 7410 3900" preserveAspectRatio="none" aria-label="English">
      <rect width="7410" height="3900" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={i * 300} width="7410" height="300" fill="#FFFFFF" />
      ))}
      <rect width="2964" height="2100" fill="#3C3B6E" />
    </svg>
  );
}

export function FlagDE({ className = DEFAULT_SIZE }) {
  return <HorizontalTriband colors={['#000000', '#DD0000', '#FFCE00']} label="Deutsch" className={className} />;
}

export function FlagFR({ className = DEFAULT_SIZE }) {
  return <VerticalTriband colors={['#0055A4', '#FFFFFF', '#EF4135']} label="Français" className={className} />;
}

export function FlagES({ className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label="Español">
      <rect width="9" height="1.5" y="0"   fill="#AA151B" />
      <rect width="9" height="3"   y="1.5" fill="#F1BF00" />
      <rect width="9" height="1.5" y="4.5" fill="#AA151B" />
    </svg>
  );
}

export function FlagIT({ className = DEFAULT_SIZE }) {
  return <VerticalTriband colors={['#009246', '#FFFFFF', '#CE2B37']} label="Italiano" className={className} />;
}

export function FlagPL({ className = DEFAULT_SIZE }) {
  return <HorizontalBicolor colors={['#FFFFFF', '#DC143C']} label="Polski" className={className} />;
}

export function FlagBR({ className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label="Português">
      <rect width="9" height="6" fill="#009C3B" />
      <polygon points="4.5,0.6 8.4,3 4.5,5.4 0.6,3" fill="#FFDF00" />
      <circle cx="4.5" cy="3" r="1.4" fill="#002776" />
    </svg>
  );
}

export function FlagJP({ className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label="日本語">
      <rect width="9" height="6" fill="#FFFFFF" />
      <circle cx="4.5" cy="3" r="1.6" fill="#BC002D" />
    </svg>
  );
}

export function FlagKR({ className = DEFAULT_SIZE }) {
  // Schematic: white field, central red/blue circle. Trigrams omitted so the
  // motif stays readable at 14px height.
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label="한국어">
      <rect width="9" height="6" fill="#FFFFFF" />
      <path d="M 4.5 1.6 A 1.4 1.4 0 0 1 4.5 4.4 A 0.7 0.7 0 0 0 4.5 3 A 0.7 0.7 0 0 1 4.5 1.6 Z" fill="#CD2E3A" />
      <path d="M 4.5 4.4 A 1.4 1.4 0 0 1 4.5 1.6 A 0.7 0.7 0 0 1 4.5 3 A 0.7 0.7 0 0 0 4.5 4.4 Z" fill="#0047A0" />
    </svg>
  );
}

export function FlagCN({ className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label="简体中文">
      <rect width="9" height="6" fill="#DE2910" />
      <polygon points="1.5,1.4 1.8,2.0 2.5,2.0 1.95,2.4 2.15,3.05 1.5,2.65 0.85,3.05 1.05,2.4 0.5,2.0 1.2,2.0" fill="#FFDE00" />
      <circle cx="2.9" cy="0.9" r="0.18" fill="#FFDE00" />
      <circle cx="3.3" cy="1.5" r="0.18" fill="#FFDE00" />
      <circle cx="3.3" cy="2.3" r="0.18" fill="#FFDE00" />
      <circle cx="2.9" cy="2.9" r="0.18" fill="#FFDE00" />
    </svg>
  );
}

export function FlagUA({ className = DEFAULT_SIZE }) {
  return <HorizontalBicolor colors={['#0057B7', '#FFD700']} label="Українська" className={className} />;
}

export function FlagTR({ className = DEFAULT_SIZE }) {
  return (
    <svg className={`${baseCls} ${className}`} viewBox="0 0 9 6" preserveAspectRatio="none" aria-label="Türkçe">
      <rect width="9" height="6" fill="#E30A17" />
      <circle cx="3.2" cy="3" r="1.3" fill="#FFFFFF" />
      <circle cx="3.55" cy="3" r="1.05" fill="#E30A17" />
      <polygon
        points="4.95,3 4.27,3.22 4.69,2.64 4.69,3.36 4.27,2.78"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// ── Resolver: pick a flag component by name ────────────────────────────────
const FLAG_COMPONENTS = {
  FlagRU, FlagUS, FlagDE, FlagFR, FlagES, FlagIT, FlagPL, FlagBR,
  FlagJP, FlagKR, FlagCN, FlagUA, FlagTR,
};

/**
 * Render the flag component referenced by `name` (e.g. "FlagRU"). Falls back
 * to FlagRU when the name is unknown so the UI never crashes on a typo.
 */
export function FlagByName({ name, className }) {
  const Component = FLAG_COMPONENTS[name] || FlagRU;
  return <Component className={className} />;
}

export default FLAG_COMPONENTS;
