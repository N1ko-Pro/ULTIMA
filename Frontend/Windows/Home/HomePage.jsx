import React from 'react';
import { Settings } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { GAMES } from '@Games/registry';
import { HomeBackground } from './components/HomeBackground';
import { GameCard } from './components/GameCard';

// ─── HomePage ────────────────────────────────────────────────────────────────
// Game-selection screen shown after the welcome screen. Presents the supported
// games as large cards; picking one persists the choice and drops the user into
// that game's workspace. On later launches the saved game is opened directly,
// so this page is only reached on first run or via "change game".
//
// Game-specific data lives under `Frontend/Games/<id>/`; this page only renders
// whatever the registry exposes.

/**
 * @param {{
 *   onSelectGame: (gameId: string) => void,
 *   selectedGame?: string | null,
 *   onSettingsOpen?: () => void,
 * }} props
 */
export default function HomePage({ onSelectGame, selectedGame, onSettingsOpen }) {
  const t = useLocale();

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-surface-0 min-h-0">
      <HomeBackground />

      {onSettingsOpen && (
        <div className="absolute top-5 right-6 z-30">
          <button
            type="button"
            onClick={onSettingsOpen}
            title={t.projects.settings}
            className="group flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.95] transition-all duration-200"
          >
            <Settings className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-all duration-500 group-hover:rotate-90" />
          </button>
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center px-10 pt-20 pb-20 w-full max-w-[1100px] mx-auto">
          <div className="flex flex-col items-center text-center mb-14 start-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-200 mb-3">
              {t.games.title}
            </h1>
            <p className="text-zinc-500 text-[14px] font-medium max-w-md leading-relaxed">
              {t.games.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-[1000px]">
            {GAMES.map((game, index) => (
              <GameCard
                key={game.id}
                game={game}
                index={index}
                isActive={game.id === selectedGame}
                onSelect={onSelectGame}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
