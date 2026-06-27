const path = require('path');
const crypto = require('crypto');
const { normalizeCode, DEFAULT_LANG_CODE } = require('../shared_utils/languages');
const { isValidGameId, DEFAULT_GAME_ID } = require('../../games/gameRegistry');

const PROJECT_SCHEMA_VERSION = 3;

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : fallback;
}

function normalizeTranslations(value) {
  const source = ensureObject(value);
  const normalized = {};

  for (const [key, raw] of Object.entries(source)) {
    // Meta maps (_bookmarks, _hidden, _techOverride, _view) are objects and must
    // survive verbatim — stringifying them corrupts the data (→ "[object Object]").
    if (raw && typeof raw === 'object') {
      normalized[key] = raw;
      continue;
    }
    normalized[key] = typeof raw === 'string' ? raw : String(raw ?? '');
  }

  return normalized;
}

function inferProjectName(projectData) {
  if (typeof projectData.name === 'string' && projectData.name.trim().length > 0) {
    return projectData.name;
  }

  if (typeof projectData.pakPath === 'string' && projectData.pakPath.trim().length > 0) {
    return path.basename(projectData.pakPath, '.pak') || 'Unknown Mod';
  }

  return 'Unknown Mod';
}

function normalizeProjectRecord(projectData, options = {}) {
  const source = ensureObject(projectData);
  const now = Date.now();
  const existingCreatedAt = options.existingCreatedAt;

  const projectId = normalizeText(source.id, options.fallbackId || crypto.randomUUID());
  const pakPath = normalizeText(source.pakPath);
  if (!pakPath) {
    return null;
  }

  const createdAtFallback = normalizeTimestamp(existingCreatedAt, now);
  const createdAt = normalizeTimestamp(source.createdAt, createdAtFallback);
  const updatedAt = normalizeTimestamp(source.updatedAt ?? source.lastModified, now);

  const translations = normalizeTranslations(source.translations);
  const author = normalizeText(source.author || translations.author || '');
  const workspaceDirName = normalizeText(source.workspaceDirName);

  // Schema v3: targetLanguage. Older records (v2) lack the field — fall back
  // to the historical default ('ru'). normalizeLangCode also defends against
  // unknown / typo'd codes so saved data can never poison downstream paths.
  const targetLanguage = normalizeCode(source.targetLanguage || DEFAULT_LANG_CODE);

  // Game ownership. Legacy records predate multi-game support — they were all
  // Baldur's Gate 3, so a missing/unknown value falls back to the default game.
  const game = isValidGameId(source.game) ? source.game : DEFAULT_GAME_ID;

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: projectId,
    name: inferProjectName(source),
    author,
    workspaceDirName,
    pakPath,
    targetLanguage,
    game,
    translations,
    createdAt,
    updatedAt,
    lastModified: updatedAt,
  };
}

function toProjectSummary(projectRecord) {
  return {
    id: projectRecord.id,
    name: projectRecord.name,
    author: projectRecord.author || '',
    pakPath: projectRecord.pakPath,
    targetLanguage: projectRecord.targetLanguage || DEFAULT_LANG_CODE,
    game: projectRecord.game || DEFAULT_GAME_ID,
    createdAt: projectRecord.createdAt,
    updatedAt: projectRecord.updatedAt,
    lastModified: projectRecord.lastModified,
  };
}

module.exports = {
  ensureObject,
  normalizeProjectRecord,
  toProjectSummary,
};
