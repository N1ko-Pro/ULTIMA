using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace UltimaLoc
{
    /// <summary>
    /// Merged translation state: id→text lookup plus the set of target assembly
    /// names to patch. Ids are content hashes, so merging tables from several
    /// mods is safe (identical source text → identical id → identical
    /// translation).
    ///
    /// This part is pure (no JSON/IO dependency) so it can be unit-tested on a
    /// modern runtime. File loading lives in the partial in LocStore.Io.cs.
    /// </summary>
    public static partial class LocStore
    {
        // Merged id → translated text across every loaded table.
        public static readonly Dictionary<string, string> Map =
            new Dictionary<string, string>(StringComparer.Ordinal);

        // Simple assembly names that have at least one translation table.
        public static readonly HashSet<string> Targets =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// True (with the translation) when <paramref name="original"/> has a
        /// non-empty translation in the merged map; false leaves the original.
        /// </summary>
        public static bool TryTranslate(string original, out string translated)
        {
            translated = null;
            if (string.IsNullOrEmpty(original)) return false;

            if (Map.TryGetValue(LocId.Make(original), out translated) && !string.IsNullOrEmpty(translated))
                return true;

            // Case-insensitive fallback: the app emits UPPER/lower variant keys
            // for every entry, so a runtime string shown in a different case
            // (e.g. a mod that ToUpper()s its UI, or a header rendered all-caps)
            // still resolves to the same translation.
            string upper = original.ToUpperInvariant();
            if (!string.Equals(upper, original, StringComparison.Ordinal) &&
                Map.TryGetValue(LocId.Make(upper), out translated) && !string.IsNullOrEmpty(translated))
                return true;

            string lower = original.ToLowerInvariant();
            if (!string.Equals(lower, original, StringComparison.Ordinal) &&
                Map.TryGetValue(LocId.Make(lower), out translated) && !string.IsNullOrEmpty(translated))
                return true;

            // Line-ending fallback: the table is keyed from source the app
            // extracted with '\n', but a runtime string may carry '\r\n' or '\r'
            // (different newline convention) and would otherwise hash to a
            // different id. Normalize to '\n' and retry once (the normalized form
            // has no '\r', so this can't recurse).
            if (original.IndexOf('\r') >= 0)
            {
                string norm = original.Replace("\r\n", "\n").Replace('\r', '\n');
                if (!string.Equals(norm, original, StringComparison.Ordinal) &&
                    TryTranslate(norm, out translated))
                    return true;
            }

            translated = null;
            return false;
        }

        // Splits on newlines OR runs of 2+ spaces, KEEPING the separators
        // (capturing group) so a translated block can be rejoined with its
        // original gaps. Mods often pad with `new string(' ', N)` to force a
        // wrap (e.g. "TOP SPEED" + 90 spaces + "ACCELERATION\n<color=red>...")
        // — that whole padded string has no id, but its pieces do, so we split
        // on the padding too. Single spaces are NOT separators (most keys, like
        // "TOP SPEED", contain them).
        private static readonly Regex NewlineSplit = new Regex("(\r\n|\r|\n| {2,})");

        /// <summary>
        /// Like <see cref="TryTranslate"/>, but also handles text a mod built at
        /// runtime by concatenating several literals — joined by Environment.
        /// NewLine and/or space padding (e.g. <c>"TOP SPEED" + new string(' ', 90)
        /// + "ACCELERATION\n&lt;color=red&gt;..."</c>). The whole string has no
        /// table id, but the individual pieces do; we split on newlines / 2+-space
        /// runs and reassemble, matching the LONGEST run of pieces first so a key
        /// that itself spans a separator (like <c>"ACCELERATION\n&lt;color=red&gt;
        /// ..."</c>) is still reconstructed. Returns true if anything changed.
        /// </summary>
        public static bool TryTranslateBlock(string original, out string translated)
        {
            translated = original;
            if (string.IsNullOrEmpty(original)) return false;

            // Session memo. Runtime strings recur heavily — the same labels are
            // rebuilt every time a menu opens and HUD text is re-assigned every
            // frame — and each MISS otherwise costs up to three SHA-256 hashes
            // plus a regex split. The merged Map is immutable after load, so a
            // content→result cache is always correct. Bounded: cleared wholesale
            // past the cap so dynamic strings (e.g. live numbers) can't bloat it.
            string cached;
            if (BlockCache.TryGetValue(original, out cached))
            {
                translated = cached;
                return !string.Equals(cached, original, StringComparison.Ordinal);
            }

            bool changed = TryTranslateBlockUncached(original, out translated);
            if (BlockCache.Count >= BlockCacheCap) BlockCache.Clear();
            // Store the original itself for misses so a repeat resolves to "no
            // change" without re-hashing.
            BlockCache[original] = changed ? translated : original;
            return changed;
        }

        // Cap is intentionally generous: real games show far fewer than this many
        // distinct UI strings, while still guarding against unbounded growth from
        // ever-changing dynamic text.
        private const int BlockCacheCap = 8192;
        private static readonly Dictionary<string, string> BlockCache =
            new Dictionary<string, string>(StringComparer.Ordinal);

        private static bool TryTranslateBlockUncached(string original, out string translated)
        {
            translated = original;
            if (string.IsNullOrEmpty(original)) return false;

            // Fast path: the whole string is a known literal.
            string whole;
            if (TryTranslate(original, out whole)) { translated = whole; return true; }

            // parts: even indices = segment content, odd indices = separators
            // (newline runs or 2+-space padding). Fewer than 3 parts ⇒ no
            // separator ⇒ nothing a block pass can do.
            string[] parts = NewlineSplit.Split(original);
            int n = parts.Length;
            if (n >= 3)
            {
                int lineCount = (n + 1) / 2;

                // Maximal-munch over consecutive lines. A single table key can
                // itself span several lines (the app may group e.g. a label with
                // the warning beneath it as "ACCELERATION\n<color=red>...</color>"),
                // so we can't just translate one line at a time — that would never
                // reconstruct a multi-line key. From each line we try the LONGEST
                // run of lines first, shrinking until a key matches; unmatched
                // lines pass through verbatim.
                var sb = new StringBuilder();
                bool any = false;
                int i = 0;
                while (i < lineCount)
                {
                    bool matched = false;
                    int maxSpan = lineCount - i;
                    if (maxSpan > MaxBlockSpanLines) maxSpan = MaxBlockSpanLines;

                    for (int span = maxSpan; span >= 1; span--)
                    {
                        int startPart = i * 2;
                        int endContentPart = (i + span - 1) * 2;
                        string candidate = ConcatParts(parts, startPart, endContentPart);
                        string tr;
                        if (!string.IsNullOrEmpty(candidate) && TryTranslate(candidate, out tr))
                        {
                            sb.Append(tr);
                            int sepIdx = endContentPart + 1;          // separator after the span
                            if (sepIdx < n) sb.Append(parts[sepIdx]);
                            i += span;
                            any = true;
                            matched = true;
                            break;
                        }
                    }

                    if (!matched)
                    {
                        int startPart = i * 2;
                        sb.Append(parts[startPart]);                  // line, untranslated
                        int sepIdx = startPart + 1;
                        if (sepIdx < n) sb.Append(parts[sepIdx]);
                        i += 1;
                    }
                }

                if (any) { translated = sb.ToString(); return true; }
            }

            // Last resort: reverse-match a fully-formatted runtime string against
            // a known format template (e.g. on-screen "77 achievements remaining."
            // ↔ template "{0} achievements remaining."). Covers strings the ldstr
            // transpiler / String.Format hook couldn't reach because the host
            // built the text before we patched (and never rebuilt it).
            if (Templates.Count > 0)
            {
                string fromTemplate;
                if (TryTranslateTemplate(original, out fromTemplate))
                {
                    translated = fromTemplate;
                    return true;
                }
            }
            return false;
        }

        // Upper bound on how many consecutive lines a single key may span — keeps
        // the maximal-munch search O(lineCount * MaxBlockSpanLines) on pathological
        // giant text blocks while still covering realistic grouped entries.
        private const int MaxBlockSpanLines = 32;

        // Concatenate parts[from..to] inclusive (content + the separators between
        // them), i.e. the exact original substring spanning those lines.
        private static string ConcatParts(string[] parts, int from, int to)
        {
            if (from == to) return parts[from];
            var sb = new StringBuilder();
            for (int k = from; k <= to; k++) sb.Append(parts[k]);
            return sb.ToString();
        }

        // Test/diagnostics helper — clears all loaded state.
        public static void Reset()
        {
            Map.Clear();
            Targets.Clear();
            BlockCache.Clear();
            Templates.Clear();
        }

        /// <summary>
        /// Register a translation keyed by its SOURCE text (the human-readable
        /// English string), computing the content id itself. Also registers the
        /// UPPER/lower case variants and, if the source has placeholders, a format
        /// template. Lets a table be authored as plain source→translation pairs
        /// (used by the embedded MSCLoader table) instead of pre-hashed ids.
        /// </summary>
        public static void AddBySource(string source, string translated)
        {
            if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(translated)) return;

            Map[LocId.Make(source)] = translated;

            string upper = source.ToUpperInvariant();
            if (!string.Equals(upper, source, StringComparison.Ordinal))
            {
                string id = LocId.Make(upper);
                if (!Map.ContainsKey(id)) Map[id] = translated;
            }
            string lower = source.ToLowerInvariant();
            if (!string.Equals(lower, source, StringComparison.Ordinal) &&
                !string.Equals(lower, upper, StringComparison.Ordinal))
            {
                string id = LocId.Make(lower);
                if (!Map.ContainsKey(id)) Map[id] = translated;
            }

            AddTemplate(source, translated); // no-op when the source has no placeholder
        }

        // ── Format templates ──────────────────────────────────────────────────
        // A source string with .NET composite-format placeholders ({0}, {1:F2}…)
        // can't be matched directly once the host expands it ("77 achievements
        // remaining."). We ship the template (source → translation) so we can
        // reverse-match: turn the source into a regex, capture what stood where the
        // placeholders were, and drop those captures into the translated template.

        private sealed class FormatTemplate
        {
            public Regex Matcher;     // ^lit0(.*?)lit1…$  — one group per placeholder
            public int[] GroupIndex;  // GroupIndex[i] = the {n} index of capture group i
            public string Translated; // translated template, still containing {n}
        }

        private static readonly List<FormatTemplate> Templates = new List<FormatTemplate>();

        // {0} or {12:F2} etc. Group 1 = the numeric placeholder index.
        private static readonly Regex PlaceholderRe = new Regex(@"\{(\d+)(?::[^}]*)?\}");

        /// <summary>
        /// Register a source→translation format template. No-op if the source has
        /// no placeholder or too little literal text (would over-match).
        /// </summary>
        public static void AddTemplate(string source, string translated)
        {
            if (string.IsNullOrEmpty(source) || string.IsNullOrEmpty(translated)) return;
            try
            {
                MatchCollection ms = PlaceholderRe.Matches(source);
                if (ms.Count == 0) return;

                // Guard: require real literal text around the placeholders so a
                // near-empty template (e.g. just "{0}") can't match everything.
                string literalOnly = PlaceholderRe.Replace(source, "").Trim();
                if (literalOnly.Length < 3) return;

                var pattern = new StringBuilder("^");
                var groupIndex = new List<int>();
                int last = 0;
                foreach (Match m in ms)
                {
                    pattern.Append(Regex.Escape(source.Substring(last, m.Index - last)));
                    pattern.Append("(.*?)");
                    groupIndex.Add(int.Parse(m.Groups[1].Value));
                    last = m.Index + m.Length;
                }
                pattern.Append(Regex.Escape(source.Substring(last)));
                pattern.Append("$");

                Templates.Add(new FormatTemplate
                {
                    Matcher = new Regex(pattern.ToString(), RegexOptions.Singleline),
                    GroupIndex = groupIndex.ToArray(),
                    Translated = translated,
                });
            }
            catch { /* a malformed template must never break loading */ }
        }

        // Reverse-match `text` against every registered template; on the first hit,
        // substitute the captured values into that template's translation.
        private static bool TryTranslateTemplate(string text, out string result)
        {
            result = null;
            if (string.IsNullOrEmpty(text)) return false;

            // Many console lines are printed WITH a trailing Environment.NewLine
            // ("...mods!</color></b>\r\n"). Template matchers are anchored with
            // '$', which (no Multiline) only matches at end-of-string or just
            // before a final '\n' — never past a '\r'. So a "\r\n"-terminated line
            // would fail to match. Strip any trailing CR/LF, match the core, then
            // re-append the exact suffix to the translated result.
            string trailing = "";
            string core = text;
            int end = text.Length;
            while (end > 0 && (text[end - 1] == '\n' || text[end - 1] == '\r')) end--;
            if (end < text.Length)
            {
                trailing = text.Substring(end);
                core = text.Substring(0, end);
            }

            for (int t = 0; t < Templates.Count; t++)
            {
                FormatTemplate tpl = Templates[t];
                Match m = tpl.Matcher.Match(core);
                if (!m.Success) continue;

                // Map placeholder index → captured value.
                var values = new Dictionary<int, string>();
                for (int g = 0; g < tpl.GroupIndex.Length; g++)
                {
                    int idx = tpl.GroupIndex[g];
                    if (!values.ContainsKey(idx)) values[idx] = m.Groups[g + 1].Value;
                }

                result = PlaceholderRe.Replace(tpl.Translated, mm =>
                {
                    string v;
                    return values.TryGetValue(int.Parse(mm.Groups[1].Value), out v) ? v : mm.Value;
                }) + trailing;
                return true;
            }
            return false;
        }
    }
}
