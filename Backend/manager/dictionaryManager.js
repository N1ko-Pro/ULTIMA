const fs = require('fs');
const path = require('path');
const { DICTIONARY_DEFAULT_FILE_NAME, DICTIONARY_USER_FILE_NAME } = require('./dictionary_utils/constants');
const { protectGlossaryInText, restoreGlossaryFromMap, entriesToGlossaryPairs } = require('./dictionary_utils/textProcessor');

class DictionaryManager {
  constructor() {
    this._storagePath = null;
    this._defaultFilePath = null;
    this._entries = [];
  }

  initialize(basePath, defaultFilePath) {
    if (!basePath) return;
    this._defaultFilePath = defaultFilePath;
    const glossaryDir = path.join(basePath, 'glossary');
    if (!fs.existsSync(glossaryDir)) {
      fs.mkdirSync(glossaryDir, { recursive: true });
    }
    // Always save to user file
    this._storagePath = path.join(glossaryDir, DICTIONARY_USER_FILE_NAME);
    // Load from user file if it exists, otherwise load from default
    if (fs.existsSync(this._storagePath)) {
      this._load();
    } else if (this._defaultFilePath && fs.existsSync(this._defaultFilePath)) {
      this._loadFromDefault();
    } else {
      this._entries = [];
    }
  }

  _loadFromDefault() {
    if (!this._defaultFilePath) {
      this._entries = [];
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this._defaultFilePath, 'utf8'));
      this._entries = Array.isArray(parsed)
        ? parsed.filter((e) => e && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string')
        : [];
      console.log('DictionaryManager: loaded from default glossary');
    } catch {
      this._entries = [];
    }
  }

  _load() {
    if (!this._storagePath || !fs.existsSync(this._storagePath)) {
      this._entries = [];
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(this._storagePath, 'utf8'));
      this._entries = Array.isArray(parsed)
        ? parsed.filter((e) => e && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string')
        : [];
      console.log('DictionaryManager: loaded from user glossary');
    } catch {
      this._entries = [];
    }
  }

  resetToDefaults() {
    if (!this._defaultFilePath) return null;
    this._loadFromDefault();
    return [...this._entries];
  }

  _save() {
    if (!this._storagePath) return;
    try {
      fs.writeFileSync(this._storagePath, JSON.stringify(this._entries, null, 2), 'utf8');
    } catch (err) {
      console.error('DictionaryManager: failed to save', err?.message);
    }
  }

  _nextId() {
    const maxId = this._entries.reduce((max, e) => Math.max(max, parseInt(e.id, 10) || 0), 0);
    return String(maxId + 1);
  }

  getAll() {
    return [...this._entries];
  }

  getStorageDirectory() {
    return this._storagePath ? path.dirname(this._storagePath) : null;
  }

  getStoragePath() {
    return this._storagePath;
  }

  addEntry(source, target, tag) {
    const entry = { id: this._nextId(), source: source.trim(), target: target.trim(), tag: tag || 'mechanics' };
    this._entries.push(entry);
    this._save();
    return entry;
  }

  updateEntry(id, source, target, tag) {
    const idx = this._entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    this._entries[idx] = { id, source: source.trim(), target: target.trim(), tag: tag || this._entries[idx].tag || 'mechanics' };
    this._save();
    return this._entries[idx];
  }

  deleteEntry(id) {
    const before = this._entries.length;
    this._entries = this._entries.filter((e) => e.id !== id);
    if (this._entries.length !== before) {
      this._save();
      return true;
    }
    return false;
  }

  toGlossaryPairs() {
    return entriesToGlossaryPairs(this._entries);
  }

  protectInText(text) {
    return protectGlossaryInText(text, this._entries);
  }

  restoreFromMap(text, map) {
    return restoreGlossaryFromMap(text, map);
  }

  exportToFile(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this._entries, null, 2), 'utf8');
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
      let maxId = this._entries.reduce((m, e) => Math.max(m, parseInt(e.id, 10) || 0), 0);
      this._entries = valid.map((e) => ({
        id: String(++maxId),
        source: e.source.trim(),
        target: e.target.trim(),
        tag: e.tag || 'mechanics',
      }));
      this._save();
      return [...this._entries];
    } catch {
      return null;
    }
  }
}

module.exports = new DictionaryManager();
