const path = require("path");
const fs = require("fs");
const os = require("os");
const xml2js = require("xml2js");
const smartManager = require("../../../manager/smartManager");
const aiManager = require("../../../manager/aiManager");

const { findModFiles } = require("./bg3_utils/fileSystemUtils");
const { sanitizeWorkspaceTag, createSessionWorkspaceTag, resolveWorkspaceDirectory } = require("./bg3_utils/workspaceUtils");
const DivineCliUtils = require("./bg3_utils/divineCliUtils");
const { extractModInfo, buildTranslationMetaLsx, addDependencyToMetaLsx, buildInfoJson } = require("./bg3_utils/metaInfoUtils");
const { getFolder, DEFAULT_LANG_CODE } = require("../../../manager/shared_utils/languages");
const { GAMES } = require("../../gameRegistry");
const AdmZip = require("adm-zip");

function extractStringsFromParsedContent(parsedXml) {
  const rawContentNodes = parsedXml?.contentList?.content;
  const contentNodes = Array.isArray(rawContentNodes)
    ? rawContentNodes
    : rawContentNodes
      ? [rawContentNodes]
      : [];

  const stringsData = {};

  for (const contentNode of contentNodes) {
    const uid = contentNode.$?.contentuid;
    if (uid) {
      stringsData[uid] = typeof contentNode._ === 'string' ? contentNode._ : '';
    }
  }

  return stringsData;
}

function applyUpdatedStringsToParsedContent(parsedXml, updatedData) {
  const rawContentNodes = parsedXml?.contentList?.content;
  if (!rawContentNodes) return;

  const contentNodes = Array.isArray(rawContentNodes)
    ? rawContentNodes
    : [rawContentNodes];

  for (const contentNode of contentNodes) {
    const uid = contentNode.$?.contentuid;
    if (uid && updatedData[uid] !== undefined && updatedData[uid] !== '') {
      contentNode._ = updatedData[uid];
    }
  }
}

class Bg3Manager {
  constructor() {
    this.workspaceDir = path.join(__dirname, "..", "workspace");
    this.toolsDir = path.join(__dirname, "..", "tools");
    this.divineCliUtils = new DivineCliUtils(path.join(this.toolsDir, "divine.exe"));
    this.cachedData = {
      xmlStructure: null,
      locaPath: null,
      xmlPath: null,
      metaLsxPath: null,
      modInfo: null,
      modWorkspaceDir: null,
    };
  }

  initialize(userDataPath, appPath) {
    if (userDataPath && typeof userDataPath === 'string') {
      // Per-game segment: <userData>/workspace/BG3. Legacy builds wrote mod
      // workspaces straight into <userData>/workspace — relocate those once.
      const workspaceRoot = path.join(userDataPath, 'workspace');
      this.workspaceDir = path.join(workspaceRoot, 'BG3');
      this._migrateLegacyWorkspace(workspaceRoot, this.workspaceDir);
    }
    // In packaged builds, tools are unpacked to app.asar.unpacked/tools
    if (appPath && typeof appPath === 'string') {
      // Replace app.asar with app.asar.unpacked for unpacked files
      const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
      this.toolsDir = path.join(unpackedPath, 'tools');
      this.divineCliUtils = new DivineCliUtils(path.join(this.toolsDir, "divine.exe"));
    }
  }

  // Best-effort one-time move of legacy loose workspace folders into the BG3
  // subfolder. Skips the per-game folders themselves and never clobbers.
  _migrateLegacyWorkspace(workspaceRoot, bg3Dir) {
    try {
      if (!fs.existsSync(workspaceRoot)) return;
      if (!fs.existsSync(bg3Dir)) fs.mkdirSync(bg3Dir, { recursive: true });
      const reserved = new Set(GAMES.map((game) => game.folder));
      for (const entry of fs.readdirSync(workspaceRoot)) {
        if (reserved.has(entry)) continue;
        const from = path.join(workspaceRoot, entry);
        const to = path.join(bg3Dir, entry);
        if (fs.existsSync(to)) continue;
        try { fs.renameSync(from, to); } catch { /* in-use / locked — leave it */ }
      }
    } catch { /* best-effort, never block init */ }
  }

