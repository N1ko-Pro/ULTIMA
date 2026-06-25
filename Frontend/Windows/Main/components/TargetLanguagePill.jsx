import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';
import LanguageDropdown from '@UI/Language/LanguageDropdown';

// ─── TargetLanguagePill ────────────────────────────────────────────────────
// Compact target-language switcher rendered in the editor TopBar between the
// XML group and the Pack button. Shows a flag + short label and reuses the
// portal-based picker from `LanguageDropdown` (variant: pill).
//
// Reuses the same dropdown the create/edit modals use, so changing the
// language affects future pack runs and the smart-translate destination
// without any extra plumbing here.

/**
 * @param {{
 *   value: string,
 *   onChange: (code: string) => void,
 *   compact?: boolean,
 * }} props
 */
function TargetLanguagePill({ value, onChange, compact = false }) {
  const t = useLocale();
  return (
    <LanguageDropdown
      value={value}
      onChange={onChange}
      variant="pill"
      compact={compact}
      triggerLabel={t.editor.targetLanguageTitle}
    />
  );
}

export default React.memo(TargetLanguagePill);
