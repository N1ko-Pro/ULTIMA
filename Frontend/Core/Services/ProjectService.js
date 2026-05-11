import { useState, useCallback, useRef } from 'react';
import { notify } from '@Shared/notifications/notifyCore';
import { useKeyboardShortcuts } from '@Utils/Keyboard/useKeyboardShortcuts';
import { useLocale } from '@Locales/LocaleProvider';
import {
  mapStringDictionaryToRows,
  createEmptyTranslations,
  resolvePersistedProjectName,
} from '@Shared/helpers/projectShape';
import { buildTranslationsFingerprint } from '@Shared/helpers/fingerprints';
import { isAvailable } from '@API/client';
import * as projectsApi from '@API/projects';
import * as filesApi from '@API/files';
import * as pakApi from '@API/pak';

// ─── Project service ────────────────────────────────────────────────────────
// The biggest stateful service in the app. Owns:
//   • the loaded mod (originalStrings, modInfo)
//   • the user translations and their dirty state (fingerprint comparison)
//   • the project init modal flow (promise-resolver pattern)
//   • save / load / repack actions
//
const DOTNET_ERROR_MARKERS = ['.NET', 'dotnet', 'hostfxr.dll'];
const isDotNetError = (errorMessage) =>
  typeof errorMessage === 'string' && DOTNET_ERROR_MARKERS.some((m) => errorMessage.includes(m));

async function fetchProjectNames() {
  try {
    const res = await projectsApi.loadAll();
    return (res?.projects || []).map((p) => p.name);
  } catch {
    return [];
  }
}

