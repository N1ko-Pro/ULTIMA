import React, { useState, useCallback } from 'react';
import { BookOpen, FolderOpen, Save, LogOut } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';
import PackModal from '@UI/Modal/PackModal';
import UnsavedChangesModal from '@UI/Modal/UnsavedChangesModal';
import AtpAccessModal from '@UI/Modal/AtpAccessModal';
import { PackButton, SettingsButton, XmlActionGroup, ToolsGroup } from './TopBarButtons';
import * as appWindow from '@API/appWindow';

// ─── Editor top bar ─────────────────────────────────────────────────────────
// Horizontal toolbar at the top of the editor view: tools group (dictionary,
// folder, save, exit) on the left, XML import/export + Pack + Settings on
// the right. Hosts the "unsaved changes" and "pack validation failed" modals.

function TopBar({
  onSettingsOpen,
  onSavePak,
  onExportXml,
  onImportXml,
  hasOriginalUuid,
  onValidatePackBeforeOpen,
  isDictionaryOpen,
  onToggleDictionary,
  modData,
  onSaveProject,
  onCloseProject,
  hasUnsavedChanges,
  onPackAttemptWithOriginalUuid,
}) {
  const [isPackModalOpen,       setIsPackModalOpen]       = useState(false);
  const [isCloseConfirmOpen,    setIsCloseConfirmOpen]    = useState(false);
  const [isDictAccessModalOpen, setIsDictAccessModalOpen] = useState(false);
  const [packWarnings,          setPackWarnings]          = useState(null);
  const { canUseDictionary } = useAuth();
  const t = useLocale();

  const handlePackClick = () => {
    if (hasOriginalUuid) {
      onPackAttemptWithOriginalUuid?.();
      notify.warning(t.editor.uuidWarning, t.editor.uuidWarningDesc);
      return;
    }
    const result = onValidatePackBeforeOpen?.() ?? null;
    setPackWarnings(result);
    setIsPackModalOpen(true);
  };

  const confirmPack = useCallback(() => {
    setIsPackModalOpen(false);
    if (onSavePak) onSavePak();
  }, [onSavePak]);

  const handleDictionaryClick = useCallback(() => {
    if (!canUseDictionary) {
      setIsDictAccessModalOpen(true);
      return;
    }
    onToggleDictionary();
  }, [canUseDictionary, onToggleDictionary]);

  const handleExitClick = () => {
    if (hasUnsavedChanges) setIsCloseConfirmOpen(true);
    else onCloseProject();
  };

  return (
    <>
      <header
        className={`h-20 border-b border-white/[0.06] bg-surface-1/95 backdrop-blur-2xl flex items-center justify-between pr-8 shrink-0 relative z-30 transition-[padding-left] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isDictionaryOpen ? 'pl-0' : 'pl-8'}`}
        data-tutorial="editor-toolbar"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-surface-2/40 to-surface-2/20" />
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <ToolsGroup
            className={`transition-[margin] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isDictionaryOpen ? '-ml-4' : ''}`}
            data-tutorial="editor-tools"
          >
            <div
              data-tutorial="editor-btn-dictionary"
              className={`transition-all origin-left shrink-0 ${
                isDictionaryOpen
                  ? 'scale-x-0 scale-y-50 opacity-0 pointer-events-none -translate-x-3'
                  : 'scale-100 opacity-100 translate-x-0'
              }`}
              style={{ transitionDuration: '400ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <button
                type="button"
                onClick={handleDictionaryClick}
                title={canUseDictionary ? t.editor.dictionaryTitle : t.editor.dictionaryGuest}
                className={`group relative h-[42px] w-[42px] flex items-center justify-center rounded-xl border bg-surface-2 border-white/[0.08] transition-all duration-200 overflow-hidden active:scale-[0.95] ${
                  canUseDictionary
                    ? 'text-zinc-400 hover:text-amber-300 hover:border-amber-400/20 hover:bg-amber-400/[0.06] hover:shadow-[0_0_16px_rgba(251,191,36,0.1)]'
                    : 'text-zinc-600 hover:text-zinc-400 hover:border-white/[0.12] hover:bg-white/[0.03]'
                }`}
              >
                <span className="absolute inset-0 bg-gradient-to-br from-amber-400/0 via-amber-400/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <BookOpen className="relative z-10 w-[18px] h-[18px] transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" />
              </button>
            </div>

            {modData && (
              <button
                type="button"
                onClick={() => appWindow.openModFolder()}
                title={t.editor.openModFolder}
                className="group relative h-[42px] w-[42px] flex items-center justify-center rounded-xl border bg-surface-2 border-white/[0.08] text-zinc-400 hover:text-sky-300 hover:border-sky-400/20 hover:bg-sky-400/[0.06] hover:shadow-[0_0_16px_rgba(56,189,248,0.1)] active:scale-[0.95] transition-all duration-200 overflow-hidden shrink-0"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-sky-400/0 via-sky-400/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <FolderOpen className="relative z-10 w-[18px] h-[18px] transition-all duration-200 group-hover:scale-110 group-hover:translate-y-px" />
              </button>
            )}

            {modData && <div className="w-px h-5 bg-white/[0.08] mx-1 shrink-0" />}

            {modData && onSaveProject && (
              <button
                type="button"
                onClick={onSaveProject}
                title={t.editor.saveProject}
                className="group relative h-[42px] w-[42px] flex items-center justify-center rounded-xl border bg-surface-2 border-white/[0.08] text-zinc-400 hover:text-emerald-300 hover:border-emerald-400/20 hover:bg-emerald-400/[0.06] hover:shadow-[0_0_16px_rgba(52,211,153,0.1)] active:scale-[0.95] transition-all duration-200 overflow-hidden shrink-0"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-emerald-400/0 via-emerald-400/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <Save className="relative z-10 w-[18px] h-[18px] transition-all duration-200 group-hover:scale-105 group-hover:translate-y-px" />
              </button>
            )}

            {modData && onCloseProject && (
              <button
                type="button"
                onClick={handleExitClick}
                title={t.editor.exitProject}
                className="group relative h-[42px] w-[42px] flex items-center justify-center rounded-xl border bg-surface-2 border-white/[0.08] text-zinc-400 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/[0.06] hover:shadow-[0_0_16px_rgba(248,113,113,0.1)] active:scale-[0.95] transition-all duration-200 overflow-hidden shrink-0"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-red-500/0 via-red-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <LogOut className="relative z-10 w-[18px] h-[18px] transition-all duration-200 group-hover:scale-105 group-hover:translate-x-0.5" />
              </button>
            )}
          </ToolsGroup>
        </div>

        <div className="flex items-center gap-3 shrink-0" data-tutorial="editor-toolbar-right">
          <div data-tutorial="editor-xml">
            <XmlActionGroup onImport={onImportXml} onExport={onExportXml} />
          </div>

          <div className="w-px h-8 bg-white/10 mx-2" />

          <div data-tutorial="editor-pack">
            <PackButton onPack={handlePackClick} />
          </div>

          <div className="w-px h-8 bg-white/10 mx-2" />

          <div data-tutorial="editor-settings-btn">
            <SettingsButton onSettings={onSettingsOpen} />
          </div>
        </div>
      </header>

      <PackModal
        isOpen={isPackModalOpen}
        onClose={() => setIsPackModalOpen(false)}
        onPack={confirmPack}
        warnings={packWarnings}
      />
      <UnsavedChangesModal
        isOpen={isCloseConfirmOpen}
        type="project"
        onClose={() => setIsCloseConfirmOpen(false)}
        onDiscardAndClose={() => { setIsCloseConfirmOpen(false); onCloseProject(); }}
        onSaveAndClose={async () => {
          setIsCloseConfirmOpen(false);
          if (onSaveProject) await onSaveProject();
          onCloseProject();
        }}
      />
      <AtpAccessModal
        isOpen={isDictAccessModalOpen}
        onClose={() => setIsDictAccessModalOpen(false)}
      />
    </>
  );
}

export default React.memo(TopBar);
