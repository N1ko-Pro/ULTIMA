const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { OLLAMA_DEFAULT_BASE_URL } = require("./ollama_utils/constantsAI");
const {
  checkOllamaStatus,
  pullOllamaModel,
  deleteOllamaModel,
} = require("./ollama_utils/provider");
const { installOllama } = require("./ollama_utils/ollamaInstaller");
const { uninstallOllama } = require("./ollama_utils/ollamaUninstaller");
const { startServer, stopServer } = require("./ollama_utils/ollamaServer");
const { resetOllamaContext } = require("./ollama_utils/ollamaChat");
const { getCustomOllamaModelsDir, getCustomOllamaExe } = require("./ollama_utils/ollamaPaths");

class OllamaManager {
  constructor() {
    this.baseUrl = OLLAMA_DEFAULT_BASE_URL;
    this._installCancelCtrl = null;
    this._pullCancelCtrl = null;
    this._activePullModel = null;
    this._lastHealthCheck = null;
    this._healthCheckInterval = 5000; // 5 seconds
  }

  // ── Cancel ─────────────────────────────────────────────────────────────────

  cancelPull() {
    if (!this._pullCancelCtrl) return;
    this._pullCancelCtrl.cancelled = true;
    if (this._pullCancelCtrl.request) {
      try { this._pullCancelCtrl.request.destroy(); } catch { /* best effort */ }
    }
    this._activePullModel = null;
  }

  cancelInstall() {
    if (!this._installCancelCtrl) return;
    this._installCancelCtrl.cancelled = true;
    // Phase 1 (download): destroy the HTTP request stream
    if (this._installCancelCtrl.request) {
      try { this._installCancelCtrl.request.destroy(); } catch { /* best effort */ }
    }
    // Phase 2 (install): write the signal file that the elevated PS script
    // polls for; Stop-Process runs inside the elevated session so it can
    // actually kill OllamaSetup.exe (unelevated taskkill cannot).
    if (this._installCancelCtrl.signalPath) {
      try { fs.writeFileSync(this._installCancelCtrl.signalPath, 'cancel', 'utf8'); } catch { /* best effort */ }
    }
  }

  // ── Filesystem helpers ──────────────────────────────────────────────────────

  _getOllamaModelsDir() {
    this._setCustomEnvironment();
    return process.env.OLLAMA_MODELS;
  }

