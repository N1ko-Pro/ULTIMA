/**
 * Tests for MSC translationTable builder + stringId determinism.
 * Run: node Backend/tests/mscTranslationTable.test.js
 *
 * Property 2 (design.md): every table key is an id present in the original
 *   extract; every value is non-empty after trim.
 * Property 3 (design.md): MakeId is deterministic and matches the contract
 *   ('u' + first 16 hex of sha256(utf8(text))).
 */

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");

const { buildTranslationTable, SCHEMA_VERSION } = require(path.join(
  __dirname,
  "../games/mysummercar/dll_utils/translationTable"
));
const { makeStringId } = require(path.join(__dirname, "../games/mysummercar/dll_utils/stringId"));

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

// ─── buildTranslationTable — deterministic cases ─────────────────────────────

section("buildTranslationTable — basic behaviour");

test("keeps only ids present in the original extract", () => {
  const ids = new Set(["uAAAA", "uBBBB"]);
  const table = buildTranslationTable(
    { uAAAA: "Привет", uBBBB: "Мир", uZZZZ: "чужой id" },
    ids
  );
  assert.deepEqual(table.entries, { uAAAA: "Привет", uBBBB: "Мир" });
});

test("drops empty / whitespace-only values", () => {
  const ids = new Set(["uAAAA", "uBBBB", "uCCCC"]);
  const table = buildTranslationTable(
    { uAAAA: "ok", uBBBB: "", uCCCC: "   " },
    ids
  );
  assert.deepEqual(table.entries, { uAAAA: "ok" });
});

test("drops meta keys even if they collide with valid ids set", () => {
  const ids = new Set(["uAAAA"]);
  const table = buildTranslationTable(
    { uAAAA: "ok", name: "Mod", author: "X", uuid: "1", _bookmarks: [1], _hidden: {} },
    ids
  );
  assert.deepEqual(table.entries, { uAAAA: "ok" });
});

test("ignores non-string values", () => {
  const ids = new Set(["uAAAA", "uBBBB"]);
  const table = buildTranslationTable({ uAAAA: 42, uBBBB: "ok" }, ids);
  assert.deepEqual(table.entries, { uBBBB: "ok" });
});

test("populates manifest metadata", () => {
  const table = buildTranslationTable({ uAAAA: "ok" }, ["uAAAA"], {
    targetAssembly: "SomeMod",
    originalModName: "Some Mod",
    language: "ru",
    translator: "Имя",
    appVersion: "1.1.0",
  });
  assert.equal(table.schema, SCHEMA_VERSION);
  assert.equal(table.targetAssembly, "SomeMod");
  assert.equal(table.originalModName, "Some Mod");
  assert.equal(table.language, "ru");
  assert.equal(table.translator, "Имя");
  assert.equal(table.appVersion, "1.1.0");
});

test("accepts an array of ids as well as a Set", () => {
  const table = buildTranslationTable({ uAAAA: "ok" }, ["uAAAA"]);
  assert.deepEqual(table.entries, { uAAAA: "ok" });
});

// ─── Property 2 (randomised) ─────────────────────────────────────────────────

section("buildTranslationTable — Property 2 (randomised)");

function randomText() {
  const r = Math.random();
  if (r < 0.2) return "";
  if (r < 0.35) return "   ";
  return Math.random().toString(36).slice(2, 2 + Math.floor(Math.random() * 12));
}

test("every key is a valid extract id; every value non-empty after trim", () => {
  for (let iter = 0; iter < 1000; iter++) {
    // Build a pool of real ids from random texts.
    const pool = [];
    const n = Math.floor(Math.random() * 15);
    for (let i = 0; i < n; i++) pool.push(makeStringId(`s${i}-${Math.random()}`));
    const idSet = new Set(pool);

    // updatedData mixes valid ids, foreign ids, and meta keys.
    const updated = {};
    for (const id of pool) updated[id] = randomText();
    for (let i = 0; i < 5; i++) updated[makeStringId(`foreign-${Math.random()}`)] = "x";
    if (Math.random() < 0.5) updated.name = "Mod";
    if (Math.random() < 0.5) updated._bookmarks = [1, 2];

    const table = buildTranslationTable(updated, idSet);

    for (const [key, value] of Object.entries(table.entries)) {
      assert.ok(idSet.has(key), `key ${key} not in extract`);
      assert.ok(typeof value === "string" && value.trim() !== "", `value for ${key} empty`);
    }
  }
});

// ─── Property 3: id determinism ──────────────────────────────────────────────

section("makeStringId — Property 3 (determinism + contract)");

function referenceId(text) {
  return "u" + crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

test("matches the documented contract for fixed samples", () => {
  for (const s of ["", "Hello", "Привет, мир", "car jack(itemx)", "MSCQualityTweaks_ITEMS"]) {
    const id = makeStringId(s);
    assert.match(id, /^u[0-9a-f]{16}$/);
    assert.equal(id, referenceId(s));
  }
});

test("is deterministic across 2000 random strings", () => {
  for (let i = 0; i < 2000; i++) {
    const s = Math.random().toString(36) + "—" + i;
    assert.equal(makeStringId(s), makeStringId(s));
    assert.equal(makeStringId(s), referenceId(s));
  }
});

// ─── Property 7: resilience to original-mod updates ──────────────────────────

section("buildTranslationTable — Property 7 (update resilience)");

test("matching ids survive an update; changed ids are dropped (no error)", () => {
  // v1 of the mod: three literals.
  const v1 = ["Старт игры", "Открыть дверь", "Закрыть капот"].map(makeStringId);
  const translations = {
    [v1[0]]: "Game start",
    [v1[1]]: "Open the door",
    [v1[2]]: "Close the hood",
  };

  // v2 of the mod: the 2nd string was reworded → new id; 1st and 3rd unchanged.
  const v2Ids = new Set([v1[0], makeStringId("Открыть переднюю дверь"), v1[2]]);

  const table = buildTranslationTable(translations, v2Ids, { language: "en" });

  // The two unchanged ids keep their translation…
  assert.equal(table.entries[v1[0]], "Game start");
  assert.equal(table.entries[v1[2]], "Close the hood");
  // …the changed string's old id is silently dropped (would stay original in-game).
  assert.equal(table.entries[v1[1]], undefined);
  assert.equal(Object.keys(table.entries).length, 2);
});

test("a fully diverged update yields an empty (but valid) table", () => {
  const oldIds = ["a", "b", "c"].map(makeStringId);
  const translations = Object.fromEntries(oldIds.map((id, i) => [id, `t${i}`]));
  const newIds = new Set(["x", "y", "z"].map(makeStringId));
  const table = buildTranslationTable(translations, newIds);
  assert.deepEqual(table.entries, {});
  assert.equal(table.schema, SCHEMA_VERSION);
});

test("randomised: table keys are always a subset of the updated extract", () => {
  for (let iter = 0; iter < 500; iter++) {
    const all = [];
    const count = 5 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) all.push(makeStringId(`str-${iter}-${i}`));
    const translations = Object.fromEntries(all.map((id) => [id, "x" + Math.random()]));

    // The "updated" extract keeps a random subset of the original ids.
    const surviving = new Set(all.filter(() => Math.random() < 0.5));
    const table = buildTranslationTable(translations, surviving);

    for (const key of Object.keys(table.entries)) {
      assert.ok(surviving.has(key), `stale id ${key} leaked after update`);
    }
  }
});

// ─── summary ─────────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
