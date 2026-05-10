import React from 'react';

// ─── Sidebar field wrapper ──────────────────────────────────────────────────
// Common container for every labelled field in the sidebar (Mod name, Author,
// UUID, Description). Provides the left accent bar and the state-dependent
// ring colour: validation-red, focus-white, orange for empty/original-UUID,
// emerald when filled.

/**
 * @param {{
 *   isFocused: boolean,
 *   value: string,
 *   isUnknown?: boolean,
 *   isFolder?: boolean,
 *   isOriginalUuid?: boolean,
 *   isRequiredMissing?: boolean,
 *   isUserSet?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
export default function SidebarFieldWrapper({
  isFocused,
  value,
  isUnknown,
  children,
  isFolder,
  isOriginalUuid,
  isRequiredMissing,
}) {
  const hasValue = value && value.trim() !== '';
  const isOrange = isOriginalUuid || (!hasValue && !isUnknown);

  const wrapperClass = isRequiredMissing
    ? 'bg-red-500/[0.06] ring-1 ring-red-500/25'
    : isFocused
      ? 'bg-surface-3/60 ring-1 ring-white/[0.12]'
      : isOrange
        ? 'bg-orange-500/[0.05] ring-1 ring-orange-500/20'
        : isFolder
          ? 'bg-surface-2/40 ring-1 ring-white/[0.06]'
          : isUnknown
            ? 'bg-orange-500/[0.03] ring-1 ring-orange-500/15'
            : hasValue
              ? 'bg-emerald-500/[0.03] ring-1 ring-emerald-500/[0.1]'
              : 'hover:bg-surface-2/40';

  const accentClass = isRequiredMissing
    ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]'
    : isFocused
      ? 'bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.2)]'
      : isOrange
        ? 'bg-orange-400/80 shadow-[0_0_8px_rgba(251,146,60,0.3)]'
        : isFolder
          ? 'bg-white/20'
          : isUnknown
            ? 'bg-orange-400/50'
            : hasValue
              ? 'bg-emerald-400/60 shadow-[0_0_6px_rgba(52,211,153,0.2)]'
              : 'bg-white/[0.12]';

  return (
    <div className={`group relative -mx-3 p-3 rounded-xl transition-all duration-200 ${wrapperClass}`}>
      <div className={`absolute h-[calc(100%-16px)] w-[2px] left-[2px] top-[8px] rounded-full transition-all duration-400 ${accentClass}`} />
      {children}
    </div>
  );
}
