import { useState, useCallback, useRef } from 'react';
import { getPathForFile } from '@API/files';

// ─── useDragAndDrop ─────────────────────────────────────────────────────────
// Manages file drag-and-drop state for the Start page drop zone. Handles the
// nested-event problem (drag-enter/leave fire for every child) via a counter.

const ACCEPTED_EXTENSIONS = ['.pak', '.zip', '.rar'];

function getFileExt(filename) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

function isValidDropFile(file) {
  return ACCEPTED_EXTENSIONS.includes(getFileExt(file.name));
}

/**
 * @param {{
 *   onFileDrop: (filePath: string, ext: string) => void,
 *   onInvalidFile?: () => void,
 * }} options
 * @returns {{ isDragging: boolean, dragHandlers: object }}
 */
export function useDragAndDrop({ onFileDrop, onInvalidFile }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const onDragEnter = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setIsDragging(true);
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;

    const validFile = files.find(isValidDropFile);
    if (!validFile) {
      onInvalidFile?.();
      return;
    }

    // Electron 32+ with contextIsolation makes `file.path` empty;
    // the preload script exposes `getPathForFile(file)` as the replacement.
    const filePath = getPathForFile(validFile);
    onFileDrop(filePath, getFileExt(validFile.name));
  }, [onFileDrop, onInvalidFile]);

  return {
    isDragging,
    dragHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
