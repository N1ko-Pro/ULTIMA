// ─── TTL-кэш в памяти + определение времени полета ──────────────────────────────────
// Запоминает асинхронные результаты, которые не меняются в течение короткого периода времени (проект
// список, доступные модели, проверка уровня, ...) и защищает от дублирования
// вызовов IPC в процессе выполнения, которые одновременно используют одну и ту же клавишу.


/**
 * @typedef {Object} Cache
 * @property {(key: string) => any | null} get
 * @property {(key: string, value: any) => void} set
 * @property {<T>(key: string, loader: () => Promise<T>) => Promise<T>} getOrLoad
 *   Returns a cached value if fresh, otherwise calls `loader()` and caches
 *   the resolved result. Concurrent callers for the same key share one
 *   in-flight promise.
 * @property {(key: string) => void} invalidate
 * @property {() => void} clear
 */

/**
 * @param {{ ttl?: number, maxSize?: number }} [options]
 *   `ttl` — entry TTL in ms (default 30s, pass 0 to disable expiry).
 *   `maxSize` — soft cap on entries; oldest is evicted on overflow (default 128).
 * @returns {Cache}
 */
export function createCache({ ttl = 30_000, maxSize = 128 } = {}) {
  /** @type {Map<string, { value: any, expiresAt: number }>} */
  const store = new Map();
  /** @type {Map<string, Promise<any>>} */
  const inflight = new Map();

  const isFresh = (entry) => ttl <= 0 || entry.expiresAt > Date.now();

  const evictIfNeeded = () => {
    while (store.size > maxSize) {
      // Map iterates in insertion order — first key is the oldest.
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  };

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (!isFresh(entry)) {
        store.delete(key);
        return null;
      }
      // Touch: re-insert to mark as most-recently-used for LRU eviction.
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },

    set(key, value) {
      store.set(key, {
        value,
        expiresAt: ttl > 0 ? Date.now() + ttl : Infinity,
      });
      evictIfNeeded();
    },

    async getOrLoad(key, loader) {
      const cached = this.get(key);
      if (cached !== null) return cached;

      const pending = inflight.get(key);
      if (pending) return pending;

      const promise = (async () => {
        try {
          const value = await loader();
          this.set(key, value);
          return value;
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, promise);
      return promise;
    },

    invalidate(key) {
      store.delete(key);
      // Don't cancel inflight — the loader is already running and the
      // result for the previous request is still valid. Callers that need
      // a hard refresh should call `clear()` instead.
    },

    clear() {
      store.clear();
      inflight.clear();
    },
  };
}
