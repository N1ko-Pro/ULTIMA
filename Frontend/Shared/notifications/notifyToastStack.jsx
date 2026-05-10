import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import NotifyToastItem from './notifyToastItem';
import { NOTIFY_EVENT } from './notifyCore';
import { TOAST } from '@Config/timings.constants';

// ─── Toast stack ────────────────────────────────────────────────────────────
// Mounts at app root and listens to the `app-notification` window event.
// Renders up to TOAST.MAX_VISIBLE toasts at the top-right of the viewport.
// Newest on top; the oldest beyond the limit is animated out automatically.

export default function NotifyToastStack() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  /**
   * Animate `id` out, then drop it from state once the exit animation
   * completes. Idempotent — calling twice is harmless.
   */
  const removeToast = useCallback((id) => {
    const durationTimer = timersRef.current.get(id);
    if (durationTimer) {
      clearTimeout(durationTimer);
      timersRef.current.delete(id);
    }

    flushSync(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    });

    const exitTimer = setTimeout(() => {
      timersRef.current.delete(`exit_${id}`);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST.EXIT_MS);
    timersRef.current.set(`exit_${id}`, exitTimer);
  }, []);

  // Subscribe to incoming notifications.
  useEffect(() => {
    const handleNotify = (event) => {
      const { detail } = event;
      const incoming = { ...detail, exiting: false };

      setToasts((prev) => {
        const updated = [incoming, ...prev];

        if (updated.length <= TOAST.MAX_VISIBLE) return updated;

        // Push the oldest beyond the limit out with the same exit animation.
        const overflow = updated[TOAST.MAX_VISIBLE];
        const overflowDurationTimer = timersRef.current.get(overflow.id);
        if (overflowDurationTimer) clearTimeout(overflowDurationTimer);
        timersRef.current.delete(overflow.id);

        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== overflow.id));
        }, TOAST.EXIT_MS);

        return updated.map((t) => (t.id === overflow.id ? { ...t, exiting: true } : t));
      });

      if (detail.duration) {
        const timerId = setTimeout(() => removeToast(detail.id), detail.duration);
        timersRef.current.set(detail.id, timerId);
      }
    };

    window.addEventListener(NOTIFY_EVENT, handleNotify);
    return () => window.removeEventListener(NOTIFY_EVENT, handleNotify);
  }, [removeToast]);

  // Cleanup all pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return (
    <div className="fixed top-28 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <NotifyToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