  clearCachedDataForWorkspace(workspacePath) {
    if (this.cachedData.modWorkspaceDir && this.cachedData.modWorkspaceDir.startsWith(workspacePath)) {
      this.cachedData = {
        xmlStructure: null,
        locaPath: null,
        xmlPath: null,
        metaLsxPath: null,
        modInfo: null,
        modWorkspaceDir: null,
      };
    }
  }

  _findXmlWithContent(xmlPath) {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    if (xmlContent.includes('<content ')) return xmlPath;

    const xmlDir = path.dirname(xmlPath);
    const baseName = path.basename(xmlPath);

    for (const file of fs.readdirSync(xmlDir)) {
      if (!file.toLowerCase().endsWith('.xml') || file === baseName) continue;
      const altPath = path.join(xmlDir, file);
      if (fs.readFileSync(altPath, 'utf8').includes('<content ')) return altPath;
    }

    return xmlPath;
  }

  async unpackAndLoadStrings(pakPath, options = {}) {
    const modFolderName = path.basename(pakPath, ".pak");

    let finalWorkspaceTag;
    if (options.exactWorkspaceDir) {
      // Stored folder name — use as-is, no sanitization (handles legacy names with spaces)
      finalWorkspaceTag = options.exactWorkspaceDir;
    } else {
      const workspaceTag = sanitizeWorkspaceTag(options.workspaceTag, modFolderName);
      finalWorkspaceTag = options.freshSessionWorkspace
        ? createSessionWorkspaceTag(workspaceTag)
        : workspaceTag;
    }

    const baseModWorkspaceDir = path.join(this.workspaceDir, finalWorkspaceTag);
    const modWorkspaceDir = resolveWorkspaceDirectory(baseModWorkspaceDir);

    await this.divineCliUtils.extractPackage(pakPath, modWorkspaceDir);

    const { targetLocaPath, targetXmlPath, metaLsxPath } = findModFiles(modWorkspaceDir);

    let finalLocaPath = targetLocaPath;
    let finalXmlPath = targetXmlPath;

    if (!finalLocaPath && finalXmlPath) {
      finalXmlPath = this._findXmlWithContent(finalXmlPath);
      finalLocaPath = finalXmlPath.replace(/\.xml$/i, '.loca');
      await this.divineCliUtils.convertXmlToLoca(finalXmlPath, finalLocaPath);
    }

    if (!finalLocaPath) throw new Error("No .loca localization file found in this mod.");

    const modInfo = await extractModInfo(metaLsxPath);

    const xmlPath = finalLocaPath.replace(/\.loca$/, ".xml");

    this.cachedData = {
      xmlStructure: null,
      locaPath: finalLocaPath,
      xmlPath,
      metaLsxPath,
      modInfo,
      modWorkspaceDir,
    };

    await this.divineCliUtils.convertLocaToXml(finalLocaPath, xmlPath);

    const xmlData = fs.readFileSync(xmlPath, "utf8");
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsed = await parser.parseStringPromise(xmlData);

    this.cachedData.xmlStructure = parsed;

    const stringsData = extractStringsFromParsedContent(parsed);

    return { strings: stringsData, modInfo, workspaceDirName: finalWorkspaceTag };
  }

  async translateBatch(dataToTranslate, targetLang = "ru", options = {}) {
    const mode = options?.mode === "local" ? "local" : "smart";

    if (mode === "local") {
      try {
        return await aiManager.translateBatchWithRetry(dataToTranslate, targetLang, options);
      } catch (error) {
        if (error?.message === "OLLAMA_MODEL_NOT_FOUND") {
          throw new Error(`Модель "${aiManager.ollamaModel}" не найдена в Ollama. Скачайте её в настройках (вкладка «AI-перевод»).`);
        }
        if (typeof error?.message === "string" && error.message.startsWith("OLLAMA_HTTP_")) {
          throw new Error("Ollama не отвечает. Убедитесь, что Ollama запущена и модель загружена.");
        }
        throw error;
      }
    }

    try {
      return await smartManager.translateBatchWithRetry(dataToTranslate, targetLang, options);
    } catch (error) {
      if (error.message === "RATE_LIMIT_EXCEEDED") {
        const settings = smartManager.getSettings();
        const proxyPoolSize = settings?.proxy?.poolSize || 0;

        if (proxyPoolSize > 0) {
          throw new Error("Сервис перевода вернул 429. Приложение попробовало прокси из вашего пула, но доступные адреса были исчерпаны. Проверьте актуальность пула/логина или повторите попытку позже.");
        }

        throw new Error("Сервис перевода временно заблокировал запросы (Ошибка 429). Добавьте proxy-пул для авто-ротации или попробуйте позже.");
      }
      throw error;
    }
  }