export function useProjectManager() {
  const t = useLocale();

  // ── Mod & translation state ──────────────────────────────────────────────
  const [originalStrings,    setOriginalStrings]    = useState(null);
  const [translations,       _setTranslations]      = useState({});
  const [modInfo,            setModInfo]            = useState(null);
  const [currentProjectId,   setCurrentProjectId]   = useState(null);
  const [originalPakPath,    setOriginalPakPath]    = useState(null);
  const [workspaceDirName,   setWorkspaceDirName]   = useState(null);
  const [hasUnsavedChanges,  setHasUnsavedChanges]  = useState(false);
  const [isLoadingPak,       setIsLoadingPak]       = useState(false);
  const [isLoadingProject,   setIsLoadingProject]   = useState(false);
  const [showDotNetModal,    setShowDotNetModal]    = useState(false);
  const [projectLoadCounter, setProjectLoadCounter] = useState(0);

  const lastSavedFingerprintRef = useRef(buildTranslationsFingerprint({}));

  // Promise-resolver pattern for the init modal. App.jsx renders the modal
  // and forwards confirm/cancel back into this service.
  const [initModal, setInitModal] = useState(null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const commitSavedSnapshot = useCallback((savedTranslations) => {
    lastSavedFingerprintRef.current = buildTranslationsFingerprint(savedTranslations);
    setHasUnsavedChanges(false);
  }, []);

  const setTranslations = useCallback((newTrans) => {
    _setTranslations((previous) => {
      const next = typeof newTrans === 'function' ? newTrans(previous) : newTrans || {};
      const nextFingerprint = buildTranslationsFingerprint(next);
      setHasUnsavedChanges(nextFingerprint !== lastSavedFingerprintRef.current);
      return next;
    });
  }, []);

  const resetState = useCallback(() => {
    setOriginalStrings(null);
    _setTranslations({});
    setModInfo(null);
    setCurrentProjectId(null);
    setOriginalPakPath(null);
    setWorkspaceDirName(null);
    commitSavedSnapshot({});
  }, [commitSavedSnapshot]);

  // ── Init modal API ───────────────────────────────────────────────────────
  const confirmInitModal = useCallback((values) => {
    initModal?.resolve(values);
    setInitModal(null);
  }, [initModal]);

  const cancelInitModal = useCallback(() => {
    initModal?.reject(new Error('CANCELLED'));
    setInitModal(null);
  }, [initModal]);

  const requestInitInfo = useCallback((defaultModName, existingProjectNames) => {
    return new Promise((resolve, reject) => {
      setInitModal({ defaultModName, existingNames: existingProjectNames, resolve, reject });
    });
  }, []);

  // ── Open .pak / .zip / .rar ─────────────────────────────────────────────
  const handleOpenFile = useCallback(async (filePath, ext) => {
    if (!isAvailable()) return;

    setIsLoadingPak(true);
    let result;
    try {
      if (ext === '.pak') {
        result = await filesApi.unpackPakFile(filePath);
      } else if (ext === '.zip' || ext === '.rar') {
        result = await filesApi.unpackArchiveFile(filePath, ext);
      } else {
        notify.error(t.projects.unsupportedExt, t.projects.unsupportedExtDesc(ext));
        return;
      }
    } finally {
      setIsLoadingPak(false);
    }

    if (!result?.success || !result.data) {
      if (result?.error) {
        if (isDotNetError(result.error)) {
          setShowDotNetModal(true);
          return;
        }
        notify.error(t.common.error, result.error);
      }
      return;
    }

    const { strings, modInfo: unpackedModInfo } = result.data;
    const defaultModName = unpackedModInfo?.name ? `${unpackedModInfo.name}_RU` : 'BG3 Mod Translation';

    const existingProjectNames = await fetchProjectNames();

    let userInput;
    try {
      userInput = await requestInitInfo(defaultModName, existingProjectNames);
    } catch {
      return; // user cancelled
    }

    setIsLoadingPak(true);
    try {
      const dataArray = mapStringDictionaryToRows(strings);
      const initTrans = {
        ...createEmptyTranslations(dataArray),
        name:   userInput.modName,
        author: userInput.author,
      };

      setOriginalPakPath(result.data.originalPakPath);
      setCurrentProjectId(null);
      setOriginalStrings(dataArray);
      setModInfo(unpackedModInfo);
      setWorkspaceDirName(result.data.workspaceDirName || null);
      _setTranslations(initTrans);
      setHasUnsavedChanges(false);

      const projectData = {
        id:                null,
        name:              userInput.modName,
        author:            userInput.author,
        pakPath:           result.data.originalPakPath,
        workspaceDirName:  result.data.workspaceDirName,
        translations:      initTrans,
      };

      const res = await projectsApi.save(projectData);
      if (res?.success) {
        setCurrentProjectId(res.project.id);
        commitSavedSnapshot(initTrans);
        notify.success(t.projects.created, t.projects.createdDesc(userInput.modName));
      }
    } finally {
      setIsLoadingPak(false);
    }
  }, [commitSavedSnapshot, requestInitInfo, t.projects, t.common.error]);

  const handleSelectFile = useCallback(async () => {
    if (!isAvailable()) return;
    const selected = await filesApi.selectFile();
    if (!selected?.success) return;
    await handleOpenFile(selected.filePath, selected.ext);
  }, [handleOpenFile]);

  // ── Save / load / repack ─────────────────────────────────────────────────
  const handleSaveProject = useCallback(async () => {
    if (!originalStrings || !isAvailable() || !originalPakPath) return;

    const projectData = {
      id:               currentProjectId,
      name:             resolvePersistedProjectName({ translations, modInfo }),
      author:           translations.author,
      pakPath:          originalPakPath,
      workspaceDirName: workspaceDirName || undefined,
      translations,
    };

    const res = await projectsApi.save(projectData);
    if (res?.success) {
      setCurrentProjectId(res.project.id);
      commitSavedSnapshot(translations);
      notify.success(t.projects.saved, t.projects.savedDesc);
    } else {
      notify.error(t.common.error, t.projects.saveErrorDesc);
    }
  }, [originalStrings, originalPakPath, currentProjectId, translations, modInfo, workspaceDirName, commitSavedSnapshot, t.projects, t.common.error]);

  const handleLoadProject = useCallback(async (projectSummary) => {
    if (!isAvailable()) return;
    setIsLoadingProject(true);
    try {
      const res = await projectsApi.load(projectSummary.id);
      if (res?.success && res.data) {
        const { strings, modInfo: loadedModInfo, originalPakPath: loadedPakPath, translations: savedTrans } = res.data;
        const dataArray = mapStringDictionaryToRows(strings);
        const hydratedTranslations = {
          ...createEmptyTranslations(dataArray),
          ...(savedTrans || {}),
        };
        setOriginalStrings(dataArray);
        setModInfo(loadedModInfo);
        _setTranslations(hydratedTranslations);
        setOriginalPakPath(loadedPakPath);
        setWorkspaceDirName(res.data.workspaceDirName || null);
        setCurrentProjectId(res.project?.id || projectSummary.id);
        commitSavedSnapshot(hydratedTranslations);
        setProjectLoadCounter((prev) => prev + 1);
        notify.success(t.projects.loaded, t.projects.loadedDesc);
      } else {
        notify.error(t.common.error, res?.error || t.projects.saveErrorDesc);
      }
    } finally {
      setIsLoadingProject(false);
    }
  }, [commitSavedSnapshot, t.projects, t.common.error]);

  const handleSavePak = useCallback(async () => {
    if (!isAvailable()) return;
    const result = await pakApi.repack(translations, modInfo?.name);
    if (result?.success) {
      notify.success(t.projects.packed, t.projects.packedDesc(result.filePath));
    } else if (result?.error) {
      notify.error(t.projects.packError, result.error);
    }
  }, [translations, modInfo?.name, t.projects]);

  // Global Ctrl+S — save current project.
  useKeyboardShortcuts({ onSave: handleSaveProject });

  return {
    originalStrings,
    translations,
    setTranslations,
    modInfo,
    hasUnsavedChanges,
    isLoadingPak,
    isLoadingProject,
    handleSelectFile,
    handleOpenFile,
    handleSaveProject,
    handleCloseProject: resetState,
    handleLoadProject,
    handleSavePak,
    projectLoadCounter,
    initModal,
    confirmInitModal,
    cancelInitModal,
    showDotNetModal,
    setShowDotNetModal,
  };
}
