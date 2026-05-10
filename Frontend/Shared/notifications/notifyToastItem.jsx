import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X, Crown } from 'lucide-react';

// ─── Single live toast ──────────────────────────────────────────────────────
// Rendered by `NotifyToastStack`. Self-contained: handles its own enter/exit
// animation, timer-bar progress and close button.

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    radial:    'radial-gradient(ellipse at right top, rgba(16,118,102,0.55) 0%, rgba(15,15,18,0.97) 55%, rgba(15,15,18,0.97) 100%)',
    border:    'border-emerald-500/25',
    accent:    'from-transparent via-emerald-400/30 to-transparent',
    timerBar:  'bg-emerald-400/60',
    glow:      'rgba(16,185,129,0.12)',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    radial:    'radial-gradient(ellipse at right top, rgba(30,80,200,0.50) 0%, rgba(15,15,18,0.97) 55%, rgba(15,15,18,0.97) 100%)',
    border:    'border-blue-500/25',
    accent:    'from-transparent via-blue-400/30 to-transparent',
    timerBar:  'bg-blue-400/60',
    glow:      'rgba(59,130,246,0.12)',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    radial:    'radial-gradient(ellipse at right top, rgba(160,100,10,0.50) 0%, rgba(15,15,18,0.97) 55%, rgba(15,15,18,0.97) 100%)',
    border:    'border-amber-500/25',
    accent:    'from-transparent via-amber-400/30 to-transparent',
    timerBar:  'bg-amber-400/60',
    glow:      'rgba(245,158,11,0.12)',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-red-400',
    radial:    'radial-gradient(ellipse at right top, rgba(160,50,35,0.55) 0%, rgba(15,15,18,0.97) 55%, rgba(15,15,18,0.97) 100%)',
    border:    'border-red-500/25',
    accent:    'from-transparent via-red-400/30 to-transparent',
    timerBar:  'bg-red-400/60',
    glow:      'rgba(239,68,68,0.12)',
  },
  subscription: {
    icon: Crown,
    iconColor: 'text-[#c451f1]',
    radial:    'radial-gradient(ellipse at right top, rgba(140,40,180,0.50) 0%, rgba(15,15,18,0.97) 55%, rgba(15,15,18,0.97) 100%)',
    border:    'border-[#c451f1]/25',
    accent:    'from-transparent via-[#c451f1]/30 to-transparent',
    timerBar:  'bg-[#c451f1]/60',
    glow:      'rgba(196,81,241,0.14)',
  },
};

const FALLBACK_VARIANT = VARIANTS.info;

const NOISE_BG_URL =
  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")';

export default function NotifyToastItem({ toast, onRemove }) {
  const variant = toast.action === 'atp-modal'
    ? VARIANTS.subscription
    : (VARIANTS[toast.type] || FALLBACK_VARIANT);
  const Icon = variant.icon;
  const { duration, exiting } = toast;
  const timerRef = useRef(null);

  // Animate the timer bar from 100% → 0% over `duration` ms. Reset before
  // each run so a re-mounted toast (rare) restarts cleanly.
  useEffect(() => {
    if (!duration || !timerRef.current) return;
    const bar = timerRef.current;
    bar.style.transition = 'none';
    bar.style.width = '100%';
    void bar.offsetWidth; // force reflow before transition
    bar.style.transition = `width ${duration}ms linear`;
    bar.style.width = '0%';
  }, [duration]);

  return (
    <div
      className={`isolate group/card relative w-[340px] rounded-2xl border ${variant.border} pointer-events-auto overflow-hidden opacity-95 hover:opacity-100 transition-[opacity,transform,filter]`}
      style={{
        background: variant.radial,
        boxShadow: `0 1px 1px ${variant.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        animation: exiting
          ? 'notify-toast-exit 0.38s cubic-bezier(0.4,0,1,1) forwards'
          : 'notify-toast-enter 0.48s cubic-bezier(0.22,1,0.36,1) forwards',
      }}
    >
      <div className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r ${variant.accent} pointer-events-none`} />

      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: NOISE_BG_URL, backgroundSize: '120px' }}
      />

      <div className="absolute top-0 left-0 right-0 flex justify-end px-3 pt-3 z-10">
        <button
          type="button"
          onClick={() => onRemove(toast.id)}
          className="group/close relative p-1.5 rounded-lg overflow-hidden transition-colors duration-200 hover:bg-white/[0.08]"
          aria-label="Закрыть уведомление"
        >
          <span className="absolute inset-0 rounded-lg opacity-0 group-hover/close:opacity-100 transition-opacity duration-200 ring-1 ring-white/20" />
          <X className="relative w-[13px] h-[13px] text-zinc-600 group-hover/close:text-zinc-100 transition-colors duration-200" />
        </button>
      </div>

      <div className="relative flex items-start gap-3.5 pt-4 pb-3 px-4">
        <Icon className={`mt-0.5 w-[22px] h-[22px] shrink-0 ${variant.iconColor}`} />
        <div className="flex-1 min-w-0 pr-5">
          {toast.title && (
            <h4 className="text-[13px] font-semibold text-white leading-snug tracking-[0.01em]">
              {toast.title}
            </h4>
          )}
          {toast.message && (
            <p className="text-[11.5px] text-zinc-400 mt-1 leading-relaxed">
              {toast.message}
            </p>
          )}
        </div>
      </div>

      {duration ? (
        <div className="relative h-[2px] w-full bg-white/[0.04]">
          <div
            ref={timerRef}
            className={`absolute left-0 top-0 h-full ${variant.timerBar} rounded-full`}
            style={{ width: '100%' }}
          />
        </div>
      ) : null}

    </div>
  );
}
