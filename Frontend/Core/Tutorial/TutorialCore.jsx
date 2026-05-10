import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useLocale } from '@Locales/LocaleProvider';

// ─── TutorialCore ───────────────────────────────────────────────────────────
// Spotlight tutorial overlay engine. Specialized scenario components
// (TutorialEditor, TutorialDictionary, ...) compose this primitive with their
// own steps array. Targets are matched via `[data-tutorial="..."]` attributes
// on real DOM nodes.
//
// Step shape:
//   {
//     target?:        string,          // single data-tutorial id
//     targets?:       string[],        // multiple — spotlight wraps all
//     title:          string,
//     description:    string,
//     padding?:       number,          // spotlight padding around the rect
//     borderRadius?:  number,          // spotlight rounded corners
//     position?:      'right' | 'left' | 'below',  // tooltip placement
//     tooltipAnchor?: string,          // anchor tooltip to a different element
//     delay?:         number,          // ms to wait before measuring
//   }
//
// Props:
//   steps:        Step[]
//   onComplete:   called when last step is finished or "Skip" is clicked
//   onDismiss:    called when user X-closes the overlay (does NOT mark done)
//   onBeforeStep: (index, prev) => void | { delay?: number, track?: number }
//                  Use to open panels/tabs before a step. Returning `{ track }`
//                  enables per-frame tracking for the given duration so the
//                  spotlight follows an element that animates into place.
//   id:           unique string used to scope the SVG mask id

const TRANSITION_MS = 300;

/**
 * @param {{
 *   steps: any[],
 *   onComplete: () => void,
 *   onBeforeStep?: (index: number, prev: number | null) => void | number | { delay?: number, track?: number },
 *   id?: string,
 * }} props
 */
