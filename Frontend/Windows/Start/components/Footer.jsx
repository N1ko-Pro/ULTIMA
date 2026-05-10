import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';
import pkg from '../../../../package.json';

// ─── Footer ─────────────────────────────────────────────────────────────────
// Copyright + version stripe pinned to the bottom of the Start page.

export function Footer() {
  const t = useLocale();
  const currentYear = new Date().getFullYear();
  const appVersion = pkg?.version || '0.0.0';
  return (
    <div className="relative z-20 shrink-0 border-t border-white/[0.04] bg-surface-0/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-8 py-3">
        <p className="text-[12px] font-medium tracking-wide text-zinc-600 select-none">
          {t.welcome.copyright(currentYear)}
        </p>
        <p className="text-[12px] font-medium tracking-wide text-zinc-600 select-none">
          {t.welcome.version(appVersion)}
        </p>
      </div>
    </div>
  );
}
