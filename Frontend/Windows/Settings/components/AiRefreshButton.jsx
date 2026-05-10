import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';

// ─── AI refresh button ──────────────────────────────────────────────────────
// Three-state button: idle → checking → done → idle. Used next to the
// "Ollama active" status bar so the user can force a status re-query.

const DONE_DISPLAY_MS = 1400;

export function AiRefreshButton({ onRefresh }) {
  const [state, setState] = useState('idle');
  const timerRef = useRef(null);

  const handleClick = useCallback(async () => {
    if (state !== 'idle') return;
    setState('checking');
    try {
      await onRefresh();
    } finally {
      setState('done');
      timerRef.current = setTimeout(() => setState('idle'), DONE_DISPLAY_MS);
    }
  }, [state, onRefresh]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (state === 'done') {
    return (
      <button type="button" disabled className="flex items-center gap-1.5 text-[11px] text-emerald-400 transition-colors">
        <CheckCircle2 className="w-3.5 h-3.5" style={{ animation: 'refreshDone 0.35s cubic-bezier(0.16,1,0.3,1) both' }} />
        Готово
      </button>
    );
  }

  if (state === 'checking') {
    return (
      <button type="button" disabled className="flex items-center gap-1.5 text-[11px] text-violet-400 transition-colors">
        <RefreshCw className="w-3.5 h-3.5" style={{ animation: 'refreshSpin 0.7s linear infinite' }} />
        Проверка...
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      Обновить
    </button>
  );
}
