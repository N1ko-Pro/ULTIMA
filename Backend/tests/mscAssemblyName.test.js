/**
 * Tests for MSC assemblyName reader (CLI metadata → Assembly table Name).
 * Run: node Backend/tests/mscAssemblyName.test.js
 *
 * The real-DLL assertion is guarded: it runs against Backend/tests/*.dll (or
 * MSC_TEST_DLL) and is skipped when no fixture is present.
 */

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { readAssemblyName, fileStemName, resolveTargetAssembly } = require(path.join(
  __dirname,
  "../games/mysummercar/dll_utils/assemblyName"
));

let pass = 0;
let fail = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
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

// ─── pure / fallback behaviour ───────────────────────────────────────────────

section("assemblyName — fallbacks & robustness");

test("fileStemName strips extension", () => {
  assert.equal(fileStemName("/x/y/SomeMod.dll"), "SomeMod");
  assert.equal(fileStemName("Plain.exe"), "Plain");
});

test("non-existent file → '' for name, stem for resolve", () => {
  assert.equal(readAssemblyName("Z:/nope/missing.dll"), "");
  assert.equal(resolveTargetAssembly("Z:/nope/missing.dll"), "missing");
});

test("non-PE garbage file → '' (no throw)", () => {
  const tmp = path.join(require("node:os").tmpdir(), `notpe-${Date.now()}.dll`);
  fs.writeFileSync(tmp, Buffer.from("this is not a PE file at all"));
  try {
    assert.equal(readAssemblyName(tmp), "");
    assert.equal(resolveTargetAssembly(tmp), path.basename(tmp, ".dll"));
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

// ─── real DLL ────────────────────────────────────────────────────────────────

section("assemblyName — real DLL (guarded)");

const fixture = process.env.MSC_TEST_DLL || path.join(__dirname, "MSCQualityTweaks.dll");
if (!fs.existsSync(fixture)) {
  skip("real assembly name", "no fixture .dll");
} else {
  test("reads a non-empty assembly name from CLI metadata", () => {
    const name = readAssemblyName(fixture);
    assert.ok(name.length > 0, "expected a non-empty assembly name");
    // The assembly simple name carries no extension and no path separators.
    assert.doesNotMatch(name, /\.(dll|exe)$/i);
    assert.doesNotMatch(name, /[\\/]/);
  });

  test("MSCQualityTweaks fixture resolves to its expected name", () => {
    if (path.basename(fixture).toLowerCase() === "mscqualitytweaks.dll") {
      assert.equal(readAssemblyName(fixture), "MSCQualityTweaks");
    }
  });
}

console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
process.exit(fail ? 1 : 0);
