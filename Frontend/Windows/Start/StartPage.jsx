import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Info } from 'lucide-react';
import { notify } from '@Shared/notifications/notifyCore';
import { useLocale } from '@Locales/LocaleProvider';
import TutorialStartPage from '@UI/Tutorial/TutorialStartPage';
import { DeleteConfirmModal } from '@UI/Modal/DeleteConfirmModal';
import { ProjectEditModal } from '@UI/Modal/ProjectEditModal';
import { PageBackground } from './components/PageBackground';
import { HeroSection } from './components/HeroSection';
import { DropZone } from './components/DropZone';
import { ProjectsSeparator } from './components/ProjectsSeparator';
import { LoadingState } from './components/LoadingState';
import { EmptyState } from './components/EmptyState';
import { ProjectCard } from './components/ProjectCard';
import { Footer } from './components/Footer';
import { StartProfilePanel } from './components/StartProfilePanel';
import { isAvailable } from '@API/client';
import * as projectsApi from '@API/projects';
import * as onboardingApi from '@API/onboarding';

// ─── StartPage ──────────────────────────────────────────────────────────────
// Project workspace. Hosts:
//   • Drop zone for new mod files
//   • Recent-projects grid (edit / delete per card)
//   • Top-left profile drawer
//   • Top-right info + settings buttons
//   • First-visit tutorial
//
// Most visual components live in `./components/`; this file owns only the
// stateful orchestration.

const EXAMPLE_PROJECT = {
  id: '__tutorial_example__',
  name: 'Example Mod',
  author: 'Tutorial',
  pakPath: 'ExampleMod.pak',
  lastModified: Date.now(),
  translatedCount: 12,
  totalCount: 48,
};

const TUTORIAL_START_DELAY_MS = 600;

/**
 * @param {{
 *   onSelectFile: () => void,
 *   onFileDrop:   (filePath: string, ext: string) => void,
 *   onLoadProject: (project: any) => void,
 *   onSettingsOpen?: () => void,
 *   onOpenHome?:     () => void,
 *   onboarding: any,
 *   onOnboardingUpdate: (next: any) => void,
 *   onTutorialComplete?: () => void,
 * }} props
 */
