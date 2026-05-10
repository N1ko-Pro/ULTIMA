import { useState, useEffect, useCallback, useRef } from 'react';
import * as onboardingApi from '@API/onboarding';
import * as dotnetApi from '@API/dotnet';

// ─── App state service ──────────────────────────────────────────────────────
// Centralised UI state for the app shell: which overlays are visible, which
// onboarding gates are open, .NET install flow, EULA flow, settings tab to
// open, etc.
//
// Migrated from `Core/hooks/useAppState.js`. The legacy `activeTutorial` /
// `setActiveTutorial` properties have been DROPPED — each tutorial scenario
// now manages its own visibility via `useTutorialTrigger` (UI/Tutorial/).
// Pages call `useTutorialTrigger` directly; no central tutorial state needed.

export default function useAppState() {
  const [isSettingsOpen,         setIsSettingsOpen]         = useState(false);
  const [settingsDefaultTab,     setSettingsDefaultTab]     = useState(null);
  const [isDictionaryOpen,       setIsDictionaryOpen]       = useState(false);
  const [isProfileOpen,          setIsProfileOpen]          = useState(false);
  const [isHomeOverlayOpen,      setIsHomeOverlayOpen]      = useState(false);
  const [isFirstLaunch,          setIsFirstLaunch]          = useState(false);
  const [onboardingReady,        setOnboardingReady]        = useState(false);
  const [onboarding,             setOnboarding]             = useState(null);
  const [packAttemptWithOriginalUuid, setPackAttemptWithOriginalUuid] = useState(false);
  const [validationResetKey,     setValidationResetKey]     = useState(0);
  const [currentView,            setCurrentView]            = useState('projects');
  const [eulaAccepted,           setEulaAccepted]           = useState(true);
  const [updateModalOpen,        setUpdateModalOpen]        = useState(false);
  const [dotnetInstallModalOpen, setDotnetInstallModalOpen] = useState(false);
  const [dotnetModalCompleted,   setDotnetModalCompleted]   = useState(false);
  const [pendingEulaLang,        setPendingEulaLang]        = useState(null);
  const [showDotNetModal,        setShowDotNetModal]        = useState(false);

  const handleOpenSettings = useCallback((tab = null) => {
    setSettingsDefaultTab(typeof tab === 'string' ? tab : null);
    setIsSettingsOpen(true);
  }, []);

  const handleAcceptEula = useCallback(async (lang) => {
    setEulaAccepted(true);
    setPendingEulaLang(lang);
    setOnboarding((prev) => (prev ? { ...prev, eulaAccepted: true } : { eulaAccepted: true }));
    try { await onboardingApi.update({ eulaAccepted: true }); } catch { /* ignore */ }
    try {
      const res = await onboardingApi.get();
      if (res?.success && !res.data.welcomeShown) {
        setIsFirstLaunch(true);
        setIsHomeOverlayOpen(true);
      }
    } catch { /* ignore */ }
  }, []);

  const handleDotNetInstall = useCallback(async (onProgress) => {
    const unsubscribe = dotnetApi.onInstallProgress(onProgress);
    try {
      await dotnetApi.install();
    } finally {
      unsubscribe();
    }
    setDotnetModalCompleted(true);
  }, []);

  const handleDotNetLater = useCallback(async () => {
    setDotnetInstallModalOpen(false);
    try { await onboardingApi.update({ dotnetInstallLater: true }); } catch { /* ignore */ }
    setDotnetModalCompleted(true);
  }, []);

  const handleNavigateToProjects = useCallback(() => {
    setCurrentView('projects');
    setIsHomeOverlayOpen(false);
    if (!isFirstLaunch) return;
    setIsFirstLaunch(false);
    setOnboarding((prev) => (prev ? { ...prev, welcomeShown: true } : prev));
    onboardingApi.update({ welcomeShown: true });
  }, [isFirstLaunch]);

  const handleOpenHomeOverlay = useCallback(() => setIsHomeOverlayOpen(true), []);
  const handleResetValidation = useCallback(() => setValidationResetKey((prev) => prev + 1), []);

  const toggleProfile = useCallback(() => {
    setIsProfileOpen((prev) => !prev);
    if (isDictionaryOpen) setIsDictionaryOpen(false);
  }, [isDictionaryOpen]);

  const toggleDictionary = useCallback(() => {
    setIsDictionaryOpen((prev) => !prev);
    if (isProfileOpen) setIsProfileOpen(false);
  }, [isProfileOpen]);

  // Onboarding tutorial reset is queued and flushed when settings dialog closes,
  // so the user re-enters tutorials only after they've finished tweaking
  // settings (avoids tutorials popping up over the settings dialog itself).
  const pendingTutorialResetRef = useRef(null);

  const handleResetTutorial = useCallback(async () => {
    const patch = {
      tutorialStartPage:    false,
      tutorialEditor:       false,
      tutorialAutoTranslate: false,
      tutorialDictionary:   false,
    };
    try { await onboardingApi.update(patch); } catch { /* ignore */ }
    pendingTutorialResetRef.current = patch;
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
    setSettingsDefaultTab(null);
    if (pendingTutorialResetRef.current) {
      const patch = pendingTutorialResetRef.current;
      pendingTutorialResetRef.current = null;
      setOnboarding((prev) => (prev ? { ...prev, ...patch } : prev));
    }
  }, []);

  const handleCloseProjectNav = useCallback(() => {
    setCurrentView('projects');
    setIsProfileOpen(false);
    setIsDictionaryOpen(false);
  }, []);

  // Bootstrap onboarding on mount.
  useEffect(() => {
    (async () => {
      const res = await onboardingApi.get();
      if (res?.success) {
        setOnboarding(res.data);
        setEulaAccepted(!!res.data.eulaAccepted);
        if (res.data.eulaAccepted && !res.data.welcomeShown) {
          setIsFirstLaunch(true);
          setIsHomeOverlayOpen(true);
        }
        if (res.data.welcomeShown) setDotnetModalCompleted(true);
      }
      setOnboardingReady(true);
    })();
  }, []);

  // For the trigger logic and unsaved-changes confirmation we expose:
  //   • current panels open / view
  //   • setters needed by App.jsx and lazy-page wrappers
  //   • imperative handlers (open settings, dismiss eula, ...)
  return {
    // Visibility flags
    isSettingsOpen,
    settingsDefaultTab,
    isDictionaryOpen,
    isProfileOpen,
    isHomeOverlayOpen,
    isFirstLaunch,
    onboardingReady,
    onboarding,
    setOnboarding,
    packAttemptWithOriginalUuid,
    setPackAttemptWithOriginalUuid,
    validationResetKey,
    currentView,
    eulaAccepted,
    updateModalOpen,
    setUpdateModalOpen,
    dotnetInstallModalOpen,
    setDotnetInstallModalOpen,
    dotnetModalCompleted,
    pendingEulaLang,
    setPendingEulaLang,
    showDotNetModal,
    setShowDotNetModal,
    setIsDictionaryOpen,
    setIsProfileOpen,
    // Imperative handlers
    handleOpenSettings,
    handleAcceptEula,
    handleDotNetInstall,
    handleDotNetLater,
    handleNavigateToProjects,
    handleOpenHomeOverlay,
    handleResetValidation,
    toggleDictionary,
    toggleProfile,
    handleResetTutorial,
    handleSettingsClose,
    handleCloseProjectNav,
  };
}
