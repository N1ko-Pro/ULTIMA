using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using UltimaLoc;

// ─────────────────────────────────────────────────────────────────────────────
//  MSCLoc API unit tests (pure core).
//    • Property 3 — MakeId determinism + the cross-language id contract,
//      cross-checked against golden vectors produced by Node's makeStringId.
//    • Property 5 — the patcher translates a literal iff its id is present with
//      a non-empty value; misses leave the original.
// ─────────────────────────────────────────────────────────────────────────────

int pass = 0, fail = 0;

void Test(string name, Action body)
{
    try { body(); pass++; Console.WriteLine("  [PASS] " + name); }
    catch (Exception e) { fail++; Console.WriteLine("  [FAIL] " + name + " :: " + e.Message); }
}

void Assert(bool cond, string msg)
{
    if (!cond) throw new Exception(msg);
}

static string ReferenceId(string text)
{
    using var sha = SHA256.Create();
    var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(text ?? string.Empty));
    var sb = new StringBuilder("u");
    for (int i = 0; i < 8; i++) sb.Append(hash[i].ToString("x2"));
    return sb.ToString();
}

Console.WriteLine("LocId — contract & determinism (Property 3)");

// Golden vectors copied from Node's makeStringId (stringId.js) — these MUST
// match byte-for-byte across the toolchain.
var golden = new Dictionary<string, string>
{
    [""]                        = "ue3b0c44298fc1c14",
    ["Hello"]                   = "u185f8db32271fe25",
    ["Привет, мир"]             = "u2a2e76364df5ab8f",
    ["MSCQualityTweaks_ITEMS"]  = "ub077c140ffe23b85",
    ["car jack(itemx)"]         = "ua64f26589d4a9d02",
};

Test("matches Node golden vectors", () =>
{
    foreach (var kv in golden)
        Assert(LocId.Make(kv.Key) == kv.Value, $"'{kv.Key}' → {LocId.Make(kv.Key)} ≠ {kv.Value}");
});

Test("matches the documented formula for arbitrary input", () =>
{
    foreach (var s in new[] { "a", "ABC abc 123", "съешь ещё", "tab\there", "emoji🎮" })
        Assert(LocId.Make(s) == ReferenceId(s), $"mismatch for '{s}'");
});

Test("is deterministic and well-formed (u + 16 hex)", () =>
{
    var rng = new Random(1234);
    for (int i = 0; i < 5000; i++)
    {
        string s = "s" + rng.Next() + "-" + i;
        string id = LocId.Make(s);
        Assert(id == LocId.Make(s), "non-deterministic for " + s);
        Assert(id.Length == 17 && id[0] == 'u', "bad shape: " + id);
        for (int k = 1; k < id.Length; k++)
            Assert(Uri.IsHexDigit(id[k]) && !char.IsUpper(id[k]), "non-lower-hex: " + id);
    }
});

Console.WriteLine("\nLocStore.TryTranslate — decision (Property 5)");

Test("translates iff id present with a non-empty value", () =>
{
    LocStore.Reset();
    LocStore.Map[LocId.Make("Hello")] = "Привет";
    LocStore.Map[LocId.Make("Bye")] = ""; // empty → must be ignored

    Assert(LocStore.TryTranslate("Hello", out var tr) && tr == "Привет", "Hello not translated");
    Assert(!LocStore.TryTranslate("Bye", out _), "empty value must not translate");
    Assert(!LocStore.TryTranslate("Unknown", out _), "absent id must not translate");
    Assert(!LocStore.TryTranslate("", out _), "empty input must not translate");
    Assert(!LocStore.TryTranslate(null, out _), "null input must not translate");
});

Test("a miss leaves the original (out is null)", () =>
{
    LocStore.Reset();
    LocStore.Map[LocId.Make("X")] = "Икс";
    Assert(!LocStore.TryTranslate("Y", out var tr), "Y should miss");
    Assert(tr == null, "miss must yield null translation");
});

Test("case-insensitive: a runtime string in another case resolves via variant keys", () =>
{
    LocStore.Reset();
    // The app emits UPPER/lower variant keys for each entry; the patcher folds
    // case on lookup so any runtime casing matches.
    LocStore.Map[LocId.Make("SETTINGS")] = "НАСТРОЙКИ"; // UPPER variant key
    LocStore.Map[LocId.Make("settings")] = "НАСТРОЙКИ"; // lower variant key

    Assert(LocStore.TryTranslate("Settings", out var a) && a == "НАСТРОЙКИ", "title-case must fold to UPPER key");
    Assert(LocStore.TryTranslate("SETTINGS", out var b) && b == "НАСТРОЙКИ", "exact UPPER must match");
    Assert(LocStore.TryTranslate("settings", out var c) && c == "НАСТРОЙКИ", "exact lower must match");
    Assert(!LocStore.TryTranslate("Options", out _), "unrelated string must still miss");
});

