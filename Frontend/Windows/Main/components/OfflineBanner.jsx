import React from 'react';
import { WifiOff } from 'lucide-react';
import { useAuth } from '@Core/Services/AuthService';
import { useLocale } from '@Locales/LocaleProvider';

// ─── OfflineBanner ──────────────────────────────────────────────────────────
// Thin amber strip shown below the TopBar when the auth server is unreachable.
// Uses `refreshFailed` from AuthService — fires on the first failed refresh
// attempt after startup, so it's shown quickly without false positives.

export default function OfflineBanner() {
  const { isLoggedIn, refreshFailed, isOffline } = useAuth();
  const t = useLocale();

  if (!isLoggedIn || (!refreshFailed && !isOffline)) return null;

  return (
    <div className="flex items-center justify-center gap-2 shrink-0 px-4 py-1.5 border-b border-amber-500/15 bg-amber-500/[0.06]">
      <WifiOff className="w-3 h-3 text-amber-400 shrink-0" />
      <span className="text-[12px] text-amber-200/70 font-medium">
        {t.auth.offlineBanner}
      </span>
    </div>
  );
}
