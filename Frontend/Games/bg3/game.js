import { Swords } from 'lucide-react';

// ─── Baldur's Gate 3 ─────────────────────────────────────────────────────────
// Game definition consumed by the game-selection screen and (later) by
// game-specific workspace logic. Keep purely declarative — no React here.

export default {
  id: 'bg3',
  name: "Baldur's Gate 3",
  developer: 'Larian Studios',
  icon: Swords,
  available: true,
  fileTypes: ['PAK', 'ZIP', 'RAR'],
  accent: {
    gradient:    'from-violet-600/25 via-fuchsia-500/10 to-transparent',
    glow:        '0 0 60px -12px rgba(139,92,246,0.45)',
    iconWrap:    'bg-violet-500/10 border-violet-400/20 text-violet-200',
    hoverBorder: 'hover:border-violet-400/40',
    action:      'text-violet-300',
  },
};
