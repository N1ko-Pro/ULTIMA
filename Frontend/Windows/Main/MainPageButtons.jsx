import React from 'react';
import { X } from 'lucide-react';

// ─── Main page buttons ──────────────────────────────────────────────────────
// Small utility buttons used by components of the Main page. Larger
// buttons (AutoTranslateButton, PackButton, etc.) live in
// `components/TopBarButtons.jsx` because they're only rendered by the
// top bar itself.

export function SearchClearButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Очистить поиск"
      className="absolute inset-y-0 right-2 flex items-center justify-center text-zinc-400 hover:text-zinc-100 transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  );
}
