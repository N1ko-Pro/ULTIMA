import { Car } from 'lucide-react';

// ─── My Summer Car ───────────────────────────────────────────────────────────
// Game definition consumed by the game-selection screen and (later) by
// game-specific workspace logic. Keep purely declarative — no React here.

export default {
  id: 'mysummercar',
  name: 'My Summer Car',
  developer: 'Amistech Games',
  icon: Car,
  available: true,
  fileTypes: ['DLL', 'ZIP', 'RAR'],
  // Capability flags — MSC has its own (separate) glossary, distinct from BG3.
  // `classifier` enables the technical / other-language string filters, and
  // `customStrings` enables adding source→translation pairs directly in-table.
  features: { dictionary: true, classifier: true, customStrings: true },
  accent: {
    gradient:    'from-amber-500/25 via-lime-500/10 to-transparent',
    glow:        '0 0 60px -12px rgba(245,158,11,0.45)',
    iconWrap:    'bg-amber-500/10 border-amber-400/20 text-amber-200',
    hoverBorder: 'hover:border-amber-400/40',
    action:      'text-amber-300',
  },
};
