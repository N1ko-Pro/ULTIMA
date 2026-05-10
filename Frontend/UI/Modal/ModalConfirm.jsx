import React from 'react';
import ModalCore from '@Core/Modal/ModalCore';
import ButtonCore from '@Core/Buttons/ButtonCore';

// ─── ModalConfirm ───────────────────────────────────────────────────────────
// Generic confirmation modal. Replaces a family of one-off modals
// (DeleteConfirmModal, AtpAccessModal, DotNetMissingModal,
// UnsavedChangesModal, PackModal) by parameterising the differences
// (variant, labels, icons, optional secondary action).


const VARIANT_STYLES = {
  danger:  { iconColor: 'text-red-400',     iconBg: 'bg-red-500/[0.1]',     iconBorder: 'border-red-500/20',     buttonVariant: 'danger'    },
  warning: { iconColor: 'text-amber-400',   iconBg: 'bg-amber-500/[0.1]',   iconBorder: 'border-amber-500/20',   buttonVariant: 'warning'   },
  info:    { iconColor: 'text-blue-400',    iconBg: 'bg-blue-500/[0.1]',    iconBorder: 'border-blue-500/20',    buttonVariant: 'indigo'    },
  success: { iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/[0.1]', iconBorder: 'border-emerald-500/20', buttonVariant: 'primary'   },
  neutral: { iconColor: 'text-zinc-300',    iconBg: 'bg-surface-3',         iconBorder: 'border-white/[0.08]',   buttonVariant: 'secondary' },
};

/**
 * @typedef {Object} ConfirmAction
 * @property {string} label
 * @property {React.ComponentType<any>} [icon]
 * @property {keyof typeof VARIANT_STYLES} [variant]
 * @property {() => void | Promise<void>} onClick
 */

function toButtonVariant(v) {
  return (VARIANT_STYLES[v] || VARIANT_STYLES.neutral).buttonVariant;
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onCancel?: () => void,
 *   onConfirm?: () => void | Promise<void>,
 *   title?: React.ReactNode,
 *   subtitle?: React.ReactNode,
 *   icon?: React.ComponentType<any>,
 *   variant?: keyof typeof VARIANT_STYLES,
 *   confirmLabel?: string,
 *   confirmIcon?: React.ComponentType<any>,
 *   cancelLabel?: string,
 *   isBusy?: boolean,
 *   secondaryAction?: ConfirmAction,
 *   children?: React.ReactNode,
 *   maxWidthClass?: string,
 *   closeOnOverlayClick?: boolean,
 *   showCloseIcon?: boolean,
 * }} props
 */
export default function ModalConfirm({
  isOpen,
  onCancel,
  onConfirm,
  title,
  subtitle,
  icon,
  variant = 'neutral',
  confirmLabel = 'OK',
  confirmIcon: ConfirmIcon,
  cancelLabel = 'Отмена',
  isBusy = false,
  secondaryAction,
  children,
  maxWidthClass = 'max-w-md',
  closeOnOverlayClick = true,
  showCloseIcon = true,
}) {
  const variantStyles = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;

  return (
    <ModalCore
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconColorClass={variantStyles.iconColor}
      iconBgClass={variantStyles.iconBg}
      iconBorderClass={variantStyles.iconBorder}
      maxWidthClass={maxWidthClass}
      closeOnOverlayClick={closeOnOverlayClick}
      showCloseIcon={showCloseIcon}
      disableClose={isBusy}
      footer={
        <div className={`flex items-center w-full gap-3 ${secondaryAction ? 'justify-between' : ''}`}>
          {secondaryAction ? (
            <ButtonCore
              variant={toButtonVariant(secondaryAction.variant)}
              icon={secondaryAction.icon}
              onClick={secondaryAction.onClick}
              disabled={isBusy}
            >
              {secondaryAction.label}
            </ButtonCore>
          ) : (
            <ButtonCore
              variant="secondary"
              className="flex-1"
              onClick={onCancel}
              disabled={isBusy}
            >
              {cancelLabel}
            </ButtonCore>
          )}

          <ButtonCore
            variant={variantStyles.buttonVariant}
            icon={ConfirmIcon}
            className={secondaryAction ? '' : 'flex-1'}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {confirmLabel}
          </ButtonCore>
        </div>
      }
    >
      {children}
    </ModalCore>
  );
}
