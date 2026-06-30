#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  scripts/release-tool.js
//  One-command release for the external C# tools hosted in N1ko-Pro/ULTIMA_TOOLS
//  (MSCLocAPI.dll и MscLocTool.exe).
//
//      npm run release:tool msc-loc-api patch   <------- КОММАНАД ДЛЯ ЗАПУСКА
//
//  Unlike the app (scripts/release.js builds + publishes the installer itself),
//  the tools are built by GitHub Actions in the ULTIMA_TOOLS repo. A release is
//  triggered by pushing a tag (`MSCLoc-API-v*` / `msc-tools-v*`); CI then builds
//  the asset and attaches it to a pre-release. This script automates everything
//  around that:
//
//    1. Picks a tool (msc-loc-api | msc-tool) and a version bump.
//    2. Bumps the version in this repo's sources:
//         • the tool's .csproj  <Version>
//         • (patcher only) src/MSCLocAPI.cs  Version => "x.y.z"
//         • Backend/games/mysummercar/toolConfig.js  (version + tag in downloadUrl)
//    3. (optional) Builds locally to catch errors before pushing.
//    4. Syncs the tool source from this repo into a local ULTIMA_TOOLS clone,
//       commits and pushes it to `main`.
//    5. Deletes any existing release/tag for that version (so CI starts clean).
//    6. Creates + pushes the matching tag to ULTIMA_TOOLS → triggers CI.
//    7. Polls the GitHub API until the release asset is published.
//    8. Commits the version bump in this repo.
//
//  Requirements:
//    - A `GH_TOKEN` (or `GITHUB_TOKEN`) with `repo` scope in `.env` at the root.
//    - git + dotnet on PATH.
//
//  Usage:
//    node scripts/release-tool.js                 (fully interactive)
//    node scripts/release-tool.js msc-loc-api patch
//    node scripts/release-tool.js msc-tool minor --skip-build
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const TOOLCONFIG_PATH = path.join(ROOT, 'Backend', 'games', 'mysummercar', 'toolConfig.js');
const CLONE_DIR = path.join(ROOT, '.ultima_tools_clone');

const GH_OWNER = 'N1ko-Pro';
const GH_REPO = 'ULTIMA_TOOLS';

// ─── Tool definitions ──────────────────────────────────────────────────────
// Each tool maps its source in THIS repo to a subfolder in the ULTIMA_TOOLS
// clone, and lists every place its version lives so a bump stays consistent.
const TOOLS = {
  'msc-loc-api': {
    id: 'msc-loc-api',
    displayName: 'MSCLoc API — патчер перевода (.dll)',
    tagPrefix: 'MSCLoc-API-v',
    assetFile: 'MSCLocAPI.dll',
    appDir: path.join('tools', 'MSC', 'MSCLoc-API'),
    destDir: 'MSCLocAPI',
    // Relative to appDir. Directories are mirrored (stale files removed).
    syncItems: ['src', 'References', 'tests', 'MSCLocAPI.csproj', 'README.md', 'RELEASE.md'],
    csproj: path.join('tools', 'MSC', 'MSCLoc-API', 'MSCLocAPI.csproj'),
    csVersionFile: path.join('tools', 'MSC', 'MSCLoc-API', 'src', 'MSCLocAPI.cs'),
    toolConfigConst: 'MSC_PATCHER',
    // CI workflow synced into the clone so the app's copy is the source of truth.
    workflow: {
      src: path.join('tools', 'MSC', 'MSCLoc-API', 'ci', 'build-loc-patcher.yml'),
      dest: path.join('.github', 'workflows', 'build-loc-patcher.yml'),
    },
    // Stale folders in the clone to remove (e.g. after a rename).
    removeDirs: ['UltimaLocPatcher'],
    // Local verification: build net35 + run the pure-core tests.
    build: [
      { label: 'build (net35)', cmd: 'dotnet', args: ['build', '-c', 'Release', path.join('tools', 'MSC', 'MSCLoc-API', 'MSCLocAPI.csproj')] },
      { label: 'tests', cmd: 'dotnet', args: ['run', '-c', 'Release', '--project', path.join('tools', 'MSC', 'MSCLoc-API', 'tests', 'MSCLocAPI.Tests.csproj')] },
    ],
  },
  'msc-tool': {
    id: 'msc-tool',
    displayName: 'MscLocTool — dnlib extract/inject (.exe)',
    tagPrefix: 'msc-tools-v',
    assetFile: 'MscLocTool.exe',
    appDir: path.join('tools', 'MSC', 'MSCLoc-Tool'),
    destDir: 'MscLocTool',
    syncItems: ['Program.cs', 'MscLocTool.csproj', 'README.md'],
    csproj: path.join('tools', 'MSC', 'MSCLoc-Tool', 'MscLocTool.csproj'),
    csVersionFile: null,
    toolConfigConst: 'MSC_TOOL',
    build: [
      { label: 'build', cmd: 'dotnet', args: ['build', '-c', 'Release', path.join('tools', 'MSC', 'MSCLoc-Tool', 'MscLocTool.csproj')] },
    ],
  },
};

