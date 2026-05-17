const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xml2js = require('xml2js');
const { getSuffix, getLanguage, DEFAULT_LANG_CODE } = require('../shared_utils/languages');

// ── Default save-header version ────────────────────────────────────────────
// The `<save><version .../></save>` header BG3 expects in meta.lsx evolves
// across patches. Using stale 4.0.9.331 (Patch 1-2 era) causes Patch 8+ BG3
// and modern BG3 Mod Manager to refuse the dependency relationship in some
// scenarios, which is exactly the failure mode we hit on translation mods
// targeting Patch 8 base mods. Default to the current Patch 8 header; the
// real value is always copied from the source mod's meta.lsx when available.
const DEFAULT_SAVE_VERSION = { major: '4', minor: '8', revision: '0', build: '500' };

async function extractModInfo(metaLsxPath) {
  let modInfo = {
    name: 'Unknown Mod',
    author: 'Unknown',
    description: '',
    version: '',
    uuid: '',
    folder: '',
    md5: '',
    publishHandle: '',
    saveVersion: { ...DEFAULT_SAVE_VERSION },
  };

  if (!metaLsxPath || !fs.existsSync(metaLsxPath)) return modInfo;

  try {
    const metaData = fs.readFileSync(metaLsxPath, 'utf8');
    const parser = new xml2js.Parser();
    const metaParsed = await parser.parseStringPromise(metaData);

    // Pull the `<save><version major minor revision build/></save>` header so
    // we can mirror the exact patch-version the source mod targets.
    const saveVersionNode = metaParsed?.save?.version?.[0]?.$;
    if (saveVersionNode) {
      modInfo.saveVersion = {
        major: saveVersionNode.major || DEFAULT_SAVE_VERSION.major,
        minor: saveVersionNode.minor || DEFAULT_SAVE_VERSION.minor,
        revision: saveVersionNode.revision || DEFAULT_SAVE_VERSION.revision,
        build: saveVersionNode.build || DEFAULT_SAVE_VERSION.build,
      };
    }

    let moduleInfoNode = null;

    const findModuleInfo = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj['$'] && obj['$']['id'] === 'ModuleInfo') {
        moduleInfoNode = obj;
        return;
      }
      for (const key of Object.keys(obj)) {
        findModuleInfo(obj[key]);
      }
    };

    findModuleInfo(metaParsed);

    if (moduleInfoNode && moduleInfoNode.attribute) {
      for (const attr of moduleInfoNode.attribute) {
        const id = attr.$?.id;
        const val = attr.$?.value;
        if (id === 'Name') modInfo.name = val;
        if (id === 'Author') modInfo.author = val;
        if (id === 'Description') modInfo.description = val;
        if (id === 'Version64') modInfo.version = val;
        if (id === 'UUID') modInfo.uuid = val;
        if (id === 'Folder') modInfo.folder = val;
        if (id === 'MD5') modInfo.md5 = val || '';
        if (id === 'PublishHandle') modInfo.publishHandle = val || '';
      }
    }
  } catch (err) {
    console.error('Error parsing meta.lsx', err);
  }

  return modInfo;
}

/**
 * Generate a clean translation meta.lsx from scratch using a proven template.
 * Based on the structure of working community BG3 translation mods.
 * Does NOT modify the original meta.lsx — writes a new file.
 *
 * @param {object} cachedData — must contain metaLsxPath, modInfo, modWorkspaceDir
 * @param {object} [overrides] — optional {name, author, description, uuid, targetLanguage}
 * @returns {{ metaLsxPath: string, folderName: string }}
 */
