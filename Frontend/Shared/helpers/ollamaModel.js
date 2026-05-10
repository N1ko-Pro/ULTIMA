// ─── Ollama model helpers ────────────────────────────────────────────────────
// Pure utilities for matching Ollama model ids to installed model names.
// Used by both the ATP panel (useOllamaStatus) and the AI Settings tab (AiPage).

/**
 * Returns true when `modelId` matches any name in `installedNames`.
 * Handles `:latest` suffix, explicit tags and `hf.co/…` hashes.
 *
 * @param {string} modelId         Configured or target model id.
 * @param {string[]} installedNames List of `name` strings from Ollama's /api/tags.
 * @returns {boolean}
 */
export function isOllamaModelInstalled(modelId, installedNames) {
  if (!installedNames?.length) return false;
  const id = modelId.toLowerCase();
  return installedNames.some((name) => {
    const nl = name.toLowerCase();
    if (nl === id)                                                  return true;
    if (nl === `${id}:latest`)                                      return true;
    if (nl.startsWith(`${id}:`))                                    return true;
    if (id.includes(':') && nl.startsWith(`${id.split(':')[0]}:`))  return true;
    if (id.startsWith('hf.co/') && nl.includes(id.replace('hf.co/', ''))) return true;
    return false;
  });
}
