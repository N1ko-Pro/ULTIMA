const fs = require('fs');
const path = require('path');
const { DICTIONARY_USER_FILE_NAME } = require('./dictionary_utils/constants');
const { protectGlossaryInText, restoreGlossaryFromMap, entriesToGlossaryPairs } = require('./dictionary_utils/textProcessor');

// ─────────────────────────────────────────────────────────────────────────────
//  DictionaryManager — per-game user glossary.
//
//  Each game has its OWN glossary so MSC terms never mix with the BG3 D&D
//  glossary. Entries live in <userData>/glossary/<file>:
//    • bg3            → glossary_user.json   (legacy name kept for back-compat)
//    • <other gameId> → glossary_<gameId>_user.json
//  A game may have a bundled default file (BG3 ships the D&D glossary); games
//  without one (MSC) simply start empty and the user builds their own.
//
//  The active game is switched via `setActiveGame(gameId)` (called by the
//  renderer when entering a game). All CRUD + translation helpers operate on
//  the active game's entries.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_GAME = 'bg3';

class DictionaryManager {
  constructor() {
    this._glossaryDir = null;
    this._defaults = {};        // gameId -> absolute default file path
    this._games = {};           // gameId -> { storagePath, entries }
    this._activeGame = DEFAULT_GAME;
  }

  /**
   * @param {string} basePath  userData path
   * @param {string|Record<string,string>} defaults  legacy: a single BG3 default
   *        path; preferred: a map of gameId -> default glossary file path.
   */
  initialize(basePath, defaults) {
    if (!basePath) return;
    this._defaults = typeof defaults === 'string' ? { [DEFAULT_GAME]: defaults } : (defaults || {});
    this._glossaryDir = path.join(basePath, 'glossary');
    if (!fs.existsSync(this._glossaryDir)) {
      fs.mkdirSync(this._glossaryDir, { recursive: true });
    }
    this._games = {};
    this.setActiveGame(DEFAULT_GAME);
  }

  _userFileName(gameId) {
    return gameId === DEFAULT_GAME ? DICTIONARY_USER_FILE_NAME : `glossary_${gameId}_user.json`;
  }

  _readEntries(filePath) {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(
        (e) => e && typeof e.source === 'string' && typeof e.target === 'string',
      ).map((e) => ({ ...e, id: typeof e.id === 'string' ? e.id : undefined }));
    } catch {
      return null;
    }
  }

  // Build a game's state: user file first, else its default, else empty.
  _loadGame(gameId) {
    const storagePath = path.join(this._glossaryDir, this._userFileName(gameId));
    let entries = this._readEntries(storagePath);
    if (entries === null) {
      entries = this._readEntries(this._defaults[gameId]) || [];
    }
    // Ensure every entry has a stable id.
    let counter = 0;
    entries = entries.map((e) => ({
      id: e.id || String(++counter),
      source: e.source,
      target: e.target,
      tag: e.tag || 'mechanics',
    }));
    return { storagePath, entries };
  }

  /** Switch the active game's glossary (loads it on first use). */
  setActiveGame(gameId) {
    const id = gameId || DEFAULT_GAME;
    this._activeGame = id;
    if (!this._games[id] && this._glossaryDir) {
      this._games[id] = this._loadGame(id);
    }
    return id;
  }

  _state() {
    return this._games[this._activeGame] || { storagePath: null, entries: [] };
  }

  resetToDefaults() {
    const id = this._activeGame;
    const defaultEntries = this._readEntries(this._defaults[id]) || [];
    let counter = 0;
    const entries = defaultEntries.map((e) => ({
      id: e.id || String(++counter),
      source: e.source,
      target: e.target,
      tag: e.tag || 'mechanics',
    }));
    const state = this._state();
    state.entries = entries;
    this._save();
    return [...entries];
  }

  _save() {
    const { storagePath, entries } = this._state();
    if (!storagePath) return;
    try {
      fs.writeFileSync(storagePath, JSON.stringify(entries, null, 2), 'utf8');
    } catch (err) {
      console.error('DictionaryManager: failed to save', err?.message);
    }
  }

  _nextId() {
    const { entries } = this._state();
    const maxId = entries.reduce((max, e) => Math.max(max, parseInt(e.id, 10) || 0), 0);
    return String(maxId + 1);
  }

  getAll() {
    return [...this._state().entries];
  }

  getStorageDirectory() {
    return this._glossaryDir;
  }

  getStoragePath() {
    return this._state().storagePath;
  }

  addEntry(source, target, tag) {
    const entry = { id: this._nextId(), source: source.trim(), target: target.trim(), tag: tag || 'mechanics' };
    this._state().entries.push(entry);
    this._save();
    return entry;
  }

  updateEntry(id, source, target, tag) {
    const { entries } = this._state();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    entries[idx] = { id, source: source.trim(), target: target.trim(), tag: tag || entries[idx].tag || 'mechanics' };
    this._save();
    return entries[idx];
  }

  deleteEntry(id) {
    const state = this._state();
    const before = state.entries.length;
    state.entries = state.entries.filter((e) => e.id !== id);
    if (state.entries.length !== before) {
      this._save();
      return true;
    }
    return false;
  }

  toGlossaryPairs() {
    return entriesToGlossaryPairs(this._state().entries);
  }

  protectInText(text) {
    return protectGlossaryInText(text, this._state().entries);
  }

  restoreFromMap(text, map) {
    return restoreGlossaryFromMap(text, map);
  }

  exportToFile(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this._state().entries, null, 2), 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  importFromFile(filePath) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(parsed)) return null;
      const valid = parsed.filter(
        (e) => e && typeof e.source === 'string' && typeof e.target === 'string'
      );
      if (valid.length === 0) return null;
      const state = this._state();
      let maxId = 0;
      state.entries = valid.map((e) => ({
        id: String(++maxId),
        source: e.source.trim(),
        target: e.target.trim(),
        tag: e.tag || 'mechanics',
      }));
      this._save();
      return [...state.entries];
    } catch {
      return null;
    }
  }
}

module.exports = new DictionaryManager();
