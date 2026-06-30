using System;
using System.IO;
using System.Reflection;
using Harmony;
using MSCLoader;

namespace UltimaLoc
{
    /// <summary>
    /// MSCLoader RU — translates the MSCLoader UI itself into Russian at runtime.
    ///
    /// Reuses the UltimaLoc engine (LocStore / LocText / LocFormat / LocLayout /
    /// LocPatch / templates) but, instead of reading per-mod tables from
    /// Mods/Config, it loads ONE embedded table that targets the "MSCLoader"
    /// assembly. The table is authored as plain source→translation pairs (see
    /// data/mscloader.ru.json); ids, case variants and format templates are
    /// derived on load.
    ///
    /// MSCLoader builds its own UI before any mod runs, so the heavy lifting is
    /// done by the runtime UI.Text sweep/hooks (which translate by content) plus
    /// the format-template reverse match. The ldstr transpiler is deliberately
    /// NOT used here: the loader assembly mixes UI text with logic literals
    /// (e.g. update-request parameters), and rewriting those would break it.
    /// Never throws.
    /// </summary>
    public class MSCLoaderRU : Mod
    {
        public override string ID => "MSCLoaderRU";
        public override string Name => "MSCLoader RU";
        public override string Version => "1.0.0";
        public override string Author => "ANICKON";

        public MSCLoaderRU()
        {
            Description = "Русификация интерфейса MSCLoader в рантайме. Не заменяет файлы загрузчика.";
        }

        public override void ModSetup()
        {
            SetupFunction(Setup.OnMenuLoad, Mod_OnMenuLoad);
        }

        private void Mod_OnMenuLoad()
        {
            try
            {
                string json = ReadEmbeddedTable();
                if (string.IsNullOrEmpty(json))
                {
                    ModConsole.Error("[MSCLoader RU] Embedded translation table not found.");
                    return;
                }

                if (!LocStore.LoadFromJson(json) || LocStore.Map.Count == 0)
                {
                    ModConsole.Log("[MSCLoader RU] No strings to translate.");
                    return;
                }

                HarmonyInstance harmony = HarmonyInstance.Create("mscloc.mscloader.ru");

                // IMPORTANT: do NOT run the ldstr transpiler on the MSCLoader
                // assembly. Our table is built from common dictionary words
                // ("Mods", "References", "Updates", "Key", "No"…, plus their case
                // variants), and the MSCLoader assembly mixes UI text with LOGIC
                // literals (URL/query parameters like "mods"/"references" used to
                // build the update-check request). Rewriting those literals
                // corrupts the request → the server replies "Invalid request".
                // Display-side hooks below are safe: they only ever change a
                // Text component's shown value, never a string used in logic.
                int settings = LocSettings.TranslateLoadedSettings();
                LocSettings.Install(harmony);
                int fit  = LocLayout.Install(harmony);
                int text = LocText.Install(harmony);
                int con  = LocConsole.Install(harmony);

                ModConsole.Log(string.Format(
                    "[MSCLoader RU] Loaded {0} string(s); settings {1}; fit-hooks {2}; text-sweep {3}; console {4}.",
                    LocStore.Map.Count, settings, fit, text, con));
            }
            catch (Exception ex)
            {
                ModConsole.Error("[MSCLoader RU] Failed: " + ex.Message);
            }
        }

        // The embedded resource's logical name depends on RootNamespace/folder, so
        // match by suffix rather than hard-coding it.
        private static string ReadEmbeddedTable()
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                foreach (string name in asm.GetManifestResourceNames())
                {
                    if (name.EndsWith("mscloader-ru.json", StringComparison.OrdinalIgnoreCase))
                    {
                        using (Stream s = asm.GetManifestResourceStream(name))
                        {
                            if (s == null) continue;
                            using (StreamReader r = new StreamReader(s))
                                return r.ReadToEnd();
                        }
                    }
                }
            }
            catch { /* fall through */ }
            return null;
        }
    }
}
