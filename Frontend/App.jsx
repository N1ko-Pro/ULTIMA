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
import { ProjectInitModal } from '@UI/Modal/ProjectInitModal';

// ─── Page imports ────────────────────────────────────────────────────────────
// Direct imports — this is an Electron app, not a browser. All pages are
// local, so lazy loading only introduces unnecessary loading flashes.

import AuthPage     from '@Windows/Auth/AuthPage';
import StartPage    from '@Windows/Start/StartPage';
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
  const project  = useProjectManager();
  const { translationSettings, updateTranslationSettings } = useTranslationSettings();
  const xml = useXml({
    originalStrings: project.originalStrings,
    setTranslations: project.setTranslations,
    modInfo:         project.modInfo,
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

  // ── Derived state ───────────────────────────────────────────────────────
  const isEditorView = Boolean(project.originalStrings);
  const showProjects = !isEditorView && appState.currentView === 'projects';

  const projectDisplayName = useMemo(
    () => resolveProjectDisplayName({ translations: project.translations, modInfo: project.modInfo }),
    [project.translations, project.modInfo],
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
          isVisible={project.isLoadingPak || project.isLoadingProject}
          message={project.isLoadingPak ? t.common.loadingMod : t.common.loadingProject}
          description={project.isLoadingPak ? t.common.loadingModDesc : t.common.loadingProjectDesc}
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

  if (showProjects) {
    return (
      <StartPage
          onSelectFile={project.handleSelectFile}
          onFileDrop={project.handleOpenFile}
          onLoadProject={project.handleLoadProject}
          onSettingsOpen={appState.handleOpenSettings}
          onOpenHome={appState.handleOpenHomeOverlay}
          onboarding={appState.onboarding}
          onOnboardingUpdate={appState.setOnboarding}
          onTutorialComplete={appState.handleTutorialComplete}
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
          hasUnsavedChanges={project.hasUnsavedChanges}
          translationSettings={translationSettings}
          onUpdateSettings={updateTranslationSettings}
          onSettingsOpen={appState.handleOpenSettings}
          onSavePak={project.handleSavePak}
          onExportXml={xml.handleExportXml}
          onImportXml={xml.handleImportXml}
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
        />
    );
  }

  return <div className="flex-1 bg-surface-0" />;
}
