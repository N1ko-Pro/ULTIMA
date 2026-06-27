// ─────────────────────────────────────────────────────────────────────────────
//  gamePath.js — locate the My Summer Car install directory.
//
//  MSC is a Steam game (appid 516750). We find the Steam root (registry, then
//  common locations), read steamapps/libraryfolders.vdf to enumerate all Steam
//  library folders, and look for `steamapps/common/My Summer Car/mysummercar.exe`
//  in each. Pure helpers (vdf parsing, validation) are exported for testing.
//
//  Everything is best-effort and defensive: any failure yields null so the UI
//  can fall back to a manual folder picker.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GAME_DIR_NAME = 'My Summer Car';
const GAME_EXE = 'mysummercar.exe';

// A folder is a valid MSC install when it contains the game executable.
function isValidGamePath(dir) {
  try {
    return Boolean(dir) && fs.existsSync(path.join(dir, GAME_EXE));
  } catch {
    return false;
  }
}

// Parse the `path` entries out of a libraryfolders.vdf file. Pure & testable.
// Returns absolute library roots (the folder that contains `steamapps`).
function parseSteamLibraries(vdfText) {
  if (!vdfText || typeof vdfText !== 'string') return [];
  const libs = [];
  // Matches:  "path"   "D:\\SteamLibrary"
  const re = /"path"\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(vdfText)) !== null) {
    // VDF escapes backslashes as `\\` — normalise to single separators.
    const p = m[1].replace(/\\\\/g, '\\').replace(/\//g, '\\');
    if (p) libs.push(p);
  }
  return libs;
}

// Best-effort Steam install root(s).
function findSteamRoots() {
  const roots = new Set();

  // 1) Registry (most reliable). HKCU first, then HKLM (32/64-bit views).
  const regQueries = [
    ['HKCU\\Software\\Valve\\Steam', 'SteamPath'],
    ['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'],
    ['HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'],
  ];
  for (const [key, value] of regQueries) {
    try {
      const out = execFileSync('reg', ['query', key, '/v', value], {
        windowsHide: true,
        encoding: 'utf8',
        timeout: 4000,
      });
      // …  SteamPath    REG_SZ    C:\Program Files (x86)\Steam
      const m = out.match(/REG_SZ\s+(.+)\s*$/m);
      if (m && m[1]) roots.add(m[1].trim().replace(/\//g, '\\'));
    } catch { /* key/value absent — ignore */ }
  }

  // 2) Common fallback locations.
  for (const env of ['ProgramFiles(x86)', 'ProgramFiles']) {
    const base = process.env[env];
    if (base) roots.add(path.join(base, 'Steam'));
  }
  roots.add('C:\\Steam');

  return [...roots].filter((r) => {
    try { return fs.existsSync(r); } catch { return false; }
  });
}

// All Steam library roots (the Steam root + every entry in libraryfolders.vdf).
function findSteamLibraries() {
  const libraries = new Set();
  for (const steamRoot of findSteamRoots()) {
    libraries.add(steamRoot);
    const vdf = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    try {
      if (fs.existsSync(vdf)) {
        for (const lib of parseSteamLibraries(fs.readFileSync(vdf, 'utf8'))) {
          libraries.add(lib);
        }
      }
    } catch { /* ignore unreadable vdf */ }
  }
  return [...libraries];
}

/**
 * Auto-detect the MSC install directory, or null if not found.
 * @returns {string|null}
 */
function detectGamePath() {
  try {
    for (const lib of findSteamLibraries()) {
      const candidate = path.join(lib, 'steamapps', 'common', GAME_DIR_NAME);
      if (isValidGamePath(candidate)) return candidate;
    }
  } catch { /* fall through */ }
  return null;
}

// ── Path helpers (relative to a validated game directory) ────────────────────
const getModsFolder = (gameDir) => path.join(gameDir, 'Mods');
const getReferencesFolder = (gameDir) => path.join(gameDir, 'Mods', 'References');
const getConfigFolder = (gameDir) => path.join(gameDir, 'Mods', 'Config', 'MSCLocAPI');

module.exports = {
  GAME_DIR_NAME,
  GAME_EXE,
  isValidGamePath,
  parseSteamLibraries,
  detectGamePath,
  getModsFolder,
  getReferencesFolder,
  getConfigFolder,
};
