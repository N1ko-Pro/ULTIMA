import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MEDIA_LINKS } from '@Config/media.config';
import { useLocale } from '@Locales/LocaleProvider';
import { GitHubIcon, DiscordIcon, BoostyIcon, NexusIcon } from '@UI/Social/SocialIcons';
import * as appWindow from '@API/appWindow';

// ─── Auth page buttons ──────────────────────────────────────────────────────
// Two button groups used by the welcome screen:
//   • `PrimaryActions` — the "My Projects" and "Login via Discord" buttons
//   • `SocialLinks`    — the row of community icons pinned above the footer
//
// Kept here (instead of inline in AuthPage) so the main page file stays
// focused on layout/state composition.

/**
 * @param {{
 *   isFirstLaunch: boolean,
 *   isOverlay: boolean,
 *   isLoggedIn: boolean,
 *   onNavigateToProjects: () => void,
 *   onLogin: () => void,
 *   isLoggingIn: boolean,
 *   isLoading: boolean,
 *   isOffline: boolean,
 * }} props
 */
export function PrimaryActions({
  isFirstLaunch,
  isOverlay,
  isLoggedIn,
  onNavigateToProjects,
  onLogin,
  isLoggingIn,
  isLoading,
  isOffline,
}) {
  const t = useLocale();
  const primaryLabel = isFirstLaunch
    ? t.welcome.getStarted
    : isOverlay
      ? t.welcome.backToProjects
      : t.welcome.myProjects;

  return (
    <>
      <button
        type="button"
        data-tutorial="home-start-btn"
        onClick={onNavigateToProjects}
        className="group relative w-full flex items-center justify-center gap-2.5 h-12 rounded-xl border border-white/[0.5] bg-white/[0.88] text-zinc-800 font-semibold text-[16px] hover:bg-white/[0.96] hover:border-white/[0.75] hover:text-zinc-900 active:scale-[0.98] transition-all duration-200 overflow-hidden"
      >
        <span className="relative z-10">{primaryLabel}</span>
        <ArrowRight className="relative z-10 w-4 h-4 text-zinc-500 group-hover:text-zinc-700 group-hover:translate-x-0.5 transition-all duration-200" />
      </button>

      {!isLoggedIn && (
        <>
          <div data-tutorial="home-login-btn">
            <button
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn || isLoading || isOffline}
              className="group relative w-full flex items-center justify-center gap-2.5 h-12 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] text-indigo-300 font-semibold text-[15px] hover:bg-indigo-500/[0.12] hover:border-indigo-400/40 hover:shadow-[0_0_32px_rgba(99,102,241,0.15)] active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none overflow-hidden"
            >
              <DiscordIcon className="relative z-10 w-5 h-5" />
              <span className="relative z-10">
                {isLoggingIn ? t.auth.connecting : t.auth.loginDiscord}
              </span>
            </button>
          </div>
          <p className="text-center text-[13px] text-zinc-500 leading-relaxed pt-1">
            {t.welcome.loginPrompt}
            <br />
            <span className="text-zinc-600">{t.welcome.loginPromptGuest}</span>
          </p>
        </>
      )}
    </>
  );
}

const SOCIAL_ICONS = [
  { key: 'github',    Icon: GitHubIcon,  href: MEDIA_LINKS.github,    title: 'GitHub',     hoverClass: 'hover:text-zinc-200 hover:border-zinc-400/30 hover:bg-zinc-400/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]' },
  { key: 'discord',   Icon: DiscordIcon, href: MEDIA_LINKS.discord,   title: 'Discord',    hoverClass: 'hover:text-indigo-400 hover:border-indigo-400/30 hover:bg-indigo-400/[0.08] hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]' },
  { key: 'boosty',    Icon: BoostyIcon,  href: MEDIA_LINKS.boosty,    title: 'Boosty',     hoverClass: 'hover:text-orange-400 hover:border-orange-400/30 hover:bg-orange-400/[0.08] hover:shadow-[0_0_20px_rgba(251,146,60,0.15)]' },
  { key: 'nexusMods', Icon: NexusIcon,   href: MEDIA_LINKS.nexusMods, title: 'Nexus Mods', hoverClass: 'hover:text-amber-400 hover:border-amber-400/30 hover:bg-amber-400/[0.08] hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]' },
];

export function SocialLinks() {
  return (
    <div data-tutorial="home-social" className="relative z-20 shrink-0 flex items-center justify-center gap-5 py-3">
      {SOCIAL_ICONS.map(({ key, Icon, href, title, hoverClass }) => (
        <button
          key={key}
          type="button"
          onClick={() => appWindow.openExternal(href)}
          title={title}
          className={`group flex items-center justify-center w-11 h-11 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl text-zinc-500 hover:scale-110 active:scale-95 transition-all duration-300 ${hoverClass}`}
        >
          <Icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}
