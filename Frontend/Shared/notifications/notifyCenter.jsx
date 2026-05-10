import React, { useState, useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCircle2, Info, AlertTriangle, XCircle, Trash2, CheckCheck, X, Clock, Crown } from 'lucide-react';
import { notifyStore } from './notifyStore';
import { timeAgo } from '../helpers/time';

// ─── Notification center ────────────────────────────────────────────────────
// Bell-icon button in the title bar. Opens a dropdown showing the persistent
// history (`warning` + `error` notifications). Reads via
// `useSyncExternalStore` so we follow `notifyStore` updates without manual
// subscriptions.

const ROW_VARIANTS = {
  success:     { icon: CheckCircle2,  iconColor: 'text-emerald-400',  dot: 'bg-emerald-400' },
  info:        { icon: Info,          iconColor: 'text-blue-400',     dot: 'bg-blue-400' },
  warning:     { icon: AlertTriangle, iconColor: 'text-amber-400',    dot: 'bg-amber-400' },
  error:       { icon: XCircle,       iconColor: 'text-red-400',      dot: 'bg-red-400' },
  subscription:{ icon: Crown,         iconColor: 'text-[#c451f1]',    dot: 'bg-[#c451f1]' },
};

function NotificationRow({ entry, onRemove, onHover, onRowClick }) {
  const variant = entry.action === 'atp-modal'
    ? ROW_VARIANTS.subscription
    : (ROW_VARIANTS[entry.type] || ROW_VARIANTS.info);
  const Icon = variant.icon;
  const isUnread = !entry.read;
  const isClickable = Boolean(entry.action);

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onRowClick?.(entry) : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onRowClick?.(entry) : undefined}
      onMouseEnter={() => onHover?.(entry)}
      className={`group relative flex items-start gap-3 px-4 py-3 transition-colors duration-150 ${
        entry.action === 'atp-modal'
          ? 'hover:bg-[#c451f1]/[0.06]'
          : 'hover:bg-white/[0.03]'
      } ${isUnread ? 'bg-white/[0.02]' : ''} ${isClickable ? 'cursor-pointer' : ''}`}
    >
      {isUnread && (
        <div className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full ${variant.dot}`} />
      )}

      <Icon className={`mt-0.5 w-4 h-4 shrink-0 ${variant.iconColor}`} />
      <div className="flex-1 min-w-0">
        {entry.title && (
          <p className="text-[12px] font-semibold text-zinc-200 leading-snug">{entry.title}</p>
        )}
        {entry.message && (
          <p className="text-[12px] text-zinc-500 leading-relaxed mt-0.5">{entry.message}</p>
        )}
        <p className="flex items-center gap-1 text-[11px] text-zinc-600 mt-1">
          <Clock className="w-2.5 h-2.5 shrink-0" />
          {timeAgo(entry.timestamp)}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(entry.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-white/[0.06] text-zinc-600 hover:text-zinc-300 transition-all duration-150 shrink-0"
        aria-label="Удалить уведомление"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function NotifyCenter({ onUpdatePillClick, onAtpModalClick }) {
  const subscribe = useCallback((cb) => notifyStore.subscribe(cb), []);
  const getSnapshot = useCallback(() => notifyStore.getAll(), []);
  const history = useSyncExternalStore(subscribe, getSnapshot);
  const centerHistory = history.filter((n) => ['info', 'warning', 'error'].includes(n.type));
  const unreadCount = centerHistory.filter((n) => !n.read).length;

  const [isOpen, setIsOpen] = useState(false);
  const [bellRect, setBellRect] = useState(null);
  const bellRef = useRef(null);
  const panelRef = useRef(null);

  // Capture bell coords so the floating panel can anchor to it.
  useEffect(() => {
    if (isOpen && bellRef.current) {
      setBellRect(bellRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  // Outside-click closes the dropdown.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (
        bellRef.current && !bellRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) {
        e._layerConsumed = true;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [isOpen]);

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title="Уведомления"
        data-tutorial="titlebar-notifications"
        className={`group relative flex items-center justify-center w-6 h-6 rounded-md border transition-all duration-200 active:scale-[0.95] ${
          isOpen
            ? 'border-white/[0.16] bg-white/[0.06]'
            : 'border-white/[0.06] bg-transparent hover:border-white/[0.14] hover:bg-white/[0.04]'
        }`}
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <Bell
          className={`w-3.5 h-3.5 transition-colors duration-200 ${
            isOpen ? 'text-zinc-300' : 'text-zinc-500 group-hover:text-zinc-300'
          }`}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold leading-none shadow-[0_0_8px_rgba(239,68,68,0.4)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && bellRect && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[300]"
          style={{
            top:   bellRect.bottom + 6,
            right: window.innerWidth - bellRect.right,
            animation: 'notify-center-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both',
          }}
        >
          {/* Glass-motion panel: translucent surface + backdrop-blur + accent
              gradient + multi-layer shadow. Rendered as overlapping layers
              so the noise/accent don't get blurred along with the background. */}
          <div className="relative w-80 rounded-xl overflow-hidden border border-white/[0.09] shadow-[0_20px_56px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col select-none">
            <div className="absolute inset-0 bg-surface-1/[0.95] backdrop-blur-2xl" />
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent" />

            <div className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <h3 className="text-[13px] font-semibold text-zinc-200 tracking-wide">Уведомления</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => notifyStore.markAllRead()}
                    title="Отметить все как прочитанные"
                    className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all duration-150"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => notifyStore.clear()}
                    title="Очистить все"
                    className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-400/[0.06] transition-all duration-150"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="relative z-10 max-h-[240px] overflow-y-auto overflow-x-hidden">
              {centerHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-6 h-6 text-zinc-700 mb-3" />
                  <p className="text-[13px] text-zinc-600">Нет уведомлений</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {centerHistory.map((entry) => (
                    <NotificationRow
                      key={entry.id}
                      entry={entry}
                      onRemove={(id) => notifyStore.remove(id)}
                      onHover={(e) => { if (!e.action) notifyStore.markRead(e.id); }}
                      onRowClick={(e) => {
                        notifyStore.markRead(e.id);
                        if (e.action === 'update-pill') {
                          onUpdatePillClick?.();
                          setIsOpen(false);
                        } else if (e.action === 'atp-modal') {
                          onAtpModalClick?.();
                          setIsOpen(false);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

    </>
  );
}
