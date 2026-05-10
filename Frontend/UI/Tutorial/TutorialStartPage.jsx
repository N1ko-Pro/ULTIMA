import React from 'react';
import TutorialCore from '@Core/Tutorial/TutorialCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TutorialStartPage ──────────────────────────────────────────────────────
// First-visit tour of the project workspace. Steps target drop zone,
// project list, profile, notification bell and the top-right quick-actions.
// `onBeforeStep` is forwarded so the host page can create an example
// project / open the profile drawer for the relevant steps.

/**
 * @param {{
 *   onComplete: () => void | Promise<void>,
 *   onBeforeStep?: (index: number, prev: number | null) =>
 *     void | number | { delay?: number, track?: number },
 * }} props
 */
export default function TutorialStartPage({ onComplete, onBeforeStep }) {
  const t = useLocale();

  const steps = [
    {
      target: 'dropzone',
      title:       t.tutorialStartPage?.stepDrop?.title          || 'Drop Zone',
      description: t.tutorialStartPage?.stepDrop?.desc           || 'Drag & drop a .pak, .zip, or .rar file here to start translating.',
      padding: 8,
      borderRadius: 20,
    },
    {
      target: 'projects-section',
      title:       t.tutorialStartPage?.stepProjects?.title      || 'Your Projects',
      description: t.tutorialStartPage?.stepProjects?.desc       || 'Recent projects appear here. Click any card to continue translating.',
      padding: 8,
      borderRadius: 16,
    },
    {
      target: 'profile-full',
      title:       t.tutorialStartPage?.stepProfile?.title       || 'Profile',
      description: t.tutorialStartPage?.stepProfile?.desc        || 'Manage your account, sign in, or check subscription status.',
      padding: 6,
      borderRadius: 16,
    },
    {
      target: 'titlebar-notifications',
      title:       t.tutorialStartPage?.stepNotifications?.title || 'Notifications',
      description: t.tutorialStartPage?.stepNotifications?.desc  || 'All important events appear here.',
      padding: 6,
      borderRadius: 12,
    },
    {
      target: 'top-buttons',
      title:       t.tutorialStartPage?.stepButtons?.title       || 'Quick Actions',
      description: t.tutorialStartPage?.stepButtons?.desc        || 'Open app info or jump into settings from here.',
      padding: 6,
      borderRadius: 16,
    },
  ];

  return (
    <TutorialCore
      id="startpage"
      steps={steps}
      onBeforeStep={onBeforeStep}
      onComplete={onComplete}
    />
  );
}
