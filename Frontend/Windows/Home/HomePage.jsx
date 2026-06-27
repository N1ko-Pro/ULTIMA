import React, { useState, useMemo } from 'react';
import { Settings, Search, X } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { GAMES } from '@Games/registry';
import { StartProfilePanel } from '@Windows/Start/components/StartProfilePanel';
import { StartLauncherRail } from '@Windows/Start/components/StartLauncherRail';
import StartIconButton from '@Windows/Start/components/StartIconButton';
import { HomeBackground } from './components/HomeBackground';
import { GameCard } from './components/GameCard';

// ─── HomePage ────────────────────────────────────────────────────────────────
// Game-selection screen shown after the welcome screen. Presents the supported
// games as large cards; picking one persists the choice and drops the user into
// that game's workspace. On later launches the saved game is opened directly,
// so this page is only reached on first run or via "change game".
//
// Chrome mirrors the workspace (Start page) so the two read as one app:
//   • top-left  — profile chip + launcher rail (squircle buttons)
//   • top-right — app settings (same squircle button family)
//   • center    — title + game search + the game grid
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

  // Profile drawer state + measured height, so the launcher rail can glue to
  // the profile's bottom edge exactly like the workspace does.
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [profileHeight, setProfileHeight] = useState(48);

  // Game search. With few games it's mostly forward-looking, but it keeps the
  // grid usable as the catalog grows.
  const [query, setQuery] = useState('');
  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GAMES;
    return GAMES.filter((g) => g.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-surface-0 min-h-0">
      <HomeBackground />

      {/* Top-left: profile chip + launcher rail (shared workspace chrome). */}
      <StartProfilePanel
        isExpanded={isProfileExpanded}
        onToggle={() => setIsProfileExpanded((v) => !v)}
        onClose={() => setIsProfileExpanded(false)}
        onHeightChange={setProfileHeight}
      />
      <StartLauncherRail
        profileHeight={profileHeight}
        onOpenHome={onOpenHome}
      />

      {/* Top-right: app settings — same squircle button family as the workspace.
          (This screen IS the game selector, so no per-game tools live here.) */}
      {onSettingsOpen && (
        <div className="absolute top-5 right-6 z-30">
          <StartIconButton icon={Settings} label={t.settings.title} onClick={onSettingsOpen} spin />
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center px-10 pt-20 pb-20 w-full max-w-[1100px] mx-auto">
          <div className="flex flex-col items-center text-center mb-9 start-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-200 mb-3">
              {t.games.title}
            </h1>
            <p className="text-zinc-500 text-[14px] font-medium max-w-md leading-relaxed">
              {t.games.subtitle}
            </p>
          </div>

          {/* Game search */}
          <div className="w-full max-w-md mb-12 start-fade-in" style={{ animationDelay: '60ms' }}>
            <div className="group relative flex items-center h-11 rounded-xl border border-white/[0.08] bg-surface-2/70 backdrop-blur-md focus-within:border-white/20 focus-within:bg-surface-2/90 transition-colors duration-200">
              <Search className="absolute left-3.5 w-[18px] h-[18px] text-zinc-500 group-focus-within:text-zinc-300 transition-colors duration-200 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.games.search}
                aria-label={t.games.search}
                className="w-full h-full bg-transparent pl-11 pr-10 text-[14px] text-zinc-200 placeholder:text-zinc-600 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={t.common?.clear || 'Clear'}
                  className="absolute right-2.5 flex items-center justify-center w-6 h-6 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] active:scale-[0.9] transition-all duration-150"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {filteredGames.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-[1000px]">
              {filteredGames.map((game, index) => (
                <GameCard
                  key={game.id}
                  game={game}
                  index={index}
                  isActive={game.id === selectedGame}
                  onSelect={onSelectGame}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center start-fade-in">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl border border-white/[0.08] bg-surface-2/70">
                <Search className="w-6 h-6 text-zinc-600" strokeWidth={1.5} />
              </div>
              <p className="text-zinc-500 text-[14px] font-medium">{t.games.noResults}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
