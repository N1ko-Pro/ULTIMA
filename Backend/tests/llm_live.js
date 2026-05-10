/**
 * Live LLM translation test — focused on verifying the Smart Glossary Picker.
 * Only matched terms should appear first in the 60-pair prompt window.
 *
 * Usage:
 *   node electron/tests/llm_live.js
 *   node electron/tests/llm_live.js "model-name"
 */

"use strict";

const path = require("node:path");

const aiManager                = require(path.join(__dirname, "../manager/aiManager"));
const { DEFAULT_OLLAMA_MODEL } = require(path.join(__dirname, "../manager/ollama_utils/constantsAI"));
const { DEFAULT_GLOSSARY }     = require(path.join(__dirname, "../manager/dictionary_utils/constants"));

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  cyan:    "\x1b[36m",
  gray:    "\x1b[90m",
};

function label(text, color) { return `${color}${C.bold}${text}${C.reset}`; }
function hr(char = "─", w = 72) { return char.repeat(w); }
function box(text, color) { return `  ${color}${text}${C.reset}`; }
function indent(text, pad = "    ") {
  return text.split("\n").map(l => pad + l).join("\n");
}

// ─── Validation checks ────────────────────────────────────────────────────────

const CHECKS = {
  markersPreserved(source, result) {
    const resTags  = (result.match(/<LSTag\b/g) || []).length;
    const origTags = (source.match(/<LSTag\b/g) || []).length;
    return [{ pass: resTags >= origTags, label: `LSTags: expected ≥${origTags}, got ${resTags}` }];
  },
  brPreserved(source, result) {
    const srcBr = (source.match(/<br\s*\/?>/gi) || []).length;
    const resBr = (result.match(/<br\s*\/?>/gi) || []).length;
    return [{ pass: srcBr === resBr, label: `<br> count: expected ${srcBr}, got ${resBr}` }];
  },
  placeholders(source, result) {
    const srcP = (source.match(/\[\d+\]/g) || []).sort().join(",");
    const resP = (result.match(/\[\d+\]/g) || []).sort().join(",");
    return [{ pass: srcP === resP, label: `placeholders: [${srcP}] preserved` }];
  },
  noUnitsAfterToken(result) {
    const bad = /\[\d+\]\s*(?:урон|фут|метр|damage|feet|ft)/i.test(result);
    return [{ pass: !bad, label: "no unit words after [n] tokens" }];
  },
  formalYou(result) {
    const hasInformal = /\bты\b|\bтвой\b|\bтвоей\b|\bтвоим\b|\bтвоих\b|\bтебя\b|\bтебе\b/i.test(result);
    return [{ pass: !hasInformal, label: 'formal "вы/ваш" (no ты/твой)' }];
  },
};

// ─── Glossary ─────────────────────────────────────────────────────────────────

const GLOSSARY_PAIRS = DEFAULT_GLOSSARY.map(e => [e.source, e.target]);

function reMatchPairs(combinedText, pairs) {
  return pairs.filter(p => {
    const s = p[0];
    if (!s || typeof s !== "string") return false;
    try {
      const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Allow optional plural suffix so display matches picker logic
      return new RegExp(`(\\b${esc}(?:e?s)?\\b|Tooltip="${esc}")`, "i").test(combinedText);
    } catch { return false; }
  });
}

// ─── Test definitions ─────────────────────────────────────────────────────────
//
// pickerMustInclude  — these terms MUST appear in the prompt (were matched)
// pickerMustExclude  — these terms must NOT appear as a match (false-positive guard)
// pickerMinMatched   — minimum number of matched terms expected
// pickerMaxMatched   — maximum number of matched terms (for negative tests)
// checks             — structural quality checks on the translation output

