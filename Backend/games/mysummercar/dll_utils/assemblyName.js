// ─────────────────────────────────────────────────────────────────────────────
//  assemblyName.js — read a .NET assembly's *simple name* (the value dnlib
//  exposes as `module.Assembly.Name`) straight from the PE/CLI metadata, with
//  no native dependency and without invoking the external tool.
//
//  The runtime patcher (MSCLoc API) needs this name to locate the loaded
//  original assembly among MSCLoader's mods, so the translation table's
//  `targetAssembly` must match it exactly.
//
//  Parsing path (ECMA-335):
//    PE header → data directory 14 (CLI header) → metadata root ('BSJB')
//    → '#~' (tables) stream + '#Strings' heap
//    → walk table row sizes up to the Assembly table (0x20) → read Name index
//    → resolve the UTF-8 string in '#Strings'.
//
//  Any parsing failure returns '' — callers fall back gracefully. A best-effort
//  Module-table name (the module file name) is also exposed for diagnostics /
//  fallback.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ASSEMBLY_TABLE = 0x20;

// ── PE: locate sections + the CLI header RVA (data directory index 14) ───────
function parsePeForClr(buf) {
  if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return null; // 'MZ'
  const peOff = buf.readUInt32LE(0x3c);
  if (peOff + 24 > buf.length || buf.readUInt32LE(peOff) !== 0x00004550) return null; // 'PE\0\0'

  const numSections = buf.readUInt16LE(peOff + 6);
  const optSize = buf.readUInt16LE(peOff + 20);
  const optOff = peOff + 24;
  const magic = buf.readUInt16LE(optOff);
  const dataDirOff = optOff + (magic === 0x20b ? 112 : 96);
  const clrRva = buf.readUInt32LE(dataDirOff + 14 * 8);
  if (!clrRva) return null;

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
  return { sections, clrRva };
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

// ── Metadata schema (ECMA-335 II.22) ─────────────────────────────────────────
// Coded-index reference sets: [tables…, tagBits].
const CODED = {
  TypeDefOrRef:        [[0x02, 0x01, 0x1b], 2],
  HasConstant:         [[0x04, 0x08, 0x17], 2],
  HasCustomAttribute:  [[0x06, 0x04, 0x01, 0x02, 0x08, 0x09, 0x0a, 0x00, 0x0e, 0x17, 0x14, 0x11, 0x1a, 0x1b, 0x20, 0x23, 0x26, 0x27, 0x28, 0x2a, 0x2c, 0x2b], 5],
  HasFieldMarshal:     [[0x04, 0x08], 1],
  HasDeclSecurity:     [[0x02, 0x06, 0x20], 2],
  MemberRefParent:     [[0x02, 0x01, 0x1a, 0x06, 0x1b], 3],
  HasSemantics:        [[0x14, 0x17], 1],
  MethodDefOrRef:      [[0x06, 0x0a], 1],
  MemberForwarded:     [[0x04, 0x06], 1],
  Implementation:      [[0x26, 0x23, 0x27], 2],
  CustomAttributeType: [[0x06, 0x0a], 3],
  ResolutionScope:     [[0x00, 0x1a, 0x23, 0x01], 2],
  TypeOrMethodDef:     [[0x02, 0x06], 1],
};

// Column descriptors per table (only up to 0x20 — we never need higher tables).
// 'u2'/'u4' fixed; 's'/'g'/'b' = String/GUID/Blob heap index; ['t', table] =
// simple table index; ['c', codedName] = coded index.
const TABLES = {
  0x00: ['u2', 's', 'g', 'g', 'g'],                                  // Module
  0x01: [['c', 'ResolutionScope'], 's', 's'],                        // TypeRef
  0x02: ['u4', 's', 's', ['c', 'TypeDefOrRef'], ['t', 0x04], ['t', 0x06]], // TypeDef
  0x03: [['t', 0x04]],                                               // FieldPtr
  0x04: ['u2', 's', 'b'],                                            // Field
  0x05: [['t', 0x06]],                                               // MethodPtr
  0x06: ['u4', 'u2', 'u2', 's', 'b', ['t', 0x08]],                   // MethodDef
  0x07: [['t', 0x08]],                                               // ParamPtr
  0x08: ['u2', 'u2', 's'],                                           // Param
  0x09: [['t', 0x02], ['c', 'TypeDefOrRef']],                        // InterfaceImpl
  0x0a: [['c', 'MemberRefParent'], 's', 'b'],                        // MemberRef
  0x0b: ['u2', ['c', 'HasConstant'], 'b'],                           // Constant
  0x0c: [['c', 'HasCustomAttribute'], ['c', 'CustomAttributeType'], 'b'], // CustomAttribute
  0x0d: [['c', 'HasFieldMarshal'], 'b'],                             // FieldMarshal
  0x0e: ['u2', ['c', 'HasDeclSecurity'], 'b'],                       // DeclSecurity
  0x0f: ['u2', 'u4', ['t', 0x02]],                                   // ClassLayout
  0x10: ['u4', ['t', 0x04]],                                         // FieldLayout
  0x11: ['b'],                                                       // StandAloneSig
  0x12: [['t', 0x02], ['t', 0x14]],                                  // EventMap
  0x13: [['t', 0x14]],                                               // EventPtr
  0x14: ['u2', 's', ['c', 'TypeDefOrRef']],                          // Event
  0x15: [['t', 0x02], ['t', 0x17]],                                  // PropertyMap
  0x16: [['t', 0x17]],                                               // PropertyPtr
  0x17: ['u2', 's', 'b'],                                            // Property
  0x18: ['u2', ['t', 0x06], ['c', 'HasSemantics']],                  // MethodSemantics
  0x19: [['t', 0x02], ['c', 'MethodDefOrRef'], ['c', 'MethodDefOrRef']], // MethodImpl
  0x1a: ['s'],                                                       // ModuleRef
  0x1b: ['b'],                                                       // TypeSpec
  0x1c: ['u2', ['c', 'MemberForwarded'], 's', ['t', 0x1a]],          // ImplMap
  0x1d: ['u4', ['t', 0x04]],                                         // FieldRVA
  0x1e: ['u4', 'u4'],                                                // EncLog
  0x1f: ['u4'],                                                      // EncMap
  0x20: ['u4', 'u2', 'u2', 'u2', 'u2', 'u4', 'b', 's', 's'],         // Assembly
};

function readMetadata(buf, sections, clrRva) {
  const clrOff = rvaToOffset(sections, clrRva);
  if (clrOff < 0 || clrOff + 16 > buf.length) return null;
  const metaRva = buf.readUInt32LE(clrOff + 8);
  const metaOff = rvaToOffset(sections, metaRva);
  if (metaOff < 0 || metaOff + 20 > buf.length) return null;
  if (buf.readUInt32LE(metaOff) !== 0x424a5342) return null; // 'BSJB'

  const versionLen = buf.readUInt32LE(metaOff + 12);
  let p = metaOff + 16 + ((versionLen + 3) & ~3);
  p += 2; // flags
  const numStreams = buf.readUInt16LE(p);
  p += 2;

  const streams = {};
  for (let i = 0; i < numStreams; i += 1) {
    const offset = buf.readUInt32LE(p);
    const size = buf.readUInt32LE(p + 4);
    let q = p + 8;
    let name = '';
    while (q < buf.length && buf[q] !== 0) { name += String.fromCharCode(buf[q]); q += 1; }
    streams[name] = { offset: metaOff + offset, size };
    // Stream-header name is null-terminated then padded to a 4-byte boundary.
    p = (q + 1 + 3) & ~3;
  }
  return streams;
}

/**
 * Best-effort .NET assembly simple name. '' on any failure.
 * @param {string} dllPath
 * @returns {string}
 */
function readAssemblyName(dllPath) {
  try {
    const buf = fs.readFileSync(dllPath);
    const pe = parsePeForClr(buf);
    if (!pe) return '';
    const streams = readMetadata(buf, pe.sections, pe.clrRva);
    if (!streams) return '';

    const tilde = streams['#~'] || streams['#-'];
    const strings = streams['#Strings'];
    if (!tilde || !strings) return '';

    let p = tilde.offset;
    p += 6; // reserved(4) + major(1) + minor(1)
    const heapSizes = buf[p]; p += 1;
    p += 1; // reserved
    const valid = buf.readBigUInt64LE(p); p += 8;
    p += 8; // sorted

    const strIdx = (heapSizes & 0x01) ? 4 : 2;
    const guidIdx = (heapSizes & 0x02) ? 4 : 2;
    const blobIdx = (heapSizes & 0x04) ? 4 : 2;

    // Row counts for present tables (bit i of `valid`).
    const rowCount = {};
    const present = [];
    for (let i = 0; i < 64; i += 1) {
      if (valid & (1n << BigInt(i))) {
        present.push(i);
        rowCount[i] = buf.readUInt32LE(p); p += 4;
      }
    }
    // Tables data starts here.
    const tablesStart = p;

    const tableIdxSize = (tbl) => ((rowCount[tbl] || 0) < (1 << 16) ? 2 : 4);
    const codedIdxSize = (name) => {
      const [refs, tagBits] = CODED[name];
      let maxRows = 0;
      for (const t of refs) maxRows = Math.max(maxRows, rowCount[t] || 0);
      return maxRows < (1 << (16 - tagBits)) ? 2 : 4;
    };
    const colSize = (col) => {
      if (col === 'u2') return 2;
      if (col === 'u4') return 4;
      if (col === 's') return strIdx;
      if (col === 'g') return guidIdx;
      if (col === 'b') return blobIdx;
      if (Array.isArray(col)) {
        return col[0] === 't' ? tableIdxSize(col[1]) : codedIdxSize(col[1]);
      }
      return 0;
    };
    const rowSize = (tbl) => {
      const schema = TABLES[tbl];
      if (!schema) return 0;
      let s = 0;
      for (const c of schema) s += colSize(c);
      return s;
    };

    if (!rowCount[ASSEMBLY_TABLE]) return ''; // no assembly manifest in this module

    // Offset of the Assembly table = sum of (rows * rowSize) for present tables
    // with a lower index.
    let off = tablesStart;
    for (const t of present) {
      if (t >= ASSEMBLY_TABLE) break;
      off += (rowCount[t] || 0) * rowSize(t);
    }

    // Assembly row 0: HashAlgId(4) Major(2) Minor(2) Build(2) Rev(2) Flags(4)
    //                 PublicKey(blob) Name(string) Culture(string)
    let cur = off + 4 + 2 + 2 + 2 + 2 + 4 + blobIdx;
    const nameIndex = strIdx === 2 ? buf.readUInt16LE(cur) : buf.readUInt32LE(cur);

    // Resolve the null-terminated UTF-8 string in #Strings.
    const sOff = strings.offset + nameIndex;
    let end = sOff;
    while (end < strings.offset + strings.size && buf[end] !== 0) end += 1;
    return buf.toString('utf8', sOff, end).trim();
  } catch {
    return '';
  }
}

/**
 * Fallback name derived from the file path stem (e.g. "Some.dll" → "Some").
 * Used when metadata parsing yields nothing.
 * @param {string} dllPath
 * @returns {string}
 */
function fileStemName(dllPath) {
  return path.basename(dllPath, path.extname(dllPath));
}

/**
 * The target-assembly name to record in a patch manifest: the real assembly
 * name when parseable, else the file stem.
 * @param {string} dllPath
 * @returns {string}
 */
function resolveTargetAssembly(dllPath) {
  return readAssemblyName(dllPath) || fileStemName(dllPath);
}

module.exports = { readAssemblyName, fileStemName, resolveTargetAssembly };
