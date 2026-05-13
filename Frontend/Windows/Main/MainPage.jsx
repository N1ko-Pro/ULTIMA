import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@Core/Services/AuthService';
import useAutoTranslation from '@Core/Services/TranslationService';
import useAutoTranslateModePicker from '@Core/Services/AutoTranslateService';
import { useTutorialTrigger } from '@Core/Services/TutorialService';
import { TUTORIAL } from '@Config/timings.constants';
import AuthOverlay from '@Windows/Auth/components/AuthOverlay';
import EditorProfilePanel from './components/EditorProfilePanel';
import AtpAccessModal from '@UI/Modal/AtpAccessModal';
import TutorialEditor from '@UI/Tutorial/TutorialEditor';
import TutorialAutoTranslate from '@UI/Tutorial/TutorialAutoTranslate';
import TutorialDictionary from '@UI/Tutorial/TutorialDictionary';
import TranslationStatusBar from './components/TranslationStatusBar';
import TopBar from './components/TopBar';
import AutoTranslatePanel from './components/AutoTranslatePanel';
import SideBar from './components/SideBar';
import MainTable from './components/MainTable';
import DictionaryPanel from './components/DictionaryPanel';
import * as onboardingApi from '@API/onboarding';

// ─── MainPage ───────────────────────────────────────────────────────────────
// Editor window. Composes the full translation workspace:
//
//   TranslationStatusBar (overlay when auto-translate is running)
//   TopBar               (tools + XML + pack + settings)
//   AutoTranslatePanel   (slide-out panel for smart/local translation)
//   SideBar              (mod info + description)
//   MainTable            (virtualized translatable strings)
//   ProfilePanel         (slides in from the left — Auth widget)
//   DictionaryPanel      (slides in from the left — glossary)
//
// Tutorials (editor, auto-translate, dictionary) trigger automatically on
// first entry via `useTutorialTrigger` and are backed by the scenario
// components in `UI/Tutorial/`.

const PROFILE_PANEL_WIDTH = '350px';
const DICTIONARY_PANEL_WIDTH = '480px';
const PANEL_TRANSITION = 'transition-[width] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]';
const PANEL_GLASS = 'bg-surface-1 border-r border-white/[0.06]';
// CSS containment: tells the browser the panel's internal layout & paint
// can't affect anything outside it. Major win during the slide-in animation —
// the editor column doesn't repaint as the panel grows.
const PANEL_CONTAINMENT = '[contain:layout_paint]';

/**
 * @param {{
 *   originalStrings: any[] | null,
 *   translations: any,
 *   setTranslations: (next: any) => void,
 *   modInfo: any,
 *   hasUnsavedChanges: boolean,
 *   translationSettings: any,
 *   onUpdateSettings: (patch: any) => void,
 *   onSettingsOpen: (tab?: string) => void,
 *   onSavePak: () => void,
 *   onExportXml: () => void,
 *   onImportXml: () => void,
 *   onSaveProject: () => Promise<void>,
 *   onCloseProject: () => void,
 *   onValidatePackBeforeOpen: () => any,
 *   onResetValidation: () => void,
 *   packValidation: any,
 *   packValidationAttempt: number,
 *   isDictionaryOpen: boolean,
 *   onToggleDictionary: () => void,
 *   isProfileOpen: boolean,
 *   onToggleProfile: () => void,
 *   onboarding: any,
 *   onUpdateOnboarding: (patch: any) => void,
 *   packAttemptWithOriginalUuid: boolean,
 *   onDismissPackAttempt: () => void,
 *   onPackAttemptWithOriginalUuid: () => void,
 * }} props
 */
