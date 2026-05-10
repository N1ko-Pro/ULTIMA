import React, { useState, useCallback } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';
import { notify } from '@Shared/notifications/notifyCore';

// ─── Expanded profile editor ───────────────────────────────────────────────────
// Shared local name editor component for profile panels.
// Handles view switching (main ↔ settings), input field, and save logic.
// Used by EditorProfilePanel, StartProfilePanel, and AuthProfilePanel.

export function ExpandedProfileEditor({ isVisible, onClose }) {
  const t = useLocale();
  const { localName, setLocalName } = useAuth();

  const [nameValue, setNameValue] = useState(localName || '');
  const [prevLocalName, setPrevLocalName] = useState(localName);

  // Sync nameValue when localName changes externally
  if (prevLocalName !== localName) {
    setPrevLocalName(localName);
    setNameValue(localName || '');
  }

  const handleSaveName = useCallback(() => {
    setLocalName(nameValue);
    notify.success(t.auth.saveNameSuccess, t.auth.saveNameSuccessDesc, 2000);
    onClose?.();
  }, [nameValue, setLocalName, t.auth.saveNameSuccess, t.auth.saveNameSuccessDesc, onClose]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase mb-2 block px-1">
          {t.auth.localName}
        </label>
        <input
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
          placeholder={t.auth.localNamePlaceholder}
          maxLength={100}
          autoFocus={isVisible}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 outline-none transition-[border-color,box-shadow] duration-200 focus:border-white/[0.25] focus:ring-2 focus:ring-white/[0.06]"
        />
        <p className="text-[11px] text-zinc-600 leading-relaxed px-1 mt-1.5">{t.auth.localNameDesc}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-white/[0.08] text-zinc-400 text-[13px] font-medium hover:text-zinc-200 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 active:scale-[0.98]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          {t.common.back}
        </button>
        <button
          type="button"
          onClick={handleSaveName}
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300 text-[13px] font-medium hover:bg-emerald-500/[0.12] hover:border-emerald-500/30 transition-all duration-200 active:scale-[0.98]"
        >
          <Check className="w-3.5 h-3.5" />
          {t.common.save}
        </button>
      </div>
    </div>
  );
}
