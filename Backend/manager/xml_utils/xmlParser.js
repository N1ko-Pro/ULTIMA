const xml2js = require('xml2js');

async function parseXmlContent(xmlContent) {
  const parser = new xml2js.Parser({ explicitArray: false });
  const parsed = await parser.parseStringPromise(xmlContent);
  const translations = {};

  const content = parsed?.contentList?.content;
  const contentNodes = Array.isArray(content) ? content : content ? [content] : [];

  for (const node of contentNodes) {
    const uid = node?.$?.contentuid;
    if (!uid) {
      continue;
    }

    translations[uid] = typeof node._ === 'string' ? node._ : '';
  }

  return translations;
}

module.exports = { parseXmlContent };