export default function MainPage({
  originalStrings,
  translations,
  setTranslations,
  modInfo,
  hasUnsavedChanges,
  translationSettings,
  onUpdateSettings,
  onSettingsOpen,
  onSavePak,
  onExportXml,
  onImportXml,
  onSaveProject,
  onCloseProject,
  onValidatePackBeforeOpen,
  onResetValidation,
  packValidation,
  packValidationAttempt,
  isDictionaryOpen,
  onToggleDictionary,
  isProfileOpen,
  onToggleProfile,
  onboarding,
  onUpdateOnboarding,
  packAttemptWithOriginalUuid,
  onDismissPackAttempt,
  onPackAttemptWithOriginalUuid,
}) {
  const { canUseAutoTranslate } = useAuth();
  const [isAuthOverlayOpen,       setIsAuthOverlayOpen]       = useState(false);
  const [isAtpAccessModalOpen,    setIsAtpAccessModalOpen]    = useState(false);

  // ── Auto-translate pipeline ──────────────────────────────────────────────
  const {
    isTranslating,
    triggerAutoTranslation,
    cancelAutoTranslation,
    translationProgress,
    translationStage,
    translationPhase,
  } = useAutoTranslation({
    originalStrings,
    translations,
    setTranslations,
  });

  const {
    isExpanded: isAtpExpanded,
    selectedModeId,
    errorModeId,
    canStart,
    openPanel: openAtp,
    closePanel: closeAtp,
    selectMode,
    start: startAtp,
  } = useAutoTranslateModePicker({
    disabled: !originalStrings?.length,
    isTranslating,
    onStart: triggerAutoTranslation,
  });

  // Close ATP when the user loses auto-translate access (e.g. logout).
  useEffect(() => {
    if (!canUseAutoTranslate && isAtpExpanded) closeAtp();
  }, [canUseAutoTranslate, isAtpExpanded, closeAtp]);

  // ── Tutorials ───────────────────────────────────────────────────────────
  const editorTutorial = useTutorialTrigger({
    scenarioKey: 'tutorialEditor',
    onboarding,
    ready: true,
    delayMs: TUTORIAL.EDITOR_AUTO_OPEN_DELAY_MS,
  });

  // ATP / Dictionary tutorials are triggered on first user action, not on mount.
  const [atpTutorialActive,  setAtpTutorialActive]  = useState(false);
  const [dictTutorialActive, setDictTutorialActive] = useState(false);

  const markTutorialDone = useCallback(async (flagKey) => {
    onUpdateOnboarding?.((prev) => (prev ? { ...prev, [flagKey]: true } : { [flagKey]: true }));
    try { await onboardingApi.update({ [flagKey]: true }); } catch { /* ignore */ }
  }, [onUpdateOnboarding]);

  const handleAutoTranslateOpen = useCallback(() => {
    if (!canUseAutoTranslate) {
      setIsAtpAccessModalOpen(true);
      return;
    }
    openAtp();
    if (onboarding && !onboarding.tutorialAutoTranslate && !atpTutorialActive) {
      setTimeout(() => setAtpTutorialActive(true), 600);
    }
  }, [canUseAutoTranslate, openAtp, onboarding, atpTutorialActive]);

  const handleToggleDictionary = useCallback(() => {
    const willOpen = !isDictionaryOpen;
    onToggleDictionary();
    if (willOpen && onboarding && !onboarding.tutorialDictionary && !dictTutorialActive) {
      setTimeout(() => setDictTutorialActive(true), 800);
    }
  }, [isDictionaryOpen, onToggleDictionary, onboarding, dictTutorialActive]);

  const hasOriginalUuid = !translations?.uuid && Boolean(modInfo?.uuid);
  const isCompactSidebar = isDictionaryOpen || isProfileOpen;

  return (
    <div className="flex-1 flex min-h-0 relative overflow-hidden bg-surface-0">
      {/* Profile / dictionary panels — in flex flow. Opening one expands its
          width while SideBar's `isCompact` collapses to 0px, so the visible
          left column width stays constant and the editor doesn't reflow. */}
      <div
        className={`overflow-hidden shrink-0 ${PANEL_TRANSITION} ${PANEL_CONTAINMENT}`}
        style={{ width: isProfileOpen ? `min(${PROFILE_PANEL_WIDTH}, 28vw)` : '0px' }}
      >
        <div className={`w-full h-full flex flex-col ${PANEL_GLASS}`} style={{ minWidth: PROFILE_PANEL_WIDTH }}>
          <EditorProfilePanel isOpen={isProfileOpen} onClose={onToggleProfile} />
        </div>
      </div>

      <div
        className={`overflow-hidden shrink-0 ${PANEL_TRANSITION} ${PANEL_CONTAINMENT}`}
        style={{ width: isDictionaryOpen ? DICTIONARY_PANEL_WIDTH : '0px' }}
      >
        <div className={`w-[480px] h-full flex flex-col ${PANEL_GLASS}`}>
          <DictionaryPanel isOpen={isDictionaryOpen} onClose={onToggleDictionary} />
        </div>
      </div>

      {/* Sidebar — always mounted, collapses to 0px when a left panel is open. */}
      <SideBar
        disabled={!originalStrings?.length}
        modData={modInfo}
        translations={translations}
        setTranslations={setTranslations}
        packValidation={packValidation}
        packValidationAttempt={packValidationAttempt}
        isCompact={isCompactSidebar}
        onToggleProfile={onToggleProfile}
        packAttemptWithOriginalUuid={packAttemptWithOriginalUuid}
        onDismissPackAttempt={onDismissPackAttempt}
      />

      {/* Editor column. */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-15 pointer-events-none" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(9,9,11,0.92) 0%, transparent 100%)' }} />
        <svg className="noise-overlay" aria-hidden="true">
          <filter id="mainNoise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#mainNoise)" />
        </svg>

        <TranslationStatusBar
          visible={isTranslating}
          stage={translationStage}
          progress={translationProgress}
          phase={translationPhase}
          onCancel={cancelAutoTranslation}
        />

        <TopBar
          onSettingsOpen={onSettingsOpen}
          onSavePak={onSavePak}
          hasOriginalUuid={hasOriginalUuid}
          onExportXml={onExportXml}
          onImportXml={onImportXml}
          onValidatePackBeforeOpen={onValidatePackBeforeOpen}
          isDictionaryOpen={isDictionaryOpen}
          onToggleDictionary={handleToggleDictionary}
          onCloseDictionary={onToggleDictionary}
          modData={modInfo}
          onSaveProject={onSaveProject}
          onCloseProject={onCloseProject}
          hasUnsavedChanges={hasUnsavedChanges}
          onPackAttemptWithOriginalUuid={onPackAttemptWithOriginalUuid}
        />

        <AutoTranslatePanel
          isExpanded={isAtpExpanded}
          selectedModeId={selectedModeId}
          errorModeId={errorModeId}
          canStart={canStart}
          isTranslating={isTranslating}
          translationSettings={translationSettings}
          onSelectMode={selectMode}
          onStart={startAtp}
          onClose={closeAtp}
          onUpdateSettings={onUpdateSettings}
          onAuthRequired={() => setIsAuthOverlayOpen(true)}
          onOpenSettings={onSettingsOpen}
        />

        <MainTable
          originalStrings={originalStrings}
          translations={translations}
          setTranslations={setTranslations}
          onResetValidation={onResetValidation}
          packValidation={packValidation}
          packValidationAttempt={packValidationAttempt}
          isAtpExpanded={isAtpExpanded}
          isTranslating={isTranslating}
          onAutoTranslateOpen={handleAutoTranslateOpen}
        />
      </div>

      <AuthOverlay isOpen={isAuthOverlayOpen} onClose={() => setIsAuthOverlayOpen(false)} />
      <AtpAccessModal isOpen={isAtpAccessModalOpen} onClose={() => setIsAtpAccessModalOpen(false)} />

      {/* Tutorials — mounted only while active so their overlays don't linger. */}
      {editorTutorial.isActive && (
        <TutorialEditor
          onComplete={async () => { editorTutorial.close(); await markTutorialDone('tutorialEditor'); }}
        />
      )}

      {atpTutorialActive && (
        <TutorialAutoTranslate
          onBeforeStep={(index) => {
            if (index === 1) { selectMode('smart'); return { track: 400 }; }
            return undefined;
          }}
          onComplete={async () => { setAtpTutorialActive(false); await markTutorialDone('tutorialAutoTranslate'); }}
        />
      )}

      {dictTutorialActive && (
        <TutorialDictionary
          onComplete={async () => { setDictTutorialActive(false); await markTutorialDone('tutorialDictionary'); }}
        />
      )}
    </div>
  );
}
