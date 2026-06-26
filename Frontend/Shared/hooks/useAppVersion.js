import { useState, useEffect } from 'react';
import * as appWindow from '@API/appWindow';
import pkg from '../../../package.json';

// ─── useAppVersion ───────────────────────────────────────────────────────────
// Returns the running app's version. Prefers the authoritative value from the
// main process (`app.getVersion()` — reflects the actually installed/packaged
// build), falling back to the bundled package.json version (used at first
// render and when running outside Electron).

export function useAppVersion() {
  const [version, setVersion] = useState(pkg?.version || '0.0.0');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = await appWindow.getVersion();
      if (!cancelled && v) setVersion(v);
    })();
    return () => { cancelled = true; };
  }, []);

  return version;
}
