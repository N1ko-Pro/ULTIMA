const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { buildXmlContent } = require('./xml_utils/xmlBuilder');
const { parseXmlContent } = require('./xml_utils/xmlParser');

function getXmlDir(app) {
  const base = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : app.getPath('userData');
  return path.join(base, 'xml');
}

function ensureXmlDir(app) {
  const dir = getXmlDir(app);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function exportXml(mainWindow, app, translations, modInfo) {
  const xmlDir = ensureXmlDir(app);
  const filename = (modInfo?.name || 'Localizations') + '_RU.xml';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Экспорт локализации в XML',
    defaultPath: path.join(xmlDir, filename),
    filters: [{ name: 'XML Files', extensions: ['xml'] }]
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  const xmlContent = await buildXmlContent(translations);
  fs.writeFileSync(filePath, xmlContent, 'utf-8');
  return { success: true, filePath };
}

async function importXml(mainWindow, app) {
  const xmlDir = ensureXmlDir(app);
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Импорт локализации из XML',
    defaultPath: xmlDir,
    filters: [{ name: 'XML Files', extensions: ['xml'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return { success: false, canceled: true };

  const xmlPath = filePaths[0];
  const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
  const translations = await parseXmlContent(xmlContent);
  return { success: true, translations, filePath: xmlPath };
}

module.exports = {
  exportXml,
  importXml
};
