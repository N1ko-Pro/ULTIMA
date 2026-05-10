import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTransition } from '@Core/Animations/helpers/useTransition';

// ─── ModalCore ───────────────────────────────────────────────────────────────────────
// Universal modal primitive. Every modal in the app composes this component.
// Provides: dark glass overlay → floating panel → optional header/footer.
// Specialised modals pass custom children/footer and tweak via className props.
//
// Animation: enter + exit are driven by the Web Animations engine via
// `useTransition`. The element stays mounted long enough for the exit
// animation to play before unmounting, so closing a modal is graceful
// rather than instantaneous.

/**
 * @typedef {Object} ModalCoreProps
 * @property {boolean} isOpen
 * @property {() => void} [onClose]
 * @property {React.ReactNode} [title]
 * @property {React.ReactNode} [subtitle]
 * @property {React.ComponentType<any>} [icon]            Lucide icon component.
 * @property {string} [iconColorClass]
 * @property {string} [iconBgClass]
 * @property {string} [iconBorderClass]
 * @property {React.ReactNode} children                   Body content.
 * @property {React.ReactNode} [footer]                   Footer slot.
 * @property {string} [maxWidthClass]                     Tailwind max-w- class.
 * @property {number} [zIndex]                            z-index for stacking (default 100).
 * @property {boolean} [closeOnOverlayClick]
 * @property {boolean} [showCloseIcon]
 * @property {boolean} [disableClose]                     Lock the close affordances entirely.
 * @property {string} [containerClassName]                Extra classes on the fixed container.
 * @property {string} [overlayClassName]
 * @property {string} [panelClassName]
 * @property {string} [headerClassName]
 * @property {string} [bodyClassName]
 * @property {string} [footerClassName]
 * @property {string} [titleClassName]
 * @property {string} [subtitleClassName]
 * @property {string} [closeButtonClassName]
 * @property {string} [overlayGradient]                   Custom CSS gradient for overlay.
 * @property {string} [overlayBlur]                        Custom backdrop-filter blur value.
 * @property {string} [panelBorderRadius]                  Custom border radius for panel (e.g., 'rounded-3xl').
 * @property {string} [panelShadow]                        Custom shadow for panel.
 * @property {string} [topBorderOpacity]                   Custom opacity for top border gradient (e.g., '0.14').
 * @property {string} [extraGradient]                      Optional extra gradient overlay on panel.
 */

/** @param {ModalCoreProps} props */
export default function ModalCore({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconColorClass = 'text-zinc-300',
  iconBgClass = 'bg-surface-3',
  iconBorderClass = 'border-white/[0.08]',
  children,
  footer,
  maxWidthClass = 'max-w-md',
  zIndex = 100,
  closeOnOverlayClick = true,
  showCloseIcon = false,
  disableClose = false,
  containerClassName = '',
  overlayClassName = '',
  panelClassName = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  titleClassName = '',
  subtitleClassName = '',
  closeButtonClassName = '',
  overlayGradient,
  overlayBlur,
  panelBorderRadius = 'rounded-2xl',
  panelShadow,
  topBorderOpacity = '0.12',
  extraGradient,
}) {
  const { ref: overlayRef, isMounted: overlayMounted } = useTransition(isOpen, 'overlayIn', 'overlayOut');
  const { ref: panelRef,   isMounted: panelMounted }   = useTransition(isOpen, 'modalIn',   'modalOut');

  // Stays mounted while either layer is animating in or out.
  if (!panelMounted && !overlayMounted) return null;

  const handleOverlayMouseDown = closeOnOverlayClick && !disableClose
    ? (e) => { if (!e.nativeEvent._layerConsumed) onClose?.(); }
    : undefined;
  const hasHeader = title || subtitle;

  const defaultGradient = 'radial-gradient(ellipse 56% 66% at 50% 50%, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.90) 28%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.0) 82%)';
  const defaultBlur = 'blur(10px)';
  const defaultShadow = 'shadow-[0_24px_64px_rgba(0,0,0,0.5)]';

  const overlayStyle = {
    background: overlayGradient || defaultGradient,
    backdropFilter: overlayBlur || defaultBlur,
    WebkitBackdropFilter: overlayBlur || defaultBlur,
  };

  return createPortal(
    <div className={`fixed inset-0 flex items-center justify-center p-4 ${containerClassName}`} style={{ zIndex }} role="dialog" aria-modal="true">
      <div
        ref={overlayRef}
        className={`absolute inset-0 select-none ${overlayClassName}`}
        style={overlayStyle}
        onMouseDown={handleOverlayMouseDown}
      />

      <div
        ref={panelRef}
        className={`relative w-full ${maxWidthClass} ${panelBorderRadius} overflow-hidden ${panelClassName}`}
      >
        <div className={`absolute inset-0 bg-surface-2/98 backdrop-blur-2xl border border-white/[0.08] ${panelBorderRadius} ${panelShadow || defaultShadow}`} />
        <div className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[${topBorderOpacity}] to-transparent rounded-t-2xl`} />
        {extraGradient && (
          <div
            className={`absolute inset-0 pointer-events-none ${panelBorderRadius}`}
            style={{ background: extraGradient }}
          />
        )}

        <div className="relative z-10 flex flex-col h-full">
          {hasHeader && (
            <div className={`p-6 border-b border-white/[0.06] flex items-center gap-4 ${headerClassName}`}>
              {Icon && (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${iconBgClass} ${iconBorderClass}`}>
                  <Icon className={`w-5 h-5 ${iconColorClass}`} />
                </div>
              )}
              <div>
                {title && <h2 className={`text-[17px] font-semibold text-zinc-100 tracking-wide ${titleClassName}`}>{title}</h2>}
                {subtitle && <p className={`text-[13px] text-zinc-500 mt-0.5 ${subtitleClassName}`}>{subtitle}</p>}
              </div>
              {showCloseIcon && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={disableClose}
                  className={`absolute right-4 top-4 w-7 h-7 text-zinc-600 hover:text-zinc-200 transition-all duration-200 rounded-full flex items-center justify-center hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 ${closeButtonClassName}`}
                  aria-label="Закрыть"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Close icon without header — positioned top-right of panel */}
          {!hasHeader && showCloseIcon && onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={disableClose}
              className={`absolute right-4 top-4 z-20 w-7 h-7 text-zinc-600 hover:text-zinc-200 transition-all duration-200 rounded-full flex items-center justify-center hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 ${closeButtonClassName}`}
              aria-label="Закрыть"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className={`p-6 space-y-4 select-text ${bodyClassName}`}>{children}</div>

          {footer && (
            <div className={`p-4 border-t border-white/[0.06] flex items-center justify-end gap-3 ${footerClassName}`}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