Console.WriteLine("\nLocStore.TryTranslateBlock — multi-line concat fallback");

Test("translates a runtime-concatenated multi-line block line-by-line", () =>
{
    LocStore.Reset();
    // Mimics Settings.AddText(string.Concat(line, NewLine, line, ...)): the whole
    // block has no id, but each line does.
    string l1 = "Select jobs size (changes how many delivery locations)";
    string l2 = "<color=orange>Easy</color> - only small boxes.";
    string l3 = "<color=orange>Hard</color> - big boxes.";
    LocStore.Map[LocId.Make(l1)] = "Выбор размера работы";
    LocStore.Map[LocId.Make(l2)] = "<color=orange>Легко</color> - маленькие коробки.";
    LocStore.Map[LocId.Make(l3)] = "<color=orange>Сложно</color> - большие коробки.";

    string block = string.Join("\r\n", new[] { l1, l2, l3 });
    Assert(!LocStore.TryTranslate(block, out _), "whole concatenated block must NOT have an id");
    Assert(LocStore.TryTranslateBlock(block, out var tr), "block must translate line-by-line");
    string expected = "Выбор размера работы\r\n<color=orange>Легко</color> - маленькие коробки.\r\n<color=orange>Сложно</color> - большие коробки.";
    Assert(tr == expected, "block rejoined wrong:\n" + tr);
});

Test("partially-known block keeps untranslated lines intact, separators preserved", () =>
{
    LocStore.Reset();
    LocStore.Map[LocId.Make("Known")] = "Известно";
    string block = "Known\nUnknown line";
    Assert(LocStore.TryTranslateBlock(block, out var tr), "should change (one line known)");
    Assert(tr == "Известно\nUnknown line", "got: " + tr);
});

Test("single-line block with no id is a no-op", () =>
{
    LocStore.Reset();
    Assert(!LocStore.TryTranslateBlock("nothing here", out var tr), "no-op expected");
    Assert(tr == "nothing here", "must leave original");
});

Test("one code literal split across lines by the app translates each line (TOP SPEED case)", () =>
{
    LocStore.Reset();
    // The real mod literal is "TOP SPEED\nACCELERATION\n<color=red>...</color>".
    // The app grouped it as two rows: "TOP SPEED" and the 2-line
    // "ACCELERATION\n<color=red>...</color>" — so one key itself spans a newline.
    // Maximal-munch must rebuild that 2-line key instead of splitting every line.
    LocStore.Map[LocId.Make("TOP SPEED")] = "МАКС. СКОРОСТЬ";
    LocStore.Map[LocId.Make("ACCELERATION\n<color=red>This will overwrite your custom values!</color>")] =
        "РАЗГОН <color=red>Это перезапишет ваши пользовательские значения!</color>";

    string literal = "TOP SPEED\nACCELERATION\n<color=red>This will overwrite your custom values!</color>";
    Assert(!LocStore.TryTranslate(literal, out _), "the combined 3-line literal must NOT have its own id");
    Assert(LocStore.TryTranslateBlock(literal, out var tr), "must translate via maximal-munch");
    string expected = "МАКС. СКОРОСТЬ\nРАЗГОН <color=red>Это перезапишет ваши пользовательские значения!</color>";
    Assert(tr == expected, "got: " + tr);
});

Test("maximal-munch prefers the longest matching span", () =>
{
    LocStore.Reset();
    // Both a 2-line key and its first line alone exist; the longer key wins.
    LocStore.Map[LocId.Make("HEAD")] = "ГОЛОВА";
    LocStore.Map[LocId.Make("HEAD\nBODY")] = "ГОЛОВА+ТЕЛО";
    Assert(LocStore.TryTranslateBlock("HEAD\nBODY", out var tr), "should match");
    Assert(tr == "ГОЛОВА+ТЕЛО", "longest span must win, got: " + tr);
});

Test("space-padded concat (TOP SPEED + N spaces + ACCELERATION\\n<warn>) translates", () =>
{
    LocStore.Reset();
    // Real FifthGear case: AddText("TOP SPEED" + new string(' ',90) + "ACCELERATION\n<color=red>...").
    LocStore.Map[LocId.Make("TOP SPEED")] = "МАКС. СКОРОСТЬ";
    LocStore.Map[LocId.Make("ACCELERATION\n<color=red>This will overwrite your custom values!</color>")] =
        "РАЗГОН <color=red>Это перезапишет ваши пользовательские значения!</color>";

    string pad = new string(' ', 90);
    string runtime = "TOP SPEED" + pad + "ACCELERATION\n<color=red>This will overwrite your custom values!</color>";
    Assert(!LocStore.TryTranslate(runtime, out _), "the padded whole string must NOT have an id");
    Assert(LocStore.TryTranslateBlock(runtime, out var tr), "must translate across the space padding");
    string expected = "МАКС. СКОРОСТЬ" + pad + "РАЗГОН <color=red>Это перезапишет ваши пользовательские значения!</color>";
    Assert(tr == expected, "padding must be preserved; got len=" + tr.Length);
});

