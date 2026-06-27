import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useProjectManager } from '@Core/Services/ProjectService';
import useTranslationSettings from '@Core/Services/SettingsService';
import useAppState from '@Core/Services/AppStateService';
import useUpdater from '@Core/Services/UpdaterService';
import usePackValidation from '@Core/Services/ValidationService';
import useXml from '@Core/Services/XmlService';
import { resolveProjectDisplayName } from '@Shared/helpers/projectShape';
import { LocaleProvider, ru, en } from '@Locales/LocaleProvider';
import { useAuth } from '@Core/Services/AuthService';
import { notify } from '@Shared/notifications/notifyCore';
import * as dictionaryApi from '@API/dictionary';
import OfflineBanner from '@Windows/Main/components/OfflineBanner';
import { useEscapeBlur } from '@Utils/Keyboard/useEscapeBlur';
import TitleBarCore from '@Core/TitleBar/TitleBarCore';
import NotifyToastStack from '@Shared/notifications/notifyToastStack';
import { notifyStore } from '@Shared/notifications/notifyStore';
import LoadingOverlay from '@UI/Loading/LoadingOverlay';
import UpdateAvailableModal from '@UI/Modal/UpdateAvailableModal';
import InstallingUpdateModal from '@UI/Modal/UpdateInstallingModal';
import EulaModal from '@UI/EULA/EulaModal';
import DotNetInstallModal from '@UI/Modal/DotNetInstallModal';
import DotNetMissingModal from '@UI/Modal/DotNetMissingModal';
import AtpAccessModal from '@UI/Modal/AtpAccessModal';
import DependencyModal from '@UI/Modal/DependencyModal';
import { ProjectInitModal } from '@UI/Modal/ProjectInitModal';

// ─── Page imports ────────────────────────────────────────────────────────────
// Direct imports — this is an Electron app, not a browser. All pages are
// local, so lazy loading only introduces unnecessary loading flashes.

import AuthPage     from '@Windows/Auth/AuthPage';
import StartPage    from '@Windows/Start/StartPage';
import HomePage     from '@Windows/Home/HomePage';
import MainPage     from '@Windows/Main/MainPage';
import SettingsPage from '@Windows/Settings/SettingsPage';

// ─── App ────────────────────────────────────────────────────────────────────
// Top-level orchestrator. Owns ONLY:
//   • global state (via the Core/Services hooks)
//   • TitleBar + NotifyToastStack (always-on chrome)
//   • routing between AuthPage / StartPage / MainPage based on flags
//   • global modals (EULA, .NET, Update)
//
// Each page composes its own children — App does not micro-manage panels.