const TESTS = {

  // ══════════════════════════════════════════════════════════════════
  //  SMART PICKER TESTS
  // ══════════════════════════════════════════════════════════════════

  "P1 · Picker — Max hit (8 glossary terms in plain text)": {
    source:
      `You must make a Saving Throw against being Blinded. On success, you gain ` +
      `Advantage on your next Strength check. On failure, you are Stunned. ` +
      `Use a Bonus Action to maintain Concentration, consuming one Spell Slot.`,
    desc:
      "8 distinct glossary terms in plain text. " +
      "Picker must hit all of them and list them FIRST in the 60-pair prompt.",
    pickerMustInclude: ["Saving Throw", "Blinded", "Advantage", "Strength",
                        "Stunned", "Bonus Action", "Concentration", "Spell Slot"],
    pickerMinMatched: 7,
    checks: ["formalYou"],
  },

  "P2 · Picker — LSTag inner text match": {
    source:
      `Gain <LSTag Tooltip="Resistant">resistance</LSTag> to physical damage, and ` +
      `<LSTag Tooltip="Advantage">advantage</LSTag> on ` +
      `<LSTag Tooltip="Strength">Strength</LSTag> ` +
      `<LSTag Tooltip="SavingThrow">saving throws</LSTag>.<br><br>` +
      `You cannot maintain <LSTag Tooltip="Concentration">concentration</LSTag> on spells.`,
    desc:
      "Glossary terms appear as LSTag inner text (not as Tooltip attr values). " +
      "Picker should find: advantage, Strength, saving throw(s), concentration.",
    pickerMustInclude: ["Advantage", "Strength", "Saving Throw", "Concentration"],
    pickerMinMatched: 4,
    checks: ["markersPreserved", "brPreserved", "formalYou"],
  },

  "P3 · Picker — Negative (no game terms)": {
    source:
      `The sun was setting behind the distant hills. ` +
      `She laughed and ran through the fields, feeling completely free at last.`,
    desc:
      "Pure narrative text — no D&D/BG3 terms. " +
      "Picker must find 0 matches (first 60 glossary entries used as fallback).",
    pickerMaxMatched: 0,
    checks: [],
  },

  "P4 · Picker — Whole-word guard": {
    source:
      `He was a strong man, full of reactions to every action around him. ` +
      `She had advantages in life that others lacked.`,
    desc:
      'Subword "strong" must NOT match "Strength" (no false positive). ' +
      '"action" and "advantages" SHOULD match their terms.',
    pickerMustExclude: ["Strength"],
    pickerMustInclude: ["Action", "Advantage"],
    checks: [],
  },

  // ══════════════════════════════════════════════════════════════════
  //  QUALITY TESTS
  // ══════════════════════════════════════════════════════════════════

  "Q1 · Multi-tag + placeholder + <br> stress test": {
    source:
      `Grants [1] and <LSTag Tooltip="Advantage">advantage</LSTag> on ` +
      `<LSTag Tooltip="SavingThrow">saving throws</LSTag> against spells.` +
      `<br><br><b>Spirit Guardians:</b> Hostile creatures within [2] take [3] ` +
      `at the start of each turn.<br><br>` +
      `Requires <LSTag Tooltip="Concentration">concentration</LSTag>.`,
    desc: "3 LSTags + 3 placeholders + 2×<br><br> — full structural integrity check.",
    checks: ["markersPreserved", "brPreserved", "placeholders", "noUnitsAfterToken"],
  },

  "Q2 · Units stripped after [n] token": {
    source:
      `Hurl a bolt of moonlight at a creature within [1], dealing [2] damage ` +
      `on a hit. On a miss, the target still takes half damage.`,
    desc: '"damage" after [1]/[2] must be stripped, not translated to "урон".',
    checks: ["noUnitsAfterToken", "placeholders", "formalYou"],
  },

  "Q3 · Reaction + Bonus Action + placeholders": {
    source:
      `You can take a <LSTag Type="ActionResource" Tooltip="ReactionActionPoint">reaction</LSTag> ` +
      `to reduce the damage by [1]. Additionally, you may use a ` +
      `<LSTag Type="ActionResource" Tooltip="BonusActionPoint">bonus action</LSTag> ` +
      `to teleport to an unoccupied space within [2].`,
    desc: "Reaction + Bonus Action with placeholders — standardized phrasing test.",
    checks: ["markersPreserved", "placeholders", "noUnitsAfterToken", "formalYou"],
  },
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const model = process.argv[2] || DEFAULT_OLLAMA_MODEL;

  console.log(`\n${hr("═")}`);
  console.log(`${C.bold}  BG3 ULTIMA — Live LLM + Smart Picker Test${C.reset}`);
  console.log(`  Model   : ${C.yellow}${model}${C.reset}`);
  console.log(`  Glossary: ${C.yellow}${GLOSSARY_PAIRS.length} pairs total${C.reset}  (prompt cap = 60)`);
  console.log(`${hr("═")}`);

  const manager = aiManager;
  manager.ollamaModel = model;

  // ── Intercept _resolveRuntimeOptions ─────────────────────────────────────────
  let lastOpts = null;
  const _origResolve = manager._resolveRuntimeOptions.bind(manager);
  manager._resolveRuntimeOptions = function (targetLang, options, promptGlossaryPairs) {
    lastOpts = _origResolve(targetLang, options, promptGlossaryPairs);
    return lastOpts;
  };

  // ── Suppress verbose LLM call logs, just count ───────────────────────────────
  let completionCount = 0;
  const _origRequest = manager._requestCompletion.bind(manager);
  manager._requestCompletion = async function (messages, opts) {
    completionCount++;
    return _origRequest(messages, opts);
  };

  // ── Run tests ─────────────────────────────────────────────────────────────────
  const scoreboard = [];

  for (const [name, testCase] of Object.entries(TESTS)) {
    completionCount = 0;
    lastOpts = null;
    console.log(`\n${hr()}`);
    console.log(label(`  ${name}`, C.cyan));
    console.log(`  ${C.gray}${testCase.desc}${C.reset}`);
    console.log(`\n  ${label("Source:", C.yellow)}`);
    console.log(indent(testCase.source, "    ") + C.reset);

    const t0 = Date.now();
    try {
      const results = await manager.translateBatchWithRetry(
        { text: testCase.source },
        "Russian",
        { ollamaModel: model, glossaryPairs: GLOSSARY_PAIRS },
      );
      const result  = results["text"] ?? "(empty)";
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

      // ── Show picker diagnostics ─────────────────────────────────────────────
      const promptPairs = Array.isArray(lastOpts?.promptGlossaryPairs)
        ? lastOpts.promptGlossaryPairs : [];
      const matchedPairs = reMatchPairs(testCase.source, promptPairs);
      const matchedSources = matchedPairs.map(p => p[0]);

      console.log(`\n  ${label("🔍 Picker:", C.cyan)}`);
      console.log(`     In prompt   : ${C.yellow}${promptPairs.length}${C.reset} / 60 pairs`);
      console.log(`     Matched (↑) : ${C.green}${matchedPairs.length}${C.reset} terms found in source text`);
      if (matchedPairs.length > 0) {
        const list = matchedPairs.map(p => `${C.green}${p[0]}${C.reset} → ${p[1]}`).join(", ");
        console.log(`     ${list}`);
      } else {
        console.log(`     ${C.gray}(no matches — first 60 glossary entries as fallback)${C.reset}`);
      }

      console.log(`\n  ${label("✅ Result:", C.green)}`);
      console.log(box(result, C.green));
      console.log(`  ${C.gray}${elapsed}s · ${completionCount} LLM call(s)${C.reset}`);

      // ── Build checks ──────────────────────────────────────────────────────
      const testResults = [];

      if (testCase.pickerMinMatched !== undefined) {
        testResults.push({
          pass: matchedPairs.length >= testCase.pickerMinMatched,
          label: `picker found ≥${testCase.pickerMinMatched} matched terms (got ${matchedPairs.length})`,
        });
      }
      if (testCase.pickerMaxMatched !== undefined) {
        testResults.push({
          pass: matchedPairs.length <= testCase.pickerMaxMatched,
          label: `picker found ≤${testCase.pickerMaxMatched} matches for non-game text (got ${matchedPairs.length})`,
        });
      }
      if (testCase.pickerMustInclude) {
        for (const term of testCase.pickerMustInclude) {
          testResults.push({
            pass: matchedSources.some(s => s.toLowerCase() === term.toLowerCase()),
            label: `matched: "${term}"`,
          });
        }
      }
      if (testCase.pickerMustExclude) {
        for (const term of testCase.pickerMustExclude) {
          testResults.push({
            pass: !matchedSources.some(s => s.toLowerCase() === term.toLowerCase()),
            label: `NOT matched (no false positive): "${term}"`,
          });
        }
      }
      for (const checkName of (testCase.checks || [])) {
        const fn = CHECKS[checkName];
        if (!fn) continue;
        const structural = ["markersPreserved", "brPreserved", "placeholders"];
        const items = structural.includes(checkName)
          ? fn(testCase.source, result)
          : fn(result);
        testResults.push(...items);
      }

      if (testResults.length > 0) {
        console.log(`\n  ${label("Checks:", C.blue)}`);
        for (const { pass, label: lbl } of testResults) {
          const icon = pass ? `${C.green}✓` : `${C.red}✗`;
          console.log(`    ${icon} ${lbl}${C.reset}`);
        }
      }

      const passed = testResults.filter(r => r.pass).length;
      scoreboard.push({ name, passed, total: testResults.length, elapsed });

    } catch (err) {
      console.error(`\n  ${C.red}${C.bold}❌ Error: ${err.message}${C.reset}`);
      scoreboard.push({ name, passed: 0, total: 1, elapsed: "0.0" });
    }
  }

  // ── Scoreboard ──────────────────────────────────────────────────────────────
  console.log(`\n${hr("═")}`);
  console.log(`${C.bold}  SCOREBOARD${C.reset}`);
  console.log(hr("─"));
  let totalPassed = 0, totalChecks = 0;
  for (const { name, passed, total, elapsed } of scoreboard) {
    totalPassed += passed;
    totalChecks += total;
    const color = total === 0 ? C.gray : (passed === total ? C.green : C.red);
    const bar   = total === 0 ? "—" : `${passed}/${total}`;
    console.log(`  ${color}${bar}${C.reset}  ${name}  ${C.gray}(${elapsed}s)${C.reset}`);
  }
  console.log(hr("─"));
  const pct   = totalChecks > 0 ? ((totalPassed / totalChecks) * 100).toFixed(0) : "—";
  const color = totalPassed === totalChecks ? C.green : C.red;
  console.log(`  ${color}${C.bold}Total: ${totalPassed}/${totalChecks} (${pct}%)${C.reset}`);
  console.log(`${hr("═")}\n`);
}

main().catch(err => {
  console.error(`\x1b[31mFatal: ${err.message}\x1b[0m`);
  process.exit(1);
});