Test("line-ending fallback: CRLF/CR runtime text matches an LF-keyed entry", () =>
{
    LocStore.Reset();
    // The app keyed this from "...\n..."; the runtime may deliver "...\r\n...".
    LocStore.Map[LocId.Make("ACCELERATION\n<color=red>warn</color>")] = "РАЗГОН <color=red>пред</color>";
    Assert(LocStore.TryTranslate("ACCELERATION\r\n<color=red>warn</color>", out var a) && a == "РАЗГОН <color=red>пред</color>",
        "CRLF must fold to the LF key, got: " + a);
    Assert(LocStore.TryTranslate("ACCELERATION\r<color=red>warn</color>", out var b) && b == "РАЗГОН <color=red>пред</color>",
        "CR must fold to the LF key, got: " + b);
});

Console.WriteLine("\nMiniJson + LocStore.LoadFromDirectory");

Test("loads a table: targetAssembly + entries (with escapes/unicode)", () =>
{
    LocStore.Reset();
    string dir = Path.Combine(Path.GetTempPath(), "ultimaloc-test-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(dir);
    try
    {
        // Values exercise escapes the MiniJson parser must handle: quotes,
        // backslashes, newlines, unicode escapes.
        string json =
            "{\n" +
            "  \"schema\": 1,\n" +
            "  \"targetAssembly\": \"SomeMod\",\n" +
            "  \"language\": \"ru\",\n" +
            "  \"entries\": {\n" +
            "    \"uAAAA\": \"Привет, \\\"мир\\\"\",\n" +
            "    \"uBBBB\": \"line1\\nline2\\tend\",\n" +
            "    \"uCCCC\": \"\\u0041\\u0042\\u0043\",\n" +
            "    \"uDDDD\": \"\",\n" +
            "    \"uEEEE\": \"C:\\\\path\\\\file\"\n" +
            "  }\n" +
            "}";
        File.WriteAllText(Path.Combine(dir, "somemod.json"), json, new UTF8Encoding(false));

        int n = LocStore.LoadFromDirectory(dir);
        Assert(n == 1, "expected 1 table loaded, got " + n);
        Assert(LocStore.Targets.Contains("SomeMod"), "targetAssembly not registered");
        Assert(LocStore.Map["uAAAA"] == "Привет, \"мир\"", "escaped quotes/unicode wrong: " + LocStore.Map["uAAAA"]);
        Assert(LocStore.Map["uBBBB"] == "line1\nline2\tend", "escaped control chars wrong");
        Assert(LocStore.Map["uCCCC"] == "ABC", "\\u escapes wrong: " + LocStore.Map["uCCCC"]);
        Assert(!LocStore.Map.ContainsKey("uDDDD"), "empty value must be skipped");
        Assert(LocStore.Map["uEEEE"] == "C:\\path\\file", "escaped backslashes wrong: " + LocStore.Map["uEEEE"]);
    }
    finally { try { Directory.Delete(dir, true); } catch { } }
});

Test("missing directory → 0 tables, no throw", () =>
{
    LocStore.Reset();
    Assert(LocStore.LoadFromDirectory(Path.Combine(Path.GetTempPath(), "nope-" + Guid.NewGuid().ToString("N"))) == 0, "should be 0");
});

Test("malformed json is skipped, valid sibling still loads", () =>
{
    LocStore.Reset();
    string dir = Path.Combine(Path.GetTempPath(), "ultimaloc-test-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(dir);
    try
    {
        File.WriteAllText(Path.Combine(dir, "bad.json"), "{ this is not json ", new UTF8Encoding(false));
        File.WriteAllText(Path.Combine(dir, "good.json"),
            "{\"targetAssembly\":\"Good\",\"entries\":{\"uZZZZ\":\"ok\"}}", new UTF8Encoding(false));
        LocStore.LoadFromDirectory(dir);
        Assert(LocStore.Map.ContainsKey("uZZZZ") && LocStore.Map["uZZZZ"] == "ok", "good table must still load");
    }
    finally { try { Directory.Delete(dir, true); } catch { } }
});

Console.WriteLine($"\n{pass} passed, {fail} failed");
Environment.Exit(fail == 0 ? 0 : 1);
