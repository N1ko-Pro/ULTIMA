using System;
using System.Collections;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Harmony;
using MSCLoader;

namespace UltimaLoc
{
    /// <summary>
    /// Translates MSCLoader's in-game console output.
    ///
    /// The display-only <see cref="LocText"/> sweep cannot reliably translate the
    /// console: it is a single, ever-growing scrollback buffer rendered into one
    /// Text component, so each new line is concatenated into a giant string that
    /// never equals any one source entry. Instead we intercept every line at the
    /// SOURCE — the one chokepoint all console output funnels through:
    /// <c>MSCLoader.ConsoleController.AppendLogLine(string line)</c>. ModConsole's
    /// Print / Error / Warning (and the loader's own status messages) all end up
    /// calling it, so a single prefix here covers the whole console.
    ///
    /// Two parts:
    ///   1. A Harmony PREFIX on AppendLogLine — translates every FUTURE line in
    ///      place before it is enqueued.
    ///   2. A one-time SWEEP of the EXISTING scrollback — lines printed during the
    ///      loader's own start-up (version banner, "Loaded N mods!", asset loads…)
    ///      were appended before this mod's OnMenuLoad ran, so the prefix never
    ///      saw them; we retro-translate the queued lines and refresh the view.
    ///
    /// This is SAFE in a way the ldstr transpiler is not: the argument is always
    /// finished DISPLAY text (already rich-text-formatted), never a string used as
    /// a logic identifier, URL parameter, GameObject/FSM name, etc. We translate
    /// via <see cref="LocStore.TryTranslateBlock"/> (direct lookup + case variants
    /// + {n} format-template reverse-match) plus an Error/Warning wrapper peel.
    /// Never throws — a failed translation must never break console logging.
    /// </summary>
    internal static class LocConsole
    {
        /// <summary>
        /// Hook ConsoleController.AppendLogLine and retro-translate the existing
        /// scrollback. Returns 1 when the hook was installed, 0 if the type /
        /// method / prefix could not be resolved.
        /// </summary>
        public static int Install(HarmonyInstance harmony)
        {
            if (harmony == null) return 0;
            try
            {
                // ConsoleController is internal to the MSCLoader assembly; resolve
                // it via any known public type from that assembly (Mod).
                Type tController = typeof(Mod).Assembly.GetType("MSCLoader.ConsoleController");
                if (tController == null) return 0;

                MethodInfo append = tController.GetMethod(
                    "AppendLogLine",
                    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
                    null, new[] { typeof(string) }, null);
                if (append == null || append.IsAbstract) return 0;

                MethodInfo prefix = typeof(LocConsole).GetMethod(
                    "BeforeAppend", BindingFlags.Static | BindingFlags.NonPublic);
                if (prefix == null) return 0;

                harmony.Patch(append, new HarmonyMethod(prefix), null);

                // Translate whatever is already buffered + on screen.
                try { SweepExisting(tController); } catch { /* sweep is best-effort */ }

                return 1;
            }
            catch
            {
                return 0;
            }
        }

        // Harmony prefix on ConsoleController.AppendLogLine(string line):
        // translate the line in place before it is enqueued into the scrollback.
        private static void BeforeAppend(ref string line)
        {
            if (string.IsNullOrEmpty(line) || LocStore.Map.Count == 0) return;
            try
            {
                string tr;
                if (TryTranslateLine(line, out tr)) line = tr;
            }
            catch { /* never break console logging */ }
        }

        /// <summary>
        /// Translate a single console line. Returns true (with <paramref name="result"/>
        /// set) only when something changed.
        /// </summary>
        private static bool TryTranslateLine(string line, out string result)
        {
            result = line;
            if (string.IsNullOrEmpty(line) || LocStore.Map.Count == 0) return false;

            // 1) Whole-line lookup (+ case variants, multi-fragment block, and {n}
            //    format-template reverse match). Covers every direct
            //    ModConsole.Print(...) message — the bulk of loader output.
            string tr;
            if (LocStore.TryTranslateBlock(line, out tr) &&
                !string.Equals(tr, line, StringComparison.Ordinal))
            {
                result = tr;
                return true;
            }

            // 2) Error/Warning wrapper. ModConsole.Error/Warning don't pass their
            //    message straight to AppendLogLine — they wrap it as
            //    "<color=red><b>{asm}Error: </b>{msg}</color>" (yellow/Warning for
            //    warnings; {asm} is "" for loader-internal messages or a "ModName "
            //    prefix otherwise). The whole wrapped line rarely matches a table
            //    key, so we peel the wrapper, translate the label word and the
            //    inner message independently, then rewrap — keeping the mod-name
            //    prefix and color tags intact.
            return TryTranslateWrapped(line, out result);
        }

