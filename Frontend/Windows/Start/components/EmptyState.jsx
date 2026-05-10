import React from 'react';
import { Ghost } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Empty state ────────────────────────────────────────────────────────────
// Shown when the backend returned an empty project list. Ghost icon + two
// text lines encouraging the user to drop a file.

export function EmptyState() {
  const t = useLocale();
  return (
    <div
      className="flex flex-col items-center justify-center py-16 start-fade-in"
      style={{ animationDelay: '200ms' }}
    >
      <Ghost className="w-8 h-8 text-zinc-700 mb-5" />
      <h3 className="text-zinc-500 font-semibold text-[17px] mb-2 tracking-wide">{t.projects.emptyTitle}</h3>
      <p className="text-zinc-700 text-[14px] leading-relaxed text-center max-w-[280px]">
        {t.projects.emptyDesc}
      </p>
    </div>
  );
}
