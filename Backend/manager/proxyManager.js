const { ProxyAgent } = require("proxy-agent");
const {
  normalizeProxyEntry,
  dedupeProxyList,
  maskProxyUrl,
  parseProxyConfigObject,
} = require("./proxy_utils/proxyParser");

class ProxyManager {
  constructor() {
    this.proxyPool = [];
    this.currentIndex = -1;
    this.agentByProxyUrl = new Map();
  }

  /** Replace the entire pool with a raw array of proxy entries. */
  setPool(proxyEntries) {
    this.proxyPool = dedupeProxyList((proxyEntries || []).map(normalizeProxyEntry));
    this.currentIndex = this.proxyPool.length > 0 ? 0 : -1;
    this.agentByProxyUrl.clear();
  }

  /** Build pool from a config object (range, list, or direct array). */
  setPoolFromConfig(configObject) {
    this.setPool(parseProxyConfigObject(configObject));
  }

  /** Clear the pool entirely. */
  clearPool() {
    this.setPool([]);
  }

  hasPool() {
    return this.proxyPool.length > 0;
  }

  getPoolSize() {
    return this.proxyPool.length;
  }

  getActiveProxy() {
    if (this.currentIndex < 0 || this.currentIndex >= this.proxyPool.length) return null;
    return this.proxyPool[this.currentIndex];
  }

  getActiveProxyMasked() {
    const active = this.getActiveProxy();
    return active ? maskProxyUrl(active) : null;
  }

  /** Rotate to the next proxy in the pool. Returns false if pool has ≤1 entry. */
  rotate() {
    if (this.proxyPool.length <= 1) return false;
    this.currentIndex = (this.currentIndex + 1) % this.proxyPool.length;
    return true;
  }

  /** Get a cached ProxyAgent for the active proxy (or null). */
  getAgent() {
    const active = this.getActiveProxy();
    if (!active) return null;

    if (!this.agentByProxyUrl.has(active)) {
      this.agentByProxyUrl.set(active, new ProxyAgent(active));
    }
    return this.agentByProxyUrl.get(active);
  }

  /** Summary for inclusion in runtime settings responses. */
  getRuntimeInfo() {
    return {
      enabled: this.hasPool(),
      poolSize: this.getPoolSize(),
      active: this.getActiveProxyMasked(),
    };
  }
}

module.exports = new ProxyManager();
