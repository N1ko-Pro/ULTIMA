import React from 'react';
import { Info, Settings } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { GAMES } from '@Games/registry';
import { LauncherDock } from '@Core/Navigation/LauncherDock';
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
 *   onOpenHome?: () => void,
 * }} props
 */
export default function HomePage({ onSelectGame, selectedGame, onSettingsOpen, onOpenHome }) {
  const t = useLocale();

  // Same launcher dock as the Start page — keeps navigation consistent across
  // the game-select and workspace screens. "Change game" is omitted here since
  // this screen *is* the game selector.
  const dockItems = [
    onOpenHome     && { key: 'about',    icon: Info,     label: t.projects.aboutApp, onClick: onOpenHome },
    onSettingsOpen && { key: 'settings', icon: Settings, label: t.settings.title,    onClick: onSettingsOpen, spin: true },
  ].filter(Boolean);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-surface-0 min-h-0">
      <HomeBackground />

      <LauncherDock items={dockItems} className="top-5 left-6" />

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
