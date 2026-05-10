import React from 'react';
import { Clock, FileCode2, Layers } from 'lucide-react';
import { usePrefersReducedMotion } from '@Core/Animations/helpers/usePrefersReducedMotion';
import { useLocale } from '@Locales/LocaleProvider';
import { useTiltEffect } from '../utils/useTiltEffect';
import { formatDate } from '../utils/formatDate';
import { DeleteProjectButton, EditProjectButton } from '../StartPageButtons';

// ─── Project card ───────────────────────────────────────────────────────────
// Single tile in the Start page project grid. Tilt-follows the cursor
// (purely transform-based, GPU-friendly) and reveals edit/delete affordances
// on hover. The `start-card-appear` class staggers the entrance animation
// by index.

const MAX_STAGGER_INDEX = 12;
const STAGGER_MS = 50;

/**
 * @param {{
 *   project: {
 *     id: string,
 *     name: string,
 *     pakPath?: string,
 *     lastModified: number,
 *   },
 *   index: number,
 *   onLoad: (project: any) => void,
 *   onDelete: (event: React.MouseEvent, project: any) => void,
 *   onEdit:   (event: React.MouseEvent, project: any) => void,
 * }} props
 */
export function ProjectCard({ project, index, onLoad, onDelete, onEdit }) {
  const t = useLocale();
  const reduceMotion = usePrefersReducedMotion();
  const { ref, onMouseMove, onMouseLeave } = useTiltEffect({ maxTilt: 8, scale: 1.02 });
  const pakName = project.pakPath ? project.pakPath.split(/[\\/]/).pop() : t.projects.fileNotFound;
  const delay = !reduceMotion && index < MAX_STAGGER_INDEX ? index * STAGGER_MS : 0;

  // Tilt handlers are wired only when motion is allowed — saves work and
  // respects the OS-level accessibility preference.
  const tiltHandlers = reduceMotion
    ? {}
    : { ref, onMouseMove, onMouseLeave };

  return (
    <div
      className={`${reduceMotion ? '' : 'start-card-appear'} h-full`}
      style={reduceMotion ? undefined : { animationDelay: `${delay}ms` }}
    >
      <div
        {...tiltHandlers}
        onClick={() => onLoad(project)}
        className="group relative cursor-pointer h-full select-none"
        style={reduceMotion ? undefined : { willChange: 'transform' }}
      >
        <div className="absolute -inset-2 rounded-[24px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 z-0 bg-white/[0.03]" />
        <div className="absolute inset-0 z-0 rounded-[20px] bg-white/[0.04] backdrop-blur-2xl border border-white/[0.1] shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-500 group-hover:bg-white/[0.06] group-hover:border-white/[0.14] group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]" />
        <div
          className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-[1] pointer-events-none"
          style={{ background: 'radial-gradient(circle 200px at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,0.04), transparent)' }}
        />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent opacity-50 group-hover:opacity-90 transition-opacity duration-500 rounded-t-[20px] z-[1]" />

        <div className="relative h-full flex flex-col p-5 rounded-[20px] overflow-hidden z-10">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center transition-all duration-500 group-hover:border-white/[0.2] group-hover:bg-white/[0.1]">
              <Layers className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors duration-500" />
            </div>
            <div className="pt-0.5 relative z-20 flex items-center gap-1">
              <EditProjectButton onClick={(e) => onEdit(e, project)} />
              <DeleteProjectButton onClick={(e) => onDelete(e, project)} />
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-end">
            <h4 className="text-zinc-200 font-semibold text-[15px] leading-snug mb-1.5 line-clamp-2 group-hover:text-white transition-colors duration-200">
              {project.name}
            </h4>

            <div className="flex items-center gap-1.5 text-zinc-500 text-[13px] font-medium mb-3">
              <FileCode2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{pakName}</span>
            </div>

            <div className="h-px w-full bg-gradient-to-r from-white/[0.06] to-transparent mb-3" />

            <div className="flex items-center gap-1.5 text-[12px] text-zinc-500 font-medium">
              <Clock className="w-3.5 h-3.5 opacity-70" />
              <span>{formatDate(project.lastModified)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
