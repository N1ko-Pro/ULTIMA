/**
 * Tests for MSC gamePath — Steam libraryfolders.vdf parsing.
 * Run: node Backend/tests/mscGamePath.test.js
 */

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const { parseSteamLibraries, isValidGamePath } = require(path.join(
  __dirname,
  "../games/mysummercar/dll_utils/gamePath"
));

let pass = 0;
let fail = 0;

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

console.log("\x1b[1mgamePath.parseSteamLibraries\x1b[0m");

test("parses multiple library paths and unescapes backslashes", () => {
  const vdf = `
"libraryfolders"
{
  "0"
  {
    "path"   "C:\\\\Program Files (x86)\\\\Steam"
    "label"  ""
  }
  "1"
  {
    "path"   "D:\\\\SteamLibrary"
  }
}`;
  const libs = parseSteamLibraries(vdf);
  assert.deepEqual(libs, ["C:\\Program Files (x86)\\Steam", "D:\\SteamLibrary"]);
});

test("normalises forward slashes to backslashes", () => {
  const vdf = `"path" "E:/Games/Steam"`;
  assert.deepEqual(parseSteamLibraries(vdf), ["E:\\Games\\Steam"]);
});

test("empty / non-string input → []", () => {
  assert.deepEqual(parseSteamLibraries(""), []);
  assert.deepEqual(parseSteamLibraries(null), []);
  assert.deepEqual(parseSteamLibraries(undefined), []);
});

test("no path entries → []", () => {
  assert.deepEqual(parseSteamLibraries(`"libraryfolders" { "0" { "label" "x" } }`), []);
});

test("isValidGamePath is false for a non-existent folder", () => {
  assert.equal(isValidGamePath("Z:\\nope\\My Summer Car"), false);
  assert.equal(isValidGamePath(""), false);
  assert.equal(isValidGamePath(null), false);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
