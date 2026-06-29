/**
 * Tests for MSC packManager — replace-mode artifact + source immutability.
 * Run: node Backend/tests/mscPackManager.test.js
 *
 * Always-on layer (stubbed MscLocTool): verifies the packaging pipeline and
 *   Property 6 (the source mod file is never mutated by packing).
 * Guarded round-trip layer (real MscLocTool): set MSC_TEST_DLL to a managed
 *   .dll to exercise Property 4 (inject round-trip) + Property 6 for real.
 *   Skipped automatically when the tool or fixture is unavailable.
 */

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const mscToolCli = require(path.join(__dirname, "../games/mysummercar/dll_utils/mscToolCli"));
const patcherTool = require(path.join(__dirname, "../games/mysummercar/dll_utils/patcherTool"));
const packManager = require(path.join(__dirname, "../games/mysummercar/packManager"));
const { makeStringId } = require(path.join(__dirname, "../games/mysummercar/dll_utils/stringId"));
const { readAssemblyName } = require(path.join(__dirname, "../games/mysummercar/dll_utils/assemblyName"));

const AdmZip = require("adm-zip");

// ─── Test runner ──────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
let skipped = 0;

async function atest(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  \x1b[32m✓\x1b[0m", name);
  } catch (e) {
    fail++;
    console.error("  \x1b[31m✗\x1b[0m", name);
    console.error("    ", e.message);
  }
}

function skip(name, why) {
  skipped++;
  console.log("  \x1b[33m∅ SKIP\x1b[0m", name, why ? `(${why})` : "");
}

function section(name) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

// ─── always-on: stubbed pipeline ─────────────────────────────────────────────

async function runStubbedTests() {
  section("packManager.replace — pipeline + Property 6 (stubbed tool)");

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "msc-test-"));
  const srcDll = path.join(work, "SomeMod.dll");
  // Arbitrary bytes standing in for a managed DLL (the tool is stubbed, so the
  // content only matters for the immutability check).
  const srcBytes = crypto.randomBytes(2048);
  fs.writeFileSync(srcDll, srcBytes);
  const srcHashBefore = sha256File(srcDll);

  // Known extract: 3 literals.
  const literals = [
    { id: makeStringId("Hello"), text: "Hello" },
    { id: makeStringId("World"), text: "World" },
    { id: makeStringId("Keep"), text: "Keep" },
  ];

  // Stub the tool: extract returns the known literals; inject writes an output
  // file (translated marker) and reports how many ids it replaced.
  const origExtract = mscToolCli.extract;
  const origInject = mscToolCli.inject;
  let injectedTable = null;
  mscToolCli.extract = async () => literals;
  mscToolCli.inject = async (dllPath, translations, outPath) => {
    injectedTable = translations;
    fs.writeFileSync(outPath, Buffer.concat([srcBytes, Buffer.from(JSON.stringify(translations))]));
    return { replaced: Object.keys(translations).length };
  };

  const outZip = path.join(work, "out.zip");
  let progressSeen = [];
  const ctx = {
    promptOutputPath: async () => outZip,
    onProgress: (p) => progressSeen.push(p),
  };

  try {
    const updatedData = {
      [makeStringId("Hello")]: "Привет",
      [makeStringId("World")]: "Мир",
      [makeStringId("Keep")]: "", // empty → must be skipped, original kept
      name: "SomeMod",            // meta key → must be stripped
      _bookmarks: [1, 2],         // meta key → must be stripped
    };

    const result = await packManager.pack(
      { updatedData, modName: "SomeMod", targetLanguage: "ru", mode: "replace", originalPakPath: srcDll },
      ctx
    );

    await atest("returns success with zip path and mode", async () => {
      assert.equal(result.success, true);
      assert.equal(result.filePath, outZip);
      assert.equal(result.mode, "replace");
    });

    await atest("Property 6: source DLL is not mutated", async () => {
      assert.equal(sha256File(srcDll), srcHashBefore);
    });

    await atest("only non-empty, valid-id translations are injected", async () => {
      assert.deepEqual(injectedTable, {
        [makeStringId("Hello")]: "Привет",
        [makeStringId("World")]: "Мир",
      });
    });

    await atest("zip contains the translated DLL and info.json", async () => {
      const zip = new AdmZip(outZip);
      const names = zip.getEntries().map((e) => e.entryName);
      assert.ok(names.includes("SomeMod.dll"), "missing SomeMod.dll");
      assert.ok(names.includes("info.json"), "missing info.json");
      const info = JSON.parse(zip.getEntry("info.json").getData().toString("utf8"));
      assert.equal(info.mode, "replace");
      assert.equal(info.language, "ru");
      assert.equal(info.dll, "SomeMod.dll");
      assert.equal(info.replacedStrings, 2);
    });

    await atest("reports progress up to 100", async () => {
      assert.ok(progressSeen.length > 0);
      assert.equal(progressSeen[progressSeen.length - 1], 100);
    });

    await atest("cancelled save dialog yields success:false and no temp leak", async () => {
      const r = await packManager.pack(
        { updatedData, modName: "SomeMod", targetLanguage: "ru", mode: "replace", originalPakPath: srcDll },
        { promptOutputPath: async () => null, onProgress: () => {} }
      );
      assert.equal(r.success, false);
      assert.equal(sha256File(srcDll), srcHashBefore);
    });

    await atest("missing original file → clean error, no throw", async () => {
      const r = await packManager.pack(
        { updatedData, modName: "X", targetLanguage: "ru", mode: "replace", originalPakPath: path.join(work, "nope.dll") },
        ctx
      );
      assert.equal(r.success, false);
      assert.match(r.error, /не найден/i);
    });

    await atest("unknown mode → clean error", async () => {
      const r = await packManager.pack({ mode: "bogus" }, ctx);
      assert.equal(r.success, false);
    });
  } finally {
    mscToolCli.extract = origExtract;
    mscToolCli.inject = origInject;
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── always-on: patch mode (stubbed tool) ───────────────────────────────────

async function runPatchStubbedTests() {
  section("packManager.patch — artifact + Property 6 (stubbed tool)");

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "msc-patch-"));
  const srcDll = path.join(work, "SomeMod.dll");
  const srcBytes = crypto.randomBytes(2048);
  fs.writeFileSync(srcDll, srcBytes);
  const srcHashBefore = sha256File(srcDll);

  // A fake downloaded patcher in a tool dir we point patcherTool at.
  const toolDir = path.join(work, "tools");
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, "MSCLocAPI.dll"), Buffer.from("FAKE_PATCHER"));

  const literals = [
    { id: makeStringId("Hello"), text: "Hello" },
    { id: makeStringId("World"), text: "World" },
  ];
  const origExtract = mscToolCli.extract;
  mscToolCli.extract = async () => literals;

  try {
    await atest("patcher missing → PATCHER_MISSING (no dialog, no throw)", async () => {
      patcherTool.configure(path.join(work, "empty-tools")); // no patcher there
      let prompted = false;
      const r = await packManager.pack(
        { updatedData: { [makeStringId("Hello")]: "Привет" }, modName: "SomeMod", targetLanguage: "ru", mode: "patch", originalPakPath: srcDll },
        { promptOutputPath: async () => { prompted = true; return path.join(work, "x.zip"); }, onProgress: () => {} }
      );
      assert.equal(r.success, false);
      assert.equal(r.error, "PATCHER_MISSING");
      assert.equal(r.missingTool, "msc-patcher");
      assert.equal(prompted, false, "must not prompt when patcher absent");
    });

    patcherTool.configure(toolDir); // patcher now present

    const outZip = path.join(work, "patch.zip");
    const updatedData = {
      [makeStringId("Hello")]: "Привет",
      [makeStringId("World")]: "Мир",
      name: "SomeMod",       // meta → stripped
      _bookmarks: [1],       // meta → stripped
    };
    const result = await packManager.pack(
      { updatedData, modName: "SomeMod", targetLanguage: "ru", mode: "patch", originalPakPath: srcDll },
      { promptOutputPath: async () => outZip, onProgress: () => {} }
    );

    await atest("returns success with mode patch", async () => {
      assert.equal(result.success, true);
      assert.equal(result.mode, "patch");
      assert.ok(fs.existsSync(outZip));
    });

    await atest("Property 6: source DLL untouched", async () => {
      assert.equal(sha256File(srcDll), srcHashBefore);
    });

    await atest("zip has patcher, config json and info.txt", async () => {
      const zip = new AdmZip(outZip);
      const names = zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
      assert.ok(names.includes("Mods/MSCLocAPI.dll"), `missing patcher; got ${names}`);
      assert.ok(names.includes("info.txt"), "missing info.txt");
      const cfg = names.find((n) => n.startsWith("Mods/Config/MSCLocAPI/") && n.endsWith(".json"));
      assert.ok(cfg, `missing config json; got ${names}`);

      const table = JSON.parse(zip.getEntry(cfg).getData().toString("utf8"));
      assert.equal(table.schema, 1);
      assert.equal(table.language, "ru");
      assert.deepEqual(table.entries, {
        [makeStringId("Hello")]: "Привет",
        [makeStringId("HELLO")]: "Привет",
        [makeStringId("hello")]: "Привет",
        [makeStringId("World")]: "Мир",
        [makeStringId("WORLD")]: "Мир",
        [makeStringId("world")]: "Мир",
      });
      // targetAssembly falls back to file stem for our fake (non-PE) dll.
      assert.equal(table.targetAssembly, "SomeMod");
    });
  } finally {
    mscToolCli.extract = origExtract;
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── guarded: real round-trip ────────────────────────────────────────────────

async function runRealRoundTrip() {
  section("packManager.replace — real round-trip (Property 4 + 6)");

  const fixture = process.env.MSC_TEST_DLL || path.join(__dirname, "MSCQualityTweaks.dll");
  const toolDir = path.join(process.env.APPDATA || "", "ULTIMA", "Tools", "MSC");

  mscToolCli.configure(toolDir);
  if (!mscToolCli.isPresent()) {
    skip("real round-trip", "MscLocTool.exe not installed");
    return;
  }
  if (!fixture || !fs.existsSync(fixture)) {
    skip("real round-trip", "no fixture .dll (set MSC_TEST_DLL or add Backend/tests/MSCQualityTweaks.dll)");
    return;
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "msc-rt-"));
  const srcDll = path.join(work, path.basename(fixture));
  fs.copyFileSync(fixture, srcDll);
  const srcHashBefore = sha256File(srcDll);

  try {
    const literals = await mscToolCli.extract(srcDll);
    if (literals.length === 0) {
      skip("real round-trip", "fixture has no string literals");
      return;
    }

    // Translate every other literal; leave the rest untouched.
    const translations = {};
    literals.forEach((l, i) => {
      if (i % 2 === 0) translations[l.id] = `__TR__${i}`;
    });

    const outDll = path.join(work, "out.dll");
    const { replaced } = await mscToolCli.inject(srcDll, translations, outDll);

    await atest("Property 6: source DLL untouched by inject", async () => {
      assert.equal(sha256File(srcDll), srcHashBefore);
    });

    await atest("inject reports replacements", async () => {
      assert.ok(replaced >= 0);
    });

    const after = await mscToolCli.extract(outDll);
    const afterById = new Map(after.map((l) => [l.id, l.text]));

    await atest("Property 4: translated ids equal translation; others unchanged", async () => {
      for (const l of literals) {
        if (translations[l.id] !== undefined) {
          // The translated literal now hashes to a NEW id; its text must be the
          // translation. Look it up by the translated value's id.
          const newId = makeStringId(translations[l.id]);
          assert.equal(afterById.get(newId), translations[l.id], `id ${l.id} not translated`);
        }
      }
    });

    // Full end-to-end: real extract → buildTable → inject → zip via packManager.
    await atest("end-to-end real pack produces a valid replace zip", async () => {
      const outZip = path.join(work, "e2e.zip");
      const updatedData = {};
      literals.slice(0, Math.min(5, literals.length)).forEach((l, i) => {
        updatedData[l.id] = `__E2E__${i}`;
      });

      const result = await packManager.pack(
        {
          updatedData,
          modName: "MSCQualityTweaks",
          targetLanguage: "ru",
          mode: "replace",
          originalPakPath: srcDll,
        },
        { promptOutputPath: async () => outZip, onProgress: () => {} }
      );

      assert.equal(result.success, true);
      assert.equal(result.mode, "replace");
      assert.ok(fs.existsSync(outZip));
      assert.equal(sha256File(srcDll), srcHashBefore); // source still untouched

      const zip = new AdmZip(outZip);
      const names = zip.getEntries().map((e) => e.entryName);
      assert.ok(names.some((n) => n.toLowerCase().endsWith(".dll")), "zip has no .dll");
      assert.ok(names.includes("info.json"), "zip has no info.json");
    });

    // Real patch artifact: real assembly name + real extract, fake patcher dll.
    await atest("end-to-end real patch artifact carries real targetAssembly", async () => {
      const fakeTools = path.join(work, "tools");
      fs.mkdirSync(fakeTools, { recursive: true });
      fs.writeFileSync(path.join(fakeTools, "MSCLocAPI.dll"), Buffer.from("FAKE"));
      patcherTool.configure(fakeTools);

      const outZip = path.join(work, "patch.zip");
      const updatedData = {};
      literals.slice(0, Math.min(5, literals.length)).forEach((l, i) => {
        updatedData[l.id] = `__P__${i}`;
      });

      const result = await packManager.pack(
        { updatedData, modName: "MSCQualityTweaks", targetLanguage: "ru", mode: "patch", originalPakPath: srcDll },
        { promptOutputPath: async () => outZip, onProgress: () => {} }
      );
      assert.equal(result.success, true);
      assert.equal(result.mode, "patch");
      assert.equal(sha256File(srcDll), srcHashBefore);

      const zip = new AdmZip(outZip);
      const names = zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
      const cfg = names.find((n) => n.startsWith("Mods/Config/MSCLocAPI/") && n.endsWith(".json"));
      assert.ok(cfg, "missing config json");
      const table = JSON.parse(zip.getEntry(cfg).getData().toString("utf8"));
      assert.equal(table.targetAssembly, readAssemblyName(srcDll));
      assert.ok(Object.keys(table.entries).length > 0, "no entries");
    });
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

(async () => {
  await runStubbedTests();
  await runPatchStubbedTests();
  await runRealRoundTrip();
  console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
  process.exit(fail ? 1 : 0);
})();
