import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Uninstall Ollama row ───────────────────────────────────────────────────
// Bottom-of-page action: soft "Удалить Ollama" link that expands into an
// inline yes/no confirm. Matches the style of similar confirm rows elsewhere
// — fits into a footer slot rather than a full modal.

export function AiUninstallRow({ isUninstalling, onUninstall }) {
  const t = useLocale();
  const [confirming, setConfirming] = useState(false);

  if (isUninstalling) {
    return (
      <div className="flex items-center justify-center gap-2 pt-1">
        <Loader2 className="w-3 h-3 text-red-400 animate-spin" />
        <span className="text-[11px] text-red-400">{t.ollama.deleting}</span>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-[11px] text-zinc-500">{t.ollama.uninstallConfirm}</span>
        <button
          type="button"
          onClick={() => { setConfirming(false); onUninstall(); }}
          className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
        >
          {t.ollama.uninstallYes}
        </button>
        <span className="text-zinc-700">·</span>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {t.common.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center pt-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        {t.ollama.uninstall}
      </button>
    </div>
  );
}
