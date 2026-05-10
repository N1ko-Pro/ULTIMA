import { useEffect, useState, useCallback } from 'react';

// ─── Tutorial service ───────────────────────────────────────────────────────
// Decides WHEN a scenario tutorial should appear based on the onboarding
// profile and an optional readiness gate. Pure UI-state hook — persistence
// of the "tutorial X completed" flag is the caller's responsibility, so this
// service stays IPC-free and fully testable.
//
// Paired with the scenario components in `UI/Tutorial/` (TutorialEditor,
// TutorialDictionary, ...). Each scenario wraps `TutorialCore` (now in
// `Core/Tutorial/`) with its own steps; this hook decides whether to render
// any of them right now.
//
// Usage:
//   const { isActive, close } = useTutorialTrigger({
//     scenarioKey: 'tutorialEditor',
//     onboarding,
//     ready: isEditorVisible && transitionsReady,
//     delayMs: TUTORIAL.EDITOR_AUTO_OPEN_DELAY_MS,
//   });
//   return isActive
//     ? <TutorialEditor onComplete={async () => { close(); await markDone(); }} onDismiss={close} />
//     : null;

/**
 * @param {{
 *   scenarioKey: string,   // matches the key used inside `onboarding`
 *   onboarding: any,       // onboarding profile object from AppStateService
 *   ready?: boolean,       // gate: only consider triggering when true
 *   delayMs?: number,      // delay before showing, after `ready` flips true
 * }} options
 * @returns {{ isActive: boolean, close: () => void }}
 */
export function useTutorialTrigger({ scenarioKey, onboarding, ready = true, delayMs = 0 }) {
  const wasShown = Boolean(onboarding?.[scenarioKey]);
  const [isClosed, setIsClosed] = useState(false);
  const [delayElapsed, setDelayElapsed] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return undefined;
    if (!ready || wasShown || isClosed) return undefined;
    const timer = setTimeout(() => setDelayElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, ready, wasShown, isClosed]);

  const isActive = ready && !wasShown && !isClosed && delayElapsed;
  const close = useCallback(() => setIsClosed(true), []);

  return { isActive, close };
}