export default function TutorialCore({ steps, onComplete, onBeforeStep, id = 'tutorial' }) {
  const t = useLocale();
  const [currentStep, setCurrentStep] = useState(0);
  const [rects, setRects] = useState(null);
  const [visible, setVisible] = useState(false);
  const [tooltipH, setTooltipH] = useState(200);
  const [isTracking, setIsTracking] = useState(false);
  const overlayRef = useRef(null);
  const tooltipRef = useRef(null);
  const measureTimerRef = useRef(null);
  const trackingRAFRef = useRef(null);
  const prevStepRef = useRef(null);
  const isTrackingRef = useRef(false);

  const step = steps[currentStep];
  const maskId = `${id}-mask-${currentStep}`;
  const rect = rects?.[0] ?? null;
  const hasSpotlight = Array.isArray(rects) && rects.length > 0;

  /** Re-measure all targets of the current step. */
  const measure = useCallback(() => {
    if (!step) return;
    const targetNames = step.targets ?? (step.target ? [step.target] : []);
    if (!targetNames.length) {
      setRects([]);
      return;
    }
    const pad = step.padding ?? 12;
    const newRects = targetNames
      .map((name) => {
        const el = document.querySelector(`[data-tutorial="${name}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top:    r.top - pad,
          left:   r.left - pad,
          width:  r.width + pad * 2,
          height: r.height + pad * 2,
        };
      })
      .filter(Boolean);
    if (newRects.length) setRects(newRects);
  }, [step]);

  useEffect(() => {
    clearTimeout(measureTimerRef.current);
    cancelAnimationFrame(trackingRAFRef.current);

    const prevStep = prevStepRef.current;
    prevStepRef.current = currentStep;

    const config = onBeforeStep ? (onBeforeStep(currentStep, prevStep) ?? null) : null;
    const delay = (typeof config === 'number' ? config : config?.delay) ?? step?.delay ?? 0;
    const track = typeof config === 'object' && config !== null ? (config.track ?? 0) : 0;

    const doMeasure = () => {
      const wasTracking = isTrackingRef.current;

      if (track > 0) {
        // Phase 1 — keep CSS transitions, glide spotlight to the new initial position.
        // Phase 2 — switch to per-frame tracking so the spotlight follows animations.
        isTrackingRef.current = true;
        setIsTracking(false);

        trackingRAFRef.current = requestAnimationFrame(() => {
          measure();
          measureTimerRef.current = setTimeout(() => {
            setIsTracking(true);
            const remaining = Math.max(0, track - TRANSITION_MS);
            const endTime = performance.now() + remaining;
            const loop = () => {
              measure();
              if (performance.now() < endTime) {
                trackingRAFRef.current = requestAnimationFrame(loop);
              } else {
                isTrackingRef.current = false;
                setIsTracking(false);
              }
            };
            loop();
          }, TRANSITION_MS);
        });
        return;
      }

      if (wasTracking) {
        isTrackingRef.current = false;
        setIsTracking(false);
        trackingRAFRef.current = requestAnimationFrame(measure);
        return;
      }

      measure();
    };

    if (delay > 0) {
      measureTimerRef.current = setTimeout(doMeasure, delay);
    } else {
      doMeasure();
    }

    const raf = requestAnimationFrame(() => setVisible(true));
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(measureTimerRef.current);
      cancelAnimationFrame(trackingRAFRef.current);
      isTrackingRef.current = false;
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(raf);
    };
  }, [currentStep, measure, onBeforeStep, step?.delay]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const h = tooltipRef.current.offsetHeight;
      setTooltipH((prev) => (prev !== h ? h : prev));
    }
  });

  const goNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onComplete]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleSkip = useCallback(() => onComplete(), [onComplete]);

  if (rects === null) {
    return <div className="fixed inset-0 z-[200] bg-black/50 pointer-events-auto" />;
  }

  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  // Tooltip placement — always uses pixel top/left for smooth transitions.
  const tooltipStyle = {};
  const gap = 16;
  const tooltipWidth = 340;

  let anchorRect = rect;
  if (step.tooltipAnchor && hasSpotlight) {
    const anchorEl = document.querySelector(`[data-tutorial="${step.tooltipAnchor}"]`);
    if (anchorEl) {
      const ar = anchorEl.getBoundingClientRect();
      const pad = step.padding ?? 12;
      anchorRect = {
        top:    ar.top - pad,
        left:   ar.left - pad,
        width:  ar.width + pad * 2,
        height: ar.height + pad * 2,
      };
    }
  }

  if (!hasSpotlight) {
    tooltipStyle.top = Math.max(16, (window.innerHeight - tooltipH) / 2);
    tooltipStyle.left = Math.max(16, (window.innerWidth - Math.min(420, window.innerWidth - 32)) / 2);
    tooltipStyle.width = Math.min(420, window.innerWidth - 32);
  } else if (step.position === 'right') {
    tooltipStyle.top = Math.min(anchorRect.top, window.innerHeight - tooltipH - 16);
    let left = anchorRect.left + anchorRect.width + gap;
    if (left + tooltipWidth > window.innerWidth - 16) left = anchorRect.left - tooltipWidth - gap;
    tooltipStyle.left = Math.max(16, left);
    tooltipStyle.width = tooltipWidth;
  } else if (step.position === 'left') {
    tooltipStyle.top = Math.min(anchorRect.top, window.innerHeight - tooltipH - 16);
    let left = anchorRect.left - tooltipWidth - gap;
    if (left < 16) left = anchorRect.left + anchorRect.width + gap;
    tooltipStyle.left = Math.max(16, left);
    tooltipStyle.width = tooltipWidth;
  } else if (step.position === 'below') {
    tooltipStyle.top = anchorRect.top + anchorRect.height + gap;
    let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    tooltipStyle.left = left;
    tooltipStyle.width = tooltipWidth;
  } else {
    const spaceBelow = window.innerHeight - (anchorRect.top + anchorRect.height) - gap;
    const fitsBelow = spaceBelow >= tooltipH + 8;
    tooltipStyle.top = fitsBelow
      ? anchorRect.top + anchorRect.height + gap
      : Math.max(16, anchorRect.top - gap - tooltipH);
    let left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    tooltipStyle.left = left;
    tooltipStyle.width = tooltipWidth;
  }

  const transitionStyle = isTracking ? { transition: 'none' } : { transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)' };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            {rects.map((r, i) => (
              <rect
                key={i}
                x={r.left}
                y={r.top}
                width={r.width}
                height={r.height}
                rx={step.borderRadius ?? 16}
                fill="black"
                style={transitionStyle}
              />
            ))}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask={`url(#${maskId})`}
          style={{ pointerEvents: 'auto' }}
        />
      </svg>

      {rects.map((r, i) => (
        <div
          key={i}
          className="absolute border-2 border-blue-400/50 pointer-events-none transition-all duration-300"
          style={{
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            borderRadius: step.borderRadius ?? 16,
            boxShadow: '0 0 0 4px rgba(96,165,250,0.15)',
            ...(isTracking ? { transitionDuration: '0ms' } : {}),
          }}
        />
      ))}

      <div
        ref={tooltipRef}
        className="absolute bg-surface-2 border border-white/[0.12] rounded-2xl p-5 shadow-2xl transition-all duration-300"
        style={{
          ...tooltipStyle,
          ...(isTracking ? { transitionDuration: '0ms' } : {}),
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
            {currentStep + 1} / {steps.length}
          </span>
        </div>

        <h3 className="text-[15px] font-semibold text-zinc-100 mb-1.5">{step.title}</h3>
        <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {t.tutorial?.skip || 'Skip'}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={goPrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] text-zinc-300 bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t.tutorial?.prev || 'Back'}
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              {isLast ? (t.tutorial?.finish || 'Finish') : (t.tutorial?.next || 'Next')}
              {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
