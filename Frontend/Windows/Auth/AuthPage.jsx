import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@Core/Services/AuthService';
import { useDiscordLogin } from '@Shared/hooks/useDiscordLogin';
import { useLocale } from '@Locales/LocaleProvider';
import TutorialWelcome from '@UI/Tutorial/TutorialWelcome';
import logoSrc from '@Assets/logo.png';
import pkg from '../../../package.json';
import { getFeatures } from './utils/constants';
import { FeatureCard } from './components/FeatureCard';
import { UserStatusCard } from './components/UserStatusCard';
import AuthProfilePanel from './components/AuthProfilePanel';
import { PrimaryActions, SocialLinks } from './AuthPageButtons';

// ─── AuthPage ───────────────────────────────────────────────────────────────
// Welcome screen of the app. Shown on first launch and reachable later via
// the "Home" affordance. Hosts:
//   • Branding + tagline
//   • (when logged in) user status card with a profile drawer underneath
//   • Feature grid explaining each tier
//   • Primary navigation buttons + Discord login
//   • Social links row + footer
//   • First-launch tutorial overlay
//
// Heavy buttons live in `AuthPageButtons.jsx` so this file stays about
// composition.

/**
 * @param {{
 *   onNavigateToProjects: () => void,
 *   isOverlay?: boolean,
 *   isFirstLaunch?: boolean,
 * }} props
 */
export default function AuthPage({ onNavigateToProjects, isOverlay = false, isFirstLaunch = false }) {
  const t = useLocale();
  const { isLoading, isLoggedIn, user, tier, isOffline } = useAuth();
  const { isLoggingIn, handleLogin } = useDiscordLogin();

  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [profileView,       setProfileView]       = useState('main');
  const [cardsHidden,       setCardsHidden]       = useState(false);
  const [profileHeight,     setProfileHeight]     = useState(0);
  const [gridHeight,        setGridHeight]        = useState(0);
  const profileRef = useRef(null);
  const gridRef    = useRef(null);

  // Reset profile view when panel closes
  useEffect(() => {
    if (!isProfileExpanded) setProfileView('main');
  }, [isProfileExpanded]);

  const appVersion  = pkg?.version || '0.0.0';
  const currentYear = new Date().getFullYear();
  const features    = getFeatures(t);

  const [showTutorial, setShowTutorial] = useState(isFirstLaunch);

  // Measure profile + grid heights to compute the overlap margin so the
  // primary button never moves when the profile drawer expands.
  useEffect(() => {
    if (isProfileExpanded && profileRef.current) {
      setProfileHeight(profileRef.current.offsetHeight);
    } else if (!isProfileExpanded) {
      setProfileHeight(0);
    }
  }, [isProfileExpanded]);

  useEffect(() => {
    if (gridRef.current) {
      setGridHeight(gridRef.current.offsetHeight);
    }
  }, [cardsHidden]);

  const overlapMargin = Math.max(0, profileHeight - gridHeight);

  // Collapse the profile drawer when the user logs out.
  useEffect(() => {
    if (isLoggedIn || (!isProfileExpanded && !cardsHidden)) return;
    setIsProfileExpanded(false);
    const t1 = setTimeout(() => setCardsHidden(false), 380);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const handleToggleProfile = useCallback(() => {
    if (!isProfileExpanded) {
      setCardsHidden(true);
      setTimeout(() => setIsProfileExpanded(true), 320);
    } else {
      setIsProfileExpanded(false);
      setTimeout(() => setCardsHidden(false), 380);
    }
  }, [isProfileExpanded]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative select-none">
      {/* Background layers */}
      <div className="absolute inset-0 bg-surface-0" />
      <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(139,92,246,0.06) 0%, transparent 70%)' }}
      />
      <svg className="noise-overlay" aria-hidden="true">
        <filter id="homeNoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#homeNoise)" />
      </svg>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center px-6 pt-8 pb-4 w-full max-w-[600px] mx-auto">
          <div className="flex flex-col items-center text-center mb-5 mt-12 app-slide-up" style={{ animationDelay: '50ms' }}>
            <div className="relative mb-2 flex items-center gap-0">
              <div className="absolute inset-0 blur-[60px] bg-white/[0.04] rounded-full scale-[2.5]" />
              <img src={logoSrc} alt="ULTIMA" className="relative w-24 h-24 object-contain drop-shadow-[0_0_24px_rgba(139,92,246,0.2)] shrink-0" />
              <h1 className="relative text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-300 to-zinc-600">
                ULTIMA
              </h1>
            </div>
            <p className="text-zinc-500 text-[14px] font-medium max-w-sm leading-relaxed">
              {t.welcome.tagline}
            </p>
          </div>

          {isLoggedIn && (
            <div
              className="relative z-20 w-full mb-6 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{ maxWidth: isProfileExpanded ? '340px' : '100%' }}
            >
              <UserStatusCard
                user={user}
                tier={tier}
                isExpanded={isProfileExpanded}
                onToggle={handleToggleProfile}
                profileView={profileView}
                onEditName={() => setProfileView('settings')}
              />
            </div>
          )}

          {/* Feature grid + profile overlay */}
          <div ref={gridRef} className="relative w-full mb-5" data-tutorial="home-features">
            <div
              className="w-full grid grid-cols-2 gap-3.5"
              style={{ pointerEvents: cardsHidden ? 'none' : 'auto' }}
            >
              {features.map((f, i) => {
                const scatterX = i % 2 === 0 ? -80 : 80;
                return (
                  <div
                    key={f.title}
                    className="transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] h-full"
                    style={{
                      opacity: cardsHidden ? 0 : 1,
                      transform: cardsHidden
                        ? `translateX(${scatterX}px) scale(0.88)`
                        : 'translateX(0) scale(1)',
                      transitionDelay: cardsHidden ? `${i * 35}ms` : `${(3 - i) * 35}ms`,
                    }}
                  >
                    <FeatureCard {...f} index={i} />
                  </div>
                );
              })}
            </div>

            {isLoggedIn && (
              <AuthProfilePanel
                ref={profileRef}
                isExpanded={isProfileExpanded}
                profileView={profileView}
                onSetProfileView={setProfileView}
              />
            )}
          </div>

          <div
            className="w-full space-y-3 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] isolate"
            style={{
              maxWidth: isProfileExpanded ? '340px' : '100%',
              marginTop: `${overlapMargin}px`,
            }}
          >
            <PrimaryActions
              isFirstLaunch={isFirstLaunch}
              isOverlay={isOverlay}
              isLoggedIn={isLoggedIn}
              onNavigateToProjects={onNavigateToProjects}
              onLogin={handleLogin}
              isLoggingIn={isLoggingIn}
              isLoading={isLoading}
              isOffline={isOffline}
            />
          </div>
        </div>
      </div>

      <SocialLinks />

      <div className="relative z-20 shrink-0 border-t border-white/[0.04] bg-surface-0/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-8 py-3">
          <p className="text-[12px] font-medium tracking-wide text-zinc-600 select-none">
            {t.welcome.copyright(currentYear)}
          </p>
          <p className="text-[12px] font-medium tracking-wide text-zinc-600 select-none text-right">
            {t.welcome.version(appVersion)}
          </p>
        </div>
      </div>

      {showTutorial && (
        <TutorialWelcome
          onComplete={() => setShowTutorial(false)}
        />
      )}
    </div>
  );
}
