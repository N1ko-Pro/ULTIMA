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

            // Fast path: the whole string is a known literal.
            string whole;
            if (TryTranslate(original, out whole)) { translated = whole; return true; }

            // parts: even indices = segment content, odd indices = separators
            // (newline runs or 2+-space padding). Fewer than 3 parts ⇒ no
            // separator ⇒ nothing a block pass can do.
            string[] parts = NewlineSplit.Split(original);
            int n = parts.Length;
            if (n < 3) return false;
            int lineCount = (n + 1) / 2;

            // Maximal-munch over consecutive lines. A single table key can itself
            // span several lines (the app may group e.g. a label with the warning
            // beneath it as "ACCELERATION\n<color=red>...</color>"), so we can't
            // just translate one line at a time — that would never reconstruct a
            // multi-line key. From each line we try the LONGEST run of lines first,
            // shrinking until a key matches; unmatched lines pass through verbatim.
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

            if (!any) return false;
            translated = sb.ToString();
            return true;
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
        }
    }
}
