import { useEffect } from 'react';

// ─── Escape-to-blur ─────────────────────────────────────────────────────────
// Mounted once at the app root. Pressing Escape removes focus from any
// editable element, mirroring native macOS behaviour and giving users a
// quick way out of accidental text-input focus.

const BLURRABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Subscribes to the global keydown stream and blurs the active element on
 * Escape when it's an editable field. The `true` capture flag ensures we
 * win over component-local handlers that might otherwise stop propagation.
 */
export function useEscapeBlur() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      const active = document.activeElement;
      if (active && BLURRABLE_TAGS.has(active.tagName)) {
        active.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
