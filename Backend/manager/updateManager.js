// ─────────────────────────────────────────────────────────────────────────────
//  updateManager.js
//  Thin wrapper around electron-updater. Handles check / download / install
//  flow and broadcasts normalized events to the renderer via the main window.
//
//  Event shape sent to renderer (channel: 'updater-event'):
//    { type: 'idle' | 'checking' | 'available' | 'not-available'
//           | 'download-progress' | 'downloaded' | 'installing' | 'error',
//      info?:    { version, releaseDate, releaseNotes },
//      progress?:{ percent, bytesPerSecond, transferred, total },
//      error?:   string }
//
//  The 'installing' phase is driven from the renderer's InstallingUpdateModal:
//    • frontend calls startSilentInstall() — spawns the NSIS installer in
//      silent mode (/S --updated --force-run) but does NOT quit the app;
//    • frontend animates an in-app progress bar to 100 %;
//    • frontend calls finalizeInstall() — Electron quits, NSIS detects the
//      process exit, finishes laying down files, and re-launches the app.
// ─────────────────────────────────────────────────────────────────────────────

const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const EventEmitter = require('events');

class UpdateManager extends EventEmitter {
  constructor() {
    super();
    this._mainWindow = null;
    this._state = {
      status: 'idle',
      version: null,
      info: null,
      progress: null,
      error: null,
      checkedAt: null,
    };
    this._wired = false;
  }

  initialize(mainWindow) {
    this._mainWindow = mainWindow;

    // Lightweight console logger — lets us debug auto-update flow in dev logs.
    autoUpdater.logger = {
      info: (...a) => console.log('[updater]', ...a),
      warn: (...a) => console.warn('[updater]', ...a),
      error: (...a) => console.error('[updater]', ...a),
      debug: () => {},
    };

    // We control install moment from the UI — do NOT auto-install on quit.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;

    if (this._wired) return;
    this._wired = true;

    autoUpdater.on('checking-for-update', () => {
      this._setState({ status: 'checking', error: null });
    });

    autoUpdater.on('update-available', (info) => {
      this._setState({
        status: 'available',
        version: info?.version || null,
        info: normalizeInfo(info),
        error: null,
        checkedAt: Date.now(),
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this._setState({
        status: 'not-available',
        version: info?.version || null,
        info: normalizeInfo(info),
        error: null,
        checkedAt: Date.now(),
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this._setState({
        status: 'download-progress',
        progress: {
          percent: Math.round(progress?.percent || 0),
          bytesPerSecond: progress?.bytesPerSecond || 0,
          transferred: progress?.transferred || 0,
          total: progress?.total || 0,
        },
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this._setState({
        status: 'downloaded',
        version: info?.version || null,
        info: normalizeInfo(info),
        progress: { percent: 100, bytesPerSecond: 0, transferred: 0, total: 0 },
      });
    });

    autoUpdater.on('error', (err) => {
      this._setState({
        status: 'error',
        error: err?.message || String(err),
      });
    });
  }

  _setState(patch) {
    this._state = { ...this._state, ...patch };
    this._broadcast();
  }

  _broadcast() {
    try {
      this._mainWindow?.webContents?.send('updater-event', this._state);
    } catch { /* window may be closed */ }
  }

  getState() {
    return { ...this._state };
  }

  async checkForUpdates({ silent = false } = {}) {
    try {
      if (!this._canCheck()) {
        this._setState({
          status: 'error',
          error: 'Updates are disabled in development builds.',
        });
        return { success: false, error: 'dev-build' };
      }
      const result = await autoUpdater.checkForUpdates();
      return { success: true, silent, result: result ? { updateInfo: normalizeInfo(result.updateInfo) } : null };
    } catch (err) {
      this._setState({ status: 'error', error: err?.message || String(err) });
      return { success: false, error: err?.message || String(err) };
    }
  }

  async downloadUpdate() {
    try {
      if (!this._canCheck()) return { success: false, error: 'dev-build' };
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      this._setState({ status: 'error', error: err?.message || String(err) });
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Legacy: quit immediately and let the NSIS installer take the wheel.
  // Kept for backwards compatibility; the new in-app progress flow uses
  // startSilentInstall + finalizeInstall below instead, because they
  // allow the renderer to keep a progress bar on-screen while NSIS runs.
  quitAndInstall() {
    try {
      autoUpdater.quitAndInstall(true, true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Flip the state machine to 'installing' WITHOUT spawning NSIS yet.
  // The renderer watches for this status and mounts the
  // InstallingUpdateModal, which then animates an in-app progress bar.
  // The actual NSIS installer is only spawned later, inside
  // finalizeInstall(), so NSIS's "wait-for-app-exit" delay does not
  // race the animation.
  startSilentInstall() {
    if (!this._canCheck()) {
      return { success: false, error: 'dev-build' };
    }
    if (this._state.status === 'installing') {
      return { success: true, alreadyInstalling: true };
    }
    // Sanity check: we can only install if an update was actually
    // downloaded. Reuse electron-updater's internal helper to check.
    try {
      const helper = autoUpdater.downloadedUpdateHelper;
      if (!helper || !helper.file) {
        return { success: false, error: 'No downloaded update to install' };
      }
    } catch { /* fall through — try anyway in finalize */ }

    this._setState({
      status: 'installing',
      progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
      error: null,
    });
    return { success: true };
  }

  // Called by the renderer once its in-app install progress bar
  // reaches 100 %. Spawns the NSIS installer silently, then quits
  // Electron so NSIS can replace the .exe + resources and relaunch
  // the new version (via its --force-run flag).
  //
  // Spawning NSIS AT THIS POINT (and not earlier) guarantees that the
  // user has seen the full 0 → 100 % animation before NSIS's own
  // "wait 300 ms + 1000 ms then kill the old app" logic kicks in.
  finalizeInstall() {
    try {
      // autoUpdater.install(isSilent=false, isForceRunAfter=true)
      //   → spawns BG3-ULTIMA-Setup.exe with ["--updated", "--force-run"].
      //   isSilent=false shows the NSIS progress window so the user
      //   can see installation progress after Electron quits.
      const ok = autoUpdater.install(false, true);
      if (!ok) {
        // Fall back to the legacy all-in-one path so we still quit.
        autoUpdater.quitAndInstall(true, true);
        return { success: true, fallback: true };
      }
      // Give the spawn some breathing room so the child process is
      // fully alive before we tear ourselves down.
      setTimeout(() => { try { app.quit(); } catch { /* ignore */ } }, 250);
      return { success: true };
    } catch (err) {
      this._setState({ status: 'error', error: err?.message || String(err) });
      return { success: false, error: err?.message || String(err) };
    }
  }

  _canCheck() {
    // electron-updater cannot update unpackaged dev builds.
    return !!process.versions?.electron && !process.defaultApp;
  }
}

function normalizeInfo(info) {
  if (!info) return null;
  return {
    version: info.version || null,
    releaseDate: info.releaseDate || null,
    releaseName: info.releaseName || null,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
  };
}

module.exports = new UpdateManager();