function buildTranslationMetaLsx(cachedData, overrides = {}) {
  const origName = cachedData.modInfo?.name || '';
  const targetLang = overrides.targetLanguage || DEFAULT_LANG_CODE;
  const langSuffix = getSuffix(targetLang); // '_RU', '_DE', '_JA', …
  const langInfo = getLanguage(targetLang);

  // A mod is considered "already renamed" if the original mod name ends with
  // any of the supported language suffixes. This keeps re-packing idempotent
  // — opening a previously-translated mod won't double-suffix the name.
  const suffixPattern = /_(?:RU|EN|DE|FR|ES|IT|PL|PT|JA|KO|ZH|UK|TR)$/i;
  const alreadyRenamed = suffixPattern.test(origName);

  const name = overrides.name
    || (alreadyRenamed ? origName : origName + langSuffix);
  const folderName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const author = overrides.author || cachedData.modInfo?.author || '';

  // Russian description keeps its native phrasing for backwards compatibility
  // with already-published translations. Other languages get a neutral
  // English description so meta.lsx stays readable in BG3MM.
  const defaultDescription = targetLang === 'ru'
    ? `Перевод мода ${origName} на русский язык.`
    : `Translation of "${origName}" to ${langInfo.folder}.`;
  const description = overrides.description
    || (alreadyRenamed ? cachedData.modInfo?.description : defaultDescription);

  const uuid = overrides.uuid
    || (alreadyRenamed ? cachedData.modInfo?.uuid : crypto.randomUUID());
  const version = cachedData.modInfo?.version || '36028797018963968';

  // Mirror the source mod's save-header version (4.8.0.500 for Patch 8 mods,
  // older for legacy mods). BG3 Mod Manager and the game itself use this to
  // verify the meta.lsx schema; mismatches against current-patch mods cause
  // dependency tracking + load order to silently break.
  const sv = cachedData.modInfo?.saveVersion || DEFAULT_SAVE_VERSION;

  // Patch 8 introduced PublishHandle on every meta.lsx coming out of the
  // in-game Mods workshop. The dependency block (below) keeps the source
  // mod's PublishHandle so BG3 can match against the workshop entry, but
  // the translation patch itself is sideloaded — emitting "0" is the
  // accepted convention for non-workshop mods and avoids the game/manager
  // trying to validate a handle that doesn't belong to us.
  const publishHandle = '0';

  const metaXml = `<?xml version="1.0" encoding="utf-8"?>
<save>
  <version major="${sv.major}" minor="${sv.minor}" revision="${sv.revision}" build="${sv.build}" />
  <region id="Config">
    <node id="root">
      <children>
        <node id="Dependencies" />
        <node id="ModuleInfo">
          <attribute id="Author" type="LSString" value="${escapeXmlAttr(author)}" />
          <attribute id="CharacterCreationLevelName" type="FixedString" value="" />
          <attribute id="Description" type="LSString" value="${escapeXmlAttr(description)}" />
          <attribute id="Folder" type="LSString" value="${escapeXmlAttr(folderName)}" />
          <attribute id="LobbyLevelName" type="FixedString" value="" />
          <attribute id="MD5" type="LSString" value="" />
          <attribute id="MainMenuBackgroundVideo" type="FixedString" value="" />
          <attribute id="MenuLevelName" type="FixedString" value="" />
          <attribute id="Name" type="LSString" value="${escapeXmlAttr(name)}" />
          <attribute id="NumPlayers" type="uint8" value="4" />
          <attribute id="PhotoBooth" type="FixedString" value="" />
          <attribute id="PublishHandle" type="uint64" value="${escapeXmlAttr(publishHandle)}" />
          <attribute id="StartupLevelName" type="FixedString" value="" />
          <attribute id="Tags" type="LSString" value="" />
          <attribute id="Type" type="FixedString" value="Add-on" />
          <attribute id="UUID" type="FixedString" value="${uuid}" />
          <attribute id="Version64" type="int64" value="${version}" />
          <children>
            <node id="PublishVersion">
              <attribute id="Version64" type="int64" value="${version}" />
            </node>
            <node id="TargetModes">
              <children>
                <node id="Target">
                  <attribute id="Object" type="FixedString" value="Story" />
                </node>
              </children>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`;

  // Write to the new folder location
  const modsDir = path.join(cachedData.modWorkspaceDir, 'Mods');
  const oldFolderName = cachedData.modInfo?.folder || '';
  const newModsSubdir = path.join(modsDir, folderName);

  if (oldFolderName && oldFolderName !== folderName) {
    const oldModsSubdir = path.join(modsDir, oldFolderName);
    if (fs.existsSync(oldModsSubdir)) {
      fs.cpSync(oldModsSubdir, newModsSubdir, { recursive: true });
      fs.rmSync(oldModsSubdir, { recursive: true, force: true });
    }
  }

  if (!fs.existsSync(newModsSubdir)) fs.mkdirSync(newModsSubdir, { recursive: true });

  const newMetaPath = path.join(newModsSubdir, 'meta.lsx');
  fs.writeFileSync(newMetaPath, metaXml, 'utf8');

  cachedData.metaLsxPath = newMetaPath;

  return { metaLsxPath: newMetaPath, folderName };
}

function escapeXmlAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Decode BG3 Version64 int64 → "major.minor.revision.build" string.
 * Encoding: major << 55 | minor << 47 | revision << 31 | build.
 */
function decodeVersion64(v64str) {
  const v = BigInt(v64str || "0");
  const major = Number((v >> 55n) & 0xFFn);
  const minor = Number((v >> 47n) & 0xFFn);
  const revision = Number((v >> 31n) & 0xFFFFn);
  const build = Number(v & 0x7FFFFFFFn);
  return `${major}.${minor}.${revision}.${build}`;
}

/**
 * Inject original mod as a dependency into the translation patch's meta.lsx.
 * Handles both self-closed <node id="Dependencies"/> and existing <children>.
 *
 * MD5 + PublishHandle are copied verbatim from the source mod when they
 * exist. BG3 Mod Manager uses MD5 to verify the dependency relationship and
 * PublishHandle to recognise mods that originated from the in-game workshop;
 * leaving them empty is fine for sideloaded mods but blocks workshop mods
 * from being matched against their translation patch.
 */
function addDependencyToMetaLsx(metaLsxPath, originalModInfo) {
  if (!metaLsxPath || !fs.existsSync(metaLsxPath) || !originalModInfo) return;

  let data = fs.readFileSync(metaLsxPath, 'utf8');

  const md5Value = originalModInfo.md5 || '';
  const publishHandleValue = originalModInfo.publishHandle || '0';

  const depBlock = [
    `            <node id="ModuleShortDesc">`,
    `              <attribute id="Folder" type="LSString" value="${escapeXmlAttr(originalModInfo.folder || '')}" />`,
    `              <attribute id="MD5" type="LSString" value="${escapeXmlAttr(md5Value)}" />`,
    `              <attribute id="Name" type="LSString" value="${escapeXmlAttr(originalModInfo.name || '')}" />`,
    `              <attribute id="PublishHandle" type="uint64" value="${escapeXmlAttr(publishHandleValue)}" />`,
    `              <attribute id="UUID" type="guid" value="${escapeXmlAttr(originalModInfo.uuid || '')}" />`,
    `              <attribute id="Version64" type="int64" value="${escapeXmlAttr(originalModInfo.version || '0')}" />`,
    `            </node>`,
  ].join('\n');

  // Case 1: self-closed <node id="Dependencies"/>
  const selfClosed = /(<node\s+id="Dependencies"\s*\/>)/i;
  if (selfClosed.test(data)) {
    data = data.replace(selfClosed, [
      `<node id="Dependencies">`,
      `          <children>`,
      depBlock,
      `          </children>`,
      `        </node>`,
    ].join('\n'));
    fs.writeFileSync(metaLsxPath, data, 'utf8');
    return;
  }

  // Case 2: existing <node id="Dependencies"> with <children>
  const withChildren = /(<node\s+id="Dependencies"[^>]*>\s*<children>)/i;
  if (withChildren.test(data)) {
    data = data.replace(withChildren, `$1\n${depBlock}`);
    fs.writeFileSync(metaLsxPath, data, 'utf8');
  }
}

/**
 * Build the info.json object for BG3 Mod Manager compatibility.
 * @param {object} modInfo — final mod info (after _RU renaming)
 * @param {object} [originalModInfo] — original mod info (for Dependencies)
 */
function buildInfoJson(modInfo, originalModInfo) {
  const deps = [];
  if (originalModInfo && originalModInfo.uuid) {
    deps.push({
      UUID: originalModInfo.uuid,
      Name: originalModInfo.name || "",
      Folder: originalModInfo.folder || "",
      Version64: originalModInfo.version || "0",
      MD5: originalModInfo.md5 || "",
      PublishHandle: originalModInfo.publishHandle || "0",
    });
  }

  return {
    Mods: [{
      Author: modInfo.author || "",
      Name: modInfo.name || "",
      Folder: modInfo.folder || "",
      Version: decodeVersion64(modInfo.version),
      Description: modInfo.description || "",
      UUID: modInfo.uuid || "",
      Created: new Date().toISOString(),
      Dependencies: deps,
      Group: modInfo.uuid || "",
      MD5: modInfo.md5 || "",
    }],
    MD5: "",
  };
}

module.exports = {
  extractModInfo,
  buildTranslationMetaLsx,
  addDependencyToMetaLsx,
  buildInfoJson,
};
