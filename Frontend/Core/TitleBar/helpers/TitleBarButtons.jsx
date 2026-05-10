import React from 'react';
import { Minus, Square, X } from 'lucide-react';

// ─── Window controls ────────────────────────────────────────────────────────
// The traffic-light buttons rendered at the right of the title bar.
// Implementation note: we keep them as a separate component because the close
// path is the only one the title bar needs to gate on unsaved changes.

const buttonClass =
  'w-12 h-full flex items-center justify-center text-zinc-600 hover:bg-surface-3 hover:text-zinc-300 transition-all duration-200';

const closeButtonClass =
  'w-12 h-full flex items-center justify-center text-zinc-600 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200';

/**
 * @param {{
 *   onMinimize: () => void,
 *   onMaximize: () => void,
 *   onClose: () => void,
 * }} props
 */
export function WindowControls({ onMinimize, onMaximize, onClose }) {
  return (
    <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' }}>
      <button type="button" onClick={onMinimize} className={buttonClass} aria-label="Свернуть">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={onMaximize} className={buttonClass} aria-label="Развернуть">
        <Square className="w-3 h-3" />
      </button>
      <button type="button" onClick={onClose} className={closeButtonClass} aria-label="Закрыть">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
