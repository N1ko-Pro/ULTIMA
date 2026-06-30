using System.Collections.Generic;
using System.IO;

namespace UltimaLoc
{
    /// <summary>
    /// File-loading half of LocStore. Uses the dependency-free MiniJson parser
    /// (NOT Newtonsoft.Json, which crashes on MSC's stripped Unity runtime).
    /// </summary>
    public static partial class LocStore
    {
        /// <summary>
        /// Load every *.json table in <paramref name="dir"/>. Malformed files are
        /// skipped. Returns the number of tables successfully loaded.
        /// </summary>
        public static int LoadFromDirectory(string dir)
        {
            int loaded = 0;
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return 0;

            foreach (string file in Directory.GetFiles(dir, "*.json"))
            {
                try
                {
                    if (LoadFromJson(File.ReadAllText(file))) loaded++;
                }
                catch
                {
                    // Skip malformed/partial tables — never break other mods.
                }
            }
            return loaded;
        }

        /// <summary>
        /// Parse and merge a single translation table from a JSON string (e.g. a
        /// file on disk, or an assembly-embedded resource). Returns true when the
        /// table parsed as an object. Malformed input is swallowed (returns false).
        /// </summary>
        public static bool LoadFromJson(string jsonText)
        {
            if (string.IsNullOrEmpty(jsonText)) return false;
            try
            {
                var root = MiniJson.Parse(jsonText) as Dictionary<string, object>;
                if (root == null) return false;

                object targetObj;
                if (root.TryGetValue("targetAssembly", out targetObj) && targetObj is string)
                {
                    string target = (string)targetObj;
                    if (!string.IsNullOrEmpty(target)) Targets.Add(target);
                }

                object entriesObj;
                if (root.TryGetValue("entries", out entriesObj) && entriesObj is Dictionary<string, object>)
                {
                    foreach (KeyValuePair<string, object> kv in (Dictionary<string, object>)entriesObj)
                    {
                        string value = kv.Value as string;
                        if (!string.IsNullOrEmpty(kv.Key) && !string.IsNullOrEmpty(value))
                        {
                            Map[kv.Key] = value;
                        }
                    }
                }

                // Optional: format templates (source-with-{0} → translation) for
                // reverse-matching already-expanded runtime strings.
                object templatesObj;
                if (root.TryGetValue("templates", out templatesObj) && templatesObj is Dictionary<string, object>)
                {
                    foreach (KeyValuePair<string, object> kv in (Dictionary<string, object>)templatesObj)
                    {
                        string value = kv.Value as string;
                        if (!string.IsNullOrEmpty(kv.Key) && !string.IsNullOrEmpty(value))
                        {
                            AddTemplate(kv.Key, value);
                        }
                    }
                }

                // Optional: human-authored source→translation pairs (the id, case
                // variants and any format template are derived on load). Used by
                // hand-written tables like the embedded MSCLoader translation.
                object stringsObj;
                if (root.TryGetValue("strings", out stringsObj) && stringsObj is Dictionary<string, object>)
                {
                    foreach (KeyValuePair<string, object> kv in (Dictionary<string, object>)stringsObj)
                    {
                        string value = kv.Value as string;
                        if (!string.IsNullOrEmpty(kv.Key) && !string.IsNullOrEmpty(value))
                        {
                            AddBySource(kv.Key, value);
                        }
                    }
                }
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
