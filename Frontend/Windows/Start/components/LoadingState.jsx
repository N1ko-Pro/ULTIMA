import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Loading state ──────────────────────────────────────────────────────────
// Shown while the project list is being fetched from the backend. Spinner +
// label. Skeleton variant would be overkill for a list that appears in
// <500ms under normal conditions.

export function LoadingState() {
  const t = useLocale();
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 border-2 border-white/10 rounded-full" />
        <div className="absolute inset-0 border-2 border-white/50 rounded-full border-t-transparent animate-spin" />
      </div>
      <span className="text-zinc-500 text-[14px] font-medium tracking-wide">{t.projects.syncing}</span>
    </div>
  );
}
