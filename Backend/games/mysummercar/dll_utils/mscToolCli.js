// ─────────────────────────────────────────────────────────────────────────────
//  mscToolCli.js — thin wrapper around the bundled MscLocTool.exe (dnlib).
//  Mirrors the BG3 DivineCliUtils pattern: resolve the exe, run it via execFile,
//  parse its JSON stdout.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs = require('fs');
const os = require('os');
const util = require('util');
const { execFile } = require('child_process');
const execFileAsync = util.promisify(execFile);
const { EXE_NAME } = require('../toolConfig');

const EXEC_OPTIONS = { windowsHide: true, maxBuffer: 128 * 1024 * 1024 };

let toolDir = null;

function configure(dir) {
  toolDir = dir;
}

function getExePath() {
  return toolDir ? path.join(toolDir, EXE_NAME) : null;
}

function isPresent() {
  const exe = getExePath();
  return Boolean(exe && fs.existsSync(exe));
}

function ensureAvailable() {
  if (!isPresent()) {
    const err = new Error('MSC_TOOL_MISSING');
    err.code = 'MSC_TOOL_MISSING';
    throw err;
  }
}

/**
 * @param {string} dllPath
 * @returns {Promise<{ id: string, text: string }[]>}
 */
async function extract(dllPath) {
  ensureAvailable();
  const { stdout } = await execFileAsync(getExePath(), ['extract', dllPath], EXEC_OPTIONS);
  return JSON.parse(stdout || '[]');
}

/**
 * @param {string} dllPath
 * @param {Record<string,string>} translations  id → translated text
 * @param {string} outPath
 * @returns {Promise<{ replaced: number }>}
 */
async function inject(dllPath, translations, outPath) {
  ensureAvailable();
  const tmp = path.join(os.tmpdir(), `msc-tr-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, JSON.stringify(translations), 'utf8');
  try {
    const { stdout } = await execFileAsync(getExePath(), ['inject', dllPath, tmp, outPath], EXEC_OPTIONS);
    return JSON.parse(stdout || '{"replaced":0}');
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

module.exports = { configure, getExePath, isPresent, extract, inject };
