const crypto = require('crypto');

// Stable id for a string literal: 'u' + first 16 hex chars of sha256(utf8(text)).
// MUST stay byte-for-byte in sync with MakeId() in tools_src/MscLocTool/Program.cs
// so ids line up between the dnlib tool and the Node side.
function makeStringId(text) {
  const hash = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  return `u${hash.slice(0, 16)}`;
}

module.exports = { makeStringId };
