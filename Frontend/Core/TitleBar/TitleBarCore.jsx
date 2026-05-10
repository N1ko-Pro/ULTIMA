import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, ArrowUp } from 'lucide-react';
import { WindowControls } from '@Core/TitleBar/helpers/TitleBarButtons';
import logoSrc from '@Assets/logo.png';
import NotifyCenter from '@Shared/notifications/notifyCenter';
import UnsavedChangesModal from '@UI/Modal/UnsavedChangesModal';
import { useLocale } from '@Locales/LocaleProvider';
import * as appWindow from '@API/appWindow';

// ─── TitleBarCore ───────────────────────────────────────────────────────────
// Frameless-window title bar. Owns:
//   • drag region (so the user can move the window)
//   • breadcrumb + project name
//   • notification bell
//   • minimize/maximize/close
//   • unsaved-changes confirm gate before close/exit-project
//
// This component is part of the shared chrome, not the editor surface.

const INITIAL_CONFIRM = { isOpen: false, type: null };

function TitleBarCore({
  hasUnsavedChanges,
  onSaveProject,
  onCloseProject,
  projectDisplayName,
  onNavigateToProjects,
  updaterState,
  showBell,
  showUpdaterUI,
  onShowUpdateModal,
  onAtpModalClick,
  showBranding = true,
}) {
  const t = useLocale();
  const [confirmModal, setConfirmModal] = useState(INITIAL_CONFIRM);
  const [pillFlashing, setPillFlashing] = useState(false);
  const pillFlashTimer = useRef(null);

  const handleUpdatePillClick = useCallback(() => {
    clearTimeout(pillFlashTimer.current);
    setPillFlashing(true);
    pillFlashTimer.current = setTimeout(() => setPillFlashing(false), 2500);
  }, []);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.maximize();

  const executeClose = useCallback((type) => {
    if (type === 'app') {
      appWindow.close();
    } else if (type === 'project') {
      onNavigateToProjects?.();
      onCloseProject?.();
    }
    setConfirmModal(INITIAL_CONFIRM);
  }, [onNavigateToProjects, onCloseProject]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmModal({ isOpen: true, type: 'app' });
      return;
    }
    executeClose('app');
  }, [hasUnsavedChanges, executeClose]);

  const handleBreadcrumbClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmModal({ isOpen: true, type: 'project' });
      return;
    }
    if (onNavigateToProjects) {
      onNavigateToProjects();
    } else {
      onCloseProject?.();
    }
  }, [hasUnsavedChanges, onNavigateToProjects, onCloseProject]);

  // Native OS close button — route through our unsaved-changes gate.
  useEffect(() => {
    const unsubscribe = appWindow.onOsClose(handleClose);
    return () => { unsubscribe(); };
  }, [handleClose]);

  return (
    <div
      className="h-9 bg-surface-0/90 backdrop-blur-xl flex items-center select-none shrink-0 border-b border-white/[0.06] relative z-[200]"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-1 shrink-0 pl-3" style={{ WebkitAppRegion: 'no-drag' }}>
        {projectDisplayName && (
          <div className="flex items-center gap-1.5 ml-1">
            <button
              type="button"
              onClick={handleBreadcrumbClick}
              className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.15em] leading-none hover:text-zinc-400 transition-colors duration-200"
            >
              {t.titleBar.projects}
            </button>
            <ChevronRight className="w-3 h-3 text-zinc-700" />
            <span className="text-[11px] font-semibold text-zinc-400 leading-none max-w-[200px] truncate">
              {projectDisplayName}
            </span>
            {hasUnsavedChanges && (
              <div className="w-1.5 h-1.5 bg-red-400 rounded-full shadow-[0_0_8px_rgba(248,113,113,0.5)] animate-pulse" />
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {showBranding && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
          <img src={logoSrc} alt="ULTIMA" className="w-10 h-10 object-contain opacity-100" />
          <span className="text-[14px] font-bold text-zinc-300 tracking-widest uppercase leading-none">ULTIMA</span>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0 justify-end" style={{ WebkitAppRegion: 'no-drag' }}>
        {updaterState?.status === 'download-progress' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <div className="w-3 h-3 rounded-full border-2 border-indigo-400/30 border-t-indigo-300/80 animate-spin shrink-0" />
            <span className="text-[11px] font-medium text-zinc-400 leading-none">
              {updaterState.version
                ? t.updates.titleBarDownloading(updaterState.version)
                : t.updates.downloading}
            </span>
          </div>
        )}
        {showUpdaterUI && updaterState?.status === 'downloaded' && (
          <button
            type="button"
            onClick={onShowUpdateModal}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border transition-all duration-300 cursor-pointer ${
              pillFlashing
                ? 'bg-indigo-500/[0.4] border-indigo-300/70 shadow-[0_0_20px_rgba(139,92,246,0.75),0_0_6px_rgba(139,92,246,0.4)] animate-pulse'
                : 'bg-indigo-500/[0.12] border-indigo-400/30 hover:bg-indigo-500/[0.22] hover:border-indigo-400/50'
            }`}
          >
            <ArrowUp className="w-3 h-3 text-indigo-300" />
            <span className="text-[11px] font-semibold text-indigo-200 leading-none">
              {t.updates.updateBtn}
            </span>
          </button>
        )}
        {showBell && <NotifyCenter onUpdatePillClick={handleUpdatePillClick} onAtpModalClick={onAtpModalClick} />}
      </div>

      <WindowControls onMinimize={handleMinimize} onMaximize={handleMaximize} onClose={handleClose} />

      <UnsavedChangesModal
        isOpen={confirmModal.isOpen}
        type={confirmModal.type}
        onClose={() => setConfirmModal(INITIAL_CONFIRM)}
        onDiscardAndClose={executeClose}
        onSaveAndClose={async (type) => {
          if (onSaveProject) await onSaveProject();
          executeClose(type);
        }}
      />
    </div>
  );
}

export default React.memo(TitleBarCore);
