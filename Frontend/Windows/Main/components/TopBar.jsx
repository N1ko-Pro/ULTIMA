import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BookOpen, FolderOpen, Save, LogOut } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';
import PackModal from '@UI/Modal/PackModal';
import UnsavedChangesModal from '@UI/Modal/UnsavedChangesModal';
import AtpAccessModal from '@UI/Modal/AtpAccessModal';
import TargetLanguagePill from './TargetLanguagePill';
import { PackButton, SettingsButton, XmlActionGroup, ToolsGroup, IconButton } from './TopBarButtons';
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
  onOpenXmlFolder,
  hasOriginalUuid,
  onValidatePackBeforeOpen,
  isDictionaryOpen,
  onToggleDictionary,
  modData,
  onSaveProject,
  onCloseProject,
  hasUnsavedChanges,
  onPackAttemptWithOriginalUuid,
  targetLanguage,
  onChangeTargetLanguage,
  gameId,
  hasDictionary = true,
}) {
  const [isPackModalOpen,       setIsPackModalOpen]       = useState(false);
  const [isCloseConfirmOpen,    setIsCloseConfirmOpen]    = useState(false);
  const [isDictAccessModalOpen, setIsDictAccessModalOpen] = useState(false);
  const [packWarnings,          setPackWarnings]          = useState(null);
  const { canUseDictionary } = useAuth();
  const t = useLocale();

  // ── Adaptive layout ───────────────────────────────────────────────────────
  // The toolbar can't always fit every labelled button — the editor column
  // narrows with the window and shrinks further when a side panel opens. Rather
  // than dropping buttons (they're all important), we collapse them to icons
  // progressively, in reverse priority order, so the primary action keeps its
  // label the longest:
  //   level 0 — everything labelled
  //   level 1 — XML import/export → icons
  //   level 2 — + target-language pill → flag only
  //   level 3 — + "Pack" → icon (most compact; every button still visible)
  // Driven by the header's real border-box width with per-step hysteresis so
  // dragging near a breakpoint doesn't flicker.
  const headerRef = useRef(null);
  const levelRef  = useRef(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    // Minimum width to STAY at each level (0,1,2). Below it we drop one step of
    // detail; detail is only restored once we clear the boundary by HYST.
    const MINS = [1000, 858, 770];
    const HYST = 40;

    const resolve = (width) => {
      let lvl = levelRef.current;
      while (lvl < 3 && width < MINS[lvl]) lvl += 1;
      while (lvl > 0 && width >= MINS[lvl - 1] + HYST) lvl -= 1;
      return lvl;
    };

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth;
      const next = resolve(width);
      if (next !== levelRef.current) { levelRef.current = next; setLevel(next); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xmlCompact  = level >= 1;
  const langCompact = level >= 2;
  const packCompact = level >= 3;

  const gapCls = level === 0 ? 'gap-3' : level === 1 ? 'gap-2' : 'gap-1.5';
  const prCls  = level === 0 ? 'pr-8' : level === 1 ? 'pr-5' : 'pr-3';
  const plCls  = isDictionaryOpen ? 'pl-0' : (level === 0 ? 'pl-8' : level === 1 ? 'pl-5' : 'pl-3');
  const divider = `w-px h-8 bg-white/10 shrink-0 ${level === 0 ? 'mx-2' : 'mx-1'}`;

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

  const confirmPack = useCallback((mode, target) => {
    setIsPackModalOpen(false);
    if (onSavePak) onSavePak(mode, target);
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
        ref={headerRef}
        className={`h-20 border-b border-white/[0.06] bg-surface-1/95 backdrop-blur-2xl flex items-center justify-between shrink-0 relative z-30 transition-[padding] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${prCls} ${plCls}`}
        data-tutorial="editor-toolbar"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-surface-2/40 to-surface-2/20" />
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <ToolsGroup
            className={`transition-[margin] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${isDictionaryOpen ? '-ml-4' : ''}`}
            data-tutorial="editor-tools"
          >
            {hasDictionary && (
            <div
              data-tutorial="editor-btn-dictionary"
              className={`transition-all origin-left shrink-0 ${
                isDictionaryOpen
                  ? 'scale-x-0 scale-y-50 opacity-0 pointer-events-none -translate-x-3'
                  : 'scale-100 opacity-100 translate-x-0'
              }`}
              style={{ transitionDuration: '400ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <IconButton
                icon={BookOpen}
                onClick={handleDictionaryClick}
                title={canUseDictionary ? t.editor.dictionaryTitle : t.editor.dictionaryGuest}
                accent={canUseDictionary ? 'amber' : 'muted'}
                idleClass={canUseDictionary ? 'text-zinc-400' : 'text-zinc-600'}
                iconClass="w-[18px] h-[18px] transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6"
              />
            </div>
            )}

            {modData && (
              <IconButton
                icon={FolderOpen}
                onClick={() => appWindow.openModFolder(gameId)}
                title={t.editor.openModFolder}
                accent="sky"
                iconClass="w-[18px] h-[18px] transition-all duration-200 group-hover:scale-110 group-hover:translate-y-px"
              />
            )}

            {modData && <div className="w-px h-5 bg-white/[0.08] mx-1 shrink-0" />}

            {modData && onSaveProject && (
              <IconButton
                icon={Save}
                onClick={onSaveProject}
                title={t.editor.saveProject}
                accent="emerald"
                iconClass="w-[18px] h-[18px] transition-all duration-200 group-hover:scale-105 group-hover:translate-y-px"
              />
            )}

            {modData && onCloseProject && (
              <IconButton
                icon={LogOut}
                onClick={handleExitClick}
                title={t.editor.exitProject}
                accent="red"
                iconClass="w-[18px] h-[18px] transition-all duration-200 group-hover:scale-105 group-hover:translate-x-0.5"
              />
            )}
          </ToolsGroup>
        </div>

        <div className={`flex items-center shrink-0 ${gapCls}`} data-tutorial="editor-toolbar-right">
          <div data-tutorial="editor-xml">
            <XmlActionGroup onImport={onImportXml} onExport={onExportXml} onOpenFolder={onOpenXmlFolder} compact={xmlCompact} />
          </div>

          <div className={divider} />

          {targetLanguage && onChangeTargetLanguage && (
            <>
              <div data-tutorial="editor-target-language">
                <TargetLanguagePill
                  value={targetLanguage}
                  onChange={onChangeTargetLanguage}
                  compact={langCompact}
                />
              </div>
              <div className={divider} />
            </>
          )}

          <div data-tutorial="editor-pack">
            <PackButton onPack={handlePackClick} compact={packCompact} />
          </div>

          <div className={divider} />

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
        gameId={gameId}
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
