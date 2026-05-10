import React, { useCallback } from 'react';
import { FolderOpen } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';
import { useDragAndDrop } from '../utils/useDragAndDrop';

// ─── Drop zone ──────────────────────────────────────────────────────────────
// Click-or-drop target for opening a mod file. Supports .pak, .zip, .rar.
// Glow animation on drag-over is driven by the `dropzone-glow` Tailwind
// keyframes (declared in globals.css).

const ACCEPTED_FORMATS = ['PAK', 'ZIP', 'RAR'];

/**
 * @param {{
 *   onClickOpen: () => void,
 *   onFileDrop: (filePath: string, ext: string) => void,
 * }} props
 */
export function DropZone({ onClickOpen, onFileDrop }) {
  const t = useLocale();

  const handleInvalidFile = useCallback(() => {
    notify.error(t.projects.dropInvalid, t.projects.dropInvalidDesc);
  }, [t.projects.dropInvalid, t.projects.dropInvalidDesc]);

  const { isDragging, dragHandlers } = useDragAndDrop({
    onFileDrop,
    onInvalidFile: handleInvalidFile,
  });

  const dragBorderClass = isDragging
    ? 'border-white/60 bg-white/[0.06] dropzone-glow'
    : 'border-white/[0.14] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.28]';

  const iconWrapClass = isDragging
    ? 'bg-white/[0.12] border-white/[0.25] scale-110'
    : 'bg-white/[0.04] border-white/[0.08]';

  return (
    <div className="start-fade-in w-full max-w-[520px]" style={{ animationDelay: '100ms' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onClickOpen}
        onKeyDown={(e) => e.key === 'Enter' && onClickOpen()}
        className={`relative w-full cursor-pointer select-none rounded-2xl border border-dashed transition-all duration-300 outline-none ${dragBorderClass}`}
        {...dragHandlers}
      >
        <div
          className={`absolute inset-x-0 top-0 h-[1px] rounded-t-2xl bg-gradient-to-r from-transparent via-white/50 to-transparent transition-opacity duration-300 ${
            isDragging ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div className="flex flex-col items-center justify-center gap-3.5 py-9 px-8">
          <div
            className={`w-13 h-13 rounded-xl flex items-center justify-center border transition-all duration-300 ${iconWrapClass}`}
            style={{ width: '52px', height: '52px' }}
          >
            <FolderOpen
              className={`w-6 h-6 transition-all duration-300 ${isDragging ? 'text-white' : 'text-zinc-400'}`}
            />
          </div>

          <div className="text-center">
            <p className={`text-[17px] font-semibold transition-colors duration-200 ${isDragging ? 'text-zinc-200' : 'text-zinc-400'}`}>
              {isDragging ? t.projects.dropLabelDrag : t.projects.dropLabel}
            </p>
            <p className={`text-[14px] mt-1 transition-colors duration-200 ${isDragging ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {t.projects.dropSub}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {ACCEPTED_FORMATS.map((fmt) => (
              <span
                key={fmt}
                className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase bg-white/[0.05] border border-white/[0.08] text-zinc-500 transition-colors duration-200"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
