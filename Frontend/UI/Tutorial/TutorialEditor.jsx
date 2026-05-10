import React from 'react';
import TutorialCore from '@Core/Tutorial/TutorialCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TutorialEditor ─────────────────────────────────────────────────────────
// Walks the user through the editor view on first entry. Owns its own steps
// array — call sites only need to provide completion handlers.
//
// Each `target` here matches a `data-tutorial="..."` attribute attached to
// the corresponding element inside the editor view.

/**
 * @param {{
 *   onComplete: () => void | Promise<void>,
 * }} props
 */
export default function TutorialEditor({ onComplete }) {
  const t = useLocale();

  const steps = [
    { target: 'editor-sidebar-header',  title: t.tutorialEditor.stepSidebar.title,    description: t.tutorialEditor.stepSidebar.desc,    padding: 6 },
    { target: 'editor-sidebar-modinfo', title: t.tutorialEditor.stepModInfo.title,    description: t.tutorialEditor.stepModInfo.desc,    padding: 8, position: 'right' },
    { target: 'editor-table-rows',      title: t.tutorialEditor.stepTableRows.title,  description: t.tutorialEditor.stepTableRows.desc,  padding: 6 },
    { target: 'editor-progress',        title: t.tutorialEditor.stepProgress.title,   description: t.tutorialEditor.stepProgress.desc,   padding: 6 },
    { target: 'editor-btn-translate',   title: t.tutorialEditor.stepTranslate.title,  description: t.tutorialEditor.stepTranslate.desc,  padding: 8 },
    { target: 'editor-search',          title: t.tutorialEditor.stepSearch.title,     description: t.tutorialEditor.stepSearch.desc,     padding: 6 },
    { target: 'editor-toolbar',         title: t.tutorialEditor.stepToolbar.title,    description: t.tutorialEditor.stepToolbar.desc,    padding: 6 },
    { target: 'editor-tools',           title: t.tutorialEditor.stepTools.title,      description: t.tutorialEditor.stepTools.desc,      padding: 8 },
    { target: 'editor-xml',             title: t.tutorialEditor.stepXml.title,        description: t.tutorialEditor.stepXml.desc,        padding: 6 },
    { target: 'editor-pack',            title: t.tutorialEditor.stepPack.title,       description: t.tutorialEditor.stepPack.desc,       padding: 6 },
    { target: 'editor-settings-btn',    title: t.tutorialEditor.stepSettings.title,   description: t.tutorialEditor.stepSettings.desc,   padding: 6 },
  ];

  return (
    <TutorialCore
      id="editor"
      steps={steps}
      onComplete={onComplete}
    />
  );
}
