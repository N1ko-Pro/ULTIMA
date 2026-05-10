import React from 'react';
import TutorialCore from '@Core/Tutorial/TutorialCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TutorialAutoTranslate ──────────────────────────────────────────────────
// First-open tour of the auto-translate panel. The `onBeforeStep` hook is
// forwarded so the host page can pre-select the "smart" mode at step 1 (the
// settings panel is hidden until a mode is picked, which would leave the
// spotlight pointing at empty space).

/**
 * @param {{
 *   onComplete: () => void | Promise<void>,
 *   onBeforeStep?: (index: number, prev: number | null) =>
 *     void | number | { delay?: number, track?: number },
 * }} props
 */
export default function TutorialAutoTranslate({ onComplete, onBeforeStep }) {
  const t = useLocale();

  const steps = [
    { target: 'atp-modes',    title: t.tutorialAtp.stepModes.title,    description: t.tutorialAtp.stepModes.desc,    padding: 8 },
    { target: 'atp-settings', title: t.tutorialAtp.stepSettings.title, description: t.tutorialAtp.stepSettings.desc, padding: 8 },
    { target: 'atp-start',    title: t.tutorialAtp.stepStart.title,    description: t.tutorialAtp.stepStart.desc,    padding: 8 },
  ];

  return (
    <TutorialCore
      id="atp"
      steps={steps}
      onBeforeStep={onBeforeStep}
      onComplete={onComplete}
    />
  );
}
