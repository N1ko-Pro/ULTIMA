import React from 'react';
import TutorialCore from '@Core/Tutorial/TutorialCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TutorialWelcome ────────────────────────────────────────────────────────
// First-launch tour. Introduces features, login and guest access. Triggered
// by `isFirstLaunch` on the welcome page; dismissal marks it completed so
// it never re-appears unless the user explicitly resets tutorials.

/**
 * @param {{
 *   onComplete: () => void | Promise<void>,
 * }} props
 */
export default function TutorialWelcome({ onComplete }) {
  const t = useLocale();

  const steps = [
    {
      title: t.tutorialWelcome?.stepWelcome?.title || 'Welcome!',
      description: t.tutorialWelcome?.stepWelcome?.desc || 'Welcome to BG3 ULTIMA.',
    },
    {
      targets: ['home-features', 'home-login-btn'],
      title: t.tutorialWelcome?.stepFeatures?.title || 'Features & Sign In',
      description: t.tutorialWelcome?.stepFeatures?.desc || 'Explore tools and sign in via Discord.',
      tooltipAnchor: 'home-login-btn',
      position: 'right',
      padding: 14,
      borderRadius: 20,
    },
    {
      target: 'home-social',
      title: t.tutorialWelcome?.stepSocial?.title || 'Our Community',
      description: t.tutorialWelcome?.stepSocial?.desc || 'Find us on Discord, Boosty and Nexus Mods.',
      padding: 12,
      borderRadius: 16,
    },
    {
      target: 'home-start-btn',
      title: t.tutorialWelcome?.stepGuest?.title || 'No Account? No Problem.',
      description: t.tutorialWelcome?.stepGuest?.desc || 'You can continue as a guest and access the core tools right away.',
      padding: 10,
      borderRadius: 14,
    },
  ];

  return (
    <TutorialCore
      id="welcome"
      steps={steps}
      onComplete={onComplete}
    />
  );
}
