import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Game card ───────────────────────────────────────────────────────────────
// Steam-library-style portrait capsule (2:3). The cover art fills the whole
// card — the title is expected to live in the artwork itself, so no text
// overlay is drawn. On hover the card lifts and tilts in perspective (its
// bottom edge tips toward the viewer) and an animated light glare drifts across
// the top-right corner. The selected game keeps a bright ring. Games without
// artwork fall back to a gradient + icon + name.

export function GameCard({ game, index, isActive, onSelect }) {
  const t = useLocale();
  const Icon = game.icon;
  const disabled = game.available === false;

  return (
    <div
      className="group start-fade-in [perspective:1100px]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onSelect?.(game.id)}
        title={game.name}
        style={{ transformOrigin: 'center center' }}
        className={`relative w-full flex aspect-[2/3] rounded-lg overflow-hidden will-change-transform
          [transform-style:preserve-3d] transition-[transform,box-shadow] duration-300 ease-out
          ${disabled
            ? 'opacity-55 cursor-not-allowed'
            : 'cursor-pointer group-hover:[transform:translateY(-12px)_scale(1.03)_rotateX(7deg)] group-hover:shadow-[0_34px_60px_-18px_rgba(0,0,0,0.75)] active:[transform:translateY(-6px)_scale(1.01)_rotateX(4deg)]'}`}
      >
        {game.cardImage ? (
          <img
            src={game.cardImage}
            alt={game.name}
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-b ${game.accent.gradient}`} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
              {Icon && (
                <div className={`flex items-center justify-center w-16 h-16 rounded-2xl border ${game.accent.iconWrap}`}>
                  <Icon className="w-8 h-8" strokeWidth={1.5} />
                </div>
              )}
              <span className="text-[15px] font-bold text-zinc-100 leading-tight">{game.name}</span>
            </div>
          </>
        )}

        {!disabled && (
          <div className="game-card-glare absolute inset-[-50%] pointer-events-none [transform:translate(16%,-16%)] group-hover:[transform:translate(0%,0%)]" />
        )}

        <div
          className={`absolute inset-0 rounded-lg pointer-events-none transition-all duration-300
            ${isActive
              ? 'ring-2 ring-inset ring-white/85'
              : 'ring-1 ring-inset ring-white/10 group-hover:ring-white/45'}`}
        />

        {disabled && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full border border-white/[0.12] bg-black/55 backdrop-blur-md text-[11.5px] font-semibold text-zinc-300">
            {t.games.soon}
          </div>
        )}
      </button>
    </div>
  );
}
