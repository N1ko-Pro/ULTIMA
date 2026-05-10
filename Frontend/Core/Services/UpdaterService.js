import { useCallback, useEffect, useRef, useState } from 'react';
import * as updaterApi from '@API/updater';

// ─── Updater service ────────────────────────────────────────────────────────
// React wrapper around the updater IPC. Subscribes to status events on mount
// so consumers re-render when the underlying state machine moves through:
//   idle → checking → available → download-progress → downloaded → installing
//
// Exposed actions:
//   check(silent)       — query the update server
//   download()          — start downloading the available version
//   install()           — kick off the silent installer (does not quit yet)
//   finalizeInstall()   — quit so NSIS can swap binaries and relaunch

const DEFAULT_STATE = {
  status: 'idle',
  version: null,
  info: null,
  progress: null,
  error: null,
  checkedAt: null,
};

/**
 * @returns {{
 *   state: typeof DEFAULT_STATE,
 *   currentVersion: string,
 *   check:           (silent?: boolean) => Promise<any>,
 *   download:        () => Promise<any>,
 *   install:         () => Promise<any>,
 *   finalizeInstall: () => Promise<any>,
 * }}
 */
export default function useUpdater() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [currentVersion, setCurrentVersion] = useState('');
  const unsubRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await updaterApi.getState();
      if (cancelled || !res?.success) return;
      if (res.state) setState(res.state);
      if (res.currentVersion) setCurrentVersion(res.currentVersion);
    })();

    unsubRef.current = updaterApi.onEvent((next) => {
      if (!cancelled && next) setState(next);
    });

    return () => {
      cancelled = true;
      if (typeof unsubRef.current === 'function') unsubRef.current();
    };
  }, []);

  const check           = useCallback((silent = false) => updaterApi.check({ silent }), []);
  const download        = useCallback(() => updaterApi.download(), []);
  const install         = useCallback(() => updaterApi.install(), []);
  const finalizeInstall = useCallback(() => updaterApi.finalizeInstall(), []);

  return { state, currentVersion, check, download, install, finalizeInstall };
}
