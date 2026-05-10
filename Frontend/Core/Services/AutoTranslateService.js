import { useCallback, useState } from 'react';
import { notify } from '@Shared/notifications/notifyCore';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Auto-translate mode picker ─────────────────────────────────────────────
// Drives the small "pick a mode then start" panel above the editor table.
// Decoupled from the actual translation pipeline (`useAutoTranslation`); this
// hook only manages picker UI state and delegates the start to a callback.

/**
 * @param {{
 *   disabled?: boolean,
 *   isTranslating: boolean,
 *   onStart: (modeId: string, options?: object) => Promise<void> | void,
 * }} input
 */
export default function useAutoTranslateModePicker({ disabled, isTranslating, onStart }) {
  const t = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModeId, setSelectedModeId] = useState('');
  const [errorModeId, setErrorModeId] = useState('');

  const openPanel = useCallback(() => {
    if (disabled || isTranslating) return;
    setIsExpanded(true);
  }, [disabled, isTranslating]);

  const closePanel = useCallback(() => {
    setIsExpanded(false);
    setErrorModeId('');
  }, []);

  const selectMode = useCallback((modeId) => {
    setSelectedModeId(modeId);
    setErrorModeId('');
  }, []);

  const start = useCallback(async (startOptions = {}) => {
    if (!selectedModeId) {
      notify.error(t.atp.selectModeError, t.atp.selectModeErrorDesc);
      return;
    }
    if (disabled || isTranslating) return;
    await onStart(selectedModeId, startOptions);
    closePanel();
  }, [closePanel, disabled, isTranslating, onStart, selectedModeId, t.atp.selectModeError, t.atp.selectModeErrorDesc]);

  return {
    isExpanded: isExpanded && !disabled && !isTranslating,
    selectedModeId,
    errorModeId,
    canStart: Boolean(selectedModeId),
    openPanel,
    closePanel,
    selectMode,
    start,
  };
}
