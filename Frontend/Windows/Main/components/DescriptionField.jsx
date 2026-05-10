import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ScrollText } from 'lucide-react';
import SidebarFieldWrapper from './SidebarFieldWrapper';
import { autoResize } from '@Utils/dom/autoResize';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Sidebar description field ──────────────────────────────────────────────
// Multi-line version of InputField. Both textareas auto-resize to content
// (via `autoResize`) so long descriptions never overflow.

function DescriptionField({ original, value, onChange, isRequiredMissing, packValidationAttempt = 0, isUserSet }) {
  const t = useLocale();
  const [isFocused, setIsFocused] = useState(false);
  const [dismissedValidationAttempt, setDismissedValidationAttempt] = useState(null);

  const displayValue = value !== undefined ? value : original;
  const isUnknown = original?.includes('Unknown');
  const isValidationHighlighted = isRequiredMissing && dismissedValidationAttempt !== packValidationAttempt;

  const topRef = useRef(null);
  const editRef = useRef(null);

  const resizeBoth = useCallback(() => {
    autoResize(topRef.current);
    autoResize(editRef.current);
  }, []);

  useEffect(() => {
    resizeBoth();
  }, [original, value, resizeBoth]);

  const labelColor = isValidationHighlighted
    ? 'text-red-300/80'
    : isFocused
      ? 'text-zinc-200'
      : isUserSet === false
        ? 'text-orange-400/60'
        : displayValue && displayValue.trim()
          ? 'text-emerald-400/60'
          : isUnknown
            ? 'text-orange-400/60'
            : 'text-zinc-600 group-hover:text-zinc-400';

  const topReadonlyColor = isValidationHighlighted
    ? '!border-red-500/40 text-zinc-400'
    : isFocused
      ? '!border-l-white/50 text-zinc-200'
      : isUserSet === false
        ? '!border-l-orange-400/50 text-zinc-400'
        : displayValue && displayValue.trim()
          ? '!border-l-emerald-400/50 text-zinc-300'
          : isUnknown
            ? '!border-l-orange-400/50 text-zinc-400'
            : 'border-l-zinc-700 text-zinc-500';

  const editInputColor = isValidationHighlighted
    ? '!border-red-500/50 focus:!border-red-400/60 focus:!ring-red-500/20 focus:!shadow-[0_0_0_3px_rgba(239,68,68,0.08)]'
    : 'border-white/[0.08]';

  return (
    <SidebarFieldWrapper
      isFocused={isFocused}
      value={displayValue}
      isUnknown={isUnknown}
      isRequiredMissing={isValidationHighlighted}
      isUserSet={isUserSet}
    >
      <div className="flex items-center justify-between mb-2 ml-3 max-w-full">
        <label className={`text-xs font-semibold transition-colors duration-200 flex items-center gap-2 ${labelColor}`}>
          <ScrollText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t.sidebar.description}</span>
        </label>
      </div>

      <div className="space-y-2 ml-3">
        <textarea
          ref={topRef}
          readOnly
          tabIndex={-1}
          value={original || ''}
          rows={1}
          style={{ overflowY: 'hidden', minHeight: '2.25rem' }}
          className={`w-full bg-surface-1 border-l-[3px] border-y border-r border-white/[0.06] rounded-lg px-3 py-1.5 text-[13px] cursor-default shadow-none outline-none resize-none transition-[border-color] duration-200 ${topReadonlyColor}`}
        />

        <div className="relative">
          <textarea
            ref={editRef}
            onFocus={() => {
              setIsFocused(true);
              if (isValidationHighlighted) setDismissedValidationAttempt(packValidationAttempt);
            }}
            onBlur={() => setIsFocused(false)}
            value={value || ''}
            onChange={(e) => {
              onChange(e.target.value);
              autoResize(e.target);
              autoResize(topRef.current);
            }}
            placeholder={t.sidebar.descPlaceholder}
            rows={1}
            style={{ overflowY: 'auto', minHeight: '2.25rem', maxHeight: '9rem' }}
            className={`input-modern px-3 py-1.5 w-full text-[13px] text-zinc-100 resize-none border rounded-lg ${editInputColor}`}
          />
        </div>
      </div>
    </SidebarFieldWrapper>
  );
}

export default React.memo(DescriptionField);
