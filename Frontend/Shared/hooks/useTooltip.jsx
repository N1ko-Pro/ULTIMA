import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// ─── useTooltip ─────────────────────────────────────────────────────────────
// Lightweight portalled tooltip. Position is captured at `show()` time from
// the anchor ref's bounding rect, so the consumer doesn't need to deal with
// scroll/resize bookkeeping for short-lived tooltips.

const ANCHOR_GAP_PX = 8;

/**
 * @returns {{
 *   anchorRef: React.RefObject<HTMLElement>,
 *   show: () => void,
 *   hide: () => void,
 *   isVisible: boolean,
 *   renderTooltip: (content: React.ReactNode, className?: string) => React.ReactNode,
 * }}
 */
export function useTooltip() {
  const [position, setPosition] = useState(null);
  const anchorRef = useRef(null);

  const show = useCallback(() => {
    const node = anchorRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setPosition({
      top:  rect.bottom + ANCHOR_GAP_PX,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const hide = useCallback(() => setPosition(null), []);

  const renderTooltip = useCallback((content, className) => {
    if (!position) return null;
    return createPortal(
      <div
        className={className}
        style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
      >
        {content}
      </div>,
      document.body,
    );
  }, [position]);

  return {
    anchorRef,
    show,
    hide,
    isVisible: position !== null,
    renderTooltip,
  };
}
