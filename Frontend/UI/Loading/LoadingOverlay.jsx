import React from 'react';

// ─── LoadingOverlay ─────────────────────────────────────────────────────────
// Full-screen blocking loader — used during long backend operations
// (unpacking PAK archives, repacking translations).

/**
 * @param {{
 *   isVisible: boolean,
 *   message?: string,
 *   description?: string,
 * }} props
 */
export default function LoadingOverlay({
  isVisible,
  message = 'Загрузка…',
  description = 'Пожалуйста, подождите',
}) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-[modalOverlayIn_0.2s_ease-out_both]"
      style={{
        background: 'radial-gradient(ellipse 56% 66% at 50% 50%, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.90) 28%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.0) 82%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden animate-[modalPanelIn_0.3s_cubic-bezier(0.16,1,0.3,1)_both]">
        <div className="absolute inset-0 bg-surface-2/98 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.5)]" />
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent rounded-t-2xl" />

        <div className="relative z-10 p-8 flex flex-col items-center">
          <div className="relative w-14 h-14 mb-6">
            <div className="absolute inset-0 border border-white/[0.08] rounded-full" />
            <div className="absolute inset-0 border-2 border-white/40 rounded-full border-t-transparent animate-spin" />
          </div>

          <h3 className="text-[17px] font-semibold text-zinc-100 mb-2 tracking-wide">{message}</h3>
          <p className="text-[14px] text-zinc-500 text-center leading-relaxed">{description}</p>

          <div className="flex space-x-1.5 mt-6">
            <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
