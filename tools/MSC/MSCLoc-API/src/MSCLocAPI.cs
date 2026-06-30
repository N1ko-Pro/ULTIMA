using System.IO;
using System.Reflection;
using Harmony;
using MSCLoader;

namespace UltimaLoc
{
    /// <summary>
    /// MSCLoc API — an MSCLoader mod that translates OTHER mods' hardcoded string
    /// literals at runtime from translation tables shipped next to it
    /// (Mods/Config/MSCLocAPI/*.json), without replacing any original .dll.
    /// </summary>
    public class MSCLocAPI : Mod
    {
        public override string ID => "MSCLocAPI";
        public override string Name => "MSCLoc API";
        public override string Version => "1.1.2";
        public override string Author => "ANICKON";

        public MSCLocAPI()
        {
            Description = "Translates other mods' strings at runtime from MSCLoc API translation tables. " +
                          "Does not modify the original mod files.";
        }

        public override void ModSetup()
        {
            // OnMenuLoad is the earliest stable phase where every mod assembly is
            // already loaded into the AppDomain — patch before gameplay JITs the
            // target methods.
            SetupFunction(Setup.OnMenuLoad, Mod_OnMenuLoad);
        }

        private void Mod_OnMenuLoad()
        {
            try
            {
                string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string configDir = Path.Combine(Path.Combine(dir, "Config"), "MSCLocAPI");

                int tables = LocStore.LoadFromDirectory(configDir);
                if (tables == 0 || LocStore.Map.Count == 0)
                {
                    ModConsole.Log("[MSCLoc API] No translation tables found — nothing to translate.");
                    return;
                }

                Harmony.HarmonyInstance harmony = Harmony.HarmonyInstance.Create("mscloc.api");

                // IMPORTANT: the ldstr transpiler (LocPatch.ApplyToLoadedTargets)
                // is intentionally DISABLED. It rewrites string literals in mod
                // code, and a literal's content alone can't tell a UI string from
                // an IDENTIFIER. Mods use literals as GameObject names
                // (GameObject.Find("Saturday")), PlayMaker FSM/state/event names
                // (GetState/InitializeFSM/First<FsmState>), Resources/PlayerPrefs
                // keys, etc. Translating those breaks the mod at runtime (objects
                // / states "not found", NullReference, mods auto-disabled). We
                // therefore translate ONLY what is actually DISPLAYED, via the
                // hooks below — they change a UnityEngine.UI.Text's shown value
                // (and settings labels), never a string used in logic.
                int settings = LocSettings.TranslateLoadedSettings();
                LocSettings.Install(harmony);
                int fitHooks = LocLayout.Install(harmony);

                // Translate UI text as it appears (sweep + OnEnable + set_text).
                // Also where formatted dynamic strings ("77 achievements
                // remaining.") get translated — via the format-template reverse
                // match inside LocStore — safely (display-only).
                int textHooks = LocText.Install(harmony);

                ModConsole.Log(string.Format(
                    "[MSCLoc API] Loaded {0} table(s), {1} string(s); translated {2} setting(s); fit-hooks {3}; text-sweep {4}. (ldstr transpile disabled — display-only.)",
                    tables, LocStore.Map.Count, settings, fitHooks, textHooks));
            }
            catch (System.Exception ex)
            {
                // Never break the game / other mods on a patcher failure.
                ModConsole.Error("[MSCLoc API] Patcher failed: " + ex.Message);
            }
        }
    }
}
