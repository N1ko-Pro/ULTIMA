const path = require("path");
const fs = require("fs");
const xml2js = require("xml2js");
const smartManager = require("./smartManager");
const aiManager = require("./aiManager");

const { findModFiles, findLocalizationRoot } = require("./bg3_utils/fileSystemUtils");
const { sanitizeWorkspaceTag, createSessionWorkspaceTag, resolveWorkspaceDirectory } = require("./bg3_utils/workspaceUtils");
const DivineCliUtils = require("./bg3_utils/divineCliUtils");
const { extractModInfo, buildTranslationMetaLsx, addDependencyToMetaLsx, buildInfoJson } = require("./bg3_utils/metaInfoUtils");
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
      this.workspaceDir = path.join(userDataPath, 'workspace');
    }
    // In packaged builds, tools are unpacked to app.asar.unpacked/tools
    if (appPath && typeof appPath === 'string') {
      // Replace app.asar with app.asar.unpacked for unpacked files
      const unpackedPath = appPath.replace(/app\.asar$/, 'app.asar.unpacked');
      this.toolsDir = path.join(unpackedPath, 'tools');
      this.divineCliUtils = new DivineCliUtils(path.join(this.toolsDir, "divine.exe"));
    }
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

  async saveAndRepack(updatedData, outputPath) {
    if (!this.cachedData.xmlStructure) throw new Error("No XML structure loaded.");

    const parsed = this.cachedData.xmlStructure;

    applyUpdatedStringsToParsedContent(parsed, updatedData);

    const locaDir = path.dirname(this.cachedData.locaPath);
    const locRoot = findLocalizationRoot(locaDir, this.workspaceDir);

    // Use the original loca filename for Russian version (BG3 matches by filename)
    const origLocaName = path.basename(this.cachedData.locaPath);
    const origXmlName = origLocaName.replace(/\.loca$/i, '.xml');

    const ruLocaDir = path.join(locRoot, "Russian");
    if (!fs.existsSync(ruLocaDir)) fs.mkdirSync(ruLocaDir, { recursive: true });

    const ruXmlPath = path.join(ruLocaDir, origXmlName);
    const ruLocaPath = path.join(ruLocaDir, origLocaName);

    const builder = new xml2js.Builder({ xmldec: { version: "1.0", encoding: "utf-8" }});
    const newXml = builder.buildObject(parsed);
    fs.writeFileSync(ruXmlPath, newXml, "utf8");

    await this.divineCliUtils.convertXmlToLoca(ruXmlPath, ruLocaPath);

    // Save original mod info BEFORE renaming (for dependency + info.json)
    const originalModInfo = { ...this.cachedData.modInfo };

    const { metaLsxPath: translationMetaPath, folderName } = buildTranslationMetaLsx(this.cachedData, updatedData);

    // Add original mod as dependency in the translation patch's meta.lsx
    addDependencyToMetaLsx(translationMetaPath, originalModInfo);

    // Prepare a temp staging directory matching BG3 translation mod structure:
    //   Mods/<folder>/meta.lsx
    //   Mods/<folder>/Localization/Russian/<name>.loca
    const stagingDir = path.join(this.cachedData.modWorkspaceDir, "_pak_staging");
    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });

    const finalModInfo = await extractModInfo(translationMetaPath);

    // Copy meta.lsx (text format is fine — BG3 and BG3MM both accept it)
    const stagingMetaDir = path.join(stagingDir, "Mods", folderName);
    fs.mkdirSync(stagingMetaDir, { recursive: true });
    fs.copyFileSync(translationMetaPath, path.join(stagingMetaDir, "meta.lsx"));

    // Copy Russian .loca inside Mods/<folder>/Localization/Russian/
    const stagingLocaDir = path.join(stagingMetaDir, "Localization", "Russian");
    fs.mkdirSync(stagingLocaDir, { recursive: true });
    fs.copyFileSync(ruLocaPath, path.join(stagingLocaDir, origLocaName));

    // Build .pak from staging
    const baseName = path.basename(outputPath).replace(/\.(zip|pak)$/i, "");
    const pakFileName = baseName + ".pak";
    const tempPakPath = path.join(path.dirname(outputPath), pakFileName);

    await this.divineCliUtils.createPackage(stagingDir, tempPakPath);

    // Cleanup staging directory
    fs.rmSync(stagingDir, { recursive: true, force: true });

    const infoJson = buildInfoJson(finalModInfo, originalModInfo);

    // Create .zip archive with .pak + info.json
    const zip = new AdmZip();
    zip.addLocalFile(tempPakPath);
    zip.addFile("info.json", Buffer.from(JSON.stringify(infoJson, null, 2), "utf8"));
    zip.writeZip(outputPath);

    // Cleanup temp .pak
    try { fs.unlinkSync(tempPakPath); } catch { /* ignore */ }
  }
}

module.exports = new Bg3Manager();