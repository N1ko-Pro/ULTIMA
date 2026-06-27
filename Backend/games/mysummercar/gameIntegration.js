// ─────────────────────────────────────────────────────────────────────────────
//  gameIntegration.js — MSC ↔ game-folder integration.
//
//  Lets ULTIMA install the runtime patcher ONCE into the user's game and write
//  translation tables straight into it, so the patcher no longer has to ride
//  along inside every translation artifact. Owns:
//    • the remembered game path (persisted under Tools/MSC/integration.json),
//    • auto-detection (Steam),
//    • installing the patcher DLL into the game's Mods folder,
//    • writing a translation table into the game's Config/MSCLocAPI folder,
//    • a status snapshot for the workspace panel.
//
//  The patcher is installed into `Mods/` (not `Mods/References/`): MSCLoader
//  only runs the Mod lifecycle (OnMenuLoad) for assemblies in Mods/, so that is
//  where the patcher must live to actually translate. It is one tidy utility
//  entry — and crucially it is installed once, not bundled per translation.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const gamePath = require('./dll_utils/gamePath');
const patcherTool = require('./dll_utils/patcherTool');
const { MSC_PATCHER } = require('./toolConfig');

// Patcher lives in Mods/ (see header). Single constant so it is trivial to move.
const PATCHER_INSTALL_SUBDIR = 'Mods';

let storePath = null;   // <userData>/Tools/MSC/integration.json
let cache = null;       // { gamePath }

function configure(toolDir) {
  if (toolDir && typeof toolDir === 'string') {
    storePath = path.join(toolDir, 'integration.json');
    cache = null;
  }
}

function load() {
  if (cache) return cache;
  cache = { gamePath: null };
  try {
    if (storePath && fs.existsSync(storePath)) {
      cache = { gamePath: null, ...JSON.parse(fs.readFileSync(storePath, 'utf8')) };
    }
  } catch { /* keep defaults */ }
  return cache;
}

function save(next) {
  cache = next;
  try {
    if (storePath) {
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      fs.writeFileSync(storePath, JSON.stringify(next, null, 2), 'utf8');
    }
  } catch { /* non-fatal */ }
}

// The remembered game path if it still points at a valid install, else null.
function getGamePath() {
  const stored = load().gamePath;
  return stored && gamePath.isValidGamePath(stored) ? stored : null;
}

// Persist a user-picked path (validated). Returns { ok, gamePath?, error? }.
function setGamePath(dir) {
  if (!gamePath.isValidGamePath(dir)) {
    return { ok: false, error: 'NOT_A_GAME_FOLDER' };
  }
  save({ ...load(), gamePath: dir });
  return { ok: true, gamePath: dir };
}

// Auto-detect via Steam; persist + return the path when found.
function detectAndStore() {
  const detected = gamePath.detectGamePath();
  if (detected) save({ ...load(), gamePath: detected });
  return detected;
}

// Forget the remembered game path (does not touch the game itself).
function clearGamePath() {
  save({ ...load(), gamePath: null });
  return { ok: true };
}

function patcherDestPath(dir) {
  return path.join(dir, PATCHER_INSTALL_SUBDIR, MSC_PATCHER.fileName);
}

// Version sidecar written next to the in-game patcher so we can tell whether
// the copy living in the game is current (the game folder has no downloader
// metadata of its own).
function patcherVersionPath(dir) {
  return path.join(dir, PATCHER_INSTALL_SUBDIR, MSC_PATCHER.versionFile);
}

// Is the patcher present in the resolved game folder?
function isPatcherInstalled(dir = getGamePath()) {
  try {
    return Boolean(dir) && fs.existsSync(patcherDestPath(dir));
  } catch {
    return false;
  }
}

// Version of the patcher currently installed IN THE GAME (sidecar). null when
// unknown (legacy install without a sidecar) — treated as "needs refresh".
function getInstalledPatcherVersion(dir = getGamePath()) {
  if (!dir) return null;
  try {
    const vp = patcherVersionPath(dir);
    if (fs.existsSync(vp)) return fs.readFileSync(vp, 'utf8').trim() || null;
  } catch { /* ignore */ }
  return null;
}

/**
 * Copy the downloaded patcher DLL into the game's Mods folder + record its
 * version alongside it. Requires a valid game path and the patcher already
 * downloaded (Tools/MSC).
 * @returns {{ ok: boolean, installedTo?: string, error?: string }}
 */
function installPatcher(targetVersion) {
  const dir = getGamePath();
  if (!dir) return { ok: false, error: 'GAME_PATH_MISSING' };

  const src = patcherTool.getPath();
  if (!src || !fs.existsSync(src)) return { ok: false, error: 'PATCHER_NOT_DOWNLOADED' };

  try {
    const dest = patcherDestPath(dir);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    // Stamp the installed version so updates can be detected later. Prefer the
    // explicit target (resolved latest), then the downloaded sidecar, then pin.
    const version = targetVersion || patcherTool.getInstalledVersion() || MSC_PATCHER.version;
    try { fs.writeFileSync(patcherVersionPath(dir), version, 'utf8'); } catch { /* non-fatal */ }
    return { ok: true, installedTo: dest };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Remove the patcher (and its version sidecar) from the game's Mods folder.
 * @returns {{ ok: boolean, error?: string }}
 */
function uninstallPatcher() {
  const dir = getGamePath();
  if (!dir) return { ok: false, error: 'GAME_PATH_MISSING' };
  try {
    const dll = patcherDestPath(dir);
    if (fs.existsSync(dll)) fs.rmSync(dll, { force: true });
    const vp = patcherVersionPath(dir);
    if (fs.existsSync(vp)) fs.rmSync(vp, { force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Write a translation table JSON straight into the game's config folder.
 * @param {string} modId   filesystem-safe id (becomes <modId>.json)
 * @param {string} json    serialized table
 * @returns {{ ok: boolean, installedTo?: string, error?: string }}
 */
function installTable(modId, json) {
  const dir = getGamePath();
  if (!dir) return { ok: false, error: 'GAME_PATH_MISSING' };
  try {
    const cfgDir = gamePath.getConfigFolder(dir);
    fs.mkdirSync(cfgDir, { recursive: true });
    const dest = path.join(cfgDir, `${modId}.json`);
    fs.writeFileSync(dest, json, 'utf8');
    return { ok: true, installedTo: dest };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Snapshot for the workspace integration panel. `latestVersion` is the
// effective "available" version (resolved live from GitHub by the caller, with
// the pinned MSC_PATCHER.version as fallback).
function getStatus(latestVersion = MSC_PATCHER.version) {
  const dir = getGamePath();
  const installed = isPatcherInstalled(dir);
  const installedVersion = installed ? getInstalledPatcherVersion(dir) : null;
  return {
    gamePath: dir,
    detected: dir ? false : Boolean(gamePath.detectGamePath()),
    valid: Boolean(dir),
    patcherInstalled: installed,
    patcherName: MSC_PATCHER.name,
    patcherVersion: latestVersion,
    patcherInstalledVersion: installedVersion,
    patcherUpToDate: installed && installedVersion === latestVersion,
  };
}

module.exports = {
  configure,
  getGamePath,
  setGamePath,
  detectAndStore,
  clearGamePath,
  isPatcherInstalled,
  getInstalledPatcherVersion,
  installPatcher,
  uninstallPatcher,
  installTable,
  getStatus,
  patcherDestPath,
};
