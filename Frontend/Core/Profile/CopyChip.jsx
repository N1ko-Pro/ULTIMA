import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@Locales/LocaleProvider';

// ─── CopyChip ────────────────────────────────────────────────────────────────
// Inline clickable span: copies `value` to clipboard on click and shows a
// transient "Скопировано" tooltip above the text for ~2 s with fade-out.
// Tooltip is portalled to document.body to escape overflow:hidden parents.

export default function CopyChip({ value, children, className = '' }) {
  const t = useLocale();
  const spanRef  = useRef(null);
  const [pos,    setPos]    = useState(null);
  const [show,   setShow]   = useState(false);
  const [fading, setFading] = useState(false);
  const hideTimer = useRef(null);
  const fadeTimer = useRef(null);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(String(value ?? ''));

    const rect = spanRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ x: rect.left + rect.width / 2, y: rect.top });
    }

    clearTimeout(hideTimer.current);
    clearTimeout(fadeTimer.current);
    setShow(true);
    setFading(false);

    hideTimer.current = setTimeout(() => {
      setFading(true);
      fadeTimer.current = setTimeout(() => {
        setShow(false);
        setFading(false);
      }, 400);
    }, 1600);
  }, [value]);

  return (
    <span
      ref={spanRef}
      className={`relative inline-flex items-center cursor-pointer ${className}`}
      onClick={handleCopy}
      title={t.common.clickToCopy}
    >
      {show && pos && createPortal(
        <span
          className="fixed px-2 py-0.5 rounded-md bg-zinc-800 border border-white/[0.1] text-[10px] font-semibold text-zinc-200 whitespace-nowrap pointer-events-none select-none transition-opacity duration-300"
          style={{
            zIndex:    9999,
            opacity:   fading ? 0 : 1,
            left:      pos.x,
            top:       pos.y - 6,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {t.common.copied}
        </span>,
        document.body,
      )}
      <span className="transition-opacity duration-150 hover:opacity-60">
        {children}
      </span>
    </span>
  );
}
