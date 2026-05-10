import React from 'react';
import { Clock } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── Projects section separator ─────────────────────────────────────────────
// Decorative horizontal rule with an inline "recent projects" pill in the
// middle, rendered between the drop zone and the project grid.

/**
 * @param {{ count: number, loading: boolean }} props
 */
export function ProjectsSeparator({ count, loading }) {
  const t = useLocale();
  return (
    <div
      className="w-full flex items-center gap-4 my-14 start-fade-in relative z-10"
      style={{ animationDelay: '150ms' }}
    >
      <div className="flex-1 relative h-[1px]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-white/5" />
      </div>

      <div className="flex items-center gap-2.5 text-[12px] font-bold text-zinc-300 uppercase tracking-widest bg-surface-2/90 backdrop-blur-md border border-white/[0.08] px-5 py-2.5 rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,0.6)]">
        <Clock className="w-4 h-4 text-zinc-400 opacity-80" />
        <span>{t.projects.recentProjects}</span>
        {!loading && count > 0 && (
          <span className="ml-1 px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/[0.1] text-zinc-300">
            {count}
          </span>
        )}
      </div>

      <div className="flex-1 relative h-[1px]">
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-white/20 to-white/5" />
      </div>
    </div>
  );
}