export default function StartPage({
  onSelectFile,
  onFileDrop,
  onLoadProject,
  onSettingsOpen,
  onOpenHome,
  onboarding,
  onOnboardingUpdate,
  onTutorialComplete,
}) {
  const t = useLocale();
  const [projects,          setProjects]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [deleteTarget,      setDeleteTarget]      = useState(null);
  const [editTarget,        setEditTarget]        = useState(null);
  const [showTutorial,      setShowTutorial]      = useState(false);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [exampleProject,    setExampleProject]    = useState(null);

  // ── Project list ────────────────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    if (!isAvailable()) {
      setLoading(false);
      return;
    }
    const res = await projectsApi.loadAll();
    if (res?.success) setProjects(res.projects);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tutorial ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !onboarding || onboarding.tutorialStartPage || !onboarding.welcomeShown) return undefined;
    const timer = setTimeout(() => setShowTutorial(true), TUTORIAL_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading, onboarding]);

  /**
   * Fires before each tutorial step switches. Returns a `{ track }` config
   * to keep the spotlight following an animating element.
   */
  const handleBeforeStep = useCallback((index, prevIndex) => {
    const goingForward = prevIndex === null || index > prevIndex;

    if (index === 1) {
      if (projects.length === 0 && !exampleProject) {
        setExampleProject(EXAMPLE_PROJECT);
        return { track: 400 };
      }
      if (!goingForward) {
        setIsProfileExpanded(false);
        return { track: 550 };
      }
      return 0;
    }
    if (index === 2) {
      setIsProfileExpanded(true);
      return 0;
    }
    if (index === 0) {
      setExampleProject(null);
      setIsProfileExpanded(false);
      return 0;
    }
    setIsProfileExpanded(false);
    if (!goingForward && index < 2) setExampleProject(null);
    return 0;
  }, [projects.length, exampleProject]);

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false);
    setExampleProject(null);
    setIsProfileExpanded(false);
    onboardingApi.update({ tutorialStartPage: true });
    onOnboardingUpdate?.((prev) => ({ ...prev, tutorialStartPage: true }));
    onTutorialComplete?.();
  }, [onOnboardingUpdate, onTutorialComplete]);

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDeleteRequest = (event, project) => {
    event.stopPropagation();
    setDeleteTarget(project);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !isAvailable()) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    const res = await projectsApi.remove(id);
    if (res?.success) {
      notify.success(t.projects.deleteSuccess, t.projects.deleteSuccessDesc);
      setLoading(true);
      await fetchProjects();
      return;
    }
    notify.error(t.projects.deleteError, res?.error || t.projects.deleteErrorDesc);
  };

  // ── Edit ────────────────────────────────────────────────────────────────
  const handleEditRequest = (event, project) => {
    event.stopPropagation();
    setEditTarget(project);
  };

  const handleEditConfirm = async ({ modName, author }) => {
    if (!editTarget || !isAvailable()) return;
    const projectData = {
      id:      editTarget.id,
      name:    modName,
      author,
      pakPath: editTarget.pakPath,
      translations: { name: modName, author },
    };
    const res = await projectsApi.save(projectData);
    setEditTarget(null);
    if (res?.success) {
      notify.success(t.projects.saved, t.projects.editUpdated(modName));
      await fetchProjects();
    } else {
      notify.error(t.common.error, t.projects.editErrorDesc);
    }
  };

  // Merge real projects with the example project for the tutorial display.
  const displayProjects = useMemo(() => {
    if (exampleProject && projects.length === 0) return [exampleProject];
    return projects;
  }, [projects, exampleProject]);

  const exampleId = EXAMPLE_PROJECT.id;
  const cardHandlers = {
    onLoad:   (project) => (project.id === exampleId ? undefined : onLoadProject(project)),
    onDelete: (event, project) => { if (project.id !== exampleId) handleDeleteRequest(event, project); },
    onEdit:   (event, project) => { if (project.id !== exampleId) handleEditRequest(event, project); },
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-surface-0 min-h-0">
      <PageBackground />

      <StartProfilePanel
        isExpanded={isProfileExpanded}
        onToggle={() => setIsProfileExpanded((v) => !v)}
        onClose={() => setIsProfileExpanded(false)}
      />

      <div className="absolute top-5 right-6 z-30 flex items-center gap-2" data-tutorial="top-buttons">
        {onOpenHome && (
          <button
            type="button"
            onClick={onOpenHome}
            title={t.projects.aboutApp}
            className="group flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.95] transition-all duration-200"
          >
            <Info className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors duration-200" />
          </button>
        )}
        {onSettingsOpen && (
          <button
            type="button"
            onClick={onSettingsOpen}
            title="Настройки"
            className="group flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.06] active:scale-[0.95] transition-all duration-200"
          >
            <Settings className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-all duration-500 group-hover:rotate-90" />
          </button>
        )}
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center px-10 pt-16 pb-20 w-full max-w-[1100px] mx-auto">
          <HeroSection />
          <div data-tutorial="dropzone">
            <DropZone onClickOpen={onSelectFile} onFileDrop={onFileDrop} />
          </div>

          <div data-tutorial="projects-section">
            <ProjectsSeparator count={displayProjects.length} loading={loading} />

            <div className="w-full start-fade-in" style={{ animationDelay: '180ms' }}>
              {loading ? (
                <LoadingState />
              ) : displayProjects.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[220px]">
                  {displayProjects.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      index={index}
                      onLoad={cardHandlers.onLoad}
                      onDelete={cardHandlers.onDelete}
                      onEdit={cardHandlers.onEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <ProjectEditModal
        isOpen={!!editTarget}
        project={editTarget}
        existingProjectNames={projects.map((p) => p.name)}
        onConfirm={handleEditConfirm}
        onCancel={() => setEditTarget(null)}
      />

      {showTutorial && (
        <TutorialStartPage
          onBeforeStep={handleBeforeStep}
          onComplete={handleTutorialComplete}
        />
      )}
    </div>
  );
}
