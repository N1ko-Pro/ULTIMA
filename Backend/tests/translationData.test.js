/**
 * Tests for shared_utils/translationData — meta-key filtering.
 * Run: node Backend/tests/translationData.test.js
 *
 * Property 1 (design.md): meta keys never leak into packed output.
 */

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const { META_KEYS, stripMetaKeys } = require(path.join(__dirname, "../manager/shared_utils/translationData"));

// ─── Test runner ──────────────────────────────────────────────────────────────

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

function section(name) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

// ─── deterministic cases ─────────────────────────────────────────────────────

section("stripMetaKeys — basic behaviour");

test("removes every known meta key", () => {
  const input = {
    u0a1b2c3d4e5f6a7b: "Текст",
    _bookmarks: [1, 2],
    _techOverride: { uXYZ: "technical" },
    _hidden: { uABC: true },
    name: "Mod",
    author: "Someone",
    uuid: "1234",
    description: "desc",
  };
  const out = stripMetaKeys(input);
  assert.deepEqual(out, { u0a1b2c3d4e5f6a7b: "Текст" });
});

test("does not mutate the input object", () => {
  const input = { uId: "t", _hidden: { uId: true } };
  const snapshot = JSON.stringify(input);
  stripMetaKeys(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test("returns a new object reference", () => {
  const input = { uId: "t" };
  assert.notEqual(stripMetaKeys(input), input);
});

test("non-object input yields empty object", () => {
  assert.deepEqual(stripMetaKeys(null), {});
  assert.deepEqual(stripMetaKeys(undefined), {});
  assert.deepEqual(stripMetaKeys("nope"), {});
  assert.deepEqual(stripMetaKeys(42), {});
});

test("keeps real string ids untouched (incl. empty values)", () => {
  const input = { uId1: "перевод", uId2: "", uId3: "   " };
  assert.deepEqual(stripMetaKeys(input), input);
});

// ─── property-based: meta keys never leak ────────────────────────────────────

section("stripMetaKeys — Property 1 (randomised)");

function randomId() {
  const hex = Math.random().toString(16).slice(2, 18).padEnd(16, "0");
  return `u${hex}`;
}

function makeRandomData() {
  const data = {};
  // random translatable ids
  const n = Math.floor(Math.random() * 20);
  for (let i = 0; i < n; i++) {
    data[randomId()] = Math.random().toString(36).slice(2);
  }
  // randomly sprinkle in meta keys with arbitrary values
  for (const key of META_KEYS) {
    if (Math.random() < 0.5) {
      const r = Math.random();
      data[key] = r < 0.33 ? "x" : r < 0.66 ? { a: 1 } : [1, 2, 3];
    }
  }
  return data;
}

test("no meta key survives across 1000 random inputs", () => {
  for (let i = 0; i < 1000; i++) {
    const out = stripMetaKeys(makeRandomData());
    for (const key of META_KEYS) {
      assert.ok(!(key in out), `meta key "${key}" leaked into output`);
    }
  }
});

test("every non-meta key is preserved with its value", () => {
  for (let i = 0; i < 500; i++) {
    const input = makeRandomData();
    const out = stripMetaKeys(input);
    for (const key of Object.keys(input)) {
      if (META_KEYS.includes(key)) continue;
      assert.ok(key in out, `non-meta key "${key}" was dropped`);
      assert.equal(out[key], input[key]);
    }
  }
});

// ─── summary ─────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
