import React from 'react';

// ─── Ollama feature bullet ──────────────────────────────────────────────────
// A one-line "icon + title + subtitle" row used on the Ollama install
// pitch ("offline" / "no limits" / "GPU").

/**
 * @param {{
 *   icon: React.ComponentType<any>,
 *   color: string, bg: string, border: string,
 *   title: React.ReactNode,
 *   subtitle: React.ReactNode,
 * }} props
 */
export function OllamaFeatureBullet({ icon: Icon, color, bg, border, title, subtitle }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-xl ${bg} ${border} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div>
        <p className="text-xs font-semibold text-zinc-200">{title}</p>
        <p className="text-[11px] text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}
