#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  scripts/release.js
//  Interactive one-command release:
//    1. Prompts for release notes (multi-line) and version bump (optional).
//    2. Writes build/release-notes.md so electron-builder embeds them.
//    3. Deletes any pre-existing GitHub release/tag for the target version
//       so our title + notes are ALWAYS applied (GitHub API otherwise keeps
//       the old release body when assets are re-uploaded).
//    4. Runs `vite build` + `electron-builder --win --publish always`.
//    5. electron-builder uploads only the installer .exe and latest.yml
//       (delta-updates: .blockmap generated via nsis.differentialPackage=true).
//
//  Requirements before running:
//    - A `GH_TOKEN` (or `GITHUB_TOKEN`) env var with `repo` scope.
//      Store it in `.env` at the project root as `GH_TOKEN=ghp_xxx`.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const NOTES_PATH = path.join(ROOT, 'build', 'release-notes.md');
const ENV_PATH = path.join(ROOT, '.env');

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
    console.warn('[release] failed to read .env:', err?.message);
  }
}

loadDotEnv(ENV_PATH);

// ─── Prompt helpers ────────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}

function askMultiline(rl, question) {
  console.log(question);
  console.log('   (Закончи ввод одной строкой с одной точкой ".")');
  const lines = [];
  return new Promise((resolve) => {
    const onLine = (line) => {
      if (line.trim() === '.') {
        rl.off('line', onLine);
        resolve(lines.join('\n'));
        return;
      }
      lines.push(line);
    };
    rl.on('line', onLine);
  });
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split('.').map((n) => parseInt(n, 10) || 0);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  return current;
}

// ─── GitHub API helpers ────────────────────────────────────────────────────
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
      console.warn(`  ⚠ GitHub API attempt ${attempt}/${maxAttempts} failed (${err.code || err.message}). Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function ghRequestOnce({ method, pathUrl, token, owner, repo, body }, _redirects = 0) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'User-Agent': `${owner}-${repo}-release-script`,
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
        resolve(ghRequestOnce({ method, pathUrl: newPath, token, owner, repo, body }, _redirects + 1));
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

async function deleteExistingRelease({ token, owner, repo, tag }) {
  try {
    const get = await ghRequest({ method: 'GET', pathUrl: `/repos/${owner}/${repo}/releases/tags/${tag}`, token, owner, repo });
    if (get.status === 200) {
      const rel = JSON.parse(get.body);
      const del = await ghRequest({ method: 'DELETE', pathUrl: `/repos/${owner}/${repo}/releases/${rel.id}`, token, owner, repo });
      if (del.status === 204) console.log(`  ✔ Удалён существующий релиз ${tag} (id=${rel.id}).`);
      else console.warn(`  ⚠ Не удалось удалить релиз ${tag} (HTTP ${del.status}): ${del.body}`);
    } else if (get.status !== 404) {
      console.warn(`  ⚠ Проверка релиза ${tag} вернула HTTP ${get.status}.`);
    }
    const tagDel = await ghRequest({ method: 'DELETE', pathUrl: `/repos/${owner}/${repo}/git/refs/tags/${tag}`, token, owner, repo });
    if (tagDel.status === 204) console.log(`  ✔ Удалён git-тег ${tag}.`);
    else if (tagDel.status !== 404 && tagDel.status !== 422) {
      console.warn(`  ⚠ Удаление тега ${tag} вернуло HTTP ${tagDel.status}: ${tagDel.body}`);
    }
  } catch (err) {
    console.warn(`  ⚠ Не удалось очистить прежний релиз: ${err?.message || err}`);
  }
}

// ─── Update release title + body via GitHub API (runs after publish) ──────
async function updateReleaseMetadata({ token, owner, repo, tag, name, body }) {
  // electron-builder publishes async — poll until the release with this tag exists.
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const get = await ghRequest({ method: 'GET', pathUrl: `/repos/${owner}/${repo}/releases/tags/${tag}`, token, owner, repo });
    if (get.status === 200) {
      const rel = JSON.parse(get.body);
      const patch = await ghRequest({
        method: 'PATCH',
        pathUrl: `/repos/${owner}/${repo}/releases/${rel.id}`,
        token, owner, repo,
        body: { name, body, draft: false, prerelease: false },
      });
      if (patch.status === 200) {
        console.log(`  ✔ GitHub release ${tag} обновлён: title + body применены.`);
        return true;
      }
      console.warn(`  ⚠ PATCH релиза вернул HTTP ${patch.status}: ${patch.body}`);
      return false;
    }
    if (get.status !== 404) {
      console.warn(`  ⚠ GET релиза ${tag} вернул HTTP ${get.status}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.warn(`  ⚠ Релиз ${tag} не появился после ${maxAttempts} попыток — title/body не применены.`);
  return false;
}

