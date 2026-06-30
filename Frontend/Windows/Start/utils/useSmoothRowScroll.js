import { useCallback, useRef } from 'react';

// ─── useSmoothRowScroll ───────────────────────────────────────────────────────
// Premium, seamless row scrolling for the projects grid.
//
// Model = "discrete target row + continuous smoothing":
//   • Each wheel notch instantly bumps an integer `targetRow` by one (so even a
//     single small flick reliably advances exactly one row — responsive, no
//     dead zone, no cooldown). A trackpad's fine deltas accumulate to a row.
//   • Every frame the actual scroll eases toward that target with frame-rate-
//     independent exponential smoothing (time constant TAU) — a buttery glide
//     that re-targets seamlessly while you keep scrolling.
//   • The target is always a row multiple, so it always lands cleanly aligned
//     without any snap-back that fights the user.
//
// Light top/bottom fade hints at more content. All imperative — no re-renders.
// Returns a CALLBACK ref so it binds exactly on mount/unmount.
//
// Tuning: `resistance` = mouse-wheel resistance — how many wheel notches it
// takes to advance one row. 1 = one notch → one row (default); >1 heavier wheel
// (more notches per row); <1 lighter (one notch jumps several rows). It scales
// trackpad travel-per-row too. Glide smoothness is the separate `TAU`.
export function useSmoothRowScroll(rowStep = 244, { resistance = 1 } = {}) {
  const cleanupRef = useRef(null);

  return useCallback((node) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!node) return;

    const el = node;
    const TAU = 0.15;        // glide smoothness (s) — separate from wheel resistance
    const NOTCH = 40;        // |delta px| >= this = a discrete mouse-wheel notch
    const TRACK_STEP = 55;   // trackpad px per row (before resistance)
    const FADE = 30;         // px edge-fade band
    const EDGE = 0.25;       // residual alpha at the edge (0 = full, 1 = none)

    let raf = 0;
    let running = false;
    let current = el.scrollTop;
    let targetRow = Math.round(current / rowStep);
    let accum = 0;       // trackpad px accumulator
    let rowAccum = 0;    // fractional rows from wheel notches (for resistance > 1)
    let lastT = 0;

    const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);
    const clampRow = (r) => Math.max(0, Math.min(Math.ceil(maxScroll() / rowStep), r));
    const targetPos = () => Math.min(targetRow * rowStep, maxScroll());

    const applyMask = () => {
      const max = maxScroll();
      if (max <= 1) { el.style.maskImage = ''; el.style.webkitMaskImage = ''; return; }
      const start = el.scrollTop > 2 ? `rgba(0,0,0,${EDGE}) 0, #000 ${FADE}px` : '#000 0';
      const end = el.scrollTop < max - 2 ? `#000 calc(100% - ${FADE}px), rgba(0,0,0,${EDGE}) 100%` : '#000 100%';
      const m = `linear-gradient(to bottom, ${start}, ${end})`;
      el.style.maskImage = m;
      el.style.webkitMaskImage = m;
    };

    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
      lastT = now;
      const goal = targetPos();
      const alpha = 1 - Math.exp(-dt / TAU); // frame-rate-independent lerp
      current += (goal - current) * alpha;
      if (Math.abs(goal - current) < 0.4) {
        current = goal;
        el.scrollTop = current;
        applyMask();
        running = false;
        return;
      }
      el.scrollTop = current;
      applyMask();
      raf = requestAnimationFrame(tick);
    };

    const run = () => {
      if (!running) {
        running = true;
        current = el.scrollTop; // resync to where we actually are
        lastT = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onWheel = (e) => {
      if (maxScroll() <= 1) return; // nothing to scroll → let the page handle it
      e.preventDefault();

      // Re-anchor to the real position when a fresh gesture starts.
      if (!running) targetRow = Math.round(el.scrollTop / rowStep);

      // Normalize delta to pixels (line / page wheel modes).
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= el.clientHeight;

      if (Math.abs(dy) >= NOTCH) {
        // Mouse-wheel notch. `resistance` = how many notches per row:
        //   1 → one notch = one row; 2 → two notches per row (heavier wheel);
        //   0.5 → one notch jumps two rows (lighter/faster).
        const dir = Math.sign(dy);
        if (rowAccum !== 0 && Math.sign(rowAccum) !== dir) rowAccum = 0; // snappy on reversal
        rowAccum += dir / resistance;
        const whole = Math.trunc(rowAccum);
        if (whole !== 0) {
          targetRow = clampRow(targetRow + whole);
          rowAccum -= whole;
        }
        accum = 0;
      } else {
        // Fine trackpad scroll → accumulate px to whole rows; resistance scales
        // how much travel a row costs.
        const dir = Math.sign(dy);
        if (accum !== 0 && Math.sign(accum) !== dir) accum = 0;
        accum += dy;
        const step = TRACK_STEP * resistance;
        while (Math.abs(accum) >= step) {
          targetRow = clampRow(targetRow + Math.sign(accum));
          accum -= Math.sign(accum) * step;
        }
      }
      run();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    applyMask();
    cleanupRef.current = () => {
      el.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
      el.style.maskImage = '';
      el.style.webkitMaskImage = '';
    };
  }, [rowStep, resistance]);
}
