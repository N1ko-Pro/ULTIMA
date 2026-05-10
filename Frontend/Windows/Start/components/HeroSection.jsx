import React from 'react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Hero section ───────────────────────────────────────────────────────────
// Title + tagline at the top of the Start page.

export function HeroSection() {
  const t = useLocale();
  return (
    <div className="flex flex-col items-center text-center mt-10 mb-14 start-fade-in relative z-10">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-200 mb-3">
        {t.projects.heroTitle}
      </h1>
      <p className="text-zinc-500 text-[14px] font-medium max-w-md leading-relaxed">
        {t.projects.heroDesc}
      </p>
    </div>
  );
}
