import React, { useState } from 'react';
import { User, Hash, ChevronLeft, Edit2, Check, X } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { ExpandedProfileContent } from '@Core/Profile/ExpandedProfileContent';
import { ExpandedProfileEditor } from '@Core/Profile/ExpandedProfileEditor';
import CopyChip from '@Frontend/Core/Profile/CopyChip';

// ─── Editor profile panel ────────────────────────────────────────────────────
// Side panel that slides in from the left inside the editor (MainPage).
// Has two views: 'main' (subscription + features + actions) and 'settings'
// (local name editor). Switching between them animates with a horizontal slide.

export default function EditorProfilePanel({ isOpen, onClose }) {
  const t = useLocale();
  const { isLoggedIn, user } = useAuth();

  const [view, setView] = useState('main');

  // Reset view when panel closes
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) setView('main');
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 30% 20%, rgba(139,92,246,0.06) 0%, transparent 70%)' }}
        />

        {/* Top action bar */}
        <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-2">
          {view === 'settings' && (
            <button
              type="button"
              onClick={() => setView('main')}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.92] shrink-0"
              aria-label="Назад"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <span className="flex-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-widest ml-0.5">
            {view === 'settings' ? t.auth.localName : t.auth.profile}
          </span>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.08] transition-all duration-200 active:scale-[0.92] shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Avatar + info — always visible */}
        <div className="flex items-center gap-3.5 px-5 pb-2 pt-1">
          <div className="relative shrink-0">
            {isLoggedIn && user?.avatar ? (
              <img src={user.avatar} alt="" className="w-12 h-12 rounded-xl ring-2 ring-white/[0.08]" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-surface-3 border border-white/[0.1] flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-500" />
              </div>
            )}
            {view === 'main' && (
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
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-zinc-100 truncate">
              {isLoggedIn ? (user?.displayName || user?.username) : t.tiers.guest}
            </p>
            {isLoggedIn && user?.username && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <User className="w-3 h-3 text-indigo-400/70 shrink-0" />
                <CopyChip value={user.username}>
                  <span className="text-[12px] text-indigo-300 font-medium truncate">@{user.username}</span>
                </CopyChip>
              </div>
            )}
            {isLoggedIn && user?.id && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Hash className="w-3 h-3 text-zinc-600 shrink-0" />
                <CopyChip value={user.id}>
                  <span className="text-[11px] text-zinc-500 font-mono truncate">{user.id}</span>
                </CopyChip>
              </div>
            )}
          </div>
        </div>
        <div className="pb-3" />
      </div>

      {/* ── Body: animated slide between main ↔ settings ────────────────────── */}
      <div className="flex-1 min-h-0 relative overflow-hidden">

        {/* Main view */}
        <div className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${
          view === 'main'
            ? 'translate-x-0 opacity-100'
            : '-translate-x-full opacity-0 pointer-events-none'
        }`}>
          <div className="py-5 px-5">
            <ExpandedProfileContent isVisible={isOpen && view === 'main'} />
          </div>
        </div>

        {/* Settings view — local name editor */}
        <div className={`absolute inset-0 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${
          view === 'settings'
            ? 'translate-x-0 opacity-100'
            : 'translate-x-full opacity-0 pointer-events-none'
        }`}>
          <div className="py-5 px-5">
            <ExpandedProfileEditor isVisible={view === 'settings'} onClose={() => setView('main')} />
          </div>
        </div>
      </div>
    </div>
  );
}