export default function App() {
  useEscapeBlur();
  const { refreshFailed, isLoggedIn } = useAuth();
  const prevRefreshFailedRef = useRef(false);

  const [isAtpModalOpen, setIsAtpModalOpen] = useState(false);
  const [hasOpenModal,   setHasOpenModal]   = useState(false);

  useEffect(() => {
    const check = () => setHasOpenModal(document.body.querySelector('[role="dialog"]') !== null);
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  const appState = useAppState();
  const project  = useProjectManager({
    selectedGame: appState.selectedGame,
    onDependencyMissing: appState.openDepsModal,
  });
  const { translationSettings, updateTranslationSettings } = useTranslationSettings();
  const xml = useXml({
    originalStrings: project.originalStrings,
    setTranslations: project.setTranslations,
    modInfo:         project.modInfo,
    targetLanguage:  project.targetLanguage,
  });
  const validation = usePackValidation({
    originalStrings: project.originalStrings,
    translations:    project.translations,
    modInfo:         project.modInfo,
    resetKey:        appState.validationResetKey,
  });
  const updater = useUpdater();

  // ── Update dismiss tracking (in-memory, resets on restart) ──────────────
  const dismissedUpdateVersionRef = useRef(null);

  // Ref so the interval callback always has the latest updater state/check.
  const updaterRef = useRef(updater);
  useEffect(() => { updaterRef.current = updater; }, [updater]);

  // ── Effects ─────────────────────────────────────────────────────────────
  // Apply a deferred EULA language choice once settings are available.
  useEffect(() => {
    if (!appState.pendingEulaLang || !updateTranslationSettings) return;
    updateTranslationSettings({ general: { appLanguage: appState.pendingEulaLang } }).catch(() => {});
    appState.setPendingEulaLang(null);
  }, [appState.pendingEulaLang, updateTranslationSettings, appState]);

  // Toast when connection is restored after a failed refresh.
  useEffect(() => {
    const locale = translationSettings?.general?.appLanguage === 'en' ? en : ru;
    if (prevRefreshFailedRef.current && !refreshFailed && isLoggedIn) {
      notify.success(locale.auth.connectionRestored, locale.auth.connectionRestoredDesc);
    }
    prevRefreshFailedRef.current = refreshFailed;
  }, [refreshFailed, isLoggedIn, translationSettings?.general?.appLanguage]);

  // Close panels immediately when project loading starts.
  useEffect(() => {
    if (project.isLoadingProject) {
      appState.setIsProfileOpen(false);
      appState.setIsDictionaryOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.isLoadingProject]);

  // Bump validation reset key on each project (re)load.
  useEffect(() => {
    appState.handleResetValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.projectLoadCounter]);

  // Periodic silent update check every 60 s.
  // Runs only when autoUpdateEnabled is true and no check/download is in progress.
  useEffect(() => {
    const enabled = translationSettings?.general?.autoUpdateEnabled ?? true;
    if (!enabled) return;
    const id = setInterval(() => {
      const { status } = updaterRef.current.state;
      if (status === 'idle' || status === 'not-available' || status === 'error') {
        updaterRef.current.check(true);
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [translationSettings?.general?.autoUpdateEnabled]);

  // Auto-download as soon as a new version is detected (mirrors VS Code / Windsurf).
  // The user is only prompted once the package is fully downloaded.
  useEffect(() => {
    if (updater.state.status === 'available') {
      updater.download();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updater.state.status, updater.download]);

  // When download finishes: push bell notification + auto-open modal.
  useEffect(() => {
    if (updater.state.status === 'downloaded' && updater.state.version) {
      const locale = translationSettings?.general?.appLanguage === 'en' ? en : ru;
      notifyStore.recordHistory({
        id: `update-ready-${updater.state.version}`,
        type: 'info',
        title: locale.updates.notif.ready,
        message: locale.updates.notif.readyMsg(updater.state.version),
        action: 'update-pill',
      });
      // Auto-open modal if the user hasn't dismissed this version yet.
      if (dismissedUpdateVersionRef.current !== updater.state.version) {
        appState.setUpdateModalOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updater.state.status, updater.state.version]);

  // Check the selected game's dependencies on entry (first selection + each
  // launch). This only refreshes the on-screen tool-status widget — it never
  // opens a modal. The blocking install modal appears solely when the user
  // tries to open a mod whose tool is missing (ProjectService →
  // onDependencyMissing). Update offers are surfaced passively by the widget.
  useEffect(() => {
    const gameId = appState.selectedGame;
    if (!gameId || !appState.eulaAccepted) return;
    appState.checkDeps(gameId);
    appState.refreshGameIntegration(gameId);
    dictionaryApi.setGame(gameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.selectedGame, appState.eulaAccepted]);

  // ── Derived state ───────────────────────────────────────────────────────
  const isEditorView = Boolean(project.originalStrings);
  const showProjects = !isEditorView && appState.currentView === 'projects';

  const projectDisplayName = useMemo(
    () => resolveProjectDisplayName({
      translations: project.translations,
      modInfo: project.modInfo,
      targetLanguage: project.targetLanguage,
    }),
    [project.translations, project.modInfo, project.targetLanguage],
  );

  // ── Update UI visibility ─────────────────────────────────────────────────
  // Hide the TitleBar pill and download indicator while the user is in EULA,
  // the welcome overlay, DotNet modal, or still going through first-run
  // tutorials (tutorialStartPage === false means not yet completed).
  const firstRunTutorialDone =
    !appState.onboarding || appState.onboarding.tutorialStartPage !== false;

  // Bell is visible as soon as basic onboarding is done (EULA + welcome screen).
  // It must be visible during TutorialStartPage because step 3 targets it.
  const showBell =
    appState.eulaAccepted &&
    !appState.isHomeOverlayOpen &&
    !appState.dotnetInstallModalOpen &&
    appState.onboardingReady;

  // Update pill is hidden until the first-run tutorial finishes (avoid confusion).
  const showUpdaterUI = showBell && firstRunTutorialDone;

  // ── Update modal gating ──────────────────────────────────────────────────
  // The modal only opens when the user explicitly clicks the TitleBar pill.
  // 'installing' forces the modal open regardless (non-dismissible progress).
  const isInstalling = updater.state.status === 'installing';

  const canShowModal = isInstalling || (
    appState.eulaAccepted &&
    !appState.dotnetInstallModalOpen
  );

  // ── Locale ──────────────────────────────────────────────────────────────
  const appLang = translationSettings?.general?.appLanguage || 'ru';
  const t = appLang === 'en' ? en : ru;

  const dotNetVisible = appState.showDotNetModal || project.showDotNetModal;
  const dismissDotNet = () => {
    appState.setShowDotNetModal(false);
    project.setShowDotNetModal(false);
  };

  return (
    <LocaleProvider lang={appLang}>
      <div className="flex flex-col h-screen w-full bg-surface-0 overflow-hidden text-zinc-300 antialiased font-sans">
        <LoadingOverlay
          isVisible={project.isLoadingPak || project.isLoadingProject || project.isPacking}
          message={project.isPacking ? t.common.packing : project.isLoadingPak ? t.common.loadingMod : t.common.loadingProject}
          description={
            project.isPacking
              ? `${t.common.packingDesc}${project.packProgress ? ` ${Math.round(project.packProgress)}%` : ''}`
              : project.isLoadingPak ? t.common.loadingModDesc : t.common.loadingProjectDesc
          }
        />

        <TitleBarCore
          onSaveProject={project.handleSaveProject}
          onCloseProject={appState.handleCloseProjectNav}
          hasUnsavedChanges={project.hasUnsavedChanges}
          projectDisplayName={isEditorView && !hasOpenModal ? projectDisplayName : null}
          onNavigateToProjects={isEditorView ? appState.handleCloseProjectNav : null}
          updaterState={updater.state}
          showBell={showBell}
          showUpdaterUI={showUpdaterUI}
          onShowUpdateModal={() => appState.setUpdateModalOpen(true)}
          onAtpModalClick={() => setIsAtpModalOpen(true)}
          onDepsModalClick={() => appState.openDepsModal(appState.selectedGame, appState.depsMissing)}
          showBranding={!appState.isHomeOverlayOpen}
        />

        <OfflineBanner />

        <div className="flex flex-1 min-h-0 relative">
          <ActivePage
            appState={appState}
            project={project}
            xml={xml}
            validation={validation}
            translationSettings={translationSettings}
            updateTranslationSettings={updateTranslationSettings}
            isEditorView={isEditorView}
            showProjects={showProjects}
          />
        </div>

        <NotifyToastStack />

        <ProjectInitModal
          isOpen={Boolean(project.initModal)}
          defaultModName={project.initModal?.defaultModName || ''}
          defaultTargetLanguage={project.initModal?.defaultTargetLanguage}
          existingProjectNames={project.initModal?.existingNames || []}
          onConfirm={project.confirmInitModal}
          onCancel={project.cancelInitModal}
        />

        {appState.isSettingsOpen && (
          <SettingsPage
            isOpen={appState.isSettingsOpen}
            onClose={appState.handleSettingsClose}
            currentSettings={translationSettings}
            onSaveSettings={updateTranslationSettings}
            onResetTutorial={appState.handleResetTutorial}
            defaultTab={appState.settingsDefaultTab}
          />
        )}

        {appState.isHomeOverlayOpen && (
          <div className="absolute inset-0 z-[100] flex flex-col">
            <AuthPage
              onNavigateToProjects={appState.handleNavigateToProjects}
              isOverlay
              isFirstLaunch={appState.isFirstLaunch}
            />
          </div>
        )}

        {/* Cross-page modals */}
        <EulaModal
          isOpen={appState.onboardingReady && !appState.eulaAccepted}
          initialLang={appLang}
          onAccept={appState.handleAcceptEula}
        />
        <DotNetInstallModal
          isOpen={appState.dotnetInstallModalOpen}
          onInstall={appState.handleDotNetInstall}
          onLater={appState.handleDotNetLater}
          onDismiss={() => appState.setDotnetInstallModalOpen(false)}
        />
        <UpdateAvailableModal
          isOpen={appState.updateModalOpen && canShowModal}
          onDismiss={() => {
            dismissedUpdateVersionRef.current = updater.state.version;
            appState.setUpdateModalOpen(false);
          }}
        />
        <InstallingUpdateModal suppressWhenModalOpen={appState.updateModalOpen} />
        <DotNetMissingModal
          isOpen={dotNetVisible}
          onInstall={appState.handleDotNetInstall}
          onDismiss={dismissDotNet}
        />
        <AtpAccessModal isOpen={isAtpModalOpen} onClose={() => setIsAtpModalOpen(false)} />
        <DependencyModal
          isOpen={appState.depsModalOpen}
          missing={appState.depsMissing}
          onInstall={appState.handleInstallDeps}
          onClose={appState.closeDepsModal}
        />
      </div>
    </LocaleProvider>
  );
}

/**
 * Decides which lazy page to show. Extracted to keep `App` itself lean
 * around the JSX. Each branch is wrapped in its own Suspense boundary so a
 * page swap doesn't unmount the title bar or notification stack.
 */
function ActivePage({
  appState, project, xml, validation,
  translationSettings, updateTranslationSettings,
  isEditorView, showProjects,
}) {
  // Boot-time blank: onboarding not loaded, EULA pending, or home overlay
  // visible — we render the page only AFTER those gates clear.
  if (!appState.onboardingReady || !appState.eulaAccepted || appState.isHomeOverlayOpen) {
    return <div className="flex-1 bg-surface-0" />;
  }

  // Game selection gate: shown on first run (no game chosen yet) or when the
  // user explicitly asks to switch games. Sits between the welcome screen and
  // the workspace.
  const needsGameSelect = !appState.selectedGame || appState.isGameSelectOpen;
  if (needsGameSelect && !isEditorView) {
    return (
      <HomePage
        onSelectGame={appState.handleSelectGame}
        selectedGame={appState.selectedGame}
        onSettingsOpen={appState.handleOpenSettings}
        onOpenHome={appState.handleOpenHomeOverlay}
      />
    );
  }

  if (showProjects) {
    return (
      <StartPage
          onSelectFile={project.handleSelectFile}
          onFileDrop={project.handleOpenFile}
          onLoadProject={project.handleLoadProject}
          onSettingsOpen={appState.handleOpenSettings}
          onOpenHome={appState.handleOpenHomeOverlay}
          onOpenGameSelect={appState.handleOpenGameSelect}
          selectedGame={appState.selectedGame}
          onboarding={appState.onboarding}
          onOnboardingUpdate={appState.setOnboarding}
          onTutorialComplete={appState.handleTutorialComplete}
          toolStatus={appState.depsStatus}
          onInstallTools={appState.handleInstallDeps}
          gameIntegration={appState.gameIntegration}
          onDetectGamePath={appState.detectGamePath}
          onPickGamePath={appState.pickGamePath}
          onClearGamePath={appState.clearGamePath}
          onInstallPatcher={appState.installPatcherToGame}
          onUninstallPatcher={appState.uninstallPatcherFromGame}
          onRefreshIntegration={appState.refreshGameIntegration}
        />
    );
  }

  if (isEditorView) {
    return (
      <MainPage
          originalStrings={project.originalStrings}
          translations={project.translations}
          setTranslations={project.setTranslations}
          modInfo={project.modInfo}
          targetLanguage={project.targetLanguage}
          onChangeTargetLanguage={project.setTargetLanguage}
          hasUnsavedChanges={project.hasUnsavedChanges}
          translationSettings={translationSettings}
          onUpdateSettings={updateTranslationSettings}
          onSettingsOpen={appState.handleOpenSettings}
          onSavePak={project.handleSavePak}
          onExportXml={xml.handleExportXml}
          onImportXml={xml.handleImportXml}
          onOpenXmlFolder={xml.handleOpenXmlFolder}
          onSaveProject={project.handleSaveProject}
          onCloseProject={project.handleCloseProject}
          onValidatePackBeforeOpen={validation.handleValidatePackBeforeOpen}
          onResetValidation={appState.handleResetValidation}
          packValidation={validation.packValidationSnapshot}
          packValidationAttempt={validation.packValidationAttempt}
          isDictionaryOpen={appState.isDictionaryOpen}
          onToggleDictionary={appState.toggleDictionary}
          isProfileOpen={appState.isProfileOpen}
          onToggleProfile={appState.toggleProfile}
          onboarding={appState.onboarding}
          onUpdateOnboarding={appState.setOnboarding}
          packAttemptWithOriginalUuid={appState.packAttemptWithOriginalUuid}
          onDismissPackAttempt={() => appState.setPackAttemptWithOriginalUuid(false)}
          onPackAttemptWithOriginalUuid={() => appState.setPackAttemptWithOriginalUuid(true)}
          gameId={appState.selectedGame}
        />
    );
  }

  return <div className="flex-1 bg-surface-0" />;
}