        // "<color=red><b>{asm}Error: </b>{msg}</color>" /
        // "<color=yellow><b>{asm}Warning: </b>{msg}</color>".
        // g1=color, g2=asm prefix (may be empty), g3=Error|Warning, g4=message.
        private static readonly Regex WrapRe = new Regex(
            @"^<color=(red|yellow)><b>(.*?)(Error|Warning): </b>(.*)</color>$",
            RegexOptions.Singleline);

        private static bool TryTranslateWrapped(string line, out string result)
        {
            result = line;
            Match m = WrapRe.Match(line);
            if (!m.Success) return false;

            string color = m.Groups[1].Value;
            string asm = m.Groups[2].Value;   // "" or "ModName " — left untouched
            string word = m.Groups[3].Value;  // "Error" / "Warning"
            string msg = m.Groups[4].Value;

            string trWord;
            if (!LocStore.TryTranslate(word, out trWord) || string.IsNullOrEmpty(trWord))
                trWord = word;

            string trMsg;
            if (!LocStore.TryTranslateBlock(msg, out trMsg) || string.IsNullOrEmpty(trMsg))
                trMsg = msg;

            bool changed = !string.Equals(trWord, word, StringComparison.Ordinal) ||
                           !string.Equals(trMsg, msg, StringComparison.Ordinal);
            if (!changed) return false;

            result = "<color=" + color + "><b>" + asm + trWord + ": </b>" + trMsg + "</color>";
            return true;
        }

        // ── Existing-buffer sweep ──────────────────────────────────────────────
        // Lines printed before this mod loaded are already in ConsoleController's
        // scrollback queue (and rendered into ConsoleView.logTextArea). The append
        // prefix can't reach them retroactively, so translate the queued lines in
        // place and refresh the on-screen Text once.
        private static void SweepExisting(Type tController)
        {
            // ModConsole.console (internal static ConsoleView).
            Type tModConsole = typeof(Mod).Assembly.GetType("MSCLoader.ModConsole");
            if (tModConsole == null) return;
            FieldInfo fConsole = tModConsole.GetField(
                "console", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public);
            object view = fConsole != null ? fConsole.GetValue(null) : null;
            if (view == null) return;

            Type tView = view.GetType();
            FieldInfo fController = tView.GetField(
                "controller", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
            object controller = fController != null ? fController.GetValue(view) : null;
            if (controller == null) return;

            // scrollback is a Queue<string>; treat it as a non-generic IEnumerable
            // / ICollection so we don't need the closed generic type at compile time.
            FieldInfo fScroll = tController.GetField(
                "scrollback", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            object scrollObj = fScroll != null ? fScroll.GetValue(controller) : null;
            IEnumerable scroll = scrollObj as IEnumerable;
            if (scroll == null) return;

            // Snapshot + translate.
            var lines = new System.Collections.Generic.List<string>();
            bool any = false;
            foreach (object o in scroll)
            {
                string s = o as string;
                string tr;
                if (!string.IsNullOrEmpty(s) && TryTranslateLine(s, out tr)) { lines.Add(tr); any = true; }
                else lines.Add(s);
            }
            if (!any) return;

            // Rewrite the queue in place (Clear + Enqueue via reflection so we stay
            // type-agnostic).
            MethodInfo clear = scrollObj.GetType().GetMethod("Clear", Type.EmptyTypes);
            MethodInfo enqueue = scrollObj.GetType().GetMethod("Enqueue");
            if (clear != null && enqueue != null)
            {
                clear.Invoke(scrollObj, null);
                foreach (string s in lines) enqueue.Invoke(scrollObj, new object[] { s });
            }

            // Refresh the rendered Text directly (the prefix already handles future
            // logChanged rebuilds; AppendLogLine recomputes `log` from the now-
            // translated queue, so we only need to fix the current view).
            FieldInfo fLogText = tView.GetField(
                "logTextArea", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            object logText = fLogText != null ? fLogText.GetValue(view) : null;
            if (logText == null) return;

            PropertyInfo pText = logText.GetType().GetProperty(
                "text", BindingFlags.Instance | BindingFlags.Public);
            if (pText == null || !pText.CanWrite) return;

            var sb = new StringBuilder();
            for (int i = 0; i < lines.Count; i++)
            {
                if (i > 0) sb.Append(Environment.NewLine);
                sb.Append(lines[i]);
            }
            pText.SetValue(logText, sb.ToString(), null);
        }
    }
}