// ─── Minimal .env loader (no external deps) ────────────────────────────────
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const withoutExport = line.replace(/^export\s+/, '');
      const eq = withoutExport.indexOf('=');
      if (eq === -1) continue;
      const key = withoutExport.slice(0, eq).trim();
      let value = withoutExport.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (err) {
    console.warn('[release-tool] failed to read .env:', err?.message);
  }
}

loadDotEnv(ENV_PATH);

// ─── Prompt helpers ────────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split('.').map((n) => parseInt(n, 10) || 0);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  return current;
}

// ─── Version reads / writes ────────────────────────────────────────────────
function readCsprojVersion(csprojRel) {
  const abs = path.join(ROOT, csprojRel);
  const raw = fs.readFileSync(abs, 'utf-8');
  const m = raw.match(/<Version>\s*([^<\s]+)\s*<\/Version>/);
  if (!m) throw new Error(`Не нашёл <Version> в ${csprojRel}`);
  return m[1];
}

function writeCsprojVersion(csprojRel, next) {
  const abs = path.join(ROOT, csprojRel);
  const raw = fs.readFileSync(abs, 'utf-8');
  const updated = raw.replace(/<Version>\s*[^<\s]+\s*<\/Version>/, `<Version>${next}</Version>`);
  fs.writeFileSync(abs, updated, 'utf-8');
}