  /**
   * Delete blob files in the managed Ollama models directory that are NOT referenced
   * by any installed model manifest. This cleans up partial downloads
   * that were cancelled before Ollama wrote their manifest.
   */
  async pruneOrphanBlobs() {
    const modelsDir = this._getOllamaModelsDir();
    const blobsDir = path.join(modelsDir, 'blobs');
    const manifestsDir = path.join(modelsDir, 'manifests');

    if (!fs.existsSync(blobsDir)) return;

    // Collect all blob filenames referenced by existing complete manifests
    const referencedBlobs = new Set();
    if (fs.existsSync(manifestsDir)) {
      const walkDir = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else {
            try {
              const manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
              const layers = [...(manifest.layers || [])];
              if (manifest.config) layers.push(manifest.config);
              for (const layer of layers) {
                if (layer?.digest) referencedBlobs.add(layer.digest.replace(':', '-'));
              }
            } catch { /* ignore corrupt/non-json files */ }
          }
        }
      };
      try { walkDir(manifestsDir); } catch { /* best effort */ }
    }

    // Delete any blob not referenced by any manifest (orphan from cancelled pull)
    try {
      for (const blobFile of fs.readdirSync(blobsDir)) {
        if (!referencedBlobs.has(blobFile)) {
          try { fs.unlinkSync(path.join(blobsDir, blobFile)); } catch { /* best effort */ }
        }
      }
    } catch { /* best effort */ }
  }

  // ── Detection ──────────────────────────────────────────────────────────────

  async isInstalled() {
    if (process.platform === "win32") {
      return fs.existsSync(getCustomOllamaExe());
    }
    return new Promise((resolve) => {
      exec("which ollama", (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * Scan the Ollama manifests directory to detect installed models from filesystem.
   * This works even when the Ollama server is not running.
   * @returns {string[]} Array of model names (e.g., "hf.co/IlyaGusev/saiga_yandexgpt_8b_gguf:Q8_0")
   */
  scanInstalledModelsFromDisk() {
    const modelsDir = this._getOllamaModelsDir();
    const manifestsDir = path.join(modelsDir, 'manifests');
    const installedModels = [];

    if (!fs.existsSync(manifestsDir)) {
      return installedModels;
    }

    try {
      // Walk the manifests directory to find all model manifests
      const walkDir = (dir, base = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            walkDir(path.join(dir, entry.name), path.join(base, entry.name));
          } else if (entry.name === 'modelfile') {
            // Found a model manifest
            try {
              const manifestPath = path.join(dir, entry.name);
              const manifestContent = fs.readFileSync(manifestPath, 'utf8');
              const manifest = JSON.parse(manifestContent);
              if (manifest.from) {
                // Extract model name from the "from" field
                // Format: "hf.co/IlyaGusev/saiga_yandexgpt_8b_gguf:Q8_0"
                installedModels.push(manifest.from);
              }
            } catch {
              // Skip corrupted manifests
            }
          }
        }
      };

      walkDir(manifestsDir);
    } catch {
      // Return empty array on error
    }

    return installedModels;
  }

  async getStatus() {
    const installed = await this.isInstalled();
    if (!installed) {
      return { installed: false, running: false, models: [] };
    }

    const status = await checkOllamaStatus(this.baseUrl);
    return {
      installed: true,
      running: status.running,
      models: status.models || [],
      pullingModel: this._activePullModel,
      error: status.error,
    };
  }

  // ── Models ─────────────────────────────────────────────────────────────────

  async pullModel(modelName, { onProgress } = {}) {
    const cancelCtrl = { cancelled: false, request: null };
    this._pullCancelCtrl = cancelCtrl;
    this._activePullModel = modelName;
    try {
      const res = await pullOllamaModel(modelName, { baseUrl: this.baseUrl, onProgress, cancelCtrl });
      return res;
    } finally {
      this._pullCancelCtrl = null;
      this._activePullModel = null;
    }
  }

  async deleteModel(modelName) {
    return deleteOllamaModel(modelName, this.baseUrl);
  }

  // ── Server ─────────────────────────────────────────────────────────────────

  _resolveOllamaExecutable() {
    if (process.platform !== 'win32') return 'ollama';
    return getCustomOllamaExe();
  }

  _setCustomEnvironment() {
    // Set OLLAMA_MODELS to use custom directory
    if (!process.env.OLLAMA_MODELS) {
      process.env.OLLAMA_MODELS = getCustomOllamaModelsDir();
    }
  }

  startServer({ onProgress } = {}) {
    // Ensure custom environment is set before starting server
    this._setCustomEnvironment();
    return startServer({
      getStatus: () => this.getStatus(),
      ollamaExec: this._resolveOllamaExecutable(),
      onProgress,
    });
  }

  stopServer() {
    this._lastHealthCheck = null;
    return stopServer();
  }

  /**
   * Unload the model from GPU memory without stopping the server.
   * This frees VRAM and is the correct way to release resources after translation.
   */
  async resetContext(modelName) {
    if (!modelName) return false;
    return resetOllamaContext({ model: modelName, baseUrl: this.baseUrl });
  }

  // ── Install / Uninstall ────────────────────────────────────────────────────

  async installOllama({ onProgress } = {}) {
    const cancelCtrl = { cancelled: false, request: null, process: null };
    this._installCancelCtrl = cancelCtrl;
    try {
      // Set custom environment before installation
      this._setCustomEnvironment();
      return await installOllama({
        onProgress,
        cancelCtrl,
        getStatus: () => this.getStatus(),
        startServer: (opts) => this.startServer(opts),
      });
    } finally {
      this._installCancelCtrl = null;
    }
  }

  async uninstallOllama({ onProgress } = {}) {
    this._lastHealthCheck = null;
    return uninstallOllama({
      onProgress,
    });
  }

  // ── Health Check ──────────────────────────────────────────────────────────────

  /**
   * Perform a lightweight health check to verify the server is actually responsive.
   * This is more reliable than just checking if the process is running.
   */
  async performHealthCheck() {
    const now = Date.now();
    // Don't health check too frequently (every 5 seconds max)
    if (this._lastHealthCheck && now - this._lastHealthCheck < this._healthCheckInterval) {
      return true;
    }

    try {
      const status = await this.getStatus();
      const isHealthy = status.running && status.installed;
      this._lastHealthCheck = isHealthy ? now : null;
      return isHealthy;
    } catch {
      this._lastHealthCheck = null;
      return false;
    }
  }

  /**
   * Ensure the server is running AND responsive before translation.
   * Performs health check and restarts if necessary.
   */
  async ensureHealthy() {
    const status = await this.getStatus();
    if (!status.installed) return status;

    // Check if server is actually responsive
    const isHealthy = await this.performHealthCheck();
    if (isHealthy) return status;

    // Server is installed but not healthy - try to restart it
    console.warn('Ollama server not healthy, attempting restart...');
    return this.startServer();
  }
}

module.exports = new OllamaManager();

