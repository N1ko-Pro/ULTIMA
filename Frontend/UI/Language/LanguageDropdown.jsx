import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { TARGET_LANGUAGES, normalizeLanguageCode } from '@Config/languages.constants';
import { FlagByName } from '@UI/EULA/FlagIcons';
import { useLocale } from '@Locales/LocaleProvider';

// ─── LanguageDropdown ───────────────────────────────────────────────────────
// Portal-rendered dropdown for picking a translation target language. Mirrors
// the visual style of `Core/Dropdown/DropdownCore` but renders flag + dual
// label (native + localised) per row, since DropdownCore is text-only.
//
// Used by ProjectInitModal, ProjectEditModal, and the TopBar quick-switch
// pill, so changing the rendering here updates every surface at once.

/**
 * @param {{
 *   value: string,
 *   onChange: (code: string) => void,
 *   className?: string,
 *   variant?: 'field' | 'pill',
 *   triggerLabel?: string,
 * }} props
 *
 * `field` — full-width input-like trigger used inside modals.
 * `pill`  — compact rounded trigger used in the editor TopBar.
 */
export default function LanguageDropdown({
  value,
  onChange,
  className = '',
  variant = 'field',
  triggerLabel,
  compact = false,
}) {
  const t = useLocale();
  const code = normalizeLanguageCode(value);
  const selected = useMemo(
    () => TARGET_LANGUAGES.find((lang) => lang.code === code),
    [code],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();

    const handleClickOutside = (event) => {
      if (triggerRef.current && triggerRef.current.contains(event.target)) return;
      if (event.target.closest('[data-language-dropdown-portal]')) return;
      setIsOpen(false);
    };
    // We listen in capture phase to catch scrolls anywhere on the page so the
    // floating menu doesn't drift away from the trigger. But we MUST ignore
    // scroll events that originate inside the menu itself — that's how the
    // user navigates a long language list. `event.target` here is the actual
    // scrollable element (Element when scroll comes from inside the menu;
    // document when the page scrolls).
    const handleScroll = (event) => {
      const target = event.target;
      if (target && target.nodeType === Node.ELEMENT_NODE && target.closest?.('[data-language-dropdown-portal]')) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  const localizedLabel = (langCode) => t.languages?.[langCode];

  const renderRow = (lang, { active }) => (
    <button
      key={lang.code}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChange(lang.code);
        setIsOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-all duration-150 ${
        active
          ? 'bg-surface-4 text-white'
          : 'text-zinc-300 hover:bg-surface-3 hover:text-white'
      }`}
    >
      <FlagByName name={lang.flag} className="w-5 h-[14px] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="block text-[12px] font-medium truncate">{lang.nativeLabel}</span>
        {localizedLabel(lang.code) && localizedLabel(lang.code) !== lang.nativeLabel && (
          <span className="block text-[10px] text-zinc-500 mt-0.5 truncate">{localizedLabel(lang.code)}</span>
        )}
      </div>
      {active && <Check className="w-3.5 h-3.5 shrink-0 text-white/70" />}
    </button>
  );

  // ── Trigger styles per variant ──────────────────────────────────────────
  // The `pill` variant matches the editor TopBar buttons (h-[42px], rounded-xl,
  // shimmer overlay, amber accent on hover) so the language switcher reads as
  // part of the same toolbar group. The `field` variant is the modal-style
  // input used inside ProjectInitModal / ProjectEditModal.
  const triggerCls = variant === 'pill'
    ? `group relative flex items-center gap-2.5 h-[42px] rounded-xl bg-white/[0.06] border border-white/[0.12] transition-all duration-200 hover:bg-white/[0.1] hover:border-amber-400/30 hover:shadow-[0_0_20px_rgba(251,191,36,0.08)] active:scale-[0.97] overflow-hidden shrink-0 ${compact ? 'px-2.5' : 'px-3.5'}`
    : 'w-full flex items-center gap-3 h-[42px] px-3 rounded-xl border border-white/[0.08] bg-surface-2 hover:bg-surface-3 hover:border-white/[0.14] transition-all duration-200';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={triggerCls}
        title={triggerLabel}
      >
        {/* Shimmer overlay — only on the pill variant to match the rest of
            the editor TopBar buttons. Field-variant lives inside modals
            where shimmer would be visual noise. */}
        {variant === 'pill' && (
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-amber-400/0 via-amber-400/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
        )}

        <FlagByName name={selected?.flag || 'FlagRU'} className="relative z-10 w-5 h-[14px] shrink-0" />
        {!(variant === 'pill' && compact) && (
          <div className={`relative z-10 ${variant === 'pill' ? 'flex items-center' : 'flex-1'} min-w-0 text-left`}>
            <span className={`block font-medium truncate ${variant === 'pill' ? 'text-[12px] text-zinc-200 group-hover:text-amber-100 transition-colors duration-200' : 'text-[12px] text-zinc-200'}`}>
              {selected?.nativeLabel || ''}
            </span>
            {variant === 'field' && localizedLabel(code) && localizedLabel(code) !== selected?.nativeLabel && (
              <span className="block text-[10px] text-zinc-500 truncate">{localizedLabel(code)}</span>
            )}
          </div>
        )}
        <ChevronDown
          className={`relative z-10 w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${variant === 'pill' ? 'text-zinc-400 group-hover:text-amber-200/70' : 'text-zinc-500'}`}
        />
      </button>

      {isOpen && createPortal(
        <div
          data-language-dropdown-portal
          className="fixed rounded-xl border border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.6)] z-[200] animate-[slideDown_150ms_ease-out] max-h-[320px] overflow-y-auto overflow-x-hidden bg-surface-1/[0.98] backdrop-blur-2xl"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            minWidth: variant === 'pill' ? '220px' : `${Math.max(menuPos.width, 220)}px`,
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {/* Hairline highlight on the top edge — sticky so it stays visible
              when the user scrolls the list. */}
          <div className="sticky top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.1] to-transparent pointer-events-none z-10" />
          <div className="py-1">
            {TARGET_LANGUAGES.map((lang) => renderRow(lang, { active: lang.code === code }))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
