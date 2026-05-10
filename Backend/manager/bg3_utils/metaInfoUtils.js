const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xml2js = require('xml2js');

async function extractModInfo(metaLsxPath) {
  let modInfo = {
    name: 'Unknown Mod',
    author: 'Unknown',
    description: '',
    version: '',
    uuid: '',
    folder: ''
  };

  if (!metaLsxPath || !fs.existsSync(metaLsxPath)) return modInfo;

  try {
    const metaData = fs.readFileSync(metaLsxPath, 'utf8');
    const parser = new xml2js.Parser();
    const metaParsed = await parser.parseStringPromise(metaData);
    
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
 * @param {object} [overrides] — optional {name, author, description, uuid}
 * @returns {{ metaLsxPath: string, folderName: string }}
 */
function buildTranslationMetaLsx(cachedData, overrides = {}) {
  const origName = cachedData.modInfo?.name || '';
  const alreadyRenamed = /_RU$/i.test(origName);

  const name = overrides.name || (alreadyRenamed ? origName : origName + '_RU');
  const folderName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const author = overrides.author || cachedData.modInfo?.author || '';
  const description = overrides.description
    || (alreadyRenamed ? cachedData.modInfo?.description : `Перевод мода ${origName} на русский язык.`);
  const uuid = overrides.uuid
    || (alreadyRenamed ? cachedData.modInfo?.uuid : crypto.randomUUID());
  const version = cachedData.modInfo?.version || '36028797018963968';

  const metaXml = `<?xml version="1.0" encoding="utf-8"?>
<save>
  <version major="4" minor="0" revision="9" build="331" />
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
      fs.renameSync(oldModsSubdir, newModsSubdir);
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
 */
function addDependencyToMetaLsx(metaLsxPath, originalModInfo) {
  if (!metaLsxPath || !fs.existsSync(metaLsxPath) || !originalModInfo) return;

  let data = fs.readFileSync(metaLsxPath, 'utf8');

  const depBlock = [
    `            <node id="ModuleShortDesc">`,
    `              <attribute id="Folder" type="LSString" value="${originalModInfo.folder}" />`,
    `              <attribute id="MD5" type="LSString" value="" />`,
    `              <attribute id="Name" type="LSString" value="${originalModInfo.name}" />`,
    `              <attribute id="UUID" type="FixedString" value="${originalModInfo.uuid}" />`,
    `              <attribute id="Version64" type="int64" value="${originalModInfo.version || "0"}" />`,
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
      MD5: "",
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
      MD5: "",
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
