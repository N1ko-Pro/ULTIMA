// ─────────────────────────────────────────────────────────────────────────────
//  assemblyInfo.js — best-effort reader for a .NET assembly's description,
//  taken from the PE Win32 version resource (VS_VERSIONINFO).
//
//  The C# compiler maps assembly attributes onto the version resource:
//    [AssemblyDescription] → "Comments"
//    [AssemblyTitle]       → "FileDescription"
//    [AssemblyProduct]     → "ProductName"
//
//  MSCLoader mods are .NET Framework DLLs that normally embed this resource, so
//  this gives us a "description from the DLL" without any native dependency or
//  the external dnlib tool. Any parsing failure yields '' — callers ignore it.
//
//  NOTE: this reads the *assembly* description, not the MSCLoader in-game
//  `Mod.Description` property (which is an IL string literal). Surfacing that
//  specific literal would require the MscLocTool (dnlib) to tag it.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');

const WANTED = ['Comments', 'FileDescription', 'ProductName'];
const RT_VERSION = 16;

function parsePe(buf) {
  if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return null; // 'MZ'
  const peOff = buf.readUInt32LE(0x3c);
  if (peOff + 24 > buf.length || buf.readUInt32LE(peOff) !== 0x00004550) return null; // 'PE\0\0'

  const numSections = buf.readUInt16LE(peOff + 6);
  const optSize = buf.readUInt16LE(peOff + 20);
  const optOff = peOff + 24;
  const magic = buf.readUInt16LE(optOff);
  // Data-directory array starts at a magic-dependent offset; entry 2 = resources.
  const dataDirOff = optOff + (magic === 0x20b ? 112 : 96);
  const resourceRva = buf.readUInt32LE(dataDirOff + 2 * 8);
  if (!resourceRva) return null;

  const sectionsOff = optOff + optSize;
  const sections = [];
  for (let i = 0; i < numSections; i += 1) {
    const so = sectionsOff + i * 40;
    if (so + 40 > buf.length) break;
    sections.push({
      virtualSize: buf.readUInt32LE(so + 8),
      virtualAddress: buf.readUInt32LE(so + 12),
      rawSize: buf.readUInt32LE(so + 16),
      rawPointer: buf.readUInt32LE(so + 20),
    });
  }
  return { sections, resourceRva };
}

function rvaToOffset(sections, rva) {
  for (const s of sections) {
    const size = Math.max(s.rawSize, s.virtualSize);
    if (rva >= s.virtualAddress && rva < s.virtualAddress + size) {
      return rva - s.virtualAddress + s.rawPointer;
    }
  }
  return -1;
}

// Walk type → name → language and return the first RT_VERSION data blob.
function findVersionBlob(buf, sections, resourceRva) {
  const base = rvaToOffset(sections, resourceRva);
  if (base < 0) return null;

  // First sub-directory offset under `dirOff`. When `wantId` is set, only an
  // id entry (not a string-named one) matching that id is accepted.
  const firstChild = (dirOff, wantId) => {
    if (dirOff + 16 > buf.length) return -1;
    const named = buf.readUInt16LE(dirOff + 12);
    const ids = buf.readUInt16LE(dirOff + 14);
    for (let i = 0; i < named + ids; i += 1) {
      const eOff = dirOff + 16 + i * 8;
      if (eOff + 8 > buf.length) return -1;
      const nameOrId = buf.readUInt32LE(eOff);
      const offToData = buf.readUInt32LE(eOff + 4);
      if (wantId !== null) {
        if (i < named) continue;           // skip string-named entries
        if (nameOrId !== wantId) continue; // id entries store the raw id
      }
      return offToData;
    }
    return -1;
  };

  const typeOff = firstChild(base, RT_VERSION);
  if (typeOff < 0 || !(typeOff & 0x80000000)) return null;
  const nameOff = firstChild(base + (typeOff & 0x7fffffff), null);
  if (nameOff < 0 || !(nameOff & 0x80000000)) return null;
  const langOff = firstChild(base + (nameOff & 0x7fffffff), null);
  if (langOff < 0 || (langOff & 0x80000000)) return null; // expect a data entry

  const dataEntry = base + langOff;
  if (dataEntry + 8 > buf.length) return null;
  const dataOff = rvaToOffset(sections, buf.readUInt32LE(dataEntry));
  const dataSize = buf.readUInt32LE(dataEntry + 4);
  if (dataOff < 0) return null;
  return { offset: dataOff, size: Math.min(dataSize, buf.length - dataOff) };
}

// VS_VERSIONINFO nodes are 32-bit aligned relative to the blob start.
function alignTo(n, base) {
  return base + (((n - base) + 3) & ~3);
}

function readUtf16z(buf, start, end) {
  let p = start;
  let out = '';
  while (p + 1 < end) {
    const code = buf.readUInt16LE(p);
    p += 2;
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out;
}

// Recursively collect wanted String entries (key → value) from the version tree.
function collectStrings(buf, start, end, base, out) {
  let offset = start;
  while (offset + 6 <= end) {
    const wLength = buf.readUInt16LE(offset);
    if (wLength === 0) break;
    const wValueLength = buf.readUInt16LE(offset + 2);
    const wType = buf.readUInt16LE(offset + 4);
    const nodeEnd = Math.min(offset + wLength, end);

    const key = readUtf16z(buf, offset + 6, nodeEnd);
    const valueOffset = alignTo(offset + 6 + (key.length + 1) * 2, base);
    const valueBytes = wType === 1 ? wValueLength * 2 : wValueLength;

    if (wValueLength > 0 && WANTED.includes(key) && !out[key]) {
      const value = readUtf16z(buf, valueOffset, Math.min(valueOffset + wValueLength * 2, nodeEnd));
      if (value) out[key] = value;
    }

    const childStart = alignTo(valueOffset + valueBytes, base);
    if (childStart < nodeEnd) collectStrings(buf, childStart, nodeEnd, base, out);

    const next = alignTo(nodeEnd, base);
    if (next <= offset) break;
    offset = next;
  }
}

/**
 * Best-effort assembly description for a .NET DLL. Returns '' if the file has
 * no version resource or cannot be parsed.
 * @param {string} dllPath
 * @returns {string}
 */
function readAssemblyDescription(dllPath) {
  try {
    const buf = fs.readFileSync(dllPath);
    const pe = parsePe(buf);
    if (!pe) return '';
    const blob = findVersionBlob(buf, pe.sections, pe.resourceRva);
    if (!blob) return '';
    const out = {};
    collectStrings(buf, blob.offset, blob.offset + blob.size, blob.offset, out);
    return (out.Comments || out.FileDescription || out.ProductName || '').trim();
  } catch {
    return '';
  }
}

module.exports = { readAssemblyDescription };