// ─── Main flow ─────────────────────────────────────────────────────────────
async function main() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  const currentVersion = pkg.version;

  console.log(`\n╭─────────────────────────────────────────────╮`);
  console.log(`│  BG3 ULTIMA — Release builder               │`);
  console.log(`╰─────────────────────────────────────────────╯`);
  console.log(`  Current version: ${currentVersion}\n`);

  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.warn('⚠  GH_TOKEN (или GITHUB_TOKEN) не найден — публикация на GitHub не сработает.');
    console.warn('   Пропиши токен в файле .env в корне проекта:');
    console.warn('     GH_TOKEN=ghp_xxx');
    console.warn('   либо временно в текущей сессии: $env:GH_TOKEN = "ghp_xxx"\n');
  } else {
    console.log('  ✔ GH_TOKEN найден (скрыт).\n');
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const bumpKind = (await ask(rl, 'Bump версии? [patch | minor | major | none] (default: none): ')).toLowerCase() || 'none';
  const nextVersion = bumpKind === 'none' ? currentVersion : bumpVersion(currentVersion, bumpKind);

  if (nextVersion !== currentVersion) {
    pkg.version = nextVersion;
    fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    console.log(`  ✔ package.json обновлён: ${currentVersion} → ${nextVersion}\n`);
  }

  const title = (await ask(rl, `Заголовок релиза (по умолчанию "v${nextVersion}"): `)) || `v${nextVersion}`;
  const notes = await askMultiline(rl, 'Введи текст релиза (поддерживается Markdown):');
  rl.close();

  const notesContent = (notes.trim() || '_No release notes._') + '\n';
  fs.mkdirSync(path.dirname(NOTES_PATH), { recursive: true });
  fs.writeFileSync(NOTES_PATH, notesContent, 'utf-8');
  console.log(`\n  ✔ build/release-notes.md записан.\n`);

  // Wipe any pre-existing release/tag for this version so electron-builder
  // creates a fresh one with OUR title and notes.
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const ghOwner = pkg.build && pkg.build.publish && pkg.build.publish.owner;
  const ghRepo = pkg.build && pkg.build.publish && pkg.build.publish.repo;
  if (token && ghOwner && ghRepo) {
    console.log(`  → Очистка предыдущего релиза v${nextVersion} на ${ghOwner}/${ghRepo}...`);
    await deleteExistingRelease({ token, owner: ghOwner, repo: ghRepo, tag: `v${nextVersion}` });
    console.log('');
  }

  console.log('  → Сборка фронтенда (vite build)...');
  runStep('npx', ['vite', 'build']);

  console.log('\n  → Сборка и публикация инсталлятора (electron-builder)...');
  runStep('npx', ['electron-builder', '--win', '--x64', '--publish', 'always']);

  // ── Give GitHub a moment to process the new release ───────────────────
  await new Promise((r) => setTimeout(r, 2000));

  // ── Force-apply user-provided title + body via GitHub API ──────────────
  if (token && ghOwner && ghRepo) {
    console.log('\n  → Применение заголовка и описания релиза через GitHub API...');
    try {
      await updateReleaseMetadata({
        token,
        owner: ghOwner,
        repo: ghRepo,
        tag: `v${nextVersion}`,
        name: title,
        body: notes.trim() || '_No release notes._',
      });
    } catch (err) {
      console.warn(`  ⚠ Не удалось применить title/body через API: ${err?.message || err}`);
      console.warn('    Релиз создан, но заголовок/описание можно отредактировать вручную на GitHub.');
    }
  }

  console.log('\n✓ Готово. GitHub release создан. Релизятся только:');
  console.log('    • BG3-ULTIMA-Setup-<version>.exe');
  console.log('    • BG3-ULTIMA-Setup-<version>.exe.blockmap (дельта-обновления)');
  console.log('    • latest.yml (метаданные авто-обновлений)\n');
}

function runStep(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (res.status !== 0) {
    console.error(`\n✗ Шаг завершился с ошибкой: ${cmd} ${args.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