  async saveAndRepack(updatedData, outputPath, targetLanguage = DEFAULT_LANG_CODE) {
    if (!this.cachedData.xmlStructure) throw new Error("No XML structure loaded.");

    // Deep-clone so we never mutate cachedData.xmlStructure (holds the originals).
    const parsedCopy = JSON.parse(JSON.stringify(this.cachedData.xmlStructure));
    applyUpdatedStringsToParsedContent(parsedCopy, updatedData);

    // Save original mod info BEFORE renaming (for dependency + info.json)
    const originalModInfo = { ...this.cachedData.modInfo };

    // Rename/create the translation mod folder FIRST so all subsequent paths
    // are derived from the final folder location. This prevents stale-path
    // ENOENT errors when the Mods subfolder is renamed (e.g. already ends with
    // a language suffix).
    const { metaLsxPath: translationMetaPath, folderName } =
      buildTranslationMetaLsx(this.cachedData, { ...updatedData, targetLanguage });

    // Resolve the Larian Localization folder for the target language —
    // 'Russian', 'English', 'German', etc. Defaults to Russian for unknown
    // / missing codes (DEFAULT_LANG_CODE).
    const localeFolder = getFolder(targetLanguage);

    // Output filenames mirror Larian's lowercase convention (`russian.loca`,
    // `english.loca`, `japanese.loca`, …) regardless of how the source mod
    // named its file. Keeping the filename in sync with the localization
    // folder makes the packed mod's structure self-explanatory and matches
    // the layout BG3's own .pak files use.
    const localeFileBase = localeFolder.toLowerCase();
    const outLocaName = `${localeFileBase}.loca`;
    const outXmlName  = `${localeFileBase}.xml`;

    // Write translated XML/loca to an OS temp directory so the workspace files
    // (which hold the original English strings) are never overwritten.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg3-translate-'));
    try {
      const tmpXmlPath  = path.join(tmpDir, outXmlName);
      const tmpLocaPath = path.join(tmpDir, outLocaName);

      const builder = new xml2js.Builder({ xmldec: { version: "1.0", encoding: "utf-8" }});
      fs.writeFileSync(tmpXmlPath, builder.buildObject(parsedCopy), "utf8");
      await this.divineCliUtils.convertXmlToLoca(tmpXmlPath, tmpLocaPath);

      // Add original mod as dependency in the translation patch's meta.lsx
      addDependencyToMetaLsx(translationMetaPath, originalModInfo);

      // Prepare a temp staging directory matching BG3 translation mod structure:
      //   Mods/<folder>/meta.lsx
      //   Localization/<Language>/<language>.loca  (root — BG3 reads from here)
      const stagingDir = path.join(this.cachedData.modWorkspaceDir, "_pak_staging");
      if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });

      const finalModInfo = await extractModInfo(translationMetaPath);

      const stagingMetaDir = path.join(stagingDir, "Mods", folderName);
      fs.mkdirSync(stagingMetaDir, { recursive: true });
      fs.copyFileSync(translationMetaPath, path.join(stagingMetaDir, "meta.lsx"));

      const stagingLocaDir = path.join(stagingDir, "Localization", localeFolder);
      fs.mkdirSync(stagingLocaDir, { recursive: true });
      fs.copyFileSync(tmpLocaPath, path.join(stagingLocaDir, outLocaName));

      // Build .pak from staging. Use folderName (already sanitized and contains
      // the language suffix) so the .pak name matches the Mods/<folder> name
      // expected by BG3MM.
      const pakFileName = folderName + ".pak";
      const tempPakPath = path.join(path.dirname(outputPath), pakFileName);

      await this.divineCliUtils.createPackage(stagingDir, tempPakPath);

      fs.rmSync(stagingDir, { recursive: true, force: true });

      const infoJson = buildInfoJson(finalModInfo, originalModInfo);

      const zip = new AdmZip();
      zip.addLocalFile(tempPakPath);
      zip.addFile("info.json", Buffer.from(JSON.stringify(infoJson, null, 2), "utf8"));
      zip.writeZip(outputPath);

      try { fs.unlinkSync(tempPakPath); } catch { /* ignore */ }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

module.exports = new Bg3Manager();