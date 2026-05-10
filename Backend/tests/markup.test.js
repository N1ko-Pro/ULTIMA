/**
 * Tests for markupParserAI — sanitizer, glossary resolution, integration.
 * Run: node electron/tests/markup.test.js
 */

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const {
  sanitizeAiXmlOutput,
  removeHallucinatedLSTags,
  restoreTagsFromMarkers,
} = require(path.join(__dirname, "../manager/ai_utils/markupParserAI"));

const { resolveTagTranslation } = require(path.join(__dirname, "../manager/ai_utils/glossaryResolver"));

const { buildGlossaryLookup } = require(path.join(__dirname, "../manager/shared_utils/textUtils"));

const { DEFAULT_GLOSSARY } = require(path.join(__dirname, "../manager/dictionary_utils/constants"));

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

// ─── sanitizeAiXmlOutput ─────────────────────────────────────────────────────

section("sanitizeAiXmlOutput — split attribute patterns");

test("fixes <LSTag T>ooltip= split at first letter", () => {
  const input  = `<LSTag T>ooltip="AttackRoll">бросков атаки</LSTag>`;
  const expect = `<LSTag Tooltip="AttackRoll">бросков атаки</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

test("fixes <LSTag T>ooltip= split inside a sentence", () => {
  const input  = `при <LSTag T>ooltip="AttackRoll">бросков атаки</LSTag> рукопашным`;
  const expect = `при <LSTag Tooltip="AttackRoll">бросков атаки</LSTag> рукопашным`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

test("fixes <LSTag To>oltip= split at second letter", () => {
  const input  = `<LSTag To>oltip="Advantage">text</LSTag>`;
  const expect = `<LSTag Tooltip="Advantage">text</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

test("fixes multiple broken tags in one string", () => {
  const input  = `при <LSTag T>ooltip="AttackRoll">бросков</LSTag> и <LSTag T>ooltip="Strength">Силы</LSTag>`;
  const expect = `при <LSTag Tooltip="AttackRoll">бросков</LSTag> и <LSTag Tooltip="Strength">Силы</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

test("fixes <LSTag T>ype='Spell' Tooltip='X'> with two attributes", () => {
  const input  = `<LSTag T>ype="Spell" Tooltip="FountofMoonlight">Fount</LSTag>`;
  const expect = `<LSTag Type="Spell" Tooltip="FountofMoonlight">Fount</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

section("sanitizeAiXmlOutput — bracket corruption");

test("fixes [LSTag bracket → <LSTag", () => {
  const input  = `[LSTag Tooltip="Blinded"]ослеплённый</LSTag>`;
  const expect = `<LSTag Tooltip="Blinded">ослеплённый</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

test("fixes [/LSTag] closing bracket", () => {
  const input  = `<LSTag Tooltip="Blinded">ослеплённый[/LSTag]`;
  const expect = `<LSTag Tooltip="Blinded">ослеплённый</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

test("fixes [/LSTag> mixed bracket/angle", () => {
  const input  = `<LSTag Tooltip="Blinded">ослеплённый[/LSTag>`;
  const expect = `<LSTag Tooltip="Blinded">ослеплённый</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), expect);
});

section("sanitizeAiXmlOutput — must NOT break correct tags");

test("leaves correct <LSTag Tooltip=X> unchanged", () => {
  const input = `<LSTag Tooltip="Advantage">преимущество</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), input);
});

test("leaves correct multi-attribute <LSTag> unchanged", () => {
  const input = `<LSTag Type="Spell" Tooltip="FountofMoonlight">Источника Лунного Света</LSTag>`;
  assert.equal(sanitizeAiXmlOutput(input), input);
});

test("leaves marker [T1:слово] unchanged", () => {
  const input = `[T1:преимущество] к [1]`;
  assert.equal(sanitizeAiXmlOutput(input), input);
});

test("leaves placeholder [1] unchanged", () => {
  const input = `в радиусе [1] футов`;
  assert.equal(sanitizeAiXmlOutput(input), input);
});

// ─── resolveTagTranslation ───────────────────────────────────────────────────

section("resolveTagTranslation — glossary lookup");

const glossaryPairs = DEFAULT_GLOSSARY.map(e => [e.source, e.target]);
const lookup = buildGlossaryLookup(glossaryPairs);

test("exact content match: 'Advantage' → 'Преимущество'", () => {
  assert.equal(resolveTagTranslation("Advantage", ``, lookup), "Преимущество");
});

test("lowercase content match: 'advantage' → 'преимущество'", () => {
  assert.equal(resolveTagTranslation("advantage", ``, lookup), "преимущество");
});

test("plural content: 'attack rolls' → 'Бросок атаки' (lowercase b)", () => {
  const result = resolveTagTranslation("attack rolls", ``, lookup);
  assert.equal(result.toLowerCase(), "бросок атаки");
});

test("plural content: 'checks' → resolves via tooltip 'AbilityCheck'", () => {
  const result = resolveTagTranslation("checks", ` Tooltip="AbilityCheck"`, lookup);
  assert.notEqual(result, "checks"); // must be resolved
});

test("tooltip camelCase: 'AbilityCheck' → 'Проверка характеристики'", () => {
  const result = resolveTagTranslation("checks", ` Tooltip="AbilityCheck"`, lookup);
  assert.match(result, /проверка/i);
});

test("tooltip camelCase: 'SavingThrow' → 'Спасбросок'", () => {
  const result = resolveTagTranslation("saves", ` Tooltip="SavingThrow"`, lookup);
  assert.match(result, /спасбросок/i);
});

test("tooltip camelCase: 'AttackRoll' → 'Бросок атаки'", () => {
  const result = resolveTagTranslation("attack rolls", ` Tooltip="AttackRoll"`, lookup);
  assert.match(result, /бросок/i);
});

test("direct: 'Strength' → 'Сила'", () => {
  assert.equal(resolveTagTranslation("Strength", ``, lookup), "Сила");
});

test("unknown content → returned unchanged", () => {
  assert.equal(resolveTagTranslation("Fount of Moonlight", ` Tooltip="FountofMoonlight"`, lookup), "Fount of Moonlight");
});

test("uppercase preserved: 'Advantage' → starts with capital", () => {
  const result = resolveTagTranslation("Advantage", ``, lookup);
  assert.match(result, /^[А-ЯЁ]/u);
});

test("lowercase preserved: 'advantage' → starts with lowercase", () => {
  const result = resolveTagTranslation("advantage", ``, lookup);
  assert.match(result, /^[а-яё]/u);
});

// ─── Real-world integration strings ─────────────────────────────────────────

section("resolveTagTranslation — real BG3 examples");

const realCases = [
  { content: "advantage",    tooltip: "Advantage",     expectRu: /преимущество/i },
  { content: "Disadvantage", tooltip: "Disadvantage",  expectRu: /помеха/i },
  { content: "attack rolls", tooltip: "AttackRoll",    expectRu: /бросок/i },
  { content: "Strength",     tooltip: "Strength",      expectRu: /сила/i },
  { content: "resistance",   tooltip: "Resistant",     expectRu: /сопротивление/i },
  { content: "checks",       tooltip: "AbilityCheck",  expectRu: /проверка/i },
  { content: "saves",        tooltip: "SavingThrow",   expectRu: /спасбросок/i },
];

for (const { content, tooltip, expectRu } of realCases) {
  test(`[${tooltip}] "${content}" → resolves to Russian`, () => {
    const attrs = ` Tooltip="${tooltip}"`;
    const result = resolveTagTranslation(content, attrs, lookup);
    assert.match(result, expectRu, `Got: ${result}`);
  });
}

// ─── removeHallucinatedLSTags ─────────────────────────────────────────────────

section("removeHallucinatedLSTags — hallucination stripping");

test("strips LSTag whose Tooltip is absent from markerText", () => {
  const markerText = `Это даёт вам [T1:Преимущество] при [T2:Бросок атаки] рукопашным оружием в этот ход, но attack rolls against you have advantage until your next turn.`;
  const aiOutput   = `Это даёт вам [T1:преимущество] при [T2:бросках атаки] рукопашным оружием в этот ход, но <LSTag Tooltip="AttackRoll">броски атаки</LSTag> против вас имеют преимущество до вашего следующего хода.`;
  const expected   = `Это даёт вам [T1:преимущество] при [T2:бросках атаки] рукопашным оружием в этот ход, но броски атаки против вас имеют преимущество до вашего следующего хода.`;
  assert.equal(removeHallucinatedLSTags(aiOutput, markerText), expected);
});

test("keeps LSTag present in markerText (non-glossary passthrough)", () => {
  const markerText = `Activating this ability creates a <LSTag Tooltip="FountOfMoonlight">Fount of Moonlight</LSTag> around you.`;
  const aiOutput   = `Активация создаёт <LSTag Tooltip="FountOfMoonlight">Источник лунного света</LSTag> вокруг вас.`;
  assert.equal(removeHallucinatedLSTags(aiOutput, markerText), aiOutput);
});

test("allows exactly N copies if N are in markerText", () => {
  const markerText = `<LSTag Tooltip="Foo">Foo</LSTag> and <LSTag Tooltip="Foo">Foo</LSTag>.`;
  const aiOutput   = `<LSTag Tooltip="Foo">Bar</LSTag> и <LSTag Tooltip="Foo">Bar</LSTag>.`;
  assert.equal(removeHallucinatedLSTags(aiOutput, markerText), aiOutput);
});

test("strips the extra copy when AI adds one more than expected", () => {
  const markerText = `<LSTag Tooltip="Foo">Foo</LSTag> text.`;
  const aiOutput   = `<LSTag Tooltip="Foo">Bar</LSTag> text и <LSTag Tooltip="Foo">Bar</LSTag>.`;
  const expected   = `<LSTag Tooltip="Foo">Bar</LSTag> text и Bar.`;
  assert.equal(removeHallucinatedLSTags(aiOutput, markerText), expected);
});

test("returns text unchanged when no LSTag in output", () => {
  const text = "просто текст без тегов";
  assert.equal(removeHallucinatedLSTags(text, ""), text);
});

test("strips ALL LSTags when markerText has none (pure markers scenario)", () => {
  const markerText = `[T1:Преимущество] при [T2:Бросок атаки].`;
  const aiOutput   = `[T1:преимущество] при <LSTag Tooltip="AttackRoll">бросках атаки</LSTag>.`;
  const expected   = `[T1:преимущество] при бросках атаки.`;
  assert.equal(removeHallucinatedLSTags(aiOutput, markerText), expected);
});

// ─── restoreTagsFromMarkers — doubled vowel fix ─────────────────────────────

section("restoreTagsFromMarkers — doubled vowel typo fix");

function makeMarkerEntry(index, tooltip, word, originalCase = "upper") {
  return {
    index,
    attrs: ` Tooltip="${tooltip}"`,
    word,
    shortWord: word.toLowerCase(),
    glossaryResolved: true,
    originalCase,
  };
}

test("fixes doubled vowel: [T1:ослепиить] → Ослепить", () => {
  const map = [makeMarkerEntry(1, "BLINDED", "Ослеплённый")];
  const result = restoreTagsFromMarkers("[T1:ослепиить]", map);
  assert.equal(result, `<LSTag Tooltip="BLINDED">Ослепить</LSTag>`);
});

test("keeps valid AI form without doubled vowels: [T1:ослеплён]", () => {
  const map = [makeMarkerEntry(1, "BLINDED", "Ослеплённый")];
  const result = restoreTagsFromMarkers("[T1:ослеплён]", map);
  assert.equal(result, `<LSTag Tooltip="BLINDED">Ослеплён</LSTag>`);
});

test("keeps doubled vowel when glossary also has it: [T1:зоопарке]", () => {
  const map = [makeMarkerEntry(1, "Zoo", "Зоопарк")];
  const result = restoreTagsFromMarkers("[T1:зоопарке]", map);
  assert.equal(result, `<LSTag Tooltip="Zoo">Зоопарке</LSTag>`);
});

test("fixes multiple doubled vowels: [T1:ослеепиить] → Ослепить", () => {
  const map = [makeMarkerEntry(1, "BLINDED", "Ослеплённый")];
  const result = restoreTagsFromMarkers("[T1:ослеепиить]", map);
  assert.equal(result, `<LSTag Tooltip="BLINDED">Ослепить</LSTag>`);
});

test("preserves lowercase case after dedup: [T1:ослепиить]", () => {
  const map = [makeMarkerEntry(1, "BLINDED", "Ослеплённый", "lower")];
  const result = restoreTagsFromMarkers("[T1:ослепиить]", map);
  assert.equal(result, `<LSTag Tooltip="BLINDED">ослепить</LSTag>`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
if (fail === 0) {
  console.log(`\x1b[32m✓ All ${pass} tests passed\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ ${fail} failed\x1b[0m, ${pass} passed`);
  process.exitCode = 1;
}
