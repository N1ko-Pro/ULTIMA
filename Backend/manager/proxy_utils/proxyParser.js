const { toSafeString } = require("../shared_utils/textUtils");

function _splitProxyList(rawValue) {
  return toSafeString(rawValue)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProxyUrl({ protocol = "http", host, port, username, password }) {
  if (!host || !port) return "";

  const authPart = username
    ? `${encodeURIComponent(username)}:${encodeURIComponent(toSafeString(password))}@`
    : "";

  return `${protocol}://${authPart}${host}:${port}`;
}

function normalizeProxyEntry(entry) {
  if (typeof entry === "string") return entry.trim();
  if (!entry || typeof entry !== "object") return "";

  if (entry.url) return toSafeString(entry.url).trim();

  return buildProxyUrl({
    protocol: toSafeString(entry.protocol || "http").trim().toLowerCase() || "http",
    host: toSafeString(entry.host).trim(),
    port: Number(entry.port),
    username: entry.username,
    password: entry.password,
  });
}

function dedupeProxyList(proxyList) {
  return Array.from(new Set((proxyList || []).map((item) => item.trim()).filter(Boolean)));
}

function maskProxyUrl(proxyUrl) {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return proxyUrl.replace(/\/\/(.*):(.*)@/, "//***:***@");
  }
}

function buildProxyListFromRangeConfig(config) {
  const host = toSafeString(config?.host).trim();
  const protocol = toSafeString(config?.protocol || "http").trim().toLowerCase() || "http";
  const username = config?.username;
  const password = config?.password;
  const portStart = Number(config?.portStart);
  const portEnd = Number(config?.portEnd);

  if (!host || !Number.isFinite(portStart) || !Number.isFinite(portEnd)) return [];

  const safeStart = Math.max(1, Math.floor(Math.min(portStart, portEnd)));
  const safeEnd = Math.max(1, Math.floor(Math.max(portStart, portEnd)));

  const proxies = [];
  for (let port = safeStart; port <= safeEnd; port += 1) {
    proxies.push(buildProxyUrl({ protocol, host, port, username, password }));
  }
  return proxies;
}

function parseProxyConfigObject(configObject) {
  if (!configObject || typeof configObject !== "object") return [];

  if (Array.isArray(configObject)) {
    return dedupeProxyList(configObject.map(normalizeProxyEntry));
  }
  if (Array.isArray(configObject.proxies)) {
    return dedupeProxyList(configObject.proxies.map(normalizeProxyEntry));
  }
  return dedupeProxyList(buildProxyListFromRangeConfig(configObject));
}

module.exports = {
  normalizeProxyEntry,
  dedupeProxyList,
  maskProxyUrl,
  parseProxyConfigObject,
};
