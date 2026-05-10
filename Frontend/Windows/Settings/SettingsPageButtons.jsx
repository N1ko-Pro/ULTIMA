import React from 'react';
import { Save, Lock } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';
import ButtonCore from '@Core/Buttons/ButtonCore';

// ─── Settings page buttons ──────────────────────────────────────────────────

// Two buttons used by the settings dialog: a tab header (unlockable via
// tier) and the primary save button in the footer.

/**
 * @param {{
 *   label: React.ReactNode,
 *   icon: React.ComponentType<any>,
 *   isActive: boolean,
 *   onClick: () => void,
 *   isLocked?: boolean,
 * }} props
 */
export function TabButton({ label, icon: Icon, isActive, onClick, isLocked = false }) {
  const stateClass = isLocked
    ? 'text-zinc-600 border border-transparent cursor-default'
    : isActive
      ? 'bg-white/[0.09] text-white border border-white/20'
      : 'text-zinc-400 border border-transparent hover:bg-surface-2 hover:text-zinc-200';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-300 ${stateClass}`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {isLocked && <Lock className="w-3 h-3 text-zinc-600" />}
    </button>
  );
}

/**
 * @param {{ hasChanges: boolean, onSave: () => void }} props
 */
export function SaveButton({ hasChanges, onSave }) {
  const t = useLocale();
  return (
    <ButtonCore
      variant={hasChanges ? 'primary' : 'secondary'}
      icon={Save}
      fullWidth
      disabled={!hasChanges}
      onClick={onSave}
    >
      {t.common.save}
    </ButtonCore>
  );
}
