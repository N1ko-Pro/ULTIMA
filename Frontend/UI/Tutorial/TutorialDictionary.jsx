import React from 'react';
import TutorialCore from '@Core/Tutorial/TutorialCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TutorialDictionary ─────────────────────────────────────────────────────
// Walks the user through the glossary panel on first open. Targets reside
// inside `Windows/Main/components/DictionaryPanel` under `data-tutorial`
// attributes.

/**
 * @param {{
 *   onComplete: () => void | Promise<void>,
 * }} props
 */
export default function TutorialDictionary({ onComplete }) {
  const t = useLocale();

  const steps = [
    { target: 'dict-panel',      title: t.tutorialDict.stepOverview.title,     description: t.tutorialDict.stepOverview.desc,     padding: 8, position: 'right' },
    { target: 'dict-actions',    title: t.tutorialDict.stepActions.title,      description: t.tutorialDict.stepActions.desc,      padding: 6 },
    { target: 'dict-search',     title: t.tutorialDict.stepSearch.title,       description: t.tutorialDict.stepSearch.desc,       padding: 6 },
    { target: 'dict-table',      title: t.tutorialDict.stepTable.title,        description: t.tutorialDict.stepTable.desc,        padding: 6, position: 'right' },
    { target: 'dict-add',        title: t.tutorialDict.stepAddTerm.title,      description: t.tutorialDict.stepAddTerm.desc,      padding: 6 },
    { target: 'dict-categories', title: t.tutorialDict.stepCategories.title,   description: t.tutorialDict.stepCategories.desc,   padding: 6, position: 'right' },
    { target: 'dict-letters',    title: t.tutorialDict.stepLetterFilter.title, description: t.tutorialDict.stepLetterFilter.desc, padding: 6 },
  ];

  return (
    <TutorialCore
      id="dict"
      steps={steps}
      onComplete={onComplete}
    />
  );
}
