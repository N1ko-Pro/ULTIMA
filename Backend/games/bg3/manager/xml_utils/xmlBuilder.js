const xml2js = require('xml2js');

async function buildXmlContent(translations) {
  const contentNodes = Object.entries(translations || {})
    .filter(([uid, text]) => uid && text !== undefined && text !== '')
    .map(([uid, text]) => ({
      $: {
        contentuid: uid,
        version: '1',
      },
      _: String(text),
    }));

  const builder = new xml2js.Builder({
    xmldec: { version: '1.0', encoding: 'utf-8' },
    rootName: 'contentList',
    renderOpts: {
      pretty: true,
      indent: '\t',
    },
  });

  return builder.buildObject({ content: contentNodes });
}

module.exports = { buildXmlContent };
