// ─────────────────────────────────────────────────────────────────────────────
//  patcherRelease.js — resolve the LATEST published MSCLoc API patcher version
//  live from the ULTIMA_TOOLS GitHub releases, instead of relying solely on the
//  version pinned into the app at build time (toolConfig.MSC_PATCHER).
//
//  Why: the pinned version goes stale between app releases, so a freshly
//  published patcher (e.g. MSCLoc-API-v1.0.13) was invisible to already-shipped
//  app builds. This queries GitHub, picks the highest semver among
//  `MSCLoc-API-v*` releases that actually carry the MSCLocAPI.dll asset, and
//  returns its real download URL.
//
//  Safety:
//    • Fully fail-silent — any network/parse/rate-limit error falls back to the
//      pinned MSC_PATCHER (so offline installs still work).
//    • The pinned version acts as a FLOOR: a resolved version is only used when
//      it is >= the pinned one (never downgrade below the build's known-good).
//    • Result is cached in-memory with a short TTL to avoid hammering the API.
//
//  No auth is needed (the repo is public). Unauthenticated GitHub API calls are
//  rate-limited (~60/h per IP); the cache keeps us well under that.
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');
const {
  MSC_PATCHER,
  GH_TOOLS_OWNER,
  GH_TOOLS_REPO,
  PATCHER_TAG_PREFIX,
} = require('../toolConfig');

const TTL_MS = 15 * 60 * 1000; // re-check at most every 15 minutes
const REQUEST_TIMEOUT_MS = 8000;

// cache.value: { version, downloadUrl, tag } when a newer release is found,
// or null when the pinned fallback should be used. cache.at = last resolve time.
let cache = { at: 0, value: undefined };

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function cmpSemver(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function fetchReleasesJson() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: 'api.github.com',
        path: `/repos/${GH_TOOLS_OWNER}/${GH_TOOLS_REPO}/releases?per_page=50`,
        headers: {
          'User-Agent': 'ULTIMA-app',
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`GitHub API HTTP ${res.statusCode}`));
          return;
        }
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(Array.isArray(parsed) ? parsed : []);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

// Scan releases → highest semver `MSCLoc-API-v*` that ships MSCLocAPI.dll.
function pickBest(releases) {
  const pinned = parseSemver(MSC_PATCHER.version);
  let best = null; // { sem, version, downloadUrl, tag }
  for (const rel of releases) {
    if (!rel || rel.draft) continue;
    const tag = rel.tag_name || '';
    if (!tag.startsWith(PATCHER_TAG_PREFIX)) continue;
    const version = tag.slice(PATCHER_TAG_PREFIX.length);
    const sem = parseSemver(version);
    if (!sem) continue;
    const asset = (rel.assets || []).find((a) => a.name === MSC_PATCHER.fileName);
    if (!asset || !asset.browser_download_url) continue;
    if (!best || cmpSemver(sem, best.sem) > 0) {
      best = { sem, version, downloadUrl: asset.browser_download_url, tag };
    }
  }
  // Only use the resolved release when it is at least the pinned floor.
  if (best && pinned && cmpSemver(best.sem, pinned) >= 0) {
    return { version: best.version, downloadUrl: best.downloadUrl, tag: best.tag };
  }
  return null;
}

/**
 * Resolve the latest patcher release (cached). Returns
 *   { version, downloadUrl, tag }  when a usable GitHub release was found, or
 *   null                           to signal "use the pinned MSC_PATCHER".
 */
async function resolveLatest() {
  if (cache.value !== undefined && Date.now() - cache.at < TTL_MS) {
    return cache.value;
  }
  try {
    const releases = await fetchReleasesJson();
    cache = { at: Date.now(), value: pickBest(releases) };
  } catch {
    // Network/parse failure → cache the fallback briefly so a flaky connection
    // doesn't retry on every status poll.
    cache = { at: Date.now(), value: null };
  }
  return cache.value;
}

/**
 * The effective "available" target without doing I/O: the cached resolved
 * release if we have one, else the pinned MSC_PATCHER. Always returns
 * { version, downloadUrl } so callers can use it directly.
 */
function getTarget() {
  const v = cache.value;
  if (v) return { version: v.version, downloadUrl: v.downloadUrl, tag: v.tag };
  return { version: MSC_PATCHER.version, downloadUrl: MSC_PATCHER.downloadUrl };
}

/** Async variant of getTarget — refreshes from GitHub first. */
async function resolveTarget() {
  await resolveLatest();
  return getTarget();
}

/** Cached effective version (sync) — pinned fallback until first resolve. */
function peekLatestVersion() {
  return cache.value ? cache.value.version : MSC_PATCHER.version;
}

module.exports = { resolveLatest, resolveTarget, getTarget, peekLatestVersion };
