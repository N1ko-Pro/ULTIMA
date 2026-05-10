import { useEffect } from 'react';

// ─── Global keyboard shortcuts ──────────────────────────────────────────────
// Listens on `window` for Ctrl/Cmd-chord shortcuts and dispatches to the
// matching callback. Mounted once at the app root (or per-feature when
// shortcuts must be active only inside a specific view).

/** Returns true when `event` carries Ctrl (Win/Linux) or Cmd (macOS). */
const hasCtrlChord = (event) => event.ctrlKey || event.metaKey;

/**
 * Identifies the pressed key independent of layout.
 * `event.code` is layout-agnostic ("KeyS"); `event.key` is what the user
 * actually typed and is used as a fallback for older browsers.
 */
const isLetter = (event, letter) => {
  const upper = letter.toUpperCase();
  const lower = letter.toLowerCase();
  return event.code === `Key${upper}` || event.key?.toLowerCase() === lower;
};

const SHORTCUT_MATCHERS = {
  onSave:        (event) => hasCtrlChord(event) && isLetter(event, 's'),
  onFocusSearch: (event) => hasCtrlChord(event) && isLetter(event, 'f'),
};

/**
 * @typedef {Object} KeyboardShortcutCallbacks
 * @property {() => void} [onSave]         Triggered by Ctrl/Cmd + S.
 * @property {() => void} [onFocusSearch]  Triggered by Ctrl/Cmd + F.
 */

/**
 * Subscribes to the supported global shortcuts. Pass only the callbacks you
 * actually need — others stay inactive.
 * @param {KeyboardShortcutCallbacks} callbacks
 */
export function useKeyboardShortcuts(callbacks) {
  const { onSave, onFocusSearch } = callbacks;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (onSave && SHORTCUT_MATCHERS.onSave(event)) {
        event.preventDefault();
        onSave();
        return;
      }
      if (onFocusSearch && SHORTCUT_MATCHERS.onFocusSearch(event)) {
        event.preventDefault();
        onFocusSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onFocusSearch]);
}
