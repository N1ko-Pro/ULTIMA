// ─────────────────────────────────────────────────────────────────────────────
//  firstRunManager.js
//  Ensures a clean "out-of-the-box" state on the very first launch after
//  installation: creates %APPDATA%\BG3 ULTIMA, materializes default onboarding
//  config, default glossary, and writes a stamp file so subsequent launches
//  are no-ops.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const STAMP_FILE = '.installed';
const ONBOARDING_FILE = 'onboarding.json';
const GLOSSARY_DIR = 'glossary';
const GLOSSARY_DEFAULT_FILE = 'glossary_default.json';
const GLOSSARY_USER_FILE = 'glossary_user.json';

function getDefaultOnboarding() {
  return {
    eulaAccepted: false,
    welcomeShown: false,
    tutorialStartPage: false,
    tutorialEditor: false,
    tutorialAutoTranslate: false,
    tutorialDictionary: false,
    dotnetInstallLater: false,
  };
}

function safeMkdir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.warn('[firstRun] mkdir failed:', dir, err?.message);
  }
}

function safeCopy(src, dest) {
  try {
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    console.warn('[firstRun] copy failed:', src, '->', dest, err?.message);
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[firstRun] writeJson failed:', file, err?.message);
  }
}

/**
 * Initialize user-data folder on first launch.
 * Safe to call every launch — it's idempotent.
 *
 * @param {object} opts
 * @param {string} opts.userDataPath  app.getPath('userData') → %APPDATA%\BG3 ULTIMA
 * @param {string} opts.defaultGlossaryPath  absolute path to bundled glossary.default.json
 * @returns {{ firstRun: boolean, userDataPath: string }}
 */
function initialize({ userDataPath, defaultGlossaryPath }) {
  safeMkdir(userDataPath);

  const stampPath = path.join(userDataPath, STAMP_FILE);
  const firstRun = !fs.existsSync(stampPath);

  // 1. Onboarding defaults — only seed if the file does not yet exist.
  const onboardingPath = path.join(userDataPath, ONBOARDING_FILE);
  if (!fs.existsSync(onboardingPath)) {
    writeJson(onboardingPath, getDefaultOnboarding());
  }

  // 2. Glossary defaults - copy default file to user data
  const glossaryDir = path.join(userDataPath, GLOSSARY_DIR);
  safeMkdir(glossaryDir);
  const glossaryDefaultTarget = path.join(glossaryDir, GLOSSARY_DEFAULT_FILE);
  if (defaultGlossaryPath) safeCopy(defaultGlossaryPath, glossaryDefaultTarget);

  // 3. Write stamp so we know first-run has happened.
  if (firstRun) {
    try {
      fs.writeFileSync(stampPath, JSON.stringify({
        installedAt: new Date().toISOString(),
        version: 1,
      }, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[firstRun] stamp write failed:', err?.message);
    }
  }

  return { firstRun, userDataPath };
}

module.exports = { initialize, getDefaultOnboarding };
