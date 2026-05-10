import React, { useRef, useEffect, useState } from 'react';
import { User, ChevronLeft, Edit2 } from 'lucide-react';
import CopyChip from '@Frontend/Core/Profile/CopyChip';
import { useAuth } from '@Core/Services/AuthService';
import { TIER_COLORS } from '@Config/tiers.constants';
import { useLocale } from '@Locales/LocaleProvider';
import BadgeTier from '@UI/Badge/BadgeTier';
import { ExpandedProfileContent } from '@Core/Profile/ExpandedProfileContent';
import { ExpandedProfileEditor } from '@Core/Profile/ExpandedProfileEditor';

// ─── Start page profile panel ────────────────────────────────────────────────
// Top-left corner of the Start page. Morphs between a compact icon and a
// fixed-width card header with the user's avatar + tier badge. Expanding it
// slides out a full ExpandedProfileContent drawer underneath.
//
// A hidden "ghost" div always holds the target dimensions so the tutorial
// overlay can anchor to a stable rect even before the real panel animates open.

const EXPANDED_WIDTH   = '320px';
const COLLAPSED_SIZE   = '40px';
const EXPANDED_HEIGHT  = '64px';
const GHOST_HEIGHT_IN  = '482px';
const GHOST_HEIGHT_OUT = '262px';

/**
 * @param {{ isExpanded: boolean, onToggle: () => void, onClose: () => void }} props
 */
export function StartProfilePanel({ isExpanded, onToggle, onClose }) {
  const auth = useAuth();
  const t = useLocale();
  const panelRef = useRef(null);

  const [view, setView] = useState('main');

  const dot = (TIER_COLORS[auth.tier] || TIER_COLORS.guest).dot;

  // Reset view when panel closes
  const [prevIsExpanded, setPrevIsExpanded] = useState(isExpanded);
  if (prevIsExpanded !== isExpanded) {
    setPrevIsExpanded(isExpanded);
    if (!isExpanded) setView('main');
  }

  // Close on click outside — without blocking page interactions
  useEffect(() => {
    if (!isExpanded) return undefined;
    const handleMouseDown = (e) => {
      if (e._layerConsumed) return;
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isExpanded, onClose]);

  return (
    <>
      <div ref={panelRef} className="absolute z-30 top-5 left-6" data-tutorial="profile">
      <div
        data-tutorial="profile-full"
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: EXPANDED_WIDTH, height: auth.isLoggedIn ? GHOST_HEIGHT_IN : GHOST_HEIGHT_OUT }}
      />

      <div
        className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl"
        style={{
          width:      isExpanded ? EXPANDED_WIDTH : COLLAPSED_SIZE,
          height:     isExpanded ? EXPANDED_HEIGHT : COLLAPSED_SIZE,
          transition: 'width 500ms cubic-bezier(0.4,0,0.2,1), height 500ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          title={t.auth.profile}
          className="absolute inset-0 flex items-center justify-center hover:bg-white/[0.03] active:scale-[0.94] transition-colors duration-200"
          style={{
            opacity:       isExpanded ? 0 : 1,
            pointerEvents: isExpanded ? 'none' : 'auto',
            transition:    'opacity 250ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div className="relative">
            {auth.user?.avatar ? (
              <img src={auth.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <User className={`w-5 h-5 ${auth.isLoggedIn ? 'text-zinc-400' : 'text-zinc-500'}`} />
            )}
            {auth.isLoggedIn && (
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-0 ${dot}`} />
            )}
          </div>
        </button>

        {/* Expanded header — static row, only chevron closes */}
        <div
          className="absolute inset-0 px-3 flex items-center justify-between"
          style={{
            opacity:         isExpanded ? 1 : 0,
            pointerEvents:   isExpanded ? 'auto' : 'none',
            transition:      'opacity 250ms cubic-bezier(0.4,0,0.2,1)',
            transitionDelay: isExpanded ? '200ms' : '0ms',
          }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              {auth.user?.avatar ? (
                <img src={auth.user.avatar} alt="" className="w-9 h-9 rounded-full ring-2 ring-white/[0.08] object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
                  <User className="w-4 h-4 text-zinc-500" />
                </div>
              )}
              {view === 'main' && auth.isLoggedIn && (
                <button
                  type="button"
                  onClick={() => setView('settings')}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface-2 border border-white/[0.14] flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-3 transition-all duration-200 active:scale-[0.9]"
                  aria-label="Редактировать имя"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden text-left">
              <p className="text-[13px] font-semibold text-zinc-100 truncate">
                {auth.isLoggedIn ? (auth.user?.displayName || auth.user?.username) : t.tiers.guest}
              </p>
              {auth.isLoggedIn && (
                <div className="relative mt-0.5 h-[18px] w-full overflow-hidden">
                  <div
                    className="absolute inset-0 flex items-center transition-opacity duration-300"
                    style={{ opacity: isExpanded ? 0 : 1, pointerEvents: 'none' }}
                  >
                    <BadgeTier tier={auth.tier} size="sm" />
                  </div>
                  <div
                    className="absolute inset-0 flex items-center min-w-0 transition-opacity duration-300"
                    style={{ opacity: isExpanded ? 1 : 0, pointerEvents: isExpanded ? 'auto' : 'none' }}
                  >
                    <p className="text-[11px] font-mono truncate min-w-0">
                      <CopyChip value={auth.user?.username}>
                        <span className="text-indigo-300 font-medium">@{auth.user?.username}</span>
                      </CopyChip>
                      <span className="text-zinc-600"> | </span>
                      <CopyChip value={auth.user?.id}>
                        <span className="text-zinc-500">{auth.user?.id}</span>
                      </CopyChip>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.92] shrink-0"
            aria-label="Закрыть профиль"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden transition-[max-height,opacity,margin-top] duration-[450ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          maxHeight: isExpanded ? '600px' : '0px',
          opacity:   isExpanded ? 1 : 0,
          marginTop: isExpanded ? '8px' : '0px',
        }}
      >
        <div className="w-[320px] rounded-xl border border-white/[0.1] bg-surface-1 shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Main view */}
          <div className={`p-5 transition-all duration-300 ease-in-out ${
            view === 'main'
              ? 'translate-x-0 opacity-100'
              : '-translate-x-full opacity-0 pointer-events-none absolute inset-0'
          }`}>
            <ExpandedProfileContent isVisible={isExpanded && view === 'main'} />
          </div>

          {/* Settings view — local name editor */}
          <div className={`p-5 transition-all duration-300 ease-in-out ${
            view === 'settings'
              ? 'translate-x-0 opacity-100'
              : 'translate-x-full opacity-0 pointer-events-none absolute inset-0'
          }`}>
            <ExpandedProfileEditor isVisible={view === 'settings'} onClose={() => setView('main')} />
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