function writeCsFileVersion(csRel, next) {
  const abs = path.join(ROOT, csRel);
  const raw = fs.readFileSync(abs, 'utf-8');
  const updated = raw.replace(/(Version\s*=>\s*")[^"]+(")/, `$1${next}$2`);
  if (updated === raw) throw new Error(`Не нашёл строку Version => "..." в ${csRel}`);
  fs.writeFileSync(abs, updated, 'utf-8');
}

// Updates `version: '...'` and the release tag inside a specific
// `const <NAME> = Object.freeze({ ... });` block of toolConfig.js.
function writeToolConfigVersion(constName, tagPrefix, oldVer, next) {
  const raw = fs.readFileSync(TOOLCONFIG_PATH, 'utf-8');
  const startMarker = `const ${constName} = Object.freeze({`;
  const start = raw.indexOf(startMarker);
  if (start === -1) throw new Error(`Не нашёл блок ${constName} в toolConfig.js`);
  const end = raw.indexOf('});', start);
  if (end === -1) throw new Error(`Не нашёл конец блока ${constName} в toolConfig.js`);

  const before = raw.slice(0, start);
  let block = raw.slice(start, end);
  const after = raw.slice(end);

  block = block.replace(/version:\s*'[^']+'/, `version: '${next}'`);
  block = block.split(`${tagPrefix}${oldVer}`).join(`${tagPrefix}${next}`);

  fs.writeFileSync(TOOLCONFIG_PATH, before + block + after, 'utf-8');
}

// ─── File sync (mirror app source → clone subfolder) ───────────────────────
function syncSource(tool) {
  const srcRoot = path.join(ROOT, tool.appDir);
  const destRoot = path.join(CLONE_DIR, tool.destDir);
  fs.mkdirSync(destRoot, { recursive: true });

  for (const item of tool.syncItems) {
    const src = path.join(srcRoot, item);
    const dest = path.join(destRoot, item);
    if (!fs.existsSync(src)) {
      console.warn(`    ⚠ Пропуск (нет в репо): ${item}`);
      continue;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      // Mirror: wipe dest dir first so deleted files don't linger.
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    console.log(`    ✔ ${item}`);
  }

  // Remove stale folders (e.g. a previous name after a rename).
  for (const dir of tool.removeDirs || []) {
    const stale = path.join(CLONE_DIR, dir);
    if (stale !== destRoot && fs.existsSync(stale)) {
      fs.rmSync(stale, { recursive: true, force: true });
      console.log(`    ✖ удалена устаревшая папка: ${dir}`);
    }
  }
}

// ─── GitHub API helpers (mirrors scripts/release.js) ───────────────────────
async function ghRequest(opts) {
  const maxAttempts = 4;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ghRequestOnce(opts);
    } catch (err) {
      lastErr = err;
      const isTransient = err && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || /timeout|socket hang up/i.test(err.message || ''));
      if (!isTransient || attempt === maxAttempts) throw err;
      const delay = 1000 * attempt;
      console.warn(`  ⚠ GitHub API попытка ${attempt}/${maxAttempts} не удалась (${err.code || err.message}). Повтор через ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function ghRequestOnce({ method, pathUrl, token, body }, _redirects = 0) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'User-Agent': `${GH_OWNER}-${GH_REPO}-tool-release`,
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request({
      hostname: 'api.github.com',
      path: pathUrl,
      method,
      headers,
      timeout: 15000,
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location && _redirects < 3) {
        res.resume();
        const location = res.headers.location;
        const newPath = location.startsWith('http') ? new URL(location).pathname : location;
        resolve(ghRequestOnce({ method, pathUrl: newPath, token, body }, _redirects + 1));
        return;
      }
      let resBody = '';
      res.on('data', (c) => { resBody += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: resBody }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function deleteExistingRelease({ token, tag }) {
  try {
    const get = await ghRequest({ method: 'GET', pathUrl: `/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${tag}`, token });
    if (get.status === 200) {
      const rel = JSON.parse(get.body);
      const del = await ghRequest({ method: 'DELETE', pathUrl: `/repos/${GH_OWNER}/${GH_REPO}/releases/${rel.id}`, token });
      if (del.status === 204) console.log(`  ✔ Удалён существующий релиз ${tag} (id=${rel.id}).`);
      else console.warn(`  ⚠ Не удалось удалить релиз ${tag} (HTTP ${del.status}): ${del.body}`);
    } else if (get.status !== 404) {
      console.warn(`  ⚠ Проверка релиза ${tag} вернула HTTP ${get.status}.`);
    }
    const tagDel = await ghRequest({ method: 'DELETE', pathUrl: `/repos/${GH_OWNER}/${GH_REPO}/git/refs/tags/${tag}`, token });
    if (tagDel.status === 204) console.log(`  ✔ Удалён git-тег ${tag} на удалёнке.`);
    else if (tagDel.status !== 404 && tagDel.status !== 422) {
      console.warn(`  ⚠ Удаление тега ${tag} вернуло HTTP ${tagDel.status}: ${tagDel.body}`);
    }
  } catch (err) {
    console.warn(`  ⚠ Не удалось очистить прежний релиз: ${err?.message || err}`);
  }
}

// Polls until CI publishes the asset (or times out).
async function waitForAsset({ token, tag, assetFile, maxMinutes = 8 }) {
  const deadline = Date.now() + maxMinutes * 60 * 1000;
  let announced = false;
  while (Date.now() < deadline) {
    const get = await ghRequest({ method: 'GET', pathUrl: `/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${tag}`, token });
    if (get.status === 200) {
      const rel = JSON.parse(get.body);
      const asset = (rel.assets || []).find((a) => a.name === assetFile);
      if (asset && asset.state === 'uploaded') {
        console.log(`  ✔ Ассет опубликован: ${asset.browser_download_url}`);
        return true;
      }
      if (!announced) {
        console.log('  … релиз создан, ждём сборку ассета в GitHub Actions...');
        announced = true;
      }
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.warn(`  ⚠ Ассет ${assetFile} не появился за ${maxMinutes} мин.`);
  console.warn(`    Проверь Actions: https://github.com/${GH_OWNER}/${GH_REPO}/actions`);
  return false;
}

// ─── git helpers ───────────────────────────────────────────────────────────
function gitCapture(cwd, args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf-8', shell: false });
  return { status: res.status, stdout: (res.stdout || '').trim(), stderr: (res.stderr || '').trim() };
}

function gitRun(cwd, args, label, { maskToken } = {}) {
  const shown = maskToken ? args.map((a) => a.replace(maskToken, '***')) : args;
  console.log(`    $ git ${shown.join(' ')}`);
  const res = spawnSync('git', args, { cwd, stdio: 'inherit', shell: false });
  if (res.status !== 0) {
    throw new Error(`${label} завершился с кодом ${res.status}`);
  }
  return true;
}

// Non-fatal variant: returns true/false instead of throwing.
function gitTry(cwd, args, label, opts) {
  try { return gitRun(cwd, args, label, opts); }
  catch (err) { console.warn(`  ⚠ ${label}: ${err.message}`); return false; }
}

// Retry a (network) git command a few times — GitHub access can be flaky
// (VPN/Zapret hiccups). Throws only after the final attempt fails.
function gitRunRetry(cwd, args, label, opts = {}, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try { return gitRun(cwd, args, label, opts); }
    catch (err) {
      if (i === attempts) throw err;
      const delay = 3000 * i;
      console.warn(`  ⚠ ${label} не удалось (попытка ${i}/${attempts}). Повтор через ${delay / 1000}s...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}

function authRemoteUrl(token) {
  return `https://x-access-token:${token}@github.com/${GH_OWNER}/${GH_REPO}.git`;
}

function ensureClone(token) {
  if (fs.existsSync(path.join(CLONE_DIR, '.git'))) return;
  console.log(`  → Клон ULTIMA_TOOLS не найден, клонирую в ${path.relative(ROOT, CLONE_DIR)}...`);
  fs.mkdirSync(path.dirname(CLONE_DIR), { recursive: true });
  const url = token ? authRemoteUrl(token) : `https://github.com/${GH_OWNER}/${GH_REPO}.git`;
  gitRun(ROOT, ['clone', url, CLONE_DIR], 'git clone', { maskToken: token });
}

function syncCloneToRemoteMain() {
  // Make sure the local clone is on a clean, up-to-date main before we layer
  // our source sync on top — avoids pushing on top of a stale tree.
  gitRunRetry(CLONE_DIR, ['fetch', 'origin', 'main', '--tags'], 'git fetch');
  gitRun(CLONE_DIR, ['checkout', 'main'], 'git checkout main');
  gitRun(CLONE_DIR, ['reset', '--hard', 'origin/main'], 'git reset --hard origin/main');
}

// Sync + push the CI workflow in its OWN commit, BEFORE the source commit.
// Updating files under .github/workflows/ requires a token with the `workflow`
// scope; a plain `repo` token is rejected. So this is isolated and non-fatal:
// if the push fails we roll back to origin/main (no source changes exist yet)
// and let the source + tag release proceed, warning the user. Must run while the
// working tree is clean (right after syncCloneToRemoteMain).
function pushWorkflowFirst(tool, token) {
  if (!tool.workflow) return true;
  const wfSrc = path.join(ROOT, tool.workflow.src);
  const wfDest = path.join(CLONE_DIR, tool.workflow.dest);
  if (!fs.existsSync(wfSrc)) return true;

  fs.mkdirSync(path.dirname(wfDest), { recursive: true });
  fs.copyFileSync(wfSrc, wfDest);

  const rel = tool.workflow.dest.replace(/\\/g, '/');
  const status = gitCapture(CLONE_DIR, ['status', '--porcelain', '--', rel]);
  if (!status.stdout) {
    console.log('  ℹ CI-воркфлоу не менялся — пропускаю.');
    return true;
  }

  console.log('  → Синхронизация CI-воркфлоу (отдельный коммит)...');
  gitRun(CLONE_DIR, ['add', '--', rel], 'git add workflow');
  if (!gitTry(CLONE_DIR, ['commit', '-m', `ci: sync ${tool.id} workflow`], 'git commit workflow')) {
    gitTry(CLONE_DIR, ['reset', '--hard', 'origin/main'], 'git reset');
    return false;
  }
  const pushUrl = token ? authRemoteUrl(token) : 'origin';
  const ok = gitTry(CLONE_DIR, ['push', pushUrl, 'HEAD:main'], 'git push workflow', { maskToken: token });
  if (!ok) {
    console.warn('  ⚠ CI-воркфлоу не запушен — у токена, похоже, нет scope `workflow`.');
    console.warn('    Вариант A: пересоздай PAT со scope `repo` + `workflow` и перезапусти.');
    console.warn(`    Вариант B: обнови файл вручную на GitHub: ${GH_OWNER}/${GH_REPO} → ${rel}`);
    console.warn('    (Без актуального воркфлоу CI может собрать релиз неправильно.)');
    // Drop the local workflow commit so the source commit + tag build on a
    // clean origin/main and don't carry the (unpushable) workflow change.
    gitTry(CLONE_DIR, ['reset', '--hard', 'origin/main'], 'git reset');
    return false;
  }
  // Keep the remote-tracking ref in step with what we just pushed so the source
  // commit fast-forwards cleanly on top.
  gitTry(CLONE_DIR, ['fetch', 'origin', 'main'], 'git fetch');
  return true;
}

function commitAndPushClone(tool, version, token) {
  const status = gitCapture(CLONE_DIR, ['status', '--porcelain']);
  if (!status.stdout) {
    console.log('  ℹ Изменений в исходниках инструмента нет — коммит ULTIMA_TOOLS пропущен.');
    return false;
  }
  gitRun(CLONE_DIR, ['add', '-A'], 'git add');
  gitRun(CLONE_DIR, ['commit', '-m', `${tool.id}: v${version}`], 'git commit');
  const pushUrl = token ? authRemoteUrl(token) : 'origin';
  gitRun(CLONE_DIR, ['push', pushUrl, 'HEAD:main'], 'git push', { maskToken: token });
  return true;
}

function pushTag(tag, token) {
  // Create (or move) the tag locally then push it to trigger CI.
  gitRun(CLONE_DIR, ['tag', '-f', tag], 'git tag');
  const pushUrl = token ? authRemoteUrl(token) : 'origin';
  gitRun(CLONE_DIR, ['push', '-f', pushUrl, tag], 'git push tag', { maskToken: token });
}

function commitAppVersionBump(tool, version) {
  const files = [tool.csproj, TOOLCONFIG_PATH];
  if (tool.csVersionFile) files.push(tool.csVersionFile);
  const relFiles = files.map((f) => (path.isAbsolute(f) ? path.relative(ROOT, f) : f));

  try {
    // Commit ONLY the version files (pathspec) — any other in-progress changes
    // in the working tree are deliberately left untouched and uncommitted.
    gitRun(ROOT, ['commit', '-m', `${tool.id}: bump version ${version}`, '--', ...relFiles], 'git commit');
    const branch = gitCapture(ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch.status === 0 && branch.stdout && branch.stdout !== 'HEAD') {
      gitRun(ROOT, ['push', 'origin', branch.stdout], 'git push');
      console.log(`  ✔ Бамп версии закоммичен и запушен в origin/${branch.stdout}.`);
    } else {
      console.warn('  ⚠ Не удалось определить ветку — push пропущен (сделай вручную).');
    }
  } catch (err) {
    console.warn(`  ⚠ Авто-коммит бампа в репо приложения не удался: ${err?.message || err}`);
    console.warn('    Закоммить вручную:', relFiles.join(', '));
  }
}

// ─── Local build verification ──────────────────────────────────────────────
function runBuildSteps(tool) {
  for (const step of tool.build) {
    console.log(`    → ${step.label}: ${step.cmd} ${step.args.join(' ')}`);
    const res = spawnSync(step.cmd, step.args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    if (res.status !== 0) {
      throw new Error(`Локальная проверка "${step.label}" завершилась с кодом ${res.status}`);
    }
  }
}

// ─── Main flow ───────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2);
  const skipBuild = argv.includes('--skip-build');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const argTool = positional[0];
  const argBump = positional[1];

  console.log(`\n╭─────────────────────────────────────────────╮`);
  console.log(`│  ULTIMA TOOLS — Release builder             │`);
  console.log(`╰─────────────────────────────────────────────╯`);

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('⚠  GH_TOKEN (или GITHUB_TOKEN) не найден — пуш и создание релиза не сработают.');
    console.warn('   Пропиши токен в .env в корне проекта: GH_TOKEN=ghp_xxx\n');
  } else {
    console.log('  ✔ GH_TOKEN найден (скрыт).\n');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Tool selection ─────────────────────────────────────────────────────
  let toolId = argTool;
  if (!TOOLS[toolId]) {
    console.log('  Доступные инструменты:');
    Object.values(TOOLS).forEach((t, i) => console.log(`    ${i + 1}) ${t.id} — ${t.displayName}`));
    const ans = (await ask(rl, '  Выбери инструмент [msc-loc-api | msc-tool] (или номер): ')).toLowerCase();
    if (ans === '1') toolId = 'msc-loc-api';
    else if (ans === '2') toolId = 'msc-tool';
    else toolId = ans;
  }
  const tool = TOOLS[toolId];
  if (!tool) {
    rl.close();
    console.error(`✗ Неизвестный инструмент: ${toolId}`);
    process.exit(1);
  }

  const currentVersion = readCsprojVersion(tool.csproj);
  console.log(`\n  Инструмент:   ${tool.displayName}`);
  console.log(`  Тек. версия:  ${currentVersion}`);

  // ── Version bump ─────────────────────────────────────────────────────────
  const bumpKind = (argBump || await ask(rl, 'Bump версии? [patch | minor | major | none] (default: none): ')).toLowerCase() || 'none';
  const nextVersion = bumpKind === 'none' ? currentVersion : bumpVersion(currentVersion, bumpKind);
  const didBump = nextVersion !== currentVersion;
  const tag = `${tool.tagPrefix}${nextVersion}`;

  console.log(`\n  Новая версия: ${nextVersion}`);
  console.log(`  Git-тег:      ${tag}`);
  const confirm = (await ask(rl, '\n  Продолжить релиз? [y/N]: ')).toLowerCase();
  rl.close();
  if (confirm !== 'y' && confirm !== 'yes' && confirm !== 'д' && confirm !== 'да') {
    console.log('  Отменено.');
    return;
  }

  // ── 1. Bump versions in this repo ──────────────────────────────────────
  if (didBump) {
    console.log('\n  → Обновляю версии в исходниках...');
    writeCsprojVersion(tool.csproj, nextVersion);
    console.log(`    ✔ ${tool.csproj} <Version> → ${nextVersion}`);
    if (tool.csVersionFile) {
      writeCsFileVersion(tool.csVersionFile, nextVersion);
      console.log(`    ✔ ${tool.csVersionFile} Version => ${nextVersion}`);
    }
    writeToolConfigVersion(tool.toolConfigConst, tool.tagPrefix, currentVersion, nextVersion);
    console.log(`    ✔ toolConfig.js ${tool.toolConfigConst} version + тег → ${nextVersion}`);
  } else {
    console.log('\n  ℹ Версия не меняется — пере-релиз текущей.');
  }

  // ── 2. Local build verification ────────────────────────────────────────
  if (!skipBuild) {
    console.log('\n  → Локальная проверка сборки...');
    try {
      runBuildSteps(tool);
      console.log('  ✔ Локальная сборка прошла.');
    } catch (err) {
      console.error(`\n✗ ${err.message}`);
      console.error('  Релиз остановлен. Исправь ошибки или запусти с --skip-build.');
      process.exit(1);
    }
  } else {
    console.log('\n  ⏭ Локальная сборка пропущена (--skip-build).');
  }

  // ── 3. Sync source into ULTIMA_TOOLS clone + push ──────────────────────
  console.log('\n  → Синхронизация исходников в клон ULTIMA_TOOLS...');
  ensureClone(token);
  try {
    syncCloneToRemoteMain();
  } catch (err) {
    console.error(`✗ Не удалось привести клон к origin/main: ${err.message}`);
    process.exit(1);
  }

  // CI workflow first, in its own commit (needs `workflow` token scope). Failure
  // is non-fatal — the source + tag still release.
  pushWorkflowFirst(tool, token);

  syncSource(tool);

  console.log('\n  → Коммит и push в ULTIMA_TOOLS (main)...');
  try {
    commitAndPushClone(tool, nextVersion, token);
  } catch (err) {
    console.error(`✗ Push в ULTIMA_TOOLS не удался: ${err.message}`);
    process.exit(1);
  }

  // ── 4. Clean previous release/tag, then push the trigger tag ───────────
  if (token) {
    console.log(`\n  → Очистка предыдущего релиза/тега ${tag}...`);
    await deleteExistingRelease({ token, tag });
  }

  console.log(`\n  → Создаю и пушу тег ${tag} (запуск CI)...`);
  try {
    pushTag(tag, token);
  } catch (err) {
    console.error(`✗ Push тега не удался: ${err.message}`);
    process.exit(1);
  }

  // ── 5. Wait for CI to publish the asset ────────────────────────────────
  if (token) {
    console.log('\n  → Ожидание публикации ассета (GitHub Actions)...');
    await waitForAsset({ token, tag, assetFile: tool.assetFile });
  }

  // ── 6. Commit the version bump in this repo ────────────────────────────
  if (didBump) {
    console.log('\n  → Коммит бампа версии в репозитории приложения...');
    commitAppVersionBump(tool, nextVersion);
  }

  console.log(`\n✓ Готово. Релиз ${tag} запущен на ${GH_OWNER}/${GH_REPO}.`);
  console.log(`    Ассет: https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/${tag}/${tool.assetFile}`);
  console.log(`    Actions: https://github.com/${GH_OWNER}/${GH_REPO}/actions\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
